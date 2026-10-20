# 校園安全共用試算表儲存

指定試算表：
https://docs.google.com/spreadsheets/d/1kBAX215x-DrpNr9UYQLfTS2lmf_nVUK2c13gKuN5Jsc/edit

綁定的 Apps Script 專案：
https://script.google.com/u/0/home/projects/1RcXbol0_ZWC2KznAUqiYe5fGqnGEZt4pOzb5w2rBAkHhuLKGYCPoHbli/edit

## 首次啟用

1. 從指定試算表的「擴充功能 → Apps Script」開啟專案。`Code.gs` 已提供完整程式。
2. 執行 `install`，完成 Google 授權。回到該次執行所開啟的試算表視窗，輸入原先的管理密碼並確認。若看不到視窗，從自己的瀏覽器開啟上述專案重新執行 `install`，再回到同一瀏覽器的試算表。
3. 程式會建立「校園安全圖釘」與「操作紀錄」分頁，保留原有「工作表1」及其他資料。密碼僅以加鹽雜湊存於 Apps Script 的指令碼屬性，不寫入工作表或網站原始碼。
4. 按「部署 → 新增部署作業 → 網頁應用程式」，執行身分選自己，存取權選「任何人」。這只開放 API 入口；讀寫資料仍須先登入，刪除與清除另須再次驗證密碼。不必公開共用試算表。
5. 複製 `/exec` 網址，於網站「連接共用試算表」貼上並輸入管理密碼。
6. 在原本有圖釘的瀏覽器連接後，按「匯入原本機圖釘」。這是新增匯入，不會覆蓋其他人的資料；重複匯入會建立重複圖釘。

## 日常使用

- 連接後新增、移動與「儲存改善紀錄」皆會逐枚同步；上方顯示「已同步至共用試算表」才代表服務已確認寫入。
- 每個瀏覽器分頁第一次使用需輸入密碼。登入憑證只存於該分頁工作階段；伺服器最長保留六小時，快取失效時可重新登入。
- 按「載入最新資料」讀取其他同仁的變更。多人同時修改同一枚圖釘會阻擋舊版本，不會整張覆蓋。
- 網路異常時未同步資料留在本機，可按「重試同步」。若有修改衝突，可按「載入最新資料」，確認後會先下載本機備份再採用共用版本。
- 刪除在伺服器端驗證密碼，採用註記刪除；原圖釘及快照留在試算表，舊版資料不能重新上傳把已刪除圖釘復活。
- 未連線時，既有的本機儲存與本機刪除保護照常運作，並不代表共用資料已被修改。
- 請避免直接改動「圖釘ID」「版本」「完整資料」等儲存欄位；日常編輯請使用網站。

## 測試

```
node --test campus-safety-dashboard/tests/gas.test.cjs
node campus-safety-dashboard/tests/browser.test.cjs
```

測試涵蓋登入、增改、版本衝突、請求重試、刪除驗證、註記刪除、試算表公式注入防護，以及瀏覽器中的本機備份、共用匯入、離線重試與跨尺寸版面。瀏覽器測試使用隔離的模擬 GAS，不會寫入正式試算表。正式部署後須另外確認登入與實際試算表寫入。

Google 官方部署說明： https://developers.google.com/apps-script/guides/web

## 部署網址

網站已預設以下部署入口，通常不需手動貼上：

https://script.google.com/macros/s/AKfycbxZFerWiAtXAOqol8-NsqKDtTnDoLE_fdBkSmmw4v6q6HQkZK-OuU5OlUnTL7H_WiQtUg/exec
