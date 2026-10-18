/* Crypto Analytics — прототип, редизайн 18.10.2026 (итоговая спецификация A + B).
   Путь: лендинг → вход (лимит, страна, три вещи, почта) → «Сегодня» (одна цифра — сумма на неделю) →
   «Решение на неделю» (4 действия одного веса) → лист «Перед переходом» → биржа-партнёр с модулем D → журнал.
   Второй уровень: «Сценарии» (бриф: веер, факторы, режим, «что если», архив), «Журнал» (Решения | Сделки), профиль.
   Цифры иллюстративные. */
'use strict';

/* ---------- данные и модель ---------- */
const PRICE = 86530, USD_BYN = 3.275, BTC_BYN = 283400;
const MARKET = {
  calm:  { tails:[15,69,16], lo:81122, hi:92383, bad:300/3467, minus:51, worst:8.7, k:1 },
  alert: { tails:[19,64,17], lo:80400, hi:92900, bad:300/2740, minus:53, worst:10.9, k:1.11 },
};
/* оповещения: что случилось → как это меняет сумму → откуда данные (§8.11) */
const ALERTS = [
  { id:'funding', set:'funding', icon:'stack', cls:'c-or', title:'Перекос плеча на фьючерсах', short:'Funding выше, чем в 94% дней года',
    head:'Многие держат длинные позиции с плечом',
    kv:[['Падение больше 5% по модели','15% → 19%'],['Funding','0,045% / 8 ч'],['Открытый интерес','+12% за 3 дня'],['Цена за 3 дня','+1%']],
    note:'Раньше после такого перекоса резкое падение случалось чаще, но не всегда. Это не сигнал к сделке.',
    src:'Binance, Bybit, OKX · обновлено 09:30' },
  { id:'vol', set:'vol', icon:'wave', cls:'c-vi', title:'Неделя стала шире', short:'Волатильность +18% за 2 дня',
    head:'Рынок ждёт более сильных движений',
    kv:[['Диапазон 80% по модели','$11 261 → $12 500'],['Изменение','+18% за 2 дня'],['DVOL','52 → 58']],
    note:'Движения ожидаются сильнее в обе стороны. Поэтому сумма под ваш лимит стала меньше. Это не сигнал к сделке.',
    src:'Deribit DVOL и модель сценариев · обновлено 09:30' },
];
/* факторы: направление, сила, источник, время, методика, ограничение (§8.6) */
const FACTORS = () => S.alertOn ? {
  up:[
    { id:'trend', icon:'trend', cls:'c-bl', t:'Тренд', s:'Цена выше средних за 50 и 200 дней', src:'Binance спот', at:'09:30', p:2, val:'+6% к средней за 50 дней', how:'Сравниваем цену со скользящими средними за 50 и 200 дней.', lim:'В боковике тренд почти ничего не добавляет к расчёту.' },
    { id:'flow', icon:'flow', cls:'c-te', t:'Отток с бирж', s:'За неделю выведено 18 тыс. BTC', src:'CryptoQuant', at:'08:00', p:1, val:'−18 тыс. BTC за 7 дней', how:'Чистый поток BTC на кошельки бирж и обратно.', lim:'Данные с задержкой до 2 часов, часть кошельков не размечена.' },
  ],
  down:[
    { id:'funding', icon:'stack', cls:'c-or', t:'Перекос плеча', s:'Funding 0,045% / 8 ч, выше 94% дней года', src:'Binance, Bybit, OKX', at:'09:30', p:3, val:'0,045% / 8 ч', how:'Средневзвешенная ставка funding по бессрочным фьючерсам трёх бирж.', lim:'В сильном тренде высокий funding может держаться неделями.' },
    { id:'oi', icon:'layers', cls:'c-ye', t:'Открытый интерес', s:'+12% за 3 дня при цене +1%', src:'Binance Futures', at:'09:30', p:2, val:'+12% за 3 дня', how:'Рост открытых позиций без роста цены — признак накопления плеча.', lim:'Не показывает, в какую сторону открыты позиции.' },
  ],
  unk:[
    { id:'fed', icon:'info', cls:'c-gy', t:'Решение ФРС 29 окт.', s:'Модель не учитывает новости', src:'—', at:'', p:0, val:'вне модели', how:'Новости и решения регуляторов в модель не входят.', lim:'Сильные новости могут вывести цену за любой диапазон.' },
    { id:'etf', icon:'info', cls:'c-gy', t:'Потоки в ETF за пятницу', s:'Данные пришли не полностью', src:'Farside', at:'вчера', p:0, val:'нет данных', how:'Дневные потоки в спотовые BTC-ETF США.', lim:'Пока данных нет, фактор в расчёте не участвует.' },
  ],
} : {
  up:[
    { id:'trend', icon:'trend', cls:'c-bl', t:'Тренд', s:'Цена выше средних за 50 и 200 дней', src:'Binance спот', at:'09:30', p:2, val:'+6% к средней за 50 дней', how:'Сравниваем цену со скользящими средними за 50 и 200 дней.', lim:'В боковике тренд почти ничего не добавляет к расчёту.' },
    { id:'oi', icon:'layers', cls:'c-ye', t:'Открытый интерес', s:'+2% за 3 дня вместе с ценой', src:'Binance Futures', at:'09:30', p:1, val:'+2% за 3 дня', how:'Позиции растут вместе с ценой — перекоса нет.', lim:'Не показывает, в какую сторону открыты позиции.' },
  ],
  down:[
    { id:'vol', icon:'wave', cls:'c-vi', t:'Волатильность опционов', s:'DVOL 44, в обычном диапазоне', src:'Deribit', at:'09:30', p:1, val:'DVOL 44', how:'Ожидаемая волатильность по опционам на 30 дней.', lim:'Опционный рынок BTC небольшой, оценка шумная.' },
  ],
  unk:[
    { id:'fed', icon:'info', cls:'c-gy', t:'Решение ФРС 29 окт.', s:'Модель не учитывает новости', src:'—', at:'', p:0, val:'вне модели', how:'Новости и решения регуляторов в модель не входят.', lim:'Сильные новости могут вывести цену за любой диапазон.' },
  ],
};
const CLOSES = [77439,77340,81270,79661,79832,80342,79112,78456,78306,76569,77226,77279,76842,78189,75644,76206,76417,80884,81250,81178,86620,86209,84398,84410,84100,84433,84472,83500,83664,86530];
const WEEKS = [1,1,1,0,1,1,1,1,0,1,1,1];
const ISSUES = [ /* архив выпусков: прогноз до результата и итог (§8.10) */
  { d:'11 окт.', lo:80900, hi:91800, fact:86530, ok:true }, { d:'4 окт.', lo:79800, hi:90500, fact:84900, ok:true },
  { d:'27 сен.', lo:77100, hi:87400, fact:76200, ok:false, miss:'−7,8% за неделю' }, { d:'20 сен.', lo:75200, hi:85600, fact:81200, ok:true },
  { d:'13 сен.', lo:74800, hi:84900, fact:78300, ok:true }, { d:'6 сен.', lo:72900, hi:83100, fact:77300, ok:true },
  { d:'30 авг.', lo:74100, hi:84200, fact:72600, ok:false, miss:'−9,1% за неделю' }, { d:'23 авг.', lo:73500, hi:83700, fact:79600, ok:true },
];
const TRADES = (() => {
  const pnl=[62,-41,85,-28,47,-55,120,-33,18,-61,74,39,-22,105], fee=[8,9,7,8,9,8,10,7,8,9,8,8,7,9];
  const hot=[1,5,6,9,12], d=['3 июл','9 июл','15 июл','22 июл','29 июл','5 авг','11 авг','18 авг','25 авг','1 сен','8 сен','15 сен','22 сен','29 сен'];
  const size=[900,1200,1500,800,1000,1400,1600,700,600,1300,1100,900,1000,1500];
  return pnl.map((p,i)=>({date:d[i], side:i%3===2?'Продажа':'Покупка', size:size[i], gross:p, fee:fee[i], hot:hot.includes(i)}));
})();

const DEFAULT = () => ({
  onb:'land', cons:{ model:false, loss:false }, consent:null, limit:300, customLim:false, country:'BY', email:'', capital:5000,
  view:'today', alertOn:true, noSignal:false,
  stop:'', fee:'', slip:'', pos:'',
  hypOpen:false, hyp:null, conf:null, note:'',
  plan:{ amount:3467, date:'5 окт.' },
  journal:[
    { id:1, date:'11 окт.', kind:'ex', ex:'А', plan:3200, due:true },
    { id:2, date:'5 окт.', kind:'ex', ex:'А', plan:3467, invested:3000, inRange:true, limitOk:true },
    { id:3, date:'28 сен.', kind:'skip', inRange:true },
    { id:4, date:'21 сен.', kind:'save', plan:3100, invested:3100, inRange:false, limitOk:true, note:'падение −7,8%' },
  ],
  jseg:'dec', fseg:'down', feedAll:false,
  trades:false, apiPerm:{read:true,trade:false,withdraw:false},
  set:{ funding:true, oi:true, vol:true, flow:false, maxDay:2, quiet:true },
  exPick:'А', exView:'scen',
});
let S = DEFAULT();
const KEY = 'ca-proto-v2';
try { const saved = JSON.parse(localStorage.getItem(KEY) || 'null'); if (saved) S = Object.assign(DEFAULT(), saved); } catch (e) {}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };

const M = () => S.alertOn ? MARKET.alert : MARKET.calm;
const fmt = n => Math.round(n).toLocaleString('ru-RU');
const usd = n => (n < 0 ? '−' : '') + '$' + fmt(Math.abs(n));
const num = v => parseFloat(String(v ?? '').replace(/\s/g, '').replace(',', '.')) || 0;

/* сумма на неделю: среднее худших 10% недель не больше лимита; стоп, издержки и позиция — по желанию (§8.7) */
function calc(over) {
  const m = M(), o = Object.assign({ capital:S.capital, limit:S.limit, stop:S.stop, fee:S.fee, slip:S.slip, pos:S.pos }, over || {});
  if (S.noSignal) return { none:true, reason:'Данные с бирж пришли не полностью. Считать не будем, пока не обновятся.' };
  let per = m.bad; const st = num(o.stop);
  if (st > 0 && st < PRICE) {
    const d = (PRICE - st) / PRICE;
    if (d < 0.02) return { none:true, reason:'Стоп ближе, чем обычное движение цены за день. Расчёт ненадёжен.' };
    per = Math.min(per, d);
  }
  const costs = (num(o.fee) + num(o.slip)) / 100 * 2;
  per += costs;
  const sum = Math.max(0, Math.min(o.capital, Math.round(o.limit / per)) - num(o.pos));
  return { sum, per, bad:Math.round(sum * per), costs:Math.round(sum * costs), adjusted: per !== m.bad || num(o.pos) > 0 };
}
const calcSum = () => calc().sum || 0;
const calmSum = () => Math.min(S.capital, Math.round(S.limit / MARKET.calm.bad));
const planBad = () => Math.round(S.plan.amount * M().bad);
const planOver = () => !!S.plan && planBad() > S.limit;
const activeAlerts = () => S.alertOn && !S.noSignal ? ALERTS.filter(a => S.set[a.set]) : [];
const regime = () => S.noSignal ? 'режим неясен' : S.alertOn ? 'стресс' : 'боковик';
const fresh = () => S.noSignal ? { c:'or', t:'данные от 06:10' } : { c:'gr', t:'обновлено 09:30' };
const ico = (id, c = 'i') => `<svg class="${c}" aria-hidden="true"><use href="#${id}"/></svg>`;
const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const isPhone = () => matchMedia('(max-width: 899px)').matches;
const initial = () => (S.email.trim()[0] || 'И').toUpperCase();

/* ---------- веер сценариев: история 30 дней + полосы 50% / 80% на 7 дней ---------- */
const FAN = { W:300, H:200, L:4, R:36, T:8, B:18, lo:73000, hi:97000 };
const SD = 0.3717 / Math.sqrt(365);
const PATHS = (() => { let s = 7; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const g = () => Math.sqrt(-2 * Math.log(r() + 1e-9)) * Math.cos(2 * Math.PI * r());
  return Array.from({length:22}, () => Array.from({length:7}, g)); })();
