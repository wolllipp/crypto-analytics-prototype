/* Crypto Analytics — прототип. Цифры иллюстративные, база — прототип на 05.10.2026.
   Путь: вход и лимит → «Сегодня» с оповещениями → карточка оповещения → сценарии → сумма под лимит →
   переход (риски + раскрытие) → биржа-партнёр с нашим модулем → журнал → разбор сделок. */
'use strict';

/* ---------- данные и модель ---------- */
const PRICE = 86530, USD_BYN = 3.275, BTC_BYN = 283400;
const MARKET = {
  calm:  { tails:[15,69,16], lo:81122, hi:92383, bad:300/3467, minus:51, worst:8.7, k:1 },
  alert: { tails:[19,64,17], lo:80400, hi:92900, bad:300/2740, minus:53, worst:10.9, k:1.11 },
};
const ALERTS = [
  { id:'funding', set:'funding', icon:'stack', cls:'c-or', hot:true, title:'Funding перегрет', short:'Риск резкого падения выше обычного',
    head:'Funding перегрет, OI растёт быстрее цены',
    kv:[['Funding','0,045% / 8 ч · выше 94% дней года'],['Открытый интерес','+12% за 3 дня'],['Цена за 3 дня','+1%'],['Падение >5% за неделю','15% → 19%','dn']],
    note:'Много позиций с плечом в одну сторону. В прошлом это чаще заканчивалось резким падением, но не всегда. Это не сигнал к сделке.',
    src:'данные деривативов Binance, Bybit, OKX · обновлено 09:30' },
  { id:'vol', set:'vol', icon:'wave', cls:'c-vi', title:'Волатильность выросла', short:'Диапазон недели шире на 18%',
    head:'Ожидаемая волатильность выросла',
    kv:[['Диапазон 80%','$11 261 → $12 500'],['Изменение','+18% за 2 дня'],['DVOL','52 → 58']],
    note:'Рынок ждёт более сильных движений в обе стороны. Поэтому сумма под ваш лимит стала меньше.',
    src:'Deribit DVOL и наша модель сценариев · обновлено 09:30' },
];
const CLOSES = [77439,77340,81270,79661,79832,80342,79112,78456,78306,76569,77226,77279,76842,78189,75644,76206,76417,80884,81250,81178,86620,86209,84398,84410,84100,84433,84472,83500,83664,86530];
const WEEKS = [1,1,1,0,1,1,1,1,0,1,1,1];
const TRADES = (() => {
  const pnl=[62,-41,85,-28,47,-55,120,-33,18,-61,74,39,-22,105], fee=[8,9,7,8,9,8,10,7,8,9,8,8,7,9];
  const hot=[1,5,6,9,12], d=['3 июл','9 июл','15 июл','22 июл','29 июл','5 авг','11 авг','18 авг','25 авг','1 сен','8 сен','15 сен','22 сен','29 сен'];
  const size=[900,1200,1500,800,1000,1400,1600,700,600,1300,1100,900,1000,1500];
  return pnl.map((p,i)=>({date:d[i], side:i%3===2?'Продажа':'Покупка', size:size[i], gross:p, fee:fee[i], hot:hot.includes(i)}));
})();

const DEFAULT = () => ({
  onb:0, limit:300, customLim:false, country:'BY', email:'', capital:5000,
  view:'today', alertOn:true,
  plan:{ amount:3467, date:'5 окт.' },
  journal:[
    { id:1, date:'11 окт.', kind:'plan', plan:3200, due:true },
    { id:2, date:'5 окт.', kind:'plan', plan:3467, invested:3000, inRange:true, limitOk:true },
    { id:3, date:'28 сен.', kind:'skip', inRange:true },
    { id:4, date:'21 сен.', kind:'plan', plan:3100, invested:3100, inRange:false, limitOk:true, note:'падение −7,8%' },
  ],
  trades:false, apiPerm:{read:true,trade:false,withdraw:false},
  set:{ funding:true, oi:true, vol:true, flow:false, maxDay:2, quiet:true },
  exPick:'A',
});
let S = DEFAULT();
const KEY = 'ca-proto-v1';
try { const saved = JSON.parse(localStorage.getItem(KEY) || 'null'); if (saved) S = Object.assign(DEFAULT(), saved); } catch (e) {}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };

const M = () => S.alertOn ? MARKET.alert : MARKET.calm;
const fmt = n => Math.round(n).toLocaleString('ru-RU');
const usd = n => (n < 0 ? '−' : '') + '$' + fmt(Math.abs(n));
const calcSum = () => Math.min(S.capital, Math.round(S.limit / M().bad));
const planBad = () => Math.round(S.plan.amount * M().bad);
const planOver = () => planBad() > S.limit;
const activeAlerts = () => S.alertOn ? ALERTS.filter(a => S.set[a.set]) : [];
const ico = (id, c = 'i') => `<svg class="${c}" aria-hidden="true"><use href="#${id}"/></svg>`;
const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const isPhone = () => matchMedia('(max-width: 899px)').matches;
const tw = (key, v, f = 'usd') => `<span class="num" data-tw="${key}" data-v="${v}" data-f="${f}">${f === 'usd' ? usd(v) : f === 'pct' ? v + '%' : f === 'neg' ? '−' + usd(v) : fmt(v)}</span>`;

/* ---------- анимация чисел: от текущего значения, без рывка при повторном изменении ---------- */
const shown = {};
const easeOut = t => 1 - Math.pow(1 - t, 4);
function runTweens(root) {
  root.querySelectorAll('[data-tw]').forEach(el => {
    const k = el.dataset.tw, to = +el.dataset.v, f = el.dataset.f;
    const from = shown[k];
    shown[k] = to;
    if (from === undefined || from === to || reduce()) return;
    const out = v => f === 'usd' ? usd(v) : f === 'pct' ? Math.round(v) + '%' : f === 'neg' ? '−' + usd(v) : fmt(v);
    const t0 = performance.now(), dur = 520;
    el.textContent = out(from);
    (function step(now) {
      const t = Math.min(1, (now - t0) / dur);
      if (!el.isConnected) return;
      el.textContent = out(from + (to - from) * easeOut(t));
      if (t < 1) requestAnimationFrame(step);
    })(t0);
  });
}

/* ---------- веер сценариев (из концепта): история 30 дней + полосы 50%/80% на 7 дней ---------- */
const FAN = { W:300, H:200, L:4, R:36, T:8, B:18, lo:73000, hi:97000 };
const SD = 0.3717 / Math.sqrt(365);
const PATHS = (() => { let s = 7; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const g = () => Math.sqrt(-2 * Math.log(r() + 1e-9)) * Math.cos(2 * Math.PI * r());
  return Array.from({length:22}, () => Array.from({length:7}, g)); })();
