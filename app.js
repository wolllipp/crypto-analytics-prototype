/* Crypto Analytics — прототип, редизайн 20.10.2026 по отзывам трейдера и новичка.
   Структура: Главная (кошельки только на просмотр, цена BTC, 4 действия, сумма в пределах лимита, новости) ·
   Рынок (прогнозы, сценарии, монеты, новости) · Журнал (решения, сделки, итоги) · «Спросить» (ассистент).
   Вход: «Попробовать без денег» (песочница, без почты и согласий) или 3 шага реального режима.
   Согласия и страна — только перед переходом на биржу-партнёр.
   Под перенос в React Native (Expo): экраны собраны из одних и тех же компонентов (карточка, крупная цифра, кнопка,
   строка, карточка кошелька, круглое действие, подсказка термина), раскладка только flex, эффекты с аналогами в Expo
   (размытие → expo-blur, графики → react-native-svg, градиент карточки → expo-linear-gradient, анимации → transform и opacity).
   Цифры иллюстративные. */
'use strict';

/* ---------- данные и модель ---------- */
const PRICE = 86530, USD_BYN = 3.275, BTC_BYN = 283400, CHG24 = 1.2;
const LIMIT_PCT = 0.06, LIM_PCTS = [0.03, 0.06, 0.1];   /* лимит по умолчанию — 6% баланса */
const SAND_CAP = 1000;                                 /* новичку $5 000 — «много»: виртуальные $1 000 */
const DISC = 'Это не рекомендация купить или продать, а информация для пересчёта вашего плана.';
/* bad — сильное падение: средний результат 1 недели из 10 с самым сильным падением; fg — индекс страха и жадности */
const MARKET = {
  calm:  { tails:[15,69,16], lo:81122, hi:92383, bad:300/3467, minus:51, k:1, fg:54 },
  alert: { tails:[19,64,17], lo:80400, hi:92900, bad:300/2740, minus:53, k:1.11, fg:72 },
};
/* даты — от сегодняшнего дня, чтобы расчёт не выглядел застывшим */
const MON = ['янв.','февр.','марта','апр.','мая','июня','июля','авг.','сент.','окт.','нояб.','дек.'];
const DAYS = ['воскресенье','понедельник','вторник','среда','четверг','пятница','суббота'];
const NOW = new Date();
const dAt = off => { const d = new Date(NOW); d.setDate(d.getDate() + off); return d; };
const dShort = off => { const d = dAt(off); return `${d.getDate()} ${MON[d.getMonth()]}`; };
const todayLong = () => `${DAYS[NOW.getDay()]}, ${NOW.getDate()} ${['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'][NOW.getMonth()]}`;
/* прошлая неделя: по ней считаем итог в песочнице и при «перемотке» (цифры демо) */
const WEEK = { from:84900, to:PRICE, low:82270, lo:80900, hi:91800, chg:PRICE / 84900 - 1, worst:1 - 82270 / 84900,
  label:() => { const a = dAt(-7), b = dAt(0); return a.getMonth() === b.getMonth() ? `${a.getDate()}–${b.getDate()} ${MON[b.getMonth()]}` : `${dShort(-7)} – ${dShort(0)}`; } };

/* словарь: подсказка «?» у каждого термина — простыми словами */
const GLOSS = {
  limit:['Лимит потерь', 'Сколько денег вы готовы потерять за одну плохую неделю. Это не цель и не прогноз, а ваша граница. По умолчанию — 6% баланса, можно поменять.'],
  sum:['Сумма в пределах лимита', 'Сколько можно держать в биткоине, чтобы плохая неделя обошлась примерно в ваш лимит. Считаем так: лимит ÷ сильное падение, но не больше баланса. Это не совет купить — это граница для вашего плана.'],
  bad:['Сильное падение', 'Модель прокручивает 20 000 возможных недель. Мы берём 1 неделю из 10 — самые неудачные — и смотрим, сколько в среднем теряла цена. Бывает и хуже.'],
  model:['Модель', 'Программа, которая по прошлым ценам и данным с бирж прикидывает, какими могут быть следующие 7 дней. Будущего она не знает — она показывает разброс.'],
  range:['Диапазон', 'Между какими ценами окажется биткоин через неделю в 8 случаях из 10 по модели. Чем он шире, тем меньше уверенности.'],
  scen:['Сценарии', 'Возможные варианты недели, которые просчитала модель. Тонкие линии на графике — несколько таких вариантов, закрашенная область — где оказалось большинство.'],
  partner:['Биржа-партнёр', 'Место, где на самом деле покупают и продают биткоин. Деньги, проверка личности и сделки — там. Мы только показываем расчёт и переводим вас на сайт биржи.'],
  pvt:['Резидент ПВТ', 'Компания из белорусского Парка высоких технологий. По закону Беларуси покупать и продавать токены за деньги можно только у таких компаний. Список — на сайте park.by.'],
  token:['Токен', 'Цифровая монета, например биткоин. Не является деньгами и не обеспечен государством, цена может сильно меняться.'],
  lev:['Плечо', 'Покупка на заёмные деньги. Плата за плечо (funding) — сколько за это платят. Когда так покупают многие, цена может резко упасть: им приходится продавать разом.'],
  fut:['Фьючерсы', 'Договоры на покупку или продажу по цене в будущем. На них часто торгуют с плечом. Мы их не считаем, но следим: там видно, сколько на рынке заёмных денег.'],
  fg:['Индекс страха и жадности', 'Настроение рынка от 0 (все боятся) до 100 (все жадничают). Считает сайт alternative.me. В наш расчёт не входит — это фон.'],
  dvol:['Ожидаемый размах цены', 'Насколько сильно, по мнению рынка, цена может качаться в ближайший месяц. Это индекс DVOL биржи Deribit, в пунктах: около 40 — спокойно, около 60 — неспокойно.'],
  alert:['Оповещение', 'Сообщение внутри приложения, когда риск недели заметно меняется. Всегда отвечает на три вопроса: что случилось, что это значит для вас и откуда данные.'],
  sand:['Песочница', 'Режим с виртуальными $1 000: те же расчёты, но без настоящих денег. Записи помечаются и не смешиваются с реальными.'],
  wallet:['Кошелёк в приложении', 'Только просмотр. Баланс вы вводите сами или подключаете биржу либо адрес только на чтение. Мы не храним деньги и не можем ими распоряжаться.'],
};
/* оповещения: что случилось → что это значит для вас → как это меняет сумму → откуда данные */
const ALERTS = [
  { id:'funding', set:'funding', icon:'stack', cls:'c-or', title:'Многие покупают на заёмные деньги', short:'Плата за плечо выше, чем в 94% дней года',
    means:'Резкое падение стало вероятнее, поэтому сумма в пределах лимита уменьшилась.',
    kv:[['Падение больше 5% по модели','15% → 19%'],['Плата за плечо (funding)','0,045% за 8 ч'],['Ставок на фьючерсах','+12% за 3 дня'],['Цена за 3 дня','+1%']],
    note:'Раньше после такого перекоса резкое падение случалось чаще, но не всегда.',
    src:'Binance, Bybit, OKX · обновлено сегодня в 09:30' },
  { id:'vol', set:'vol', icon:'wave', cls:'c-vi', title:'Цена стала колебаться сильнее', short:'Ожидаемый размах цены +10% за 2 дня',
    means:'Цена может сильнее качнуться в обе стороны, поэтому сумма под ваш лимит меньше.',
    kv:[['Ширина диапазона по модели','$11 261 → $12 500'],['Ожидаемый размах цены (DVOL)','52 → 58 пунктов']],
    note:'Движения ожидаются сильнее в обе стороны.',
    src:'Deribit (индекс DVOL) и модель сценариев · обновлено сегодня в 09:30' },
];
/* факторы: направление, сила, источник, время, как считаем, ограничение */
const F_TREND = { id:'trend', icon:'trend', cls:'c-bl', t:'Направление цены', s:'Цена выше средней за 50 и 200 дней', src:'Binance', at:'09:30', p:2, val:'+6% к средней за 50 дней', how:'Сравниваем цену со средней ценой за последние 50 и 200 дней.', lim:'Когда цена стоит на месте, этот фактор почти ничего не добавляет.' };
const F_FED = { id:'fed', icon:'info', cls:'c-gy', t:'Решение по ставке в США 29 окт.', s:'Модель не учитывает новости', src:'—', at:'', p:0, val:'вне модели', how:'Новости и решения регуляторов в модель не входят.', lim:'Сильные новости могут вывести цену за любой диапазон.' };
const FACTORS = () => S.alertOn ? {
  up:[F_TREND,
    { id:'flow', icon:'flow', cls:'c-te', t:'Биткоин уходит с бирж', s:'За неделю забрали 18 тыс. BTC', src:'CryptoQuant', at:'08:00', p:1, val:'−18 тыс. BTC за 7 дней', how:'Считаем, сколько BTC пришло на кошельки бирж и ушло с них.', lim:'Данные приходят с задержкой до 2 часов, часть кошельков неизвестна.' }],
  down:[
    { id:'funding', icon:'stack', cls:'c-or', t:'Покупки на заёмные деньги', s:'Плата за плечо 0,045% за 8 ч — выше, чем в 94% дней года', src:'Binance, Bybit, OKX', at:'09:30', p:3, val:'0,045% за 8 ч', how:'Средняя плата за плечо (funding) на бессрочных фьючерсах трёх бирж.', lim:'Когда цена уверенно растёт, высокая плата может держаться неделями.' },
    { id:'oi', icon:'layers', cls:'c-ye', t:'Ставок на фьючерсах больше', s:'+12% за 3 дня, а цена +1%', src:'Binance', at:'09:30', p:2, val:'+12% за 3 дня', how:'Ставок (открытых позиций) становится больше, а цена не растёт — так копятся заёмные деньги.', lim:'Не показывает, в какую сторону сделаны ставки.' }],
  unk:[F_FED,
    { id:'etf', icon:'info', cls:'c-gy', t:'Фонды на биткоин в США за пятницу', s:'Данные пришли не полностью', src:'Farside', at:'вчера', p:0, val:'нет данных', how:'Сколько денег за день пришло в фонды на биткоин в США и ушло из них.', lim:'Пока данных нет, фактор в расчёте не участвует.' }],
} : {
  up:[F_TREND,
    { id:'oi', icon:'layers', cls:'c-ye', t:'Ставки на фьючерсах', s:'+2% за 3 дня вместе с ценой', src:'Binance', at:'09:30', p:1, val:'+2% за 3 дня', how:'Ставки растут вместе с ценой — перекоса нет.', lim:'Не показывает, в какую сторону сделаны ставки.' }],
  down:[
    { id:'vol', icon:'wave', cls:'c-vi', t:'Ожидаемый размах цены', s:'44 пункта — в обычных пределах', src:'Deribit', at:'09:30', p:1, val:'44 пункта', how:'Какой размах цены на месяц вперёд закладывают покупатели опционов (индекс DVOL).', lim:'Рынок опционов на биткоин небольшой, оценка шумная.' }],
  unk:[F_FED],
};
/* «что изменит картину»: у каждого пункта — пояснение, что это такое */
const CHANGERS = () => S.alertOn ? [
  { id:'fund', t:'Плата за плечо снизится до 0,02% за 8 ч', s:'риск падения вернётся к ~15%', g:'lev',
    what:'Плата за плечо (funding) — сколько каждые 8 часов платят друг другу те, кто торгует на фьючерсах на заёмные деньги. Высокая плата значит, что многие поставили на рост. Когда она снижается, перекос уходит.' },
  { id:'dvol', t:'Ожидаемый размах цены опустится ниже 52 пунктов', s:'сейчас 58 · диапазон сузится примерно на 10%', g:'dvol',
    what:'Индекс ожидаемого размаха цены (DVOL) считает биржа опционов Deribit, в пунктах. Он показывает, насколько сильных движений рынок ждёт в ближайший месяц: около 40 — спокойно, около 60 — неспокойно.' },
] : [
  { id:'fund', t:'Плата за плечо поднимется выше 0,04% за 8 ч', s:'риск падения вырастет до ~19%', g:'lev',
    what:'Плата за плечо (funding) — сколько каждые 8 часов платят друг другу те, кто торгует на фьючерсах на заёмные деньги. Высокая плата значит, что многие поставили на рост, и резкое падение становится вероятнее.' },
];
/* топ-20 по капитализации: цена и изменение за 24 ч (демо) */
const TOKENS = [
  ['BTC','Биткоин',86530,1.2],['ETH','Эфир',3112,-0.8],['USDT','Tether',1,0],['XRP','XRP',2.41,2.3],['BNB','BNB',612,0.4],
  ['SOL','Solana',182.4,-1.9],['USDC','USD Coin',1,0],['DOGE','Dogecoin',0.198,3.1],['TRX','TRON',0.271,0.6],['ADA','Cardano',0.74,-1.2],
  ['LINK','Chainlink',17.9,-0.5],['AVAX','Avalanche',31.2,-2.4],['XLM','Stellar',0.38,1.1],['SUI','Sui',3.62,4],['TON','Toncoin',4.9,-0.7],
  ['SHIB','Shiba Inu',0.0000181,1.5],['HBAR','Hedera',0.24,0.9],['DOT','Polkadot',5.8,-1],['BCH','Bitcoin Cash',486,0.3],['LTC','Litecoin',98.4,-0.4],
].map(([s, n, p, c]) => ({ s, n, p, c }));
/* лента новостей (демо, заголовки условные): простыми словами и что это значит для вас */
const NEWS = [
  { t:'В США 29 октября решат, менять ли ставку', tag:'Экономика', ago:'2 ч назад', means:'Новости модель не учитывает. В дни таких решений цена может выйти за диапазон сценариев.' },
  { t:'Покупок биткоина на заёмные деньги больше всего за 3 месяца', tag:'Рынок', ago:'4 ч назад', means:'Когда заёмных денег много, резкие падения случаются чаще. Это учтено в расчёте суммы.' },
  { t:'В фонды на биткоин в США третью неделю приходят деньги', tag:'Фонды', ago:'вчера', means:'Фон для рынка, в расчёт суммы напрямую не входит.' },
  { t:'Крупные владельцы забрали с бирж 18 тыс. BTC за неделю', tag:'Потоки', ago:'вчера', means:'Учтено в расчёте риска, влияние слабое.' },
];
const CLOSES = [77439,77340,81270,79661,79832,80342,79112,78456,78306,76569,77226,77279,76842,78189,75644,76206,76417,80884,81250,81178,86620,86209,84398,84410,84100,84433,84472,83500,83664,86530];
const WEEKS = [1,1,1,0,1,1,1,1,0,1,1,1];
const ISSUES = [ /* архив выпусков: прогноз до результата и итог */
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
/* пример с историей — только для показа (Профиль → Демо), каждая запись помечена «пример» */
const DEMO_J = () => [
  { id:1, demo:true, date:'11 окт.', kind:'ex', ex:'1', plan:3200, limit:300, due:true },
  { id:2, demo:true, date:'5 окт.', kind:'ex', ex:'1', plan:3467, invested:3000, limit:300, inRange:true, limitOk:true, result:{ amt:3000, worst:93, end:57 } },
  { id:3, demo:true, date:'28 сен.', kind:'skip', plan:3300, invested:0, limit:300, inRange:true },
  { id:4, demo:true, date:'21 сен.', kind:'plan', plan:3100, invested:3100, limit:300, inRange:false, limitOk:true, note:'падение −7,8%', result:{ amt:3100, worst:242, end:-178 } },
];
/* биржи-партнёры: названия появятся после договора — честно пишем об этом */
const EXCH = { '1':'Биржа-партнёр №1', '2':'Биржа-партнёр №2' };

const DEFAULT = () => ({
  onb:'land', realReady:false, consent:null, cons:{ model:false, loss:false },
  capital:0, limit:0, limitAuto:true, customCap:false, limEdit:false,
  acc:{ real:null, sand:{ capital:SAND_CAP, limit:Math.round(SAND_CAP * LIMIT_PCT), limitAuto:true } },
  wallets:[], country:null, email:'', sandbox:false, demo:false, seenSum:false,
  view:'home', alertOn:false, noSignal:false, veil:false,
  stop:'', fee:'', slip:'', pos:'',
  hypOpen:false, hyp:null, conf:null, note:'', pick:'plan',
  plan:null, journal:[], jseg:'dec', fseg:'down',
  trades:false, apiPerm:{read:true,trade:false,withdraw:false},
  set:{ funding:true, oi:true, vol:true, flow:false, maxDay:2, quiet:true },
  exPick:'1',
});
let S = DEFAULT();
const KEY = 'ca-proto-v4';   /* v4: кошельки, раздельные балансы песочницы и реального режима, чистый старт */
try { const saved = JSON.parse(localStorage.getItem(KEY) || 'null'); if (saved) S = Object.assign(DEFAULT(), saved); } catch (e) {}

/* тема: «Системная» следует настройке устройства; выбор хранится отдельно от состояния и не сбрасывается «Начать заново» */
const THEME_KEY = 'ca-theme';
let THEME = 'system';
try { THEME = localStorage.getItem(THEME_KEY) || 'system'; } catch (e) {}
const darkMQ = matchMedia('(prefers-color-scheme: dark)');
function applyTheme() {
  const root = document.documentElement;
  if (THEME === 'system') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', THEME);
  const dark = THEME === 'dark' || (THEME === 'system' && darkMQ.matches);
  const m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute('content', dark ? '#000000' : '#f2f2f7');
}
function setTheme(t) {
  THEME = t; try { localStorage.setItem(THEME_KEY, t); } catch (e) {}
  if (document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) document.startViewTransition(applyTheme); else applyTheme();
}
applyTheme();
darkMQ.addEventListener('change', () => { if (THEME === 'system') applyTheme(); });
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };

const M = () => S.alertOn ? MARKET.alert : MARKET.calm;
const fmt = n => Math.round(n).toLocaleString('ru-RU');
const usd = n => (n < 0 ? '−' : '') + '$' + fmt(Math.abs(n));
const sgn = n => (n > 0 ? '+' : n < 0 ? '−' : '') + '$' + fmt(Math.abs(n));
const num = v => parseFloat(String(v ?? '').replace(/\s/g, '').replace(',', '.')) || 0;
const pct1 = x => (x * 100).toFixed(1).replace('.', ',') + '%';
const autoLim = cap => Math.max(10, Math.round(cap * LIMIT_PCT));
const limPct = () => S.capital ? Math.round(S.limit / S.capital * 100) + '% баланса' : '';
function setCapital(v) { S.capital = Math.min(9999999, Math.max(0, Math.round(v))); if (S.limitAuto) S.limit = autoLim(S.capital); }
const walletsTotal = () => S.wallets.reduce((a, w) => a + w.bal, 0);

