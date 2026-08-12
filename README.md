# 制服管理系統

本儲存庫保存經 50 題需求訪談及庫存、決策、架構三輪交叉稽核後的第一版規格。實作前先以這些文件作為共同基準。

## 第一個可執行切片

目前已接上 Next.js／TypeScript 試算介面、員工明細／品號彙總工作台、Supabase 登入面板、員工 CSV 安全預覽與主檔 CSV／JSON 匯入／匯出工作台；HR、需求窗口、CEO、採購與倉庫各自的受保護操作入口也已接到對應 RPC：

- `npm install` 安裝依賴。
- `npm test` 執行 F/I/R/T/D 庫存規則與人資需求明細彙總測試。
- `npm run typecheck` 執行 TypeScript 檢查。
- `npm run build` 建立 Next.js production bundle。
- `npm run dev` 啟動本機介面；沒有 Supabase env 時仍可使用預覽試算。

Supabase migrations 位於 `supabase/migrations/`：`0001_uniform_foundation.sql` 涵蓋核心主檔、供應商條件、兩倉餘額、受 RLS 保護的 HR 草稿、人資需求、歷史快照、冪等 `operation_commands`、品號鎖與合計預留 `submit_hr_request` RPC；`0002_warehouse_shipping.sql` 新增倉庫發貨草稿、固定鎖序的 `post_warehouse_shipment` RPC、總倉調出／人資倉調入／發放流水及 POSTED 鎖單；`0003_replenishment.sql` 新增不建立預留的補庫送出與 POST；`0004_stocktake.sql` 新增依 balance version fencing 的盤點 POST 與 `STALE_COUNT`；`0005_returns.sql` 新增原始發放明細同源驗證的退回 POST；`0006_employee_import.sql` 新增整批驗證後原子 upsert 員工主檔的匯入 RPC；`0007_seasonal_procurement.sql` 建立含季別、精確開放／截止時間、凍結員工／品號範圍、窗口需求、核准快照、供應商 MOQ、採購單與分批驗收的 RLS 資料基線；`0008_seasonal_procurement_rpc.sql` 新增活動建立／範圍設定／開放／關閉、送核、帶 revision/hash 的 CEO 核准或退回、不可覆寫的 MOQ 決策、採購上限調整、採購下單、驗收草稿與總倉入庫 POST；`0009_purchase_receipt_corrections.sql` 新增同源採購入庫更正草稿與 POST、有效到貨／合格／拒收重算、總倉合格數量 delta 與 PO `REOPENED` 狀態；`0010_purchase_order_lifecycle.sql` 新增訂購量具理由調整、`REOPENED`、取消與 `CLOSED_SHORT` 終止交易；`0011_erp_export_snapshot.sql` 新增日期＋機構的不可變 ERP 邏輯批次、來源追溯、artifact revision／render attempt 基線與批次／artifact request RPC；`0012_document_artifacts.sql` 新增各類單據 PDF family、不可變 artifact revision、render attempt 與受權限保護的 PDF request RPC，現有需求工作台提供瀏覽器 A4 列印預覽；`0013_opening_balance_cutover.sql` 新增 SYSTEM_ADMIN 專用期初批次、全域 PRE_CUTOVER／LIVE singleton、opening ledger 與非 LIVE 過帳的資料庫 gate；`0014_master_data_import_export.sql` 新增機構、部門、制服、供應商與供應商 MOQ 的整批驗證／原子 upsert，以及角色限制的 JSON 匯出 RPC。`src/domain/erp-export.ts` 僅提供已驗證的示範格式版本；鼎新正式格式仍需成功匯入樣本。領域測試固定 MOQ／配置上限／驗收與 ERP 彙總規則。正式上線前仍需補齊 PDF renderer／Storage finalize、期初真實資料演練，以及 Supabase project secrets、鼎新欄位映射與角色初始資料。

## 文件索引