let fanK = null;
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
function fanSVG(draw) {
  const k = fanK ?? M().k, g = fanGeo(k), {W,H,L,R,B} = FAN;
  const hist = CLOSES.map((v,i) => `${g.x(i).toFixed(1)},${g.y(v).toFixed(1)}`).join(' ');
  let len = 0; CLOSES.forEach((v,i) => { if (i) len += Math.hypot(g.x(i)-g.x(i-1), g.y(v)-g.y(CLOSES[i-1])); });
  const grid = [80000,85000,90000,95000].map(v => `<line x1="${L}" x2="${W-R}" y1="${g.y(v)}" y2="${g.y(v)}" stroke="rgba(255,255,255,.07)"/><text x="${W-R+5}" y="${g.y(v)+3}">${v/1000}k</text>`).join('');
  return `<svg class="fan ${draw && !reduce() ? 'draw' : ''}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Цена BTC за 30 дней и веер сценариев на 7 дней вперёд">
    <defs><linearGradient id="hg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="rgba(10,132,255,.28)"/><stop offset="1" stop-color="rgba(10,132,255,0)"/></linearGradient></defs>
    ${grid}
    <polygon class="band" data-b="80" points="${g.b80}" fill="rgba(10,132,255,.16)"/>
    <polygon class="band" data-b="50" points="${g.b50}" fill="rgba(10,132,255,.32)"/>
    <g class="paths">${g.paths.map(p => `<polyline points="${p}" fill="none" stroke="rgba(100,170,255,.22)" stroke-width=".8"/>`).join('')}</g>
    <polygon points="${hist} ${g.x(g.n-1)},${H-B} ${g.x(0)},${H-B}" fill="url(#hg)"/>
    <polyline class="hist" style="--len:${len.toFixed(0)}" points="${hist}" fill="none" stroke="#0a84ff" stroke-width="1.8" stroke-linejoin="round"/>
    <polyline class="med" points="${g.med}" fill="none" stroke="#0a84ff" stroke-width="1.2" stroke-dasharray="3 3"/>
    <circle cx="${g.x(g.n-1)}" cy="${g.y(PRICE)}" r="4" fill="#0a84ff" stroke="#000" stroke-width="2"/>
    <text x="${L}" y="${H-4}">19 сент.</text><text x="${g.x(g.n-1)}" y="${H-4}" text-anchor="middle">сегодня</text><text x="${W-R}" y="${H-4}" text-anchor="end">+7 дн.</text>
  </svg>`;
}
function morphFan() {
  const svg = document.querySelector('#view .fan'); if (!svg) { fanK = M().k; return; }
  const from = fanK ?? M().k, to = M().k; fanK = to;
  if (from === to) return;
  const apply = k => { const g = fanGeo(k);
    svg.querySelector('[data-b="80"]').setAttribute('points', g.b80);
    svg.querySelector('[data-b="50"]').setAttribute('points', g.b50);
    svg.querySelector('.med').setAttribute('points', g.med);
    svg.querySelectorAll('.paths polyline').forEach((p,i) => p.setAttribute('points', g.paths[i])); };
  if (reduce()) return apply(to);
  const t0 = performance.now(), dur = 600;
  (function step(now){ const t = Math.min(1,(now-t0)/dur); if (!svg.isConnected) return; apply(from + (to-from)*easeOut(t)); if (t < 1) requestAnimationFrame(step); })(t0);
}

/* ---------- экраны ---------- */
const VIEWS = {
  today:{t:'Сегодня', i:'home'}, scen:{t:'Сценарии', i:'fanic'}, sum:{t:'Сумма', i:'calc'},
  journal:{t:'Журнал', i:'book'}, review:{t:'Разбор', i:'chart'}, alerts:{t:'Оповещения', i:'bell'}, settings:{t:'Настройки', i:'gear'},
};
const TABS = ['today','scen','journal','review'];

function head(title, sub, mobileLeft = '', right = '') {
  return `<div class="vh"><div class="hide-m"><div class="sub">${sub}</div><div class="ttl">${title}</div></div>
    <div class="hide-d" style="display:flex;align-items:center;gap:10px;min-width:0">${mobileLeft || `<div><div class="sub">${sub}</div><div class="ttl">${title}</div></div>`}</div>
    ${right}</div>`;
}
const topRight = () => `<div class="rbtns"><button class="rb press" data-go="alerts" aria-label="Оповещения">${ico('bell')}${activeAlerts().length ? '<span class="dot"></span>' : ''}</button><button class="rb press" data-go="settings" aria-label="Настройки">${ico('gear')}</button></div>`;

function vToday() {
  const m = M(), al = activeAlerts(), due = S.journal.find(j => j.due);
  return `${head('Сегодня', 'суббота, 18 октября', `<div class="acc"><i>${ico('btc')}</i><div><b>Bitcoin</b><small>BTC/USDT</small></div></div>`, topRight())}
  <div class="cols">
    <div class="card m-flat">
      <div class="period"><span class="a">${ico('back')}</span><span class="p">Неделя вперёд</span><span class="a" style="transform:scaleX(-1)">${ico('back')}</span></div>
      <div class="big num">${usd(PRICE)}</div>
      <div class="deltas num"><span class="up">${ico('arr-up')}${tw('hi', m.hi)}</span><span class="dn">${ico('arr-dn')}${tw('lo', m.lo)}</span></div>
      <button class="chipbtn press" data-go="scen">${ico('spark')}8 из 10 сценариев в диапазоне</button>
      <div class="day" style="margin-top:6px">Ваш план</div>
      <div class="rows stg">
        ${planOver()
          ? `<button class="row bad press" data-go="sum"><span class="cat c-rd">${ico('shield')}</span><div><b>План вне лимита</b><small>${usd(S.plan.amount)} от ${S.plan.date}: плохая неделя −${usd(planBad())}</small></div><span class="v dn num">лимит ${usd(S.limit)}</span></button>`
          : `<button class="row press" data-go="sum"><span class="cat c-gr">${ico('shield')}</span><div><b>План в лимите</b><small>${usd(S.plan.amount)} от ${S.plan.date}: плохая неделя −${usd(planBad())}</small></div><span class="v up num">лимит ${usd(S.limit)}</span></button>`}
        ${due ? `<button class="row press" data-review="${due.id}"><span class="cat c-bl">${ico('clock')}</span><div><b>Пора разобрать решение</b><small>план от ${due.date}: неделя прошла</small></div><span class="v mut">›</span></button>` : ''}
      </div>
    </div>
    <div class="card m-flat">
      <div class="day">Оповещения · сегодня, 18 окт.</div>
      <div class="rows stg">
        ${al.length ? al.map(a => `<button class="row ${a.hot ? 'hot' : ''} press" data-alert="${a.id}"><span class="cat ${a.cls}">${ico(a.icon)}</span><div><b>${a.title}</b><small>${a.short}</small></div><span class="v mut">›</span></button>`).join('')
          : `<div class="empty">Сейчас ничего необычного.<br>Сообщим, если риск вырастет.</div>`}
      </div>
      <div class="day" style="margin-top:4px">Рынок</div>
      <div class="rows stg">
        <div class="row"><span class="cat c-ye">${ico('layers')}</span><div><b>Открытый интерес</b><small>Binance Futures</small></div><span class="v ${S.alertOn ? 'up' : ''} num">${S.alertOn ? '+12,0%' : '+2,1%'}</span></div>
        <div class="row"><span class="cat c-bl">${ico('trend')}</span><div><b>Тренд</b><small>выше 50 и 200 дней</small></div><span class="v">за рост</span></div>
        <div class="row"><span class="cat c-vi">${ico('wave')}</span><div><b>Опционная волатильность</b><small>Deribit · DVOL</small></div><span class="v num">${S.alertOn ? '58,0' : '44,2'}</span></div>
      </div>
    </div>
  </div>`;
}