/* живая цена: в прототипе «дышит» имитацией раз в 15 с, модель от неё не зависит */
let LIVE = PRICE, liveAt = Date.now() - 2 * 60000;
const live24 = () => (LIVE / (PRICE / (1 + CHG24 / 100)) - 1) * 100;
const ago = () => { const m = Math.floor((Date.now() - liveAt) / 60000); return m < 1 ? 'обновлено только что' : `обновлено ${m} мин назад`; };

/* сумма в пределах лимита = лимит ÷ сильное падение, но не больше баланса и минус то, что уже в BTC.
   Сильное падение — средний результат 1 недели из 10 с самым сильным падением (по 20 000 смоделированных недель).
   Продажа по заданной цене ограничивает падение; комиссии и разница цены его увеличивают. */
function calc(over) {
  const m = M(), o = Object.assign({ capital:S.capital, limit:S.limit, stop:S.stop, fee:S.fee, slip:S.slip, pos:S.pos }, over || {});
  if (S.noSignal) return { none:true, reason:'Данные с бирж пришли не полностью. Считать не будем, пока не обновятся.' };
  const base = m.bad, st = num(o.stop);
  let per = base, stopD = 0;
  if (st > 0 && st < PRICE) {
    const d = (PRICE - st) / PRICE;
    if (d < 0.02) return { none:true, reason:'Цена продажи ближе, чем обычное движение цены за день. Расчёт ненадёжен.' };
    if (d < per) { per = d; stopD = d; }
  }
  const costRate = (num(o.fee) + num(o.slip)) / 100 * 2;
  per += costRate;
  const raw = Math.round(o.limit / per), pos = num(o.pos), capped = raw > o.capital;
  const sum = Math.max(0, Math.min(o.capital, raw) - pos);
  return { sum, raw, per, base, stopD, costRate, capped, pos, bad:Math.round(sum * per), costs:Math.round(sum * costRate), adjusted: per !== base || pos > 0 };
}
const calcSum = () => calc().sum || 0;
const calmSum = () => Math.min(S.capital, Math.round(S.limit / MARKET.calm.bad));
const planBad = () => Math.round(S.plan.amount * M().bad);
const planOver = () => !!S.plan && !S.sandbox && planBad() > S.limit;
const activeAlerts = () => S.alertOn && !S.noSignal ? ALERTS.filter(a => S.set[a.set]) : [];
const REGIMES = { trend:['Устойчивое движение','цена долго идёт в одну сторону'], range:['Спокойно','цена ходит в узком коридоре'], stress:['Неспокойно','много покупок на заёмные деньги, возможны резкие движения'], unk:['Неясно','данных мало или они противоречат друг другу'] };
const regimeKey = () => S.noSignal ? 'unk' : S.alertOn ? 'stress' : 'range';
const regime = () => REGIMES[regimeKey()][0];
const fgLabel = v => v < 25 ? 'сильный страх' : v < 45 ? 'страх' : v <= 55 ? 'нейтрально' : v <= 75 ? 'жадность' : 'сильная жадность';
const fresh = () => S.noSignal ? { c:'or', t:'данные от вчера, 06:10' } : { c:'gr', t:'сегодня в 09:30' };
const ico = (id, c = 'i') => `<svg class="${c}" aria-hidden="true"><use href="#${id}"/></svg>`;
const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const isPhone = () => matchMedia('(max-width: 899px)').matches;
const initial = () => (S.email.trim()[0] || 'Я').toUpperCase();
const price = p => p >= 100 ? usd(p) : p >= 1 ? '$' + p.toFixed(2).replace('.', ',') : '$' + p.toPrecision(3).replace('.', ',');
const chg = c => (c > 0 ? '+' : c < 0 ? '−' : '') + Math.abs(c).toFixed(1).replace('.', ',') + '%';
const chgCls = c => c > 0 ? 'up' : c < 0 ? 'dn' : '';
/* журнал по режимам: записи песочницы не смешиваются с реальными (график, статистика, итоги) */
const realJ = () => S.journal.filter(j => !j.sand);
const modeJ = () => S.journal.filter(j => !!j.sand === S.sandbox);
/* итог недели для записи: сколько было в BTC, худший момент и конец недели (по данным прошлой недели) */
function resolve(j, invested) {
  if (invested != null) j.invested = invested;
  const amt = j.invested ?? ((j.kind === 'plan' || j.kind === 'ex') ? j.plan : 0), lim = j.limit || S.limit;
  const hypo = amt ? 0 : j.plan || 0, base = amt || hypo;
  j.result = { amt, hypo, worst:Math.round(base * WEEK.worst), end:Math.round(base * WEEK.chg) };
  j.limitOk = Math.round(amt * WEEK.worst) <= lim; j.inRange = true; j.pending = false; j.due = false;
  return j;
}
/* ---------- веер сценариев: история 30 дней + полосы 50% / 80% на 7 дней ---------- */
const FAN = { L:4, R:44, T:8, B:18, lo:73000, hi:97000 };
const FAN_DIMS = { '':[300,200], compact:[300,200], wide:[720,230] };
const SD = 0.3717 / Math.sqrt(365);
const PATHS = (() => { let s = 7; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const g = () => Math.sqrt(-2 * Math.log(r() + 1e-9)) * Math.cos(2 * Math.PI * r());
  return Array.from({length:22}, () => Array.from({length:7}, g)); })();
let fanK = null, fanDrawn = false;
function fanGeo(k, W, H) {
  const {L,R,T,B,lo,hi} = FAN, n = CLOSES.length, hw = (W-L-R)*.66, fw = (W-L-R)*.34;
  const x = i => i <= n-1 ? L + hw*i/(n-1) : L + hw + fw*(i-(n-1))/7;
  const y = v => T + (H-T-B)*(hi-Math.max(lo,Math.min(hi,v)))/(hi-lo);
  const drift = 0;  /* направление не рисуем: модель его не знает */
  const q = (z,d) => PRICE*Math.exp(drift*d + z*SD*k*Math.sqrt(d));
  const band = z => { const up=[], dn=[]; for (let d=0; d<=7; d++){ up.push(`${x(n-1+d).toFixed(1)},${y(q(z,d)).toFixed(1)}`); dn.unshift(`${x(n-1+d).toFixed(1)},${y(q(-z,d)).toFixed(1)}`);} return up.concat(dn).join(' '); };
  const paths = PATHS.map(zs => { let p = PRICE; const pts=[`${x(n-1)},${y(PRICE)}`]; zs.forEach((z,d) => { p *= Math.exp(drift + z*SD*k); pts.push(`${x(n+d).toFixed(1)},${y(p).toFixed(1)}`); }); return pts.join(' '); });
  const med = Array.from({length:8}, (_,d) => `${x(n-1+d).toFixed(1)},${y(q(0,d)).toFixed(1)}`).join(' ');
  return { x, y, n, b80:band(1.2816), b50:band(0.6745), paths, med };
}
function fanSVG(draw, variant = '') {
  const [W, H] = FAN_DIMS[variant], k = fanK ?? M().k, g = fanGeo(k, W, H), {L,R,B} = FAN, gid = 'hg' + (variant || 'd');
  const hist = CLOSES.map((v,i) => `${g.x(i).toFixed(1)},${g.y(v).toFixed(1)}`).join(' ');
  let len = 0; CLOSES.forEach((v,i) => { if (i) len += Math.hypot(g.x(i)-g.x(i-1), g.y(v)-g.y(CLOSES[i-1])); });
  const grid = [80000,85000,90000,95000].map(v => `<line x1="${L}" x2="${W-R}" y1="${g.y(v)}" y2="${g.y(v)}"/><text x="${W-R+4}" y="${g.y(v)+3}">${v/1000} тыс.</text>`).join('');
  return `<svg class="fan ${variant} ${draw && !reduce() ? 'draw' : ''}" data-w="${W}" data-h="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Цена BTC за 30 дней и сценарии модели на 7 дней вперёд">
    <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="rgba(10,132,255,.28)"/><stop offset="1" stop-color="rgba(10,132,255,0)"/></linearGradient></defs>
    ${grid}
    <polygon class="band" data-b="80" points="${g.b80}" fill="rgba(10,132,255,.16)"/>
    <polygon class="band" data-b="50" points="${g.b50}" fill="rgba(10,132,255,.32)"/>
    <g class="paths">${g.paths.map(p => `<polyline points="${p}" fill="none" stroke-width=".8"/>`).join('')}</g>
    <polygon points="${hist} ${g.x(g.n-1)},${H-B} ${g.x(0)},${H-B}" fill="url(#${gid})"/>
    <polyline class="hist" style="--len:${len.toFixed(0)}" points="${hist}" fill="none" stroke="#0a84ff" stroke-width="1.8" stroke-linejoin="round"/>
    <polyline class="med" points="${g.med}" fill="none" stroke="#0a84ff" stroke-width="1.2" stroke-dasharray="3 3"/>
    <circle cx="${g.x(g.n-1)}" cy="${g.y(PRICE)}" r="4" fill="#0a84ff" stroke-width="2"/>
    <text x="${L}" y="${H-4}">19 сент.</text><text x="${g.x(g.n-1)}" y="${H-4}" text-anchor="middle">сегодня</text><text x="${W-R}" y="${H-4}" text-anchor="end">+7 дн.</text>
  </svg>`;
}
/* при смене рынка полосы веера плавно перетекают (400 мс), а не перерисовываются */
function morphFan() {
  const svgs = document.querySelectorAll('#view .fan');
  const from = fanK ?? M().k, to = M().k; fanK = to;
  if (!svgs.length || from === to) return;
  const apply = k => svgs.forEach(svg => { const g = fanGeo(k, +svg.dataset.w, +svg.dataset.h);
    svg.querySelector('[data-b="80"]').setAttribute('points', g.b80);
    svg.querySelector('[data-b="50"]').setAttribute('points', g.b50);
    svg.querySelector('.med').setAttribute('points', g.med);
    svg.querySelectorAll('.paths polyline').forEach((p,i) => p.setAttribute('points', g.paths[i])); });
  if (reduce()) return apply(to);
  const t0 = performance.now(), dur = 400, io = t => t < .5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3) / 2;
  (function step(now){ const t = Math.min(1,(now-t0)/dur); apply(from + (to-from)*io(t)); if (t < 1) requestAnimationFrame(step); })(t0);
}

/* «план и факт»: как менялась сумма в пределах лимита и сколько было в сделке — только реальные записи, без песочницы */
function planChart() {
  const P = realJ().filter(j => j.plan).slice(0, 5).reverse().map(j => ({ d:j.date, plan:j.plan, fact:j.invested ?? (j.kind === 'skip' ? 0 : null) }));
  if (!P.length) return `<div class="empty">График появится после первого реального решения. Записи песочницы сюда не попадают.</div>`;
  P.push({ d:'сегодня', plan:calcSum(), alert:S.alertOn });
  const W = 320, H = 160, L = 8, R = 8, T = 24, B = 24, n = P.length;
  const max = Math.max(1000, ...P.map(p => Math.max(p.plan, p.fact || 0))) * 1.15;
  const x = i => L + (W-L-R) * (i + .5) / n, y = v => T + (H-T-B) * (1 - v / max), bw = 18;
  const k = v => v >= 1000 ? (v/1000).toFixed(1).replace('.', ',') + ' тыс.' : fmt(v);
  const bars = P.map((p, i) => p.fact ? `<rect class="pf-bar" x="${x(i)-bw/2}" y="${y(p.fact)}" width="${bw}" height="${H-B-y(p.fact)}" rx="6"/>`
    : p.fact === 0 ? `<text class="pf-skip" x="${x(i)}" y="${H-B-6}" text-anchor="middle">пропуск</text>` : '').join('');
  const line = P.map((p, i) => `${x(i).toFixed(1)},${y(p.plan).toFixed(1)}`).join(' ');
  const dots = P.map((p, i) => `<circle class="${p.alert ? 'pf-al' : 'pf-dot'}" cx="${x(i)}" cy="${y(p.plan)}" r="${p.alert ? 5 : 3.5}"/>`).join('');
  const vals = P.map((p, i) => `<text class="pf-v" x="${x(i)}" y="${y(p.plan)-10}" text-anchor="middle">${k(p.plan)}</text>`).join('');
  const labels = P.map((p, i) => `<text x="${x(i)}" y="${H-6}" text-anchor="middle">${p.d}</text>`).join('');
  return `<svg class="pf" viewBox="0 0 ${W} ${H}" role="img" aria-label="Как менялась сумма в пределах лимита и сколько было в сделке">${bars}${n > 1 ? `<polyline class="pf-line" points="${line}"/>` : ''}${dots}${vals}${labels}</svg>
    <div class="legend"><span><i class="lg lg-line"></i>сумма в пределах лимита</span><span><i class="lg lg-bar"></i>было в сделке</span>${S.alertOn ? '<span><i class="lg lg-al"></i>после оповещения</span>' : ''}</div>`;
}

/* ---------- компоненты (каждый потом станет компонентом React Native) ---------- */
const chev = `<span class="chev">${ico('chev')}</span>`;
/* строка: с действием — кнопка с шевроном; без действия — просто значение, без вида кнопки */
function row(o) {
  const tap = !!o.attrs, tag = tap ? 'button' : 'div';
  const lead = o.lead || (o.tile ? `<span class="cat ${o.cls || 'c-gy'}">${ico(o.tile)}</span>` : o.glyph ? `<span class="gl">${ico(o.glyph)}</span>` : '');
  return `<${tag} class="row${tap ? ' tap press' : ''}${o.extra ? ' ' + o.extra : ''}" ${o.attrs || ''}>${lead}<span class="rt"><b>${o.title}</b>${o.sub ? `<small>${o.sub}</small>` : ''}</span>${o.val != null ? `<span class="v ${o.vc || ''}">${o.val}</span>` : ''}${o.right || ''}${tap && !o.nochev ? chev : ''}</${tag}>`;
}
/* группа строк: разделитель — отдельный элемент, а не CSS-селектор соседей (в RN это <Separator/>) */
const grp = (rows, cls = '') => { const r = rows.filter(Boolean), ind = s => /class="(cat|gl|rank|stp)/.test(s);
  return `<div class="grp ${cls}">${r.map((x, i) => i ? `<span class="hr${ind(x) || ind(r[i-1]) ? ' in' : ''}"></span>${x}` : x).join('')}</div>`; };
const sec = t => `<h3 class="sec">${t}</h3>`;
/* панель: заголовок + содержимое; на десктопе — карточка, на телефоне — секция с заголовком */
const panel = (title, body, cls = '', right = '') => `<section class="panel ${cls}"><div class="ph"><h3>${title}</h3>${right}</div>${body}</section>`;
/* блок экрана: крупный заголовок раздела, справа подпись или ссылка; содержимое — отдельной карточкой */
const block = (title, body, right = '') => panel(title, body, 'blk', right);
const plink = (t, attrs) => `<button class="plink press" ${attrs}>${t}</button>`;
const btn = (label, attrs = '', kind = 'w') => `<button class="btn ${kind} press" ${attrs}>${label}</button>`;
const seg = (name, cur, opts) => `<div class="seg" role="tablist">${opts.map(([k, t]) => `<button class="${cur === k ? 'on' : ''}" role="tab" aria-selected="${cur === k}" data-seg="${name}:${k}">${t}</button>`).join('')}</div>`;
const toggle = (attrs, on, label, dis) => `<button class="toggle" role="switch" aria-checked="${!!on}" ${attrs} aria-label="${label}" ${dis ? 'disabled' : ''}></button>`;
const dots = p => `<span class="pw" aria-label="сила ${p} из 3">${[1,2,3].map(i => `<i class="${i <= p ? 'on' : ''}"></i>`).join('')}</span>`;
const back = to => `<button class="circ press" data-act="back" ${to ? `data-to="${to}"` : ''} aria-label="Назад">${ico('back')}</button>`;
/* подсказка термина: «?» рядом со словом или само слово с пунктиром — открывают объяснение простыми словами */
const hint = k => `<button class="hint" data-term="${k}" aria-label="Что такое «${GLOSS[k][0]}»?">?</button>`;
const term = (k, t) => `<button class="term" data-term="${k}">${t}</button>`;
/* шапка вложенного экрана: назад + заголовок по центру */
const navbar = (title, to, sub = '') => `<div class="nb">${back(to)}<div class="nbt">${title}${sub ? `<small>${sub}</small>` : ''}</div><span class="nbs"></span></div>`;
/* шапка экрана первого уровня: крупный заголовок слева, действия справа */
const topbar = (title, sub, right = '') => `<div class="tb"><div class="rt"><div class="tbs">${sub}</div><h1 class="ttl">${title}</h1></div>${right}</div>`;
const ava = () => `<button class="ava press" data-go="profile" aria-label="Профиль и настройки">${initial()}</button>`;
const sandTag = () => S.sandbox ? `<span class="tag t-bl">${ico('spark')}Песочница</span>` : '';
const sw = (key, v, html, cls = '') => `<span class="sw ${cls}" data-sw="${key}" data-v="${v}">${html}</span>`;
const capText = () => `Если BTC за неделю сильно упадёт, вы потеряете в среднем около ${usd(S.limit)}`;
const mini = (t, c) => `<span class="mini ${c}">${t}</span>`;
/* крупная цифра: подпись сверху, число, одна фраза под ним */
function heroBlock(c, key) {
  const lbl = `<div class="lbl2">Сумма в пределах лимита ${hint('sum')}</div>`;
  if (c.none) return `${lbl}${sw(key, 'none', 'Без позиции', 'hero2')}<p class="cap">${c.reason} Пропустить — нормально.</p>`;
  const was = S.alertOn && !c.adjusted && calmSum() !== c.sum ? `<p class="was num">было ${usd(calmSum())} до оповещения</p>` : '';
  return `${lbl}${sw(key, c.sum, usd(c.sum), 'hero num')}<p class="cap num">${capText()}</p>${was}`;
}
const trio = () => { const m = M(); return `<div class="trio num">
  <div><b>${m.tails[0]}%</b><small>упадёт больше 5%</small></div>
  <div><b>${m.tails[1]}%</b><small>в пределах ±5%</small></div>
  <div><b>${m.tails[2]}%</b><small>вырастет больше 5%</small></div></div>`; };
const fgMeter = v => `<span class="fgv"><span class="fgn num">${v}</span><span class="fgl">${fgLabel(v)}</span></span>
  <span class="fgbar"><i style="left:${v}%"></i></span><span class="fgs"><small>страх</small><small>жадность</small></span>`;
