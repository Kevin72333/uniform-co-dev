# 部署與同步 Runbook

## 已完成的版本控制路徑

- GitHub private repository：`Kevin72333/uniform-co`
- `main` 已設定 `origin`，每次已驗證的切片都會 commit 並 push。
- GitHub Actions CI 會在 push 後執行 `npm ci`、測試、型別檢查與 production build。
- Vercel 應直接連接同一個 private repository；Preview 與 Production 必須使用不同的 Supabase project／環境變數。

## Supabase

1. 建立 staging 與 production project，保留 project ref；不要把 service role key 放進 GitHub、瀏覽器或 Preview。
2. 在受保護的維運環境設定 `SUPABASE_ACCESS_TOKEN`、`SUPABASE_PROJECT_REF`、`SUPABASE_DB_PASSWORD`。
3. 先對 staging 執行 migration，再做 smoke login、六角色 RLS、`system_cutover_state` 與最小測試資料驗收。
4. 驗收通過後才對 production 執行同一組 migration；migration 必須按 `0001` 到最新序號一次套用。
5. 將下列瀏覽器環境變數只設在對應 Vercel project：
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
6. 邀請制帳號與角色 seed 由 Supabase Auth／受保護 SQL 執行；不得把真實員工資料或 key 寫入 repository。

Migration `0015_draft_creation_rpc.sql` 套用後，人資工作台會透過 `create_hr_request_draft` 建立完整快照草稿，再呼叫 `submit_hr_request`；倉庫可用 `create_warehouse_shipment_draft` 建立待 POST 發貨草稿。若 migration 尚未套用，畫面會保留預覽模式並顯示 RPC 錯誤，不會假稱已送出。

`0015_draft_creation_rpc.sql` 也提供 `create_replenishment_draft`；人資可從額外補庫工作台建立不預留庫存的補庫單，再由 `submit_replenishment_request` 送出，倉庫以 `post_replenishment_request` 依總倉現有庫存調庫。`0016_employee_import_guard.sql` 將員工 CSV 匯入改由 `apply_employee_import_checked` 原子套用，資料庫端也會重驗檔案大小、列數、欄數與儲存格長度，重試沿用相同冪等鍵。

換季 migration `0017`–`0021` 依序加入非空活動範圍、OPEN 時員工快照、需求窗口 RPC、RPC-only 寫入、凍結範圍授權，以及 HR_REVIEW 修正與稽核。套用完整 migration 後，需求窗口才能看到活動範圍並登記；HR correction 必須透過 `correct_seasonal_demand_line`，不得直接寫需求明細。

本機目前無 Docker／Postgres，因此 `supabase db lint --local` 只能在具備 Docker 的維運環境執行；本機已通過 app test、lint、typecheck、build，但不把它當成 SQL/RLS 整合驗收。

備份／還原固定入口已納入版本庫：`scripts/backup/export-db.sh` 以 protected `SUPABASE_DB_URL` 匯出 `public`／`private` application dump，`scripts/backup/export-auth.sh` 以 data-only dump 保留 Auth UUID／identities／MFA factors，`scripts/backup/export-storage.mjs` 只處理程式固定 allowlist（`uniform-imports`、`uniform-artifacts`、`uniform-render-temp`）中的 private objects，並由 `scripts/backup/create-manifest.mjs` 建立 SHA-256 manifest。從零還原使用 `scripts/restore/restore-from-zero.sh`，需要明確 `CONFIRM_RESTORE=YES`、`BACKUP_DECRYPT_COMMAND`（雙人程序在受保護 staging 解密 application/Auth dump）、新目標資料庫及 Storage Admin credentials，最後執行 `scripts/restore/verify.sql`。GitHub Actions 的 `.github/workflows/backup.yml` 目前刻意只能手動執行；必須先在受保護 environment 設定 `BACKUP_ENCRYPT_COMMAND`（加密並刪除兩份明文 dump）、`BACKUP_OFFSITE_COMMAND`、加密金鑰與雙人保管資料，才可考慮排程，不宣稱 AC-38／RPO/RTO 已通過。

## Vercel

1. Import `Kevin72333/uniform-co`，Production branch 選 `main`。
2. Preview 使用 staging Supabase URL/key；Production 使用 production URL/key；不要在 Vercel Project Settings 複用錯環境。
3. 開啟 Preview deployment protection，確認 Preview 無法取得 production secret 或寫入 production 資料。
4. 第一次 Production deploy 後驗證：登入、RLS 讀取、HR request 預覽、A4 列印、錯誤頁與 server logs。

## Migration deploy（建議由維運手動核准）

```powershell
$env:SUPABASE_ACCESS_TOKEN = "<protected-token>"
npx supabase@latest link --project-ref <staging-ref>
npx supabase@latest db push
```

Production 執行前要先備份、確認目前 migration version、在 staging 以合成資料重跑，再由第二位維運者核准。不要在 production 使用 `db reset`。

## 期初切換

- 先使用 `create_opening_balance_batch` 做完整預覽；任一錯誤都不會寫入正式餘額。
- 只有 SYSTEM_ADMIN 可呼叫 `publish_opening_balance`；此 RPC 會鎖定 `system_cutover_state` singleton，建立唯一 OPENING posting／ledger，並將狀態轉 `LIVE`。
- `LIVE` 後不可再次發布期初；非期初 inventory posting 在 `PRE_CUTOVER` 由 database trigger 阻擋。

## 鼎新 ERP 依賴

目前只提供 `UNIFORM-ERP-SALES-v0` 示範 renderer 與 immutable logical batch／artifact request。要完成正式匯入，仍需提供鼎新版本、成功原始檔、欄位長度／固定值、編碼與更正／退回單別；收到樣本後再建立版本化 adapter 與 golden-file test。

## 事故與回復底線

- 回應逾時先用同一 idempotency key 查詢 operation command，不直接重做。
- 發現 migration／RLS 不一致先停止正式 cutover，不刪除正式 ledger 或 READY artifact。
- 備份／還原與 offsite credentials 尚未配置前，不宣稱 AC-38 或 production RPO/RTO 已通過。
