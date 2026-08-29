# AI Agent 接手指南

## 正式應用目前狀態（2026-08-29）

正式 Next.js 應用已部署至 [uniform-co.vercel.app](https://uniform-co.vercel.app/)，GitHub `Kevin72333/uniform-co` 的 `main` 分支是目前交付來源，Supabase 負責登入、PostgreSQL、RLS 與 Storage。正式應用的功能資料來源是 `src/`、`src/domain/`、`src/server/` 與 `supabase/migrations/`；[`prototype/uniform-management-prototype.html`](./prototype/uniform-management-prototype.html) 仍是獨立的內容／流程原型，不是正式資料來源。

## 最新 AI 接手快照（2026-08-29）

### 接手第一步

這個工作樹目前刻意保留大量未提交修改，包含多輪已完成的功能、安全防線、migration、workflow、測試與文件。接手後先讀本文件，再讀 `README.md`，接著用 `git status --short` 與 `git diff` 確認現況；不要執行 reset／clean、不要用整檔重寫覆蓋既有修改，也不要自行 commit／push。若只做新需求，應在現有修改上做最小 patch。

Repository-local 工作目前已收尾，最新完整驗證為：49 個 test files、211/211 tests 通過，`npm run lint`、`npm run typecheck`、`npm run build` 全部成功；`git diff --check` 沒有 patch whitespace error，只有 Windows 工作樹既有的 LF→CRLF warning。下一位 agent 不應把「找不到新的本機 TODO」解讀為正式上線已完成。

### 這一輪已落地的重要能力

1. **Durable import worker**：`scripts/import/import-worker.ts` 預設是持續 worker；`npm run import:worker -- --once` 只跑單輪，移除 `--once` 會依 `IMPORT_POLL_MS` 持續呼叫 `list_import_work` 並處理 PARSE／VALIDATE／APPLY。文件已同步修正，不要再恢復「UI 主動呼叫下一 chunk／關頁就停止解析」的舊架構描述。真實 staging 常駐部署仍是外部 gate。
2. **Storage cleanup 與 retention**：`0071`／`0072` 是 Storage bytes eligibility 的 DB 權威；`0073`／`0074` 把 import staging 可清 payload 與永久 evidence 分離。`job_storage_cleanup` 與 `job_import_retention` 是不同最小權限角色，不得合併或互相擴權。兩個 GitHub workflow 的排程都刻意只 dry-run；destructive execute 必須保留雙 gate 與真實 staging smoke。
3. **Backup／restore fail-closed**：generation 有 manifest lock／source stability／完整集合與 SHA-256 驗證；DB metadata 記錄八個關鍵 application table counts，Auth metadata 記錄 users／identities／MFA factors。Restore 先驗空目標、再解密與還原；Storage 固定五個 private bucket allowlist、拒絕 duplicate target／unsafe path／409 conflict，每個 POST 後還要 GET read-back 並重新比 byte length／SHA-256。舊 generation 缺 `application_counts` 時只做 backward-compatible Auth count 驗證。
4. **Deployment safety harness**：`deployment:preflight`、`deployment:smoke`、`deployment:active-smoke`、`deployment:renderer-smoke` 都已提供 fail-closed gate；真實 staging credentials、migration、RLS/Auth/Storage/signed URL/concurrency 才能產生正式 evidence。本機 contract tests 不能替代這些結果。
5. **Error monitoring**：`instrumentation.ts` → `src/server/error-monitoring.ts` 只輸出 allowlisted 結構化欄位與不可逆 fingerprint；`src/app/error.tsx` 只顯示通用錯誤。禁止把 raw message／stack／body／headers／Authorization／cookie／token／query／DB URL 加回 log。外部 provider／alert／incident smoke 尚未取得。
6. **Capacity gate**：`capacity:plan` 只把假設與實測分開計算，沒有 `STAGING_SYNTHETIC` 三年實測、尖峰負載、完整還原與 quota usage 時必須維持 `NOT_VALIDATED`。不要把 example assumptions 或模型估算升格成 production evidence。
7. **Production release evidence**：`deployment:release-gate` 集中 17 個 production cutover gate；`deployment:release-evidence` 對 ignored 的正式 evidence 檔做 init／record／block，使用 lock、重讀與原子替換避免 lost update。版本化 `release-evidence.example.json` 永遠保持 `NOT_READY`，不得修改成「全 PASS」示範正式完成。

### 下一位 agent 的工作界線

目前沒有已知還能單靠 repository code 合理宣告完成的 production gate。除非使用者提供 staging／production credentials、真實樣本、核准資料或明確要求部署／驗收，下一步應針對新的功能需求修改，而不是自行製造 PASS evidence。

正式狀態必須維持 **`NOT_READY`**，直到至少取得：第一批 production accounts／roles／demand scopes、GitHub／Vercel owner 與 backup owner、鼎新正式 mapping＋成功 import sample、正式 PDF layout/style approval、真實 Supabase migration／六角色 RLS／Auth／private Storage／signed URL／concurrency smoke、durable import worker staging integration、renderer/PDF/ERP staging smoke、Storage destructive cleanup smoke、DB 90-day staging retention destructive smoke、外部 monitoring/alerts/incident smoke、production-sized DB＋Auth＋Storage restore、量測 RPO/RTO、三年 synthetic/staging capacity evidence 與 production cutover approval。

需要繼續部署／驗收時，以 [`docs/deployment/runbook.md`](./docs/deployment/runbook.md)、[`docs/deployment/staging-preflight.md`](./docs/deployment/staging-preflight.md) 與 [`docs/implementation/roadmap.md`](./docs/implementation/roadmap.md) 為準；真實 secrets／evidence 放在受保護且 Git ignored 的位置，不要提交到 repository。

### 正式 UI 與功能 seam

- `src/app/WorkspaceShell.tsx`：登入 gate、session refresh、七個 workspace、hash 導航、共用 topbar 與 responsive shell。
- `src/app/workspaces/workspace-config.ts`：workspace 定義、功能頁籤與搜尋索引；目前 workspace 為總覽、帳號管理、人資需求、倉庫作業、採購與入庫、換季活動、報表。
- `src/app/workspaces/*Workspace.tsx`：每個 workspace 的模組組裝；頁籤使用 `activeModule` 切換內容，維持在同一工作區，不用按鈕觸發頁面下移。
- `src/app/WorkspaceTopbar.tsx`：搜尋、通知、日期／資料狀態、帳號操作與風格下拉選單。
- `src/app/AccountAdminPanel.tsx`、`src/app/api/admin/accounts/route.ts`、`src/server/account-admin.ts`：帳號管理模組。2–50 個小寫英數字的登入帳號與至少 6 字元密碼必填，聯絡 Email 選填且不作登入；建立或編輯時可一次管理六角色，並支援需求窗口機構／部門範圍、啟用／停用、Auth 綁定重設／解除與保留業務歷史的刪除。所有操作透過 server-side API、idempotency key、SYSTEM_ADMIN 防線與稽核理由處理。
- `src/app/use-appearance-theme.ts` 與 `src/app/globals.css`：外觀 adapter seam。下拉選項為 `AP`、`MX`、`GS`、`MB`、`SH`；`GS` 的顯示名稱是 GS，但程式 id／`data-appearance` 仍是 `ga`，不要只為改名而破壞既有 localStorage 或 motion 判斷。`SH` 是 shadcn/ui-inspired neutral token 版本，未加入 shadcn runtime dependency。

### 正式應用接手規則

1. 登入、Auth Admin、角色、範圍與帳號異動不可從瀏覽器繞過 server-side API／受保護 RPC；不要把 Supabase service role 放入 client bundle。
2. 視覺需求先沿用 theme adapter seam；共用 base CSS 只放所有風格都需要的規則，單一風格放在 `html[data-appearance="..."]` scope 內。
3. 功能需求先找對應 workspace、panel、domain function 與 migration，再做最小 patch；不要用 prototype 的記憶體 mock 代替正式資料流。
4. 新增可見欄位時同步檢查資料模型、表單、列表、詳情、篩選、RPC、RLS 與測試；新增需求狀態時同步檢查 `advanceRecord()`、`rejectRecord()`、`syncRequestTask()`。
5. 本機與 CI 驗證使用 Node/npm 指令；本文件的範例以 `cmd.exe`／一般 shell 可執行，不依賴 PowerShell。
6. Storage cleanup 的 eligibility 只能由 `0071_storage_cleanup_contract.sql`／`0072_import_terminal_retention.sql` 的 DB RPC 決定；runner 只能做第二層 bucket/key sanity check。不要在 script／workflow 自行推論可刪狀態、放寬 24 小時下限或 FAILED／CANCELLED import 的 90 天 terminal retention、重設 renderer/import lease，或刪除 artifact／import／audit evidence row。
7. DB staging payload retention 只走 `0074_import_staging_payload_retention.sql` 的 `job_import_retention` 薄 RPC。它只 scrub FAILED／CANCELLED 滿 90 天 batch 的 `raw_values`／`normalized_values`／`validation_errors`，保留 batch/row/chunk/diff evidence 與 `staging_purged_at`；purge 後不可 restart。不要把 `job_storage_cleanup` 擴權為 DB staging purge worker。

### 已知交接界線

- 第一批正式帳號、角色指派、需求窗口範圍、GitHub/Vercel owner 與備援聯絡人仍待由使用者提供；管理模組本身已完成。
- 鼎新正式格式、正式 PDF 列印樣式與期初真實資料仍待外部資料；Renderer runner、Storage proxy/finalize 與 disposable-staging active smoke harness 已完成，但真實 Storage／RLS／signed URL／並行鎖 staging smoke 仍屬正式驗收事項。
- Storage cleanup 的 DB contract、dry-run/execute runner、contract tests 與每日 dry-run workflow 已落地；`0072_import_terminal_retention.sql` 已提供 FAILED／CANCELLED source object 的 90-day DB eligibility，且不刪除 import DB evidence。`0074_import_staging_payload_retention.sql` 的 `job_import_retention` 90-day DB staging payload scrub contract，以及獨立 dry-run/execute runner、preflight 與每日 dry-run workflow 也已落地；runner 只呼叫 0074 薄 RPC，保留 row shell/chunk/diff 並留下 `staging_purged_at`。Storage／DB staging 兩種 destructive 模式仍必須在受保護 staging 以各自 job role 與雙 gate 實際驗收，尚未啟用 destructive cron。
- 版面基線 commit 為 `3059723`；後續只調整視覺時保留 AP／MX／GS／MB／SH 五套選項與 `uniform:appearance-theme` localStorage key。

## 先讀什麼

1. 先讀 [`README.md`](./README.md) 的「正式應用接手狀態」、「Prototype 交接狀態」與「尚待提供」。
2. 再讀 [`CONTEXT.md`](./CONTEXT.md)，掌握業務詞彙與角色名稱。
3. 要修改正式功能時，依工作範圍讀 `docs/spec/`、`docs/architecture/`、`docs/implementation/roadmap.md`，不要把 prototype 的記憶體資料當成正式資料來源。

## 目前工作邊界

- 正式 Next.js 應用可由 [uniform-co.vercel.app](https://uniform-co.vercel.app/) 瀏覽，但需要 Supabase env 與有效登入 session；正式資料與權限以 `src/`、`src/domain/`、`src/server/`、`supabase/migrations/` 為準。
- 可直接雙擊開啟的內容原型是 [`prototype/uniform-management-prototype.html`](./prototype/uniform-management-prototype.html)，為單一 HTML 檔，沒有 bundler、API 或資料庫依賴。
- prototype 的目的，是讓使用者確認版面、欄位、流程與命名；正式邏輯必須回到 `src/` 與 `supabase/migrations/` 實作。
- prototype 內容可以用 `apply_patch` 直接修改；保持單檔可雙擊開啟，避免引入需要安裝才能執行的依賴。
- 若需求只提到 prototype，修改範圍先限於 `prototype/uniform-management-prototype.html`、README.md 與本接手文件；不要擅自改 production migration 或資料庫契約。

## Prototype 不可破壞的資料契約

### 倉庫

只能使用兩個值：

- `人資倉`
- `總倉`

更新庫存、地圖、發放批次或入庫表單時，禁止重新引入台北／北區／中區／南區分倉等示例名稱。

### 機構

機構清單是現有資料，不要自行新增示例機構或重新排序。完整清單以 README 與 HTML 中的 `institutions` 常數為準：

`8C清福`、`7C清氣`、`6C清心`、`5C清平`、`3C清安`、`8D清春`、`7D清日`、`6D清照`、`5D清風`、`3D清景`、`8E青山`、`7E清泉`、`6E清水`、`5E清清`、`3E清涼`、`2CD清護`、`清福法人`、`一館`、`三館`、`二館`、`清田法人`、`清福幼兒園`、`含笑`、`其他`

### 人資需求

目前需求資料只使用：

- `no`
- `employee`
- `employeeNo`
- `institution`
- `items`
- `status`
- `tone`
- `updated`
- `note`

目前不使用 `department` 或人員 `owner`。需求清單、建立表單、詳情視窗都只顯示機構；後續若恢復部門，必須一次同步資料、表單、表格、詳情、篩選與測試。

需求狀態流程：

```text
送出申請 → 待主管核准 → 待 HR 備貨 → 預留完成 → 已完成
                         ↘ 退回補件 → 補齊資料後重新送出
```

`advanceRecord()` 會推進人資需求，`rejectRecord()` 會退回待補件；`syncRequestTask()` 會同步同一需求在總覽工作佇列的狀態。新增欄位或狀態時，這三個位置要一起檢查。

## 修改方法

1. 先搜尋既有常數與 render function，再做最小 patch；不要用整檔重寫覆蓋別人的修改。
2. 任何可見欄位變更都要同步資料模型、表格、詳情、表單與新增流程。
3. 對使用者提供的機構／倉庫名稱照字面保留，避免自動改成同義詞或示例名稱。
4. Prototype 不做持久化；若要測試狀態，使用同一個分頁完成流程，不要新增 localStorage 或後端依賴。
5. 文件要說明「目前已完成」與「仍需正式環境驗收」的界線，避免後續 agent 把 prototype smoke 當成 SQL/RLS/Storage 驗收。

## 交接驗證清單

修改後至少執行：

```cmd
node -e "const fs=require('fs'),vm=require('vm'); const h=fs.readFileSync('prototype/uniform-management-prototype.html','utf8'); new vm.Script(h.split('<script>')[1].split('</script>')[0]); console.log('prototype syntax: ok')"
npm run lint
npm test
npm run typecheck
npm run build
git diff --check
```

另外用瀏覽器或等價的 DOM smoke 確認：

- `?variant=A|B|C` 都能開啟。
- 六個 workspace 都能渲染。
- 人資需求詳情沒有負責人／部門欄位。
- 新建需求會保存員工編號與機構，並建立工作佇列項目。
- 需求詳情三段推進與退回補件都能更新清單與工作佇列。
- 倉庫只有 `人資倉`、`總倉`，機構清單為 24 個現有機構。

正式 Next.js App 另外確認：未登入時只呈現登入視窗；登入後七個 workspace 都能透過左側導航與網址 hash 切換；topbar 搜尋／通知可開啟；每個 workspace 的頁籤是內容切換；風格下拉選單包含 `AP`、`MX`、`GS`、`MB`、`SH`，切換後應寫入 `uniform:appearance-theme` 並在重新整理後保留；帳號管理需由 SYSTEM_ADMIN session 驗證後才可讀寫，且所有操作保留理由與 idempotency key。

## 已知限制

- prototype 內資料是 mock snapshot，重新整理會重設。
- prototype 的「建立、核准、退回、匯出」只模擬 UI 狀態，不會呼叫 Supabase RPC。
- 正式 renderer、Storage、RLS、並行鎖序、匯入 worker 與鼎新格式仍以 migration、domain code、runbook 與 staging smoke 為準。
- 鼎新正式格式與正式列印樣式仍等待外部樣本，不能用 prototype 的示範 CSV 宣稱完成。

最後更新：2026-08-29。若下一次需求改變倉庫、機構、需求欄位或流程，先更新本文件與 README 的契約，再修改 prototype 或正式功能，最後重新跑驗證清單。
