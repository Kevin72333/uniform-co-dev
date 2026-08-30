# 管理清單介面

## 目的

`ManagementCatalogTable` 是商品、組織與員工主檔共用的管理清單 module。它把欄位顯示、資料密度、每頁筆數、目前範圍、首末頁導覽、排序表頭與空狀態集中在同一個 interface；各業務清單只提供欄位定義、已篩選排序的資料列及逐列操作。

這個模式參考 SPSV29 的欄位設定與大型清單操作，但不移植其全域狀態或直接刪除流程。資料載入、RLS、匯出稽核、編輯表單與停用 RPC 仍留在原本的 product／organization／employee module。

## Interface

呼叫端提供：

- 穩定的清單名稱、row key 與欄位 id。
- 每個欄位的顯示名稱、cell renderer、可選排序 key、預設可見性與是否固定。
- 已完成業務篩選與排序的 rows。
- 目前頁碼、頁碼變更 callback、排序狀態與排序 callback。
- 空資料訊息，以及可選的每頁筆數設定與 table class。

module 內部負責：

- `10／20／25／50／100` 等呼叫端核准的每頁筆數選項。
- 第一頁、上一頁、下一頁、最後頁與 `第 n–m 筆／共 x 筆` 範圍。
- 舒適／緊湊列高切換。
- 欄位顯示 popover、全部顯示、恢復預設及固定欄位保護。
- sticky table header、ARIA sort 狀態與窄螢幕控制列重排。

純計算 interface 位於 `src/domain/management-catalog.ts`，涵蓋 page window、page size normalization 與欄位可見性。React implementation 位於 `src/app/ManagementCatalogTable.tsx`。

## 套用範圍

| 清單 | 固定欄位 | 額外能力 |
| --- | --- | --- |
| 商品 | 品號、功能 | 分類／狀態篩選、供應商 MOQ、20 筆預設分頁 |
| 組織 | 代碼、功能 | 機構／部門類型、所屬機構、啟用狀態 |
| 員工 | 工號、功能 | 機構／狀態篩選、稽核匯出；離職日與備註可由欄位設定顯示 |

## 不變條件

1. 欄位顯示與密度只改畫面，不改查詢、匯出集合、RLS 或資料庫內容。
2. 至少保留一個欄位；固定識別欄與功能欄不能隱藏。
3. 篩選變更由呼叫端回到第一頁；page window 對超出範圍的頁碼 fail-safe clamp。
4. 不提供沒有受保護 bulk RPC 的批次停用或刪除。商品／組織／員工仍逐筆進入既有確認表單。
5. 員工匯出維持「目前完整篩選結果」，不因畫面每頁筆數或隱藏欄位改變；匯出前仍須完成 metadata 稽核。

## 驗證

`src/domain/management-catalog.test.ts` 固定分頁範圍、核准 page size、未知欄位排除、固定欄位與至少一欄可見。介面修改另需執行 lint、typecheck、build，並以有正式資料的登入 session 檢查三個清單的欄位設定、密度、每頁筆數及首末頁操作。