let fanK = null, fanDrawn = false;
const easeOut = t => 1 - Math.pow(1 - t, 4);
function fanGeo(k) {
  const {W,H,L,R,T,B,lo,hi} = FAN, n = CLOSES.length, hw = (W-L-R)*.66, fw = (W-L-R)*.34;
  const x = i => i <= n-1 ? L + hw*i/(n-1) : L + hw + fw*(i-(n-1))/7;
  const y = v => T + (H-T-B)*(hi-Math.max(lo,Math.min(hi,v)))/(hi-lo);
  const drift = S.alertOn ? -0.0006 : 0;
  const q = (z,d) => PRICE*Math.exp(drift*d + z*SD*k*Math.sqrt(d));
  const band = z => { const up=[], dn=[]; for (let d=0; d<=7; d++){ up.push(`${x(n-1+d).toFixed(1)},${y(q(z,d)).toFixed(1)}`); dn.unshift(`${x(n-1+d).toFixed(1)},${y(q(-z,d)).toFixed(1)}`);} return up.concat(dn).join(' '); };
  const paths = PATHS.map(zs => { let p = PRICE; const pts=[`${x(n-1)},${y(PRICE)}`]; zs.forEach((z,d) => { p *= Math.exp(drift + z*SD*k); pts.push(`${x(n+d).toFixed(1)},${y(p).toFixed(1)}`); }); return pts.join(' '); });
  const med = Array.from({length:8}, (_,d) => `${x(n-1+d).toFixed(1)},${y(q(0,d)).toFixed(1)}`).join(' ');
  return { x, y, n, b80:band(1.2816), b50:band(0.6745), paths, med };
}
function fanSVG(draw, compact) {
  const k = fanK ?? M().k, g = fanGeo(k), {W,H,L,R,B} = FAN;
  const hist = CLOSES.map((v,i) => `${g.x(i).toFixed(1)},${g.y(v).toFixed(1)}`).join(' ');
  let len = 0; CLOSES.forEach((v,i) => { if (i) len += Math.hypot(g.x(i)-g.x(i-1), g.y(v)-g.y(CLOSES[i-1])); });
  const grid = [80000,85000,90000,95000].map(v => `<line x1="${L}" x2="${W-R}" y1="${g.y(v)}" y2="${g.y(v)}" stroke="rgba(255,255,255,.07)"/><text x="${W-R+5}" y="${g.y(v)+3}">${v/1000}k</text>`).join('');
  return `<svg class="fan ${compact ? 'compact' : ''} ${draw && !reduce() ? 'draw' : ''}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Цена BTC за 30 дней и веер сценариев модели на 7 дней вперёд">
    <defs><linearGradient id="hg${compact ? 'c' : ''}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="rgba(10,132,255,.28)"/><stop offset="1" stop-color="rgba(10,132,255,0)"/></linearGradient></defs>
    ${grid}
    <polygon class="band" data-b="80" points="${g.b80}" fill="rgba(10,132,255,.16)"/>
    <polygon class="band" data-b="50" points="${g.b50}" fill="rgba(10,132,255,.32)"/>
    <g class="paths">${g.paths.map(p => `<polyline points="${p}" fill="none" stroke="rgba(100,170,255,.22)" stroke-width=".8"/>`).join('')}</g>
    <polygon points="${hist} ${g.x(g.n-1)},${H-B} ${g.x(0)},${H-B}" fill="url(#hg${compact ? 'c' : ''})"/>
    <polyline class="hist" style="--len:${len.toFixed(0)}" points="${hist}" fill="none" stroke="#0a84ff" stroke-width="1.8" stroke-linejoin="round"/>
    <polyline class="med" points="${g.med}" fill="none" stroke="#0a84ff" stroke-width="1.2" stroke-dasharray="3 3"/>
    <circle cx="${g.x(g.n-1)}" cy="${g.y(PRICE)}" r="4" fill="#0a84ff" stroke="#000" stroke-width="2"/>
    <text x="${L}" y="${H-4}">19 сент.</text><text x="${g.x(g.n-1)}" y="${H-4}" text-anchor="middle">сегодня</text><text x="${W-R}" y="${H-4}" text-anchor="end">+7 дн.</text>
  </svg>`;
}
/* при смене рынка полосы веера плавно перетекают (400 мс), а не перерисовываются */
function morphFan() {
  const svgs = document.querySelectorAll('#view .fan, .exframe .fan');
  const from = fanK ?? M().k, to = M().k; fanK = to;
  if (!svgs.length || from === to) return;
  const apply = k => { const g = fanGeo(k); svgs.forEach(svg => {
    svg.querySelector('[data-b="80"]').setAttribute('points', g.b80);
    svg.querySelector('[data-b="50"]').setAttribute('points', g.b50);
    svg.querySelector('.med').setAttribute('points', g.med);
    svg.querySelectorAll('.paths polyline').forEach((p,i) => p.setAttribute('points', g.paths[i])); }); };
  if (reduce()) return apply(to);
  const t0 = performance.now(), dur = 400, io = t => t < .5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3) / 2;
  (function step(now){ const t = Math.min(1,(now-t0)/dur); apply(from + (to-from)*io(t)); if (t < 1) requestAnimationFrame(step); })(t0);
}


/* ---------- компоненты ---------- */
const chev = `<span class="chev">${ico('chev')}</span>`;
/* строка: с действием — кнопка с шевроном; без действия — просто значение, без вида кнопки */
function row(o) {
  const tap = !!o.attrs, tag = tap ? 'button' : 'div';
  const lead = o.tile ? `<span class="cat ${o.cls || 'c-gy'}">${ico(o.tile)}</span>` : o.glyph ? `<span class="gl">${ico(o.glyph)}</span>` : '';
  return `<${tag} class="row${tap ? ' tap press' : ''}${o.extra ? ' ' + o.extra : ''}" ${o.attrs || ''}>${lead}<span class="rt"><b>${o.title}</b>${o.sub ? `<small>${o.sub}</small>` : ''}</span>${o.val != null ? `<span class="v ${o.vc || ''}">${o.val}</span>` : ''}${o.right || ''}${tap && !o.nochev ? chev : ''}</${tag}>`;
}
const grp = (rows, cls = '') => `<div class="grp ${cls}">${rows.join('')}</div>`;
const sec = t => `<h3 class="sec">${t}</h3>`;
const seg = (name, cur, opts) => `<div class="seg" role="tablist">${opts.map(([k, t]) => `<button class="${cur === k ? 'on' : ''}" role="tab" aria-selected="${cur === k}" data-seg="${name}:${k}">${t}</button>`).join('')}</div>`;
const toggle = (attrs, on, label, dis) => `<button class="toggle" role="switch" aria-checked="${!!on}" ${attrs} aria-label="${label}" ${dis ? 'disabled' : ''}></button>`;
const dots = p => `<span class="pw" aria-label="сила ${p} из 3">${[1,2,3].map(i => `<i class="${i <= p ? 'on' : ''}"></i>`).join('')}</span>`;
const back = (to) => `<button class="circ press" data-act="back" ${to ? `data-to="${to}"` : ''} aria-label="Назад">${ico('back')}</button>`;
/* шапка вложенного экрана: назад + заголовок по центру */
const navbar = (title, to) => `<div class="nb">${back(to)}<div class="nbt">${title}</div><span class="nbs"></span></div>`;
/* шапка экрана первого уровня: крупный заголовок слева, аватар справа */
const topbar = (title, sub, right = '') => `<div class="tb"><div><div class="tbs">${sub}</div><h1 class="ttl">${title}</h1></div>${right}</div>`;
const ava = () => `<button class="ava press" data-go="profile" aria-label="Профиль и настройки">${initial()}</button>`;
const sw = (key, v, html, cls = '') => `<span class="sw ${cls}" data-sw="${key}" data-v="${v}">${html}</span>`;
const ctxLines = () => { const m = M(), f = fresh();
  return `<span class="l1 num">BTC ${usd(PRICE)} · ${S.noSignal ? 'диапазон не считаем' : `неделя ${usd(m.lo)} – ${usd(m.hi)}`}</span>
    <span class="l2">${S.noSignal ? 'расчёт от 17 окт.' : '8 из 10 недель по модели'} · ${regime()} · <i class="fd ${f.c}"></i>${f.t.replace('обновлено ', '')}</span>`; };

/* ---------- экраны первого уровня ---------- */
const VIEWS = {
  today:{t:'Сегодня', i:'home', d:0}, scen:{t:'Сценарии', i:'fanic', d:0}, journal:{t:'Журнал', i:'book', d:0},
  sum:{t:'Решение на неделю', d:1, tab:'today', up:'today'}, archive:{t:'Архив прогнозов', d:1, tab:'scen', up:'scen'},
  profile:{t:'Профиль', d:1, tab:'today', up:'today'}, alerts:{t:'Оповещения', d:2, tab:'today', up:'profile'},
  assistant:{t:'Ассистент', d:2, tab:'today', up:'profile'},
};
const TABS = ['today','scen','journal'];

function feedItems() {
  const items = [];
  if (planOver()) items.push(row({ tile:'shield', cls:'c-gy', title:'План вне лимита', sub:`${usd(S.plan.amount)} от ${S.plan.date} · лимит ${usd(S.limit)}`, val:`−${usd(planBad())}`, vc:'dn', attrs:'data-go="sum"', extra:'card' }));
  activeAlerts().forEach(a => items.push(row({ tile:a.icon, cls:a.cls, title:a.title, sub:a.short, attrs:`data-alert="${a.id}"`, extra:'card' })));
  const due = S.journal.find(j => j.due);
  if (due) items.push(row({ tile:'clock', cls:'c-gy', title:`Пора разобрать решение от ${due.date}`, sub:'разбор займёт пару минут', attrs:`data-review="${due.id}"`, extra:'card' }));
  return items;
}
function vToday() {
  const c = calc(), items = feedItems(), shownItems = S.feedAll ? items : items.slice(0, 3);
  const was = S.alertOn && !c.none && !c.adjusted && calmSum() !== c.sum ? `<p class="was">было ${usd(calmSum())} — до оповещения 18 окт.</p>` : '';
  const hero = c.none
    ? `<div class="lbl2">Сумма на неделю</div>${sw('sum', 'none', 'Без позиции', 'hero2')}<p class="reason">${c.reason} Пропустить — нормально.</p>`
    : `<div class="lbl2">Сумма на неделю</div>${sw('sum', c.sum, usd(c.sum), 'hero num')}<p class="sub2 num">из ${usd(S.capital)} · плохая неделя ≤ ${usd(S.limit)}</p>${was}`;
  return `<div class="hide-m">${topbar('Сегодня', 'суббота, 18 октября', `<div class="tbr"><button class="asset press" data-sheet="data">${ico('btc')}BTC · 7 дней</button>${ava()}</div>`)}</div>
  <div class="phonebar hide-d"><button class="asset press" data-sheet="data">${ico('btc')}BTC · 7 дней</button>${ava()}</div>
  <div class="cols">
    <section class="card herocard">
      ${hero}
      <button class="ctx press" data-go="scen" aria-label="Сценарии недели">${ctxLines()}</button>
      <button class="pill w press" data-go="sum">Решение на неделю</button>
    </section>
    <section class="stackv">
      ${sec('Сегодня')}
      <div class="feed">${shownItems.length ? shownItems.join('') : `<div class="empty">Ничего необычного. Сообщим, если риск вырастет.</div>`}</div>
      ${items.length > 3 ? `<button class="more press" data-act="feedall">${S.feedAll ? 'Свернуть' : `Ещё ${items.length - 3}`}</button>` : ''}
      <button class="card minifan press hide-m" data-go="scen"><div class="mf-h"><b>Неделя по модели</b>${chev}</div>${fanSVG(false, true)}</button>
    </section>
  </div>`;
}

function vScen(ex) {
  const m = M(), F = FACTORS(), cur = F[S.fseg] ? S.fseg : 'down', f = fresh();
  const draw = !fanDrawn; fanDrawn = true;
  const list = F[cur].map(x => row({ tile:x.icon, cls:x.cls, title:x.t, sub:`${x.s}<br>${x.src}${x.at ? ' · ' + x.at : ''}`, right: x.p ? dots(x.p) : '', attrs:`data-factor="${x.id}"` }));
  const left = `
    <section class="card scencard">
      ${S.noSignal ? `<div class="notice">${ico('info')}<span><b>Модель сейчас молчит.</b> Данные с бирж пришли не полностью. Ниже — последний расчёт от 17 окт.</span></div>` : ''}
      <div class="hero-r num">${usd(m.lo)} – ${usd(m.hi)}</div>
      <p class="sub2">где цена через 7 дней в 8 сценариях из 10 · по модели</p>
      ${fanSVG(draw)}
      <div class="trio num">
        <div><b class="dn">${m.tails[0]}%</b><small>упадёт &gt; 5%</small></div>
        <div><b>${m.tails[1]}%</b><small>в пределах ±5%</small></div>
        <div><b class="up">${m.tails[2]}%</b><small>вырастет &gt; 5%</small></div>
      </div>
      <p class="fine">Доли из 20 000 смоделированных недель. Не обещание: куда пойдёт цена, модель не знает.</p>
    </section>`;
  const right = `
    <section class="stackv">
      ${grp([
        row({ title:'Плохая неделя', sub:'1 неделя из 10 с самым сильным падением', val:`−${String(m.worst).replace('.', ',')}%`, vc:'dn' }),
        row({ title:'Режим рынка', val:regime()[0].toUpperCase() + regime().slice(1), attrs:'data-sheet="regime"' }),
        row({ title:'Данные и модель', val:`<i class="fd ${f.c}"></i>${f.t.replace('обновлено ', '')}`, attrs:'data-sheet="data"' }),
      ])}
      ${sec('Почему так')}
      ${seg('fseg', cur, [['up', `За рост · ${F.up.length}`], ['down', `За падение · ${F.down.length}`], ['unk', `Не знаем · ${F.unk.length}`]])}
      ${grp(list)}
      <p class="fine">Это вклад в расчёт модели, а не причина движения цены.</p>
      ${sec('Что изменит картину')}
      ${grp([
        ...(S.alertOn
          ? [row({ title:'Funding остынет ниже 0,02%', sub:'риск падения вернётся к ~15%' }), row({ title:'DVOL опустится ниже 52', sub:'диапазон сузится на ~10%' })]
          : [row({ title:'Funding поднимется выше 0,04%', sub:'риск падения вырастет до ~19%' })]),
        row({ title:'Расчёт действует до', val:'25 окт., 09:30' }),
      ])}
      ${grp([
        ex ? '' : row({ title:'Что если…', sub:'гипотетические сценарии', right:'<span class="pro">Pro</span>', attrs:'data-sheet="whatif"' }),
        row({ title:'Архив и точность модели', sub:'10 из 12 недель в диапазоне · промахи не удаляем', attrs:'data-go="archive"' }),
      ])}
      ${ex ? '' : `<div class="sticky"><button class="btn w press" data-go="sum">Посчитать мою сумму</button></div>`}
    </section>`;
  return `${ex ? '' : topbar('Сценарии', `BTC · 7 дней · рассчитано 09:30`, '')}<div class="cols">${left}${right}</div>`;
}

