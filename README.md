# Lumi 研究原型：用 Vercel 發布（受測者免帳號）

這個專案就是完整的線上版：
- `index.html`：原型
- `api/kv.js`：存取作答資料的 API（資料存在 Vercel 連結的 Redis 資料庫）
- `config.js`：資料後端位置（Vercel 版保持 `/api/kv`，不用改）

## 發布步驟（全部在 Vercel 網站上點選，約 5 分鐘）

1. 到 https://vercel.com ，用 **GitHub 帳號登入**。
2. **Add New… → Project**，選 `Jaypeng123/lumi_travel_assistant` → **Import**。
3. 匯入設定頁：
   - **Framework Preset**：Other（Root Directory 保持預設，不用改）
   - 展開 **Environment Variables**，新增一筆：`ADMIN_SECRET` ＝ 你自訂的研究者密碼
   - 按 **Deploy**
4. 部署完成後，到專案的 **Storage** 分頁 → **Create Database** → 選 **Upstash for Redis**（Marketplace，免費方案即可）→ 建立後選擇 **Connect to Project**，連到這個專案。
5. 到 **Deployments** → 最新一次右邊「⋯」→ **Redeploy**（讓資料庫的設定生效）。

完成後，Vercel 給的網址（例如 `https://lumi-travel-assistant.vercel.app`）就是給受測者的連結。

## 使用方式

- **研究者**：登入頁切到「研究者」，輸入 `ADMIN_SECRET`。可新增受測者、看前測摘要、匯出 CSV。
- **受測者**：輸入研究者給的編號與通行碼，不需要任何帳號。每位受測者只能讀寫自己的資料。
- **教授試用**：編號 `test`、通行碼 `1234`，不會儲存任何資料。

## 常見問題

- 研究者登入顯示「目前無法連線到資料儲存」：通常是第 4 步的 Redis 還沒連結，或連結後沒有 Redeploy；也請確認 `ADMIN_SECRET` 已設定。
- 研究者密碼不要寫進 GitHub 上的任何檔案，只放在 Vercel 的環境變數。

（若想改用 Google 試算表存資料，見 `apps-script/README.md`。）