const fgCard = () => `<button class="card fg press" data-sheet="fg"><span class="fgh"><b>Индекс страха и жадности</b>${chev}</span>${fgMeter(M().fg)}</button>`;
const tokenRow = (t, i) => row({ lead:`<span class="rank num">${i + 1}</span>`, title:t.s, sub:t.n, right:`<span class="tv num"><b>${price(t.p)}</b><small class="${chgCls(t.c)}">${chg(t.c)}</small></span>`, attrs:`data-coin="${i}"`, nochev:true });
const newsRow = (n, i) => row({ title:n.t, sub:`${n.tag} · ${n.ago}`, attrs:`data-news="${i}"` });
/* живая цена BTC: строка как в «Акциях» — название, «обновлено N мин назад», цена и изменение за сутки в цвете */
const liveChg = (suf = '') => `<small class="${chgCls(live24())}" data-live="chg" data-suf="${suf}">${chg(live24())}${suf}</small>`;
const priceRow = () => row({ tile:'btc', cls:'c-btc', title:'Биткоин', sub:`<span data-ago>${ago()}</span>`, right:`<span class="tv num"><b data-live="price">${usd(LIVE)}</b>${liveChg(' за сутки')}</span>`, attrs:'data-go="market"' });

/* карточка кошелька — как в Wallet: градиент по источнику, крупный баланс, источник; только просмотр */
const WKIND = { manual:['wallet','введён вручную'], exchange:['lock','биржа · только чтение'], address:['btc','адрес · только чтение'], sand:['spark','виртуальные деньги'] };
function wcard(w, peek) {
  const [ic, kind] = WKIND[w.kind], d = w.kind === 'sand' ? S.capital - SAND_CAP : 0;
  const btc = w.btc || w.bal / LIVE, eq = `≈ ${btc.toFixed(4).replace('.', ',')} BTC`;
  const sub = w.kind === 'sand' ? `${eq} · ${d ? `${sgn(d)} с начала` : 'без настоящих денег'}`
    : w.kind === 'exchange' ? `${eq} · <span data-ago>${ago()}</span>` : eq;
  return `<button class="wcard w-${w.kind}${peek ? ' peek' : ''} press" data-wallet="${w.id}" aria-label="${w.name}: ${usd(w.bal)}, ${kind}">
    <span class="wtop"><span class="wic">${ico(ic)}</span><b>${w.name}</b><span class="wkind">${kind}</span></span>
    ${sw('w' + w.id, w.bal, usd(w.bal), 'wbal num')}
    <span class="wsub num">${sub}</span>
    ${peek ? '' : wfoot()}</button>`;
}
/* низ карточки: цена биткоина и изменение за сутки — то, от чего зависит сумма */
const wfoot = () => `<span class="wfoot num"><span class="wfp">${ico('btc')}Биткоин <b data-live="price">${usd(LIVE)}</b></span>${liveChg(' за сутки')}</span>`;
const chipB = (label, attrs = '', cls = '') => `<button class="chip press ${cls}" ${attrs}>${label}</button>`;
const qa = (icon, label, attrs) => `<button class="qa press" ${attrs}><span class="qai">${ico(icon)}</span><span class="qal">${label}</span></button>`;

/* ---------- экраны первого уровня ---------- */
const VIEWS = {
  home:{t:'Главная', i:'home', d:0}, market:{t:'Рынок', i:'chart', d:0}, journal:{t:'Журнал', i:'book', d:0},
  sum:{t:'Расчёт на неделю', d:1, tab:'home', up:'home'}, digest:{t:'Итоги недели', d:1, tab:'home', up:'home'},
  archive:{t:'Архив прогнозов', d:1, tab:'market', up:'market'},
  profile:{t:'Профиль', d:1, tab:'home', up:'home'}, alerts:{t:'Оповещения', d:2, tab:'home', up:'profile'},
  assistant:{t:'Ассистент', d:2, tab:'home', up:'profile'},
};
const TABS = ['home','market','journal'];
const lastResult = () => modeJ().find(j => j.result);

/* «С чего начать»: 4 шага, пока путь не пройден; следующий шаг — единственная нажимаемая строка */
function coach() {
  const J = modeJ().filter(j => !j.demo), res = J.some(j => j.result);
  const steps = [
    ['Добавьте баланс', S.capital > 0, 'data-sheet="addwallet"', 'сколько денег вы выделили на биткоин'],
    ['Посмотрите расчёт на неделю', S.seenSum, 'data-go="sum"', 'при какой сумме сильное падение обойдётся примерно в ваш лимит'],
    ['Запишите решение', J.length > 0, 'data-go="sum"', 'даже «пропускаю неделю» — это решение'],
    ['Посмотрите, как оно сыграло', res, S.sandbox ? 'data-act="sandff"' : 'data-go="journal"', S.sandbox ? 'в песочнице итог можно посмотреть сразу' : `итог придёт ${dShort(7)}`],
  ];
  if (S.demo || steps.every(s => s[1])) return '';
  const next = steps.findIndex(s => !s[1]), done = steps.filter(s => s[1]).length;
  const dot = (i, ok, cur) => `<span class="stp${ok ? ' ok' : ''}${cur ? ' cur' : ''}">${ok ? ico('check') : i + 1}</span>`;
  return block('С чего начать', grp(steps.map(([t, ok, a, s], i) => i === next
    ? row({ lead:dot(i, ok, true), title:t, sub:s, attrs:a, extra:'next' })
    : row({ lead:dot(i, ok), title:t, extra:ok ? 'done' : 'todo' })), 'coach'), `<small>${done} из 4</small>`);
}
function feedItems() {
  const items = [], J = modeJ();
  if (planOver()) items.push(row({ tile:'shield', cls:'c-or', title:`План от ${S.plan.date} больше лимита`, sub:`при сильном падении потеря около ${usd(planBad())}, а лимит ${usd(S.limit)}`, attrs:'data-go="sum"' }));
  activeAlerts().forEach(a => items.push(row({ tile:a.icon, cls:a.cls, title:a.title, sub:a.means, attrs:`data-alert="${a.id}"`, extra:'cl' })));
  const due = J.find(j => j.due);
  if (due) items.push(row({ tile:'clock', cls:'c-gy', title:`Как сыграло решение ${due.date}`, sub:'внесите сумму — остальное посчитаем сами', attrs:`data-review="${due.id}"` }));
  if (S.sandbox && J.some(j => j.pending)) items.push(row({ tile:'spark', cls:'c-bl', title:'Итог можно посмотреть сразу', sub:'в песочнице считаем на данных прошлой недели', attrs:'data-act="sandff"' }));
  const r = lastResult();
  if (r) items.push(row({ tile:'cal', cls:'c-gy', title:'Итоги недели', sub:r.result.amt ? (r.limitOk ? 'решение в пределах лимита' : 'потеря больше лимита') : 'неделя пропущена', attrs:'data-go="digest"' }));
  return items;
}
function coreCard() {
  if (S.capital <= 0) return `<section class="card herocard glow core">
    <div class="lbl2">Сумма в пределах лимита ${hint('sum')}</div><div class="hero2">Добавьте баланс</div>
    <p class="cap">Введите, сколько денег вы выделили на биткоин, — и мы посчитаем, сколько можно держать, чтобы плохая неделя не вышла за ваш лимит.</p>
    ${btn('Добавить кошелёк', 'data-sheet="addwallet"', 'w pill')}</section>`;
  return `<section class="card herocard glow core">${heroBlock(calc(), 'sum')}
    ${btn('Открыть расчёт', 'data-go="sum"', 'w pill')}
    <p class="fine c disc">${DISC}</p></section>`;
}
function vHome() {
  const items = feedItems();
  const cards = S.sandbox ? wcard({ id:'sand', kind:'sand', name:'Песочница', bal:S.capital })
    : S.wallets.length ? S.wallets.map((w, i, a) => wcard(w, i < a.length - 1)).join('')
    : `<button class="wcard w-empty press" data-sheet="addwallet"><span class="wtop"><span class="wic">${ico('plus')}</span><b>Добавьте кошелёк</b></span><span class="wsub">Только просмотр: введите баланс сами или подключите биржу на чтение</span>${wfoot()}</button>`;
  const acts = S.sandbox
    ? [qa('cal', 'Итог', modeJ().some(j => j.pending) ? 'data-act="sandff"' : 'data-go="digest"'), qa('book', 'Журнал', 'data-go="journal"'), qa('wallet', 'Реальный', 'data-act="sandtog"')]
    : [qa('plus', 'Добавить', 'data-sheet="addwallet"'), qa('spark', 'Демо', 'data-act="sandtog"'), qa('swap', 'Биржа', 'data-act="toex"')];
  /* главная по блокам: деньги → на эту неделю → с чего начать → что изменилось → новости.
     Одна крупная цифра — баланс; сумма в пределах лимита — заметная, но вторая по размеру. */
  return `<div class="hide-m">${topbar('Главная', todayLong(), `<div class="tbr">${ava()}</div>`)}</div>
  <div class="phonebar hide-d"><span class="pbd">${todayLong()}</span><div class="tbr">${ava()}</div></div>
  <div class="cols secs">
    <section class="stackv secs main-col">
      ${block('Деньги', `<div class="wstack">${cards}</div>
        ${!S.sandbox && S.wallets.length > 1 ? `<p class="fine wtot">Всего для расчёта: <b class="num">${usd(walletsTotal())}</b></p>` : ''}
        <div class="qas">${acts.join('')}</div>`, S.sandbox ? '' : '<small>только просмотр</small>')}
      ${block('На эту неделю', coreCard(), `<small>${dShort(0)} – ${dShort(7)} · по модели</small>`)}
    </section>
    <section class="stackv secs">
      ${coach()}
      ${items.length ? block('Что изменилось', grp(items)) : ''}
      ${block('Новости', grp(NEWS.slice(0, 3).map(newsRow)), plink('Все', 'data-sheet="allnews"'))}
    </section>
  </div>`;
}

function vMarket() {
  const m = M(), F = FACTORS(), f = fresh();
  const draw = !fanDrawn; fanDrawn = true;
  /* факторы одним списком: у каждого метка, повышает он риск, снижает или вне модели (§8.6) */
  const FL = [...F.down.map(x => [x, 'повышает риск', 't-or']), ...F.up.map(x => [x, 'снижает риск', 't-gr']), ...F.unk.map(x => [x, 'вне модели', 't-gy'])];
  const list = FL.map(([x, d, c]) => row({ tile:x.icon, cls:x.cls, title:x.t, sub:`${mini(d, c)}${x.s}<br>${x.src}${x.at ? ' · ' + x.at : ''}`, right: x.p ? dots(x.p) : '', attrs:`data-factor="${x.id}"` }));
  /* одноразовая подсказка при первом показе диапазона (§8.2): вероятность — не прогноз */
  const tip = S.rangeTip ? '' : `<div class="notice tip">${ico('info')}<span class="rt"><b>Как это читать.</b> Это не прогноз, а доля из 20 000 смоделированных недель. Широкий диапазон — модель не уверена. Пропустить неделю — нормальное решение.</span><button class="btn inl press" data-act="rangetip">Понятно</button></div>`;
  const coins = `<div class="chips coins">${chipB(`${ico('btc')}BTC`, 'aria-pressed="true"', 'on')}${chipB('ETH <small>скоро</small>', 'data-act="soon"')}${chipB('SOL <small>скоро</small>', 'data-act="soon"')}</div>`;
  return `${topbar('Рынок', `<span data-ago>${ago()}</span>`, `<div class="tbr">${sandTag()}${ava()}</div>`)}
  ${coins}
  <div class="cols">
    <section class="stackv main-col">
      ${sec('Цена и прогноз')}
      ${grp([priceRow()])}
      ${tip}
      <section class="card scencard">
        ${S.noSignal ? `<div class="notice">${ico('info')}<span><b>Модель сейчас молчит.</b> Данные с бирж пришли не полностью. Ниже — последний расчёт от вчера.</span></div>` : ''}
        <div class="lbl2">Где может быть цена через неделю ${hint('range')}</div>
        <div class="hero-r num">${usd(m.lo)} – ${usd(m.hi)}</div>
        <p class="cap">в 8 случаях из 10 по ${term('model', 'модели')} · рассчитано ${f.t}</p>
        <div class="chips c hz">${chipB('7 дней', 'aria-pressed="true"', 'sm on')}${chipB('30 дней · скоро', 'data-act="soon"', 'sm')}</div>
        ${fanSVG(draw)}
        ${trio()}
        <p class="fine c">Доли из 20 000 ${term('scen', 'смоделированных недель')}. Куда пойдёт цена, модель не знает. ${DISC}</p>
        ${btn('Рассчитать под мой лимит', 'data-go="sum" data-veil="1"', 'w pill c-self')}
      </section>
    </section>
    <section class="stackv">
      ${sec('Риск на неделю')}
      ${grp([
        row({ title:`Сильное падение ${hint('bad')}`, sub:'столько в среднем теряет цена в 1 неделю из 10', val:`−${pct1(m.bad)}` }),
        row({ title:'Состояние рынка', val:regime(), attrs:'data-sheet="regime"' }),
        row({ title:'Индекс страха и жадности', sub:'настроение рынка, в расчёт не входит', val:`${m.fg} · ${fgLabel(m.fg)}`, attrs:'data-sheet="fg"' }),
        row({ title:'Данные и модель', val:`<i class="fd ${f.c}"></i>${f.t}`, attrs:'data-sheet="data"' }),
      ])}
      ${sec('Что влияет на риск')}
      ${grp(list)}
      <p class="fine">Это вклад в расчёт модели, а не причина движения цены.</p>
      ${sec('Что изменит картину')}
      ${grp([...CHANGERS().map(x => row({ title:x.t, sub:x.s, attrs:`data-changer="${x.id}"` })), row({ title:'Расчёт действует до', val:`${dShort(7)}, 09:30` })])}
      ${grp([
        row({ title:'Что если…', sub:'гипотетические сценарии', attrs:'data-sheet="whatif"' }),
        row({ title:'Архив и точность модели', sub:'10 из 12 недель в диапазоне · промахи не удаляем', attrs:'data-go="archive"' }),
      ])}
    </section>
  </div>
  ${grp([row({ glyph:'chart', title:'20 крупнейших монет', sub:'цена и изменение за сутки', attrs:'data-sheet="tokens"' })], 'more-coins')}`;
}

function hypBlock() {
  const H = [['range','Цена постоит'],['up','Рост'],['down','Падение'],['unk','Не знаю']], C = [[1,'низкая'],[2,'средняя'],[3,'высокая']];
  return `<div class="hyp ${S.hypOpen ? 'open' : ''}">
    <button class="row tap press hyph" data-act="hyp" aria-expanded="${S.hypOpen}"><span class="rt"><b>Ваше мнение о неделе</b><small>${S.hyp || S.conf ? [H.find(h => h[0] === S.hyp)?.[1], C.find(c => c[0] === S.conf)?.[1] && 'уверенность ' + C.find(c => c[0] === S.conf)[1]].filter(Boolean).join(' · ') : 'необязательно · через неделю сравним с тем, что было'}</small></span><span class="chev rot">${ico('chev')}</span></button>
    ${S.hypOpen ? `<div class="hypb">
      <label class="flab">Что думаете о неделе?</label>
      <div class="chips">${H.map(([k, t]) => `<button class="chip ${S.hyp === k ? 'on' : ''}" data-hyp="${k}">${t}</button>`).join('')}</div>
      <label class="flab">Насколько уверены</label>
      <div class="chips">${C.map(([k, t]) => `<button class="chip ${S.conf === k ? 'on' : ''}" data-conf="${k}">${t}</button>`).join('')}</div>
      <div class="inp"><input data-in="note" placeholder="Заметка для себя" value="${esc(S.note)}" enterkeyhint="done" aria-label="Заметка"></div>
    </div>` : ''}
  </div>`;
}
const limChip = p => { const v = Math.max(10, Math.round(S.capital * p)); return `<button class="chip sm num ${v === S.limit ? 'on' : ''}" data-limpct="${p}">${Math.round(p * 100)}% · ${usd(v)}</button>`; };
function calcForm(inSheet) {
  const c = calc();
  return `<div class="calcf">
    <div class="field"><label for="fCap">${S.sandbox ? 'Виртуальный баланс' : 'Баланс'}${!S.sandbox && S.wallets.length ? ` · в кошельках ${usd(walletsTotal())}` : ''}</label><div class="inp"><span>$</span><input id="fCap" inputmode="decimal" enterkeyhint="done" data-in="cap" value="${S.capital}"></div></div>
    <div class="field"><label for="fLim">Готовы потерять за неделю ${hint('limit')}</label><div class="inp"><span>$</span><input id="fLim" inputmode="decimal" enterkeyhint="done" data-in="lim" value="${S.limit}"></div>
      <div class="chips">${LIM_PCTS.map(limChip).join('')}</div></div>
    <details class="more2" ${S.moreOpen || S.stop || S.fee || S.slip || S.pos ? 'open' : ''}><summary>Для опытных: продажа и комиссии</summary>
      <div class="field"><label for="fStop">Продам, если цена опустится до</label><div class="inp"><span>$</span><input id="fStop" inputmode="decimal" enterkeyhint="done" data-in="stop" value="${S.stop}" placeholder="не задано"></div></div>
      <div class="two">
        <div class="field"><label for="fFee">Комиссия биржи</label><div class="inp"><input id="fFee" inputmode="decimal" enterkeyhint="done" data-in="fee" value="${S.fee}" placeholder="0,1"><span>%</span></div></div>
        <div class="field"><label for="fSlip">Разница цены при сделке</label><div class="inp"><input id="fSlip" inputmode="decimal" enterkeyhint="done" data-in="slip" value="${S.slip}" placeholder="0,05"><span>%</span></div></div>
      </div>
      <div class="field"><label for="fPos">Уже есть в BTC</label><div class="inp"><span>$</span><input id="fPos" inputmode="decimal" enterkeyhint="done" data-in="pos" value="${S.pos}" placeholder="0"></div></div>
    </details>
    ${inSheet ? `<div class="calcres" id="calcRes">${calcRes(c)}</div>` : ''}
  </div>`;
}
const calcRes = c => c.none ? `<span>Без позиции</span><small>${c.reason}</small>` : `<span class="num">${usd(c.sum)}</span><small>сумма в пределах лимита · ${usd(S.limit)} ÷ ${pct1(c.per)}</small>`;

