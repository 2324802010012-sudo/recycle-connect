import { handleRequests } from "./requests.js";
import { registerCitizen } from "./registration.js";
import { dbErrorLikely, safeLogRoute, sha256Hex } from "./reliability.js";
import { normalizeUsername } from "../../shared/passwords.mjs";
import { checkPassword } from "./password-service.js";
export { PasswordService } from "./password-service.js";

function json(data, status = 200, extraHeaders = {}) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      ...extraHeaders,
    },
  });
}

function errorResponse(message, status, code, extraHeaders = {}) {
  return json({
    success: false,
    error: { code: code ?? ({ 400: 'INVALID_INPUT', 401: 'UNAUTHENTICATED', 403: 'FORBIDDEN', 404: 'NOT_FOUND', 500: 'INTERNAL_ERROR' }[status]), message },
    message,
  }, status, extraHeaders);
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, b =>
    b.toString(16).padStart(2, "0")
  ).join("");
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

  const tokenHash = await sha256Hex(token);

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

  if (origin === target.origin) {
    return true;
  }

  // Chỉ mở Origin Vite khi Worker chạy local.
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

async function handleApi(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  try {
    if (method === "OPTIONS") {
      return new Response(null, { status: 204 });
    }

    if (path === "/api/health" && method === "GET") {
      const result = await env.DB.prepare(
        "SELECT 1 AS connected"
      ).first();

      if (result?.connected !== 1) return errorResponse('Dịch vụ tạm thời không khả dụng.', 503, 'DB_UNAVAILABLE');
      return json({
        success: true,
        api: 'ok',
        db: 'ok',
        service: "Recycle Connect API",
        database: "connected",
      });
    }

    if (method === "POST" && !validOrigin(request)) {
      return errorResponse(
        "Nguồn yêu cầu không hợp lệ.",
        403
      );
    }

    if (path === "/api/auth/register" && method === "POST") {
      return await registerCitizen(request, env);
    }

    if (path === "/api/auth/login" && method === "POST") {
      let body;

      try {
        body = await request.json();
      } catch {
        return errorResponse("JSON không hợp lệ.", 400);
      }

      const username = normalizeUsername(body?.username);
      const password = typeof body?.password === 'string' ? body.password : '';

      if (
        !body || Array.isArray(body) || !username ||
        username.length > 30 ||
        !password ||
        password.length > 128
      ) {
        return errorResponse(
          "Thông tin đăng nhập không hợp lệ.",
          400
        );
      }

      const { success: allowed } = await env.LOGIN_LIMITER.limit({
        key: 'login:' + (request.headers.get('CF-Connecting-IP') ?? 'local'),
      });
      if (!allowed) return errorResponse('Bạn đăng nhập quá nhiều lần. Vui lòng thử lại sau một phút.', 429,
        'LOGIN_RATE_LIMITED', { 'Retry-After': '60' });

      const user = await env.DB.prepare(`
        SELECT
          UserId,
          Username,
          PasswordHash,
          FullName,
          Role,
          ServiceArea
        FROM Users
        WHERE lower(Username) = ?
      `).bind(username).first();

      const verified = await checkPassword(env, password, user?.PasswordHash);

      if (!user || verified !== true) {
        return errorResponse(
          "Tên đăng nhập hoặc mật khẩu không đúng.",
          401
        );
      }

      const token = randomToken();
      const tokenHash = await sha256Hex(token);

      const createdAt = new Date().toISOString();
      const expiresAt = new Date(
        Date.parse(createdAt) + 8 * 60 * 60 * 1000
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
        data: { user: publicUser(user) },
      }, 200, {
        "Set-Cookie": sessionCookie(token, request),
      });
    }

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
        data: { user: publicUser(user) },
      });
    }

    if (path === "/api/auth/logout" && method === "POST") {
      const token = getCookie(request, "rc_session");

      if (!token || !/^[0-9a-f]{64}$/.test(token)) {
        return errorResponse("Chưa đăng nhập.", 401, 'UNAUTHENTICATED', {
          'Set-Cookie': sessionCookie('', request, 0),
        });
      }

      const user = await currentUser(request, env);

      if (!user) {
        return errorResponse(
          "Phiên đăng nhập không hợp lệ.",
          401, 'UNAUTHENTICATED', { 'Set-Cookie': sessionCookie('', request, 0) }
        );
      }

      await env.DB.prepare(`
        UPDATE Sessions
        SET RevokedAt = ?
        WHERE TokenHash = ?
          AND RevokedAt IS NULL
      `).bind(
        new Date().toISOString(),
        await sha256Hex(token)
      ).run();

      return new Response(null, {
        status: 204,
        headers: {
          "Set-Cookie": sessionCookie("", request, 0),
          "Cache-Control": "no-store",
        },
      });
    }

    const response = await handleRequests(request, url, env, currentUser);
    return response ?? errorResponse("Không tìm thấy API.", 404);

  } catch (error) {
    if (error?.name === 'PasswordServiceError') {
      return errorResponse('Dịch vụ xác thực tạm thời không khả dụng. Vui lòng thử lại sau.',
        503, 'PASSWORD_SERVICE_UNAVAILABLE');
    }
    if (['NotSupportedError', 'OperationError'].includes(error?.name)) {
      return errorResponse('Dịch vụ xác thực chưa tương thích cấu hình bảo mật. Vui lòng liên hệ quản trị viên.',
        503, 'PASSWORD_RUNTIME_UNSUPPORTED');
    }
    const databaseUnavailable = dbErrorLikely(error);
    return errorResponse(
      "Dịch vụ tạm thời không khả dụng.",
      databaseUnavailable ? 503 : 500,
      databaseUnavailable ? 'DB_UNAVAILABLE' : 'INTERNAL_ERROR'
    );
  }
}

// Chỉ log mã truy vết và thông tin kỹ thuật, không log mật khẩu, cookie hoặc địa chỉ.
export default {
  async fetch(request, env) {
    const requestId = crypto.randomUUID();
    const started = Date.now();
    let response = await handleApi(request, env);
    const headers = new Headers(response.headers);
    headers.set('X-Request-ID', requestId);
    headers.set('Cache-Control', 'no-store');
    let errorCode = null;
    if (response.status >= 400 && (response.headers.get('Content-Type') || '').includes('json')) {
      const body = await response.json().catch(() => null);
      if (body && typeof body === 'object') {
        errorCode = body?.error?.code || 'HTTP_' + response.status;
        body.requestId = requestId;
        response = Response.json(body, { status: response.status, headers });
      }
    }
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      requestId,
      method: request.method,
      route: safeLogRoute(new URL(request.url).pathname),
      status: response.status,
      durationMs: Date.now() - started,
      errorCode,
      environment: env.ENVIRONMENT || 'unspecified',
    }));
    return new Response(response.body, { status: response.status, headers });
  },
};
