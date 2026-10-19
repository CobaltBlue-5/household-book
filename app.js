/* 家計簿 — 外部サービスに依存しない、スマホ内保存のPWA */
'use strict';

/* 予期しないエラーは画面上部に表示する（原因を突き止めるため） */
window.addEventListener('error', e => showErr(e.message + (e.lineno ? ` (${e.lineno}行目)` : '')));
window.addEventListener('unhandledrejection', e => showErr(String(e.reason && e.reason.message || e.reason)));
function showErr(msg) {
  let el = document.getElementById('errbar');
  if (!el) {
    el = document.createElement('div'); el.id = 'errbar';
    el.style.cssText = 'position:fixed;left:8px;right:8px;top:8px;z-index:99;background:#fff;color:#111;border:3px solid #111;padding:10px 12px;font:12px/1.5 sans-serif;white-space:pre-wrap';
    el.onclick = () => el.remove();
    document.body.appendChild(el);
  }
  el.textContent = 'エラー（タップで閉じる）\n' + msg + '\n' + (() => { try { return 'バージョン ' + APP_VERSION; } catch (_) { return ''; } })() + ' / ' + navigator.userAgent;
}

const APP_VERSION = '1.4.1';
const EXP_CATS = ['食費', '日用品', '交通', '趣味', '交際', '美容', '固定費', '医療', 'その他'];
const INC_CATS = ['給料', '副業', '臨時収入', 'その他'];
const BACKUP_REMIND_DAYS = 14;
const UNCAT = '未分類';
const CARD_SYNC_MIN = 5; // 自動同期の最短間隔（分）

/* 店名 → カテゴリの初期ルール（上から順に判定。直した店は学習して優先） */
const RULES = [
  ['医療', ['病院', 'クリニック', '医院', '歯科', '調剤', '眼科', '皮膚科', '内科', '整骨', '接骨']],
  ['固定費', ['電力', 'でんき', '東京ガス', '大阪ガス', '広島ガス', 'ガス料金', 'プロパン', '水道', 'NTT', 'ドコモ', 'DOCOMO', 'AHAMO', 'KDDI', 'UQ', 'ソフトバンク', 'SOFTBANK', 'Y!MOBILE', 'ワイモバイル', '楽天モバイル', 'POVO', 'LINEMO', '保険', '家賃', 'NHK']],
  ['交通', ['JR', '鉄道', '電鉄', '交通', '広電', 'バス', 'タクシー', 'TAXI', 'SUICA', 'ICOCA', 'PASMO', 'PITAPA', 'ENEOS', 'エネオス', '出光', 'IDEMITSU', 'コスモ石油', 'ガソリン', '駐車', 'パーキング', 'PARKING', 'TIMES', 'タイムズ', 'ANA', 'JAL', '新幹線', 'EXPRESS', 'エクスプレス', 'ETC', '高速道路', 'NEXCO']],
  ['食費', ['セブン', '7-ELEVEN', 'SEVEN', 'ローソン', 'LAWSON', 'ファミリーマート', 'ファミマ', 'FAMILYMART', 'ミニストップ', 'ポプラ', 'デイリーヤマザキ', 'スーパー', 'フレスタ', 'ハローズ', 'エブリイ', 'マックスバリュ', 'MAXVALU', 'イオンフード', 'コープ', '生協', 'COOP', 'ゆめマート', 'ザ・ビッグ', 'マルナカ', '業務スーパー', 'ライフ', 'マクドナルド', 'MCDONALD', 'スターバックス', 'STARBUCKS', 'ドトール', 'タリーズ', 'TULLY', 'コメダ', 'すき家', '吉野家', '松屋', 'ガスト', 'サイゼリヤ', 'ジョイフル', 'ココス', 'スシロー', 'くら寿司', 'はま寿司', 'かっぱ寿司', 'ラーメン', '餃子', '丸亀', 'モスバーガー', 'バーガー', 'BURGER', 'RESTAURANT', '精肉', '鮮魚', '青果', 'ケンタッキー', 'KFC', 'ミスタードーナツ', 'UBER EATS', 'UBEREATS', '出前館', 'WOLT', 'ベーカリー', 'カフェ', 'CAFE', 'コーヒー', 'COFFEE', '食堂', 'レストラン', '弁当']],
  ['交際', ['居酒屋', '鳥貴族', '和民', '魚民', '白木屋', '笑笑', '庄や', 'BAR', 'カラオケ', 'ビッグエコー', 'まねきねこ', 'ジャンカラ', 'フラワー', 'ギフト']],
  ['趣味', ['STEAM', 'NINTENDO', '任天堂', 'PLAYSTATION', 'SONY', 'NETFLIX', 'SPOTIFY', 'HULU', 'U-NEXT', 'DAZN', 'ABEMA', 'YOUTUBE', 'KINDLE', 'AUDIBLE', '映画', 'シネマ', 'CINEMA', 'TOHO', 'イオンシネマ', '書店', '紀伊國屋', 'ジュンク', '丸善', 'TSUTAYA', '蔦屋', 'BOOKOFF', 'ブックオフ', 'ゲーム', 'アニメイト', 'ヨドバシ', 'ビックカメラ', 'エディオン', 'ケーズデンキ', 'ヤマダ', 'スポーツ', 'ゴルフ', 'ジム', 'GYM']],
  ['美容', ['美容', 'ヘアサロン', 'HAIR', 'SALON', 'サロン', 'まつげ', 'マツエク', 'ネイル', 'NAIL', 'エステ', 'ホットペッパービューティー']],
  ['日用品', ['ドラッグ', '薬局', 'マツモトキヨシ', 'マツキヨ', 'ウエルシア', 'ツルハ', 'コスモス', 'ダイレックス', 'サンドラッグ', 'スギ薬局', 'ココカラ', 'ダイソー', 'DAISO', 'セリア', 'キャンドゥ', 'ニトリ', '無印', 'MUJI', 'ユニクロ', 'UNIQLO', 'GU', 'しまむら', 'ホームセンター', 'コーナン', 'カインズ', 'DCM', 'ナフコ', 'AMAZON', 'アマゾン', '楽天', 'RAKUTEN', 'YAHOO', 'ロハコ', 'LOHACO', 'イオン', 'AEON', 'ゆめタウン', 'ドン・キホーテ', 'ドンキ', 'クリーニング']],
];
const normShop = s => String(s || '').normalize('NFKC').toUpperCase().replace(/\s+/g, ' ').trim();

