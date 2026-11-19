
-- =====================================================
-- RECYCLE CONNECT
-- DATABASE SCHEMA - BASELINE v1.3
-- Cloudflare D1 / SQLite
-- =====================================================

PRAGMA foreign_keys = ON;

-- =====================================================
-- 1. USERS - QUAN LY TAI KHOAN
-- =====================================================

CREATE TABLE IF NOT EXISTS Users (
    UserId INTEGER PRIMARY KEY AUTOINCREMENT,

    Username TEXT NOT NULL UNIQUE,

    PasswordHash TEXT NOT NULL,

    FullName TEXT NOT NULL,

    Role TEXT NOT NULL DEFAULT 'DAN'
        CHECK (Role IN ('DAN', 'THUGOM', 'ADMIN')),

    ServiceArea TEXT DEFAULT NULL,

    CreatedAt TEXT NOT NULL,

    CHECK (
        (Role = 'THUGOM' AND ServiceArea IS NOT NULL
            AND length(trim(ServiceArea)) > 0)
        OR
        (Role IN ('DAN', 'ADMIN') AND ServiceArea IS NULL)
    )
);

-- =====================================================
-- 2. SESSIONS - QUAN LY PHIEN DANG NHAP
-- =====================================================

CREATE TABLE IF NOT EXISTS Sessions (
    SessionId INTEGER PRIMARY KEY AUTOINCREMENT,

    UserId INTEGER NOT NULL,

    TokenHash TEXT NOT NULL UNIQUE,

    ExpiresAt TEXT NOT NULL,

    RevokedAt TEXT DEFAULT NULL,

    CreatedAt TEXT NOT NULL,

    FOREIGN KEY (UserId)
        REFERENCES Users(UserId)
        ON DELETE RESTRICT
);

-- =====================================================
-- 3. REQUESTS - YEU CAU THU GOM
-- =====================================================

CREATE TABLE IF NOT EXISTS Requests (
    RequestId INTEGER PRIMARY KEY AUTOINCREMENT,

    UserId INTEGER NOT NULL,

    CollectorId INTEGER DEFAULT NULL,

    WasteType TEXT NOT NULL
        CHECK (WasteType IN (
            'GIAY',
            'NHUA',
            'KIM_LOAI',
            'THUY_TINH',
            'KHAC'
        )),

    QuantityKg REAL NOT NULL
        CHECK (
            QuantityKg > 0
            AND QuantityKg <= 1000
            AND typeof(QuantityKg) IN ('real', 'integer')
        ),

    Address TEXT NOT NULL
        CHECK (
            length(trim(Address)) BETWEEN 5 AND 200
        ),

    Area TEXT NOT NULL
        CHECK (length(trim(Area)) > 0),

    PreferredDate TEXT NOT NULL
        CHECK (
            PreferredDate GLOB
            '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
        ),

    Note TEXT DEFAULT NULL
        CHECK (
            Note IS NULL OR length(Note) <= 500
        ),

    Status TEXT NOT NULL DEFAULT 'CHO_NHAN'
        CHECK (Status IN (
            'CHO_NHAN',
            'DA_NHAN',
            'HOAN_THANH'
        )),

    CreatedAt TEXT NOT NULL,

    AcceptedAt TEXT DEFAULT NULL,

    CompletedAt TEXT DEFAULT NULL,

    FOREIGN KEY (UserId)
        REFERENCES Users(UserId)
        ON DELETE RESTRICT,

    FOREIGN KEY (CollectorId)
        REFERENCES Users(UserId)
        ON DELETE RESTRICT,

    CHECK (
        (
            Status = 'CHO_NHAN'
            AND CollectorId IS NULL
            AND AcceptedAt IS NULL
            AND CompletedAt IS NULL
        )
        OR
        (
            Status = 'DA_NHAN'
            AND CollectorId IS NOT NULL
            AND AcceptedAt IS NOT NULL
            AND CompletedAt IS NULL
        )
        OR
        (
            Status = 'HOAN_THANH'
            AND CollectorId IS NOT NULL
            AND AcceptedAt IS NOT NULL
            AND CompletedAt IS NOT NULL
        )
    )
);

-- =====================================================
-- 4. REQUEST LOGS - NHAT KY YEU CAU
-- =====================================================

CREATE TABLE IF NOT EXISTS RequestLogs (
    LogId INTEGER PRIMARY KEY AUTOINCREMENT,

    RequestId INTEGER NOT NULL,

    ActorId INTEGER NOT NULL,

    Action TEXT NOT NULL
        CHECK (Action IN (
            'CREATE',
            'ACCEPT',
            'COMPLETE'
        )),

    CreatedAt TEXT NOT NULL,

    FOREIGN KEY (RequestId)
        REFERENCES Requests(RequestId)
        ON DELETE RESTRICT,

    FOREIGN KEY (ActorId)
        REFERENCES Users(UserId)
        ON DELETE RESTRICT
);

-- =====================================================
-- 5. INDEXES - TOI UU TRUY VAN
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_users_role
ON Users(Role);

CREATE INDEX IF NOT EXISTS idx_users_service_area
ON Users(ServiceArea);

CREATE INDEX IF NOT EXISTS idx_sessions_user
ON Sessions(UserId);

CREATE INDEX IF NOT EXISTS idx_sessions_expires
ON Sessions(ExpiresAt);

CREATE INDEX IF NOT EXISTS idx_requests_status
ON Requests(Status);

CREATE INDEX IF NOT EXISTS idx_requests_area
ON Requests(Area);

CREATE INDEX IF NOT EXISTS idx_requests_user
ON Requests(UserId);

CREATE INDEX IF NOT EXISTS idx_requests_collector
ON Requests(CollectorId);

CREATE INDEX IF NOT EXISTS idx_requests_status_area
ON Requests(Status, Area);

CREATE INDEX IF NOT EXISTS idx_requestlogs_request_created
ON RequestLogs(RequestId, CreatedAt);

CREATE INDEX IF NOT EXISTS idx_requestlogs_actor
ON RequestLogs(ActorId);

-- =====================================================
-- END OF SCHEMA
-- =====================================================
