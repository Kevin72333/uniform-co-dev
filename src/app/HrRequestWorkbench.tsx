"use client";

import { useMemo, useState } from "react";
import {
  HrRequestValidationError,
  summarizeHrRequest,
  type EmployeeSnapshot,
  type IssueLineDraft,
  type UniformItemSnapshot,
} from "@/src/domain/hr-request";

type LineState = {
  lineId: string;
  employeeId: string;
  itemId: string;
  quantity: number;
};

const employees: EmployeeSnapshot[] = [
  {
    employeeId: "employee-1",
    employeeNo: "E001",
    employeeName: "測試員工一",
    institutionCode: "ABC",
    institutionName: "ABC 機構",
    departmentCode: "A",
    departmentName: "A 部門",
  },
  {
    employeeId: "employee-2",
    employeeNo: "E002",
    employeeName: "測試員工二",
    institutionCode: "ABD",
    institutionName: "ABD 機構",
    departmentCode: "B",
    departmentName: "B 部門",
  },
];

const items: UniformItemSnapshot[] = [
  {
    itemId: "item-m",
    itemCode: "U-M",
    itemName: "測試上衣",
    size: "M",
    unit: "件",
    hrOnHand: 10,
    generalOnHand: 5,
    activeReserved: 0,
  },
  {
    itemId: "item-l",
    itemCode: "U-L",
    itemName: "測試長褲",
    size: "L",
    unit: "件",
    hrOnHand: 20,
    generalOnHand: 100,
    activeReserved: 0,
  },
];

const initialLines: LineState[] = [
  { lineId: "line-1", employeeId: "employee-1", itemId: "item-m", quantity: 10 },
];