/* ---------- 小道具 ---------- */
const $ = (s, r = document) => r.querySelector(s);
const pad = n => String(n).padStart(2, '0');
const yen = n => '¥' + Math.round(n).toLocaleString('ja-JP');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const ymOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
const daysIn = ym => { const [y, m] = ym.split('-').map(Number); return new Date(y, m, 0).getDate(); };
const shiftYm = (ym, k) => { const [y, m] = ym.split('-').map(Number); return ymOf(new Date(y, m - 1 + k, 1)); };
const ymLabel = ym => { const [y, m] = ym.split('-').map(Number); return `${y}年${m}月`; };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- IndexedDB ---------- */
const DB = {
  db: null,
  open() {
    return new Promise((res, rej) => {
      const r = indexedDB.open('kakeibo', 1);
      r.onupgradeneeded = () => {
        const d = r.result;
        d.createObjectStore('tx', { keyPath: 'id' });
        d.createObjectStore('kv');
      };
      r.onsuccess = () => { this.db = r.result; res(); };
      r.onerror = () => rej(r.error);
    });
  },
  run(store, mode, fn) {
    return new Promise((res, rej) => {
      const t = this.db.transaction(store, mode);
      const req = fn(t.objectStore(store));
      t.oncomplete = () => res(req ? req.result : undefined);
      t.onerror = () => rej(t.error);
      t.onabort = () => rej(t.error);
    });
  },
  allTx() { return this.run('tx', 'readonly', s => s.getAll()); },
  putTx(x) { return this.run('tx', 'readwrite', s => s.put(x)); },
  delTx(id) { return this.run('tx', 'readwrite', s => s.delete(id)); },
  replaceTx(list) {
    return this.run('tx', 'readwrite', s => { s.clear(); list.forEach(x => s.put(x)); });
  },
  get(k) { return this.run('kv', 'readonly', s => s.get(k)); },
  set(k, v) { return this.run('kv', 'readwrite', s => s.put(v, k)); },
  del(k) { return this.run('kv', 'readwrite', s => s.delete(k)); },
};

/* ---------- 状態 ---------- */
const S = {
  tx: [], budget: 0, fixed: [], lastBackup: 0, artBlob: null, artUrl: null, persisted: null,
  tab: 'home', calYm: ymOf(new Date()), calDay: ymd(new Date()), repYm: ymOf(new Date()),
  sheet: null,
  card: { url: '', lastSync: 0, seen: [], learned: {}, error: '' },
  tomb: {},   // 削除した記録・固定費の id → 削除した時刻（他の端末に削除を伝えるため）
  sync: { on: true, rev: 0, dirty: false, last: 0, error: '', budgetAt: 0 },
};

async function load() {
  await DB.open();
  S.tx = await DB.allTx();
  S.budget = (await DB.get('budget')) || 0;
  S.fixed = (await DB.get('fixed')) || [];
  S.lastBackup = (await DB.get('lastBackup')) || 0;
  S.artBlob = (await DB.get('artBlob')) || null;
  if (S.artBlob) S.artUrl = URL.createObjectURL(S.artBlob);
  S.card = Object.assign(S.card, (await DB.get('card')) || {});
  S.tomb = (await DB.get('tomb')) || {};
  S.sync = Object.assign(S.sync, (await DB.get('sync')) || {});
  if (navigator.storage && navigator.storage.persist) {
    try { S.persisted = (await navigator.storage.persisted()) || (await navigator.storage.persist()); } catch (e) { /* noop */ }
  }
}

/* 固定費の自動登録：開始月から今月まで、期日を過ぎた分を一度だけ記録 */
async function applyFixed() {
  const now = new Date(), cur = ymOf(now), today = now.getDate();
  let changed = false;
  for (const f of S.fixed) {
    f.done = f.done || [];
    if (f.pay === 'card') continue; // カード払いは明細から入るので自動記録しない
    for (let ym = f.start; ym <= cur; ym = shiftYm(ym, 1)) {
      if (f.done.includes(ym)) continue;
      const day = Math.min(f.day, daysIn(ym));
      if (ym === cur && day > today) continue;
      // 端末ごとに作っても同じ id になるので、同期で二重にならない
      const id = `fx-${f.id}-${ym}`;
      if (!S.tomb[id] && !S.tx.some(t => t.id === id)) {
        await putTx({ id, type: 'expense', amount: f.amount, cat: f.cat, date: `${ym}-${pad(day)}`, memo: f.name, fixedId: f.id, createdAt: Date.now() });
      }
      f.done.push(ym);
      changed = true;
    }
  }
  if (changed) await saveFixedList();
}

/* ---------- カード明細の自動取り込み ---------- */
/* 英字だけの短い語（AU, GU, ANA など）は単語として一致したときだけ */
function hit(n, w) {
  if (/^[A-Z0-9!.\-]+$/.test(w)) return new RegExp(`(^|[^A-Z])${w.replace(/[.!\-]/g, '\\$&')}([^A-Z]|$)`).test(n);
  return n.includes(w);
}
function classify(merchant) {
  const n = normShop(merchant);
  if (S.card.learned[n]) return S.card.learned[n];
  for (const f of S.fixed) {
    if (f.pay !== 'card' || !f.match) continue;
    if (f.match.split(/[,、，]/).map(w => normShop(w)).filter(Boolean).some(w => hit(n, w))) return f.cat;
  }
  for (const [cat, words] of RULES) if (words.some(w => hit(n, normShop(w)))) return cat;
  return UNCAT;
}
const saveCard = () => DB.set('card', S.card);
let syncing = false;
async function syncCard(force) {
  const c = S.card;
  if (!c.url || syncing || !navigator.onLine) return;
  if (!force && Date.now() - c.lastSync < CARD_SYNC_MIN * 60e3) return;
  syncing = true;
  try {
    const since = c.lastSync ? new Date(c.lastSync - 7 * 864e5).toISOString() : '';
    const u = c.url + (c.url.includes('?') ? '&' : '?') + 'since=' + encodeURIComponent(since);
    const res = await fetch(u, { cache: 'no-store' });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error === 'token' ? '合言葉（token）が一致しません' : data.error);
    const seen = new Set(c.seen);
    let added = 0, unc = 0;
    for (const it of data.items || []) {
      if (!it.id || seen.has(it.id) || !it.amount) continue;
      seen.add(it.id);
      const cat = it.amount < 0 ? (S.card.learned[normShop(it.merchant)] || 'その他') : classify(it.merchant);
      const id = 'card-' + it.id; // スマホとPCの両方で取り込んでも同じ id
      if (S.tomb[id] || S.tx.some(t => t.id === id)) continue;
      await putTx({ id, type: 'expense', amount: it.amount, cat, date: it.date, memo: it.merchant + (it.amount < 0 ? '（取消）' : ''), src: 'card', cardId: it.id, createdAt: Date.now() });
      added++; if (cat === UNCAT) unc++;
    }
    c.seen = [...seen].slice(-3000);
    c.lastSync = Date.now(); c.error = '';
    await saveCard();
    if (added) { render(); toast(`カード明細を${added}件取り込みました${unc ? `（未分類 ${unc}件）` : ''}`); }
    else if (force) toast('新しい明細はありません');
  } catch (e) {
    c.error = e.message || String(e); await saveCard();
    if (force) toast('同期できませんでした：' + c.error);
  } finally { syncing = false; if (S.tab === 'settings') render(); }
}
/* カテゴリを直したら店名を覚え、同じ店の未分類もまとめて直す */
async function learn(merchant, cat) {
  const n = normShop(merchant.replace(/（取消）$/, ''));
  if (!n || cat === UNCAT) return 0;
  S.card.learned[n] = cat; await saveCard(); markDirty();
  let k = 0;
  for (const t of S.tx) {
    if (t.src === 'card' && t.cat === UNCAT && normShop(t.memo) === n) { t.cat = cat; await putTx(t); k++; }
  }
  return k;
}
const uncats = () => sortTx(S.tx.filter(t => t.cat === UNCAT)).reverse();