function hypBlock() {
  const H = [['range','Боковик'],['up','Рост'],['down','Падение'],['unk','Не знаю']], C = [[1,'низкая'],[2,'средняя'],[3,'высокая']];
  return `<div class="hyp ${S.hypOpen ? 'open' : ''}">
    <button class="row tap press hyph" data-act="hyp" aria-expanded="${S.hypOpen}"><span class="rt"><b>Добавить гипотезу и уверенность</b><small>${S.hyp || S.conf ? [H.find(h => h[0] === S.hyp)?.[1], C.find(c => c[0] === S.conf)?.[1] && 'уверенность ' + C.find(c => c[0] === S.conf)[1]].filter(Boolean).join(' · ') : 'необязательно, запишется в журнал'}</small></span><span class="chev rot">${ico('chev')}</span></button>
    ${S.hypOpen ? `<div class="hypb">
      <label class="flab">Что думаете о неделе?</label>
      <div class="chips">${H.map(([k, t]) => `<button class="chip ${S.hyp === k ? 'on' : ''}" data-hyp="${k}">${t}</button>`).join('')}</div>
      <label class="flab">Уверенность</label>
      <div class="chips">${C.map(([k, t]) => `<button class="chip ${S.conf === k ? 'on' : ''}" data-conf="${k}">${t}</button>`).join('')}</div>
      <div class="inp"><input data-in="note" placeholder="Заметка для себя" value="${esc(S.note)}" enterkeyhint="done" aria-label="Заметка"></div>
    </div>` : ''}
  </div>`;
}
function calcForm(inSheet) {
  const c = calc();
  return `<div class="calcf">
    <div class="field"><label for="fCap">Капитал</label><div class="inp"><span>$</span><input id="fCap" inputmode="decimal" enterkeyhint="done" data-in="cap" value="${S.capital}"></div></div>
    <div class="field"><label for="fLim">Лимит потерь за плохую неделю</label><div class="inp"><span>$</span><input id="fLim" inputmode="decimal" enterkeyhint="done" data-in="lim" value="${S.limit}"></div>
      <div class="chips">${[100,300,500].map(v => `<button class="chip sm num ${S.limit === v ? 'on' : ''}" data-limset="${v}">${usd(v)}</button>`).join('')}</div></div>
    <details class="more2" ${S.moreOpen || S.stop || S.fee || S.slip || S.pos ? 'open' : ''}><summary>Дополнительно: стоп и издержки</summary>
      <div class="field"><label for="fStop">Стоп, цена BTC</label><div class="inp"><span>$</span><input id="fStop" inputmode="decimal" enterkeyhint="done" data-in="stop" value="${S.stop}" placeholder="не задан"></div></div>
      <div class="two">
        <div class="field"><label for="fFee">Комиссия</label><div class="inp"><input id="fFee" inputmode="decimal" enterkeyhint="done" data-in="fee" value="${S.fee}" placeholder="0,1"><span>%</span></div></div>
        <div class="field"><label for="fSlip">Проскальзывание</label><div class="inp"><input id="fSlip" inputmode="decimal" enterkeyhint="done" data-in="slip" value="${S.slip}" placeholder="0,05"><span>%</span></div></div>
      </div>
      <div class="field"><label for="fPos">Уже в BTC</label><div class="inp"><span>$</span><input id="fPos" inputmode="decimal" enterkeyhint="done" data-in="pos" value="${S.pos}" placeholder="0"></div></div>
    </details>
    ${inSheet ? `<div class="calcres" id="calcRes">${calcRes(c)}</div>` : ''}
  </div>`;
}
const calcRes = c => c.none ? `<span>Без позиции</span><small>${c.reason}</small>` : `<span class="num">${usd(c.sum)}</span><small>сумма на неделю${c.costs ? ` · издержки ≈ ${usd(c.costs)}` : ''}</small>`;

function vSum() {
  const c = calc(), m = M();
  const was = S.alertOn && !c.none && !c.adjusted && calmSum() !== c.sum ? `<p class="was">было ${usd(calmSum())} — до оповещения 18 окт.</p>` : '';
  const hero = c.none
    ? `${sw('dsum', 'none', 'Без позиции', 'hero2')}<p class="reason">${c.reason}</p>`
    : `${sw('dsum', c.sum, usd(c.sum), 'hero num')}<p class="sub2 num">из ${usd(S.capital)} · плохая неделя ≤ ${usd(S.limit)}</p>${was}`;
  const ex = !c.none;
  return `${navbar('Решение на неделю', 'today')}
  <div class="cols">
    <section class="stackv">
      <div class="card herocard">${hero}</div>
      ${grp([
        row({ title:'Изменить расчёт', sub:`капитал ${usd(S.capital)} · лимит ${usd(S.limit)}${S.stop ? ' · стоп' : ''}${S.fee || S.slip ? ' · издержки' : ''}`, attrs:'data-sheet="calc"', extra:'hide-d' }),
        c.none ? '' : row({ title:'В плохую неделю', sub:'1 неделя из 10 с самым сильным падением', val:`−${usd(c.bad)}`, vc:'dn' }),
        c.none || !c.costs ? '' : row({ title:'Издержки на вход и выход', val:`≈ ${usd(c.costs)}` }),
        row({ title:`Шанс закончить неделю в минусе — ${m.minus}%`, sub:'по модели · от суммы не зависит' }),
      ])}
      <div class="acts">
        <button class="btn d press" data-act="watch">Наблюдать</button>
        <button class="btn d press" data-act="saveplan">Сохранить план</button>
        <button class="btn d press" data-act="skip">Пропустить</button>
        <button class="btn d press" data-act="toex" ${ex ? '' : 'disabled aria-describedby="noex"'}>Перейти к бирже</button>
      </div>
      ${ex ? '' : `<p class="fine c" id="noex">«Перейти к бирже» недоступно: расчёт ненадёжен.</p>`}
      ${hypBlock()}
      <p class="fine c">Это расчёт, а не совет. Любой выбор попадёт в журнал.</p>
    </section>
    <section class="card hide-m"><h3 class="sec" style="margin-top:0">Изменить расчёт</h3>${calcForm(false)}</section>
  </div>`;
}

function jTitle(j) {
  const amt = usd(j.invested ?? j.plan ?? 0);
  return j.kind === 'ex' ? `Перешёл к бирже ${j.ex || 'А'} · ${amt}` : j.kind === 'save' ? `Сохранил план · ${amt}` : j.kind === 'watch' ? 'Наблюдаю' : 'Пропустил';
}
function jStatus(j) {
  if (j.due || j.pending) return `<span class="st wait" aria-label="ждём неделю">${ico('clock')}</span>`;
  if (j.kind === 'skip' || j.kind === 'watch') return '';
  return `<span class="st ${j.limitOk ? 'ok' : 'no'}" aria-label="${j.limitOk ? 'лимит соблюдён' : 'лимит превышен'}">${ico(j.limitOk ? 'check' : 'close')}</span>`;
}
function vJournal() {
  const icon = { ex:'swap', save:'bookmark', watch:'eye', skip:'close' };
  const due = S.journal.find(j => j.due);
  const rows = S.journal.filter(j => !j.due).map(j => row({ tile:icon[j.kind] || 'swap', cls:'c-gy', title:jTitle(j),
    sub:`${j.date} · ${j.pending ? `разбор ${j.reviewDate || '25 окт.'}` : j.kind === 'watch' ? 'сообщим, если сумма изменится' : `${j.inRange === false ? 'вне диапазона' : 'цена в диапазоне'}${j.note ? ' · ' + j.note : ''}`}`,
    right:jStatus(j), attrs:`data-jitem="${j.id}"` }));
  const dec = `<div class="cols">
    <section class="stackv">
      ${due ? `<div class="card duecard"><div class="rt"><b>Пора разобрать ${due.date}</b><small>${jTitle(due)} · разбор займёт пару минут</small></div><button class="btn w press" data-review="${due.id}">Разобрать</button></div>` : ''}
      ${rows.length ? grp(rows) : `<div class="empty">Здесь будут ваши решения. Любой выбор на экране суммы — даже «Пропустить» — попадёт сюда, и через неделю мы вместе его разберём.</div>`}
    </section>
    <section class="stackv">
      ${grp([row({ title:'Лимит соблюдён', sub:'недели с риском в рамках вашего лимита', val:'11 из 12' }), row({ title:'Точность модели', sub:'живёт в архиве прогнозов', attrs:'data-go="archive"' })])}
      <p class="fine">«Пропустил» — полноценное решение, а не провал. Его тоже разбираем через неделю.</p>
    </section>
  </div>`;
  return `${topbar('Журнал', 'ваши решения и сделки')}
    ${seg('jseg', S.jseg, [['dec', 'Решения'], ['trades', 'Сделки']])}
    <div class="segbody">${S.jseg === 'trades' ? vTrades() : dec}</div>`;
}
function vTrades() {
  if (!S.trades) return `<div class="cols">
    <section class="stackv">
      <p class="lead">Загрузите историю сделок — посчитаем результат после комиссий.</p>
      ${grp([
        row({ glyph:'export', title:'Файл CSV', sub:'выгрузка истории с любой биржи ПВТ', attrs:'data-act="csv"' }),
        row({ glyph:'lock', title:'Биржа-партнёр по API', sub:'ключ только на чтение', attrs:'data-act="api"' }),
      ])}
      <p class="fine">Ключ с правом торговли или вывода не примем: права проверяем при подключении.</p>
    </section>
    <section class="stackv">${sec('Что покажет разбор')}${grp([row({ title:'Доходность после комиссий', sub:'а не только «попал в диапазон»' }), row({ title:'Просадки', sub:'сколько терял по пути' }), row({ title:'Повторяющиеся привычки', sub:'всегда с размером выборки' })])}</section>
  </div>`;
  const gross = TRADES.reduce((a,t) => a + t.gross, 0), fees = TRADES.reduce((a,t) => a + t.fee, 0), net = gross - fees;
  let eq = S.capital, peak = eq, dd = 0; TRADES.forEach(t => { eq += t.gross - t.fee; peak = Math.max(peak, eq); dd = Math.min(dd, (eq - peak) / peak); });
  const hot = TRADES.filter(t => t.hot), hotLoss = hot.filter(t => t.gross - t.fee < 0).length;
  const pct = v => (v >= 0 ? '+' : '−') + Math.abs(v * 100).toFixed(1).replace('.', ',') + '%';
  return `<div class="cols">
    <section class="stackv">
      <div class="card herocard">
        <div class="lbl2">${TRADES.length} сделок · июль – сентябрь</div>
        <div class="hero2 num">${pct(net / S.capital)}</div>
        <p class="sub2 num">после комиссий · ${usd(net)}</p>
      </div>
      ${grp([row({ title:'До комиссий', val:usd(gross) }), row({ title:'Комиссии', val:`−${usd(fees)}`, vc:'dn' }), row({ title:'После комиссий', val:usd(net) })])}
      ${grp([row({ title:'Максимальная просадка', sub:'от пика капитала', val:pct(dd) })])}
      <div class="card hide-m"><table class="num"><thead><tr><th>Дата</th><th>Сторона</th><th class="r">Сумма</th><th class="r">Комиссия</th><th class="r">Итог</th></tr></thead><tbody>
        ${TRADES.map(t => `<tr><td>${t.date}${t.hot ? '<span class="flag">funding перегрет</span>' : ''}</td><td>${t.side}</td><td class="r">${usd(t.size)}</td><td class="r mut">−${usd(t.fee)}</td><td class="r"><b>${t.gross - t.fee < 0 ? '' : '+'}${usd(t.gross - t.fee)}</b></td></tr>`).join('')}
      </tbody></table></div>
    </section>
    <section class="stackv">
      ${sec('Замеченная привычка')}
      ${grp([row({ tile:'stack', cls:'c-or', title:'Входы при перегретом funding', sub:`${hotLoss} из ${hot.length} закрыты в минус · сделок мало, вывод предварительный`, val:`${hotLoss}/${hot.length}` })])}
      ${sec('Дисциплина')}
      ${grp([row({ title:'Лимит соблюдён', sub:`недели с риском в рамках ${usd(S.limit)}`, val:'11 из 12' })])}
      <p class="fine">Результаты видите только вы, в рекламе мы их не используем. Источник: ${S.trades === 'api' ? 'Биржа-партнёр А, API только на чтение' : 'файл CSV'}.</p>
      <button class="btn d press" data-act="untrades">Отключить источник</button>
    </section>
  </div>`;
}

function vArchive(ex) {
  const ok = WEEKS.filter(Boolean).length;
  return `${ex ? '' : navbar('Архив прогнозов', 'scen')}
  <div class="cols">
    <section class="card herocard">
      <div class="lbl2">12 недель</div>
      <div class="hero2 num">${ok} из 12</div>
      <p class="sub2">недель цена была в диапазоне 80% · по модели</p>
      <div class="cal" aria-label="Попадания по неделям: ${ok} из 12">${WEEKS.map(w => `<i class="${w ? '' : 'm'}"></i>`).join('')}</div>
      <p class="fine c">Ожидаем около 8 из 10. Если попаданий станет меньше, модель слишком уверена, и мы покажем это здесь же.</p>
    </section>
    <section class="stackv">
      ${grp([row({ title:'Калибровка', sub:'попадание против обещанных 80%', val:'83%' }), row({ title:'Версия модели', sub:'изменения и поправки — в журнале модели', val:'v0.4 · 1 окт.' })])}
      ${sec('Выпуски')}
      ${grp(ISSUES.map(i => row({ title:i.d, sub:`прогноз ${usd(i.lo)} – ${usd(i.hi)} · факт ${usd(i.fact)}`, val:i.ok ? 'в диапазоне' : `промах ${i.miss.split(' ')[0]}`, vc:i.ok ? 'mut' : 'dn' })))}
      <p class="fine">Неудачные прогнозы не удаляем и не прячем.</p>
    </section>
  </div>`;
}

