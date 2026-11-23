-- Chỉ đọc schema và kiểm tra ràng buộc, không xuất dữ liệu cá nhân hoặc hash.
SELECT name FROM sqlite_master WHERE type='table' AND name IN ('Users','Sessions','Requests','RequestLogs');
PRAGMA table_info(Requests);
SELECT COUNT(*) AS usernameCaseCollisions FROM (
  SELECT 1 FROM Users GROUP BY lower(Username) HAVING COUNT(*) > 1
);
SELECT COUNT(*) AS duplicateActions FROM (
  SELECT 1 FROM RequestLogs GROUP BY RequestId,Action HAVING COUNT(*) > 1
);
SELECT COUNT(*) AS missingCreateLogs FROM Requests r
WHERE NOT EXISTS (SELECT 1 FROM RequestLogs l WHERE l.RequestId=r.RequestId AND l.Action='CREATE');
SELECT name FROM sqlite_master WHERE type='trigger' ORDER BY name;
PRAGMA foreign_key_check;
