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
            <strong>制服管理</strong>
            <span>UNIFORM-CO / MVP</span>
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
              <span className="app-nav-icon" aria-hidden="true">{workspace.icon}</span>
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
        <header className="workspace-topbar">
          <div>
            <span className="workspace-topbar-label">WORKSPACE / {activeDefinition.eyebrow}</span>
            <p>制服需求、倉庫與採購共用同一套可追溯資料流程。</p>
          </div>
          <span className="status-pill">SUPABASE + RLS</span>
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

        <section className="workspace-hero" aria-labelledby="active-workspace-title">
          <div>
            <p className="eyebrow">{activeDefinition.eyebrow}</p>
            <h1 id="active-workspace-title">{activeDefinition.label}</h1>
            <p>{activeDefinition.description}</p>
          </div>
          <span className="workspace-date-pill">正式資料工作區</span>
        </section>

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