/* ---------- 記録の保存（変更は他の端末にも同期される） ---------- */
async function putTx(tx) {
  tx.updatedAt = Date.now();
  const i = S.tx.findIndex(x => x.id === tx.id);
  if (i >= 0) S.tx[i] = tx; else S.tx.push(tx);
  await DB.putTx(tx); markDirty();
}
async function removeTx(id) {
  S.tx = S.tx.filter(x => x.id !== id);
  S.tomb[id] = Date.now();
  await DB.delTx(id); await DB.set('tomb', S.tomb); markDirty();
}
async function saveFixedList() { await DB.set('fixed', S.fixed); markDirty(); }
let syncTimer;
function markDirty() {
  S.sync.dirty = true; DB.set('sync', S.sync).catch(() => {});
  clearTimeout(syncTimer); syncTimer = setTimeout(() => syncData(false), 1500);
}

/* ---------- 端末間の同期（あなたのGoogleドライブの1ファイルを介して） ---------- */
const ts = x => x.updatedAt || x.createdAt || 0;
function snapshot() {
  return { v: 1, tx: S.tx, tomb: S.tomb, fixed: S.fixed, budget: { value: S.budget, at: S.sync.budgetAt || 0 },
    learned: S.card.learned, seen: S.card.seen };
}
function mergeList(a, b, tomb) {
  const m = new Map();
  for (const x of [...(a || []), ...(b || [])]) { const y = m.get(x.id); if (!y || ts(x) > ts(y)) m.set(x.id, x); }
  return [...m.values()].filter(x => !(tomb[x.id] && tomb[x.id] >= ts(x)));
}
/* 両方の内容を突き合わせ、記録ごとに新しい方を残す。削除はどちらで行っても反映 */
function mergeSnap(l, r) {
  if (!r) return l;
  const tomb = Object.assign({}, r.tomb || {});
  for (const [k, v] of Object.entries(l.tomb || {})) tomb[k] = Math.max(tomb[k] || 0, v);
  const allFixed = [...(l.fixed || []), ...(r.fixed || [])];
  const fixed = mergeList(l.fixed, r.fixed, tomb).map(f =>
    Object.assign({}, f, { done: [...new Set(allFixed.filter(x => x.id === f.id).flatMap(x => x.done || []))].sort() }));
  const lb = l.budget || { value: 0, at: 0 }, rb = r.budget || { value: 0, at: 0 };
  return { v: 1, tx: mergeList(l.tx, r.tx, tomb), tomb, fixed, budget: rb.at > lb.at ? rb : lb,
    learned: Object.assign({}, r.learned || {}, l.learned || {}),
    seen: [...new Set([...(r.seen || []), ...(l.seen || [])])].slice(-5000) };
}
function canon(d) {
  if (!d) return '';
  const byId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const keys = o => Object.keys(o || {}).sort().map(k => [k, o[k]]);
  return JSON.stringify([(d.tx || []).slice().sort(byId), keys(d.tomb), (d.fixed || []).slice().sort(byId),
    d.budget || null, keys(d.learned), (d.seen || []).slice().sort()]);
}
async function applySnap(m) {
  if (canon(m) === canon(snapshot())) return false;
  S.tx = m.tx; S.tomb = m.tomb; S.fixed = m.fixed;
  S.budget = (m.budget && m.budget.value) || 0; S.sync.budgetAt = (m.budget && m.budget.at) || 0;
  S.card.learned = m.learned || {}; S.card.seen = m.seen || [];
  await DB.replaceTx(S.tx); await DB.set('tomb', S.tomb); await DB.set('fixed', S.fixed);
  await DB.set('budget', S.budget); await saveCard();
  return true;
}
const apiUrl = (base, q) => base + (base.includes('?') ? '&' : '?') + new URLSearchParams(q).toString();
const apiErr = e => (e === 'token' ? '合言葉（token）が一致しません' : e === 'unknown action' ? 'スクリプトが古い版です（Code.gs を更新してください）' : e);
let dataSyncing = false;
async function syncData(force) {
  const url = S.card.url;
  if (!url || !S.sync.on || dataSyncing || !navigator.onLine) return;
  dataSyncing = true; clearTimeout(syncTimer);
  let changed = false;
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      const r = await (await fetch(apiUrl(url, { action: 'load', t: Date.now() }), { cache: 'no-store' })).json();
      if (!r.ok) throw new Error(apiErr(r.error));
      const merged = mergeSnap(snapshot(), r.data);
      if (await applySnap(merged)) changed = true;
      if (r.data && canon(merged) === canon(r.data)) { S.sync.rev = r.rev; S.sync.dirty = false; break; }
      const w = await (await fetch(apiUrl(url, { action: 'save' }), {
        method: 'POST', body: JSON.stringify({ action: 'save', baseRev: r.rev, data: merged }) })).json();
      if (w.ok) { S.sync.rev = w.rev; S.sync.dirty = false; break; }
      if (w.error !== 'conflict') throw new Error(apiErr(w.error));
      // 別の端末が同時に保存した → 読み直してもう一度
    }
    S.sync.last = Date.now(); S.sync.error = '';
    if (force) toast('同期しました');
  } catch (e) {
    S.sync.error = e.message || String(e);
    if (force) toast('同期できませんでした：' + S.sync.error);
  } finally {
    dataSyncing = false;
    await DB.set('sync', S.sync);
    const typing = document.activeElement && /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName);
    if ((changed || S.tab === 'settings') && !typing) render();
  }
}

/* ---------- 集計 ---------- */
const inMonth = ym => S.tx.filter(t => t.date.startsWith(ym));
function sums(list) {
  let e = 0, i = 0;
  for (const t of list) t.type === 'expense' ? (e += t.amount) : (i += t.amount);
  return { e, i };
}
function byCat(list) {
  const m = {};
  for (const t of list) if (t.type === 'expense') m[t.cat] = (m[t.cat] || 0) + t.amount;
  return Object.entries(m).sort((a, b) => b[1] - a[1]);
}
const sortTx = list => list.slice().sort((a, b) => (b.date.localeCompare(a.date)) || (b.createdAt - a.createdAt));

