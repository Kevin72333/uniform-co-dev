# 07 — Durable Import 解析與整批套用 worker

**What to build:** 以受保護的 `job_import_worker` 讀取已驗證 private Storage object，安全解析 CSV/XLSX，完成 bounded chunk lease、逐列 preview/diff/error、使用者確認後整批 APPLY，支援 EMPLOYEES 與 OPENING_BALANCE once-only gate。

**Blocked by:** 05 — 期初切換、部署與正式驗收

**Status:** ready-for-agent

- [ ] 解析前驗證 signature、MIME、解壓後大小、entry/列/欄/cell 上限、公式／巨集／外部連結／NUL／path traversal，且 parser 不執行公式或網路請求
- [ ] `claim_import_chunk`、heartbeat、complete、fail、cursor CAS 與 lease takeover 在 staging DB 通過並行 smoke
- [ ] EMPLOYEES preview 能分類 INSERT／UPDATE／SKIP／ERROR，逐列差異與錯誤可查詢，SKIP/ERROR 不會套用
- [ ] `confirm_import_batch` 是必要且可查回的 durable gate；zero-diff batch 也不能跳過確認
- [ ] APPLY 以 batch lease/fencing、角色與 PRE_CUTOVER once-only 條件整批交易完成；任何列失敗不發布正式資料