function vScen() {
  const m = M();
  return `${head('Сценарии', '20 000 вариантов недели', `<div class="seg2" style="flex:1;justify-content:flex-start"><span>${ico('btc')}BTC · 7 дней</span></div>`, topRight())}
  <div class="cols">
    <div class="card m-flat">
      <div class="big num">${tw('mid', m.tails[1], 'pct')}</div>
      <p class="subbig" style="font-size:15px;color:var(--mut)">сценариев в пределах ±5%</p>
      ${fanSVG(true)}
      <div class="trio num stg"><div><b class="dn">${tw('t0', m.tails[0], 'pct')}</b><small>падение &gt;5%</small></div><div><b>${tw('t1', m.tails[1], 'pct')}</b><small>±5%</small></div><div><b class="up">${tw('t2', m.tails[2], 'pct')}</b><small>рост &gt;5%</small></div></div>
      <div class="row"><span class="cat c-rd">${ico('arr-dn')}</span><div><b>Худшие 10% недель</b><small>среднее падение в плохую неделю</small></div><span class="v dn num">−${String(m.worst).replace('.', ',')}%</span></div>
      <div class="note">${ico('info')}<span>Смоделированные вероятности по 20 000 сценариев, а не обещание. Куда пойдёт цена, модель не знает.</span></div>
    </div>
    <div class="stackv">
      <div class="card m-flat">
        <div class="day">Что изменит картину</div>
        <div class="rows stg">${S.alertOn
          ? `<div class="row"><span class="cat c-or">${ico('stack')}</span><div><b>Funding остынет ниже 0,02%</b><small>риск падения вернётся к ~15%</small></div></div>
             <div class="row"><span class="cat c-vi">${ico('wave')}</span><div><b>DVOL опустится ниже 52</b><small>диапазон сузится на ~10%</small></div></div>`
          : `<div class="row"><span class="cat c-or">${ico('stack')}</span><div><b>Funding выше 0,04%</b><small>риск падения вырастет до ~19%</small></div></div>`}</div>
      </div>
      <button class="card m-flat press" data-go="journal" style="text-align:left">
        <div class="day">Надёжность модели</div>
        <div class="row" style="pointer-events:none"><span class="cat c-gr">${ico('check')}</span><div><b>10 из 12 недель</b><small>цена попала в диапазон 80%</small></div><span class="v mut">›</span></div>
      </button>
      <button class="btn w press" data-go="sum">Посчитать сумму под мой лимит</button>
    </div>
  </div>`;
}

function vSum() {
  const m = M(), sum = calcSum(), bad = Math.round(sum * m.bad), changed = S.alertOn && S.plan.amount !== sum;
  return `${head('Сумма под лимит', 'не больше, чем готовы потерять', `<button class="circ press" data-go="today" aria-label="Закрыть">${ico('close')}</button><div class="seg2" style="flex:1"><span>${ico('btc')}BTC · 7 дней</span></div>`, '<span class="hide-d" style="width:38px"></span>')}
  <div class="cols">
    <div class="card m-flat" style="gap:14px">
      <div style="padding-top:8px">
        <div class="big xl num">${tw('sum', sum)}</div>
        <p class="subbig num" style="margin-top:6px">из ${tw('cap', S.capital)} капитала</p>
      </div>
      <div class="lim"><span class="num">${ico('shield')}Плохая неделя ≤ ${usd(S.limit)}</span></div>
      ${changed ? `<span class="tag t-or num" style="align-self:center">${ico('stack')}Пересчитано после оповещения · план был ${usd(S.plan.amount)}</span>` : ''}
      <div class="wallet">
        <button class="press on" data-act="editcap"><span>${ico('wallet')}</span><span style="min-width:0"><b class="num">${tw('cap2', S.capital)}</b><small>Капитал</small></span></button>
        <button class="press" data-act="editlim"><span>${ico('shield')}</span><span style="min-width:0"><b class="num">${usd(S.limit)}</b><small>Лимит</small></span></button>
        <button class="press" data-go="scen"><span>${ico('cal')}</span><span style="min-width:0"><b>7 дней</b><small>Горизонт</small></span></button>
      </div>
      <div class="rows">
        <div class="row"><span class="cat c-rd">${ico('arr-dn')}</span><div><b>В плохую неделю</b><small>среднее худших 10% сценариев</small></div><span class="v dn">${tw('bad', bad, 'neg')}</span></div>
        <div class="row"><span class="cat c-gy">${ico('info')}</span><div><b>Минус через неделю</b><small>вероятность при любой сумме</small></div><span class="v num">≈ ${m.minus}%</span></div>
      </div>
      <div class="pair"><button class="btn d press" data-act="skip">Пропустить</button><button class="btn d press" data-act="toex">Перейти к бирже</button></div>
      <p class="disc">Это расчёт, а не совет. План запишется в журнал при любом выборе.</p>
    </div>
    <div class="card m-flat">
      <div class="day">Капитал · можно печатать с клавиатуры</div>
      <div class="keys" role="group" aria-label="Клавиатура капитала">
        ${['1','2','3','+','4','5','6','−','7','8','9','del','C','0','00','000'].map(k =>
          `<button data-key="${k}" class="${'+−delC'.includes(k) || k === 'del' ? 'op' : ''}" aria-label="${k === 'del' ? 'Стереть' : k === '+' ? 'Плюс 500' : k === '−' ? 'Минус 500' : k === 'C' ? 'Очистить' : k}">${k === 'del' ? ico('del') : k === '+' ? '+500' : k === '−' ? '−500' : k}</button>`).join('')}
      </div>
    </div>
  </div>`;
}

function vJournal() {
  const ok = WEEKS.filter(Boolean).length;
  const item = j => {
    const skip = j.kind === 'skip';
    const st = j.due || j.pending ? `<span class="st wait">${ico('clock')}</span>` : skip ? `<span class="st ${j.inRange === false ? 'no' : 'ok'}">${ico(j.inRange === false ? 'close' : 'check')}</span>` : `<span class="st ${j.limitOk ? 'ok' : 'no'}">${ico(j.limitOk ? 'check' : 'close')}</span>`;
    const sub = skip ? `${j.date} · ${j.pending ? 'сравним через неделю' : 'тоже решение'}`
      : j.due ? `${j.date} · пора разобрать` : j.pending ? `${j.date} · разбор ${j.reviewDate}`
      : `${j.date} · ${j.inRange === false ? 'вне диапазона' : 'в диапазоне'}${j.note ? ' · ' + j.note : ''}`;
    return `<button class="jr press" ${j.due ? `data-review="${j.id}"` : ''}><span class="cat ${skip ? 'c-gy' : j.pending || j.due ? 'c-or' : 'c-bl'}">${ico(skip ? 'close' : j.pending || j.due ? 'shield' : 'trend')}</span><div><b>${skip ? 'Пропустить' : 'План суммы'}</b><small>${sub}</small></div><span class="amt num">${skip ? '$0' : usd(j.invested ?? j.plan)}</span>${st}</button>`;
  };
  return `${head('Журнал решений', 'разбор через неделю, без самообмана', '', topRight())}
  <div class="cols">
    <div class="card m-flat"><div class="day">Решения</div><div class="rows stg">${S.journal.map(item).join('')}</div></div>
    <div class="card m-flat" style="gap:14px">
      <div class="period"><span class="a">${ico('back')}</span><span class="p">12 недель</span><span class="a" style="transform:scaleX(-1)">${ico('back')}</span></div>
      <div class="big xl num">${ok} из 12</div>
      <p class="disc" style="font-size:14px">недель цена была в диапазоне 80%</p>
      <div class="cal" aria-label="Попадания по неделям">${WEEKS.map((w,i) => `<i class="${w ? '' : 'm'}" style="--k:${i}"></i>`).join('')}</div>
      <div class="grid2 stg">
        <div class="ins"><h3>Калибровка ${ico('info')}</h3><small>попадание против обещанных 80%</small><b class="up num">83%</b></div>
        <div class="ins"><h3>Медиана недели ${ico('cal')}</h3><small>середина сценариев</small><b class="num">$86 470</b></div>
        <div class="ins"><h3>За рост</h3><small>открытый интерес</small><span class="cat c-ye">${ico('layers')}</span></div>
        <div class="ins"><h3>Против</h3><small>${S.alertOn ? 'перегретый funding' : 'опционная волатильность'}</small><span class="cat ${S.alertOn ? 'c-or' : 'c-vi'}">${ico(S.alertOn ? 'stack' : 'wave')}</span></div>
      </div>
      <p class="disc">Ожидаем около 8 из 10. Если попаданий станет меньше, модель слишком уверена, и мы покажем это здесь же.</p>
    </div>
  </div>`;
}

