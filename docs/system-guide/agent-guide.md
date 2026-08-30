# AI Agent 架構與交接說明

<!-- SYSTEM-GUIDE:GENERATED:START -->

## 1. 接手順序與目前狀態

1. 先讀根目錄 `AGENTS.md`，再讀 `README.md` 與 `CONTEXT.md`。
2. 執行 `git status --short`、`git diff`、`git log -8 --oneline`；保留使用者未提交內容，不可 reset／clean。
3. 正式功能以 `src/`、`src/domain/`、`src/server/` 與 `supabase/migrations/` 為準；`prototype/uniform-management-prototype.html` 是獨立 mock。
4. 依需求讀 `docs/spec/`、`docs/architecture/`、`docs/implementation/roadmap.md` 與 `docs/deployment/`。
5. 先找 workspace、panel、domain function、server API、RPC／RLS seam，再做最小 patch。

分析基準為 2026-08-30 的 `main`。最近功能提交依序包含員工主檔、營運報表中文化、組織主檔、visited mount、工作區模組化、商品管理重構與庫存模組。正式狀態仍是 `NOT_READY`，不可由本機測試或 UI smoke 自動改成 READY。

## 2. 技術架構

```text
Browser / Next.js Client Panels
        │ Supabase session / anon key
        ├──────────────► Supabase Auth + RLS SELECT + protected RPC
        │
        └── Bearer token ─► Next.js server API
                              ├─ caller-scoped Supabase client
                              └─ server-only Auth Admin client（限帳號操作）

Durable import / PDF / ERP / Storage cleanup / retention
        └──────────────► dedicated DB LOGIN + job actor binding + thin RPC
```

- Framework：Next.js 15 App Router、React 19、TypeScript。
- UI 入口：`src/app/page.tsx` → `WorkspaceShell`。
- 登入：`useAuthSession()` 與 `AuthPanel`，Supabase browser client 位於 `src/lib/supabase-browser.ts`。
- 權限：Supabase Auth identity 綁定 `app_accounts.auth_user_id`，角色位於 `user_roles`，`private.current_account_id()` 與 `private.has_role()` 是 DB 權威。
- 高權限帳號管理：`POST /api/admin/accounts` → `createCallerClient()` → `authorizeSystemAdmin()` → `executeAccountAdminOperation()`；service role 只在 server bundle。
- 資料真相：PostgreSQL 業務表、append-only posting／ledger 與 security-invoker reporting views。
- 部署：GitHub `main` → Vercel；migration 由手動核准 workflow 或受控 SQL Editor 套用。

## 3. UI 模組與導覽

`workspaceDefinitions` 集中工作區、模組與搜尋索引；`WorkspaceShell` 管理 hash navigation、登入 gate、responsive shell 與 workspace mounting。`RetainedPanelSet` 預設使用 `visited` mount：未造訪 panel 不查詢，造訪後切換仍保留表單狀態。`ModuleWorkbench` 是同一模組內的任務頁籤 seam。

七個正式工作區：

| Workspace | 組裝檔 | 核心功能 |
| --- | --- | --- |
| 總覽 | `OverviewWorkspace.tsx` | 營運摘要、組織、商品、耐久匯入 |
| 帳號管理 | `AccountWorkspace.tsx` | SYSTEM_ADMIN 帳號／角色／scope |
| 人資需求 | `HrWorkspace.tsx` | 日常需求、補庫、退回、更正、員工主檔 |
| 倉庫作業 | `WarehouseWorkspace.tsx` | 庫存、發貨、盤點、倉庫更正 |
| 採購與入庫 | `ProcurementWorkspace.tsx` | 採購決策、原因碼、採購單、入庫與更正 |
| 換季活動 | `SeasonalWorkspace.tsx` | 活動設定、需求窗口、CEO 核准 |
| 報表 | `ReportsWorkspace.tsx` | 即時 views、PDF、ERP artifact |

主要深模組：

- 商品：`ProductManagementPanel`／`ProductCatalogPanel`／`ProductMasterEditorPanel`／`product-management.ts`。
- 組織：`OrganizationManagementPanel`／catalog／editor／`organization-management.ts`。
- 員工：`EmployeeManagementPanel`／catalog／editor／`employee-management.ts`，單筆保存由 migration `0079` 的 HR-only RPC 處理。
- 庫存：`InventoryManagementPanel` 組合 availability、opening import、operation hub、history export 與 calculator；不得直接 DML balance。
- 報表：`ReportingPanel` 只讀 `0063` 起的 security-invoker views，中文欄位 metadata 在 `reporting-catalog.ts`。

