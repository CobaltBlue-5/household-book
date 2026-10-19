/* 家計簿 — 外部サービスに依存しない、スマホ内保存のPWA */
'use strict';

const APP_VERSION = '1.2.0';
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
      const tx = { id: uid(), type: 'expense', amount: f.amount, cat: f.cat, date: `${ym}-${pad(day)}`, memo: f.name, fixedId: f.id, createdAt: Date.now() };
      S.tx.push(tx);
      await DB.putTx(tx);
      f.done.push(ym);
      changed = true;
    }
  }
  if (changed) await DB.set('fixed', S.fixed);
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
      const tx = { id: uid(), type: 'expense', amount: it.amount, cat, date: it.date, memo: it.merchant + (it.amount < 0 ? '（取消）' : ''), src: 'card', cardId: it.id, createdAt: Date.now() };
      S.tx.push(tx); await DB.putTx(tx);
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
  S.card.learned[n] = cat; await saveCard();
  let k = 0;
  for (const t of S.tx) {
    if (t.src === 'card' && t.cat === UNCAT && normShop(t.memo) === n) { t.cat = cat; await DB.putTx(t); k++; }
  }
  return k;
}
const uncats = () => sortTx(S.tx.filter(t => t.cat === UNCAT)).reverse();

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
    <div class="blk w6"><div class="lbl">毎月の予算</div>
      <div class="field"><input id="budgetIn" type="number" inputmode="numeric" min="0" placeholder="例 150000" value="${S.budget || ''}">
      <button class="btn solid" data-act="saveBudget">保存</button></div></div>
    <div class="blk w6"><div class="lbl">固定費</div>${fixedRows}
      <button class="btn wide" data-act="fixedNew">＋ 固定費を追加</button></div>
    <div class="blk w6"><div class="lbl">カード明細の自動取り込み（三井住友カード）</div>
      <div class="field"><input id="cardUrl" type="url" placeholder="連携URL（https://script.google.com/…?token=…）" value="${esc(S.card.url)}">
      <button class="btn solid" data-act="saveCardUrl">保存</button></div>
      <div class="sub">${S.card.url ? (S.card.lastSync ? '最終同期：' + new Date(S.card.lastSync).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '未同期') : '未設定'}${S.card.error ? '　／　<b style="color:var(--ink)">エラー：' + esc(S.card.error) + '</b>' : ''}　／　覚えた店 ${Object.keys(S.card.learned).length}件</div>
      ${S.card.url ? '<button class="btn wide" data-act="syncNow">今すぐ同期</button>' : ''}
      <p class="note">アプリを開くたびに新しい利用分を取り込みます。カードで払っている家賃やサブスクは、固定費に登録しなくて大丈夫です（二重になります）。</p></div>
    <div class="blk w6"><div class="lbl">バックアップ</div>
      <div class="sub" style="margin-top:0">最終バックアップ：${lb}　／　記録 ${S.tx.length}件</div>
      <div class="btns"><button class="btn solid" data-act="backup">書き出す</button><button class="btn" data-act="restore">読み込む</button></div>
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
           <div class="blk w6 amount"><span class="num"><span class="cur">${neg ? '−' : ''}¥</span>${Math.abs(amt).toLocaleString('ja-JP')}</span></div>`;
  if (s.src === 'card') h += `<div class="hint" style="color:var(--ink)">カード：${esc(s.memo)}</div>`;
  if (s.step === 1) {
    h += `<label class="blk w6 datebox"><input type="date" id="dateIn" value="${s.date}" aria-label="日付"></label>`;
    h += ['7', '8', '9', '4', '5', '6', '1', '2', '3', '00', '0', '⌫'].map(k => `<button class="key" data-act="key" data-k="${k}">${k}</button>`).join('');
    h += `<button class="next" data-act="next" ${amt ? '' : 'disabled'}>カテゴリを選ぶ →</button>`;
    if (s.id) h += `<button class="del" data-act="delTx">この記録を削除</button>`;
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
}

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
  let data;
  try { data = JSON.parse(await file.text()); } catch (e) { toast('ファイルを読み込めませんでした'); return; }
  if (data && data.app === 'kakeibo' && data.kind === 'fixed' && Array.isArray(data.fixed)) return importFixed(data);
  if (!data || data.app !== 'kakeibo' || !Array.isArray(data.tx)) { toast('この家計簿のバックアップではありません'); return; }
  if (!confirm(`${data.exportedAt ? new Date(data.exportedAt).toLocaleDateString('ja-JP') + ' の' : ''}バックアップ（${data.tx.length}件）で、今のデータを置き換えます。よろしいですか？`)) return;
  S.tx = data.tx; S.budget = data.budget || 0; S.fixed = data.fixed || [];
  if (data.card) { S.card.learned = data.card.learned || {}; S.card.seen = data.card.seen || []; S.card.lastSync = data.card.lastSync || 0; }
  await DB.replaceTx(S.tx); await DB.set('budget', S.budget); await DB.set('fixed', S.fixed); await saveCard();
  await applyFixed();
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
      note: f.note || '', start: cur, done: [] });
  }
  await DB.set('fixed', S.fixed); await applyFixed();
  // カード払いの固定費に当てはまる未分類の明細があれば分類し直す
  for (const t of S.tx) if (t.src === 'card' && t.cat === UNCAT) { const c = classify(t.memo); if (c !== UNCAT) { t.cat = c; await DB.putTx(t); } }
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
      if (v) await syncCard(true); else toast('連携を解除しました');
      break;
    }
    case 'syncNow': await syncCard(true); break;
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
      if (i >= 0) S.tx[i] = tx; else S.tx.push(tx);
      await DB.putTx(tx);
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
      S.tx = S.tx.filter(x => x.id !== s.id); await DB.delTx(s.id);
      closeSheet(); render(); toast('削除しました'); break;
    case 'calnav': S.calYm = shiftYm(S.calYm, +el.dataset.k); render(); break;
    case 'repnav': S.repYm = shiftYm(S.repYm, +el.dataset.k); render(); break;
    case 'day': S.calDay = el.dataset.d; render(); break;
    case 'saveBudget': {
      const v = Math.max(0, Math.floor(Number($('#budgetIn').value) || 0));
      S.budget = v; await DB.set('budget', v); toast(v ? `予算を ${yen(v)} にしました` : '予算を解除しました'); render(); break;
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
        Object.assign(f, { name, amount, day, cat, pay, match });
      } else S.fixed.push({ id: uid(), name, amount, day, cat, pay, match, start: ymOf(new Date()), done: [] });
      await DB.set('fixed', S.fixed); await applyFixed();
      closeSheet(); render(); toast('固定費を保存しました'); break;
    }
    case 'delFixed':
      if (!confirm('この固定費を削除しますか？')) return;
      S.fixed = S.fixed.filter(x => x.id !== s.id); await DB.set('fixed', S.fixed);
      closeSheet(); render(); break;
    case 'backup': await backup(); break;
    case 'restore': $('#importFile').click(); break;
    case 'artPick': $('#artFile').click(); break;
    case 'artReset':
      await DB.del('artBlob'); S.artBlob = null; if (S.artUrl) URL.revokeObjectURL(S.artUrl); S.artUrl = null; render(); break;
  }
}

/* 数字キーは指が触れた瞬間に反応させる（指が少し動いてもタップが取り消されないように） */
document.addEventListener('pointerdown', e => {
  const el = e.target.closest('.key');
  if (!el || !S.sheet) return;
  e.preventDefault();
  if (navigator.vibrate) { try { navigator.vibrate(8); } catch (_) { /* noop */ } }
  onAct('key', el).catch(err => toast('エラー：' + err.message));
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
  if (document.visibilityState === 'visible') { await applyFixed(); render(); syncCard(false); }
});

(async function init() {
  try { await load(); await applyFixed(); }
  catch (e) { console.error(e); toast('データを開けませんでした'); }
  render();
  syncCard(false);
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
