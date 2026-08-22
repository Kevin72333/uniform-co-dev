"use client";

import { useEffect, useState } from "react";
import AuthPanel from "./AuthPanel";
import AuthSessionBoundary from "./AuthSessionBoundary";
import HrWorkspace from "./workspaces/HrWorkspace";
import OverviewWorkspace from "./workspaces/OverviewWorkspace";
import ProcurementWorkspace from "./workspaces/ProcurementWorkspace";
import ReportsWorkspace from "./workspaces/ReportsWorkspace";
import SeasonalWorkspace from "./workspaces/SeasonalWorkspace";
import WarehouseWorkspace from "./workspaces/WarehouseWorkspace";
import { isWorkspaceId, type WorkspaceId, workspaceDefinitions } from "./workspaces/workspace-config";

function WorkspaceIcon({ name }: { name: (typeof workspaceDefinitions)[number]["icon"] }) {
  const common = { width: 17, height: 17, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  if (name === "grid") {
    return <svg {...common}><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></svg>;
  }
  if (name === "people") {
    return <svg {...common}><circle cx="9" cy="8" r="3" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0" /><path d="M16 5.5a3 3 0 0 1 0 5.8M16.5 14.5a5 5 0 0 1 4 4.5" /></svg>;
  }
  if (name === "warehouse") {
    return <svg {...common}><path d="m3 10 9-6 9 6" /><path d="M5 9v10h14V9" /><path d="M9 19v-6h6v6M8 10h.01M12 10h.01M16 10h.01" /></svg>;
  }
  if (name === "cart") {
    return <svg {...common}><path d="M4 5h2l1.5 9h9L20 8H7" /><circle cx="10" cy="19" r="1.4" /><circle cx="17" cy="19" r="1.4" /></svg>;
  }
  if (name === "refresh") {
    return <svg {...common}><path d="M20 7v5h-5" /><path d="M4 17v-5h5" /><path d="M6.3 9A7 7 0 0 1 20 12M4 12a7 7 0 0 0 13.7 3" /></svg>;
  }
  return <svg {...common}><path d="M4 19V5M4 19h16" /><path d="m7 15 4-4 3 2 5-6" /></svg>;
}

function workspaceFromUrl(): WorkspaceId {
  if (typeof window === "undefined") {
    return "overview";
  }
  const value = window.location.hash.replace(/^#/, "");
  return isWorkspaceId(value) ? value : "overview";
}

export default function WorkspaceShell() {
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceId>("overview");
  const activeDefinition = workspaceDefinitions.find((workspace) => workspace.id === activeWorkspace) ?? workspaceDefinitions[0];

  useEffect(() => {
    const syncWorkspace = () => setActiveWorkspace(workspaceFromUrl());
    syncWorkspace();
    window.addEventListener("hashchange", syncWorkspace);
    window.addEventListener("popstate", syncWorkspace);
    return () => {
      window.removeEventListener("hashchange", syncWorkspace);
      window.removeEventListener("popstate", syncWorkspace);
    };
  }, []);

  function selectWorkspace(id: WorkspaceId) {
    setActiveWorkspace(id);
    if (window.location.hash !== `#${id}`) {
      window.history.pushState({}, "", `#${id}`);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="app-shell">
      <aside className="app-sidebar" aria-label="工作區導航">
        <div className="app-brand">
          <span className="app-brand-mark" aria-hidden="true">U</span>
          <div>
            <strong>UNIFORM CO.</strong>
            <span>制服資產作業台</span>
          </div>
        </div>

        <p className="app-nav-label">WORKSPACE</p>
        <nav className="app-nav" aria-label="主要工作區">
          {workspaceDefinitions.map((workspace) => (
            <button
              key={workspace.id}
              id={`workspace-tab-${workspace.id}`}
              className={activeWorkspace === workspace.id ? "active" : ""}
              type="button"
              role="tab"
              aria-selected={activeWorkspace === workspace.id}
              aria-controls={`workspace-${workspace.id}`}
              onClick={() => selectWorkspace(workspace.id)}
            >
              <span className="app-nav-icon"><WorkspaceIcon name={workspace.icon} /></span>
              <span>{workspace.label}</span>
            </button>
          ))}
        </nav>

        <div className="app-sidebar-bottom">
          <div className="app-user-chip">
            <span className="app-avatar" aria-hidden="true">U</span>
            <div>
              <strong>目前登入帳號</strong>
              <span>角色與資料範圍由 RLS 判定</span>
            </div>
          </div>
        </div>
      </aside>

      <div className="app-main">
        <header className="workspace-topbar" aria-labelledby="active-workspace-title">
          <div className="workspace-topbar-copy">
            <p className="eyebrow">{activeDefinition.eyebrow}</p>
            <h1 id="active-workspace-title">{activeDefinition.label}</h1>
            <p>{activeDefinition.description}</p>
          </div>
          <div className="workspace-topbar-actions">
            <span className="workspace-date-pill">正式資料工作區</span>
            <span className="status-pill">SUPABASE + RLS</span>
          </div>
        </header>

        <div className="workspace-mobile-switcher">
          <label htmlFor="workspace-mobile-select">目前工作區</label>
          <select
            id="workspace-mobile-select"
            value={activeWorkspace}
            onChange={(event) => {
              if (isWorkspaceId(event.target.value)) {
                selectWorkspace(event.target.value);
              }
            }}
          >
            {workspaceDefinitions.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.label}</option>)}
          </select>
        </div>

        <AuthPanel />

        <AuthSessionBoundary>
          {workspaceDefinitions.map((workspace) => (
            <section
              key={workspace.id}
              id={`workspace-${workspace.id}`}
              className={`workspace-page ${activeWorkspace === workspace.id ? "is-active" : ""}`}
              role="tabpanel"
              aria-labelledby={`workspace-tab-${workspace.id}`}
              hidden={activeWorkspace !== workspace.id}
            >
              {workspace.id === "overview" ? <OverviewWorkspace /> : null}
              {workspace.id === "hr" ? <HrWorkspace /> : null}
              {workspace.id === "warehouse" ? <WarehouseWorkspace /> : null}
              {workspace.id === "procurement" ? <ProcurementWorkspace /> : null}
              {workspace.id === "seasonal" ? <SeasonalWorkspace /> : null}
              {workspace.id === "reports" ? <ReportsWorkspace /> : null}
            </section>
          ))}
        </AuthSessionBoundary>
      </div>
    </div>
  );
}