function vReview() {
  if (!S.trades) return `${head('Разбор сделок', 'реальный результат после комиссий', '', topRight())}
  <div class="cols even">
    <div class="card m-flat">
      <div class="day">Откуда взять ваши сделки</div>
      <div class="rows stg">
        <button class="row press" data-act="api"><span class="cat c-gr">${ico('lock')}</span><div><b>Биржа-партнёр по API</b><small>ключ только на чтение</small></div><span class="v mut">›</span></button>
        <button class="row press" data-act="csv"><span class="cat c-bl">${ico('export')}</span><div><b>Файл CSV</b><small>выгрузка истории из любой биржи ПВТ</small></div><span class="v mut">›</span></button>
      </div>
      <div class="warn" style="display:flex;gap:9px">${ico('close')}<span>Ключ с правом <b>торговли или вывода</b> не примем. Права ключа проверяем при подключении.</span></div>
    </div>
    <div class="card m-flat">
      <div class="day">Что покажет разбор</div>
      <div class="rows stg">
        <div class="row"><span class="cat c-gy">${ico('chart')}</span><div><b>Доходность после комиссий</b><small>а не только «попал в диапазон»</small></div></div>
        <div class="row"><span class="cat c-gy">${ico('arr-dn')}</span><div><b>Просадки</b><small>сколько терял по пути</small></div></div>
        <div class="row"><span class="cat c-gy">${ico('stack')}</span><div><b>Повторяющиеся ошибки</b><small>всегда с размером выборки</small></div></div>
      </div>
    </div>
  </div>`;
  const gross = TRADES.reduce((a,t) => a + t.gross, 0), fees = TRADES.reduce((a,t) => a + t.fee, 0), net = gross - fees;
  let eq = S.capital, peak = eq, dd = 0; TRADES.forEach(t => { eq += t.gross - t.fee; peak = Math.max(peak, eq); dd = Math.min(dd, (eq - peak) / peak); });
  const hot = TRADES.filter(t => t.hot), hotLoss = hot.filter(t => t.gross - t.fee < 0).length;
  const pct = v => (v >= 0 ? '+' : '−') + Math.abs(v * 100).toFixed(1).replace('.', ',') + '%';
  return `${head('Разбор сделок', 'реальный результат после комиссий', '', topRight())}
  <div class="cols">
    <div class="stackv">
      <div class="card m-flat" style="gap:14px">
        <div class="seg2"><span>${ico('cal')}${TRADES.length} сделок · июль – сентябрь</span></div>
        <div class="big xl num">${pct(net / S.capital)}</div>
        <p class="subbig num">после комиссий · ${usd(net)}</p>
        <div class="bars num">
          <div><span>До комиссий</span><i style="width:100%;background:var(--mut-2)"></i><b>${pct(gross / S.capital)}</b></div>
          <div><span>Комиссии</span><i style="width:${Math.round(fees / gross * 100)}%;background:var(--down)"></i><b class="dn">−${usd(fees)}</b></div>
          <div><span>Макс. просадка</span><i style="width:${Math.min(100, Math.round(-dd * 2000))}%;background:var(--down)"></i><b class="dn">${pct(dd)}</b></div>
        </div>
      </div>
      <div class="card hide-m">
        <div class="lbl">Сделки</div>
        <table class="num"><thead><tr><th>Дата</th><th>Сторона</th><th class="r">Сумма</th><th class="r">Результат</th><th class="r">Комиссия</th><th class="r">Итог</th></tr></thead><tbody>
        ${TRADES.map(t => `<tr><td>${t.date}${t.hot ? '<span class="flag">funding перегрет</span>' : ''}</td><td>${t.side}</td><td class="r">${usd(t.size)}</td><td class="r ${t.gross < 0 ? 'dn' : 'up'}">${t.gross < 0 ? '' : '+'}${usd(t.gross)}</td><td class="r mut">−${usd(t.fee)}</td><td class="r ${t.gross - t.fee < 0 ? 'dn' : ''}"><b>${t.gross - t.fee < 0 ? '' : '+'}${usd(t.gross - t.fee)}</b></td></tr>`).join('')}
        </tbody></table>
      </div>
    </div>
    <div class="card m-flat">
      <div class="day">Замеченная привычка</div>
      <div class="rows stg">
        <div class="row hot"><span class="cat c-or">${ico('stack')}</span><div><b>Входы при перегретом funding</b><small>${hotLoss} из ${hot.length} закрыты в минус</small></div><span class="v or num">${hotLoss}/${hot.length}</span></div>
      </div>
      <span class="tag t-or">${ico('info')}Сделок мало (${hot.length}), вывод предварительный</span>
      <div class="day" style="margin-top:4px">Дисциплина</div>
      <div class="row"><span class="cat c-gr">${ico('shield')}</span><div><b>Лимит соблюдён</b><small>недели с риском в рамках ${usd(S.limit)}</small></div><span class="v num">11 из 12</span></div>
      <p class="src">Результаты видите только вы, в рекламе мы их не используем. Источник: ${S.trades === 'api' ? 'Биржа-партнёр А, API только на чтение' : 'файл CSV'}. <button class="btn link" data-act="untrades" style="display:inline;width:auto;padding:0;font-size:12px">Отключить</button></p>
    </div>
  </div>`;
}

function vAlerts() {
  const t = (k, b, s, ic, cls, locked) => `<div class="gi"><span class="cat ${cls}">${ico(ic)}</span><div><b>${b}</b><small>${s}</small></div><button class="toggle" role="switch" aria-checked="${locked || !!S.set[k]}" ${locked ? 'disabled' : ''} data-tog="${k}" aria-label="${b}"></button></div>`;
  return `${head('Оповещения', 'спокойно, без FOMO и сирен', `<button class="circ press" data-go="today" aria-label="Назад">${ico('back')}</button><div class="ttl">Оповещения</div>`, '')}
  <div class="cols even">
    <div class="card m-flat"><div class="day">События</div>
      <div class="grp">
        ${t('funding','Funding перегрет','выше, чем в 90% дней года','stack','c-or')}
        ${t('oi','OI против цены','интерес растёт, цена стоит','layers','c-ye')}
        ${t('vol','Волатильность','диапазон шире на 15% и больше','wave','c-vi')}
        ${t('flow','Потоки на биржи','крупные переводы BTC на биржи','swap','c-gy')}
        ${t('','План вышел за лимит','нельзя выключить: это суть продукта','shield','c-rd',true)}
      </div></div>
    <div class="card m-flat"><div class="day">Как приходят</div>
      <div class="grp">
        <div class="gi"><span class="cat c-gy">${ico('bell')}</span><div><b>В приложении и push</b><small>внутри сервиса, без Telegram</small></div><span></span></div>
        <div class="gi"><span class="cat c-gy">${ico('clock')}</span><div><b>Не чаще в день</b><small>частые сигналы толкают к лишним сделкам</small></div><div class="chips">${[1,2,3].map(n => `<button class="chip ${S.set.maxDay === n ? 'on' : ''}" data-max="${n}" style="padding:7px 13px">${n}</button>`).join('')}</div></div>
        ${t('quiet','Тихие часы','с 23:00 до 8:00 не беспокоим','moon','c-gy')}
      </div>
      <button class="btn d press" data-act="testbanner">Показать пример оповещения</button>
    </div>
  </div>`;
}