## 4. 核心領域不變條件

### 倉庫與庫存

- 只有一個啟用 HR 倉與一個啟用 GENERAL 倉；畫面名稱固定「人資倉」、「總倉」。
- 機構／部門是歸屬與報表維度，不是倉庫。
- 品號是庫存最小單位與 ERP 穩定識別；不同尺寸使用不同品號。
- 庫存不得為負。餘額只能由 opening、發貨、入庫、盤點、退回或更正 posting 推導。
- 人資送單建立跨兩倉合計預留；預留不分攤承諾來源倉。補庫不預留。
- 高風險交易使用 operation command、canonical fingerprint、固定鎖序與 response-loss recovery。

### 主檔與歷史

- 穩定代碼／工號建立後不可被改造成另一業務實體。
- 已引用主檔使用停用，不 hard delete；員工刪除語意是 `INACTIVE`。
- 已 POST 原單不可修改；更正以關聯來源的新 append-only 單據處理。
- 員工調動只更新目前歸屬，歷史單據保存 snapshot。

### 狀態與並行

- 倉庫發貨是實物交付與帳務的正式鎖點；POST 前不得交付。
- Stocktake 使用 balance version fencing；過期實盤進 `STALE_COUNT`。
- 盤點／更正造成預留不足時，同交易把 reservation 標記 `CONFLICTED`、需求轉 `INVENTORY_REVIEW_REQUIRED`。
- 換季 submission revision/hash 不可覆寫；CEO review 必須鎖後重驗目前版本。
- 採購上限、採購單、入庫與更正共用鎖集合，避免並行超收。

## 5. Supabase 結構

Migration 從 `0001` 到 `0079` 依序累積；不要編輯已套用 migration，修正使用新的 forward migration。重要範圍：

- `0001–0014`：核心主檔、兩倉、需求、發貨、補庫、盤點、退回、換季、採購、ERP/PDF baseline、opening、主檔匯入。
- `0015–0030`：受保護草稿 RPC、匯入 guard、scope、並行與來源版本、correction／provenance forward fixes。
- `0031–0048`：append-only audit、durable import、private Storage、worker、renderer、generation/download fencing。
- `0049–0062`：採購入庫、退回、發放、調庫、盤點更正與 PDF coverage／metadata guard。
- `0063–0066`：九張 reporting views 與來源 ACL。
- `0067–0070`：帳號 profile、Auth audit、login name 與 bulk roles。
- `0071–0075`：Storage cleanup、terminal retention、staging payload scrub、pgcrypto bridge。
- `0076–0079`：庫存匯出稽核、停用商品／組織可讀、員工主檔管理。

RLS 與 RPC 必須一起檢查。新增可見欄位時同步檢查 schema、表單、清單、詳情、篩選、RPC、RLS、匯入／匯出與測試。

## 6. Durable import 與 artifact

### Durable import

`DurableImportPanel` 只負責建批次、取得固定 private key、直傳檔案、查詢狀態、確認或取消。真正解析與 APPLY 在 `scripts/import/import-worker.ts`，透過 `src/domain/import-worker.ts` 與 worker RPC。瀏覽器不可持有 worker／service-role。

Storage cleanup eligibility 只能由 `0071`／`0072` RPC 決定；DB staging payload retention 只走 `0074` 的 `job_import_retention` RPC。兩個 job role 不得合併或互相擴權。

### PDF／ERP

Renderer runner 位於 `scripts/renderer/renderer-worker.mjs`，Storage proxy 位於 `scripts/renderer/storage-proxy.mjs`。Artifact revision、attempt、lease、generation、object key、bytes/hash 與 download grant 都要 fail closed。正式 ERP mapping 仍未知，不要把 smoke adapter 升格成正式格式。

## 7. System Guide 自身

- Markdown source：`docs/system-guide/user-guide.md`、`admin-guide.md`、`agent-guide.md`。
- Runtime loader/parser：`src/server/system-guide.ts`，只允許固定 allowlist 檔名與有限 block types。
- Protected API：`HEAD/GET /api/system-guide`，先用 caller bearer token 執行 `authorizeSystemAdmin()`。
- Frontend：`/system-guide`；React 以文字節點渲染，不用 `dangerouslySetInnerHTML`。
- 首頁入口：`WorkspaceShell` 只有在 HEAD probe 成功後顯示；隱藏入口不是授權邊界，GET API 才是最後防線。
- CSS：所有新增規則以 `.system-guide-*` scope 限定。