function vProfile() {
  return `${navbar('Профиль', 'today')}
  <div class="cols even">
    <section class="stackv">
      <div class="card acct"><span class="ava big">${initial()}</span><div class="rt"><b>${S.email ? esc(S.email) : 'Демо-аккаунт'}</b><small>Free · ${S.country === 'BY' ? 'Беларусь' : 'другая страна'}</small></div></div>
      ${grp([
        row({ glyph:'shield', title:'Лимит по умолчанию', sub:'плохая неделя не больше', val:usd(S.limit), attrs:'data-sheet="limit"' }),
        `<div class="row"><span class="gl">${ico('globe')}</span><span class="rt"><b>Страна</b><small>от неё зависят биржи</small></span><select data-sel="country" aria-label="Страна"><option value="BY" ${S.country === 'BY' ? 'selected' : ''}>Беларусь</option><option value="OT" ${S.country === 'OT' ? 'selected' : ''}>Другая</option></select></div>`,
        row({ glyph:'lock', title:'Подключённые биржи', sub:'только на чтение', val:S.trades ? '1' : 'нет', attrs:'data-act="totrades"' }),
      ])}
      ${grp([
        row({ glyph:'bell', title:'Оповещения', sub:'события, частота, тихие часы', attrs:'data-go="alerts"' }),
        row({ glyph:'logo', title:'Ассистент', sub:aiLive() ? 'подключён: ' + esc(modelName()) : 'демо-режим', attrs:'data-go="assistant"' }),
        row({ glyph:'info', title:'Как читать прогноз', sub:'4 правила', attrs:'data-sheet="rules"' }),
        row({ glyph:'shield', title:'Условия использования', sub:S.consent ? `приняты ${new Date(S.consent.at).toLocaleDateString('ru-RU')}` : 'не приняты', attrs:'data-sheet="terms"' }),
        row({ glyph:'wallet', title:'Подписка', val:'Free' }),
      ])}
    </section>
    <section class="stackv">
      ${sec('Демо прототипа')}
      ${grp([
        `<div class="row"><span class="gl">${ico('stack')}</span><span class="rt"><b>Рынок перегрет</b><small>включает оповещения и меняет сценарии</small></span>${toggle('data-act="alerttog"', S.alertOn, 'Рынок перегрет')}</div>`,
        `<div class="row"><span class="gl">${ico('info')}</span><span class="rt"><b>Нет сигнала</b><small>модель молчит, сумма — «Без позиции»</small></span>${toggle('data-act="nosig"', S.noSignal, 'Нет сигнала')}</div>`,
        row({ glyph:'bell', title:'Показать пример оповещения', attrs:'data-act="testbanner"', nochev:true }),
        row({ glyph:'sync', title:'Начать заново с лендинга', attrs:'data-act="reset"', nochev:true }),
      ])}
      <p class="fine">Цифры в прототипе иллюстративные. Деньги и токены мы не храним, заявки на бирже не отправляем.</p>
    </section>
  </div>`;
}
function vAlerts() {
  const t = (k, b, s, ic, locked) => `<div class="row"><span class="gl">${ico(ic)}</span><span class="rt"><b>${b}</b><small>${s}</small></span>${toggle(`data-tog="${k}"`, locked || S.set[k], b, locked)}</div>`;
  return `${navbar('Оповещения', 'profile')}
  <div class="cols even">
    <section class="stackv">${sec('События')}
      ${grp([t('funding','Перекос плеча на фьючерсах','funding выше, чем в 90% дней года','stack'), t('oi','Открытый интерес против цены','интерес растёт, цена стоит','layers'), t('vol','Неделя стала шире','волатильность +15% и больше','wave'), t('flow','Потоки на биржи','крупные переводы BTC на биржи','flow'), t('', 'План вышел за лимит', 'нельзя выключить: это суть продукта', 'shield', true)])}
    </section>
    <section class="stackv">${sec('Как приходят')}
      ${grp([
        row({ glyph:'bell', title:'В приложении и push', sub:'e-mail — только дайджест, без Telegram' }),
        `<div class="row"><span class="gl">${ico('clock')}</span><span class="rt"><b>Не чаще в день</b><small>частые сигналы толкают к лишним сделкам</small></span><div class="chips">${[1,2,3].map(n => `<button class="chip sm ${S.set.maxDay === n ? 'on' : ''}" data-max="${n}">${n}</button>`).join('')}</div></div>`,
        t('quiet','Тихие часы','с 23:00 до 8:00 не беспокоим','moon'),
      ])}
      <p class="fine">Каждое оповещение отвечает на три вопроса: что произошло, как это меняет сумму, откуда данные. Это не сигнал к сделке.</p>
    </section>
  </div>`;
}
function vAssistant() {
  return `${navbar('Ассистент', 'profile')}
  <div class="cols even">
    <section class="stackv">
      ${grp([row({ glyph:'logo', title:aiLive() ? 'Подключён: ' + esc(modelName()) : 'Демо-режим', sub:aiLive() ? (AI.proxy ? 'через прокси' : 'ключ хранится только в этом браузере') : 'отвечает на несколько тем', right:`<span class="tag ${aiLive() ? 't-gr' : 't-gy'}">${aiLive() ? 'вкл' : 'демо'}</span>` })])}
      ${sec('Модель')}
      ${grp(MODELS.map(m => row({ glyph:'chip', title:m.name, sub:m.note, right:`<span class="st ${AI.model === m.id ? 'ok' : 'wait'}">${AI.model === m.id ? ico('check') : ''}</span>`, attrs:`data-model="${m.id}"`, nochev:true })))}
      <p class="fine">Ассистент объясняет и считает. Цену не предсказывает и сигналов не даёт.</p>
    </section>
    <section class="stackv">${sec('Для разработчика')}
      <div class="card stackv">
        <div class="field"><label for="aiKey">Ключ OpenRouter</label><div class="inp"><input id="aiKey" type="password" placeholder="sk-or-…" value="${esc(AI.key)}" autocomplete="off"></div></div>
        <div class="field"><label for="aiModel">Модель (можно вписать любую с openrouter.ai)</label><div class="inp"><input id="aiModel" placeholder="${MODELS[0].id}" value="${esc(AI.model)}" autocomplete="off" autocapitalize="none"></div></div>
        <div class="field"><label for="aiProxy">Или адрес прокси (для публичной ссылки)</label><div class="inp"><input id="aiProxy" type="url" placeholder="https://….workers.dev" value="${esc(AI.proxy)}" autocomplete="off"></div></div>
        <div class="pair"><button class="btn d press" data-act="aiclear">Удалить</button><button class="btn w press" data-act="aisave">Сохранить</button></div>
        <p class="fine">Ключ хранится только в этом браузере и уходит только в OpenRouter. На общей ссылке ключ не вводите — используйте прокси из proxy-worker.js.</p>
      </div>
    </section>
  </div>`;
}

/* ---------- до входа: лендинг, пример прогноза, онбординг ---------- */
function vLanding() {
  return `<div class="land">
    <header class="lh"><span class="brand"><span class="appic">${ico('logo')}</span>Crypto Analytics</span><button class="btn link press" data-act="login">Войти</button></header>
    <div class="lgrid">
      <section class="lhero">
        <h1>Сколько вложить в BTC, чтобы плохая неделя не вышла за ваш лимит</h1>
        <p class="lsub">Диапазон и вероятности на 7 дней вперёд по модели. Не прогноз цены и не сигнал к сделке.</p>
        <button class="btn w press lcta" data-act="example">Посмотреть пример прогноза</button>
        <button class="btn link press" data-act="login">Войти в бету</button>
      </section>
      <section class="lshot" aria-label="Как выглядит главный экран">
        <div class="lphone">
          <div class="lbl2">Сумма на неделю</div><div class="hero num">$2 740</div><p class="sub2 num">из $5 000 · плохая неделя ≤ $300</p>
          <p class="l1 num">через 7 дней $80 400 – $92 900</p><p class="l2">так 8 недель из 10 по модели</p>
        </div>
      </section>
    </div>
    <div class="lpts">
      ${grp([
        row({ glyph:'pie', title:'Вероятность — не обещание', sub:'Это доля из 20 000 смоделированных недель. Широкий диапазон значит, что модель не уверена.' }),
        row({ glyph:'check', title:'Ошибки на виду', sub:'10 из 12 недель в диапазоне. Промахи не удаляем.', attrs:'data-act="exarchive"' }),
        row({ glyph:'wallet', title:'Деньги остаются на бирже', sub:'Мы не храним деньги и токены и не торгуем за вас. Сделка — на бирже-партнёре, резиденте ПВТ.' }),
        row({ glyph:'stack', title:'Какие данные', sub:'Цены и деривативы Binance, Bybit, OKX, опционы Deribit, потоки на биржи. Обновление каждый час.' }),
      ])}
      <p class="fine">Продукт не гарантирует прибыль. Токены не являются средством платежа, не обеспечены государством и могут потерять всю стоимость.</p>
    </div>
  </div>`;
}
function vExample() {
  const arch = S.exView === 'archive';
  return `<div class="exframe">
    <div class="nb">${`<button class="circ press" data-act="exback" aria-label="Назад">${ico('back')}</button>`}<div class="nbt">${arch ? 'Архив прогнозов' : 'Пример прогноза'}<small>от 18 окт. · только чтение</small></div><span class="nbs"></span></div>
    <div class="exbodyv">${arch ? vArchive(true) : vScen(true)}</div>
    <div class="sticky ex"><button class="btn w press" data-act="login">Задать свой лимит</button></div>
  </div>`;
}
const TERMS_VERSION = '2026-10-18';
const consentRow = (k, text) => `<button class="cons press ${S.cons[k] ? 'on' : ''}" data-consent="${k}" role="checkbox" aria-checked="${!!S.cons[k]}"><span class="box2">${ico('check')}</span><span>${text}</span></button>`;
function vOnb(dir) {
  const n = 5, dotsH = `<div class="dots">${Array.from({length:n}, (_, i) => `<i class="${i <= S.onb ? 'on' : ''}"></i>`).join('')}</div>`;
  let body;
  if (S.onb === 0) body = `${dotsH}
    <h1>Сколько вы готовы потерять за плохую неделю?</h1>
    <div class="hero num" id="onbLim">${usd(S.limit)}</div>
    <div class="chips c">${[100,300,500].map(v => `<button class="chip num ${S.limit === v && !S.customLim ? 'on' : ''}" data-lim="${v}">${usd(v)}</button>`).join('')}<button class="chip ${S.customLim ? 'on' : ''}" data-lim="custom">своё</button></div>
    ${S.customLim ? `<div class="inp"><span>$</span><input inputmode="decimal" enterkeyhint="done" placeholder="например, 250" data-in="customlim" aria-label="Свой лимит"></div>` : ''}
    <p class="p">Лимит задаём до того, как вы увидите рынок, чтобы не подгонять его под желание войти.</p>
    <button class="btn w press" data-onb="1">Продолжить</button>`;
  else if (S.onb === 1) body = `${dotsH}
    <h1>Где вы живёте?</h1>
    <p class="p">От страны зависят биржи, на которые мы можем вас направить. Для Беларуси это только резиденты ПВТ.</p>
    <button class="pick press ${S.country === 'BY' ? 'on' : ''}" data-country="BY"><i>BY</i><span>Беларусь<small>биржи — резиденты ПВТ</small></span><span class="ck"></span></button>
    <button class="pick press ${S.country === 'OT' ? 'on' : ''}" data-country="OT"><i>${ico('globe')}</i><span>Другая страна<small>партнёры по законам страны</small></span><span class="ck"></span></button>
    <button class="btn w press" data-onb="2">Продолжить</button><button class="btn link" data-onb="0" data-back>Назад</button>`;
  else if (S.onb === 2) body = `${dotsH}
    <h1>Три вещи до начала</h1>
    ${grp([
      row({ glyph:'pie', title:'Вероятность — не прогноз', sub:'Это доля смоделированных недель, а не обещание.' }),
      row({ glyph:'wave', title:'Широкий диапазон — неопределённость', sub:'Значит, модель не уверена.' }),
      row({ glyph:'close', title:'Пропустить — нормально', sub:'Пропустить неделю — тоже решение. Мы его запишем.' }),
      row({ glyph:'info', title:'Иногда модель молчит', sub:'Это честнее, чем угадывать.' }),
    ])}
    <button class="btn w press" data-onb="3">Понятно</button><button class="btn link" data-onb="1" data-back>Назад</button>`;
  else if (S.onb === 3) body = `${dotsH}
    <h1>Вход по почте</h1>
    <p class="p">Паспорт и карта нам не нужны: деньги и проверка личности остаются на бирже.</p>
    <div class="inp"><input type="email" placeholder="you@example.com" value="${esc(S.email)}" data-in="email" autocomplete="email" autocapitalize="none" enterkeyhint="go" aria-label="Почта"></div>
    <p class="fine c">Продолжая, вы соглашаетесь на обработку почты и записей о решениях. Деньги и токены мы не храним.</p>
    <button class="btn w press" data-onb="4">Продолжить</button><button class="btn link" data-onb="2" data-back>Назад</button>`;
  else body = `${dotsH}
    <h1>Последнее: ваше согласие</h1>
    <p class="p">Решения о сделках принимаете вы. Мы считаем и показываем, но не торгуем за вас и не отвечаем за результат.</p>
    <div class="consent">
      ${consentRow('model', 'Я понимаю, что Crypto Analytics показывает расчёты по модели. Это не инвестиционный совет и не прогноз цены.')}
      ${consentRow('loss', 'Я понимаю, что могу потерять все вложенные деньги. Решения о сделках принимаю сам, и сервис не несёт ответственности за мои убытки.')}
    </div>
    <button class="btn link" data-sheet="terms">Прочитать условия использования</button>
    <button class="btn w press" data-onb="done" ${S.cons.model && S.cons.loss ? '' : 'disabled'}>Принять и начать</button><button class="btn link" data-onb="3" data-back>Назад</button>`;
  return `<div class="onb"><div class="box ${dir || ''}">${body}</div></div>`;
}