/* из чего получилась сумма: что ввёл пользователь → какой взят риск → что вышло */
function breakdown(c) {
  const rows = [
    row({ title:S.sandbox ? 'Виртуальный баланс' : 'Баланс', sub:S.sandbox ? 'песочница, без настоящих денег' : S.wallets.length ? 'из ваших кошельков' : 'вы ввели', val:usd(S.capital) }),
    row({ title:`Готовы потерять за неделю ${hint('limit')}`, sub:`${limPct()}${S.limitAuto ? ', по умолчанию' : ', задано вами'}`, val:usd(S.limit) }),
    row({ title:`Сильное падение сейчас ${hint('bad')}`, sub:'по модели: столько в среднем теряет цена в 1 неделю из 10', val:`−${pct1(c.base)}` }),
  ];
  if (c.stopD) rows.push(row({ title:`Продадите при ${usd(num(S.stop))}`, sub:'падение для расчёта не больше этого', val:`−${pct1(c.stopD)}` }));
  if (c.costRate) rows.push(row({ title:'Комиссии и разница цены', sub:'на вход и выход', val:`+${pct1(c.costRate)}` }));
  rows.push(`<div class="row formula"><span class="rt"><b class="num">${usd(S.limit)} ÷ ${pct1(c.per)} = ${usd(c.raw)}</b>${c.capped ? `<small>Это больше баланса, поэтому берём весь баланс ${usd(S.capital)}.</small>` : ''}</span></div>`);
  if (c.pos) rows.push(row({ title:'Уже есть в BTC', val:`−${usd(c.pos)}` }));
  return panel('Как посчитали', `${grp(rows)}<p class="fine">Сумма меняется вместе с риском рынка: чем сильнее возможное падение, тем она меньше.</p>`, 'how');
}
/* решение на неделю: один вопрос, три понятных варианта, одна главная кнопка */
function decisionBlock(c) {
  const P = [
    ['plan', 'Сохранить сумму как план', c.none ? 'сейчас недоступно: расчёт ненадёжен' : `запомним ${usd(c.sum)} и через неделю покажем, как бы это сыграло`],
    ['watch', 'Пока только смотрю', 'сообщим, если сумма заметно изменится'],
    ['skip', 'Пропускаю неделю', 'это тоже решение — через неделю сравним'],
  ];
  const pick = c.none && S.pick === 'plan' ? 'watch' : S.pick;
  return `${sec('Что решили на эту неделю?')}
    <div class="picks" role="radiogroup" aria-label="Что решили на эту неделю">${P.map(([k, t, s]) => `<button class="pick press ${pick === k ? 'on' : ''}" role="radio" aria-checked="${pick === k}" data-pick="${k}" ${c.none && k === 'plan' ? 'disabled' : ''}><span class="rt">${t}<small>${s}</small></span><span class="ck"></span></button>`).join('')}</div>`;
}
function vSum() {
  const c = calc(), ok = !c.none, veil = S.veil && ok;
  const second = S.sandbox ? btn('Попробовать на реальных деньгах', 'data-act="sandtog"', 'link')
    : btn(`Перейти на биржу-партнёр${chev}`, `data-act="toex" ${ok && !veil ? '' : 'disabled aria-describedby="noex"'}`, 'link');
  return `${navbar('Расчёт на неделю', 'home', S.sandbox ? 'песочница · виртуальные деньги' : `на ${dShort(0)} – ${dShort(7)}`)}
  <div class="cols">
    <section class="stackv main-col">
      <div class="veilwrap">
        <div class="card herocard glow">${veil ? `<div class="lbl2">Сумма в пределах лимита</div>${sw('dsum', 'veil', '$— ——', 'hero num')}<p class="cap">${capText()}</p>` : heroBlock(c, 'dsum')}</div>
        ${!ok ? '' : veil ? panel('Как посчитали', `<div class="grp skel"><i></i><i></i><i></i></div>`, 'how') : breakdown(c)}
        ${veil ? `<div class="veil" id="veil"><div class="veilc">
          <span class="cat c-bl">${ico('calc')}</span>
          <b>Сначала проверьте баланс и лимит</b>
          <small class="num">баланс ${usd(S.capital)} · готовы потерять ${usd(S.limit)}</small>
          ${btn('Показать расчёт', 'data-act="unveil"')}
          <button class="btn link press hide-d" data-sheet="calc">Изменить</button>
        </div></div>` : ''}
      </div>
      ${grp([row({ title:'Изменить баланс и лимит', sub:`${usd(S.capital)} · ${usd(S.limit)}${S.stop ? ' · продажа' : ''}${S.fee || S.slip ? ' · комиссии' : ''}`, attrs:'data-sheet="calc"', extra:'hide-d' })])}
      ${decisionBlock(c)}
      ${hypBlock()}
      <div class="acts">
        ${btn(S.sandbox ? 'Записать в песочницу' : 'Записать в журнал', `data-act="decide" ${veil ? 'disabled' : ''}`)}
        ${second}
      </div>
      ${ok ? '' : `<p class="fine c" id="noex">Переход на биржу недоступен: расчёт ненадёжен.</p>`}
      <p class="fine c">${DISC}</p>
    </section>
    <section class="card hide-m">${sec('Изменить расчёт')}${calcForm(false)}</section>
  </div>`;
}

/* итоги недели — «как сыграло ваше решение» простыми словами */
function vDigest() {
  const j = lastResult(), pend = modeJ().find(x => x.pending || x.due);
  if (!j) return `${navbar('Итоги недели', 'home')}
    <div class="cols"><section class="card herocard glow main-col">
      <div class="lbl2">Как сыграло ваше решение</div><div class="hero2">Пока нечего подводить</div>
      <p class="cap">${pend ? `Итог решения от ${pend.date} будет ${pend.reviewDate || dShort(7)}.` : 'Итог появится через неделю после первого решения.'}${S.sandbox ? ' В песочнице его можно посмотреть сразу.' : ' Хотите увидеть сразу — попробуйте в песочнице.'}</p>
      ${S.sandbox ? (pend ? btn('Показать итог сразу', 'data-act="sandff"', 'w pill') : btn('Посчитать неделю', 'data-go="sum"', 'w pill')) : btn('Попробовать без денег', 'data-act="sandtog"', 'w pill')}
    </section><section class="stackv"></section></div>`;
  const r = j.result, lim = j.limit || S.limit, held = r.amt > 0, al = activeAlerts();
  const head = held ? (j.limitOk ? 'В пределах лимита' : 'Больше лимита') : 'Неделя без сделки';
  const tags = `${j.sand ? ' · песочница' : ''}${j.demo ? ' · пример' : ''}`;
  return `${navbar('Итоги недели', 'home', `${j.demo ? `неделя после ${j.date}` : WEEK.label()}${tags}`)}
  <div class="cols">
    <section class="stackv main-col">
      <div class="card herocard glow">
        <div class="lbl2">Как сыграло ваше решение</div>
        <div class="hero2 ${held ? (j.limitOk ? 'up' : 'dn') : ''}">${head}</div>
        <p class="cap num">${held ? `${usd(r.amt)} в биткоине · лимит ${usd(lim)}` : 'вы не держали биткоин'}</p>
        ${btn('Посчитать следующую неделю', 'data-go="sum"', 'w pill')}
      </div>
      ${panel('Цифры недели', grp([
        row({ title:'Было в биткоине', sub:j.invested != null && j.kind !== 'plan' ? 'по вашим данным' : 'по плану', val:usd(r.amt || 0) }),
        row({ title:'Худший момент недели', sub:held ? 'если бы продали в самой низкой точке' : `для ${usd(r.hypo)}`, val:sgn(-r.worst), vc:'dn' }),
        row({ title:'Конец недели', val:sgn(r.end), vc:r.end >= 0 ? 'up' : 'dn' }),
        row({ title:`Ваш лимит ${hint('limit')}`, val:usd(lim) }),
      ]))}
      <p class="fine c">${DISC}</p>
    </section>
    <section class="stackv">
      ${panel('Что было с ценой', grp([row({ title:'Диапазон модели', sub:`${usd(WEEK.lo)} – ${usd(WEEK.hi)}`, val:'цена внутри', attrs:'data-sheet="weekprice"' })]))}
      ${al.length ? panel('Оповещения за неделю', grp(al.map(a => row({ tile:a.icon, cls:a.cls, title:a.title, sub:a.means, attrs:`data-alert="${a.id}"` })))) : ''}
      ${S.sandbox ? '' : panel('Как менялась сумма', `<div class="card chartcard">${planChart()}</div>`)}
    </section>
  </div>`;
}

function jTitle(j) {
  const amt = usd(j.invested || j.plan || 0);
  return j.kind === 'ex' ? `Переход на биржу · ${amt}` : j.kind === 'plan' ? `План · ${amt}` : j.kind === 'watch' ? 'Только смотрю' : 'Пропуск недели';
}
function jStatus(j) {
  if (j.due || j.pending) return `<span class="st wait" aria-label="ждём неделю">${ico('clock')}</span>`;
  if (!j.result || !j.result.amt) return '';
  return `<span class="st ${j.limitOk ? 'ok' : 'no'}" aria-label="${j.limitOk ? 'лимит соблюдён' : 'лимит превышен'}">${ico(j.limitOk ? 'check' : 'close')}</span>`;
}
function jSub(j) {
  const tags = (j.sand ? mini('песочница', 't-bl') : '') + (j.demo ? mini('пример', 't-gy') : '');
  const s = j.pending ? `итог ${j.reviewDate || dShort(7)}` : j.due ? 'внесите сумму — посчитаем итог' : j.kind === 'watch' ? 'сообщим, если сумма изменится'
    : j.result ? (j.result.amt ? `худший момент ${sgn(-j.result.worst)}, конец недели ${sgn(j.result.end)}` : 'неделя без сделки') : j.inRange === false ? 'цена вне диапазона' : 'цена в диапазоне';
  return `${tags}${j.date} · ${s}${j.note ? ' · ' + esc(j.note) : ''}`;
}
function vJournal() {
  const icon = { ex:'swap', plan:'bookmark', watch:'eye', skip:'close' };
  const due = S.journal.find(j => j.due && !!j.sand === S.sandbox);
  const rows = S.journal.filter(j => !j.due).map(j => row({ tile:icon[j.kind] || 'swap', cls:j.sand ? 'c-bl' : 'c-gy', title:jTitle(j), sub:jSub(j), right:jStatus(j), attrs:`data-jitem="${j.id}"` }));
  const res = realJ().filter(j => j.result && j.result.amt), okN = res.filter(j => j.limitOk).length;
  const sd = S.capital - SAND_CAP, sp = modeJ().some(j => j.pending);
  const sand = S.sandbox ? `<div class="card herocard"><div class="lbl2">Виртуальный баланс</div>${sw('jsand', S.capital, usd(S.capital), 'hero2 num')}<p class="cap">${sd ? `${sgn(sd)} с начала. ` : ''}Те же расчёты, но без настоящих денег. Итог можно посмотреть сразу — на данных прошлой недели.</p>${sp ? btn('Показать итог недели', 'data-act="sandff"', 'w pill') : ''}</div>` : '';
  const dec = `<div class="cols">
    <section class="stackv main-col">
      ${sand}
      ${due ? `<div class="card duecard"><div class="rt"><b>Как сыграло решение ${due.date}</b><small>${jTitle(due)} · пара минут</small></div>${btn('Посмотреть', `data-review="${due.id}"`)}</div>` : ''}
      ${rows.length ? grp(rows) : `<div class="empty">Здесь будут ваши решения. Любой выбор на экране расчёта — даже «Пропускаю неделю» — попадёт сюда, а через неделю мы покажем, как он сыграл.</div>`}
      <p class="fine">Записи песочницы и примера помечены и не попадают в график и статистику.</p>
    </section>
    <section class="stackv">
      ${realJ().length ? panel('Как менялась сумма', `<div class="card chartcard">${planChart()}</div>`) : ''}
      ${grp([row({ glyph:'cal', title:'Итоги недели', sub:WEEK.label(), attrs:'data-go="digest"' }), res.length ? row({ glyph:'shield', title:'Лимит соблюдён', sub:'недели, когда потеря укладывалась в лимит', val:`${okN} из ${res.length}` }) : '', row({ glyph:'pie', title:'Точность модели', sub:'архив прогнозов', attrs:'data-go="archive"' })])}
    </section>
  </div>`;
  return `${topbar('Журнал', 'ваши решения и сделки', `<div class="tbr">${sandTag()}${ava()}</div>`)}
    <div class="jseg">${seg('jseg', S.jseg, [['dec', 'Решения'], ['trades', 'Сделки']])}</div>
    <div class="segbody">${S.jseg === 'trades' ? vTrades() : dec}</div>`;
}
function vTrades() {
  if (!S.trades) return `<div class="cols">
    <section class="stackv main-col">
      <p class="lead">Загрузите историю сделок — посчитаем результат после комиссий.</p>
      ${grp([
        row({ glyph:'export', title:'Файл с историей сделок', sub:'выгрузка с любой биржи — резидента ПВТ', attrs:'data-act="csv"' }),
        row({ glyph:'lock', title:'Подключить биржу-партнёр', sub:'только чтение истории', attrs:'data-act="api"' }),
      ])}
      <p class="fine">Доступ с правом торговли или вывода не примем: права проверяем при подключении.</p>
    </section>
    <section class="stackv">${sec('Что покажет разбор')}${grp([row({ title:'Результат после комиссий', sub:'а не только «попал в диапазон»' }), row({ title:'Самое глубокое снижение', sub:'сколько терял по пути' }), row({ title:'Повторяющиеся привычки', sub:'всегда с числом сделок' })])}</section>
  </div>`;
  const gross = TRADES.reduce((a,t) => a + t.gross, 0), fees = TRADES.reduce((a,t) => a + t.fee, 0), net = gross - fees;
  const cap = S.capital || 5000;
  let eq = cap, peak = eq, dd = 0; TRADES.forEach(t => { eq += t.gross - t.fee; peak = Math.max(peak, eq); dd = Math.min(dd, (eq - peak) / peak); });
  const hot = TRADES.filter(t => t.hot), hotLoss = hot.filter(t => t.gross - t.fee < 0).length;
  const pct = v => (v >= 0 ? '+' : '−') + Math.abs(v * 100).toFixed(1).replace('.', ',') + '%';
  return `<div class="cols">
    <section class="stackv main-col">
      <div class="card herocard">
        <div class="lbl2">${TRADES.length} сделок · июль – сентябрь</div>
        <div class="hero2 num">${pct(net / cap)}</div>
        <p class="cap num">после комиссий · ${usd(net)}</p>
      </div>
      ${grp([row({ title:'До комиссий', val:usd(gross) }), row({ title:'Комиссии', val:`−${usd(fees)}`, vc:'dn' }), row({ title:'После комиссий', val:usd(net) })])}
      ${grp([row({ title:'Наибольшее снижение', sub:'от самой высокой точки', val:pct(dd) })])}
      <div class="hide-m">${panel('Все сделки', grp(TRADES.map(t => row({ title:`${t.date} · ${t.side}`, sub:`${usd(t.size)} · комиссия −${usd(t.fee)}${t.hot ? ' · плата за плечо была высокой' : ''}`, val:`${t.gross - t.fee < 0 ? '' : '+'}${usd(t.gross - t.fee)}`, vc:t.gross - t.fee < 0 ? 'dn' : '' }))))}</div>
    </section>
    <section class="stackv">
      ${sec('Замеченная привычка')}
      ${grp([row({ tile:'stack', cls:'c-or', title:'Сделки при высокой плате за плечо', sub:`${hotLoss} из ${hot.length} закрыты в минус · сделок мало, вывод предварительный`, val:`${hotLoss}/${hot.length}` })])}
      <p class="fine">Результаты видите только вы, в рекламе мы их не используем. Источник: ${S.trades === 'api' ? `${EXCH['1']}, только чтение` : 'файл с историей сделок'}.</p>
      ${btn('Отключить источник', 'data-act="untrades"', 'd')}
    </section>
  </div>`;
}

function vArchive() {
  const ok = WEEKS.filter(Boolean).length;
  return `${navbar('Архив прогнозов', 'market')}
  <div class="cols">
    <section class="card herocard main-col">
      <div class="lbl2">12 недель</div>
      <div class="hero2 num">${ok} из 12</div>
      <p class="cap">недель цена осталась в диапазоне модели</p>
      <div class="cal" aria-label="Попадания по неделям: ${ok} из 12">${WEEKS.map(w => `<i class="${w ? '' : 'm'}"></i>`).join('')}</div>
      <p class="fine c">Модель рассчитана попадать примерно в 8 из 10. Если попаданий станет меньше, модель слишком уверена, и мы покажем это здесь же.</p>
    </section>
    <section class="stackv">
      ${grp([row({ title:'Точность диапазона', sub:'попадания против обещанных 80%', val:'83%' }), row({ title:'Версия модели', sub:'изменения и поправки — в журнале модели', val:'v0.4 · 1 окт.' })])}
      ${sec('Выпуски')}
      ${grp(ISSUES.map(i => row({ title:i.d, sub:`прогноз ${usd(i.lo)} – ${usd(i.hi)} · факт ${usd(i.fact)}`, val:i.ok ? 'в диапазоне' : `промах ${i.miss.split(' ')[0]}`, vc:i.ok ? 'mut' : 'dn' })))}
      <p class="fine">Неудачные прогнозы не удаляем и не прячем.</p>
    </section>
  </div>`;
}