function vSettings() {
  return `${head('Настройки', 'профиль и демо', `<button class="circ press" data-go="today" aria-label="Назад">${ico('back')}</button><div class="ttl">Настройки</div>`, '')}
  <div class="cols even">
    <div class="card m-flat"><div class="day">Профиль</div>
      <div class="grp">
        <button class="gi press" data-act="editlim"><span class="cat c-rd">${ico('shield')}</span><div><b>Лимит по умолчанию</b><small>плохая неделя не больше</small></div><span class="r num">${usd(S.limit)} ›</span></button>
        <div class="gi"><span class="cat c-bl">${ico('globe')}</span><div><b>Страна</b><small>от неё зависят биржи</small></div><select data-sel="country" style="background:transparent;border:0;color:var(--mut);font-size:14px;text-align:right" aria-label="Страна"><option value="BY" ${S.country === 'BY' ? 'selected' : ''}>Беларусь</option><option value="OT" ${S.country === 'OT' ? 'selected' : ''}>Другая</option></select></div>
        <button class="gi press" data-go="alerts"><span class="cat c-or">${ico('bell')}</span><div><b>Оповещения</b><small>события, частота, тихие часы</small></div><span class="r">›</span></button>
        <button class="gi press" data-go="review"><span class="cat c-gr">${ico('lock')}</span><div><b>Подключённые биржи</b><small>только на чтение</small></div><span class="r">${S.trades ? '1' : 'нет'} ›</span></button>
      </div></div>
    <div class="stackv"><div class="card m-flat"><div class="day">Ассистент</div>
      <div class="grp">
        <div class="gi"><span class="cat c-bl">${ico('logo')}</span><div><b>${aiLive() ? 'Подключён: ' + esc(modelName()) : 'Демо-режим'}</b><small>${aiLive() ? (AI.proxy ? 'через прокси' : 'ключ хранится только в этом браузере') : 'отвечает на несколько тем'}</small></div><span class="tag ${aiLive() ? 't-gr' : 't-gy'}">${aiLive() ? 'вкл' : 'демо'}</span></div>
        ${MODELS.map(m => `<button class="gi press" data-model="${m.id}"><span class="cat ${m.id.startsWith('deepseek') ? 'c-bl' : 'c-gr'}">${ico('chip')}</span><div><b>${m.name}</b><small>${m.note}</small></div><span class="st ${AI.model === m.id ? 'ok' : 'wait'}">${AI.model === m.id ? ico('check') : ''}</span></button>`).join('')}
      </div>
      <div class="field"><label for="aiKey">Ключ OpenRouter</label><div class="inp"><input id="aiKey" type="password" placeholder="sk-or-…" value="${esc(AI.key)}" autocomplete="off"></div></div>
      <div class="field"><label for="aiModel">Модель (можно вписать любую с openrouter.ai)</label><div class="inp"><input id="aiModel" placeholder="${MODELS[0].id}" value="${esc(AI.model)}" autocomplete="off"></div></div>
      <div class="field"><label for="aiProxy">Или адрес прокси (для публичной ссылки)</label><div class="inp"><input id="aiProxy" type="url" placeholder="https://….workers.dev" value="${esc(AI.proxy)}" autocomplete="off"></div></div>
      <div class="pair"><button class="btn d press" data-act="aiclear">Удалить</button><button class="btn w press" data-act="aisave">Сохранить</button></div>
      <p class="disc">Ключ хранится только в этом браузере и уходит только в OpenRouter. Получить: openrouter.ai → Keys. На общей ссылке ключ не вводите — используйте прокси из proxy-worker.js.</p>
    </div>
    <div class="card m-flat"><div class="day">Демо прототипа</div>
      <div class="grp">
        <div class="gi"><span class="cat c-or">${ico('stack')}</span><div><b>Рынок перегрет</b><small>включает оповещения и меняет сценарии</small></div><button class="toggle" role="switch" aria-checked="${S.alertOn}" data-act="alerttog" aria-label="Рынок перегрет"></button></div>
      </div>
      <button class="btn d press" data-act="reset">Начать заново с первого экрана</button>
    </div></div>
  </div>`;
}

/* ---------- онбординг ---------- */
function vOnb(dir) {
  const dots = `<div class="dots">${[0,1,2].map(i => `<i class="${i <= S.onb ? 'on' : ''}"></i>`).join('')}</div>`;
  let body;
  if (S.onb === 0) body = `${dots}
    <h1>Сколько вы готовы потерять за плохую неделю?</h1>
    <div class="big xl num" id="onbLim">${usd(S.limit)}</div>
    <div class="chips">${[100,300,500].map(v => `<button class="chip num ${S.limit === v && !S.customLim ? 'on' : ''}" data-lim="${v}">${usd(v)}</button>`).join('')}<button class="chip ${S.customLim ? 'on' : ''}" data-lim="custom">своё</button></div>
    ${S.customLim ? `<div class="inp"><span>$</span><input inputmode="numeric" placeholder="например, 250" data-in="customlim" aria-label="Свой лимит"></div>` : ''}
    <p class="p">Лимит задаём до того, как вы увидите рынок, чтобы не подгонять его под желание войти.</p>
    <button class="btn w press" data-onb="1">Продолжить</button>`;
  else if (S.onb === 1) body = `${dots}
    <h1>Где вы живёте?</h1>
    <p class="p">От страны зависят биржи, на которые мы можем вас направить. Для Беларуси это только резиденты ПВТ.</p>
    <button class="pick" data-country="BY"><i>BY</i><span>Беларусь<small>биржи — резиденты ПВТ</small></span><span class="ck"></span></button>
    <button class="pick" data-country="OT"><i>${ico('globe')}</i><span>Другая страна<small>партнёры по законам страны</small></span><span class="ck"></span></button>
    <div class="field"><label for="capO">С какого капитала считать</label><div class="inp"><span>$</span><input id="capO" inputmode="numeric" value="${S.capital}" data-in="capital"></div></div>
    <button class="btn w press" data-onb="2">Продолжить</button><button class="btn link" data-onb="0" data-back>Назад</button>`;
  else body = `${dots}
    <h1>Вход по почте</h1>
    <p class="p">Паспорт и карта нам не нужны: деньги и проверка личности остаются на бирже.</p>
    <div class="inp"><input type="email" placeholder="you@example.com" value="${S.email}" data-in="email" autocomplete="email" aria-label="Почта"></div>
    <p class="disc">Продолжая, вы соглашаетесь на обработку почты и записей о решениях. Деньги и токены мы не храним.</p>
    <button class="btn w press" data-onb="done">Войти и начать</button><button class="btn link" data-onb="1" data-back>Назад</button>`;
  return `<div class="onb"><div class="box ${dir || ''}">${body}</div></div>`;
}