`0015_draft_creation_rpc.sql` 將人資需求、補庫與倉庫發貨的草稿建立接到受保護、冪等 RPC；`0016_employee_import_guard.sql` 將員工匯入的大小、欄數與儲存格限制移到資料庫端；`0017_seasonal_scope_guard.sql` 阻擋沒有員工/品號範圍的換季活動開放；`0018_seasonal_snapshot_at_open.sql` 在開放瞬間刷新並凍結員工歸屬快照；`0019_seasonal_demand_rpc.sql` 與 `0020_seasonal_demand_integrity.sql` 讓需求窗口只能透過鎖定活動、使用凍結範圍快照的伺服器 RPC 登記需求，並撤銷 direct DML；`0021_seasonal_hr_correction.sql` 提供 HR 待核修正 RPC 與快照範圍讀取；`0022_procurement_reason_codes.sql` 加入可維護採購差異原因碼、SYSTEM_ADMIN 維護 RPC、停用供應商防線與採購決策 RPC 的 active supplier 驗證；`0023_receipt_draft_validation.sql` 允許採購入庫草稿先保存未完成分類，並將完整分類與拒收理由檢查放在 POST 交易；`0024_receipt_draft_update.sql` 讓入庫草稿可依固定鎖序修改；`0025_stocktake_draft_rpcs.sql` 將盤點草稿建立／更新改由受保護 RPC 在交易內擷取帳面量與 balance version，前端新增盤點工作台並保留 `STALE_COUNT` 版本 fencing；`0026_return_draft_rpc.sql` 將退回草稿建立改由原始發放明細推導身份與快照，前端新增退回草稿／POST 工作台；`0027_stocktake_conflict_forward.sql` 將兩倉合計預留衝突與需求轉 `INVENTORY_REVIEW_REQUIRED` 的盤點 POST 修正套用到已完成初始 migration 的環境；`0028_stocktake_update_forward.sql` 將盤點更新 RPC 的重盤簽章與確認防線套用到舊環境；`0029_return_schema_forward.sql` 將退回明細的 line_no 與唯一約束補到舊環境。盤點調減會以兩倉合計檢查有效預留，必要時同交易標記需求需重新檢查；前端也提供 CEO 待核版本的 revision/hash 核准或退回入口、採購決策／採購單、採購入庫、庫存盤點、員工制服退回與 A4 PDF artifact 請求／狀態入口；入庫草稿可先暫存，POST 後才把合格量寫入總倉。人資工作台在 Supabase 環境會載入正式主檔並可建立草稿後送出預留，員工 CSV 匯入工作台也可確認後原子套用員工主檔；換季工作台可建立活動並凍結員工/品號範圍、需求窗口可在授權範圍登記數量，再呼叫受保護 RPC 開放需求窗口。

`0030_pdf_erp_provenance_forward.sql` 是已部署環境的 forward migration：PDF request 會鎖定來源並由資料庫推導 snapshot hash/version，區分 `FORMAL`／`DRAFT_WATERMARK`；ERP 在 `GENERATION_FAILED`／`IMPORT_FAILED` 重試時會受控回到 `PREPARING`，且 fingerprint 必須帶 frozen source snapshot。`0031_audit_archive_controls.sql` 新增 append-only audit／archive／lifecycle 資料表與主要業務寫入稽核 trigger，並建立預設 `NOLOGIN` 的 `job_storage_cleanup` role；`0032_durable_import_foundation.sql` 新增預設 `NOLOGIN` 的 `job_import_worker` role、固定 private Storage key 的匯入批次、chunk、逐列差異資料與 `AWAITING_UPLOAD → UPLOADED` 確認邊界；`0033_worker_role_archive_import_forward.sql` 會修正已部署 role 的 NOLOGIN 狀態並把 durable `import_batches` 接到封存／稽核；`0034_worker_audit_identity.sql` 會以受保護 `job_actor_bindings` 綁定 worker audit actor，並讓 archive/lifecycle RPC 伺服器推導 actor/fingerprint；`0035_durable_import_worker_rpcs.sql` 新增 batch→chunk 固定鎖序、lease/generation/cursor CAS、重試退避、解析／驗證 chunk 完成、取消與受角色限制的 EMPLOYEES／主檔／期初 APPLY；`0036_account_role_scope_admin.sql` 提供 SYSTEM_ADMIN 專用的業務帳號建立、停用／啟用、六角色指派、需求窗口機構／部門範圍設定、Auth 綁定重設或解除，並以冪等 command、最後一位 SYSTEM_ADMIN 防線及 append-only 綁定／稽核事件保護管理操作；`0037_durable_import_storage.sql` 建立 private `uniform-imports` bucket 與固定 key 直傳 policy，新增檔名／MIME 配對約束；`0038_durable_import_recovery.sql` 提供瀏覽器重開後依原匯入冪等鍵查回上傳批次，並阻擋同一匯入冪等鍵跨類型重用；`0039_renderer_artifacts.sql` 建立 PDF／ERP artifact 的 lease-fenced claim、heartbeat、retry、finalize、歷史 revision 下載與 renderer payload DTO；`0040_renderer_storage_key_fence.sql` 再把 renderer 角色的 Storage 讀寫限制在未逾期 lease 所保留的 attempt key，並補 ERP snapshot／attempt 的刪除不可變保護；`0044_import_worker_forward.sql` 將 APPLY claim 的耐久確認、preview action、錯誤列與 max-attempt 檢查放在 worker 交易邊界；`0045_import_worker_snapshot_and_storage.sql` 提供 worker work polling、依匯入類型的主檔比對 snapshot，以及固定 `uniform-imports` object 的受控 proxy read capability。`src/domain/import-worker-parser.ts` 與 `src/domain/import-worker.ts` 提供 bounded parser、識別碼型別防線、EMPLOYEES／主檔的 INSERT／UPDATE／SKIP／ERROR preview 與 durable chunk range；`npm run import:worker -- --once` 可在受保護同名 worker role、Storage proxy 與 staging Supabase 上執行一輪 parse／validate／apply。實際 credentials、並行 SQL/RLS 與 Storage smoke 仍須在受保護 worker 環境驗收，不能由瀏覽器繞過。

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
- [部署與同步 Runbook](./docs/deployment/runbook.md)