/* ---------- листы ---------- */
let RV = null, WI = null;
const WHATIF = {
  price:{ t:'Цена −10%', f:s => s * 0.86 }, vol:{ t:'Волатильность выше', f:s => s / 1.25 }, lim:{ t:'Лимит на треть ниже', f:s => s * 0.67 },
  hor:{ t:'Горизонт 3 дня', f:s => s * 1.5 }, stop:{ t:'Стоп ближе', f:s => s * 1.2 }, src:{ t:'Источник недоступен', none:true },
};
const SHEETS = {
  alert(id) { const a = ALERTS.find(x => x.id === id), c = calc();
    return `<span class="tag t-or">${ico(a.icon)}Риск выше обычного</span>
      <h2 class="l">${a.head}</h2>
      ${c.none ? '' : `<div class="money"><small>Ваша сумма на неделю</small><b class="num">${usd(calmSum())} → ${usd(c.sum)}</b></div>`}
      ${grp(a.kv.map(k => row({ title:k[0], val:k[1] })))}
      <p class="body">${a.note}</p>
      <p class="fine">Источники: ${a.src}</p>
      <button class="btn w press" data-act="recalc">Пересчитать сумму</button>
      <button class="btn d press" data-act="close">Понятно</button>`; },
  exit() { const BY = S.country === 'BY';
    return `<h2>Перед переходом на биржу</h2>
      <div class="legal"><b>Можно потерять все вложенные деньги.</b> Токены — не средство платежа и не обеспечены государством. Потери бывают из-за резких скачков цены, сбоев и хищений.</div>
      <div class="legal"><b>Как мы зарабатываем.</b> Биржа платит нам часть своей комиссии с ваших сделок. На расчёт суммы это не влияет.</div>
      ${BY ? `<p class="fine">Биржи — резиденты ПВТ. Сумму и направление сделки вы вводите на бирже сами, мы их не передаём.</p>
        ${grp([
          row({ tile:null, title:'Биржа-партнёр А', sub:'показывает плохую неделю у формы заявки', attrs:'data-exgo="А"', extra:'exrow' }),
          row({ title:'Биржа-партнёр Б', sub:'резидент ПВТ', attrs:'data-exgo="Б"', extra:'exrow' }),
        ])}
        <button class="btn d press tall" data-act="close">Не сейчас</button>`
      : `<p class="body">Для вашей страны партнёров пока нет. Расчёт и журнал работают без перехода.</p><button class="btn d press tall" data-act="close">Понятно</button>`}`; },
  calc() { return `<h2>Изменить расчёт</h2>${calcForm(true)}<button class="btn w press" data-act="close">Готово</button>`; },
  limit() { return `<h2>Лимит потерь на плохую неделю</h2>
      <div class="hero num c" id="limBig">${usd(S.limit)}</div>
      <input type="range" min="50" max="1000" step="10" value="${S.limit}" data-in="limit" aria-label="Лимит потерь">
      <div class="chips c">${[100,300,500].map(v => `<button class="chip num" data-limset="${v}">${usd(v)}</button>`).join('')}</div>
      <p class="fine c">Лимит — главная настройка. Сумма всегда считается так, чтобы плохая неделя в него укладывалась.</p>
      <button class="btn w press" data-act="close">Готово</button>`; },
  whatif() { const base = calc(), w = WI && WHATIF[WI];
    let res;
    if (base.none) res = `<b>Без позиции</b><small>${base.reason}</small>`;
    else if (!w) res = `<b class="num">${usd(base.sum)}</b><small>выберите сценарий выше</small>`;
    else if (w.none) res = `<b class="num">${usd(base.sum)} → без позиции</b><small>без источника данных расчёт ненадёжен</small>`;
    else res = `<b class="num">${usd(base.sum)} → ${usd(Math.min(S.capital, Math.round(w.f(base.sum))))}</b><small>плохая неделя ≤ ${usd(WI === 'lim' ? Math.round(S.limit * 0.67) : S.limit)}</small>`;
    return `<span class="tag t-out">Гипотетически</span>
      <h2 class="l">Что если…</h2>
      <div class="chips">${Object.entries(WHATIF).map(([k, v]) => `<button class="chip sm ${WI === k ? 'on' : ''}" data-wi="${k}">${v.t}</button>`).join('')}</div>
      <div class="money">${res}</div>
      <p class="body">Гипотетический сценарий. Это не новый прогноз модели.</p>
      <button class="btn d press" data-act="close">Вернуться</button>`; },
  factor(id) { const F = FACTORS(), all = [...F.up.map(x => [x, 'за рост']), ...F.down.map(x => [x, 'за падение']), ...F.unk.map(x => [x, 'не знаем'])], [f, dir] = all.find(([x]) => x.id === id);
    return `<h2 class="l">${f.t}</h2><p class="body mut">${dir}${f.p ? ` · сила ${['', 'слабая', 'средняя', 'сильная'][f.p]}` : ''}</p>
      ${grp([row({ title:'Значение', val:f.val }), row({ title:'Источник', sub:f.at ? `${f.at} · данные свежие` : 'нет времени обновления', val:f.src })])}
      ${grp([row({ title:'Как считаем', sub:f.how }), row({ title:'Ограничение', sub:f.lim })])}
      <p class="fine">Это вклад в расчёт модели, а не причина движения цены.</p>
      <button class="btn d press" data-act="close">Понятно</button>`; },
  regime() { const cur = S.noSignal ? 'unk' : S.alertOn ? 'stress' : 'range';
    const R = [['trend','Тренд','цена устойчиво движется в одну сторону'],['range','Боковик','цена ходит в коридоре'],['stress','Стресс','перекос плеча и резкие движения'],['unk','Неясно','данных мало или они противоречат друг другу']];
    return `<h2 class="l">Режим рынка</h2>${grp(R.map(([k, t, s]) => row({ title:t, sub:s, right:k === cur ? `<span class="st ok">${ico('check')}</span>` : '' })))}
      <p class="fine">Режим определяет модель по волатильности, тренду и деривативам. В режиме «Стресс» диапазон шире, а сумма под лимит меньше.</p>
      <button class="btn d press" data-act="close">Понятно</button>`; },
  data() { const f = fresh();
    return `<h2 class="l">Данные и модель</h2>
      ${grp([row({ title:'Актив', val:'BTC/USDT · спот' }), row({ title:'Горизонт', sub:'другие горизонты не подменяем ближайшим', val:'7 дней' }), row({ title:'Рассчитано', val:S.noSignal ? '17 окт., 09:30' : '18 окт., 09:30' }), row({ title:'Данные', sub:'Binance, Bybit, OKX, Deribit', val:`<i class="fd ${f.c}"></i>${f.t}` })])}
      ${grp([row({ title:'Надёжность', sub:'10 из 12 недель в диапазоне 80%', attrs:'data-go="archive"' }), row({ title:'Версия модели', val:'v0.4' })])}
      <button class="btn d press" data-act="close">Понятно</button>`; },
  rules() { return `<h2 class="l">Как читать прогноз</h2>${grp([
      row({ glyph:'pie', title:'Вероятность — не прогноз', sub:'Это доля смоделированных недель, а не обещание.' }),
      row({ glyph:'wave', title:'Широкий диапазон — неопределённость', sub:'Значит, модель не уверена.' }),
      row({ glyph:'close', title:'Пропустить — нормально', sub:'Это тоже решение, мы его запишем.' }),
      row({ glyph:'info', title:'Иногда модель молчит', sub:'Это честнее, чем угадывать.' })])}
      <button class="btn d press" data-act="close">Понятно</button>`; },
  terms() { return `<h2 class="l">Условия использования</h2>
      <p class="fine">Версия от 18.10.2026. Черновик для прототипа, текст нужно согласовать с юристом.</p>
      ${grp([
        row({ glyph:'info', title:'Что такое сервис', sub:'Информационный и аналитический сервис. Показывает диапазоны и вероятности по модели, считает сумму под ваш лимит. Не даёт инвестиционных советов и не прогнозирует цену.' }),
        row({ glyph:'shield', title:'Риски', sub:'Токены не являются средством платежа и не обеспечены государством. Цена может резко меняться, возможна потеря всех вложенных денег, а также потери из-за сбоев и хищений.' }),
        row({ glyph:'close', title:'Ответственность', sub:'Решения о сделках вы принимаете самостоятельно. Сервис не несёт ответственности за ваши убытки и упущенную выгоду, в том числе если вы опирались на расчёты, оповещения или ответы ассистента.' }),
        row({ glyph:'lock', title:'Деньги и сделки', sub:'Мы не храним деньги и токены и не отправляем заявки. Сделки, деньги и проверка личности — на бирже-партнёре по её правилам.' }),
        row({ glyph:'pie', title:'Модель может ошибаться', sub:'Прошлые результаты модели не гарантируют будущих. Промахи мы показываем в архиве.' }),
      ])}
      <button class="btn d press" data-act="close">Понятно</button>`; },
  jitem(id) { const j = S.journal.find(x => x.id === id); const H = { range:'боковик', up:'рост', down:'падение', unk:'не знаю' };
    return `<h2 class="l">${jTitle(j)}</h2><p class="body mut">${j.date}</p>
      ${grp([row({ title:'Сумма на неделю', val:j.plan ? usd(j.plan) : '—' }), row({ title:'Лимит', val:usd(S.limit) }), row({ title:'Гипотеза', val:j.hyp ? H[j.hyp] : 'не указана' }), row({ title:'Уверенность', val:j.conf ? ['', 'низкая', 'средняя', 'высокая'][j.conf] : 'не указана' })])}
      ${j.pending ? `<p class="fine">Разбор — ${j.reviewDate || '25 окт.'}. Напомним в ленте «Сегодня».</p>` : grp([row({ title:'Цена', val:j.inRange === false ? 'вне диапазона' : 'в диапазоне' }), j.invested != null ? row({ title:'Вложил', val:usd(j.invested) }) : ''])}
      <button class="btn d press" data-act="close">Закрыть</button>`; },
  review() { const j = S.journal.find(x => x.id === RV.id), st = RV.step;
    const pd = `<div class="dots sm">${[0,1,2,3,4].map(i => `<i class="${i <= st ? 'on' : ''}"></i>`).join('')}</div>`;
    const next = (label = 'Дальше') => `<button class="btn w press" data-act="rvnext">${label}</button>`;
    let b;
    if (st === 0) b = `<h2>Цена осталась в диапазоне?</h2>${grp([row({ title:'План', val:`до ${usd(j.plan)}` }), row({ title:'Цена за неделю', val:'$84 900 → $86 530' }), row({ title:'Диапазон 80% по модели', val:'попали', vc:'up' })])}${next()}`;
    else if (st === 1) b = `<h2>Сколько вложили на самом деле?</h2><div class="inp"><span>$</span><input inputmode="decimal" enterkeyhint="done" data-in="rvinv" value="${RV.inv}" placeholder="например, 3 000" aria-label="Сколько вложили"></div>
      <div class="chips"><button class="chip ${RV.notIn ? 'on' : ''}" data-rv="notIn">Не входил</button></div>${next()}`;
    else if (st === 2) b = `<h2>Лимит ${usd(S.limit)} соблюдён?</h2><div class="chips">${['Да','Нет'].map((t, i) => `<button class="chip ${RV.lim === i ? 'on' : ''}" data-rvlim="${i}">${t}</button>`).join('')}</div>${next()}`;
    else if (st === 3) b = `<h2>Модель была слишком уверена?</h2><div class="chips">${['Нет','Да','Не знаю'].map((t, i) => `<button class="chip ${RV.conf === i ? 'on' : ''}" data-rvconf="${i}">${t}</button>`).join('')}</div>${next()}`;
    else b = `<h2>Чего не хватило для решения?</h2><div class="inp"><input data-in="rvmiss" value="${esc(RV.miss)}" placeholder="необязательно" enterkeyhint="done" aria-label="Чего не хватило"></div>${next('Сохранить разбор')}`;
    return `${pd}${b}<p class="fine c">Разбор ${j.date} · сумму вводите вы сами, позже можно подключить биржу только на чтение.</p>`; },
  api() { const p = S.apiPerm, r = (k, t) => `<div class="row"><span class="gl">${ico(k === 'read' ? 'lock' : 'close')}</span><span class="rt"><b>${t}</b><small>${k === 'read' ? 'нужно для разбора' : 'должно быть выключено'}</small></span>${toggle(`data-perm="${k}"`, p[k], t)}</div>`;
    return `<h2>Ключ API биржи-партнёра А</h2>
      <p class="fine c">В демо можно выбрать, какие права «нашлись» у ключа при проверке.</p>
      <div class="inp"><input value="ca_demo_7f3e…b21" readonly aria-label="Ключ API"></div>
      ${grp([r('read', 'Чтение истории'), r('trade', 'Торговля'), r('withdraw', 'Вывод средств')])}
      <div id="apiErr"></div>
      <button class="btn w press" data-act="apiconnect">Проверить и подключить</button>
      <button class="btn d press" data-act="close">Отмена</button>`; },
  voice() { return chatSheet(); },
};