export default function HrRequestWorkbench() {
  const [lines, setLines] = useState<LineState[]>(initialLines);
  const [increases, setIncreases] = useState<Record<string, number>>({
    "item-m": 0,
    "item-l": 0,
  });

  const result = useMemo(() => {
    try {
      const issueLines: IssueLineDraft[] = lines.map((line) => ({
        ...line,
        employee: employees.find((employee) => employee.employeeId === line.employeeId)!,
        item: items.find((item) => item.itemId === line.itemId)!,
      }));
      const increaseLines = items.map((item) => ({
        item,
        quantity: increases[item.itemId] ?? 0,
      }));
      return {
        summary: summarizeHrRequest(issueLines, increaseLines),
        error: "",
      };
    } catch (error) {
      return {
        summary: null,
        error:
          error instanceof HrRequestValidationError ? error.message : "需求單資料無法檢查",
      };
    }
  }, [increases, lines]);

  function updateLine(lineId: string, field: keyof Omit<LineState, "lineId">, value: string) {
    setLines((current) =>
      current.map((line) =>
        line.lineId === lineId
          ? { ...line, [field]: field === "quantity" ? Number(value) || 0 : value }
          : line,
      ),
    );
  }

  function addLine() {
    const nextId = `line-${lines.length + 1}-${Date.now()}`;
    setLines((current) => [
      ...current,
      { lineId: nextId, employeeId: employees[0].employeeId, itemId: items[1].itemId, quantity: 1 },
    ]);
  }

  function removeLine(lineId: string) {
    setLines((current) => current.filter((line) => line.lineId !== lineId));
  }

  return (
    <section className="request-workbench" aria-label="人資需求單明細預覽">
      <div className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">03 / HR REQUEST</p>
            <h2>員工明細與增庫</h2>
          </div>
          <span className="status-pill">測試資料預覽</span>
        </div>

        <div className="request-table" role="table" aria-label="發放明細">
          <div className="request-table-row request-table-header" role="row">
            <span>員工／機構</span>
            <span>制服品號</span>
            <span>發放量 F</span>
            <span aria-hidden="true" />
          </div>
          {lines.map((line) => (
            <div className="request-table-row" role="row" key={line.lineId}>
              <label className="field">
                <span className="sr-only">員工</span>
                <select
                  value={line.employeeId}
                  onChange={(event) => updateLine(line.lineId, "employeeId", event.target.value)}
                >
                  {employees.map((employee) => (
                    <option key={employee.employeeId} value={employee.employeeId}>
                      {employee.employeeNo}｜{employee.employeeName}（{employee.institutionCode}/
                      {employee.departmentCode}）
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="sr-only">制服品號</span>
                <select
                  value={line.itemId}
                  onChange={(event) => updateLine(line.lineId, "itemId", event.target.value)}
                >
                  {items.map((item) => (
                    <option key={item.itemId} value={item.itemId}>
                      {item.itemCode}｜{item.itemName}（{item.size || "不分尺寸"}）
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="sr-only">發放量</span>
                <input
                  min={1}
                  step={1}
                  type="number"
                  value={line.quantity}
                  onChange={(event) => updateLine(line.lineId, "quantity", event.target.value)}
                />
              </label>
              <button className="text-button" type="button" onClick={() => removeLine(line.lineId)}>
                移除
              </button>
            </div>
          ))}
        </div>

        <button className="secondary-button" type="button" onClick={addLine}>
          ＋新增員工明細
        </button>

        <div className="increase-list">
          <div className="subheading">
            <h3>品號彙總增庫量 I</h3>
            <span>尺寸選填；庫存按品號獨立計算</span>
          </div>
          {items.map((item) => (
            <label className="increase-row" key={item.itemId}>
              <span>
                {item.itemCode}｜{item.itemName}（{item.size || "不分尺寸"}）
                <small>
                  人資倉 {item.hrOnHand} ／總倉 {item.generalOnHand}／有效預留 {item.activeReserved}
                </small>
              </span>
              <input
                min={0}
                step={1}
                type="number"
                value={increases[item.itemId] ?? 0}
                onChange={(event) =>
                  setIncreases((current) => ({
                    ...current,
                    [item.itemId]: Number(event.target.value) || 0,
                  }))
                }
                aria-label={`${item.itemCode} 增庫量`}
              />
            </label>
          ))}
        </div>
      </div>

      <div className="panel result-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">04 / ITEM SUMMARY</p>
            <h2>送出前品號檢查</h2>
          </div>
          <div className="heading-actions">
            <span className={`status-pill ${result.error ? "danger" : "success"}`}>
              {result.error ? "不可送出" : "可送出預覽"}
            </span>
            <button className="secondary-button print-button" type="button" onClick={() => window.print()}>
              列印 A4 預覽
            </button>
          </div>
        </div>
        {result.error ? (
          <div className="error-box" role="alert">
            <strong>這張需求單需要修正</strong>
            <span>{result.error}</span>
          </div>
        ) : (
          <>
            <div className="metric-grid">
              <Metric label="發放總量 F" value={result.summary?.totalIssueQuantity ?? 0} />
              <Metric label="增庫總量 I" value={result.summary?.totalIncreaseQuantity ?? 0} />
              <Metric
                label="合計調庫需求 R"
                value={result.summary?.totalRequestedTransferQuantity ?? 0}
              />
            </div>
            <div className="summary-list">
              {result.summary?.summaries.map((summary) => (
                <div className="summary-row" key={summary.item.itemId}>
                  <span>
                    <strong>{summary.item.itemCode}</strong>
                    <small>
                      {summary.item.itemName}／{summary.item.size || "不分尺寸"}
                    </small>
                  </span>
                  <span>F {summary.issueQuantity} ＋ I {summary.increaseQuantity}</span>
                  <strong>
                    R {summary.requestedTransferQuantity}／可用 {summary.availableToRequest}
                  </strong>
                </div>
              ))}
            </div>
            <p className="success-note">
              這是測試資料的送出前預覽；正式送單仍須透過 Supabase `submit_hr_request` RPC，再次鎖定品號、重算兩倉合計並建立預留。
            </p>
          </>
        )}
      </div>
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
