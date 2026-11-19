
const encoder = new TextEncoder();

function json(data, status = 200, extraHeaders = {}) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      ...extraHeaders,
    },
  });
}

function errorResponse(message, status) {
  return json({
    success: false,
    error: { message },
    message,
  }, status);
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, b =>
    b.toString(16).padStart(2, "0")
  ).join("");
}

async function sha256(value) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(value)
  );

  return Array.from(new Uint8Array(digest), b =>
    b.toString(16).padStart(2, "0")
  ).join("");
}

async function hashPassword(password, salt) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: encoder.encode(salt),
      iterations: 310000,
      hash: "SHA-256",
    },
    key,
    256
  );

  return Array.from(new Uint8Array(bits), b =>
    b.toString(16).padStart(2, "0")
  ).join("");
}

async function verifyPassword(password, stored) {
  if (typeof stored !== "string") return false;

  const parts = stored.split("$");

  if (
    parts.length !== 4 ||
    parts[0] !== "pbkdf2_sha256" ||
    parts[1] !== "310000" ||
    !/^[0-9a-f]{64}$/.test(parts[3])
  ) {
    return false;
  }

  const actual = await hashPassword(password, parts[2]);
  const expected = parts[3];

  let diff = 0;

  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ actual.charCodeAt(i);
  }

  return diff === 0;
}

function getCookie(request, name) {
  const cookies = request.headers.get("Cookie") || "";

  for (const item of cookies.split(";")) {
    const index = item.indexOf("=");
    if (index < 0) continue;

    const key = item.slice(0, index).trim();
    const value = item.slice(index + 1).trim();

    if (key === name) return value;
  }

  return null;
}

function sessionCookie(token, request, maxAge = 28800) {
  const secure = new URL(request.url).protocol === "https:"
    ? "; Secure"
    : "";

  return (
    `rc_session=${token}; HttpOnly; SameSite=Lax; ` +
    `Path=/; Max-Age=${maxAge}${secure}`
  );
}

function publicUser(user) {
  return {
    userId: user.UserId,
    fullName: user.FullName,
    role: user.Role,
    serviceArea: user.ServiceArea,
  };
}

async function currentUser(request, env) {
  const token = getCookie(request, "rc_session");

  if (!token || !/^[0-9a-f]{64}$/.test(token)) {
    return null;
  }

  const tokenHash = await sha256(token);

  const user = await env.DB.prepare(`
    SELECT
      Users.UserId,
      Users.FullName,
      Users.Role,
      Users.ServiceArea
    FROM Sessions
    JOIN Users
      ON Users.UserId = Sessions.UserId
    WHERE Sessions.TokenHash = ?
      AND Sessions.RevokedAt IS NULL
      AND Sessions.ExpiresAt > ?
  `).bind(tokenHash, new Date().toISOString()).first();

  return user;
}

function validOrigin(request) {
  const origin = request.headers.get("Origin");

  if (!origin) {
    return false;
  }

  const target = new URL(request.url);

  // Cho phép yêu cầu cùng nguồn
  if (origin === target.origin) {
    return true;
  }

  // Các địa chỉ Frontend được phép trong môi trường local
  const allowedLocalOrigins = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    "http://127.0.0.1:5175",
  ];

  const isLocalBackend =
    target.hostname === "localhost" ||
    target.hostname === "127.0.0.1";

  return (
    isLocalBackend &&
    allowedLocalOrigins.includes(origin)
  );
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    try {
      if (method === "OPTIONS") {
        return new Response(null, { status: 204 });
      }

      // KIỂM TRA BACKEND VÀ DATABASE
      if (path === "/api/health" && method === "GET") {
        const result = await env.DB.prepare(
          "SELECT 1 AS connected"
        ).first();

        return json({
          success: true,
          service: "Recycle Connect API",
          database: result?.connected === 1
            ? "connected"
            : "unexpected_response",
        });
      }

      // KIỂM TRA ORIGIN CHO POST
      if (method === "POST" && !validOrigin(request)) {
        return errorResponse(
          "Nguồn yêu cầu không hợp lệ.",
          403
        );
      }

      // ĐĂNG NHẬP
      if (path === "/api/auth/login" && method === "POST") {
        let body;

        try {
          body = await request.json();
        } catch {
          return errorResponse("JSON không hợp lệ.", 400);
        }

        const username = String(body?.username || "").trim();
        const password = String(body?.password || "");

        if (
          !username ||
          username.length > 30 ||
          !password ||
          password.length > 128
        ) {
          return errorResponse(
            "Thông tin đăng nhập không hợp lệ.",
            400
          );
        }

        const user = await env.DB.prepare(`
          SELECT
            UserId,
            Username,
            PasswordHash,
            FullName,
            Role,
            ServiceArea
          FROM Users
          WHERE Username = ?
        `).bind(username).first();

        if (
          !user ||
          !(await verifyPassword(password, user.PasswordHash))
        ) {
          return errorResponse(
            "Tên đăng nhập hoặc mật khẩu không đúng.",
            401
          );
        }

        const token = randomToken();
        const tokenHash = await sha256(token);

        const createdAt = new Date().toISOString();
        const expiresAt = new Date(
          Date.now() + 8 * 60 * 60 * 1000
        ).toISOString();

        await env.DB.prepare(`
          INSERT INTO Sessions (
            UserId,
            TokenHash,
            ExpiresAt,
            RevokedAt,
            CreatedAt
          )
          VALUES (?, ?, ?, NULL, ?)
        `).bind(
          user.UserId,
          tokenHash,
          expiresAt,
          createdAt
        ).run();

        return json({
          success: true,
          user: publicUser(user),
        }, 200, {
          "Set-Cookie": sessionCookie(token, request),
        });
      }

      // LẤY THÔNG TIN TÀI KHOẢN
      if (path === "/api/auth/me" && method === "GET") {
        const user = await currentUser(request, env);

        if (!user) {
          return errorResponse(
            "Phiên đăng nhập không hợp lệ hoặc đã hết hạn.",
            401
          );
        }

        return json({
          success: true,
          user: publicUser(user),
        });
      }

      // ĐĂNG XUẤT
      if (path === "/api/auth/logout" && method === "POST") {
        const token = getCookie(request, "rc_session");

        if (!token || !/^[0-9a-f]{64}$/.test(token)) {
          return errorResponse("Chưa đăng nhập.", 401);
        }

        const user = await currentUser(request, env);

        if (!user) {
          return errorResponse(
            "Phiên đăng nhập không hợp lệ.",
            401
          );
        }

        await env.DB.prepare(`
          UPDATE Sessions
          SET RevokedAt = ?
          WHERE TokenHash = ?
            AND RevokedAt IS NULL
        `).bind(
          new Date().toISOString(),
          await sha256(token)
        ).run();

        return new Response(null, {
          status: 204,
          headers: {
            "Set-Cookie": sessionCookie("", request, 0),
            "Cache-Control": "no-store",
          },
        });
      }

      return errorResponse(
        "Không tìm thấy API.",
        404
      );

    } catch (error) {
      console.error("API error:", error);

      return errorResponse(
        "Lỗi xử lý yêu cầu.",
        500
      );
    }
  },
};
