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

`0031_audit_archive_controls.sql` 會把主要業務資料異動寫入 append-only `audit_events`，並建立 archive/lifecycle metadata；封存 finalize 與移除／還原事件只接受預設 `NOLOGIN` 的 `job_storage_cleanup`。`0032_durable_import_foundation.sql` 會建立預設 `NOLOGIN` 的 `job_import_worker` 與固定 `uniform-imports` bucket/key 的 upload batch；`confirm_import_upload` 只有該 job role 可執行，且必須先在 Storage object metadata 寫入並核對 MIME／size／SHA-256。`0033_worker_role_archive_import_forward.sql` 會把已套用舊 migration 的同名 role 強制回到 `NOLOGIN`，並把 durable `import_batches` 接入封存與稽核。`0034_worker_audit_identity.sql` 會要求部署者在受保護的 private schema 綁定 job role 與不可變的 `app_accounts.id`，並由資料庫推導 archive/lifecycle 的 actor 與 canonical fingerprint。部署時須在受保護環境對**同名 role**執行 `ALTER ROLE job_import_worker LOGIN PASSWORD '...'`／`ALTER ROLE job_storage_cleanup LOGIN PASSWORD '...'`（密碼由 secret manager 注入，完成後可再 `NOLOGIN`），再由 DB owner 寫入 `private.job_actor_bindings`；不能另建 login role 後期待 `session_user` gate 通過，也不能把 service role 或 worker role 暴露給瀏覽器，任何 job role 的密碼／連線字串不進 repository 或前端。
`0035_durable_import_worker_rpcs.sql` 套用後，worker 只能以 `claim_import_chunk` 取得 PARSE／VALIDATE chunk lease，再以同一 token、generation、cursor version 完成或失敗；APPLY 前必須由使用者先呼叫 `confirm_import_batch`（批次層級確認會耐久保存，即使沒有差異列也不能省略），worker 再呼叫 `claim_import_apply` 取得 batch lease，最後把 token／generation／cursor 傳入 `apply_import_batch`。套用前確認 migration 順序完整、`private.job_actor_bindings` 已存在，並以受保護 job connection 執行 smoke：同一 chunk 的重複 claim、逾期 lease 接管、錯誤 fingerprint、EMPLOYEES preview 的 SKIP／確認與 PRE_CUTOVER 期初 once-only gate。XLSX/CSV parser 必須在 worker 中完成檔案簽章、ZIP bomb、公式、外部連結、NUL、列／欄／cell 上限驗證後，才可提交 bounded rows；瀏覽器不可直接呼叫 worker RPC。

`0036_account_role_scope_admin.sql` 套用後，先由受保護維運程序在 Supabase Auth 邀請使用者，再以 SYSTEM_ADMIN 面板把已存在的 Auth UUID 綁定成 `app_accounts`；面板可維護六角色、需求窗口的機構／部門範圍、帳號停用，以及帶理由的 Auth 綁定重設或解除。首次 SYSTEM_ADMIN 必須由 DB owner 依公司核准名單 seed `app_accounts` 與 `user_roles`（不使用 service role 給瀏覽器）；之後全部異動使用受保護 RPC，並寫入 operation command、綁定歷史與 audit event。角色與 scope 變更共用鎖，停用最後一位 SYSTEM_ADMIN 會 fail closed。帳號管理面板不會替 Supabase Auth 發邀請，也不會暴露 service-role key。

部署綁定範例（值由 secret manager／受控維運程序注入，不要提交）：

```sql
alter role job_import_worker login password '<secret-managed-password>';
alter role job_storage_cleanup login password '<secret-managed-password>';
insert into private.job_actor_bindings (db_role, account_id)
values
  ('job_import_worker', '<dedicated-worker-app-account-uuid>'),
  ('job_storage_cleanup', '<dedicated-worker-app-account-uuid>')
on conflict (db_role) do update
set account_id = excluded.account_id, is_active = true;
```

兩個 worker 必須使用同名連線 role，且各自的 DB／Storage secret 僅存在受保護 job；若不啟用 worker，保持 `NOLOGIN`，相關 RPC 會 fail closed。啟用時請限制該 role 的 `CONNECT`／網路來源與 Supabase Storage bucket 範圍，並在工作完成後依維運政策撤回 LOGIN。

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