## 8. 開發、測試與驗證

```text
npm install
npm run dev
npm run lint
npm test
npm run typecheck
npm run build
git diff --check
```

Prototype 另跑：

```text
node -e "const fs=require('fs'),vm=require('vm'); const h=fs.readFileSync('prototype/uniform-management-prototype.html','utf8'),lt=String.fromCharCode(60); new vm.Script(h.split(lt+'script>')[1].split(lt+'/script>')[0]); console.log('prototype syntax: ok')"
```

測試慣例：

- 純規則放 `src/domain/*.test.ts`。
- Migration／workflow safety 以 contract test 檢查權限、函式、gate 與禁止事項。
- Workspace index 與 module mount policy 有獨立測試。
- System Guide 必須測 parser 對 unsafe HTML／JavaScript 的拒絕、固定文件 allowlist、API server-side authorization seam 與 admin-only navigation。

## 9. 部署與 Git 規則

- 使用者已要求修改完成後自動推送 GitHub；提交前仍要 fetch／比較 `origin/main`，排除未授權檔案。
- 不得 reset／clean 使用者工作樹，不得提交 `prototype/` 或 ignored private evidence。
- 推送 `main` 觸發 Vercel；之後以正式登入 session 做 read-only UI smoke。
- Migration 不因 Vercel deploy 自動套用；需另走受保護 workflow／SQL Editor。
- CI 固定執行 test、lint、typecheck、build。

## 10. 最近變更與接續方向

最近已完成：

- 員工主檔獨立模組、完整單筆表單、停用、匯入與稽核匯出。
- 營運報表中文欄位、搜尋、排序、分頁與即時刷新。
- 組織主檔與商品管理的清單／表單／匯入匯出深模組。
- Workspace／ModuleWorkbench visited mount，避免登入後 eager 查詢。
- 庫存管理整合兩倉可用量、期初、操作入口與歷史匯出。

下一步不得自行製造 production PASS。合理的 repository 工作是新的明確功能、測試或文件需求；production gate 需要使用者提供 staging／production credentials、正式樣本、核准與 evidence。

## 11. 風險與未知資訊

- 正式 `schema_migrations`、六角色 RLS、Auth、private Storage、signed URL 與並行 smoke 的最新 evidence 不在 Git；必須外部查核。
- Durable import worker、renderer、Storage destructive cleanup 與 90-day staging retention 尚需受保護 staging integration／destructive smoke。
- 正式 PDF 樣式、鼎新 mapping、第一批帳號／scope、owner／backup owner、外部 monitoring、RPO／RTO、三年容量及 cutover approval 尚未完成。
- `release-evidence.example.json` 永遠是 `NOT_READY` template，不可修改成全 PASS。
- Error monitoring 不得重新加入 raw message、stack、body、headers、cookie、token、query 或 DB URL。

## 12. 重要證據符號

| 判斷 | 程式／文件證據 |
| --- | --- |
| 登入 gate 與 hash workspace | `WorkspaceShell`、`useAuthSession` |
| SYSTEM_ADMIN server authorization | `authorizeSystemAdmin`、`createCallerClient` |
| 角色與 scope DB 權威 | `private.current_account_id`、`private.has_role`、migration `0036` |
| 庫存真相與預留 | migration `0001`、`0002`、`docs/spec/workflows-and-permissions.md` |
| 固定 mount seam | `ModuleWorkbench`、`RetainedPanelSet`、`shouldMountRetainedPanel` |
| Durable import background work | `scripts/import/import-worker.ts`、migration `0035`／`0044–0048` |
| Reporting views | migration `0063–0066`、`ReportingPanel`、`reporting-catalog.ts` |
| Release status | `release-gate.mjs`、`release-evidence.mjs`、`README.md` |

<!-- SYSTEM-GUIDE:GENERATED:END -->

<!-- SYSTEM-GUIDE:MANUAL:START -->

## 人工交接補充

可在此記錄非敏感的當班維運事項、待 review 分支或外部 ticket ID。不要放 secret、正式資料、未遮罩 log 或可直接登入的連線資訊。

<!-- SYSTEM-GUIDE:MANUAL:END -->
