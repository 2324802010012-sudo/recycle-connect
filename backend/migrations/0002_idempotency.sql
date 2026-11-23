-- Backup/bookmark trước khi áp dụng. Chỉ chạy một lần vì ADD COLUMN không lặp lại được.
ALTER TABLE Requests ADD COLUMN ClientRequestId TEXT;
ALTER TABLE Requests ADD COLUMN PayloadHash TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS uq_requests_user_client_request
  ON Requests(UserId, ClientRequestId) WHERE ClientRequestId IS NOT NULL;