/* слой окон: на телефоне лист снизу со смахиванием, на десктопе окно по центру */
const layer = document.createElement('div'); layer.className = 'layer'; layer.innerHTML = '<div class="scrim" data-act="close"></div><div class="sheet" role="dialog" aria-modal="true"></div>';
const sheet = layer.querySelector('.sheet'), scrim = layer.querySelector('.scrim');
let sheetType = null, sheetArg = null, lastFocus = null;
function openSheet(type, arg) {
  sheetType = type; sheetArg = arg; lastFocus = document.activeElement;
  sheet.dataset.type = type;
  sheet.innerHTML = `<span class="grab" aria-hidden="true"></span>${SHEETS[type](arg)}`;
  sheet.style.transform = ''; sheet.style.transition = ''; scrim.style.opacity = '';
  sheet.scrollTop = 0;
  requestAnimationFrame(() => requestAnimationFrame(() => { layer.classList.add('open'); const f = sheet.querySelector('button,input'); if (f && !isPhone()) f.focus({preventScroll:true}); }));
  if (type === 'voice') initChat();
}
function refreshSheet() { if (!sheetType) return; const st = sheet.scrollTop; sheet.innerHTML = `<span class="grab" aria-hidden="true"></span>${SHEETS[sheetType](sheetArg)}`; sheet.scrollTop = st; }
function closeSheet() {
  if (!sheetType) return;
  sheetType = null; stopChat();
  sheet.style.transition = ''; sheet.style.transform = ''; scrim.style.opacity = '';
  layer.classList.remove('open');
  if (lastFocus && lastFocus.isConnected) lastFocus.focus({preventScroll:true});
}
/* смахивание листа вниз: 1:1 за пальцем, резинка вверх, закрытие по расстоянию или скорости */
(function dragSheet() {
  let y0 = 0, dy = 0, drag = false, id = null, hist = [];
  sheet.addEventListener('pointerdown', e => {
    if (!isPhone() || drag || e.target.closest('button,input,select,a,summary,.msgs')) return;
    if (sheet.scrollTop > 0 && !e.target.closest('.grab')) return;
    drag = true; id = e.pointerId; y0 = e.clientY; dy = 0; hist = [[performance.now(), 0]];
    sheet.setPointerCapture(id); sheet.style.transition = 'none';
  });
  sheet.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== id) return;
    const raw = e.clientY - y0;
    dy = raw >= 0 ? raw : -((-raw) * 40) / (40 + (-raw));
    sheet.style.transform = `translateY(${dy}px)`;
    scrim.style.transition = 'none'; scrim.style.opacity = String(Math.max(0, 1 - dy / sheet.offsetHeight));
    hist.push([performance.now(), raw]); if (hist.length > 5) hist.shift();
  });
  const end = e => {
    if (!drag || e.pointerId !== id) return; drag = false;
    const a = hist[0], b = hist[hist.length - 1], v = (b[1] - a[1]) / Math.max(1, b[0] - a[0]);
    scrim.style.transition = '';
    if (dy > sheet.offsetHeight * 0.25 || v > 0.11 && dy > 10) closeSheet();
    else { sheet.style.transition = ''; sheet.style.transform = ''; scrim.style.opacity = ''; }
  };
  sheet.addEventListener('pointerup', end); sheet.addEventListener('pointercancel', end);
})();

/* ассистент в микрофоне: отвечает на любые вопросы, но не говорит, вырастет или упадёт цена.
   С ключом OpenRouter (или своим прокси) — живые ответы модели, без ключа — демо-режим с заготовками. */
const AI_KEY = 'ca-ai-v2';
const MODELS = [
  { id:'deepseek/deepseek-v4.1-flash', name:'DeepSeek V4.1 Flash', note:'≈0,01 ¢ за ответ' },
  { id:'google/gemma-4-31b-it:free', name:'Gemma 4 31B', note:'бесплатно, бывают лимиты' },
];
let AI = { key:'', proxy:'', model:MODELS[0].id };
try { AI = Object.assign(AI, JSON.parse(localStorage.getItem(AI_KEY) || '{}')); } catch (e) {}
const saveAI = () => { try { localStorage.setItem(AI_KEY, JSON.stringify(AI)); } catch (e) {} };
const aiLive = () => !!(AI.key || AI.proxy);
const modelName = () => (MODELS.find(m => m.id === AI.model) || { name:AI.model.split('/').pop() }).name;

/* потоковый ответ в формате OpenAI-совместимого API (OpenRouter или свой прокси) */
async function streamChat(messages, onText) {
  const url = AI.proxy ? AI.proxy.replace(/\/$/, '') + '/chat' : 'https://openrouter.ai/api/v1/chat/completions';
  const headers = { 'Content-Type':'application/json' };
  if (!AI.proxy) Object.assign(headers, { 'Authorization':'Bearer ' + AI.key, 'X-Title':'Crypto Analytics prototype' });
  const res = await fetch(url, { method:'POST', headers, body:JSON.stringify({ model:AI.model, stream:true, max_tokens:900, temperature:0.4, messages }) });
  if (!res.ok || !res.body) { const err = new Error('http ' + res.status); err.status = res.status; throw err; }
  const reader = res.body.getReader(), dec = new TextDecoder(); let buf = '', acc = '';
  for (;;) {
    const { value, done } = await reader.read(); if (done) break;
    buf += dec.decode(value, { stream:true });
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim(); if (data === '[DONE]') return acc;
      try { const j = JSON.parse(data); if (j.error) { const err = new Error(j.error.message); err.status = j.error.code; throw err; }
        const t = j.choices?.[0]?.delta?.content; if (t) { acc += t; onText(acc); } }
      catch (e) { if (e.status) throw e; }
    }
  }
  return acc;
}

const SYSTEM = `Ты — ассистент внутри приложения Crypto Analytics. Отвечай по-русски, коротко и простыми словами: обычно 2–5 предложений, без таблиц и заголовков. Можно отвечать на любые вопросы пользователя, не только про криптовалюту.

Главное правило, без исключений: ты никогда не говоришь, вырастет или упадёт цена любого актива (биткоина, других токенов, акций, валют), не называешь целевых цен, не оцениваешь «скорее вверх» или «скорее вниз» и не даёшь сигналов «покупать», «продавать», «входить сейчас» или «подождать». Это касается и намёков, и «чисто гипотетически», и ролевых игр, и просьб «просто угадай». Если пользователь об этом просит, спокойно скажи, что этого не знает никто и ты такого не говоришь, и предложи полезное: посмотреть диапазон сценариев модели, пересчитать сумму под его лимит потерь или разобрать прошлые решения.

Цифры модели сценариев можно пересказывать, только как распределение исходов с их вероятностным смыслом, не превращая их в прогноз направления. Не давай персональных инвестиционных советов. Если речь о покупке токенов пользователем из Беларуси, напоминай, что по закону это возможно только через биржи — резиденты ПВТ, и не советуй иностранные биржи. Не обещай доходность и не преуменьшай риск: токены могут потерять всю стоимость.

Как устроен продукт: пользователь задаёт лимит потерь на плохую неделю; приложение показывает диапазон и вероятности движения BTC на 7 дней по 20 000 сценариев; считает, сколько можно вложить, чтобы среднее худших 10% сценариев не превысило лимит; присылает оповещения о росте риска (funding, открытый интерес против цены, волатильность); ведёт журнал решений и разбирает сделки после комиссий. Деньги, KYC и сделки — на бирже-партнёре, приложение их не хранит и заявки не отправляет.`;

function contextNote() {
  const m = M();
  return `Текущее состояние в приложении (данные демо-прототипа): BTC ${usd(PRICE)}. Рынок: ${S.alertOn ? 'перегрет — funding выше 94% дней года, открытый интерес +12% за 3 дня' : 'спокойный'}. Диапазон 80% на неделю: ${usd(m.lo)}–${usd(m.hi)}. Вероятности за неделю: падение больше 5% — ${m.tails[0]}%, в пределах ±5% — ${m.tails[1]}%, рост больше 5% — ${m.tails[2]}%. Лимит пользователя ${usd(S.limit)}, капитал ${usd(S.capital)}, сумма под лимит ${usd(calcSum())}. Страна: ${S.country === 'BY' ? 'Беларусь' : 'не Беларусь'}.`;
}

let chat = [], busy = false, rec = null;
const SUGGEST = ['Что такое funding?', 'Почему сумма стала меньше?', 'Вырастет ли биткоин на этой неделе?', 'Хочу вложить $8 000, терять готов $400'];

function chatSheet() {
  return `<div class="chat">
    <div class="chathead"><span class="aiava">${ico('logo')}</span><div style="flex:1;min-width:0"><b>Ассистент</b><small>Объясняет и считает. Цену не предсказывает.</small></div><span class="tag ${aiLive() ? 't-gr' : 't-gy'}">${aiLive() ? esc(modelName()) : 'демо'}</span></div>
    <div class="msgs" id="msgs" aria-live="polite"></div>
    <form class="composer" id="composer" autocomplete="off">
      <button type="button" class="micin press" data-act="listen" aria-label="Сказать голосом">${ico('mic')}</button>
      <input id="q" placeholder="Спросите что угодно…" enterkeyhint="send" aria-label="Вопрос ассистенту">
      <button type="submit" class="sendb press" aria-label="Отправить">${ico('send')}</button>
    </form>
    <p class="fine c">Ассистент не говорит, вырастет или упадёт цена, и не даёт сигналов. ${aiLive() ? 'Ответы ИИ могут быть неточными.' : 'Демо-режим: подключите модель в Профиле → Ассистент, чтобы задавать любые вопросы.'}</p>
  </div>`;
}
function bubble(role, html, extra = '') { return `<div class="msg ${role} ${extra}">${html}</div>`; }
function esc(s) { return s.replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c])); }
function fmtAnswer(s) { return esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>'); }
function renderChat() {
  const box = document.getElementById('msgs'); if (!box) return;
  const hello = bubble('ai', 'Привет! Спросите что угодно: про рынок, термины, ваш план или вообще не про крипту. Скажу честно: вырастет ли цена или упадёт, я не говорю — этого не знает никто.');
  box.innerHTML = hello + chat.map(m => m.card ? m.card : bubble(m.role === 'user' ? 'me' : 'ai', m.role === 'user' ? esc(m.content) : fmtAnswer(m.content), m.err ? 'err' : '')).join('')
    + (chat.length ? '' : `<div class="sugg">${SUGGEST.map(s => `<button class="chip press" data-ask="${esc(s)}">${esc(s)}</button>`).join('')}</div>`);
  box.scrollTop = box.scrollHeight;
}
function initChat() {
  renderChat();
  const f = document.getElementById('composer');
  f.addEventListener('submit', e => { e.preventDefault(); const q = document.getElementById('q'); const t = q.value.trim(); if (t) { q.value = ''; ask(t); } });
  if (!isPhone()) setTimeout(() => document.getElementById('q')?.focus({ preventScroll:true }), 300);
}
function stopChat() { if (rec) { try { rec.abort(); } catch (e) {} rec = null; } }

/* «Хочу вложить $8 000, терять готов $400» → карточка «Поняли так» без запроса к модели */
function parsePlan(t) {
  const s = t.toLowerCase().replace(/(\d)\s+(?=\d{3}\b)/g, '$1');
  if (!/влож|инвест|купить на|потрат/.test(s)) return null;
  const num = str => { const m = str.match(/(\d+(?:[.,]\d+)?)\s*(к|k|тыс)?/); return m ? Math.round(parseFloat(m[1].replace(',', '.')) * (m[2] ? 1000 : 1)) : null; };
  const li = s.search(/терят|потер|лимит|риск|минус/);
  const cap = num(li > 0 ? s.slice(0, li) : s);
  const lim = li >= 0 ? num(s.slice(li)) ?? num(s.slice(0, li).replace(String(cap), '')) : null;
  if (!cap) return null;
  return { cap, lim: lim && lim < cap ? lim : S.limit };
}
function planCard(p) {
  return `<div class="msg ai card-msg"><div class="day" style="margin-bottom:6px">Поняли так</div>
    <div class="understood">
      <div class="row"><span class="cat c-bl">${ico('in')}</span><div><b>Вложить</b><small>BTC · спот</small></div><span class="v num">${usd(p.cap)}</span></div>
      <div class="row"><span class="cat c-rd">${ico('shield')}</span><div><b>Лимит потерь</b><small>плохая неделя</small></div><span class="v dn num">−${usd(p.lim)}</span></div>
      <div class="row"><span class="cat c-gy">${ico('clock')}</span><div><b>Горизонт</b><small>проверенный</small></div><span class="v">7 дней</span></div>
    </div>
    <button class="btn w press" style="margin-top:10px" data-act="voiceok" data-pcap="${p.cap}" data-plim="${p.lim}">Рассчитать</button></div>`;
}

/* демо-ответы без ключа: то же правило — о направлении цены не говорим */
const DIRECTION = /(вырас|упад|подним|опуст|рост|пад[её]т|будет стоить|прогноз|куда пойд|пойд[её]т|выше|ниже|памп|дамп|покупать|продавать|входить|стоит ли (купить|продать|брать)|когда (купить|продать)|сколько будет)/i;
function demoAnswer(t) {
  const m = M(), s = t.toLowerCase();
  if (DIRECTION.test(s)) return `Этого я не скажу: куда пойдёт цена, не знает никто, и угадывать я не буду. Могу показать, что видит модель: в 8 из 10 сценариев BTC через неделю будет между **${usd(m.lo)}** и **${usd(m.hi)}**, падение больше 5% — в ${m.tails[0]}% сценариев, рост больше 5% — в ${m.tails[2]}%. Хотите, посчитаю сумму под ваш лимит ${usd(S.limit)}?`;
  if (/funding|фандинг|финансир/.test(s)) return `Funding — это плата, которой обмениваются трейдеры с плечом на бессрочных фьючерсах. Когда она высокая, значит, многие держат позиции в одну сторону с плечом. ${S.alertOn ? 'Сейчас она выше, чем в 94% дней года, поэтому мы прислали оповещение: при таком перекосе резкие движения случаются чаще.' : 'Сейчас она в обычном диапазоне.'}`;
  if (/сумм|меньше|почему/.test(s)) return S.alertOn ? `Риск вырос: в плохую неделю модель теперь ожидает падение около ${String(m.worst).replace('.', ',')}%, а не 8,7%. Чтобы такая неделя стоила вам не больше ${usd(S.limit)}, сумма стала **${usd(calcSum())}** вместо $3 467. Это расчёт, а не совет — пропустить тоже нормально.` : `Сумма считается так, чтобы среднее худших 10% недель стоило вам не больше лимита ${usd(S.limit)}. Сейчас это **${usd(calcSum())}** из ${usd(S.capital)}.`;
  if (/пвт|бирж|закон|легал/.test(s)) return 'В Беларуси покупать и продавать токены за деньги можно только через биржи — резиденты ПВТ (Указ № 367). Поэтому мы ведём только туда, а сама сделка, деньги и проверка личности остаются на бирже.';
  if (/лимит/.test(s)) return `Лимит — сколько вы готовы потерять за плохую неделю. Сейчас он ${usd(S.limit)}. Мы задаём его до того, как вы увидите рынок, чтобы не подгонять под желание войти. Поменять можно в «Решении на неделю» → «Изменить расчёт».`;
  if (/привет|здрав|hello|hi\b/.test(s)) return 'Привет! Чем помочь? Могу объяснить термины, ваш план или оповещение — или ответить на вопрос не про крипту.';
  return 'В демо-режиме я отвечаю только на несколько тем: funding, сумма под лимит, лимит, биржи ПВТ. Подключите модель в Профиле → Ассистент, и я отвечу на любой вопрос — кроме того, вырастет или упадёт цена.';
}
async function typeOut(el, text) {
  if (reduce()) { el.innerHTML = fmtAnswer(text); return; }
  const words = text.split(/(\s+)/); let acc = '';
  for (const w of words) { acc += w; el.innerHTML = fmtAnswer(acc); el.parentNode && (el.parentNode.scrollTop = el.parentNode.scrollHeight); await new Promise(r => setTimeout(r, 18)); }
}

async function ask(text) {
  if (busy) return;
  const box = document.getElementById('msgs'); if (!box) return;
  chat.push({ role:'user', content:text });
  const plan = parsePlan(text);
  if (plan) {
    chat.push({ role:'assistant', content:`Поняли так: вложить ${usd(plan.cap)}, лимит потерь ${usd(plan.lim)}, горизонт 7 дней.`, card:planCard(plan) });
    return renderChat();
  }
  renderChat();
  busy = true;
  box.insertAdjacentHTML('beforeend', `<div class="msg ai typing" id="live"><span class="dots3"><i></i><i></i><i></i></span></div>`);
  box.scrollTop = box.scrollHeight;
  const live = document.getElementById('live');
  try {
    if (!aiLive()) {
      await new Promise(r => setTimeout(r, 450));
      const a = demoAnswer(text);
      live.classList.remove('typing'); await typeOut(live, a);
      chat.push({ role:'assistant', content:a });
    } else {
      const history = chat.filter(m => !m.err).slice(-20).map(m => ({ role:m.role, content:m.content }));
      history[history.length - 1] = { role:'user', content:`${contextNote()}\n\nВопрос пользователя: ${text}` };
      let acc = await streamChat([{ role:'system', content:SYSTEM }, ...history], t => { live.classList.remove('typing'); live.innerHTML = fmtAnswer(t); box.scrollTop = box.scrollHeight; });
      if (!acc.trim()) acc = 'Не получилось сформулировать ответ. Попробуйте спросить иначе.';
      live.innerHTML = fmtAnswer(acc);
      chat.push({ role:'assistant', content:acc });
    }
  } catch (e) {
    const st = e && e.status;
    const msg = st === 401 ? 'Ключ не подошёл. Проверьте его в Профиле → Ассистент.' : st === 402 ? 'На счёте OpenRouter закончились деньги. Пополните его или выберите бесплатную модель.' : st === 429 ? 'Бесплатная модель сейчас перегружена или упёрлась в лимит. Подождите немного или выберите другую модель.' : !navigator.onLine ? 'Нет интернета. Проверьте подключение.' : 'Не удалось связаться с ассистентом. Попробуйте ещё раз.';
    chat.push({ role:'assistant', content:msg, err:true });
  } finally {
    busy = false; live && live.removeAttribute('id'); renderChat();
  }
}

/* голосовой ввод: Web Speech API, где он есть */
function listen(btn) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return toast('Голосовой ввод в этом браузере недоступен — напишите текстом');
  if (rec) { rec.stop(); return; }
  rec = new SR(); rec.lang = 'ru-RU'; rec.interimResults = true; rec.maxAlternatives = 1;
  const q = document.getElementById('q'); let finalText = '';
  btn.classList.add('on');
  rec.onresult = e => { let t = ''; for (const r of e.results) t += r[0].transcript; q.value = t; if (e.results[e.results.length - 1].isFinal) finalText = t; };
  rec.onerror = e => { if (e.error === 'not-allowed') toast('Разрешите доступ к микрофону, чтобы говорить'); };
  rec.onend = () => { btn.classList.remove('on'); rec = null; const t = (finalText || q.value).trim(); if (t) { q.value = ''; ask(t); } };
  try { rec.start(); } catch (e) { btn.classList.remove('on'); rec = null; }
}