/* ---------- 部品 ---------- */
/* 背景の絵（設定で選んだ画像があればそれ、なければ同梱の art.jpg） */
function applyArt() {
  document.documentElement.style.setProperty('--art', `url("${S.artUrl || 'art.jpg'}")`);
}
function barsHtml(list, total) {
  if (!list.length) return '<div class="empty">まだ支出の記録がありません</div>';
  const max = list[0][1];
  return '<div class="bars">' + list.map(([c, v]) => `
    <div class="bar"><span>${esc(c)}</span><div class="track"><div class="fill" style="width:${(v / max * 100).toFixed(1)}%"></div></div>
    <span class="v">${yen(v)}${total ? `<br><small style="color:var(--mute);font-weight:400">${Math.round(v / total * 100)}%</small>` : ''}</span></div>`).join('') + '</div>';
}
function rowsHtml(list) {
  if (!list.length) return '<div class="empty">記録はありません</div>';
  return '<div class="list">' + list.map(t => {
    const [, m, d] = t.date.split('-').map(Number);
    const sign = t.type === 'income' ? '+' : '';
    const memo = t.memo ? `<small>${esc(t.memo)}</small>` : '';
    return `<button class="row" data-act="edit" data-id="${t.id}"><span class="d">${m}/${d}</span>
      <span class="c">${esc(t.cat)}${t.type === 'income' ? '<small>収入</small>' : ''}${memo}</span>
      <span class="a">${sign}${yen(t.amount)}</span></button>`;
  }).join('') + '</div>';
}
function mnav(ym, act) {
  return `<div class="blk w6 mnav"><button data-act="${act}" data-k="-1" aria-label="前の月">‹</button>
    <span class="t">${ymLabel(ym)}</span><button data-act="${act}" data-k="1" aria-label="次の月">›</button></div>`;
}

/* ---------- 画面 ---------- */
function viewHome() {
  const now = new Date(), ym = ymOf(now);
  const list = inMonth(ym), { e, i } = sums(list);
  const left = S.budget - e;
  const daysLeft = daysIn(ym) - now.getDate() + 1;
  const perDay = S.budget ? Math.max(0, left) / daysLeft : 0;
  const pct = S.budget ? Math.min(100, e / S.budget * 100) : 0;
  const net = i - e;
  const needBackup = S.tx.length > 0 && (Date.now() - S.lastBackup) > BACKUP_REMIND_DAYS * 864e5;

  let h = '';
  if (needBackup) {
    const msg = S.lastBackup ? `最後のバックアップから${Math.floor((Date.now() - S.lastBackup) / 864e5)}日` : 'まだバックアップがありません';
    h += `<div class="blk w6 ink banner"><span>${msg}</span><button data-act="backup">いま保存</button></div>`;
  }
  const un = S.tx.filter(t => t.cat === UNCAT).length;
  if (un) h += `<button class="blk w6 banner" data-act="review" style="text-align:left"><span><b>未分類 ${un}件</b>　カテゴリを選んでください</span><span class="num">→</span></button>`;
  h += S.budget
    ? `<div class="blk w4"><div class="lbl">${now.getMonth() + 1}月の残り予算</div>
        <div class="num big ${left < 0 ? 'neg' : ''}">${yen(left)}</div>
        <div class="meter"><div style="width:${pct}%"></div></div>
        <div class="sub">予算 ${yen(S.budget)} のうち ${Math.round(pct)}% 使用</div></div>`
    : `<button class="blk w4" data-act="tab" data-tab="settings" style="text-align:left"><div class="lbl">${now.getMonth() + 1}月の予算</div>
        <div class="num mid">未設定</div><div class="sub">タップして設定 →</div></button>`;
  h += `<div class="blk w2"><div class="lbl">支出</div><div class="num mid">${yen(e)}</div></div>
        <div class="blk w2"><div class="lbl">収入</div><div class="num mid">${yen(i)}</div></div>
        <div class="blk w3 ink"><div class="lbl">収支</div><div class="num mid">${net >= 0 ? '+' : '−'}${yen(Math.abs(net))}</div></div>
        <div class="blk w3"><div class="lbl">1日あたり使える額</div><div class="num mid">${S.budget ? yen(perDay) : '—'}</div>
          <div class="sub">残り${daysLeft}日</div></div>
        <div class="blk w6"><div class="lbl">カテゴリ別</div>${barsHtml(byCat(list))}</div>
        <div class="blk w6"><div class="lbl">最近の記録</div>${rowsHtml(sortTx(list).slice(0, 10))}</div>`;
  return h;
}

function viewCalendar() {
  const ym = S.calYm, [y, m] = ym.split('-').map(Number);
  const first = new Date(y, m - 1, 1).getDay(), n = daysIn(ym), todayStr = ymd(new Date());
  const daily = {};
  for (const t of inMonth(ym)) if (t.type === 'expense') daily[t.date] = (daily[t.date] || 0) + t.amount;
  let cells = '日月火水木金土'.split('').map(w => `<div class="wd">${w}</div>`).join('');
  for (let k = 0; k < first; k++) cells += '<div class="out"></div>';
  for (let d = 1; d <= n; d++) {
    const ds = `${ym}-${pad(d)}`, v = daily[ds];
    const cls = [ds === todayStr ? 'today' : '', ds === S.calDay ? 'sel' : ''].join(' ');
    cells += `<button class="${cls}" data-act="day" data-d="${ds}"><span class="dn">${d}</span><span class="dv">${v ? v.toLocaleString('ja-JP') : ''}</span></button>`;
  }
  const tail = (7 - (first + n) % 7) % 7;
  for (let k = 0; k < tail; k++) cells += '<div class="out"></div>';

  const dayList = sortTx(S.tx.filter(t => t.date === S.calDay));
  const ds = sums(dayList);
  const [, sm, sd] = S.calDay.split('-').map(Number);
  return mnav(ym, 'calnav') +
    `<div class="w6"><div class="cal">${cells}</div></div>
     <div class="blk w6"><div class="lbl">${sm}月${sd}日　支出 ${yen(ds.e)}${ds.i ? `　収入 ${yen(ds.i)}` : ''}</div>${rowsHtml(dayList)}</div>`;
}

function viewReport() {
  const ym = S.repYm, list = inMonth(ym), { e, i } = sums(list);
  const months = [];
  for (let k = 5; k >= 0; k--) { const m = shiftYm(ym, -k); months.push([m, sums(inMonth(m)).e]); }
  const max = Math.max(S.budget, ...months.map(x => x[1]), 1);
  const cols = months.map(([m, v]) => `<div class="col ${m === ym ? 'cur' : ''}"><div style="height:${(v / max * 82).toFixed(1)}%"></div>${Number(m.slice(5))}月</div>`).join('');
  const bl = S.budget ? `<div class="budget" style="bottom:calc(${(S.budget / max * 82).toFixed(1)}% * 140 / 140 + 16px)"><span>予算</span></div>` : '';
  return mnav(ym, 'repnav') +
    `<div class="blk w2"><div class="lbl">支出</div><div class="num mid">${yen(e)}</div></div>
     <div class="blk w2"><div class="lbl">収入</div><div class="num mid">${yen(i)}</div></div>
     <div class="blk w2 ink"><div class="lbl">収支</div><div class="num mid">${i - e >= 0 ? '+' : '−'}${yen(Math.abs(i - e))}</div></div>
     <div class="blk w6"><div class="lbl">カテゴリ別の割合</div>${barsHtml(byCat(list), e)}</div>
     <div class="blk w6"><div class="lbl">支出の推移（6か月）</div><div class="trend">${bl}${cols}</div></div>
     <div class="blk w6"><div class="lbl">この月の記録（${list.length}件）</div>${rowsHtml(sortTx(list))}</div>`;
}