function vProfile() {
  const sw2 = (ic, t, s, act, on) => `<div class="row"><span class="gl">${ico(ic)}</span><span class="rt"><b>${t}</b><small>${s}</small></span>${toggle(`data-act="${act}"`, on, t)}</div>`;
  return `${navbar('Профиль', 'home')}
  <div class="cols even">
    <section class="stackv">
      <div class="card acct"><span class="ava big">${initial()}</span><div class="rt"><b>${S.email ? esc(S.email) : 'Без почты'}</b><small>Бесплатный тариф${S.country ? ' · ' + (S.country === 'BY' ? 'Беларусь' : 'другая страна') : ''}</small></div></div>
      ${grp([
        row({ glyph:'wallet', title:S.sandbox ? 'Виртуальный баланс' : 'Баланс для расчёта', sub:S.sandbox ? 'песочница' : S.wallets.length ? `кошельков: ${S.wallets.length}` : 'кошельков пока нет', val:usd(S.capital), attrs:'data-sheet="calc"' }),
        row({ glyph:'shield', title:'Готовы потерять за неделю', sub:S.limitAuto ? '6% баланса, по умолчанию' : 'задано вами', val:usd(S.limit), attrs:'data-sheet="limit"' }),
        sw2('spark', 'Песочница', `виртуальные ${usd(SAND_CAP)}, свои баланс и лимит`, 'sandtog', S.sandbox),
        `<div class="row"><span class="gl">${ico('globe')}</span><span class="rt"><b>Страна</b><small>от неё зависят биржи</small></span><select data-sel="country" aria-label="Страна"><option value="" ${!S.country ? 'selected' : ''}>не выбрана</option><option value="BY" ${S.country === 'BY' ? 'selected' : ''}>Беларусь</option><option value="OT" ${S.country === 'OT' ? 'selected' : ''}>Другая</option></select></div>`,
        row({ glyph:'user', title:'Почта', sub:'чтобы данные не потерялись', val:S.email ? '' : 'не указана', attrs:'data-sheet="email"' }),
        row({ glyph:'lock', title:'Подключённые биржи', sub:'только чтение', val:S.trades ? '1' : 'нет', attrs:'data-act="totrades"' }),
      ])}
      ${grp([
        row({ glyph:'bell', title:'Оповещения', sub:'события, частота, тихие часы', attrs:'data-go="alerts"' }),
        row({ glyph:'logo', title:'Ассистент', sub:aiLive() ? 'подключён: ' + esc(modelName()) : 'демо-режим', attrs:'data-go="assistant"' }),
        row({ glyph:'info', title:'Как читать прогноз', sub:'4 правила', attrs:'data-sheet="rules"' }),
        row({ glyph:'shield', title:'Условия использования', sub:S.consent ? `приняты ${new Date(S.consent.at).toLocaleDateString('ru-RU')}` : 'примете перед переходом на биржу', attrs:'data-sheet="terms"' }),
        row({ glyph:'wallet', title:'Подписка', val:'бесплатно' }),
      ])}
    </section>
    <section class="stackv">
      ${sec('Оформление')}
      <div class="seg" role="radiogroup" aria-label="Тема">${[['system', 'Системная'], ['light', 'Светлая'], ['dark', 'Тёмная']].map(([k, t]) => `<button class="${THEME === k ? 'on' : ''}" role="radio" aria-checked="${THEME === k}" data-theme-set="${k}">${t}</button>`).join('')}</div>
      ${sec('Демо прототипа')}
      ${grp([
        sw2('book', 'Пример с историей', 'чужие решения с меткой «пример» и оповещение — для показа', 'demotog', S.demo),
        sw2('stack', 'Рынок неспокойный', 'включает оповещения и меняет сценарии', 'alerttog', S.alertOn),
        sw2('info', 'Нет данных', 'модель молчит, сумма — «Без позиции»', 'nosig', S.noSignal),
        row({ glyph:'clock', title:'Перемотать неделю', sub:'реальные решения получат итог', attrs:'data-act="ffweek"', nochev:true }),
        row({ glyph:'bell', title:'Показать пример оповещения', attrs:'data-act="testbanner"', nochev:true }),
        row({ glyph:'sync', title:'Начать заново', attrs:'data-act="reset"', nochev:true }),
      ])}
      <p class="fine">Цифры в прототипе иллюстративные. Деньги и токены мы не храним, заявки на бирже не отправляем.</p>
    </section>
  </div>`;
}
function vAlerts() {
  const t = (k, b, s, ic, locked) => `<div class="row"><span class="gl">${ico(ic)}</span><span class="rt"><b>${b}</b><small>${s}</small></span>${toggle(`data-tog="${k}"`, locked || S.set[k], b, locked)}</div>`;
  return `${navbar('Оповещения', 'profile')}
  <div class="cols even">
    <section class="stackv">${sec('О чём сообщать')}
      ${grp([t('funding','Многие покупают на заёмные деньги','плата за плечо выше, чем в 90% дней года','stack'), t('oi','Ставок на фьючерсах больше, а цена стоит','копятся заёмные деньги','layers'), t('vol','Цена стала колебаться сильнее','ожидаемый размах цены +10% и больше','wave'), t('flow','Переводы BTC на биржи','крупные переводы с кошельков на биржи','flow'), t('', 'План вышел за лимит', 'нельзя выключить: это суть продукта', 'shield', true)])}
    </section>
    <section class="stackv">${sec('Как приходят')}
      ${grp([
        row({ glyph:'bell', title:'Внутри приложения', sub:'на главной, в «Что изменилось»; на почту — только итоги недели' }),
        `<div class="row"><span class="gl">${ico('clock')}</span><span class="rt"><b>Не чаще в день</b><small>частые сигналы толкают к лишним сделкам</small></span><div class="chips">${[1,2,3].map(n => `<button class="chip sm ${S.set.maxDay === n ? 'on' : ''}" data-max="${n}">${n}</button>`).join('')}</div></div>`,
        t('quiet','Тихие часы','с 23:00 до 8:00 не беспокоим','moon'),
      ])}
      <p class="fine">Каждое оповещение отвечает на три вопроса: что произошло, что это значит для вас и откуда данные. Это не сигнал к сделке.</p>
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
        <div class="pair">${btn('Удалить', 'data-act="aiclear"', 'd')}${btn('Сохранить', 'data-act="aisave"')}</div>
        <p class="fine">Ключ хранится только в этом браузере и уходит только в OpenRouter. На общей ссылке ключ не вводите — используйте прокси из proxy-worker.js.</p>
      </div>
    </section>
  </div>`;
}

/* ---------- до входа: стартовый экран и три шага реального режима ---------- */
let landReveal = false;
function vLanding() {
  return `<div class="land${landReveal ? ' reveal' : ''}">
    <div class="lcenter">
      <span class="appic big" style="--d:0ms">${ico('logo')}</span>
      <h1 style="--d:80ms">Crypto Analytics</h1>
      <p class="lsub" style="--d:160ms">Узнайте, сколько можно потерять на биткоине за плохую неделю, — до того, как рисковать деньгами.</p>
      <div class="lfeat" style="--d:240ms">
        ${row({ tile:'wallet', cls:'c-bl', title:'Баланс и цена биткоина', sub:'в одном месте, только просмотр' })}
        ${row({ tile:'shield', cls:'c-gr', title:'Ваша граница на неделю', sub:'сумма, при которой плохая неделя обойдётся примерно в выбранный вами лимит' })}
        ${row({ tile:'spark', cls:'c-vi', title:'Тренировка без денег', sub:`виртуальные ${usd(SAND_CAP)}, без регистрации` })}
      </div>
      <div class="lcta" style="--d:320ms">${btn('У меня есть счёт', 'data-act="login"')}${btn('Попробовать демо', 'data-act="sandstart"', 'd')}</div>
      <p class="fine c" style="--d:400ms">Мы не биржа: не храним деньги и не совершаем сделки.</p>
    </div>
  </div>`;
}
const TERMS_VERSION = '2026-10-20';
const consentRow = (k, text) => `<button class="cons press ${S.cons[k] ? 'on' : ''}" data-consent="${k}" role="checkbox" aria-checked="${!!S.cons[k]}"><span class="box2">${ico('check')}</span><span>${text}</span></button>`;
const emailOk = v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v).trim());
function vOnb(dir) {
  const n = 3, dotsH = `<div class="dots">${Array.from({length:n}, (_, i) => `<i class="${i <= S.onb ? 'on' : ''}"></i>`).join('')}</div>`;
  const back = to => to === 'land' ? `<button class="btn link press" data-act="toland">${S.fromSand ? 'Вернуться в песочницу' : 'Назад'}</button>` : `<button class="btn link press" data-onb="${to}" data-back>Назад</button>`;
  let body;
  if (S.onb === 0) body = `${dotsH}
    <h1>Сколько денег вы выделили на биткоин?</h1>
    <p class="p">Можно примерно — например, сколько у вас на бирже. Это только число для расчёта: деньги остаются у вас.</p>
    <div class="hero num c" id="onbCap">${usd(S.capital)}</div>
    <div class="chips c">${[500,1000,5000].map(v => `<button class="chip num ${S.capital === v && !S.customCap ? 'on' : ''}" data-cap="${v}">${usd(v)}</button>`).join('')}<button class="chip ${S.customCap ? 'on' : ''}" data-cap="custom">другая</button></div>
    ${S.customCap ? `<div class="inp"><span>$</span><input inputmode="decimal" enterkeyhint="done" placeholder="например, 3 000" data-in="customcap" aria-label="Свой баланс"></div>` : ''}
    ${btn('Дальше', 'data-onb="1"')}${back('land')}`;
  else if (S.onb === 1) body = `${dotsH}
    <h1>Какая потеря за неделю для вас терпима?</h1>
    <p class="p">Это ваш лимит — граница, а не цель. От него считаем сумму. Поменять можно в любой момент.</p>
    <div class="hero num c" id="limBig">${usd(S.limit)}</div>
    <div class="chips c">${LIM_PCTS.map(limChip).join('')}</div>
    <p class="fine c" id="onbPct">${limPct()} · обычно выбирают 3–10%</p>
    ${btn('Дальше', 'data-onb="2"')}${back(0)}`;
  else body = `${dotsH}
    <h1>Почта — чтобы данные не потерялись</h1>
    <p class="p">Пришлём итоги недели. Паспорт и карта не нужны: деньги и проверка личности остаются на бирже.</p>
    <div class="inp" id="emBox"><input type="email" placeholder="you@example.com" value="${esc(S.email)}" data-in="email" autocomplete="email" autocapitalize="none" enterkeyhint="go" aria-label="Почта" aria-describedby="emErr"></div>
    <p class="fine c err" id="emErr" role="alert"></p>
    ${btn('Готово', 'data-act="onbfinish"')}
    <button class="btn link press" data-act="onblater">Позже</button>${back(1)}`;
  return `<div class="onb"><div class="box ${dir || ''}">${body}</div></div>`;
}

