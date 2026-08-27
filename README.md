# 臺北市立陽明高級中學 115學年度防災應變任務查詢系統

本專案包含兩種部署方式：

- GitHub Pages 靜態網站：`index.html` + `staff-data.js`
- Google 試算表側邊欄：`Code.gs` + `Sidebar.html`

目前資料由「北市立陽明高級中學115學年度緊急應變小組分組表.xlsx」產生，共 192 筆任務指派、177 位不重複姓名；同一人可能有多項任務。

## GitHub Pages

1. 建立新的 GitHub Repository（若含真實教職員名冊，請先依校方個資政策決定使用公開或私有存放庫）。
2. 將 `index.html` 與 `staff-data.js` 放在 Repository 根目錄。
3. 到 **Settings → Pages**，選擇由 `main` 分支根目錄部署。
4. 等待 GitHub Pages 完成發布。

本機預覽可在專案目錄執行：

```powershell
python -m http.server 8000
```

再開啟 `http://localhost:8000/`。

## 更新靜態網站名冊

Excel 分頁名稱與欄位保持不變時，執行：

```powershell
python scripts/build_data.py "北市立陽明高級中學115學年度緊急應變小組分組表.xlsx"
```

接著重新提交產生的 `staff-data.js`。

## Google Apps Script

1. 將 Excel 匯入 Google 試算表，並確認分頁名稱為：`應變小組主表`、`附表一_高中專任`、`附表二_國高中導師`、`附表三_國中專任`。
2. 開啟 **擴充功能 → Apps Script**。
3. 將 `Code.gs` 貼入預設程式檔。
4. 新增 HTML 檔案 `Sidebar`，貼入 `Sidebar.html`。
5. 儲存並重新整理試算表；使用 **🚨 防災特攻隊 → 🔍 查詢我的應變任務**。
6. 第一次使用時，依 Google 提示授權腳本存取目前試算表。

Apps Script 會固定查詢上述四個分頁，不受使用者目前所在分頁影響。

## 資料與安全

- 查詢介面只接受至少 2 個字，避免一鍵列出全名冊。
- GitHub Pages 為純靜態網站，`staff-data.js` 的內容仍可被網站訪客下載；若資料不可公開，請勿部署至公開 Pages，改用校內權限控管的 Google 試算表側邊欄。
- 頁面輸出使用 DOM `textContent`，不直接插入名冊中的 HTML，以降低內容注入風險。
