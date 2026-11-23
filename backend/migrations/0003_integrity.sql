-- UNIQUE sẽ dừng nếu dữ liệu cũ bị trùng; không tự xóa bản ghi để vượt qua lỗi.
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_username_normalized ON Users(lower(Username));
CREATE UNIQUE INDEX IF NOT EXISTS uq_requestlogs_request_action ON RequestLogs(RequestId, Action);

-- Trigger ghi log nguyên tử, API không chèn log lần thứ hai.
CREATE TRIGGER IF NOT EXISTS trg_request_create
AFTER INSERT ON Requests
BEGIN
  INSERT INTO RequestLogs(RequestId, ActorId, Action, CreatedAt)
  VALUES (NEW.RequestId, NEW.UserId, 'CREATE', NEW.CreatedAt);
END;

CREATE TRIGGER IF NOT EXISTS trg_request_accept
AFTER UPDATE OF Status ON Requests
WHEN OLD.Status = 'CHO_NHAN' AND NEW.Status = 'DA_NHAN'
BEGIN
  INSERT INTO RequestLogs(RequestId, ActorId, Action, CreatedAt)
  VALUES (NEW.RequestId, NEW.CollectorId, 'ACCEPT', NEW.AcceptedAt);
END;

CREATE TRIGGER IF NOT EXISTS trg_request_complete
AFTER UPDATE OF Status ON Requests
WHEN OLD.Status = 'DA_NHAN' AND NEW.Status = 'HOAN_THANH'
BEGIN
  INSERT INTO RequestLogs(RequestId, ActorId, Action, CreatedAt)
  VALUES (NEW.RequestId, NEW.CollectorId, 'COMPLETE', NEW.CompletedAt);
END;

CREATE TRIGGER IF NOT EXISTS requests_idempotency_immutable
BEFORE UPDATE ON Requests
WHEN NEW.ClientRequestId IS NOT OLD.ClientRequestId OR NEW.PayloadHash IS NOT OLD.PayloadHash
BEGIN
  SELECT RAISE(ABORT, 'IMMUTABLE_IDEMPOTENCY');
END;