function viewSettings() {
  const fxRow = f => `<button class="row" data-act="fixedEdit" data-id="${f.id}">
        <span class="d">${f.pay === 'card' ? 'カード' : (f.day >= 31 ? '月末' : f.day + '日')}</span><span class="c">${esc(f.name)}<small>${esc(f.cat)}</small></span>
        <span class="a">${yen(f.amount)}</span></button>`;
  const fxOther = S.fixed.filter(f => f.pay !== 'card'), fxCard = S.fixed.filter(f => f.pay === 'card');
  const fxSum = l => l.reduce((a, f) => a + f.amount, 0);
  const fixedRows = S.fixed.length
    ? `<div class="sub" style="margin:0 0 6px">毎月 合計 ${yen(fxSum(S.fixed))}（自動記録 ${yen(fxSum(fxOther))}／カード払い ${yen(fxSum(fxCard))}）</div>`
      + (fxOther.length ? `<div class="lbl" style="margin-top:10px">カード以外：毎月自動で記録</div><div class="list">${fxOther.map(fxRow).join('')}</div>` : '')
      + (fxCard.length ? `<div class="lbl" style="margin-top:14px">カード払い：明細から取り込み、自動で分類</div><div class="list">${fxCard.map(fxRow).join('')}</div>` : '')
    : '<div class="empty">登録なし</div>';
  const lb = S.lastBackup ? new Date(S.lastBackup).toLocaleDateString('ja-JP') : 'なし';
  return `
    <div class="blk w6 ink banner"><span>バージョン <b>${APP_VERSION}</b></span><button data-act="forceUpdate">最新版に更新</button></div>
    <div class="blk w6"><div class="lbl">毎月の予算</div>
      <div class="field"><input id="budgetIn" type="number" inputmode="numeric" min="0" placeholder="例 150000" value="${S.budget || ''}">
      <button class="btn solid" data-act="saveBudget">保存</button></div></div>
    <div class="blk w6"><div class="lbl">固定費</div>${fixedRows}
      <button class="btn wide" data-act="fixedNew">＋ 固定費を追加</button></div>
    <div class="blk w6"><div class="lbl">Google連携（カード明細の取り込み・PCとの同期）</div>
      <div class="field"><input id="cardUrl" type="url" placeholder="連携URL（https://script.google.com/…?token=…）" value="${esc(S.card.url)}">
      <button class="btn solid" data-act="saveCardUrl">保存</button></div>
      <div class="sub">${S.card.url ? (S.card.lastSync ? '最終同期：' + new Date(S.card.lastSync).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '未同期') : '未設定'}${S.card.error ? '　／　<b style="color:var(--ink)">エラー：' + esc(S.card.error) + '</b>' : ''}　／　覚えた店 ${Object.keys(S.card.learned).length}件</div>
      ${S.card.url ? `<label class="field" style="align-items:center;margin-top:12px;font-size:14px"><input type="checkbox" id="syncOn" ${S.sync.on ? 'checked' : ''} style="flex:none;width:22px;height:22px;border:2px solid var(--line)"> PCなど他の端末と記録を同期する</label>
      <div class="sub">${S.sync.on ? (S.sync.last ? '端末間の最終同期：' + new Date(S.sync.last).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '端末間：未同期') + (S.sync.dirty ? '（未送信の変更あり）' : '') : '端末間の同期：オフ'}${S.sync.error ? '　／　<b style="color:var(--ink)">エラー：' + esc(S.sync.error) + '</b>' : ''}</div>
      <button class="btn wide" data-act="syncNow">今すぐ同期</button>` : ''}
      <p class="note">アプリを開くたびに新しいカード利用分を取り込み、PCなど同じURLを設定した端末と記録を揃えます。記録はあなたのGoogleドライブの「kakeibo-sync.json」に保存されます。</p></div>
    <div class="blk w6"><div class="lbl">バックアップ</div>
      <div class="sub" style="margin-top:0">最終バックアップ：${lb}　／　記録 ${S.tx.length}件</div>
      <div class="btns"><button class="btn solid" data-act="backup">書き出す</button><button class="btn" data-act="restore">読み込む</button></div>
      <button class="btn wide" data-act="paste">貼り付けで読み込む</button>
      <p class="note">「書き出す」で共有メニューが開くので、Googleドライブ等に保存してください。機種変更やデータが消えたときは「読み込む」で元に戻せます。固定費のファイルも「読み込む」から追加できます。</p></div>
    <div class="blk w6"><div class="lbl">背景の絵</div>
      <div class="btns"><button class="btn" data-act="artPick">画像を選ぶ</button><button class="btn" data-act="artReset">元の絵に戻す</button></div>
      <p class="note">スマホ内の好きな画像を背景にできます。元の絵はモンドリアン「赤・青・黄のコンポジション II」（1930年）です。</p></div>
    <div class="blk w6"><div class="lbl">このアプリについて</div>
      <p class="note" style="margin-top:0">データはこのスマホの中だけに保存されます（${S.persisted ? '消去されにくい設定が有効' : '保護設定は未許可。ホーム画面に追加すると有効になりやすくなります'}）。バージョン ${APP_VERSION}</p></div>`;
}

