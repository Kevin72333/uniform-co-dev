# 制服管理系統

本儲存庫保存經 50 題需求訪談及庫存、決策、架構三輪交叉稽核後的第一版規格。實作前先以這些文件作為共同基準。

## 第一個可執行切片

目前已接上 Next.js／TypeScript 試算介面、員工明細／品號彙總工作台與 Supabase foundation migration：

- `npm install` 安裝依賴。
- `npm test` 執行 F/I/R/T/D 庫存規則與人資需求明細彙總測試。
- `npm run typecheck` 執行 TypeScript 檢查。
- `npm run build` 建立 Next.js production bundle。
- `npm run dev` 啟動本機介面；沒有 Supabase env 時仍可使用預覽試算。

Supabase migration 位於 `supabase/migrations/0001_uniform_foundation.sql`，目前涵蓋核心主檔、供應商條件、兩倉餘額、受 RLS 保護的 HR 草稿、人資需求、歷史快照、冪等 `operation_commands`、品號鎖與合計預留 `submit_hr_request` RPC。正式上線前仍需補齊倉庫 POST、採購入庫、季節採購、PDF／ERP 與期初切換 migration，以及 Supabase project secrets、鼎新欄位映射與角色初始資料。

## 文件索引

- [業務詞彙](./CONTEXT.md)
- [產品需求規格](./docs/spec/product-requirements.md)
- [流程與權限](./docs/spec/workflows-and-permissions.md)
- [資料模型](./docs/spec/data-model.md)
- [匯入、匯出與鼎新 ERP](./docs/spec/import-export.md)
- [驗收條件](./docs/spec/acceptance-criteria.md)
- [系統架構](./docs/architecture/system-architecture.md)
- [資料保存、封存與容量政策](./docs/architecture/data-retention.md)
- [免費方案官方限制查核](./docs/research/free-tier-constraints.md)
- [實作路線圖](./docs/implementation/roadmap.md)
- [ADR：第一版只支援線上](./docs/adr/0001-online-only-first-release.md)
- [ADR：以期初庫存切換](./docs/adr/0002-cut-over-with-opening-balances.md)
- [ADR：人資送單預留、倉庫發貨過帳](./docs/adr/0003-reserve-before-warehouse-posting.md)

## 尚待提供

1. 鼎新 ERP 成功匯入樣本及欄位規格。
2. 主檔與期初庫存樣本。
3. 公司抬頭、Logo、正式列印樣式與簽名角色／欄位名稱。
4. 第一批帳號、角色及需求窗口權限清單。
5. 異地備份目的地、兩位金鑰保管人、維運信箱，以及暫定 RPO／RTO 的業務接受人。
6. 三年員工、交易、匯入、PDF／ERP 檔案量預估與公司正式保存年限。
7. 連接 Vercel Hobby 的個人 GitHub repository owner 與帳號移交／備援負責人。

可立即依[實作路線圖](./docs/implementation/roadmap.md)開始第 0 階段蒐集與技術驗證。鼎新樣本阻擋第 4 階段驗收；主檔與期初樣本阻擋第 5 階段切換；列印樣式、帳號清單、備份還原與三年容量 gate 則分別阻擋文件、使用者及正式上線驗收。
