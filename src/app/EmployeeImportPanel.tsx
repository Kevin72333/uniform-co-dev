"use client";

import { useState } from "react";
import { parseEmployeeCsv, type EmployeeImportResult } from "@/src/domain/employee-import";

export default function EmployeeImportPanel() {
  const [result, setResult] = useState<EmployeeImportResult | null>(null);
  const [fileName, setFileName] = useState("");

  async function handleFile(file: File | undefined) {
    if (!file) {
      return;
    }
    setFileName(file.name);
    setResult(parseEmployeeCsv(await file.text()));
  }

  return (
    <section className="panel import-panel" aria-label="員工 CSV 匯入預覽">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">05 / MASTER DATA</p>
          <h2>員工 CSV 匯入預覽</h2>
        </div>
        <span className={`status-pill ${result && result.errors.length > 0 ? "danger" : "success"}`}>
          {result ? (result.errors.length > 0 ? "需修正" : "可確認預覽") : "尚未選檔"}
        </span>
      </div>
      <p className="auth-message">
        第一版提供安全 CSV 預覽；確認發布仍需登入後由受保護的 durable import RPC 原子套用，缺部門或重複工號不會寫入正式主檔。
      </p>
      <label className="file-picker">
        <span>選擇 CSV</span>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(event) => void handleFile(event.target.files?.[0])}
        />
      </label>
      {fileName ? <p className="file-name">{fileName}</p> : null}
      {result ? (
        <div className="import-result">
          <div className="import-metrics">
            <Metric label="可預覽列數" value={result.rows.length} />
            <Metric label="錯誤數" value={result.errors.length} />
          </div>
          {result.errors.length > 0 ? (
            <ul className="import-errors">
              {result.errors.slice(0, 8).map((error, index) => (
                <li key={`${error.row}-${error.code}-${index}`}>
                  第 {error.row} 列：{error.message}
                </li>
              ))}
            </ul>
          ) : (
            <p className="success-note">預覽通過；目前不會寫入資料庫，請待正式匯入 RPC 接通後再確認發布。</p>
          )}
        </div>
      ) : null}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
