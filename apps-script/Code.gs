/**
 * Lumi 研究原型的資料後端（Google Apps Script + Google 試算表）
 *
 * 每筆資料存成試算表「kv」工作表的一列：A 欄 key、B 欄更新時間、C 欄起為 JSON（過長時自動切成多欄）。
 * - 受測者只能用自己的編號＋通行碼讀寫自己的那一筆。
 * - 研究者以「指令碼屬性」ADMIN_SECRET 中設定的研究者密碼，才能列出、新增、刪除資料。
 * 設定步驟請見同資料夾的 README.md。
 */
const SHEET_NAME = 'kv';
const CHUNK = 45000; // 單一儲存格上限約 5 萬字元，保守切段

function sheet_() {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) { sh = ss.insertSheet(SHEET_NAME); sh.appendRow(['key', 'updatedAt', 'json']); sh.setFrozenRows(1); }
  return sh;
}
function secret_() { return PropertiesService.getScriptProperties().getProperty('ADMIN_SECRET') || ''; }
function isAdmin_(s) { const k = secret_(); return !!k && String(s || '') === k; }
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

function readAll_() {
  const sh = sheet_();
  const v = sh.getDataRange().getValues();
  const m = {};
  for (let i = 1; i < v.length; i++) {
    const key = v[i][0];
    if (!key) continue;
    const json = v[i].slice(2).filter(function (c) { return c !== '' && c !== null; }).join('');
    m[key] = { row: i + 1, json: json };
  }
  return m;
}
function parse_(r) { try { return r ? JSON.parse(r.json) : null; } catch (e) { return null; } }

function doGet(e) {
  const p = (e && e.parameter) || {};
  try {
    if (p.action === 'ping') return out_({ ok: true });
    const m = readAll_();
    if (p.action === 'get') {
      const k = String(p.key || '');
      const val = parse_(m[k]);
      if (k === 'config/study' || isAdmin_(p.secret)) return out_({ ok: true, data: val });
      if (k.indexOf('participants/') === 0) {
        if (!val) return out_({ ok: true, data: null });
        if (String(val.pin) === String(p.pin || '')) return out_({ ok: true, data: val });
        return out_({ ok: false, error: 'auth' });
      }
      return out_({ ok: false, error: 'auth' });
    }
    if (p.action === 'list') {
      if (!isAdmin_(p.secret)) return out_({ ok: false, error: 'auth' });
      const pre = String(p.prefix || '');
      const data = Object.keys(m).filter(function (k) { return k.indexOf(pre) === 0; }).map(function (k) { return parse_(m[k]); }).filter(Boolean);
      return out_({ ok: true, data: data });
    }
    return out_({ ok: false, error: 'bad_action' });
  } catch (err) {
    return out_({ ok: false, error: String(err) });
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const b = JSON.parse(e.postData.contents);
    const sh = sheet_();
    const m = readAll_();
    const k = String(b.key || '');
    const r = m[k];
    if (b.action === 'set') {
      let allowed = isAdmin_(b.secret);
      // 受測者只能更新自己的那一筆，且不能改編號、通行碼、組別與順序
      if (!allowed && k.indexOf('participants/') === 0 && r) {
        const cur = parse_(r) || {};
        const v = b.value || {};
        allowed = String(cur.pin) === String(v.pin) && cur.pid === v.pid && cur.mode === v.mode && cur.order === v.order;
      }
      if (!allowed) return out_({ ok: false, error: 'auth' });
      const json = JSON.stringify(b.value);
      const parts = [];
      for (let i = 0; i < json.length; i += CHUNK) parts.push(json.slice(i, i + CHUNK));
      const row = [k, new Date()].concat(parts);
      if (r) {
        const last = Math.max(sh.getLastColumn(), row.length);
        sh.getRange(r.row, 1, 1, last).clearContent();
        sh.getRange(r.row, 1, 1, row.length).setValues([row]);
      } else {
        sh.appendRow(row);
      }
      return out_({ ok: true });
    }
    if (b.action === 'del') {
      if (!isAdmin_(b.secret)) return out_({ ok: false, error: 'auth' });
      if (r) sh.deleteRow(r.row);
      return out_({ ok: true });
    }
    return out_({ ok: false, error: 'bad_action' });
  } catch (err) {
    return out_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}