Durable import worker 的 forward migration 順序為 `0045` → `0046` → `0047` → `0048` → `0056`：先建立 immutable reference snapshot，再拆分 bounded parse chunks，分離 worker／uploader actor，提供 definitive parser failure 狀態轉換，最後讓受控 `job_import_worker` 確認由使用者上傳的 object（保留原 uploader attribution）並進入解析。部署時不可只套用 `0045`；完整 SQL/RLS/Storage smoke 仍須在受保護 staging worker 環境執行。

## 尚待提供

1. 鼎新 ERP 成功匯入樣本及欄位規格。
2. 主檔與期初庫存樣本。
3. 公司抬頭、Logo、正式列印樣式與簽名角色／欄位名稱。
4. 第一批帳號、角色及需求窗口權限清單。
5. 異地備份目的地、兩位金鑰保管人、維運信箱，以及暫定 RPO／RTO 的業務接受人。
6. 三年員工、交易、匯入、PDF／ERP 檔案量預估與公司正式保存年限。
7. 連接 Vercel Hobby 的個人 GitHub repository owner 與帳號移交／備援負責人。

可立即依[實作路線圖](./docs/implementation/roadmap.md)開始第 0 階段蒐集與技術驗證。鼎新樣本阻擋第 4 階段驗收；主檔與期初樣本阻擋第 5 階段切換；列印樣式、帳號清單、備份還原與三年容量 gate 則分別阻擋文件、使用者及正式上線驗收。

Durable import worker 的 forward migrations 為 `0045`–`0048`、`0056`：reference snapshot、bounded chunks、worker/uploader actor separation、malformed-upload failure，以及受控 worker 對上傳物件的確認都已納入；實際 Supabase/RLS/Storage smoke 仍需受保護 staging worker 執行。

`0049_receipt_correction_reconciliation.sql` 是採購入庫更正的 forward fix：更正 POST 會以本次 delta 過帳、在鎖內重算有效數量與採購配置，必要時將不足預留轉為衝突並記錄 PO 重開原因；更正狀態查詢 RPC 支援瀏覽器回應遺失後恢復。實際 Supabase 交易／鎖序仍需 staging smoke 驗證。

`0050_return_correction.sql` 補齊退回更正：以原退回明細與原發放明細為不可變來源，於共同品號／來源鎖內重算有效退回量，調整人資倉、處理預留衝突並提供 draft／POST／狀態查回 RPC；退回更正工作台保留歷史與 response-loss recovery。實際 SQL／RLS／並行交易仍需 staging smoke 驗證。

`0051_hr_issue_correction.sql` 補齊 HR_ISSUE 更正：以已 SHIPPED 的原發放明細為唯一來源，保存不可變員工／品號快照，正負差額只透過 HR 倉庫受保護 RPC 過帳；POST 會在共同品號、需求、原明細與兩倉餘額鎖內重算有效發放／退回上限、拒絕突破有效預留與負庫存，並提供狀態查回與 HR 工作台。實際 SQL／RLS／並行交易仍需 staging smoke 驗證。

`0052_correction_source_advisory.sql` 將 HR_ISSUE、RETURN 與 RETURN correction 對同一人資需求的來源更正共用 advisory fence，避免不同品號更正各自持有 item mutex 後互等需求列；staging 必須以同一需求的不同品號並行 POST 驗證可重試且不死結。

`0053_return_reason_codes.sql` 建立可維護的退回原因碼、退回業務日期，撤銷無原因碼的舊建立 RPC，並由 `ReturnPanel` 使用 active reason code 與 Asia/Taipei 業務日期建立新草稿；`LEGACY` 僅供歷史資料相容且停用。

`0054_warehouse_transfer_correction.sql` 補齊 WAREHOUSE_TRANSFER 更正：已 POST 發貨／補庫明細可建立 signed transfer delta，POST 在品號、來源文件／明細與兩倉餘額鎖內重算有效調撥上限，原子新增 GENERAL 出庫與 HR 入庫流水，並提供狀態查回與 WAREHOUSE 工作台。

`0055_stocktake_correction.sql` 補齊 STOCKTAKE 更正：以已 POST 盤點明細為不可變基線，保存 signed counted delta，於盤點倉／兩倉餘額與 active reservations 鎖內重算有效實盤；若更正使預留失去覆蓋，仍完成盤點更正流水並同交易標記相關需求 `INVENTORY_REVIEW_REQUIRED`。

`0057_correction_source_immutability_forward.sql` 將更正來源不可變 trigger forward-fix 到已套用 0055 的環境，納入盤點更正的 `original_stocktake_id`，避免已部署資料庫只套用舊 trigger 而漏掉盤點來源欄位。
