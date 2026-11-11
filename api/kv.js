// Lumi 研究原型的資料 API（Vercel Serverless Function）
// 資料存在 Vercel 連結的 Upstash Redis（Vercel → Storage → Upstash for Redis）。
// 需要的環境變數：
//   ADMIN_SECRET                    研究者密碼（自訂）
//   KV_REST_API_URL / KV_REST_API_TOKEN   建立 Redis 並連結專案後，Vercel 會自動加入
//   （或 UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN）
// 規則與 Google Apps Script 版相同：
//   - 受測者只能用自己的編號＋通行碼讀寫自己的那一筆，且不能改編號、通行碼、組別、順序。
//   - 研究者用 ADMIN_SECRET 才能列出、新增、刪除。
// 連結資料庫時若改了變數前綴（例如 STORAGE_），也能自動找到
function findEnv(suffixes) {
  for (const k of Object.keys(process.env)) for (const s of suffixes) if (k.endsWith(s) && process.env[k]) return process.env[k];
  return '';
}
const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || findEnv(['_REST_API_URL', 'REDIS_REST_URL']);
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || findEnv(['_REST_API_TOKEN', 'REDIS_REST_TOKEN']);
const SECRET = process.env.ADMIN_SECRET || '';
const NS = 'lumi:';
const INDEX = NS + '__keys';

// 若資料庫只提供 redis:// 連線字串（例如選了 Vercel 的「Redis」而非 Upstash），改用 TCP 連線
const TCP_URL = process.env.REDIS_URL || process.env.KV_URL || findEnv(['_REDIS_URL', 'REDIS_URL']);
let tcp = null;
async function redis(cmd) {
  if (URL_ && TOKEN) {
    const r = await fetch(URL_, { method: 'POST', headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify(cmd) });
    const j = await r.json();
    if (j.error) throw new Error(j.error);
    return j.result;
  }
  if (!tcp) { const Redis = require('ioredis'); tcp = new Redis(TCP_URL, { maxRetriesPerRequest: 2, lazyConnect: false }); }
  return tcp.call(cmd[0], ...cmd.slice(1));
}
// 只回報與儲存相關的變數「名稱」，不回報內容，方便排除設定問題
const envNames = () => Object.keys(process.env).filter(k => /REDIS|KV_|UPSTASH|STORAGE|ADMIN_SECRET/.test(k)).sort();
const isAdmin = s => !!SECRET && String(s || '') === SECRET;
const parse = v => { try { return v ? JSON.parse(v) : null; } catch { return null; } };

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const send = o => res.status(200).json(o);
  if (!(URL_ && TOKEN) && !TCP_URL) return send({ ok: false, error: 'storage_not_configured', env: envNames() });
  if (!SECRET) return send({ ok: false, error: 'admin_secret_not_set', env: envNames() });
  try {
    if (req.method === 'GET') {
      const p = req.query || {};
      if (p.action === 'ping') { await redis(['PING']); return send({ ok: true, storage: 'connected', via: URL_ && TOKEN ? 'rest' : 'tcp' }); }
      if (p.action === 'get') {
        const k = String(p.key || '');
        const val = parse(await redis(['GET', NS + k]));
        if (k === 'config/study' || isAdmin(p.secret)) return send({ ok: true, data: val });
        if (k.startsWith('participants/')) {
          if (!val) return send({ ok: true, data: null });
          return String(val.pin) === String(p.pin || '') ? send({ ok: true, data: val }) : send({ ok: false, error: 'auth' });
        }
        return send({ ok: false, error: 'auth' });
      }
      if (p.action === 'list') {
        if (!isAdmin(p.secret)) return send({ ok: false, error: 'auth' });
        const pre = String(p.prefix || '');
        const keys = ((await redis(['SMEMBERS', INDEX])) || []).filter(k => k.startsWith(pre));
        if (!keys.length) return send({ ok: true, data: [] });
        const vals = await redis(['MGET', ...keys.map(k => NS + k)]);
        return send({ ok: true, data: vals.map(parse).filter(Boolean) });
      }
      return send({ ok: false, error: 'bad_action' });
    }
    if (req.method === 'POST') {
      const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const k = String(b.key || '');
      if (b.action === 'set') {
        let allowed = isAdmin(b.secret);
        if (!allowed && k.startsWith('participants/')) {
          const cur = parse(await redis(['GET', NS + k]));
          const v = b.value || {};
          allowed = !!cur && String(cur.pin) === String(v.pin) && cur.pid === v.pid && cur.mode === v.mode && cur.order === v.order;
        }
        if (!allowed) return send({ ok: false, error: 'auth' });
        await redis(['SET', NS + k, JSON.stringify(b.value)]);
        await redis(['SADD', INDEX, k]);
        return send({ ok: true });
      }
      if (b.action === 'del') {
        if (!isAdmin(b.secret)) return send({ ok: false, error: 'auth' });
        await redis(['DEL', NS + k]);
        await redis(['SREM', INDEX, k]);
        return send({ ok: true });
      }
      return send({ ok: false, error: 'bad_action' });
    }
    res.status(405).json({ ok: false, error: 'method' });
  } catch (e) {
    send({ ok: false, error: String(e.message || e) });
  }
};
