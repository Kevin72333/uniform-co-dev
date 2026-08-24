"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/src/lib/supabase-browser";
import { validateAccountCreation } from "@/src/lib/account-admin-form";

type Account = { id: string; auth_user_id: string | null; login_name: string | null; display_name: string; email_snapshot: string | null; is_active: boolean };
type Role = "SYSTEM_ADMIN" | "HR" | "WAREHOUSE" | "PROCUREMENT" | "CEO" | "DEMAND_COORDINATOR";
type RoleRow = { account_id: string; role_code: Role };
type Institution = { id: string; code: string; name: string };
type Department = { id: string; institution_id: string; code: string; name: string };
type ScopeRow = { account_id: string; institution_id: string; department_id: string };
type OperationPayload = Record<string, unknown>;
type OperationResult = { ok: boolean; account?: Account; warning?: string; error?: string };

const roles: Role[] = ["SYSTEM_ADMIN", "HR", "WAREHOUSE", "PROCUREMENT", "CEO", "DEMAND_COORDINATOR"];

export default function AccountAdminPanel() {
  const client = getSupabaseBrowserClient();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [roleRows, setRoleRows] = useState<RoleRow[]>([]);
  const [scopeRows, setScopeRows] = useState<ScopeRow[]>([]);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loginName, setLoginName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [createRoleCodes, setCreateRoleCodes] = useState<Role[]>(["HR"]);
  const [editLoginName, setEditLoginName] = useState("");
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [editRoleCodes, setEditRoleCodes] = useState<Role[]>([]);
  const [institutionId, setInstitutionId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [scopeEnabled, setScopeEnabled] = useState(true);
  const [newAuthUserId, setNewAuthUserId] = useState("");
  const [unbindAuth, setUnbindAuth] = useState(false);
  const [recoveryTicket, setRecoveryTicket] = useState("");
  const [reason, setReason] = useState("初始帳號與權限設定");
  const [message, setMessage] = useState("");
  const [messageKind, setMessageKind] = useState<"success" | "error">("success");
  const [busy, setBusy] = useState(false);
  const operationRefs = useRef<Record<string, string>>({});

  const selected = accounts.find((account) => account.id === selectedId) ?? null;
  const selectedRoles = useMemo(() => roleRows.filter((row) => row.account_id === selectedId).map((row) => row.role_code), [roleRows, selectedId]);
  const selectedScopes = useMemo(() => scopeRows.filter((row) => row.account_id === selectedId), [scopeRows, selectedId]);
  const filteredDepartments = departments.filter((department) => department.institution_id === institutionId);

  const fetchData = useCallback(async () => {
    if (!client) return null;
    const [accountResult, roleResult, scopeResult, institutionResult, departmentResult] = await Promise.all([
      client.from("app_accounts").select("id,auth_user_id,login_name,display_name,email_snapshot,is_active").order("display_name"),
      client.from("user_roles").select("account_id,role_code"),
      client.from("coordinator_scopes").select("account_id,institution_id,department_id"),
      client.from("institutions").select("id,code,name").eq("is_active", true).order("code"),
      client.from("departments").select("id,institution_id,code,name").eq("is_active", true).order("code"),
    ]);
    if (accountResult.error || roleResult.error || scopeResult.error || institutionResult.error || departmentResult.error) {
      throw new Error("帳號資料載入失敗；請確認目前登入帳號具有 SYSTEM_ADMIN 角色。");
    }
    return {
      accounts: (accountResult.data ?? []) as Account[],
      roleRows: (roleResult.data ?? []) as RoleRow[],
      scopeRows: (scopeResult.data ?? []) as ScopeRow[],
      institutions: (institutionResult.data ?? []) as Institution[],
      departments: (departmentResult.data ?? []) as Department[],
    };
  }, [client]);

  const applyData = useCallback((data: NonNullable<Awaited<ReturnType<typeof fetchData>>>) => {
    setAccounts(data.accounts);
    setRoleRows(data.roleRows);
    setScopeRows(data.scopeRows);
    setInstitutions(data.institutions);
    setDepartments(data.departments);
  }, []);

  async function load() {
    try {
      const data = await fetchData();
      if (data) applyData(data);
      return data;
    } catch (error) {
      setMessageKind("error");
      setMessage(error instanceof Error ? error.message : "帳號資料載入失敗");
      return null;
    }
  }

  useEffect(() => {
    if (!client) return;
    let active = true;
    async function loadInitialData() {
      try {
        const data = await fetchData();
        if (active && data) applyData(data);
      } catch (error) {
        if (active) {
          setMessageKind("error");
          setMessage(error instanceof Error ? error.message : "帳號資料載入失敗");
        }
      }
    }
    void loadInitialData();
    return () => { active = false; };
  }, [applyData, client, fetchData]);

  function resetOperation(name: string) { delete operationRefs.current[name]; }
  function operationKey(name: string) { return operationRefs.current[name] ?? (operationRefs.current[name] = crypto.randomUUID()); }

  function selectAccount(account: Account) {
    setSelectedId(account.id);
    setEditLoginName(account.login_name ?? "");
    setEditDisplayName(account.display_name);
    setEditEmail(account.email_snapshot ?? "");
    setEditRoleCodes(roleRows.filter((row) => row.account_id === account.id).map((row) => row.role_code));
    resetOperation("profile");
    resetOperation("password");
    resetOperation("roles");
    resetOperation("status");
    resetOperation("delete");
    resetOperation("scope");
    resetOperation("rebind");
  }

  async function runOperation(payload: OperationPayload, operationName: string): Promise<OperationResult | null> {
    if (!client) return null;
    const { data: sessionData } = await client.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) {
      throw new Error("登入工作階段不存在或已過期，請重新登入。");
    }
    const response = await fetch("/api/admin/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ ...payload, idempotency_key: operationKey(operationName) }),
    });
    const result = await response.json() as OperationResult;
    if (!response.ok || !result.ok) {
      throw new Error(result.error ?? "帳號管理操作失敗。");
    }
    resetOperation(operationName);
    setMessageKind(result.warning ? "error" : "success");
    setMessage(result.warning ?? "帳號管理操作已完成。");
    await load();
    return result;
  }

  async function createAccount() {
    const validationErrors = validateAccountCreation({
      loginName,
      password,
      roleCount: createRoleCodes.length,
      reason,
    });
    if (validationErrors.length > 0) {
      setMessageKind("error");
      setMessage(validationErrors.join(" "));
      return;
    }
    setBusy(true); setMessage("");
    try {
      const result = await runOperation({
        operation: "create",
        login_name: loginName.trim(),
        display_name: displayName.trim(),
        email: email.trim() || null,
        password,
        role_codes: createRoleCodes,
        reason: reason.trim(),
      }, "create");
      if (result?.account) {
        selectAccount(result.account);
        setEditRoleCodes(createRoleCodes);
      }
      setLoginName(""); setDisplayName(""); setEmail(""); setPassword(""); setCreateRoleCodes(["HR"]);
    } catch (error) {
      setMessageKind("error");
      setMessage(error instanceof Error ? error.message : "建立帳號失敗。");
    } finally { setBusy(false); }
  }

  async function setRoleValues() {
    if (!selectedId || editRoleCodes.length === 0 || !reason.trim()) { setMessageKind("error"); setMessage("請選擇帳號、至少一個角色並填寫操作理由。"); return; }
    setBusy(true); setMessage("");
    try { await runOperation({ operation: "set_roles", account_id: selectedId, role_codes: editRoleCodes, reason: reason.trim() }, "roles"); }
    catch (error) { setMessageKind("error"); setMessage(error instanceof Error ? error.message : "角色權限變更失敗。"); }
    finally { setBusy(false); }
  }

  async function setStatus() {
    if (!selectedId || !reason.trim()) { setMessageKind("error"); setMessage("請選擇帳號並填寫操作理由。"); return; }
    setBusy(true); setMessage("");
    try { await runOperation({ operation: "set_status", account_id: selectedId, is_active: !selected?.is_active, reason: reason.trim() }, "status"); }
    catch (error) { setMessageKind("error"); setMessage(error instanceof Error ? error.message : "帳號狀態變更失敗。"); }
    finally { setBusy(false); }
  }

  async function setScope() {
    if (!selectedId || !institutionId || !departmentId || !reason.trim()) { setMessageKind("error"); setMessage("請選擇需求窗口、機構、部門並填寫理由。"); return; }
    setBusy(true); setMessage("");
    try { await runOperation({ operation: "set_scope", account_id: selectedId, institution_id: institutionId, department_id: departmentId, is_enabled: scopeEnabled, reason: reason.trim() }, "scope"); }
    catch (error) { setMessageKind("error"); setMessage(error instanceof Error ? error.message : "窗口範圍變更失敗。"); }
    finally { setBusy(false); }
  }

  async function rebindAuth() {
    if (!selectedId || (!unbindAuth && !newAuthUserId.trim()) || !reason.trim()) { setMessageKind("error"); setMessage("請選擇帳號、填寫新的 Auth user UUID 與理由。"); return; }
    setBusy(true); setMessage("");
    try { await runOperation({ operation: "rebind", account_id: selectedId, new_auth_user_id: unbindAuth ? null : newAuthUserId.trim(), reason: reason.trim(), recovery_ticket: recoveryTicket.trim() || null }, "rebind"); setNewAuthUserId(""); setRecoveryTicket(""); setUnbindAuth(false); }
    catch (error) { setMessageKind("error"); setMessage(error instanceof Error ? error.message : "Auth 綁定重設失敗。"); }
    finally { setBusy(false); }
  }

  async function updateProfile() {
    if (!selectedId || !editLoginName.trim() || !editDisplayName.trim() || !reason.trim()) { setMessageKind("error"); setMessage("請填寫登入帳號、顯示名稱與操作理由。"); return; }
    setBusy(true); setMessage("");
    try { await runOperation({ operation: "update_profile", account_id: selectedId, login_name: editLoginName.trim(), display_name: editDisplayName.trim(), email: editEmail.trim() || null, reason: reason.trim() }, "profile"); }
    catch (error) { setMessageKind("error"); setMessage(error instanceof Error ? error.message : "帳號資料修改失敗。"); }
    finally { setBusy(false); }
  }

  async function updatePassword() {
    if (!selectedId || resetPassword.length < 6 || !reason.trim()) { setMessageKind("error"); setMessage("請輸入至少 6 個字元的新密碼與操作理由。"); return; }
    setBusy(true); setMessage("");
    try { await runOperation({ operation: "set_password", account_id: selectedId, password: resetPassword, reason: reason.trim() }, "password"); setResetPassword(""); }
    catch (error) { setMessageKind("error"); setMessage(error instanceof Error ? error.message : "密碼修改失敗。"); }
    finally { setBusy(false); }
  }

  async function deleteAccount() {
    if (!selectedId || !reason.trim()) { setMessageKind("error"); setMessage("請選擇帳號並填寫操作理由。"); return; }
    if (!window.confirm(`確定要停用「${selected?.display_name ?? "此帳號"}」並刪除其登入身份嗎？業務歷史資料會保留。`)) return;
    setBusy(true); setMessage("");
    try { await runOperation({ operation: "delete", account_id: selectedId, reason: reason.trim() }, "delete"); }
    catch (error) { setMessageKind("error"); setMessage(error instanceof Error ? error.message : "帳號刪除失敗。"); }
    finally { setBusy(false); }
  }

  function toggleRole(roleCode: Role, enabled: boolean, target: "create" | "edit") {
    resetOperation(target === "create" ? "create" : "roles");
    const update = (current: Role[]) => enabled
      ? [...new Set([...current, roleCode])]
      : current.filter((value) => value !== roleCode);
    if (target === "create") setCreateRoleCodes(update);
    else setEditRoleCodes(update);
  }

  if (!client) return null;
  return <section className="panel import-panel" aria-label="帳號角色與需求窗口管理">
    <div className="panel-heading"><div><p className="eyebrow">01 / ADMIN</p><h2>帳號、六角色與窗口範圍</h2></div><span className="status-pill">SYSTEM_ADMIN</span></div>
    <p className="auth-message">登入帳號與密碼為必填，Email 只作為選填的聯絡資料。建立帳號時可同時勾選多個角色；密碼只送往 server-side Auth Admin，不會寫入業務資料表。</p>
    {message ? <p className={messageKind === "success" ? "success-note account-admin-feedback" : "error-box account-admin-feedback"} role="status" aria-live="polite">{message}</p> : null}
    <div className="increase-list account-directory">
      <div className="subheading"><h3>現有業務帳號</h3><span>已載入 {accounts.length} 筆</span></div>
      <p className="muted">這裡列出已建立 `app_accounts` 並受角色／RLS 管理的正式帳號；只存在 Supabase Authentication、尚未建立業務帳號的登入身份不會出現在此清單。</p>
      <div className="summary-list account-directory-list">
        {accounts.length === 0 ? <p className="empty-state">目前沒有可管理的業務帳號，或目前登入者沒有 SYSTEM_ADMIN 讀取權限。</p> : null}
        {accounts.map((account) => <button className={`admin-account-row ${account.id === selectedId ? "selected" : ""}`} type="button" key={account.id} onClick={() => selectAccount(account)}>
          <span><strong>{account.display_name}</strong><small>帳號：{account.login_name ?? "舊版 Email 登入"}／{account.email_snapshot ?? "未填聯絡 Email"}／{account.is_active ? "啟用" : "停用"}／{account.auth_user_id ? "已綁定登入" : "未綁定登入"}</small></span><span className="status-pill">{selectedId === account.id ? "已選" : "管理"}</span>
        </button>)}
      </div>
    </div>
    <div className="subheading account-create-heading"><h3>新增帳號</h3><span>帳號、密碼、角色與理由完成後送出</span></div>
    <div className="form-grid">
      <label className="field"><span>登入帳號（3–50 個小寫英數字）</span><input autoComplete="username" value={loginName} onChange={(event) => { resetOperation("create"); setLoginName(event.target.value); }} disabled={busy} placeholder="例如 hr01" /></label>
      <label className="field"><span>初始密碼（至少 6 字元）</span><input autoComplete="new-password" type="password" value={password} onChange={(event) => { resetOperation("create"); setPassword(event.target.value); }} disabled={busy} /></label>
      <label className="field"><span>顯示名稱（選填，預設同帳號）</span><input value={displayName} onChange={(event) => { resetOperation("create"); setDisplayName(event.target.value); }} disabled={busy} /></label>
      <label className="field"><span>聯絡 Email（選填，不作登入）</span><input autoComplete="email" type="email" value={email} onChange={(event) => { resetOperation("create"); setEmail(event.target.value); }} disabled={busy} /></label>
      <label className="field"><span>建立理由（必填）</span><input value={reason} onChange={(event) => { resetOperation("create"); setReason(event.target.value); }} disabled={busy} /></label>
    </div>
    <fieldset className="role-fieldset">
      <legend>角色權限（至少選擇一項）</legend>
      <div className="role-check-grid">
        {roles.map((roleCode) => <label className="role-check" key={`create-${roleCode}`}><input type="checkbox" checked={createRoleCodes.includes(roleCode)} onChange={(event) => toggleRole(roleCode, event.target.checked, "create")} disabled={busy} /><span>{roleCode}</span></label>)}
      </div>
    </fieldset>
    <div className="button-row"><button className="primary-button" type="button" onClick={() => void createAccount()} disabled={busy}>{busy ? "處理中…" : "建立帳號、登入身份與權限"}</button></div>
    {selected ? <>
      <div className="increase-list">
        <div className="subheading"><h3>帳號資料</h3><span>{selected.auth_user_id ? "登入身份由 server-side Auth Admin 同步" : "尚未綁定登入身份"}</span></div>
        <div className="form-grid">
          <label className="field"><span>登入帳號（3–50 個小寫英數字）</span><input autoComplete="username" value={editLoginName} onChange={(event) => { resetOperation("profile"); setEditLoginName(event.target.value); }} disabled={busy} /></label>
          <label className="field"><span>顯示名稱</span><input value={editDisplayName} onChange={(event) => { resetOperation("profile"); setEditDisplayName(event.target.value); }} disabled={busy} /></label>
          <label className="field"><span>聯絡 Email（選填，不作登入）</span><input autoComplete="email" type="email" value={editEmail} onChange={(event) => { resetOperation("profile"); setEditEmail(event.target.value); }} disabled={busy} /></label>
        </div>
        <div className="button-row"><button className="secondary-button" type="button" onClick={() => void updateProfile()} disabled={busy || !editLoginName.trim() || !editDisplayName.trim() || !reason.trim()}>儲存帳號資料</button></div>
      </div>
      <div className="increase-list">
        <div className="subheading"><h3>密碼管理</h3><span>新密碼只經過此次 HTTPS 請求，不寫入 app_accounts</span></div>
        <div className="form-grid">
          <label className="field"><span>設定新密碼（至少 6 字元）</span><input autoComplete="new-password" type="password" value={resetPassword} onChange={(event) => { resetOperation("password"); setResetPassword(event.target.value); }} disabled={busy} /></label>
        </div>
        <div className="button-row"><button className="secondary-button" type="button" onClick={() => void updatePassword()} disabled={busy || resetPassword.length < 6 || !selected.auth_user_id || !reason.trim()}>修改登入密碼</button></div>
      </div>
      <div className="increase-list">
        <div className="subheading"><h3>角色權限</h3><span>可同時勾選多個角色並一次儲存</span></div>
        <fieldset className="role-fieldset">
          <legend>目前要授予的角色（至少一項）</legend>
          <div className="role-check-grid">
            {roles.map((roleCode) => <label className="role-check" key={`edit-${roleCode}`}><input type="checkbox" checked={editRoleCodes.includes(roleCode)} onChange={(event) => toggleRole(roleCode, event.target.checked, "edit")} disabled={busy} /><span>{roleCode}</span></label>)}
          </div>
        </fieldset>
        <div className="button-row"><button className="secondary-button" type="button" onClick={() => void setRoleValues()} disabled={busy || editRoleCodes.length === 0 || !reason.trim()}>儲存角色權限</button></div>
      </div>
      <div className="form-grid admin-controls">
        <label className="field"><span>操作理由（必填）</span><input value={reason} onChange={(event) => { resetOperation("profile"); resetOperation("password"); resetOperation("roles"); resetOperation("status"); resetOperation("delete"); resetOperation("scope"); resetOperation("rebind"); setReason(event.target.value); }} disabled={busy} /></label>
        <label className="field"><span>新的 Auth user UUID（重設綁定）</span><input value={newAuthUserId} onChange={(event) => { resetOperation("rebind"); setNewAuthUserId(event.target.value); }} disabled={busy} placeholder="僅在帳號移交時填寫" /></label>
        <label className="field"><span>Recovery ticket（選填）</span><input value={recoveryTicket} onChange={(event) => { resetOperation("rebind"); setRecoveryTicket(event.target.value); }} disabled={busy} placeholder="工單／核准編號" /></label>
        <label className="field"><span>綁定動作</span><select value={unbindAuth ? "UNBIND" : "REBIND"} onChange={(event) => { resetOperation("rebind"); setUnbindAuth(event.target.value === "UNBIND"); }} disabled={busy}><option value="REBIND">重設到新的 Auth user</option><option value="UNBIND">解除 Auth 綁定</option></select></label>
      </div>
      <p className="muted">目前角色：{selectedRoles.length > 0 ? selectedRoles.join("、") : "尚未指派"}／目前需求窗口範圍：{selectedScopes.length} 筆</p>
      <div className="button-row"><button className="secondary-button" type="button" onClick={() => void setStatus()} disabled={busy || !reason.trim()}>{selected.is_active ? "停用登入與帳號" : "重新啟用帳號"}</button><button className="secondary-button" type="button" onClick={() => void rebindAuth()} disabled={busy || !reason.trim() || (!unbindAuth && !newAuthUserId.trim())}>{unbindAuth ? "解除 Auth 綁定" : "重設 Auth 綁定"}</button><button className="secondary-button" type="button" onClick={() => void deleteAccount()} disabled={busy || !reason.trim()}>刪除登入身份</button></div>
      <div className="increase-list"><div className="subheading"><h3>需求窗口範圍</h3><span>只有 DEMAND_COORDINATOR 可設定範圍</span></div><div className="form-grid"><label className="field"><span>機構</span><select value={institutionId} onChange={(event) => { resetOperation("scope"); setInstitutionId(event.target.value); setDepartmentId(""); }} disabled={busy}><option value="">選擇機構</option>{institutions.map((institution) => <option key={institution.id} value={institution.id}>{institution.code}｜{institution.name}</option>)}</select></label><label className="field"><span>部門</span><select value={departmentId} onChange={(event) => { resetOperation("scope"); setDepartmentId(event.target.value); }} disabled={busy || !institutionId}><option value="">選擇部門</option>{filteredDepartments.map((department) => <option key={department.id} value={department.id}>{department.code}｜{department.name}</option>)}</select></label><label className="field"><span>範圍狀態</span><select value={scopeEnabled ? "ON" : "OFF"} onChange={(event) => { resetOperation("scope"); setScopeEnabled(event.target.value === "ON"); }} disabled={busy}><option value="ON">授權</option><option value="OFF">撤銷</option></select></label></div><div className="button-row"><button className="secondary-button" type="button" onClick={() => void setScope()} disabled={busy || !institutionId || !departmentId}>{scopeEnabled ? "授權窗口範圍" : "撤銷窗口範圍"}</button></div></div>
    </> : null}
  </section>;
}