/* баннер-уведомление и тост */
const banner = document.createElement('button'); banner.className = 'banner'; banner.type = 'button';
let bannerT;
function showBanner(title, text, onTap) {
  banner.innerHTML = `<span class="ai">${ico('logo')}</span><span style="flex:1;min-width:0"><span class="t"><b>${title}</b><small>сейчас</small></span><p>${text}</p></span>`;
  banner.onclick = () => { hideBanner(); onTap && onTap(); };
  requestAnimationFrame(() => banner.classList.add('show'));
  clearTimeout(bannerT); bannerT = setTimeout(hideBanner, 6000);
}
function hideBanner() { banner.classList.remove('show'); }
(function swipeBanner() { let y0 = null;
  banner.addEventListener('pointerdown', e => { y0 = e.clientY; });
  banner.addEventListener('pointerup', e => { if (y0 !== null && y0 - e.clientY > 20) { banner.onclick = null; hideBanner(); } y0 = null; }); })();
const toastEl = document.createElement('div'); toastEl.className = 'toast'; toastEl.setAttribute('role', 'status');
let toastT;
function toast(t) { toastEl.innerHTML = ico('check') + `<span>${t}</span>`; toastEl.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('show'), 2400); }
const alertBanner = () => showBanner('Риск на неделю вырос', 'Падение больше 5% по модели: 15% → 19%. Сумма на неделю стала меньше.', () => openSheet('alert', 'funding'));

/* ---------- биржа ---------- */
const exl = document.createElement('div'); exl.className = 'exlayer'; exl.setAttribute('aria-hidden', 'true');
let exSide = 'buy', exAmt = '';
function exChartSVG() {
  let y = 120; const pts = [];
  for (let i = 0; i <= 60; i++) { y += Math.sin(i * 1.7) * 6 + Math.cos(i * .6) * 5 - .6; pts.push([i * 10, Math.max(20, Math.min(200, y))]); }
  const p = pts.map((q, i) => (i ? 'L' : 'M') + q[0] + ' ' + q[1].toFixed(1)).join(' ');
  return `<svg viewBox="0 0 600 220" preserveAspectRatio="none" aria-hidden="true"><path d="${p} L600 220 L0 220Z" fill="rgba(31,157,107,.10)"/><path d="${p}" fill="none" stroke="#1f9d6b" stroke-width="2"/></svg>`;
}
function exModule() {
  const a = parseFloat(String(exAmt).replace(/\s/g, '').replace(',', '.')) || 0;
  const limB = Math.round(S.limit * USD_BYN), badB = Math.round(a * M().bad), ok = badB <= limB;
  return `<div class="h">${ico('logo')}Crypto Analytics · риск недели</div>
    <div class="m"><span>Плохая неделя для этой суммы</span><b class="num">${a ? '−' + fmt(badB) + ' BYN' : '—'}</b></div>
    <div class="m"><span>Ваш лимит</span><span class="num" style="color:${a ? (ok ? '#30d158' : '#ff453a') : '#8e8e93'}">${fmt(limB)} BYN ${a ? (ok ? '✓' : '— превышен') : ''}</span></div>
    <small>Смоделированная оценка, не совет. Модуль не видит ваш баланс и не меняет заявку.</small>`;
}
function openExchange() {
  const isA = S.exPick !== 'Б'; exAmt = ''; exSide = 'buy';
  exl.innerHTML = `<div class="exwin">
    <div class="exbar"><i>${isA ? 'А' : 'Б'}</i><div><b>Биржа-партнёр ${isA ? 'А' : 'Б'}</b><small>резидент ПВТ · вход и KYC на бирже</small></div>
      <button class="back" data-ex="back">${ico('back')}<span class="hide-m">Вернуться в </span>Crypto Analytics</button></div>
    <div class="exbody">
      <div class="exchart"><div class="expair num"><b>BTC/BYN</b><span>${fmt(BTC_BYN)}</span></div>${exChartSVG()}<small style="color:var(--ex-mut)">Демо-экран биржи. Курс условный.</small></div>
      <div class="exform">
        <div class="extabs"><button class="on" data-side="buy">Купить</button><button data-side="sell">Продать</button></div>
        <label class="exfld">Сумма, BYN<input inputmode="decimal" placeholder="0" data-exin></label>
        <div class="exfld">Получу, BTC<b class="num" id="exBtc">0,000000</b></div>
        ${isA ? `<div class="ourmod" id="ourmod">${exModule()}</div>` : ''}
        <button class="exbtn" data-ex="buy">Купить BTC</button>
        <div class="exzone"><div>${ico('in')}Вход и проверка личности — у биржи</div><div>${ico('wallet')}Деньги, хранение, вывод — у биржи</div><div>${ico('swap')}Сделка и исполнение — у биржи</div></div>
      </div>
    </div></div>`;
  exl.setAttribute('aria-hidden', 'false'); exl.scrollTop = 0;
  requestAnimationFrame(() => exl.classList.add('show'));
}
function exBack() {
  closeExchange(); go('journal');
  const who = exReturn; exReturn = null;
  setTimeout(() => toast(who ? `Переход к бирже ${who} записан в журнал. Разбор — 25 окт.` : 'Сделка остаётся на бирже. Разбор — через неделю'), 420);
}
function closeExchange() {
  exl.classList.add('hiding'); exl.classList.remove('show'); exl.setAttribute('aria-hidden', 'true');
  setTimeout(() => exl.classList.remove('hiding'), 460);
}
exl.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.ex === 'back') exBack();
  if (b.dataset.ex === 'buy') toast('Это демо биржи: заявка не отправляется');
  if (b.dataset.side) { exSide = b.dataset.side; exl.querySelectorAll('[data-side]').forEach(x => x.classList.toggle('on', x === b)); exl.querySelector('[data-ex="buy"]').textContent = (exSide === 'buy' ? 'Купить' : 'Продать') + ' BTC'; }
});
exl.addEventListener('input', e => {
  if (!e.target.hasAttribute('data-exin')) return;
  exAmt = e.target.value; const a = parseFloat(exAmt.replace(/\s/g, '').replace(',', '.')) || 0;
  exl.querySelector('#exBtc').textContent = (a / BTC_BYN).toFixed(6).replace('.', ',');
  const m = exl.querySelector('#ourmod'); if (m) m.innerHTML = exModule();
});