/* ---------- окна ---------- */
const SHEETS = {
  alert(id) { const a = ALERTS.find(x => x.id === id);
    return `<span class="tag t-or">${ico(a.icon)}Повышенный риск</span>
      <h2 class="l">${a.head}</h2>
      <div class="kvs num">${a.kv.map(k => `<div class="kv"><span>${k[0]}</span><b class="${k[2] || ''}">${k[1]}</b></div>`).join('')}</div>
      <div class="note">${ico('info')}<span>${a.note}</span></div>
      <p class="src">Источники: ${a.src}</p>
      <button class="btn w press" data-act="recalc">Пересчитать мою сумму</button>
      <button class="btn link" data-act="close">Закрыть</button>`; },
  exit() { const BY = S.country === 'BY';
    return `<h2>Вы переходите на биржу</h2>
      <div class="warn"><b>Можно потерять всё.</b> Токены не являются средством платежа и не обеспечены государством. Потери возможны из-за резких колебаний цены, технических сбоев и хищений.</div>
      ${BY ? `<div class="rows">
        <button class="pick ${S.exPick === 'A' ? 'on' : ''}" data-pick="A"><i>А</i><span>Биржа-партнёр А<small>резидент ПВТ · встроен наш модуль риска</small></span><span class="ck"></span></button>
        <button class="pick ${S.exPick === 'B' ? 'on' : ''}" data-pick="B"><i>Б</i><span>Биржа-партнёр Б<small>резидент ПВТ</small></span><span class="ck"></span></button></div>`
        : `<div class="note">${ico('info')}<span>Для вашей страны партнёров пока нет. Расчёт и журнал работают без перехода.</span></div>`}
      <p class="disc">Мы получаем от биржи часть её комиссии с ваших сделок. На расчёт это не влияет. Сумму и сторону сделки вы вводите на бирже сами, мы их не передаём.</p>
      <div class="pair"><button class="btn d press" data-act="close">Отмена</button><button class="btn w press" data-act="openex" ${BY ? '' : 'disabled'}>Открыть биржу</button></div>`; },
  review(id) { const j = S.journal.find(x => x.id === id);
    return `<h2>Разбор решения от ${j.date}</h2>
      <div class="kvs num"><div class="kv"><span>План</span><b>до ${usd(j.plan)}</b></div><div class="kv"><span>Цена</span><b>$84 900 → $86 530</b></div><div class="kv"><span>Диапазон 80%</span><b class="up">попали ✓</b></div></div>
      <div class="field"><label for="inv">Сколько вложили фактически</label><div class="inp"><span>$</span><input id="inv" inputmode="numeric" placeholder="0, если не входили"></div></div>
      <div class="field"><label>Лимит ${usd(S.limit)} соблюдён?</label><div class="chips" data-lokgrp>${['Да','Нет','Не входил'].map((t,i) => `<button class="chip ${i === 0 ? 'on' : ''}" data-lok="${i}">${t}</button>`).join('')}</div></div>
      <p class="disc">Сумму вводите вы сами. Позже можно подключить биржу только на чтение.</p>
      <button class="btn w press" data-act="saverev" data-id="${id}">Сохранить разбор</button>`; },
  api() { const p = S.apiPerm, row = (k, t) => `<div class="gi"><span class="cat ${k === 'read' ? 'c-gr' : 'c-rd'}">${ico(k === 'read' ? 'lock' : 'close')}</span><div><b>${t}</b><small>${k === 'read' ? 'нужно для разбора' : 'должно быть выключено'}</small></div><button class="toggle" role="switch" aria-checked="${p[k]}" data-perm="${k}" aria-label="${t}"></button></div>`;
    return `<h2>Ключ API биржи-партнёра А</h2>
      <p class="disc">В демо можно выбрать, какие права «нашлись» у ключа при проверке.</p>
      <div class="inp"><input value="ca_demo_7f3e…b21" readonly aria-label="Ключ API"></div>
      <div class="grp">${row('read','Чтение истории')}${row('trade','Торговля')}${row('withdraw','Вывод средств')}</div>
      <div id="apiErr"></div>
      <button class="btn w press" data-act="apiconnect">Проверить и подключить</button>
      <button class="btn link" data-act="close">Отмена</button>`; },
  limit() { return `<h2>Лимит потерь на плохую неделю</h2>
      <div class="big num" id="limBig">${usd(S.limit)}</div>
      <input type="range" min="50" max="1000" step="10" value="${S.limit}" data-in="limit" aria-label="Лимит потерь">
      <div class="chips" style="justify-content:center">${[100,300,500].map(v => `<button class="chip num" data-limset="${v}">${usd(v)}</button>`).join('')}</div>
      <p class="disc">Лимит — главная настройка. Сумма всегда считается так, чтобы плохая неделя в него укладывалась.</p>
      <button class="btn w press" data-act="close">Готово</button>`; },
  voice() { return chatSheet(); },
};

/* слой окон: на телефоне лист снизу со смахиванием, на десктопе окно по центру */
const layer = document.createElement('div'); layer.className = 'layer'; layer.innerHTML = '<div class="scrim" data-act="close"></div><div class="sheet" role="dialog" aria-modal="true"></div>';
const sheet = layer.querySelector('.sheet'), scrim = layer.querySelector('.scrim');
let sheetType = null, lastFocus = null;
function openSheet(type, arg) {
  sheetType = type; lastFocus = document.activeElement;
  sheet.innerHTML = `<span class="grab" aria-hidden="true"></span>${SHEETS[type](arg)}`;
  sheet.style.transform = ''; sheet.style.transition = ''; scrim.style.opacity = '';
  sheet.scrollTop = 0;
  requestAnimationFrame(() => requestAnimationFrame(() => { layer.classList.add('open'); const f = sheet.querySelector('button,input'); if (f && !isPhone()) f.focus({preventScroll:true}); }));
  if (type === 'voice') initChat();
}
function refreshSheet(arg) { if (!sheetType) return; const st = sheet.scrollTop; sheet.innerHTML = `<span class="grab" aria-hidden="true"></span>${SHEETS[sheetType](arg)}`; sheet.scrollTop = st; }
function closeSheet() {
  if (!sheetType) return;
  sheetType = null; stopChat();
  sheet.style.transition = ''; sheet.style.transform = ''; scrim.style.opacity = '';
  layer.classList.remove('open');
  if (lastFocus && lastFocus.isConnected) lastFocus.focus({preventScroll:true});
}
/* смахивание листа вниз: 1:1 за пальцем, резинка вверх, закрытие по расстоянию или скорости */
(function dragSheet() {
  let y0 = 0, t0 = 0, dy = 0, drag = false, id = null, hist = [];
  sheet.addEventListener('pointerdown', e => {
    if (!isPhone() || drag || e.target.closest('button,input,select,a,[data-tog],.msgs')) return;
    if (sheet.scrollTop > 0 && !e.target.closest('.grab')) return;
    drag = true; id = e.pointerId; y0 = e.clientY; t0 = performance.now(); dy = 0; hist = [[t0, 0]];
    sheet.setPointerCapture(id); sheet.style.transition = 'none';
  });
  sheet.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== id) return;
    const raw = e.clientY - y0;
    dy = raw >= 0 ? raw : -((-raw) * 40) / (40 + (-raw)); /* резинка при попытке тянуть вверх */
    sheet.style.transform = `translateY(${dy}px)`;
    scrim.style.transition = 'none'; scrim.style.opacity = String(Math.max(0, 1 - dy / sheet.offsetHeight));
    const now = performance.now(); hist.push([now, raw]); if (hist.length > 5) hist.shift();
  });
  const end = e => {
    if (!drag || e.pointerId !== id) return; drag = false;
    const a = hist[0], b = hist[hist.length - 1], v = (b[1] - a[1]) / Math.max(1, b[0] - a[0]); /* px/ms */
    scrim.style.transition = '';
    if (dy > sheet.offsetHeight * 0.3 || v > 0.5) { closeSheet(); }
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
    <div class="chathead"><span class="aiava">${ico('logo')}</span><div style="flex:1;min-width:0"><b>Ассистент</b><small>ответит на любой вопрос · цену не предсказывает</small></div><span class="tag ${aiLive() ? 't-gr' : 't-gy'}">${aiLive() ? esc(modelName()) : 'демо'}</span></div>
    <div class="msgs" id="msgs" aria-live="polite"></div>
    <form class="composer" id="composer" autocomplete="off">
      <button type="button" class="micin press" data-act="listen" aria-label="Сказать голосом">${ico('mic')}</button>
      <input id="q" placeholder="Спросите что угодно…" enterkeyhint="send" aria-label="Вопрос ассистенту">
      <button type="submit" class="sendb press" aria-label="Отправить">${ico('send')}</button>
    </form>
    <p class="disc" style="font-size:11.5px">Ассистент не говорит, вырастет или упадёт цена, и не даёт сигналов. ${aiLive() ? 'Ответы ИИ могут быть неточными.' : 'Демо-режим: подключите модель в Настройках → Ассистент, чтобы задавать любые вопросы.'}</p>
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
  if (/лимит/.test(s)) return `Лимит — сколько вы готовы потерять за плохую неделю. Сейчас он ${usd(S.limit)}. Мы задаём его до того, как вы увидите рынок, чтобы не подгонять под желание войти. Поменять можно на экране «Сумма».`;
  if (/привет|здрав|hello|hi\b/.test(s)) return 'Привет! Чем помочь? Могу объяснить термины, ваш план или оповещение — или ответить на вопрос не про крипту.';
  return 'В демо-режиме я отвечаю только на несколько тем: funding, сумма под лимит, лимит, биржи ПВТ. Подключите модель в Настройках → Ассистент, и я отвечу на любой вопрос — кроме того, вырастет или упадёт цена.';
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
    const msg = st === 401 ? 'Ключ не подошёл. Проверьте его в Настройках → Ассистент.' : st === 402 ? 'На счёте OpenRouter закончились деньги. Пополните его или выберите бесплатную модель.' : st === 429 ? 'Бесплатная модель сейчас перегружена или упёрлась в лимит. Подождите немного или выберите другую модель.' : !navigator.onLine ? 'Нет интернета. Проверьте подключение.' : 'Не удалось связаться с ассистентом. Попробуйте ещё раз.';
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
  clearTimeout(bannerT); bannerT = setTimeout(hideBanner, 5200);
}
function hideBanner() { banner.classList.remove('show'); }
(function swipeBanner() { let y0 = null;
  banner.addEventListener('pointerdown', e => { y0 = e.clientY; });
  banner.addEventListener('pointerup', e => { if (y0 !== null && y0 - e.clientY > 20) { banner.onclick = null; hideBanner(); } y0 = null; }); })();