/* ---------- листы ---------- */
let RV = null, WI = null, EXB = null;
const WHATIF = {
  price:{ t:'Цена −10%', f:s => s * 0.86 }, vol:{ t:'Размах цены больше', f:s => s / 1.25 }, lim:{ t:'Лимит на треть ниже', f:s => s * 0.67 },
  hor:{ t:'Срок 3 дня', f:s => s * 1.5 }, stop:{ t:'Продажа раньше', f:s => s * 1.2 }, src:{ t:'Нет данных с бирж', none:true },
};
const means = t => `<div class="means"><small>Что это значит для вас</small><p>${t}</p></div>`;
const okBtn = (t = 'Понятно') => btn(t, 'data-act="close"', 'd');
const SHEETS = {
  term(k) { const g = GLOSS[k];
    return `<span class="tag t-bl">${ico('info')}Простыми словами</span><h2 class="l">${g[0]}</h2><p class="body">${g[1]}</p>${okBtn()}`; },
  alert(id) { const a = ALERTS.find(x => x.id === id), c = calc();
    return `<span class="tag t-or">${ico(a.icon)}Рынок неспокойный · сегодня</span>
      <h2 class="l">${a.title}</h2>
      ${means(a.means)}
      ${c.none ? '' : `<div class="money"><small>Сумма в пределах лимита</small><b class="num">${usd(calmSum())} → ${usd(c.sum)}</b></div><p class="fine">${DISC}</p>`}
      <details class="more2"><summary>Подробнее: цифры и источники</summary>
        ${grp(a.kv.map(k => row({ title:k[0], val:k[1] })))}
        <p class="body">${a.note} ${a.id === 'funding' ? term('lev', 'Что такое плечо?') : term('dvol', 'Что такое размах?')}</p>
        <p class="fine">Источники: ${a.src}.</p>
      </details>
      ${btn('Открыть расчёт', 'data-act="recalc"')}${okBtn()}`; },
  fg() { const v = M().fg;
    return `<h2 class="l">Индекс страха и жадности</h2>
      <div class="card fg">${fgMeter(v)}</div>
      ${means(`Это настроение участников рынка по опросам и данным торгов. В расчёт суммы не входит и сигналом к сделке не является.`)}
      ${grp([row({ title:'Сегодня', val:`${v} · ${fgLabel(v)}` }), row({ title:'Неделю назад', val:'61 · жадность' }), row({ title:'Месяц назад', val:'48 · нейтрально' })])}
      ${grp([row({ title:'Как считается', sub:'От 0 (сильный страх) до 100 (сильная жадность): по размаху цены, объёмам торгов, поисковым запросам и соцсетям. Источник — alternative.me.' }), row({ title:'В нашей модели', sub:'Не участвует. Показываем для общего фона.' })])}
      ${okBtn()}`; },
  changer(id) { const x = CHANGERS().find(c => c.id === id);
    return `<h2 class="l">${x.t}</h2>
      ${grp([row({ title:'Что это такое', sub:x.what })])}
      ${means(`Если это случится, ${x.s.replace(/^сейчас \d+ · /, '')}. Сумму в пределах лимита мы пересчитаем сами и сообщим на главной.`)}
      ${okBtn()}`; },
  tokens() { return `<h2 class="l">20 крупнейших монет</h2><p class="fine">Цена и изменение за сутки · демо. Расчёт суммы пока только для биткоина.</p>${grp(TOKENS.map(tokenRow))}${okBtn('Закрыть')}`; },
  allnews() { return `<h2 class="l">Новости простыми словами</h2>${grp(NEWS.map(newsRow))}<p class="fine">Демо-лента: заголовки условные.</p>${okBtn('Закрыть')}`; },
  weekprice() { return `<h2 class="l">Что было с ценой за неделю</h2>${grp([
      row({ title:'В начале недели', val:usd(WEEK.from) }),
      row({ title:'Самая низкая', val:`${usd(WEEK.low)} · −${pct1(WEEK.worst)}` }),
      row({ title:'Сейчас', val:`${usd(WEEK.to)} · +${pct1(WEEK.chg)}` }),
      row({ title:'Диапазон модели', sub:'8 сценариев из 10', val:`${usd(WEEK.lo)} – ${usd(WEEK.hi)}` }),
    ])}${means('Цена осталась внутри диапазона модели. Так бывает примерно в 8 неделях из 10 — промахи мы тоже показываем в архиве.')}${okBtn()}`; },
  news(i) { const n = NEWS[i];
    return `<span class="tag t-gy">${n.tag} · ${n.ago}</span><h2 class="l">${n.t}</h2>${means(n.means)}<p class="fine">Демо-лента: заголовок условный.</p>${okBtn()}`; },
  coin(i) { const t = TOKENS[i], btc = t.s === 'BTC';
    return `<h2 class="l">${t.n} · ${t.s}</h2>
      ${grp([row({ title:'Цена', val:price(t.p) }), row({ title:'За сутки', val:chg(t.c), vc:chgCls(t.c) }), row({ title:'Место по размеру рынка', val:`${i + 1} из 20` })])}
      ${means(btc ? 'Для биткоина мы считаем сумму в пределах вашего лимита и диапазон на неделю.' : 'Расчёт суммы и диапазон для этой монеты — скоро. Сейчас модель проверена только на биткоине.')}
      <p class="fine">Цены — демо.</p>
      ${btc ? btn('Открыть расчёт', 'data-go="sum"') : ''}${okBtn(btc ? 'Закрыть' : 'Понятно')}`; },
  /* кошельки — только просмотр: вручную, биржа на чтение, адрес на чтение */
  addwallet() {
    if (S.sandbox) return `<h2>Кошельки — для реального режима</h2><p class="body mut c">Сейчас включена песочница с виртуальными деньгами. Её баланс и записи останутся как есть.</p>${btn('Перейти в реальный режим', 'data-act="sandtog"')}${okBtn('Не сейчас')}`;
    return `<h2>Добавить кошелёк</h2>
      <p class="fine c">Только просмотр. Мы не храним деньги и не можем ими распоряжаться. ${term('wallet', 'Подробнее')}</p>
      ${grp([
        row({ tile:'wallet', cls:'c-gy', title:'Ввести баланс вручную', sub:'быстрее всего, без подключений', attrs:'data-sheet="manual"' }),
        row({ tile:'lock', cls:'c-gr', title:'Подключить биржу-партнёр', sub:'ключ только на чтение — баланс обновляется сам', attrs:'data-act="api"' }),
        row({ tile:'btc', cls:'c-btc', title:'Адрес биткоин-кошелька', sub:'смотрим баланс по адресу, только чтение', attrs:'data-sheet="addr"' }),
      ])}
      ${okBtn('Отмена')}`; },
  manual() { return `<h2>Баланс вручную</h2>
      <p class="fine c">Сколько денег вы выделили на биткоин — на бирже или отложено.</p>
      <div class="inp"><span>$</span><input id="wNew" inputmode="decimal" enterkeyhint="done" placeholder="например, 1 000" aria-label="Баланс"></div>
      <p class="fine c err" id="wErr" role="alert"></p>
      ${btn('Добавить', 'data-act="manualadd"')}${okBtn('Отмена')}`; },
  addr() { return `<h2>Адрес биткоин-кошелька</h2>
      <p class="fine c">Адрес публичный: по нему видно только баланс. Доступа к деньгам он не даёт.</p>
      <div class="inp"><input id="wAddr" placeholder="bc1q…" autocapitalize="none" autocomplete="off" aria-label="Адрес кошелька" value="bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"></div>
      <p class="fine c err" id="wErr" role="alert"></p>
      ${btn('Подключить на чтение', 'data-act="addrconnect"')}${okBtn('Отмена')}`; },
  wallet(id) {
    if (id === 'sand') return `<h2 class="l">Песочница</h2>${grp([row({ title:'Виртуальный баланс', val:usd(S.capital) }), row({ title:'С начала', val:sgn(S.capital - SAND_CAP), vc:S.capital >= SAND_CAP ? 'up' : 'dn' }), row({ title:'Лимит потерь', val:usd(S.limit) })])}
      ${means('Деньги не настоящие. Записи песочницы помечены и не попадают в ваш реальный график и статистику.')}
      ${btn('Сбросить до ' + usd(SAND_CAP), 'data-act="sandreset"', 'd')}${btn('Перейти в реальный режим', 'data-act="sandtog"')}`;
    const w = S.wallets.find(x => x.id === id); if (!w) return okBtn();
    const ro = w.kind !== 'manual';
    return `<h2 class="l">${w.name}</h2><p class="body mut">${WKIND[w.kind][1]}</p>
      ${ro ? grp([row({ title:'Баланс', val:usd(w.bal) }), w.btc ? row({ title:'В биткоинах', val:String(w.btc).replace('.', ',') + ' BTC' }) : '', row({ title:'Доступ', sub:'видим только баланс, переводы и сделки невозможны', val:'чтение' }), row({ title:'Обновлено', val:ago().replace('обновлено ', '') })])
        : `<div class="field"><label for="wBal">Баланс</label><div class="inp"><span>$</span><input id="wBal" inputmode="decimal" enterkeyhint="done" data-in="wbal" data-w="${w.id}" value="${w.bal}"></div></div>`}
      ${btn('Готово', 'data-act="close"')}${btn(ro ? 'Отключить' : 'Удалить кошелёк', `data-act="wdel" data-w="${w.id}"`, 'd')}`; },
  /* перед биржей: страна и согласия — только здесь, на шаге к настоящим деньгам */
  exit() {
    if (!S.consent || !S.country) {
      const ready = S.cons.model && S.cons.loss && S.country;
      return `<h2>Перед переходом на биржу</h2>
      <p class="fine c">Это шаг к настоящим деньгам, поэтому один раз спросим страну и согласие.</p>
      ${sec('Где вы живёте?')}
      <button class="pick press ${S.country === 'BY' ? 'on' : ''}" data-country="BY"><i>BY</i><span class="rt">Беларусь<small>биржи — резиденты ПВТ</small></span><span class="ck"></span></button>
      <button class="pick press ${S.country === 'OT' ? 'on' : ''}" data-country="OT"><i>${ico('globe')}</i><span class="rt">Другая страна<small>партнёры по законам страны</small></span><span class="ck"></span></button>
      <p class="fine">${term('pvt', 'Кто такие резиденты ПВТ?')}</p>
      ${sec('Согласие')}
      <div class="consent">
        ${consentRow('model', 'Я понимаю: Crypto Analytics показывает расчёты по модели. Это не инвестиционный совет и не прогноз цены.')}
        ${consentRow('loss', 'Я понимаю: цена может сильно упасть, и я могу потерять деньги, потраченные на токены, вплоть до всех. Решения о сделках принимаю сам.')}
      </div>
      <button class="btn link press" data-sheet="terms">Прочитать условия использования</button>
      ${btn('Продолжить', `data-act="consentok" ${ready ? '' : 'disabled'}`)}${okBtn('Не сейчас')}`;
    }
    const BY = S.country === 'BY', c = calc();
    return `<h2>Переход на биржу</h2>
      <div class="legal"><b>Можно потерять все деньги, потраченные на токены.</b> Токены — не средство платежа и не обеспечены государством.</div>
      <div class="legal"><b>Как мы зарабатываем.</b> Биржа платит нам часть своей комиссии с ваших сделок. На расчёт суммы это не влияет.</div>
      ${BY ? `<p class="fine">Обе биржи — ${term('pvt', 'резиденты ПВТ')}. Названия появятся после подписания договора; список всех резидентов — на park.by. Подставим в форму ${c.none ? 'пустую сумму' : `сумму плана ≈ ${fmt(c.sum * USD_BYN)} BYN`} — её можно изменить, заявку отправляете вы.</p>
        ${grp([
          row({ tile:'swap', cls:'c-gr', title:EXCH['1'], sub:'резидент ПВТ · показывает возможную потерю рядом с формой заявки', attrs:'data-exgo="1"', extra:'exrow' }),
          row({ tile:'swap', cls:'c-gy', title:EXCH['2'], sub:'резидент ПВТ', attrs:'data-exgo="2"', extra:'exrow' }),
        ])}
        ${okBtn('Не сейчас')}`
      : `<p class="body">Для вашей страны партнёров пока нет. Расчёт и журнал работают без перехода.</p>${okBtn()}`}`; },
  /* возврат с биржи: сколько внесли — чтобы журнал хранил факт, а не план */
  exback() { const j = S.journal.find(x => x.id === EXB.id);
    return `<h2>Сколько вы внесли на бирже?</h2>
      <p class="fine c">Мы не видим вашу сделку. Запишем в журнал — через неделю посчитаем, как сыграло. Подключите биржу на чтение, и спрашивать не придётся.</p>
      <div class="inp"><span>$</span><input id="exInv" inputmode="decimal" enterkeyhint="done" data-in="exinv" value="${EXB.inv}" aria-label="Сколько внесли"></div>
      <div class="chips c">${j && j.plan ? `<button class="chip sm num" data-exinv="${j.plan}">как в плане · ${usd(j.plan)}</button>` : ''}<button class="chip sm" data-exinv="0">Не покупал</button></div>
      ${btn('Записать', 'data-act="exsave"')}`; },
  email() { return `<h2>Почта</h2>
      <p class="fine c">Чтобы данные не потерялись и приходили итоги недели. Больше ни для чего.</p>
      <div class="inp" id="emBox"><input type="email" placeholder="you@example.com" value="${esc(S.email)}" data-in="email" autocomplete="email" autocapitalize="none" aria-label="Почта" aria-describedby="emErr"></div>
      <p class="fine c err" id="emErr" role="alert"></p>
      ${btn('Сохранить', 'data-act="emailsave"')}${okBtn('Отмена')}`; },
  calc() { return `<h2>Изменить расчёт</h2>${calcForm(true)}${btn('Готово', 'data-act="close"')}`; },
  limit() { return `<h2>Готовы потерять за неделю</h2>
      <div class="hero num c" id="limBig">${usd(S.limit)}</div>
      <input type="range" min="10" max="${Math.max(100, Math.round(S.capital * 0.25))}" step="10" value="${S.limit}" data-in="limit" aria-label="Готовы потерять за неделю">
      <div class="chips c">${LIM_PCTS.map(limChip).join('')}</div>
      <p class="fine c">По умолчанию 6% баланса. Сумму считаем так, чтобы при сильном падении потеря в среднем была около этой цифры. Бывает и больше.</p>
      ${btn('Готово', 'data-act="close"')}`; },
  whatif() { const base = calc(), w = WI && WHATIF[WI];
    let res;
    if (base.none) res = `<b>Без позиции</b><small>${base.reason}</small>`;
    else if (!w) res = `<b class="num">${usd(base.sum)}</b><small>выберите сценарий выше</small>`;
    else if (w.none) res = `<b class="num">${usd(base.sum)} → без позиции</b><small>без данных расчёт ненадёжен</small>`;
    else res = `<b class="num">${usd(base.sum)} → ${usd(Math.min(S.capital, Math.round(w.f(base.sum))))}</b><small>при сильном падении потеря в среднем около ${usd(WI === 'lim' ? Math.round(S.limit * 0.67) : S.limit)}</small>`;
    return `<span class="tag t-out">Гипотетически</span>
      <h2 class="l">Что если…</h2>
      <div class="chips">${Object.entries(WHATIF).map(([k, v]) => `<button class="chip sm ${WI === k ? 'on' : ''}" data-wi="${k}">${v.t}</button>`).join('')}</div>
      <div class="money">${res}</div>
      <p class="body">Гипотетический сценарий. Это не новый прогноз модели.</p>
      ${okBtn('Вернуться')}`; },
  factor(id) { const F = FACTORS(), all = [...F.up.map(x => [x, 'снижает риск']), ...F.down.map(x => [x, 'повышает риск']), ...F.unk.map(x => [x, 'вне модели'])], [f, dir] = all.find(([x]) => x.id === id);
    return `<h2 class="l">${f.t}</h2><p class="body mut">${dir}${f.p ? ` · сила ${['', 'слабая', 'средняя', 'сильная'][f.p]}` : ''}</p>
      ${grp([row({ title:'Значение', val:f.val }), row({ title:'Источник', sub:f.at ? `${f.at} · данные свежие` : 'нет времени обновления', val:f.src })])}
      ${grp([row({ title:'Как считаем', sub:f.how }), row({ title:'Ограничение', sub:f.lim })])}
      <p class="fine">Это вклад в расчёт модели, а не причина движения цены.</p>
      ${okBtn()}`; },
  regime() { const cur = regimeKey();
    return `<h2 class="l">Состояние рынка</h2>${grp(Object.entries(REGIMES).map(([k, [t, s]]) => row({ title:t, sub:s, right:k === cur ? `<span class="st ok">${ico('check')}</span>` : '' })))}
      <p class="fine">Состояние определяет модель по размаху цены, её направлению и покупкам на заёмные деньги. Когда неспокойно, диапазон шире, а сумма в пределах лимита меньше.</p>
      ${okBtn()}`; },
  data() { const f = fresh();
    return `<h2 class="l">Данные и модель</h2>
      ${grp([row({ title:'Актив', val:'BTC к доллару, без плеча' }), row({ title:'Срок', sub:'другие сроки не подменяем ближайшим', val:'7 дней' }), row({ title:'Рассчитано', val:f.t }), row({ title:'Цена', sub:'Binance, Bybit, OKX, Deribit', val:`<i class="fd ${f.c}"></i>${ago().replace('обновлено ', '')}` })])}
      ${grp([row({ title:'Надёжность', sub:'10 из 12 недель в диапазоне модели', attrs:'data-go="archive"' }), row({ title:'Версия модели', val:'v0.4' })])}
      ${okBtn()}`; },
  rules() { return `<h2 class="l">Как читать прогноз</h2>${grp([
      row({ glyph:'pie', title:'Вероятность — не прогноз', sub:'Это доля смоделированных недель, а не обещание.' }),
      row({ glyph:'wave', title:'Широкий диапазон — неопределённость', sub:'Значит, модель не уверена.' }),
      row({ glyph:'close', title:'Пропустить — нормально', sub:'Это тоже решение, мы его запишем.' }),
      row({ glyph:'info', title:'Иногда модель молчит', sub:'Это честнее, чем угадывать.' })])}
      ${okBtn()}`; },
  terms() { return `<h2 class="l">Условия использования</h2>
      <p class="fine">Версия от 20.10.2026. Черновик для прототипа, текст нужно согласовать с юристом.</p>
      ${grp([
        row({ glyph:'info', title:'Что такое сервис', sub:'Информационный и аналитический сервис. Показывает диапазоны и вероятности по модели, считает сумму в пределах вашего лимита. Не даёт инвестиционных советов и не прогнозирует цену.' }),
        row({ glyph:'shield', title:'Риски', sub:'Токены не являются средством платежа и не обеспечены государством. Цена может резко меняться, возможна потеря всех потраченных денег, а также потери из-за сбоев и хищений.' }),
        row({ glyph:'close', title:'Ответственность', sub:'Решения о сделках вы принимаете самостоятельно. Сервис не несёт ответственности за ваши убытки и упущенную выгоду, в том числе если вы опирались на расчёты, оповещения или ответы ассистента.' }),
        row({ glyph:'lock', title:'Деньги и сделки', sub:'Мы не храним деньги и токены и не отправляем заявки. Кошельки в приложении — только просмотр. Сделки, деньги и проверка личности — на бирже-партнёре по её правилам.' }),
        row({ glyph:'pie', title:'Модель может ошибаться', sub:'Прошлые результаты модели не гарантируют будущих. Промахи мы показываем в архиве.' }),
      ])}
      ${okBtn()}`; },
  jitem(id) { const j = S.journal.find(x => x.id === id); const H = { range:'цена постоит', up:'рост', down:'падение', unk:'не знаю' };
    return `<h2 class="l">${jTitle(j)}</h2><p class="body mut">${j.date}${j.sand ? ' · песочница' : ''}${j.demo ? ' · пример' : ''}</p>
      ${grp([row({ title:'Сумма в пределах лимита', val:j.plan ? usd(j.plan) : '—' }), row({ title:'Лимит', val:usd(j.limit || S.limit) }), row({ title:'Ваше мнение', val:j.hyp ? H[j.hyp] : 'не указано' }), row({ title:'Уверенность', val:j.conf ? ['', 'низкая', 'средняя', 'высокая'][j.conf] : 'не указана' })])}
      ${j.pending ? `<p class="fine">Итог — ${j.reviewDate || dShort(7)}. Напомним на главной.</p>` : j.result ? grp([row({ title:'Было в биткоине', val:usd(j.result.amt) }), row({ title:'Худший момент недели', val:sgn(-j.result.worst), vc:'dn' }), row({ title:'Конец недели', val:sgn(j.result.end) })]) : ''}
      ${j.result ? btn('Итоги недели', 'data-go="digest"', 'd') : ''}${okBtn('Закрыть')}`; },
  /* «как сыграло решение»: пользователь вводит только сумму — потерю и лимит считаем сами */
  review() { const j = S.journal.find(x => x.id === RV.id), st = RV.step;
    const pd = `<div class="dots sm">${[0,1,2].map(i => `<i class="${i <= st ? 'on' : ''}"></i>`).join('')}</div>`;
    const next = (label = 'Дальше') => btn(label, 'data-act="rvnext"');
    let b;
    if (st === 0) b = `<h2>Сколько было в биткоине на самом деле?</h2>
      <div class="inp"><span>$</span><input inputmode="decimal" enterkeyhint="done" data-in="rvinv" value="${RV.notIn ? '' : RV.inv}" placeholder="например, 3 000" aria-label="Сколько было в биткоине"></div>
      <div class="chips c"><button class="chip ${RV.notIn ? 'on' : ''}" data-rv="notIn">Сделки не было</button></div>${next()}`;
    else if (st === 1) { const t = resolve(Object.assign({}, j), RV.notIn ? 0 : num(RV.inv)), r = t.result, lim = j.limit || S.limit;
      b = `<h2>${r.amt ? (t.limitOk ? 'Потеря уложилась в лимит' : 'Потеря больше лимита') : 'Неделя без сделки'}</h2>
      ${grp([row({ title:'Было в биткоине', val:usd(r.amt) }), row({ title:'Худший момент недели', sub:'посчитали сами по цене', val:sgn(-r.worst), vc:'dn' }), row({ title:'Ваш лимит', val:usd(lim), right:r.amt ? `<span class="st ${t.limitOk ? 'ok' : 'no'}">${ico(t.limitOk ? 'check' : 'close')}</span>` : '' }), row({ title:'Цена осталась в диапазоне модели', val:'да', vc:'up' })])}
      <label class="flab">Модель была слишком уверена? Необязательно</label>
      <div class="chips">${['Нет','Да','Не знаю'].map((t2, i) => `<button class="chip ${RV.conf === i ? 'on' : ''}" data-rvconf="${i}">${t2}</button>`).join('')}</div>${next()}`; }
    else b = `<h2>Чего не хватило для решения?</h2><div class="inp"><input data-in="rvmiss" value="${esc(RV.miss)}" placeholder="необязательно" enterkeyhint="done" aria-label="Чего не хватило"></div>${next('Сохранить и посмотреть итог')}`;
    return `${pd}${b}<p class="fine c">Решение ${j.date} · сумму вводите вы, остальное считаем мы. С биржей на чтение спрашивать не будем.</p>`; },
  api() { const p = S.apiPerm, r = (k, t) => `<div class="row"><span class="gl">${ico(k === 'read' ? 'lock' : 'close')}</span><span class="rt"><b>${t}</b><small>${k === 'read' ? 'нужно для баланса и разбора' : 'должно быть выключено'}</small></span>${toggle(`data-perm="${k}"`, p[k], t)}</div>`;
    return `<h2>Ключ доступа: ${EXCH['1']}</h2>
      <p class="fine c">Создайте на бирже ключ только на чтение и вставьте его сюда. В демо можно выбрать, какие права «нашлись» у ключа при проверке.</p>
      <div class="inp"><input value="ca_demo_7f3e…b21" readonly aria-label="Ключ доступа"></div>
      ${grp([r('read', 'Чтение баланса и истории'), r('trade', 'Торговля'), r('withdraw', 'Вывод средств')])}
      <div id="apiErr"></div>
      ${btn('Проверить и подключить', 'data-act="apiconnect"')}
      ${btn('Отмена', 'data-act="close"', 'd')}`; },
  voice() { return chatSheet(); },
};