/* ---------- отрисовка ---------- */
const root = document.getElementById('root');
let shellOn = false;
function renderShell() {
  root.innerHTML = `<div class="shell">
    <aside class="side" aria-label="Разделы">
      <div class="brand"><span class="appic">${ico('logo')}</span>Crypto Analytics</div>
      ${TABS.map(k => `<button class="nav" data-go="${k}">${ico(VIEWS[k].i)}${VIEWS[k].t}</button>`).join('')}
      <button class="nav" data-act="voice">${ico('mic')}Ассистент</button>
      <div class="grow"></div>
      <button class="nav me" data-go="profile"><span class="ava sm">${initial()}</span><span class="rt"><b>Профиль</b><small>${S.email ? esc(S.email) : 'демо-аккаунт'}</small></span></button>
    </aside>
    <main class="main"><div id="view"></div></main>
    <nav class="dock" aria-label="Разделы">
      <div class="tabs"><span class="ind" aria-hidden="true"></span>${TABS.map(k => `<button class="tab" data-go="${k}">${ico(VIEWS[k].i)}<span>${VIEWS[k].t}</span></button>`).join('')}</div>
      <button class="mic press" data-act="voice" aria-label="Спросить ассистента">${ico('mic')}</button>
    </nav>
  </div>`;
  shellOn = true;
}
function syncChrome() {
  const tab = VIEWS[S.view].tab || S.view, deep = VIEWS[S.view].d > 0, prof = ['profile','alerts','assistant'].includes(S.view);
  const mark = (b, on) => { b.classList.toggle('on', on); on ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current'); };
  root.querySelectorAll('.nav[data-go]').forEach(b => mark(b, prof ? b.dataset.go === 'profile' : b.dataset.go === tab));
  root.querySelectorAll('.tab').forEach(b => mark(b, b.dataset.go === tab));
  const sh = root.querySelector('.shell'); if (sh) sh.classList.toggle('deep', deep);
  const ind = root.querySelector('.dock .ind'), i = TABS.indexOf(tab);
  if (ind) ind.style.transform = `translateX(${Math.max(0, i) * 76}px)`;
  document.body.classList.toggle('docked', isPhone() && !deep);
}
/* смена суммы — короткое размытие (220 мс), а не прокрутка цифр; при входе на экран ничего не анимируем */
const shown = {};
function swaps(scope, animate) {
  scope.querySelectorAll('[data-sw]').forEach(el => {
    const k = el.dataset.sw, v = el.dataset.v, prev = shown[k];
    shown[k] = v;
    if (animate && prev !== undefined && prev !== v && !reduce()) { el.classList.remove('swap'); void el.offsetWidth; el.classList.add('swap'); }
  });
}
function viewHTML() {
  return { today:vToday, scen:() => vScen(false), journal:vJournal, sum:vSum, archive:() => vArchive(false), profile:vProfile, alerts:vAlerts, assistant:vAssistant }[S.view]();
}
/* nav: 'push' — вглубь, 'pop' — назад, 'tab' — переключение вкладки (мгновенно), undefined — обновление на месте */
function renderView(nav) {
  const view = document.getElementById('view');
  const f = document.activeElement, key = f && f.dataset && f.dataset.in, caret = key && f.selectionStart;
  if (nav) fanK = M().k;
  view.innerHTML = `<div class="${nav === 'push' ? 'push' : nav === 'pop' ? 'pop' : ''}">${viewHTML()}</div>`;
  swaps(view, !nav);
  if (!nav) morphFan();
  if (key && !sheetType) { const el = view.querySelector(`[data-in="${key}"]`); if (el) { el.focus({preventScroll:true}); try { el.setSelectionRange(caret, caret); } catch (e) {} } }
  syncChrome();
}
function render(opts = {}) {
  if (S.onb === 'land') { shellOn = false; document.body.classList.remove('docked'); root.innerHTML = vLanding(); return; }
  if (S.onb === 'ex') { shellOn = false; document.body.classList.remove('docked'); if (opts.nav) fanK = M().k; root.innerHTML = vExample(); if (!opts.nav) morphFan(); return; }
  if (S.onb !== 'done') { shellOn = false; document.body.classList.remove('docked'); root.innerHTML = vOnb(opts.dir); return; }
  if (!shellOn) renderShell();
  renderView(opts.nav);
}
function go(v) {
  if (!VIEWS[v]) return;
  if (location.hash !== '#/' + v) { location.hash = '/' + v; return; }
  show(v);
}
function show(v) {
  const from = VIEWS[S.view] || VIEWS.today, to = VIEWS[v];
  const nav = to.d > from.d ? 'push' : to.d < from.d ? 'pop' : (v === S.view ? undefined : 'tab');
  S.view = v; save(); render({ nav: nav || 'tab' }); window.scrollTo({ top:0 });
}
addEventListener('hashchange', () => {
  const v = location.hash.replace('#/', '');
  if (S.onb !== 'done' || !VIEWS[v] || v === S.view) return;
  closeSheet(); show(v);
});
const toastSoon = t => setTimeout(() => toast(t), sheetType ? 280 : 0);

/* ---------- действия ---------- */
function setAlert(on) {
  S.alertOn = on; save();
  render();
  if (sheetType) refreshSheet();
  if (on) setTimeout(alertBanner, 250); else toast('Рынок успокоился');
}
function record(kind, extra) {
  const c = calc();
  const e = Object.assign({ id:Date.now(), date:'18 окт.', kind, plan:c.sum || 0, pending:true, reviewDate:'25 окт.', hyp:S.hyp, conf:S.conf, note:S.note }, extra || {});
  const j0 = S.journal[0];
  if (j0 && j0.date === '18 окт.' && j0.pending) S.journal[0] = Object.assign(e, { id:j0.id }); else S.journal.unshift(e);
  if (kind === 'save' || kind === 'ex') S.plan = { amount:c.sum, date:'18 окт.' };
  S.hyp = null; S.conf = null; S.note = ''; S.hypOpen = false; save();
}
let exReturn = null;
document.addEventListener('click', e => {
  const t = e.target.closest('button,[data-act],summary'); if (!t || exl.contains(t) || t === banner) return;
  const d = t.dataset;
  /* пример прогноза до входа: свои переходы внутри рамки */
  if (S.onb === 'ex' && d.go) { if (d.go === 'archive' || d.go === 'scen') { closeSheet(); S.exView = d.go; save(); render({ nav:'push' }); window.scrollTo({ top:0 }); } return; }
  if (d.go) { closeSheet(); return go(d.go); }
  if (d.seg) { const [k, v] = d.seg.split(':'); S[k] = v; save(); return render(); }
  if (d.sheet) return openSheet(d.sheet);
  if (d.lim) { if (d.lim === 'custom') S.customLim = true; else { S.customLim = false; S.limit = +d.lim; } save(); return render(); }
  if (d.consent) { S.cons[d.consent] = !S.cons[d.consent]; save(); t.classList.toggle('on', S.cons[d.consent]); t.setAttribute('aria-checked', S.cons[d.consent]); const go = document.querySelector('[data-onb="done"]'); if (go) go.disabled = !(S.cons.model && S.cons.loss); return; }
  if (d.onb) {
    if (d.onb === 'done') { if (!(S.cons.model && S.cons.loss)) return; S.consent = { version:TERMS_VERSION, at:new Date().toISOString() }; S.onb = 'done'; S.view = 'today'; save(); history.replaceState(null, '', '#/today'); render({ nav:'tab' }); setTimeout(() => toast('Лимит ' + usd(S.limit) + ' сохранён'), 200); return; }
    S.onb = +d.onb; save(); return render({ dir: d.back !== undefined ? 'bwd' : 'fwd' });
  }
  if (d.country) { S.country = d.country; save(); root.querySelectorAll('.pick').forEach(p => p.classList.toggle('on', p.dataset.country === S.country)); return; }
  if (d.alert) return openSheet('alert', d.alert);
  if (d.factor) return openSheet('factor', d.factor);
  if (d.jitem) return openSheet('jitem', +d.jitem);
  if (d.review) { closeSheet(); RV = { id:+d.review, step:0, inv:'', notIn:false, lim:null, conf:null, miss:'' }; return setTimeout(() => openSheet('review'), sheetType ? 280 : 0); }
  if (d.exgo) {
    S.exPick = d.exgo; record('ex', { ex:d.exgo }); exReturn = d.exgo;
    closeSheet(); render(); return setTimeout(openExchange, 160);
  }
  if (d.wi) { WI = WI === d.wi ? null : d.wi; return refreshSheet(); }
  if (d.hyp) { S.hyp = S.hyp === d.hyp ? null : d.hyp; save(); return render(); }
  if (d.conf) { S.conf = S.conf === +d.conf ? null : +d.conf; save(); return render(); }
  if (d.rv) { RV.notIn = !RV.notIn; if (RV.notIn) RV.inv = ''; return refreshSheet(); }
  if (d.rvlim !== undefined) { RV.lim = +d.rvlim; return refreshSheet(); }
  if (d.rvconf !== undefined) { RV.conf = +d.rvconf; return refreshSheet(); }
  if (d.tog !== undefined && d.tog) { S.set[d.tog] = !S.set[d.tog]; save(); t.setAttribute('aria-checked', S.set[d.tog]); return; }
  if (d.max) { S.set.maxDay = +d.max; save(); t.parentNode.querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c === t)); return; }
  if (d.perm) { S.apiPerm[d.perm] = !S.apiPerm[d.perm]; t.setAttribute('aria-checked', S.apiPerm[d.perm]); sheet.querySelector('#apiErr').innerHTML = ''; return; }
  if (d.limset) { S.limit = +d.limset; save(); return limChanged(); }
  if (d.ask) return ask(d.ask);
  if (d.model) { AI.model = d.model; saveAI(); return render(); }
  switch (d.act) {
    case 'close': return closeSheet();
    case 'back': { const to = d.to || VIEWS[S.view].up || 'today'; return go(to); }
    case 'login': S.onb = 0; save(); history.replaceState(null, '', location.pathname); return render({ dir:'fwd' });
    case 'example': S.onb = 'ex'; S.exView = 'scen'; save(); render({ nav:'push' }); return window.scrollTo({ top:0 });
    case 'exarchive': S.onb = 'ex'; S.exView = 'archive'; save(); render({ nav:'push' }); return window.scrollTo({ top:0 });
    case 'exback': closeSheet(); if (S.exView === 'archive' && document.querySelector('.exframe')) { S.exView = 'scen'; save(); render({ nav:'pop' }); return window.scrollTo({ top:0 }); } S.onb = 'land'; save(); return render();
    case 'feedall': S.feedAll = !S.feedAll; save(); return render();
    case 'recalc': closeSheet(); return go('sum');
    case 'alerttog': t.setAttribute('aria-checked', !S.alertOn); return setAlert(!S.alertOn);
    case 'nosig': S.noSignal = !S.noSignal; save(); render(); return toast(S.noSignal ? 'Модель молчит: сумма — «Без позиции»' : 'Сигнал вернулся');
    case 'testbanner': return alertBanner();
    case 'reset': try { localStorage.removeItem(KEY); } catch (e) {} S = DEFAULT(); closeSheet(); fanDrawn = false; history.replaceState(null, '', location.pathname); Object.keys(shown).forEach(k => delete shown[k]); return render();
    case 'voice': return openSheet('voice');
    case 'voiceok': S.capital = +d.pcap; S.limit = +d.plim; save(); closeSheet(); toastSoon(`Поняли: ${usd(S.capital)}, лимит ${usd(S.limit)}, 7 дней`); return go('sum');
    case 'listen': return listen(t);
    case 'aisave': { AI.key = (document.getElementById('aiKey')?.value || '').trim(); AI.proxy = (document.getElementById('aiProxy')?.value || '').trim(); const cm = (document.getElementById('aiModel')?.value || '').trim(); if (cm) AI.model = cm; saveAI(); render(); return toast(aiLive() ? 'Ассистент подключён: ' + modelName() : 'Ассистент в демо-режиме'); }
    case 'aiclear': AI = { key:'', proxy:'', model:MODELS[0].id }; saveAI(); render(); return toast('Ключ удалён из браузера');
    case 'hyp': S.hypOpen = !S.hypOpen; save(); return render();
    case 'watch': record('watch', { plan:0 }); toast('Наблюдаем. Сообщим, если сумма изменится'); return go('journal');
    case 'saveplan': record('save'); toast('План сохранён в журнале'); return go('journal');
    case 'skip': record('skip', { plan:0 }); toast('Пропустил. Сравним через неделю'); return go('journal');
    case 'toex': return openSheet('exit');
    case 'totrades': S.jseg = 'trades'; save(); return go('journal');
    case 'rvnext': {
      const j = S.journal.find(x => x.id === RV.id);
      if (RV.step === 1 && (RV.notIn || !num(RV.inv))) { RV.notIn = true; RV.step = 3; return refreshSheet(); }
      if (RV.step < 4) { RV.step++; return refreshSheet(); }
      if (RV.notIn) { j.kind = 'skip'; j.inRange = true; } else { j.invested = num(RV.inv); j.limitOk = RV.lim !== 1; j.inRange = true; }
      j.due = false; j.pending = false; save(); closeSheet(); render(); return toastSoon('Разбор сохранён');
    }
    case 'api': return openSheet('api');
    case 'apiconnect': {
      const p = S.apiPerm, err = sheet.querySelector('#apiErr');
      if (p.trade || p.withdraw) { err.innerHTML = `<div class="legal"><b>Ключ отклонён.</b> У него есть право ${[p.trade && 'торговли', p.withdraw && 'вывода'].filter(Boolean).join(' и ')}. Создайте на бирже ключ только на чтение.</div>`; return; }
      if (!p.read) { err.innerHTML = '<div class="legal"><b>Не хватает права на чтение истории.</b></div>'; return; }
      S.trades = 'api'; save(); closeSheet(); render(); return toastSoon('Подключено только на чтение · 14 сделок');
    }
    case 'csv': S.trades = 'csv'; save(); toast('Файл загружен · 14 сделок'); return render();
    case 'untrades': S.trades = false; save(); toast('Источник сделок отключён'); return render();
  }
});
function limChanged() {
  const b = document.getElementById('limBig'); if (b) b.textContent = usd(S.limit);
  const r = sheet.querySelector('[data-in="limit"]'); if (r) r.value = S.limit;
  if (sheetType === 'calc') { const li = sheet.querySelector('[data-in="lim"]'); if (li) li.value = S.limit; sheet.querySelectorAll('[data-limset]').forEach(c => c.classList.toggle('on', +c.dataset.limset === S.limit)); }
  calcLive();
  if (S.onb === 'done') render();
}
function calcLive() { const r = document.getElementById('calcRes'); if (r) r.innerHTML = calcRes(calc()); }
document.addEventListener('input', e => {
  const k = e.target.dataset.in; if (!k) return;
  const v = e.target.value;
  if (k === 'cap') { S.capital = Math.min(9999999, Math.max(0, Math.round(num(v)))); }
  else if (k === 'lim') { S.limit = Math.max(10, Math.round(num(v)) || 10); }
  else if (['stop','fee','slip','pos'].includes(k)) { S[k] = v.trim(); }
  else if (k === 'note') { S.note = v; save(); return; }
  else if (k === 'customlim') { S.limit = Math.max(10, Math.round(num(v)) || 300); save(); const b = document.getElementById('onbLim'); if (b) b.textContent = usd(S.limit); return; }
  else if (k === 'email') { S.email = v; save(); return; }
  else if (k === 'limit') { S.limit = +v; save(); return limChanged(); }
  else if (k === 'rvinv') { RV.inv = v; if (num(v)) RV.notIn = false; return; }
  else if (k === 'rvmiss') { RV.miss = v; return; }
  save(); calcLive();
  if (sheetType === 'calc') sheet.querySelectorAll('[data-limset]').forEach(c => c.classList.toggle('on', +c.dataset.limset === S.limit));
  render();
});
document.addEventListener('toggle', e => { if (e.target.classList && e.target.classList.contains('more2')) { S.moreOpen = e.target.open; save(); } }, true);
document.addEventListener('change', e => { if (e.target.dataset.sel === 'country') { S.country = e.target.value; save(); render(); } });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { if (sheetType) return closeSheet(); if (exl.classList.contains('show')) return exBack(); }
  if (e.key === 'Enter' && e.target.matches && e.target.matches('.inp input[enterkeyhint="done"]')) e.target.blur();
});

/* ---------- старт ---------- */
document.body.append(layer, banner, toastEl, exl);
addEventListener('resize', () => { if (shellOn) syncChrome(); });
const startV = location.hash.replace('#/', '');
if (S.onb === 'done' && VIEWS[startV]) S.view = startV;
if (S.onb === 'done') history.replaceState(null, '', '#/' + S.view);
render({ nav:'tab' });
