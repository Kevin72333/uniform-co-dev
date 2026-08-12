"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/src/lib/supabase-browser";
import { canonicalFingerprint } from "@/src/lib/fingerprint";

type Account = { id: string; auth_user_id: string | null; display_name: string; email_snapshot: string | null; is_active: boolean };
type Role = "SYSTEM_ADMIN" | "HR" | "WAREHOUSE" | "PROCUREMENT" | "CEO" | "DEMAND_COORDINATOR";
type RoleRow = { account_id: string; role_code: Role };
type Institution = { id: string; code: string; name: string };
type Department = { id: string; institution_id: string; code: string; name: string };

const roles: Role[] = ["SYSTEM_ADMIN", "HR", "WAREHOUSE", "PROCUREMENT", "CEO", "DEMAND_COORDINATOR"];

export default function AccountAdminPanel() {
  const client = getSupabaseBrowserClient();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [roleRows, setRoleRows] = useState<RoleRow[]>([]);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [authUserId, setAuthUserId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("HR");
  const [roleEnabled, setRoleEnabled] = useState(true);
  const [institutionId, setInstitutionId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [scopeEnabled, setScopeEnabled] = useState(true);
  const [newAuthUserId, setNewAuthUserId] = useState("");
  const [unbindAuth, setUnbindAuth] = useState(false);
  const [recoveryTicket, setRecoveryTicket] = useState("");
  const [reason, setReason] = useState("初始帳號與權限設定");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const operationRefs = useRef<Record<string, string>>({});

  const selected = accounts.find((account) => account.id === selectedId) ?? null;
  const selectedRoles = useMemo(() => roleRows.filter((row) => row.account_id === selectedId).map((row) => row.role_code), [roleRows, selectedId]);
  const filteredDepartments = departments.filter((department) => department.institution_id === institutionId);

  const fetchData = useCallback(async () => {
    if (!client) return null;
    const [accountResult, roleResult, institutionResult, departmentResult] = await Promise.all([
      client.from("app_accounts").select("id,auth_user_id,display_name,email_snapshot,is_active").order("display_name"),
      client.from("user_roles").select("account_id,role_code"),
      client.from("institutions").select("id,code,name").eq("is_active", true).order("code"),
      client.from("departments").select("id,institution_id,code,name").eq("is_active", true).order("code"),
    ]);
    if (accountResult.error || roleResult.error || institutionResult.error || departmentResult.error) {
      throw new Error("帳號資料載入失敗；請確認目前登入帳號具有 SYSTEM_ADMIN 角色。");
    }
    return {
      accounts: (accountResult.data ?? []) as Account[],
      roleRows: (roleResult.data ?? []) as RoleRow[],
      institutions: (institutionResult.data ?? []) as Institution[],
      departments: (departmentResult.data ?? []) as Department[],
    };
  }, [client]);

  const applyData = useCallback((data: NonNullable<Awaited<ReturnType<typeof fetchData>>>) => {
    setAccounts(data.accounts);
    setRoleRows(data.roleRows);
    setInstitutions(data.institutions);
    setDepartments(data.departments);
  }, []);

  async function load() {
    try {
      const data = await fetchData();
      if (data) applyData(data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "帳號資料載入失敗");
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
        if (active) setMessage(error instanceof Error ? error.message : "帳號資料載入失敗");
      }
    }
    void loadInitialData();
    return () => { active = false; };
  }, [applyData, client, fetchData]);

  function resetOperation(name: string) { delete operationRefs.current[name]; }
  function operationKey(name: string) { return operationRefs.current[name] ?? (operationRefs.current[name] = crypto.randomUUID()); }

  async function createAccount() {
    if (!client || !authUserId.trim() || !displayName.trim() || !email.trim()) { setMessage("請填寫 Auth user UUID、顯示名稱與 email 快照。"); return; }
    setBusy(true); setMessage("");
    const payload = { auth_user_id: authUserId.trim(), display_name: displayName.trim(), email_snapshot: email.trim() };
    const { data, error } = await client.rpc("create_account_profile", {
      p_auth_user_id: payload.auth_user_id, p_display_name: payload.display_name, p_email_snapshot: payload.email_snapshot,
      p_idempotency_key: `ADMIN-ACCOUNT-${operationKey("create")}`,
      p_request_fingerprint: await canonicalFingerprint(payload),
    });
    if (error || !data?.id) setMessage(`建立帳號失敗：${error?.message ?? "結果尚未確認，請沿用同一表單重試"}`);
    else { setMessage(`已建立帳號 ${data.display_name}；接著可指派角色。`); resetOperation("create"); setAuthUserId(""); setDisplayName(""); setEmail(""); await load(); setSelectedId(data.id); }
    setBusy(false);
  }

  async function setRoleValue() {
    if (!client || !selectedId || !reason.trim()) { setMessage("請選擇帳號並填寫操作理由。"); return; }
    setBusy(true); setMessage("");
    const payload = { account_id: selectedId, role_code: role, is_enabled: roleEnabled, reason: reason.trim() };
    const { error } = await client.rpc("set_account_role", {
      p_account_id: selectedId, p_role_code: role, p_is_enabled: roleEnabled, p_reason: reason.trim(),
      p_idempotency_key: `ADMIN-ROLE-${operationKey("role")}`,
      p_request_fingerprint: await canonicalFingerprint(payload),
    });
    if (error) setMessage(`角色變更失敗：${error.message}`);
    else { setMessage(`${selected?.display_name ?? "帳號"} 的 ${role} 已${roleEnabled ? "啟用" : "停用"}。`); resetOperation("role"); await load(); }
    setBusy(false);
  }

  async function setStatus() {
    if (!client || !selectedId || !reason.trim()) { setMessage("請選擇帳號並填寫操作理由。"); return; }
    setBusy(true); setMessage("");
    const payload = { account_id: selectedId, is_active: !selected?.is_active, reason: reason.trim() };
    const { error } = await client.rpc("set_account_status", {
      p_account_id: selectedId, p_is_active: payload.is_active, p_reason: payload.reason,
      p_idempotency_key: `ADMIN-STATUS-${operationKey("status")}`,
      p_request_fingerprint: await canonicalFingerprint(payload),
    });
    if (error) setMessage(`帳號狀態變更失敗：${error.message}`);
    else { setMessage("帳號狀態已更新。"); resetOperation("status"); await load(); }
    setBusy(false);
  }

  async function setScope() {
    if (!client || !selectedId || !institutionId || !departmentId || !reason.trim()) { setMessage("請選擇需求窗口、機構、部門並填寫理由。"); return; }
    setBusy(true); setMessage("");
    const payload = { account_id: selectedId, institution_id: institutionId, department_id: departmentId, is_enabled: scopeEnabled, reason: reason.trim() };
    const { error } = await client.rpc("set_coordinator_scope", {
      p_account_id: selectedId, p_institution_id: institutionId, p_department_id: departmentId, p_is_enabled: scopeEnabled, p_reason: reason.trim(),
      p_idempotency_key: `ADMIN-SCOPE-${operationKey("scope")}`,
      p_request_fingerprint: await canonicalFingerprint(payload),
    });
    if (error) setMessage(`窗口範圍變更失敗：${error.message}`);
    else { setMessage("需求窗口範圍已更新。"); resetOperation("scope"); }
    setBusy(false);
  }

  async function rebindAuth() {
    if (!client || !selectedId || !newAuthUserId.trim() || !reason.trim()) { setMessage("請選擇帳號、填寫新的 Auth user UUID 與理由。"); return; }
    setBusy(true); setMessage("");
    const payload = { account_id: selectedId, new_auth_user_id: unbindAuth ? null : newAuthUserId.trim(), reason: reason.trim(), recovery_ticket: recoveryTicket.trim() || null };
    const { error } = await client.rpc("rebind_account_auth", {
      p_account_id: selectedId, p_new_auth_user_id: payload.new_auth_user_id, p_reason: payload.reason, p_recovery_ticket: payload.recovery_ticket,
      p_idempotency_key: `ADMIN-REBIND-${operationKey("rebind")}`,
      p_request_fingerprint: await canonicalFingerprint(payload),
    });
    if (error) setMessage(`Auth 綁定重設失敗：${error.message}`);
    else { setMessage(unbindAuth ? "Auth 綁定已解除並留下稽核紀錄。" : "Auth 綁定已重設並留下稽核紀錄。"); resetOperation("rebind"); setNewAuthUserId(""); setRecoveryTicket(""); setUnbindAuth(false); await load(); }
    setBusy(false);
  }

  if (!client) return null;
  return <section className="panel import-panel" aria-label="帳號角色與需求窗口管理">
    <div className="panel-heading"><div><p className="eyebrow">01 / ADMIN</p><h2>帳號、六角色與窗口範圍</h2></div><span className="status-pill">SYSTEM_ADMIN</span></div>
    <p className="auth-message">先在 Supabase Auth 邀請使用者，再把 Auth user UUID 綁定到不可變業務帳號；每次角色與範圍變更都保存理由與冪等結果。</p>
    <div className="form-grid">
      <label className="field"><span>Auth user UUID（新帳號）</span><input value={authUserId} onChange={(event) => { resetOperation("create"); setAuthUserId(event.target.value); }} disabled={busy} placeholder="Auth Admin 邀請後貼上 UUID" /></label>
      <label className="field"><span>顯示名稱</span><input value={displayName} onChange={(event) => { resetOperation("create"); setDisplayName(event.target.value); }} disabled={busy} /></label>
      <label className="field"><span>Email 快照</span><input type="email" value={email} onChange={(event) => { resetOperation("create"); setEmail(event.target.value); }} disabled={busy} /></label>
    </div>
    <div className="button-row"><button className="primary-button" type="button" onClick={() => void createAccount()} disabled={busy || !authUserId.trim() || !displayName.trim() || !email.trim()}>{busy ? "處理中…" : "建立業務帳號"}</button></div>
    <div className="summary-list">
      {accounts.map((account) => <button className={`admin-account-row ${account.id === selectedId ? "selected" : ""}`} type="button" key={account.id} onClick={() => { setSelectedId(account.id); resetOperation("role"); resetOperation("status"); resetOperation("scope"); }}>
        <span><strong>{account.display_name}</strong><small>{account.email_snapshot ?? "無 email 快照"}／{account.is_active ? "啟用" : "停用"}</small></span><span className="status-pill">{selectedId === account.id ? "已選" : "選擇"}</span>
      </button>)}
    </div>
    {selected ? <>
      <div className="form-grid admin-controls">
        <label className="field"><span>角色</span><select value={role} onChange={(event) => { resetOperation("role"); setRole(event.target.value as Role); }} disabled={busy}><option value="SYSTEM_ADMIN">SYSTEM_ADMIN</option>{roles.filter((value) => value !== "SYSTEM_ADMIN").map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
        <label className="field"><span>角色狀態</span><select value={roleEnabled ? "ON" : "OFF"} onChange={(event) => { resetOperation("role"); setRoleEnabled(event.target.value === "ON"); }} disabled={busy}><option value="ON">啟用</option><option value="OFF">停用</option></select></label>
        <label className="field"><span>帳號狀態</span><select value={selected.is_active ? "ON" : "OFF"} onChange={() => resetOperation("status")} disabled={busy}><option value="ON">啟用中</option><option value="OFF">停用中</option></select></label>
        <label className="field"><span>理由（必填）</span><input value={reason} onChange={(event) => { resetOperation("role"); resetOperation("status"); resetOperation("scope"); setReason(event.target.value); }} disabled={busy} /></label>
        <label className="field"><span>新的 Auth user UUID（重設綁定）</span><input value={newAuthUserId} onChange={(event) => { resetOperation("rebind"); setNewAuthUserId(event.target.value); }} disabled={busy} placeholder="僅在帳號移交時填寫" /></label>
        <label className="field"><span>Recovery ticket（選填）</span><input value={recoveryTicket} onChange={(event) => { resetOperation("rebind"); setRecoveryTicket(event.target.value); }} disabled={busy} placeholder="工單／核准編號" /></label>
        <label className="field"><span>綁定動作</span><select value={unbindAuth ? "UNBIND" : "REBIND"} onChange={(event) => { resetOperation("rebind"); setUnbindAuth(event.target.value === "UNBIND"); }} disabled={busy}><option value="REBIND">重設到新的 Auth user</option><option value="UNBIND">解除 Auth 綁定</option></select></label>
      </div>
      <p className="muted">目前角色：{selectedRoles.length > 0 ? selectedRoles.join("、") : "尚未指派"}</p>
      <div className="button-row"><button className="secondary-button" type="button" onClick={() => void setRoleValue()} disabled={busy}>{roleEnabled ? "啟用角色" : "停用角色"}</button><button className="secondary-button" type="button" onClick={() => void setStatus()} disabled={busy}>{selected.is_active ? "停用帳號" : "啟用帳號"}</button><button className="secondary-button" type="button" onClick={() => void rebindAuth()} disabled={busy || (!unbindAuth && !newAuthUserId.trim())}>{unbindAuth ? "解除 Auth 綁定" : "重設 Auth 綁定"}</button></div>
      <div className="increase-list"><div className="subheading"><h3>需求窗口範圍</h3><span>只有 DEMAND_COORDINATOR 可設定範圍</span></div><div className="form-grid"><label className="field"><span>機構</span><select value={institutionId} onChange={(event) => { resetOperation("scope"); setInstitutionId(event.target.value); setDepartmentId(""); }} disabled={busy}><option value="">選擇機構</option>{institutions.map((institution) => <option key={institution.id} value={institution.id}>{institution.code}｜{institution.name}</option>)}</select></label><label className="field"><span>部門</span><select value={departmentId} onChange={(event) => { resetOperation("scope"); setDepartmentId(event.target.value); }} disabled={busy || !institutionId}><option value="">選擇部門</option>{filteredDepartments.map((department) => <option key={department.id} value={department.id}>{department.code}｜{department.name}</option>)}</select></label><label className="field"><span>範圍狀態</span><select value={scopeEnabled ? "ON" : "OFF"} onChange={(event) => { resetOperation("scope"); setScopeEnabled(event.target.value === "ON"); }} disabled={busy}><option value="ON">授權</option><option value="OFF">撤銷</option></select></label></div><div className="button-row"><button className="secondary-button" type="button" onClick={() => void setScope()} disabled={busy || !institutionId || !departmentId}>{scopeEnabled ? "授權窗口範圍" : "撤銷窗口範圍"}</button></div></div>
    </> : null}
    {message ? <p className={message.includes("已") || message.includes("建立") ? "success-note" : "auth-message"} role="status">{message}</p> : null}
  </section>;
}
