-- Chỉ thêm ràng buộc cho thao tác mới; kiểm tra dữ liệu cũ trước khi áp dụng remote.
CREATE TRIGGER IF NOT EXISTS requests_validate_insert
BEFORE INSERT ON Requests
BEGIN
  SELECT RAISE(ABORT, 'INVALID_REQUEST_AREA')
    WHERE NEW.Area NOT IN ('KHU_VUC_1', 'KHU_VUC_2');
  SELECT RAISE(ABORT, 'INVALID_REQUEST_DATE')
    WHERE date(NEW.PreferredDate, '+0 days') IS NULL
       OR date(NEW.PreferredDate, '+0 days') != NEW.PreferredDate;
  SELECT RAISE(ABORT, 'INVALID_REQUEST_OWNER')
    WHERE NOT EXISTS (SELECT 1 FROM Users WHERE UserId = NEW.UserId AND Role = 'DAN');
  SELECT RAISE(ABORT, 'INVALID_INITIAL_STATE')
    WHERE NEW.Status != 'CHO_NHAN';
  SELECT RAISE(ABORT, 'INVALID_CREATED_TIMESTAMP')
    WHERE julianday(NEW.CreatedAt) IS NULL
       OR NEW.CreatedAt NOT GLOB '????-??-??T??:??:??.???Z';
END;

CREATE TRIGGER IF NOT EXISTS requests_validate_update
BEFORE UPDATE ON Requests
BEGIN
  SELECT RAISE(ABORT, 'IMMUTABLE_REQUEST')
    WHERE NEW.UserId IS NOT OLD.UserId OR NEW.WasteType IS NOT OLD.WasteType
       OR NEW.QuantityKg IS NOT OLD.QuantityKg OR NEW.Address IS NOT OLD.Address
       OR NEW.Area IS NOT OLD.Area OR NEW.PreferredDate IS NOT OLD.PreferredDate
       OR NEW.Note IS NOT OLD.Note OR NEW.CreatedAt IS NOT OLD.CreatedAt;
  SELECT RAISE(ABORT, 'INVALID_STATUS_TRANSITION')
    WHERE NOT (
      (OLD.Status = 'CHO_NHAN' AND NEW.Status = 'DA_NHAN')
      OR (OLD.Status = 'DA_NHAN' AND NEW.Status = 'HOAN_THANH'
          AND NEW.CollectorId IS OLD.CollectorId AND NEW.AcceptedAt IS OLD.AcceptedAt)
    );
  SELECT RAISE(ABORT, 'INVALID_COLLECTOR')
    WHERE NOT EXISTS (SELECT 1 FROM Users WHERE UserId = NEW.CollectorId AND Role = 'THUGOM');
  SELECT RAISE(ABORT, 'INVALID_ACCEPTED_TIMESTAMP')
    WHERE julianday(NEW.AcceptedAt) IS NULL
       OR NEW.AcceptedAt NOT GLOB '????-??-??T??:??:??.???Z'
       OR NEW.AcceptedAt < NEW.CreatedAt;
  SELECT RAISE(ABORT, 'INVALID_COMPLETED_TIMESTAMP')
    WHERE NEW.CompletedAt IS NOT NULL AND (
      julianday(NEW.CompletedAt) IS NULL
      OR NEW.CompletedAt NOT GLOB '????-??-??T??:??:??.???Z'
      OR NEW.CompletedAt < NEW.AcceptedAt
    );
END;