const toastEl = document.createElement('div'); toastEl.className = 'toast'; toastEl.setAttribute('role', 'status');
let toastT;
function toast(t) { toastEl.innerHTML = ico('check') + t; toastEl.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('show'), 2400); }
const alertBanner = () => showBanner('Прогноз обновился', 'BTC на 7 дней: риск падения больше 5% вырос до 19%. Ваш план вышел за лимит.', () => openSheet('alert', 'funding'));

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
  const isA = S.exPick === 'A'; exAmt = ''; exSide = 'buy';
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
function closeExchange() {
  exl.classList.add('hiding'); exl.classList.remove('show'); exl.setAttribute('aria-hidden', 'true');
  setTimeout(() => exl.classList.remove('hiding'), 460);
}
exl.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.ex === 'back') { closeExchange(); go('today'); setTimeout(() => toast('Сделка остаётся на бирже. Разбор — через неделю'), 300); }
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
  const al = activeAlerts().length;
  root.innerHTML = `<div class="shell">
    <aside class="side" aria-label="Разделы">
      <div class="brand"><span class="appic">${ico('logo')}</span>Crypto Analytics</div>
      ${Object.entries(VIEWS).map(([k, x]) => `<button class="nav" data-go="${k}">${ico(x.i)}${x.t}${k === 'today' ? `<span class="badge-n" data-badge ${al ? '' : 'hidden'}>${al}</span>` : ''}</button>`).join('')}
      <button class="nav" data-act="voice">${ico('mic')}Ассистент</button>
      <div class="grow"></div>
      <div class="demo"><b>Демо</b>
        <div class="ln"><span>Рынок перегрет</span><button class="toggle" role="switch" aria-checked="${S.alertOn}" data-act="alerttog" aria-label="Рынок перегрет"></button></div>
        <span>Переключите, чтобы увидеть, как меняются оповещения, сценарии и сумма.</span>
        <button class="btn link" data-act="reset" style="text-align:left;padding:2px 0;font-size:13px">Начать с первого экрана</button>
      </div>
    </aside>
    <main class="main"><div id="view"></div></main>
    <nav class="dock" aria-label="Разделы">
      <div class="tabs"><span class="ind" aria-hidden="true"></span>${TABS.map(k => `<button class="tab" data-go="${k}" aria-label="${VIEWS[k].t}">${ico(VIEWS[k].i)}${VIEWS[k].t}${k === 'today' ? `<span class="dot" data-badge ${al ? '' : 'hidden'}></span>` : ''}</button>`).join('')}</div>
      <button class="mic press" data-act="voice" aria-label="Спросить ассистента">${ico('mic')}</button>
    </nav>
  </div>`;
  shellOn = true;
}
function syncChrome() {
  const al = activeAlerts().length;
  root.querySelectorAll('.nav,.tab').forEach(b => b.classList.toggle('on', b.dataset.go === S.view));
  root.querySelectorAll('.nav,.tab').forEach(b => b.dataset.go === S.view ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current'));
  root.querySelectorAll('[data-badge]').forEach(b => { b.hidden = !al; if (b.classList.contains('badge-n')) b.textContent = al; });
  root.querySelectorAll('.side [data-act="alerttog"]').forEach(t => t.setAttribute('aria-checked', S.alertOn));
  const ind = root.querySelector('.dock .ind'), i = TABS.indexOf(S.view);
  if (ind) { ind.style.opacity = i < 0 ? '0' : '1'; if (i >= 0) ind.style.transform = `translateX(${i * 64}px)`; }
}
function renderView(animate) {
  const view = document.getElementById('view');
  const html = { today:vToday, scen:vScen, sum:vSum, journal:vJournal, review:vReview, alerts:vAlerts, settings:vSettings }[S.view]();
  if (animate) fanK = M().k;
  view.innerHTML = `<div class="${animate ? 'enter' : ''}">${html}</div>`;
  runTweens(view);
  if (!animate) morphFan();
  syncChrome();
}
function render(opts = {}) {
  if (S.onb !== 'done') { shellOn = false; root.innerHTML = vOnb(opts.dir); const pk = root.querySelectorAll('.pick'); pk.forEach(p => p.classList.toggle('on', p.dataset.country === S.country)); return; }
  if (!shellOn) renderShell();
  renderView(opts.animate !== false);
}
function go(v) {
  if (location.hash !== '#/' + v) { location.hash = '/' + v; return; }
  S.view = v; save(); render(); window.scrollTo({top:0});
}
addEventListener('hashchange', () => {
  const v = location.hash.replace('#/', '');
  if (S.onb !== 'done' || !VIEWS[v]) return;
  closeSheet(); S.view = v; save(); render(); window.scrollTo({top:0});
});

/* ---------- действия ---------- */
let lok = 0;
function setAlert(on) {
  S.alertOn = on; save();
  render({ animate:false });
  if (sheetType === 'limit') refreshSheet();
  if (on) setTimeout(alertBanner, 250); else toast('Рынок успокоился');
}
document.addEventListener('click', e => {
  const t = e.target.closest('button,[data-act]'); if (!t || exl.contains(t) || t === banner) return;
  const d = t.dataset;
  if (d.go) { closeSheet(); return go(d.go); }
  if (d.lim) { if (d.lim === 'custom') S.customLim = true; else { S.customLim = false; S.limit = +d.lim; } save(); return render(); }
  if (d.onb) {
    if (d.onb === 'done') { S.onb = 'done'; S.view = 'today'; save(); history.replaceState(null, '', '#/today'); render(); setTimeout(() => toast('Лимит ' + usd(S.limit) + ' сохранён'), 200); if (S.alertOn) setTimeout(alertBanner, 1600); return; }
    S.onb = +d.onb; save(); return render({ dir: d.back !== undefined ? 'bwd' : 'fwd' });
  }
  if (d.country) { S.country = d.country; save(); root.querySelectorAll('.pick').forEach(p => p.classList.toggle('on', p.dataset.country === S.country)); return; }
  if (d.alert) return openSheet('alert', d.alert);
  if (d.review) { lok = 0; return openSheet('review', +d.review); }
  if (d.pick) { S.exPick = d.pick; sheet.querySelectorAll('[data-pick]').forEach(p => p.classList.toggle('on', p === t)); return; }
  if (d.tog !== undefined && d.tog) { S.set[d.tog] = !S.set[d.tog]; save(); t.setAttribute('aria-checked', S.set[d.tog]); syncChrome(); return; }
  if (d.max) { S.set.maxDay = +d.max; save(); t.parentNode.querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c === t)); return; }
  if (d.perm) { S.apiPerm[d.perm] = !S.apiPerm[d.perm]; t.setAttribute('aria-checked', S.apiPerm[d.perm]); sheet.querySelector('#apiErr').innerHTML = ''; return; }
  if (d.lok !== undefined) { lok = +d.lok; t.parentNode.querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c === t)); return; }
  if (d.limset) { S.limit = +d.limset; save(); limChanged(); return; }
  if (d.key) return keypad(d.key);
  if (d.ask) return ask(d.ask);
  if (d.model) { AI.model = d.model; saveAI(); return render({ animate:false }); }
  switch (d.act) {
    case 'close': return closeSheet();
    case 'recalc': closeSheet(); return go('sum');
    case 'alerttog': t.setAttribute('aria-checked', !S.alertOn); return setAlert(!S.alertOn);
    case 'testbanner': return alertBanner();
    case 'reset': try { localStorage.removeItem(KEY); } catch (e) {} S = DEFAULT(); closeSheet(); history.replaceState(null, '', location.pathname); Object.keys(shown).forEach(k => delete shown[k]); return render({ dir:'bwd' });
    case 'voice': return openSheet('voice');
    case 'manual': closeSheet(); return go('sum');
    case 'voiceok': S.capital = +d.pcap; S.limit = +d.plim; save(); closeSheet(); toast(`Поняли: ${usd(S.capital)}, лимит ${usd(S.limit)}, 7 дней`); return go('sum');
    case 'listen': return listen(t);
    case 'aisave': { AI.key = (document.getElementById('aiKey')?.value || '').trim(); AI.proxy = (document.getElementById('aiProxy')?.value || '').trim(); const cm = (document.getElementById('aiModel')?.value || '').trim(); if (cm) AI.model = cm; saveAI(); render({ animate:false }); return toast(aiLive() ? 'Ассистент подключён: ' + modelName() : 'Ассистент в демо-режиме'); }
    case 'aiclear': AI = { key:'', proxy:'', model:MODELS[0].id }; saveAI(); render({ animate:false }); return toast('Ключ удалён из браузера');
    case 'editcap': return toast(isPhone() ? 'Введите капитал на клавиатуре ниже' : 'Печатайте цифры или жмите на клавиатуру справа');
    case 'editlim': return openSheet('limit');
    case 'skip': S.journal.unshift({ id:Date.now(), date:'18 окт.', kind:'skip', pending:true }); save(); toast('Записали: пропустил. Сравним через неделю'); return go('journal');
    case 'toex': {
      const sum = calcSum(); S.plan = { amount:sum, date:'18 окт.' };
      const j0 = S.journal[0];
      if (j0 && j0.date === '18 окт.' && j0.kind === 'plan') j0.plan = sum;
      else S.journal.unshift({ id:Date.now(), date:'18 окт.', kind:'plan', plan:sum, pending:true, reviewDate:'25 окт.' });
      save(); toast('План ' + usd(sum) + ' записан в журнал'); return openSheet('exit');
    }
    case 'openex': closeSheet(); return setTimeout(openExchange, 120);
    case 'saverev': {
      const j = S.journal.find(x => x.id === +d.id), inv = parseFloat((sheet.querySelector('#inv').value || '0').replace(/\s/g, '')) || 0;
      if (lok === 2 || inv === 0) { j.kind = 'skip'; j.inRange = true; } else { j.invested = inv; j.limitOk = lok === 0; j.inRange = true; }
      j.due = false; save(); closeSheet(); toast('Разбор сохранён'); return render({ animate:false });
    }
    case 'api': return openSheet('api');
    case 'apiconnect': {
      const p = S.apiPerm, err = sheet.querySelector('#apiErr');
      if (p.trade || p.withdraw) { err.innerHTML = `<div class="warn"><b>Ключ отклонён.</b> У него есть право ${[p.trade && 'торговли', p.withdraw && 'вывода'].filter(Boolean).join(' и ')}. Создайте на бирже ключ только на чтение.</div>`; return; }
      if (!p.read) { err.innerHTML = '<div class="warn"><b>Не хватает права на чтение истории.</b></div>'; return; }
      S.trades = 'api'; save(); closeSheet(); toast('Подключено только на чтение · 14 сделок'); return render();
    }
    case 'csv': S.trades = 'csv'; save(); toast('Файл загружен · 14 сделок'); return render();
    case 'untrades': S.trades = false; save(); toast('Источник сделок отключён'); return render();
  }
});
function limChanged() {
  const b = document.getElementById('limBig'); if (b) b.textContent = usd(S.limit);
  const r = sheet.querySelector('[data-in="limit"]'); if (r) r.value = S.limit;
  if (S.onb === 'done') render({ animate:false });
}
function keypad(k) {
  let c = String(S.capital);
  if (k === 'del') c = c.slice(0, -1) || '0';
  else if (k === 'C') c = '0';
  else if (k === '+') c = String(+c + 500);
  else if (k === '−') c = String(Math.max(0, +c - 500));
  else c = c === '0' ? k.replace(/^0+/, '') || '0' : c + k;
  S.capital = Math.min(9999999, +c || 0); save();
  /* клавиатура — частое действие: обновляем числа сразу, без анимации */
  ['sum','cap','cap2','bad'].forEach(key => delete shown[key]);
  render({ animate:false });
}
document.addEventListener('input', e => {
  const k = e.target.dataset.in; if (!k) return;
  const v = e.target.value;
  if (k === 'capital') { S.capital = Math.max(0, parseInt(v.replace(/\D/g, '')) || 0); save(); }
  else if (k === 'customlim') { S.limit = Math.max(10, parseInt(v.replace(/\D/g, '')) || 300); save(); const b = document.getElementById('onbLim'); if (b) b.textContent = usd(S.limit); }
  else if (k === 'email') { S.email = v; save(); }
  else if (k === 'limit') { S.limit = +v; save(); limChanged(); }
});
document.addEventListener('change', e => { if (e.target.dataset.sel === 'country') { S.country = e.target.value; save(); } });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { if (sheetType) return closeSheet(); if (exl.classList.contains('show')) { closeExchange(); return go('today'); } }
  if (S.onb === 'done' && S.view === 'sum' && !sheetType && !e.target.closest('input,select,textarea') && !exl.classList.contains('show')) {
    if (/^[0-9]$/.test(e.key)) keypad(e.key);
    else if (e.key === 'Backspace') keypad('del');
  }
});

/* ---------- старт ---------- */
document.body.append(layer, banner, toastEl, exl);
const startV = location.hash.replace('#/', '');
if (S.onb === 'done' && VIEWS[startV]) S.view = startV;
if (S.onb === 'done') history.replaceState(null, '', '#/' + S.view);
render();