/* ---------- 入力シート ---------- */
function pushSheet() { if (!(history.state && history.state.sheet)) history.pushState({ sheet: 1 }, ''); }
function closeSheet() {
  if (history.state && history.state.sheet) history.back(); // popstate で閉じる
  else { S.sheet = null; renderSheet(); }
}
function openTx(tx, opt = {}) {
  S.sheet = tx
    ? { kind: 'tx', step: opt.step || 1, review: !!opt.review, id: tx.id, type: tx.type, amt: String(tx.amount), cat: tx.cat, date: tx.date,
        memo: tx.memo || '', fixedId: tx.fixedId, src: tx.src, cardId: tx.cardId, createdAt: tx.createdAt }
    : { kind: 'tx', step: 1, type: 'expense', amt: '', cat: null, date: ymd(new Date()), memo: '' };
  pushSheet(); renderSheet();
}
function openFixed(f) {
  S.sheet = f
    ? { kind: 'fixed', ...f, amount: String(f.amount) }
    : { kind: 'fixed', id: null, name: '', amount: '', cat: '固定費', day: 27 };
  pushSheet(); renderSheet();
}
function sheetTx(s) {
  const amt = Number(s.amt || 0), neg = amt < 0;
  let h = `<div class="blk w4 seg"><button data-act="type" data-v="expense" class="${s.type === 'expense' ? 'on' : ''}">支出</button>
           <button data-act="type" data-v="income" class="${s.type === 'income' ? 'on' : ''}">収入</button></div>
           <button class="blk w2 close" data-act="close">閉じる</button>
           <label class="blk w6 amount"><span class="num"><span class="cur">${neg ? '−' : ''}¥</span><input id="amtIn" class="amtin" type="text" inputmode="numeric" autocomplete="off"
             value="${amt ? Math.abs(amt).toLocaleString('ja-JP') : ''}" placeholder="0" aria-label="金額"></span></label>`;
  if (s.src === 'card') h += `<div class="hint" style="color:var(--ink)">カード：${esc(s.memo)}</div>`;
  if (s.step === 1) {
    h += `<label class="blk w6 datebox"><input type="date" id="dateIn" value="${s.date}" aria-label="日付"></label>`;
    h += ['7', '8', '9', '4', '5', '6', '1', '2', '3', '00', '0', '⌫'].map(k => `<button class="key" data-act="key" data-k="${k}">${k}</button>`).join('');
    h += `<button class="next" data-act="next" ${amt ? '' : 'disabled'}>カテゴリを選ぶ →</button>`;
    if (s.id) h += `<button class="del" data-act="delTx">この記録を削除</button>`;
    h += `<div class="hint" id="dbg" style="font-size:10px;line-height:1.5;word-break:break-all"></div>`;
  } else {
    const cats = s.type === 'expense' ? EXP_CATS : INC_CATS;
    const left = s.review ? uncats().length : 0;
    h += `<div class="hint">タップで保存　・　${s.date.replace(/-/g, '/')}${left ? `　・　未分類 あと${left}件` : ''}</div>`;
    h += cats.map(c => `<button class="cat ${c === s.cat ? 'on' : ''}" data-act="pickCat" data-v="${esc(c)}">${esc(c)}</button>`).join('');
    h += s.review ? `<button class="next" data-act="close">あとで</button>` : `<button class="next" data-act="back">← 金額に戻る</button>`;
  }
  return h;
}
function sheetFixed(s) {
  const days = Array.from({ length: 28 }, (_, k) => k + 1).map(d => `<option value="${d}" ${s.day == d ? 'selected' : ''}>${d}日</option>`).join('')
    + `<option value="31" ${s.day >= 31 ? 'selected' : ''}>月末</option>`;
  return `<div class="blk w4"><div class="num mid">${s.id ? '固定費を編集' : '固定費を追加'}</div></div>
    <button class="blk w2 close" data-act="close">閉じる</button>
    <div class="blk w6"><div class="lbl">名前</div><input class="inp" id="fName" value="${esc(s.name)}" placeholder="例 家賃・スマホ代"></div>
    <div class="blk w3"><div class="lbl">金額</div><input class="inp" id="fAmt" type="number" inputmode="numeric" value="${s.amount}" placeholder="0"></div>
    <div class="blk w3"><div class="lbl">毎月</div><select class="inp" id="fDay">${days}</select></div>
    <div class="blk w6"><div class="lbl">カテゴリ</div><select class="inp" id="fCat">${EXP_CATS.map(c => `<option ${c === s.cat ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
    <div class="blk w6"><div class="lbl">支払い方法</div><select class="inp" id="fPay">
      <option value="other" ${s.pay !== 'card' ? 'selected' : ''}>カード以外（毎月この日に自動で記録）</option>
      <option value="card" ${s.pay === 'card' ? 'selected' : ''}>三井住友カード（明細から取り込み）</option></select>
      <div class="lbl" style="margin-top:12px">カード明細の店名に含まれる語（カード払いのとき）</div>
      <input class="inp" id="fMatch" value="${esc(s.match || '')}" placeholder="例 OPENAI, CHATGPT（カンマ区切り）">
      <p class="note">カード払いにすると自動記録はせず、明細の店名にこの語が入っていれば、このカテゴリに分類します。${s.id ? '記録済みの分は変わりません。' : 'カード以外の場合、今月分は指定日を過ぎていればすぐに記録されます。'}</p></div>
    <button class="next" data-act="saveFixed" style="background:var(--line);color:var(--paper);outline:2px solid var(--paper);outline-offset:-6px">保存</button>
    ${s.id ? '<button class="del" data-act="delFixed">この固定費を削除（記録済みの分は残ります）</button>' : ''}`;
}
function renderSheet() {
  const el = $('#sheet'), s = S.sheet;
  if (!s) { el.hidden = true; el.innerHTML = ''; return; }
  el.hidden = false;
  el.innerHTML = `<div class="grid">${s.kind === 'tx' ? sheetTx(s) : sheetFixed(s)}</div>`;
  showDbg();
}
/* ---- 診断：入力画面が受け取ったタッチ操作を表示（原因調査用） ---- */
const evlog = [];
function descEl(t) {
  if (!t || t.nodeType !== 1) return String(t && t.nodeName);
  const c = typeof t.className === 'string' && t.className ? '.' + t.className.trim().split(/\s+/).join('.') : '';
  return t.tagName.toLowerCase() + (t.id ? '#' + t.id : '') + c + (t.dataset && t.dataset.k ? '[' + t.dataset.k + ']' : '');
}
function showDbg() {
  const d = document.getElementById('dbg');
  if (d) d.textContent = '診断 ' + APP_VERSION + '：' + (evlog.length ? evlog.join(' ／ ') : 'まだタッチを受け取っていません');
}
['pointerdown', 'touchstart', 'mousedown', 'click'].forEach(type => document.addEventListener(type, e => {
  if (!S.sheet) return;
  evlog.push(type.replace('down', '↓').replace('start', '↓') + ' ' + descEl(e.target));
  if (evlog.length > 4) evlog.shift();
  showDbg();
}, { capture: true, passive: true }));

/* ---------- 描画 ---------- */
function render() {
  applyArt();
  const v = { home: viewHome, calendar: viewCalendar, report: viewReport, settings: viewSettings }[S.tab];
  $('#view').innerHTML = `<div class="grid">${v()}</div>`;
  document.querySelectorAll('#tabbar .tab').forEach(b => b.classList.toggle('on', b.dataset.tab === S.tab));
}
let toastTimer;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 2200);
}

/* ---------- バックアップ ---------- */
async function backup() {
  const data = { app: 'kakeibo', version: 1, exportedAt: new Date().toISOString(), budget: S.budget, fixed: S.fixed, tx: S.tx, card: { learned: S.card.learned, seen: S.card.seen, lastSync: S.card.lastSync } };
  const name = `kakeibo-backup-${ymd(new Date())}.json`;
  const text = JSON.stringify(data);
  let ok = false;
  const shareFile = new File([text], name, { type: 'text/plain' });
  if (navigator.canShare && navigator.canShare({ files: [shareFile] })) {
    try { await navigator.share({ files: [shareFile], title: name }); ok = true; }
    catch (e) { if (e.name === 'AbortError') return; }
  }
  if (!ok) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    ok = true;
  }
  S.lastBackup = Date.now(); await DB.set('lastBackup', S.lastBackup);
  toast('バックアップを書き出しました'); render();
}
async function restore(file) {
  let text = '';
  try { text = await file.text(); } catch (e) { toast('ファイルを開けませんでした'); return; }
  return restoreText(text);
}
async function restoreText(text) {
  let data;
  try { data = JSON.parse(String(text).trim().replace(/^\uFEFF/, '')); } catch (e) { toast('家計簿のファイルとして読み込めませんでした'); return; }
  if (data && data.app === 'kakeibo' && data.kind === 'fixed' && Array.isArray(data.fixed)) return importFixed(data);
  if (!data || data.app !== 'kakeibo' || !Array.isArray(data.tx)) { toast('この家計簿のバックアップではありません'); return; }
  if (!confirm(`${data.exportedAt ? new Date(data.exportedAt).toLocaleDateString('ja-JP') + ' の' : ''}バックアップ（${data.tx.length}件）で、今のデータを置き換えます。よろしいですか？`)) return;
  S.tx = data.tx; S.budget = data.budget || 0; S.fixed = data.fixed || [];
  if (data.card) { S.card.learned = data.card.learned || {}; S.card.seen = data.card.seen || []; S.card.lastSync = data.card.lastSync || 0; }
  const t0 = Date.now();
  S.tx.forEach(t => { t.updatedAt = t0; }); S.fixed.forEach(f => { f.updatedAt = t0; }); S.sync.budgetAt = t0;
  await DB.replaceTx(S.tx); await DB.set('budget', S.budget); await DB.set('fixed', S.fixed); await saveCard();
  markDirty(); await applyFixed();
  toast('バックアップから復元しました'); render();
}

/* 固定費だけのファイル：今の記録はそのままで、同じ名前のないものを追加 */
async function importFixed(data) {
  const names = new Set(S.fixed.map(f => f.name));
  const add = data.fixed.filter(f => f && f.name && f.amount > 0 && !names.has(f.name));
  if (!add.length) { toast('追加する固定費はありません（同じ名前は登録済み）'); return; }
  if (!confirm(`固定費を${add.length}件追加します。今の記録はそのまま残ります。よろしいですか？`)) return;
  const cur = ymOf(new Date());
  for (const f of add) {
    S.fixed.push({ id: uid(), name: String(f.name), amount: Math.floor(f.amount), day: Number(f.day) || 1,
      cat: EXP_CATS.includes(f.cat) ? f.cat : '固定費', pay: f.pay === 'card' ? 'card' : 'other', match: f.match || '',
      note: f.note || '', start: cur, done: [], updatedAt: Date.now() });
  }
  await saveFixedList(); await applyFixed();
  // カード払いの固定費に当てはまる未分類の明細があれば分類し直す
  for (const t of S.tx) if (t.src === 'card' && t.cat === UNCAT) { const c = classify(t.memo); if (c !== UNCAT) { t.cat = c; await putTx(t); } }
  toast(`固定費を${add.length}件追加しました`); render();
}

/* ---------- 操作 ---------- */
async function onAct(act, el) {
  const s = S.sheet;
  switch (act) {
    case 'tab': S.tab = el.dataset.tab; render(); $('#view').scrollTop = 0; break;
    case 'add': openTx(null); break;
    case 'edit': { const t = S.tx.find(x => x.id === el.dataset.id); if (t) openTx(t); break; }
    case 'close': closeSheet(); break;
    case 'review': { const u = uncats(); if (u.length) openTx(u[0], { step: 2, review: true }); break; }
    case 'saveCardUrl': {
      const v = $('#cardUrl').value.trim();
      if (v && !/^https:\/\/script\.google(usercontent)?\.com\//.test(v)) { toast('Google Apps ScriptのURLを入れてください'); return; }
      S.card.url = v; S.card.error = ''; await saveCard(); render();
      if (v) { await syncData(false); await applyFixed(); await syncCard(true); } else toast('連携を解除しました');
      break;
    }
    case 'syncNow': await syncData(true); await applyFixed(); await syncCard(false); render(); break;
    case 'type': s.type = el.dataset.v; s.cat = null; renderSheet(); break;
    case 'key': {
      const k = el.dataset.k;
      if (s.amt.startsWith('-')) s.amt = '';
      if (k === '⌫') s.amt = s.amt.slice(0, -1);
      else if (!(s.amt === '' && (k === '0' || k === '00')) && s.amt.length < 9) s.amt = (s.amt + k).slice(0, 9);
      renderSheet(); break;
    }
    case 'next': s.date = $('#dateIn').value || s.date; s.step = 2; renderSheet(); break;
    case 'back': s.step = 1; renderSheet(); break;
    case 'pickCat': {
      const tx = { id: s.id || uid(), type: s.type, amount: Number(s.amt), cat: el.dataset.v, date: s.date, memo: s.memo || '', createdAt: s.createdAt || Date.now() };
      if (s.fixedId) tx.fixedId = s.fixedId;
      if (s.src) { tx.src = s.src; tx.cardId = s.cardId; }
      const i = S.tx.findIndex(x => x.id === tx.id);
      await putTx(tx);
      const also = tx.src === 'card' ? await learn(tx.memo, tx.cat) : 0;
      let msg = `${tx.cat} ${yen(tx.amount)} を${i >= 0 ? '更新' : '記録'}しました`;
      if (also) msg = `${tx.cat}に分類（同じ店の${also}件も）`;
      const next = s.review ? uncats()[0] : null;
      if (next) { openTx(next, { step: 2, review: true }); render(); toast(msg); break; }
      closeSheet();
      S.calYm = tx.date.slice(0, 7);
      S.calDay = tx.date;
      render(); toast(msg);
      break;
    }
    case 'delTx':
      if (!confirm('この記録を削除しますか？')) return;
      await removeTx(s.id);
      closeSheet(); render(); toast('削除しました'); break;
    case 'calnav': S.calYm = shiftYm(S.calYm, +el.dataset.k); render(); break;
    case 'repnav': S.repYm = shiftYm(S.repYm, +el.dataset.k); render(); break;
    case 'day': S.calDay = el.dataset.d; render(); break;
    case 'saveBudget': {
      const v = Math.max(0, Math.floor(Number($('#budgetIn').value) || 0));
      S.budget = v; S.sync.budgetAt = Date.now(); await DB.set('budget', v); markDirty(); toast(v ? `予算を ${yen(v)} にしました` : '予算を解除しました'); render(); break;
    }
    case 'fixedNew': openFixed(null); break;
    case 'fixedEdit': { const f = S.fixed.find(x => x.id === el.dataset.id); if (f) openFixed(f); break; }
    case 'saveFixed': {
      const name = $('#fName').value.trim(), amount = Math.floor(Number($('#fAmt').value) || 0);
      if (!name || amount <= 0) { toast('名前と金額を入れてください'); return; }
      const day = Number($('#fDay').value), cat = $('#fCat').value, pay = $('#fPay').value, match = $('#fMatch').value.trim();
      if (s.id) {
        const f = S.fixed.find(x => x.id === s.id);
        if (f.pay === 'card' && pay !== 'card') { f.start = ymOf(new Date()); f.done = []; } // カード以外に切り替えたら今月から記録
        Object.assign(f, { name, amount, day, cat, pay, match, updatedAt: Date.now() });
      } else S.fixed.push({ id: uid(), name, amount, day, cat, pay, match, start: ymOf(new Date()), done: [], updatedAt: Date.now() });
      await saveFixedList(); await applyFixed();
      closeSheet(); render(); toast('固定費を保存しました'); break;
    }
    case 'delFixed':
      if (!confirm('この固定費を削除しますか？')) return;
      S.fixed = S.fixed.filter(x => x.id !== s.id); S.tomb[s.id] = Date.now(); await DB.set('tomb', S.tomb); await saveFixedList();
      closeSheet(); render(); break;
    case 'backup': await backup(); break;
    case 'forceUpdate': {
      toast('最新版を読み込んでいます…');
      try {
        if (navigator.serviceWorker) for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
        if (window.caches) for (const k of await caches.keys()) await caches.delete(k);
      } catch (_) { /* noop */ }
      location.replace(location.pathname + '?u=' + Date.now());
      break;
    }
    case 'restore': $('#importFile').click(); break;
    case 'paste': {
      let t = '';
      try { if (navigator.clipboard && navigator.clipboard.readText) t = await navigator.clipboard.readText(); } catch (_) { /* 許可されなければ手入力へ */ }
      if (!t || !t.trim().startsWith('{')) t = prompt('ファイルの中身（{ から始まる文字）を貼り付けてください') || '';
      if (t.trim()) await restoreText(t);
      break;
    }
    case 'artPick': $('#artFile').click(); break;
    case 'artReset':
      await DB.del('artBlob'); S.artBlob = null; if (S.artUrl) URL.revokeObjectURL(S.artUrl); S.artUrl = null; render(); break;
  }
}

/* 数字キー：指が触れた瞬間に反応。端末によって届くイベントが違うので複数を待ち受け、1回のタップは1回だけ数える */
const keyDone = new WeakSet();
let lastTouch = 0;
function keyPress(e) {
  const el = e.target && e.target.closest && e.target.closest('.key');
  if (!el || !S.sheet) return;
  const touchy = e.type === 'touchstart' || (e.type === 'pointerdown' && e.pointerType !== 'mouse');
  if (touchy) lastTouch = Date.now();
  // タッチの後に遅れて届くマウス互換イベントは、作り直した次のボタンに当たるので数えない
  if ((e.type === 'mousedown' || e.type === 'click') && Date.now() - lastTouch < 800) return;
  if (e.cancelable && e.type !== 'click') e.preventDefault();
  if (keyDone.has(el)) return; // 同じタップの2つ目以降のイベント（押すたびにボタンは作り直される）
  keyDone.add(el);
  if (navigator.vibrate) { try { navigator.vibrate(8); } catch (_) { /* noop */ } }
  onAct('key', el).catch(err => toast('エラー：' + err.message));
}
['pointerdown', 'touchstart', 'mousedown', 'click'].forEach(t => document.addEventListener(t, keyPress, { passive: false }));
/* 金額欄をタップしたときは、スマホの数字キーボードでも入力できる */
document.addEventListener('input', e => {
  if (e.target.id !== 'amtIn' || !S.sheet) return;
  const digits = e.target.value.replace(/[^0-9０-９]/g, '').replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0)).replace(/^0+/, '').slice(0, 9);
  S.sheet.amt = digits;
  e.target.value = digits ? Number(digits).toLocaleString('ja-JP') : '';
  const nx = document.querySelector('#sheet [data-act=next]');
  if (nx) nx.disabled = !digits;
});
/* 入力シートのボタンは、指が多少動いても離した位置が同じボタンなら押したことにする */
let press = null;
document.addEventListener('pointerdown', e => {
  const el = e.target.closest('#sheet [data-act]:not(.key)');
  press = el ? { el, x: e.clientX, y: e.clientY } : null;
});
document.addEventListener('pointerup', e => {
  if (!press) return;
  const { el, x, y } = press; press = null;
  const over = document.elementFromPoint(e.clientX, e.clientY);
  if (!over || over.closest('[data-act]') !== el || Math.hypot(e.clientX - x, e.clientY - y) > 30) return;
  el.dataset.done = '1';
  onAct(el.dataset.act, el).catch(err => { console.error(err); toast('エラー：' + err.message); });
});
document.addEventListener('pointercancel', () => { press = null; });
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act],[data-tab]');
  if (!el || el.classList.contains('key')) return;
  if (el.dataset.done) { delete el.dataset.done; return; } // pointerup で処理済み
  if (el.closest('#sheet') && e.pointerType && e.pointerType !== '') return;
  const act = el.dataset.act || 'tab';
  onAct(act, el).catch(err => { console.error(err); toast('エラー：' + err.message); });
});
document.addEventListener('change', e => {
  if (e.target.id === 'syncOn') { S.sync.on = e.target.checked; DB.set('sync', S.sync); if (S.sync.on) syncData(true); else render(); return; }
  if (e.target.id === 'dateIn' && S.sheet) S.sheet.date = e.target.value || S.sheet.date;
});
$('#importFile').addEventListener('change', async e => {
  const f = e.target.files[0]; e.target.value = '';
  if (f) await restore(f);
});
$('#artFile').addEventListener('change', async e => {
  const f = e.target.files[0]; e.target.value = '';
  if (!f) return;
  await DB.set('artBlob', f);
  S.artBlob = f; if (S.artUrl) URL.revokeObjectURL(S.artUrl); S.artUrl = URL.createObjectURL(f);
  render(); toast('アートを変更しました');
});
/* 戻るボタンで入力シートを閉じる */
window.addEventListener('popstate', () => { if (S.sheet) { S.sheet = null; renderSheet(); } });

/* 日付が変わったら固定費を再チェック */
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible') { await syncData(false); await applyFixed(); render(); syncCard(false); }
  else if (S.sync.dirty) syncData(false); // 閉じる前に未送信の変更を送る
});

(async function init() {
  try { await load(); }
  catch (e) { console.error(e); toast('データを開けませんでした'); }
  render();
  // 先に他の端末の変更を受け取ってから、固定費とカード明細を処理（二重登録を防ぐ）
  await syncData(false);
  try { await applyFixed(); } catch (e) { console.error(e); }
  render();
  syncCard(false);
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