/* слой окон: на телефоне лист снизу со смахиванием, на десктопе окно по центру */
const layer = document.createElement('div'); layer.className = 'layer'; layer.innerHTML = '<div class="scrim" data-act="close"></div><div class="sheet" role="dialog" aria-modal="true"></div>';
const sheet = layer.querySelector('.sheet'), scrim = layer.querySelector('.scrim');
let sheetType = null, sheetArg = null, lastFocus = null;
function openSheet(type, arg) {
  sheetType = type; sheetArg = arg; lastFocus = document.activeElement;
  sheet.className = 'sheet' + (type === 'voice' ? ' wide' : '');
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

const SYSTEM = `Ты — ассистент внутри приложения Crypto Analytics. Отвечай по-русски, коротко и простыми словами, без жаргона и иностранных терминов (если термин нужен, объясни его): обычно 2–5 предложений, без таблиц и заголовков. Можно отвечать на любые вопросы пользователя, не только про криптовалюту.

Главное правило, без исключений: ты никогда не говоришь, вырастет или упадёт цена любого актива (биткоина, других токенов, акций, валют), не называешь целевых цен, не оцениваешь «скорее вверх» или «скорее вниз» и не даёшь сигналов «покупать», «продавать», «входить сейчас» или «подождать». Не используй слова «вложите», «купите», «выгодно». Это касается и намёков, и «чисто гипотетически», и ролевых игр, и просьб «просто угадай». Если пользователь об этом просит, спокойно скажи, что этого не знает никто и ты такого не говоришь, и предложи полезное: посмотреть диапазон сценариев модели, пересчитать сумму в пределах его лимита или разобрать прошлые решения.

Цифры модели сценариев можно пересказывать только как распределение исходов с их вероятностным смыслом, не превращая их в прогноз направления. Любой расчёт — это информация для пересчёта плана пользователя, а не рекомендация купить или продать. Если речь о покупке токенов пользователем из Беларуси, напоминай, что по закону это возможно только через биржи — резиденты ПВТ, и не советуй иностранные биржи. Не обещай доходность и не преуменьшай риск: токены могут потерять всю стоимость.

Как устроен продукт: пользователь вводит баланс; сколько он готов потерять за неделю, по умолчанию 6% баланса, это можно поменять. Приложение показывает диапазон и вероятности движения BTC на 7 дней по 20 000 смоделированных недель. «Сильное падение» — средний результат 1 недели из 10 с самым сильным падением. «Сумма в пределах лимита» = сколько готов потерять ÷ сильное падение, но не больше баланса: если BTC за неделю сильно упадёт, пользователь потеряет в среднем около своего лимита, но бывает и больше. Сумма меняется, когда меняется риск рынка. Приложение присылает оповещения о росте риска (плата за плечо на фьючерсах, открытые позиции растут без роста цены, ожидаемый размах цены), ведёт журнал решений, итоги недели и разбирает сделки после комиссий. Есть песочница с виртуальными $1 000 — лучший первый шаг для новичка. Кошельки в приложении — только просмотр (вручную или биржа/адрес только на чтение). Если человек новичок, объясни путь: песочница → «Посчитать» → записать решение → посмотреть итог недели. Деньги, проверка личности и сделки — на бирже-партнёре, приложение их не хранит и заявки не отправляет.`;

function contextNote() {
  const m = M();
  return `Текущее состояние в приложении (данные демо-прототипа): BTC ${usd(PRICE)}. Рынок: ${S.alertOn ? 'напряжённо — плата за плечо выше, чем в 94% дней года, открытые позиции на фьючерсах +12% за 3 дня' : 'спокойно'}. Диапазон 8 из 10 сценариев на неделю: ${usd(m.lo)}–${usd(m.hi)}. Вероятности за неделю: падение больше 5% — ${m.tails[0]}%, в пределах ±5% — ${m.tails[1]}%, рост больше 5% — ${m.tails[2]}%. Сильное падение ${pct1(m.bad)}. Баланс ${usd(S.capital)}${S.sandbox ? ' (песочница, виртуальные деньги)' : ''}, готов потерять за неделю ${usd(S.limit)}, сумма в пределах лимита ${usd(calcSum())}. Индекс страха и жадности ${m.fg}. Страна: ${S.country === 'BY' ? 'Беларусь' : 'не Беларусь'}.`;
}

let chat = [], busy = false, rec = null;
const SUGGEST = ['Я новичок, с чего начать?', 'Что такое плата за плечо?', 'Почему сумма стала меньше?', 'Вырастет ли биткоин на этой неделе?', 'На бирже $8 000, терять готов $400'];

function chatSheet() {
  return `<div class="chat">
    <div class="chathead"><span class="aiava">${ico('logo')}</span><div class="rt"><b>Ассистент</b><small>Объясняет и считает. Цену не предсказывает.</small></div><span class="tag ${aiLive() ? 't-gr' : 't-gy'}">${aiLive() ? esc(modelName()) : 'демо'}</span></div>
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

/* «На бирже $8 000, терять готов $400» → карточка «Поняли так» без запроса к модели */
function parsePlan(t) {
  const s = t.toLowerCase().replace(/(\d)\s+(?=\d{3}\b)/g, '$1');
  if (!/влож|инвест|купить на|потрат|на бирже|баланс|у меня|выдел/.test(s)) return null;
  const num = str => { const m = str.match(/(\d+(?:[.,]\d+)?)\s*(к|k|тыс)?/); return m ? Math.round(parseFloat(m[1].replace(',', '.')) * (m[2] ? 1000 : 1)) : null; };
  const li = s.search(/терят|потер|лимит|риск|минус/);
  const cap = num(li > 0 ? s.slice(0, li) : s);
  const lim = li >= 0 ? num(s.slice(li)) ?? num(s.slice(0, li).replace(String(cap), '')) : null;
  if (!cap) return null;
  return { cap, lim: lim && lim < cap ? lim : autoLim(cap) };
}
function planCard(p) {
  return `<div class="msg ai card-msg"><div class="day">Поняли так</div>
    <div class="understood">
      ${row({ tile:'wallet', cls:'c-bl', title:'Баланс', sub:'на бирже или выделено', val:usd(p.cap) })}
      ${row({ tile:'shield', cls:'c-rd', title:'Готовы потерять за неделю', sub:`${Math.round(p.lim / p.cap * 100)}% баланса`, val:usd(p.lim) })}
      ${row({ tile:'clock', cls:'c-gy', title:'Срок', sub:'проверенный', val:'7 дней' })}
    </div>
    ${btn('Посчитать', `data-act="voiceok" data-pcap="${p.cap}" data-plim="${p.lim}"`)}</div>`;
}

/* демо-ответы без ключа: то же правило — о направлении цены не говорим */
const DIRECTION = /(вырас|упад|подним|опуст|рост|пад[её]т|будет стоить|прогноз|куда пойд|пойд[её]т|выше|ниже|памп|дамп|покупать|продавать|входить|стоит ли (купить|продать|брать)|когда (купить|продать)|сколько будет)/i;
function demoAnswer(t) {
  const m = M(), s = t.toLowerCase();
  if (DIRECTION.test(s)) return `Этого я не скажу: куда пойдёт цена, не знает никто, и угадывать я не буду. Могу показать, что видит модель: в 8 из 10 сценариев BTC через неделю будет между **${usd(m.lo)}** и **${usd(m.hi)}**, падение больше 5% — в ${m.tails[0]}% сценариев, рост больше 5% — в ${m.tails[2]}%. Хотите, пересчитаю сумму в пределах вашего лимита ${usd(S.limit)}?`;
  if (/funding|фандинг|плат[аы] за плечо|плечо/.test(s)) return `Плата за плечо (по-английски funding) — это деньги, которыми каждые 8 часов обмениваются те, кто торгует на фьючерсах в долг. Когда она высокая, значит, многие поставили на рост с плечом. ${S.alertOn ? 'Сейчас она выше, чем в 94% дней года, поэтому мы прислали оповещение: при таком перекосе резкие движения случаются чаще.' : 'Сейчас она в обычных пределах.'}`;
  if (/сумм|меньше|почему/.test(s)) return S.alertOn ? `Риск вырос: при сильном падении модель теперь ожидает около −${pct1(m.bad)} за неделю, а не −8,7%. Чтобы такая неделя стоила вам в среднем около ${usd(S.limit)}, сумма стала **${usd(calcSum())}** вместо $3 467: ${usd(S.limit)} ÷ ${pct1(m.bad)}. Это информация для пересчёта плана, а не рекомендация — пропустить тоже нормально.` : `Сумма считается так: сколько вы готовы потерять за неделю (${usd(S.limit)}) делим на сильное падение по модели (${pct1(m.bad)}). Сейчас это **${usd(calcSum())}** из ${usd(S.capital)}.`;
  if (/пвт|бирж|закон|легал/.test(s)) return 'В Беларуси покупать и продавать токены за деньги можно только через биржи — резиденты ПВТ (Указ № 367). Поэтому мы ведём только туда, а сама сделка, деньги и проверка личности остаются на бирже.';
  if (/лимит/.test(s)) return `Лимит — сколько вы готовы потерять за неделю, если BTC сильно упадёт (в среднем; бывает и больше). Сейчас он ${usd(S.limit)}, это ${limPct()}. Поменять можно в «Решении на неделю» → «Изменить расчёт» или в профиле.`;
  if (/страх|жадн/.test(s)) return `Индекс страха и жадности сейчас ${m.fg} — ${fgLabel(m.fg)}. Он от 0 до 100 и показывает настроение рынка. В нашу модель он не входит, это общий фон.`;
  if (/нович|с чего начать|не понимаю|как пользоваться|что делать|зачем/.test(s)) return `Начните с песочницы — там виртуальные ${usd(SAND_CAP)}, ничем не рискуете. Дальше три шага: **1.** На главной нажмите «Посчитать» — увидите, сколько можно держать в биткоине, чтобы плохая неделя обошлась примерно в ваш лимит (${usd(S.limit)}). **2.** Выберите, что решили: сохранить план, только смотреть или пропустить неделю. **3.** Нажмите «Показать итог» — покажу, как бы это сыграло на прошлой неделе. Любое непонятное слово можно нажать — откроется объяснение.`;
  if (/привет|здрав|hello|hi\b/.test(s)) return 'Привет! Чем помочь? Могу объяснить термины, ваш план или оповещение — или ответить на вопрос не про крипту.';
  return 'В демо-режиме я отвечаю только на несколько тем: плата за плечо, сумма в пределах лимита, лимит, индекс страха и жадности, биржи ПВТ. Подключите модель в Профиле → Ассистент, и я отвечу на любой вопрос — кроме того, вырастет или упадёт цена.';
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
    chat.push({ role:'assistant', content:`Поняли так: баланс ${usd(plan.cap)}, готовы потерять за неделю ${usd(plan.lim)}, срок 7 дней.`, card:planCard(plan) });
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
function listen(btnEl) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return toast('Голосовой ввод в этом браузере недоступен — напишите текстом');
  if (rec) { rec.stop(); return; }
  rec = new SR(); rec.lang = 'ru-RU'; rec.interimResults = true; rec.maxAlternatives = 1;
  const q = document.getElementById('q'); let finalText = '';
  btnEl.classList.add('on');
  rec.onresult = e => { let t = ''; for (const r of e.results) t += r[0].transcript; q.value = t; if (e.results[e.results.length - 1].isFinal) finalText = t; };
  rec.onerror = e => { if (e.error === 'not-allowed') toast('Разрешите доступ к микрофону, чтобы говорить'); };
  rec.onend = () => { btnEl.classList.remove('on'); rec = null; const t = (finalText || q.value).trim(); if (t) { q.value = ''; ask(t); } };
  try { rec.start(); } catch (e) { btnEl.classList.remove('on'); rec = null; }
}


/* баннер-уведомление и тост */
const banner = document.createElement('button'); banner.className = 'banner'; banner.type = 'button';
let bannerT;
function showBanner(title, text, onTap) {
  banner.innerHTML = `<span class="ai">${ico('logo')}</span><span class="rt"><span class="t"><b>${title}</b><small>сейчас</small></span><p>${text}</p></span>`;
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
const alertBanner = () => showBanner('Риск на неделю вырос', `Многие торгуют в долг в расчёте на рост. Сумма в пределах лимита: ${usd(calmSum())} → ${usd(calcSum())}.`, () => openSheet('alert', 'funding'));

/* ---------- биржа (другое приложение) ---------- */
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
    <div class="m"><span>Потеря при сильном падении</span><b class="num">${a ? '−' + fmt(badB) + ' BYN' : '—'}</b></div>
    <div class="m"><span>Ваш лимит</span><span class="num" style="color:${a ? (ok ? '#30d158' : '#ff453a') : '#8e8e93'}">${fmt(limB)} BYN ${a ? (ok ? '✓' : '— превышен') : ''}</span></div>
    <small>Смоделированная оценка, не совет. Модуль не видит ваш баланс и не меняет заявку.</small>`;
}
function openExchange() {
  /* сумма плана подставлена в форму (в BYN) — пользователь может её изменить, заявку отправляет сам */
  const isA = S.exPick !== '2', c = calc(); exAmt = c.none || !c.sum ? '' : String(Math.round(c.sum * USD_BYN)); exSide = 'buy';
  exl.innerHTML = `<div class="exwin">
    <div class="exbar"><i>${isA ? '1' : '2'}</i><div class="rt"><b>${EXCH[isA ? '1' : '2']}</b><small>резидент ПВТ · вход и проверка личности на бирже</small></div>
      <button class="back" data-ex="back">${ico('back')}<span class="hide-m">Вернуться в </span>Crypto Analytics</button></div>
    <div class="exbody">
      <div class="exchart"><div class="expair num"><b>BTC/BYN</b><span>${fmt(BTC_BYN)}</span></div>${exChartSVG()}<small style="color:var(--ex-mut)">Демо-экран биржи. Курс условный.</small></div>
      <div class="exform">
        <div class="extabs"><button class="on" data-side="buy">Купить</button><button data-side="sell">Продать</button></div>
        <label class="exfld">Сумма, BYN${exAmt ? ' · подставлена из Crypto Analytics' : ''}<input inputmode="decimal" placeholder="0" data-exin value="${exAmt}"></label>
        <div class="exfld">Получу, BTC<b class="num" id="exBtc">${(num(exAmt) / BTC_BYN).toFixed(6).replace('.', ',')}</b></div>
        ${isA ? `<div class="ourmod" id="ourmod">${exModule()}</div>` : ''}
        <button class="exbtn" data-ex="buy">Купить BTC</button>
        <div class="exzone"><div>${ico('in')}Вход и проверка личности — у биржи</div><div>${ico('wallet')}Деньги, хранение, вывод — у биржи</div><div>${ico('swap')}Сделка и исполнение — у биржи</div></div>
      </div>
    </div></div>`;
  exl.setAttribute('aria-hidden', 'false'); exl.scrollTop = 0;
  requestAnimationFrame(() => exl.classList.add('show'));
}
/* возврат с биржи: биржа подключена на чтение — сумму берём оттуда, иначе спрашиваем (журнал хранит факт, а не план) */
function exBack() {
  closeExchange(); go('journal');
  const id = exReturn, j = S.journal.find(x => x.id === id); exReturn = null;
  if (!j) return;
  const a = Math.round(num(exAmt) / USD_BYN);
  if (S.trades === 'api') { j.invested = a; if (!a) j.kind = 'skip'; save(); render(); return setTimeout(() => toast(a ? `С биржи (только чтение): внесено ${usd(a)}. Итог — ${j.reviewDate}` : 'С биржи: покупки не было'), 420); }
  EXB = { id, inv:String(a || j.plan || '') };
  setTimeout(() => openSheet('exback'), 460);
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
      <button class="nav" data-act="voice">${ico('mic')}Спросить ассистента</button>
      <div class="grow"></div>
      <button class="nav me" data-go="profile"><span class="ava sm">${initial()}</span><span class="rt"><b>Профиль</b><small>${S.email ? esc(S.email) : S.sandbox ? 'песочница' : 'без почты'}</small></span></button>
    </aside>
    <main class="main"><div id="view"></div></main>
    <nav class="dock" aria-label="Разделы">
      <div class="tabs"><span class="ind" aria-hidden="true"></span>${TABS.map(k => `<button class="tab" data-go="${k}">${ico(VIEWS[k].i)}<span>${VIEWS[k].t}</span></button>`).join('')}</div>
      <button class="mic press" data-act="voice" aria-label="Спросить ассистента">${ico('mic')}<span>Спросить</span></button>
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
  return { home:vHome, market:vMarket, journal:vJournal, sum:vSum, digest:vDigest, archive:vArchive, profile:vProfile, alerts:vAlerts, assistant:vAssistant }[S.view]();
}
/* nav: 'push' — вглубь, 'pop' — назад, 'tab' — переключение вкладки (мягкое появление), undefined — обновление на месте */
function renderView(nav) {
  const view = document.getElementById('view');
  const f = document.activeElement, key = f && f.dataset && f.dataset.in, caret = key && f.selectionStart, raw = key && f.value;
  if (nav) fanK = M().k;
  view.innerHTML = `<div class="${nav === 'push' ? 'push' : nav === 'pop' ? 'pop' : nav === 'tab' ? 'fadein' : ''}">${viewHTML()}</div>`;
  swaps(view, !nav);
  if (!nav) morphFan();
  if (key && !sheetType) { const el = view.querySelector(`[data-in="${key}"]`); if (el) { el.value = raw; el.focus({preventScroll:true}); try { el.setSelectionRange(caret, caret); } catch (e) {} } }
  syncChrome();
}
function render(opts = {}) {
  if (S.onb === 'land') { shellOn = false; document.body.classList.remove('docked'); root.innerHTML = vLanding(); return; }
  if (S.onb !== 'done') { shellOn = false; document.body.classList.remove('docked'); root.innerHTML = vOnb(opts.dir); return; }
  if (!shellOn) renderShell();
  renderView(opts.nav);
}
const OLD = { today:'home', scen:'market' };   /* старые ссылки v3 */
function go(v) {
  v = OLD[v] || v;
  if (!VIEWS[v]) return;
  if (location.hash !== '#/' + v) { location.hash = '/' + v; return; }
  show(v);
}
function show(v) {
  const from = VIEWS[S.view] || VIEWS.home, to = VIEWS[v];
  const nav = to.d > from.d ? 'push' : to.d < from.d ? 'pop' : (v === S.view ? undefined : 'tab');
  if (v === 'sum') S.seenSum = true;
  S.view = v; save(); render({ nav: nav || 'tab' }); window.scrollTo({ top:0 });
}
addEventListener('hashchange', () => {
  const v = OLD[location.hash.replace('#/', '')] || location.hash.replace('#/', '');
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
  const c = calc(), date = dShort(0);
  const e = Object.assign({ id:Date.now(), date, kind, plan:c.sum || 0, limit:S.limit, pending:true, reviewDate:dShort(7), sand:S.sandbox, hyp:S.hyp, conf:S.conf, note:S.note }, extra || {});
  /* одно решение на неделю в каждом режиме: новое за сегодня заменяет прежнее */
  const i = S.journal.findIndex(j => j.date === date && j.pending && !j.demo && !!j.sand === S.sandbox);
  if (i >= 0) S.journal[i] = Object.assign(e, { id:S.journal[i].id }); else S.journal.unshift(e);
  if ((kind === 'plan' || kind === 'ex') && !S.sandbox) S.plan = { amount:c.sum, date };
  S.hyp = null; S.conf = null; S.note = ''; S.hypOpen = false; save();
  return e;
}
/* у песочницы и реального режима свои баланс и лимит: переключение ничего не сбрасывает */
function setSandbox(on) {
  if (on === S.sandbox) return;
  S.acc[S.sandbox ? 'sand' : 'real'] = { capital:S.capital, limit:S.limit, limitAuto:S.limitAuto };
  S.sandbox = on;
  const n = S.acc[on ? 'sand' : 'real'] || (() => { const c = walletsTotal() || 1000; return { capital:c, limit:autoLim(c), limitAuto:true }; })();
  Object.assign(S, n); S.pick = 'plan'; S.veil = false;
}
function walletsChanged() {
  const t = walletsTotal();
  if (!S.sandbox) setCapital(t);
  else if (S.acc.real) { S.acc.real.capital = t; if (S.acc.real.limitAuto) S.acc.real.limit = autoLim(t); }
  save();
}
function finishOnb() {
  if (!S.wallets.length) S.wallets.push({ id:'m' + Date.now(), kind:'manual', name:'Мой баланс', bal:S.capital });
  S.realReady = true; S.onb = 'done'; S.view = 'home'; save();
  history.replaceState(null, '', '#/home'); render({ nav:'tab' });
  setTimeout(() => toast(`Баланс ${usd(S.capital)} и лимит ${usd(S.limit)} сохранены`), 200);
}
function toReal() {
  setSandbox(false);
  if (!S.realReady) { S.onb = 0; S.fromSand = true; S.customCap = false; save(); return render({ dir:'fwd' }); }
  save(); render(); toast(`Реальный режим · баланс ${usd(S.capital)}`);
}
const fieldErr = (id, t) => { const e = document.getElementById(id); if (e) e.textContent = t; };
let exReturn = null;
document.addEventListener('click', e => {
  const t = e.target.closest('button,[data-act],summary'); if (!t || exl.contains(t) || t === banner || t.disabled) return;
  const d = t.dataset;
  if (d.term) return openSheet('term', d.term);
  if (d.go) { closeSheet(); if (d.go === 'sum') { S.veil = !!d.veil; save(); } return go(d.go); }
  if (d.seg) { const [k, v] = d.seg.split(':'); S[k] = v; save(); return render(); }
  if (d.sheet) return openSheet(d.sheet);
  if (d.wallet) return openSheet('wallet', d.wallet);
  if (d.coin) return openSheet('coin', +d.coin);
  if (d.pick) { S.pick = d.pick; save(); document.querySelectorAll('[data-pick]').forEach(b => { b.classList.toggle('on', b === t); b.setAttribute('aria-checked', b === t); }); return; }
  if (d.cap) { if (d.cap === 'custom') S.customCap = true; else { S.customCap = false; setCapital(+d.cap); } save(); return render(); }
  if (d.limpct) { S.limit = Math.max(10, Math.round(S.capital * +d.limpct)); S.limitAuto = +d.limpct === LIMIT_PCT; save(); return limChanged(); }
  if (d.themeSet) { setTheme(d.themeSet); t.parentNode.querySelectorAll('button').forEach(b => { b.classList.toggle('on', b === t); b.setAttribute('aria-checked', b === t); }); return; }
  if (d.consent) { S.cons[d.consent] = !S.cons[d.consent]; save(); t.classList.toggle('on', S.cons[d.consent]); t.setAttribute('aria-checked', S.cons[d.consent]); const ok = document.querySelector('[data-act="consentok"]'); if (ok) ok.disabled = !(S.cons.model && S.cons.loss && S.country); return; }
  if (d.onb !== undefined) { S.onb = +d.onb; save(); return render({ dir: d.back !== undefined ? 'bwd' : 'fwd' }); }
  if (d.country) { S.country = d.country; save(); return refreshSheet(); }
  if (d.alert) return openSheet('alert', d.alert);
  if (d.factor) return openSheet('factor', d.factor);
  if (d.changer) return openSheet('changer', d.changer);
  if (d.news) return openSheet('news', +d.news);
  if (d.jitem) return openSheet('jitem', +d.jitem);
  if (d.review) { const j = S.journal.find(x => x.id === +d.review); closeSheet(); RV = { id:+d.review, step:0, inv:String(j.invested ?? j.plan ?? ''), notIn:false, conf:null, miss:'' }; return setTimeout(() => openSheet('review'), sheetType ? 280 : 0); }
  if (d.exgo) {
    S.exPick = d.exgo; const j = record('ex', { ex:d.exgo }); exReturn = j.id;
    closeSheet(); render(); return setTimeout(openExchange, 160);
  }
  if (d.exinv !== undefined) { EXB.inv = d.exinv; const i = document.getElementById('exInv'); if (i) i.value = d.exinv; return; }
  if (d.wi) { WI = WI === d.wi ? null : d.wi; return refreshSheet(); }
  if (d.hyp) { S.hyp = S.hyp === d.hyp ? null : d.hyp; save(); return render(); }
  if (d.conf) { S.conf = S.conf === +d.conf ? null : +d.conf; save(); return render(); }
  if (d.rv) { RV.notIn = !RV.notIn; if (RV.notIn) RV.inv = ''; return refreshSheet(); }
  if (d.rvconf !== undefined) { RV.conf = +d.rvconf; return refreshSheet(); }
  if (d.tog !== undefined && d.tog) { S.set[d.tog] = !S.set[d.tog]; save(); t.setAttribute('aria-checked', S.set[d.tog]); return; }
  if (d.max) { S.set.maxDay = +d.max; save(); t.parentNode.querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c === t)); return; }
  if (d.perm) { S.apiPerm[d.perm] = !S.apiPerm[d.perm]; t.setAttribute('aria-checked', S.apiPerm[d.perm]); sheet.querySelector('#apiErr').innerHTML = ''; return; }
  if (d.ask) return ask(d.ask);
  if (d.model) { AI.model = d.model; saveAI(); return render(); }
  switch (d.act) {
    case 'close': return closeSheet();
    case 'back': { const to = d.to || VIEWS[S.view].up || 'home'; return go(to); }
    /* вход: песочница — сразу в приложение, без почты и согласий */
    case 'sandstart': setSandbox(true); S.onb = 'done'; S.view = 'home'; save(); history.replaceState(null, '', '#/home'); render({ nav:'tab' }); return setTimeout(() => toast(`Песочница: виртуальные ${usd(S.capital)}`), 200);
    case 'login': S.fromSand = false; setSandbox(false); if (!S.capital) setCapital(1000); S.onb = 0; save(); history.replaceState(null, '', location.pathname); return render({ dir:'fwd' });
    case 'toland': if (S.fromSand) { S.fromSand = false; setSandbox(true); S.onb = 'done'; } else S.onb = 'land'; save(); return render({ nav:'tab' });
    case 'onbfinish': if (!emailOk(S.email)) { fieldErr('emErr', S.email.trim() ? 'Похоже, в адресе ошибка. Пример: name@mail.by' : 'Введите почту или нажмите «Позже»'); document.getElementById('emBox')?.classList.add('bad'); return; } return finishOnb();
    case 'onblater': S.email = ''; return finishOnb();
    case 'emailsave': if (!emailOk(S.email)) { fieldErr('emErr', S.email.trim() ? 'Похоже, в адресе ошибка. Пример: name@mail.by' : 'Введите почту'); document.getElementById('emBox')?.classList.add('bad'); return; } closeSheet(); save(); render(); return toastSoon('Почта сохранена');
    case 'sandtog': closeSheet(); if (S.sandbox) return toReal(); setSandbox(true); save(); render(); return toastSoon(`Песочница: виртуальные ${usd(S.capital)}`);
    case 'sandreset': closeSheet(); S.capital = SAND_CAP; S.limit = autoLim(SAND_CAP); S.limitAuto = true; S.journal = S.journal.filter(j => !j.sand); save(); render(); return toastSoon(`Песочница сброшена: ${usd(SAND_CAP)}`);
    /* итог в песочнице сразу — на данных прошлой недели; виртуальный баланс меняется на результат */
    case 'sandff': {
      closeSheet(); const P = S.journal.filter(j => j.sand && j.pending);
      if (!P.length) return go(lastResult() ? 'digest' : 'sum');
      P.forEach(j => { resolve(j, j.kind === 'plan' || j.kind === 'ex' ? j.plan : 0); if (j.result.amt) S.capital += j.result.end; });
      save(); go('digest'); return toastSoon('Итог посчитан на данных прошлой недели');
    }
    case 'decide': {
      const k = calc().none && S.pick === 'plan' ? 'watch' : S.pick, j = record(k, k === 'plan' ? {} : { invested:0 });
      toast(k === 'plan' ? (S.sandbox ? 'Записано в песочницу. Итог можно посмотреть сразу' : `План ${usd(j.plan)} записан. Итог — ${j.reviewDate}`) : k === 'watch' ? 'Записали: пока смотрите' : 'Записали пропуск. Сравним через неделю');
      return go('journal');
    }
    case 'unveil': { S.veil = false; save(); const v = document.getElementById('veil'); if (v && !reduce()) { v.classList.add('out'); return setTimeout(render, 260); } return render(); }
    case 'recalc': closeSheet(); S.veil = false; return go('sum');
    case 'alerttog': t.setAttribute('aria-checked', !S.alertOn); return setAlert(!S.alertOn);
    case 'nosig': S.noSignal = !S.noSignal; save(); render(); return toast(S.noSignal ? 'Модель молчит: сумма — «Без позиции»' : 'Данные вернулись');
    case 'demotog': {
      S.demo = !S.demo; S.journal = S.journal.filter(j => !j.demo);
      if (S.demo) { S.journal = S.journal.concat(DEMO_J()); if (!S.plan) S.plan = { amount:3467, date:'5 окт.', demo:true }; S.alertOn = true; }
      else { if (S.plan && S.plan.demo) S.plan = null; S.alertOn = false; }
      save(); render(); return toast(S.demo ? 'Пример с историей включён' : 'Пример убран — снова чистый старт');
    }
    case 'ffweek': {
      let n = 0; realJ().filter(j => j.pending).forEach(j => { n++; if (j.kind === 'plan' || j.kind === 'ex') { j.pending = false; j.due = true; } else resolve(j, 0); });
      save(); render(); return toast(n ? 'Прошла неделя (демо): посмотрите, как сыграли решения' : 'Нет решений, которые ждут итога');
    }
    case 'testbanner': return alertBanner();
    case 'rangetip': S.rangeTip = true; save(); return render();
    case 'soon': return toast('Скоро. Пока модель проверена только на биткоине и сроке 7 дней');
    case 'reset': try { localStorage.removeItem(KEY); } catch (e) {} S = DEFAULT(); closeSheet(); fanDrawn = false; history.replaceState(null, '', location.pathname); Object.keys(shown).forEach(k => delete shown[k]); try { sessionStorage.removeItem('ca-intro'); } catch (e) {} render(); return runIntro();
    case 'voice': return openSheet('voice');
    case 'voiceok': setCapital(+d.pcap); S.limit = +d.plim; S.limitAuto = S.limit === autoLim(S.capital); S.veil = false; save(); closeSheet(); toastSoon(`Поняли: ${usd(S.capital)}, готовы потерять ${usd(S.limit)}`); return go('sum');
    case 'listen': return listen(t);
    case 'aisave': { AI.key = (document.getElementById('aiKey')?.value || '').trim(); AI.proxy = (document.getElementById('aiProxy')?.value || '').trim(); const cm = (document.getElementById('aiModel')?.value || '').trim(); if (cm) AI.model = cm; saveAI(); render(); return toast(aiLive() ? 'Ассистент подключён: ' + modelName() : 'Ассистент в демо-режиме'); }
    case 'aiclear': AI = { key:'', proxy:'', model:MODELS[0].id }; saveAI(); render(); return toast('Ключ удалён из браузера');
    case 'hyp': S.hypOpen = !S.hypOpen; save(); return render();
    case 'toex': if (S.sandbox) return toast('В песочнице биржи нет: деньги виртуальные'); return openSheet('exit');
    case 'consentok': if (!(S.cons.model && S.cons.loss && S.country)) return; S.consent = { version:TERMS_VERSION, at:new Date().toISOString() }; save(); return refreshSheet();
    case 'exsave': {
      const j = S.journal.find(x => x.id === EXB.id), v = num(document.getElementById('exInv')?.value ?? EXB.inv);
      if (j) { j.invested = v; if (!v) j.kind = 'skip'; } save(); closeSheet(); render(); return toastSoon(v ? `Записали: ${usd(v)} на бирже. Итог — ${j ? j.reviewDate : dShort(7)}` : 'Записали: покупки не было');
    }
    case 'totrades': S.jseg = 'trades'; save(); return go('journal');
    case 'rvnext': {
      const j = S.journal.find(x => x.id === RV.id);
      if (RV.step === 0 && !RV.notIn && !num(RV.inv)) RV.notIn = true;
      if (RV.step < 2) { RV.step++; return refreshSheet(); }
      resolve(j, RV.notIn ? 0 : num(RV.inv)); if (RV.miss) j.note = RV.miss;
      save(); closeSheet(); go('digest'); return toastSoon('Итог сохранён');
    }
    case 'manualadd': {
      const v = num(document.getElementById('wNew')?.value); if (v <= 0) return fieldErr('wErr', 'Введите сумму больше нуля');
      S.wallets.push({ id:'m' + Date.now(), kind:'manual', name:S.wallets.some(w => w.kind === 'manual') ? 'Отложено' : 'Мой баланс', bal:Math.round(v) });
      walletsChanged(); closeSheet(); render(); return toastSoon(`Кошелёк добавлен · для расчёта ${usd(S.capital)}`);
    }
    case 'addrconnect': {
      const a = (document.getElementById('wAddr')?.value || '').trim();
      if (!/^(bc1[a-z0-9]{25,62}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/.test(a)) return fieldErr('wErr', 'Это не похоже на адрес биткоин-кошелька. Он начинается с bc1, 1 или 3');
      S.wallets.push({ id:'a' + Date.now(), kind:'address', name:'Адрес …' + a.slice(-4), btc:0.0142, bal:Math.round(0.0142 * PRICE) });
      walletsChanged(); closeSheet(); render(); return toastSoon('Адрес подключён только на чтение');
    }
    case 'wdel': { const w = S.wallets.find(x => x.id === d.w); S.wallets = S.wallets.filter(x => x.id !== d.w); if (w && w.kind === 'exchange') S.trades = false; walletsChanged(); closeSheet(); render(); return toastSoon(w && w.kind !== 'manual' ? 'Отключено' : 'Кошелёк удалён'); }
    case 'api': return openSheet('api');
    case 'apiconnect': {
      const p = S.apiPerm, err = sheet.querySelector('#apiErr');
      if (p.trade || p.withdraw) { err.innerHTML = `<div class="legal"><b>Ключ отклонён.</b> У него есть право ${[p.trade && 'торговли', p.withdraw && 'вывода'].filter(Boolean).join(' и ')}. Создайте на бирже ключ только на чтение.</div>`; return; }
      if (!p.read) { err.innerHTML = '<div class="legal"><b>Не хватает права на чтение.</b></div>'; return; }
      S.trades = 'api';
      if (!S.wallets.some(w => w.kind === 'exchange')) S.wallets.push({ id:'x1', kind:'exchange', name:EXCH['1'], bal:1240 });
      walletsChanged(); closeSheet(); render(); return toastSoon('Подключено только на чтение · баланс и 14 сделок');
    }
    case 'csv': S.trades = 'csv'; save(); toast('Файл загружен · 14 сделок'); return render();
    case 'untrades': S.trades = false; save(); toast('Источник сделок отключён'); return render();
  }
});
/* лимит поменялся с чипа или ползунка: обновляем открытые поля без перерисовки листа */
function limChanged() {
  const b = document.getElementById('limBig'); if (b) b.textContent = usd(S.limit);
  const p = document.getElementById('onbPct'); if (p) p.textContent = limPct() + ' · обычно выбирают 3–10%';
  const r = sheet.querySelector('[data-in="limit"]'); if (r) r.value = S.limit;
  const li = document.querySelectorAll('[data-in="lim"]'); li.forEach(x => { if (x !== document.activeElement) x.value = S.limit; });
  document.querySelectorAll('[data-limpct]').forEach(c => c.classList.toggle('on', Math.max(10, Math.round(S.capital * +c.dataset.limpct)) === S.limit));
  calcLive();
  if (S.onb === 'done') render();
}
function calcLive() { const r = document.getElementById('calcRes'); if (r) r.innerHTML = calcRes(calc()); }
document.addEventListener('input', e => {
  const k = e.target.dataset.in; if (!k) return;
  const v = e.target.value;
  if (k === 'cap') { setCapital(num(v)); const l = sheet.querySelector('[data-in="lim"]'); if (l && S.limitAuto) l.value = S.limit; }
  else if (k === 'lim') { S.limit = Math.max(10, Math.round(num(v)) || 10); S.limitAuto = false; }
  else if (['stop','fee','slip','pos'].includes(k)) { S[k] = v.trim(); }
  else if (k === 'note') { S.note = v; save(); return; }
  else if (k === 'customcap') { setCapital(num(v) || 1000); save(); const c = document.getElementById('onbCap'); if (c) c.textContent = usd(S.capital); return; }
  else if (k === 'email') { S.email = v; save(); fieldErr('emErr', ''); document.getElementById('emBox')?.classList.remove('bad'); return; }
  else if (k === 'limit') { S.limit = +v; S.limitAuto = false; save(); return limChanged(); }
  else if (k === 'wbal') { const w = S.wallets.find(x => x.id === e.target.dataset.w); if (w) { w.bal = Math.max(0, Math.round(num(v))); walletsChanged(); render(); } return; }
  else if (k === 'exinv') { EXB.inv = v; return; }
  else if (k === 'rvinv') { RV.inv = v; if (num(v)) RV.notIn = false; return; }
  else if (k === 'rvmiss') { RV.miss = v; return; }
  save(); calcLive();
  if (sheetType === 'calc') sheet.querySelectorAll('[data-limpct]').forEach(c => c.classList.toggle('on', Math.max(10, Math.round(S.capital * +c.dataset.limpct)) === S.limit));
  render();
});
document.addEventListener('toggle', e => { if (e.target.classList && e.target.classList.contains('more2')) { S.moreOpen = e.target.open; save(); } }, true);
document.addEventListener('change', e => { if (e.target.dataset.sel === 'country') { S.country = e.target.value || null; save(); render(); } });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { if (sheetType) return closeSheet(); if (exl.classList.contains('show')) return exBack(); }
  if (e.key === 'Enter' && e.target.matches && e.target.matches('.inp input[enterkeyhint="done"]')) e.target.blur();
});

