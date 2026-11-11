# Lumi 研究原型：線上版設定說明

線上版放在 GitHub Pages，受測者不需要任何帳號；作答資料存進研究者自己的 Google 試算表。

## 一、建立資料後端（Google 試算表＋Apps Script，約 10 分鐘）

1. 到 Google 雲端硬碟新增一份空白試算表，命名例如「Lumi 前測資料」。
2. 試算表上方選單：**擴充功能 → Apps Script**。
3. 把編輯器裡原本的程式碼全部刪掉，貼上本資料夾的 `Code.gs` 全部內容，按儲存。
4. 設定研究者密碼：左側齒輪 **專案設定 → 指令碼屬性 → 新增指令碼屬性**
   - 屬性：`ADMIN_SECRET`
   - 值：自訂一組研究者密碼（建議 10 個字元以上，不要用常用密碼）
5. 右上角 **部署 → 新增部署作業**：
   - 類型：網頁應用程式
   - 執行身分：**我**
   - 存取權：**所有人**
   - 按「部署」，依指示授權（會出現「Google 尚未驗證這個應用程式」，選「進階 → 前往（不安全）」，這是你自己的程式）。
6. 複製產生的 **網頁應用程式網址**（以 `https://script.google.com/macros/s/` 開頭、`/exec` 結尾）。

## 二、把網址填進網站

編輯 `config.js`，把網址貼在引號中：

```js
window.LUMI_REMOTE_URL = 'https://script.google.com/macros/s/……/exec';
```

## 三、開啟 GitHub Pages

GitHub repo → **Settings → Pages → Build and deployment**：
- Source：Deploy from a branch
- Branch：`main`，資料夾 `/ (root)` → Save

約 1～2 分鐘後網址為：`https://jaypeng123.github.io/lumi_travel_assistant/（私人專案需付費方案才能用 GitHub Pages，建議改用 Vercel）`

## 使用方式

- **研究者**：在登入頁切到「研究者」，輸入上面設定的 `ADMIN_SECRET`。可新增受測者、看前測摘要、匯出 CSV。
- **受測者**：輸入研究者給的編號與通行碼。每位受測者只能讀寫自己的資料。
- **教授試用**：編號 `test`、通行碼 `1234`，不會儲存任何資料。
- 原始資料可直接在試算表的「kv」工作表查看（每位受測者一列，JSON 格式）；分析請用後台的「匯出 CSV」。

## 注意

- 修改 `Code.gs` 後要再按「部署 → 管理部署作業 → 編輯 → 新版本」才會生效，網址不變。
- 研究者密碼不要寫進 GitHub 上的任何檔案。
