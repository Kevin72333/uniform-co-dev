# 帳號管理模組

## 目的

正式網站的帳號管理由 `AccountAdminPanel` 與 `/api/admin/accounts` 組成單一模組入口。管理者不需要進入 Supabase Dashboard 的 Authentication > Users 建立或修改使用者。

模組分成三個責任：

- `app_accounts` 保存不可變的業務帳號、顯示名稱、email 快照、啟用狀態與歷史關聯。
- `user_roles` 與 `coordinator_scopes` 保存角色和需求窗口的資料庫權限。
- Supabase Auth 保存登入 email、密碼雜湊與登入 session；密碼不會寫入 `app_accounts` 或前端狀態。

## 已提供的管理操作

網站模組提供：

- 建立帳號與登入身份：輸入顯示名稱、email、初始密碼；server route 先建立 Auth user，再以 `create_account_profile` 建立業務帳號。
- 修改帳號資料：修改顯示名稱與 email；email 會同步 Auth 與 `email_snapshot`，資料庫失敗時 server 會嘗試回復 Auth email。
- 修改密碼：由 server-side `auth.admin.updateUserById` 更新，不保存密碼明文；稽核只記錄「密碼已變更」事件。
- 啟用／停用：資料庫先更新 `app_accounts.is_active`，Auth 再以 ban 100 年或解除 ban 同步登入限制。
- 刪除登入身份：先停用業務帳號，再刪除 Auth user，最後解除 `auth_user_id` 綁定；業務歷史與 actor FK 保留，不直接刪除 `app_accounts`。
- 六角色與需求窗口範圍：沿用 `0036_account_role_scope_admin.sql` 的受保護 RPC、冪等鍵與最後一位 SYSTEM_ADMIN 防線。
- Auth 綁定重設／解除：僅供帳號移交、復原等進階情境，仍要求理由與 recovery ticket。

## 安全 seam

瀏覽器只持有 anon key 與目前登入 session，操作時以 Bearer access token 呼叫 `/api/admin/accounts`。route 先用呼叫者 JWT 查驗有效的 `app_accounts` 與 `SYSTEM_ADMIN`，再以呼叫者 scoped client 呼叫資料庫 RPC；每個資料庫 RPC 也會再次執行 `private.require_system_admin()`。

只有需要 Auth Admin API 的操作才使用 server-only `SUPABASE_SERVICE_ROLE_KEY`（也支援 Supabase 新式 secret key 作為 fallback）。此 key 只能放在 Vercel Project Settings → Environment Variables 的 Production／Preview 對應環境，不能放在 `NEXT_PUBLIC_*`、GitHub repository、瀏覽器或前端 bundle。

`0067_account_admin_profile_and_auth_audit.sql` 新增：

- `update_account_profile(...)`：資料庫驅動的基本資料修改與 append-only audit。
- `record_account_security_event(...)`：記錄 Auth 建立、密碼變更、啟用／停用與刪除事件；不保存密碼。

兩個 RPC 都使用 `operation_commands` 冪等鍵，並只授權 `authenticated`；`public` 與 `anon` 均撤銷執行權限。

## 初次部署操作

1. 由受保護的 Supabase SQL／migration 流程套用 `0067_account_admin_profile_and_auth_audit.sql`。
2. 在 Vercel 專案新增 `SUPABASE_SERVICE_ROLE_KEY`，只勾選需要的 Environment；不要使用 GitHub 的 `SUPABASE_ACCESS_TOKEN` 代替，它是 CLI／管理 API token，不是 Auth Admin runtime key。
3. 重新部署 Vercel，使用既有 SYSTEM_ADMIN 登入。
4. 在「總覽 → 帳號與正式資料基礎」建立第一個非管理員帳號，接著指派角色；建立後把初始密碼透過核准的安全管道交付並要求使用者登入後更換。
5. 以 staging 帳號驗證建立、資料修改、改密碼、停用、刪除登入身份、角色、需求窗口範圍，以及最後一位 SYSTEM_ADMIN 不可被停用／移除。

## 邊界

資料庫 migration 與程式碼已提供正式管理流程，但 Supabase project 的 Auth Admin key、初始 SYSTEM_ADMIN seed、email provider 設定及 staging／production smoke 仍需在實際環境完成。未設定 `SUPABASE_SERVICE_ROLE_KEY` 時，列表與資料庫內的角色／範圍操作仍可讀取或依 RPC 驗證，但建立、改密碼、同步 email、啟用／停用 Auth 登入與刪除登入身份會 fail closed。