/* живая цена: обновляем только текст цены и «N мин назад», экран не перерисовываем */
function updateLive() {
  document.querySelectorAll('[data-live="price"]').forEach(el => { el.textContent = usd(LIVE); if (!reduce()) { el.classList.remove('tick'); void el.offsetWidth; el.classList.add('tick'); } });
  document.querySelectorAll('[data-live="chg"]').forEach(el => { const c = live24(); el.textContent = chg(c) + (el.dataset.suf || ''); el.classList.toggle('up', c > 0); el.classList.toggle('dn', c < 0); });
  updateAgo();
}
function updateAgo() { document.querySelectorAll('[data-ago]').forEach(el => { el.textContent = ago(); }); }
setInterval(() => { if (document.hidden) return; LIVE = Math.round(PRICE * (1 + (Math.random() - 0.5) * 0.003)); liveAt = Date.now(); updateLive(); }, 15000);
setInterval(updateAgo, 30000);

/* ---------- старт ---------- */
document.body.append(layer, banner, toastEl, exl);
addEventListener('resize', () => { if (shellOn) syncChrome(); });
/* заставка перед стартовым экраном: слова по одному, затем рисуется логотип.
   Один раз за сессию, только CSS-анимации; клик или клавиша пропускают; при «уменьшить движение» не показывается. */
function runIntro() {
  if (S.onb !== 'land' || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  try { if (sessionStorage.getItem('ca-intro')) return; sessionStorage.setItem('ca-intro', '1'); } catch (e) {}
  const el = document.createElement('div');
  el.className = 'intro'; el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `<div class="intro-stage">${['Баланс.', 'Лимит.', 'Сумма.', 'Решение.'].map((w, i) => `<span class="iw${i === 3 ? ' acc' : ''}" style="--i:${i}">${w}</span>`).join('')}
    <span class="ib"><svg viewBox="0 0 24 24"><path d="M3 17l5-6 4 3 7-9" pathLength="1"/></svg>Crypto Analytics</span></div>
    <button class="intro-skip" type="button" tabindex="-1">Пропустить</button>`;
  document.body.append(el);
  let done = false;
  const start = () => { if (done) return; done = true; document.removeEventListener('keydown', skip, true); if (S.onb === 'land') { landReveal = true; render(); landReveal = false; } };
  const skip = () => { if (!el.isConnected) return; start(); const a = el.animate([{ opacity:getComputedStyle(el).opacity }, { opacity:0 }], { duration:300, easing:'cubic-bezier(.23,1,.32,1)', fill:'forwards' }); a.onfinish = () => el.remove(); };
  el.addEventListener('animationstart', e => { if (e.target === el && e.animationName === 'introOut') start(); });
  el.addEventListener('animationend', e => { if (e.target === el && e.animationName === 'introOut') el.remove(); });
  el.addEventListener('click', skip);
  document.addEventListener('keydown', skip, true);
}

const startV = OLD[location.hash.replace('#/', '')] || location.hash.replace('#/', '');
if (!VIEWS[S.view]) S.view = 'home';
if (S.onb === 'done' && VIEWS[startV]) S.view = startV;
if (S.onb === 'done') history.replaceState(null, '', '#/' + S.view);
render({ nav:'tab' });
runIntro();
