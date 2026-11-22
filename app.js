// Australia in Data — linked-filter dashboard. Data: data/dashboard.json (pipeline/fetch_real.py)
const $ = id => document.getElementById(id);
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const tip = $('tip');
const STATES = ['AUS', 'NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'];
const NAMES = { AUS: 'Australia', NSW: 'New South Wales', VIC: 'Victoria', QLD: 'Queensland', WA: 'Western Australia',
  SA: 'South Australia', TAS: 'Tasmania', ACT: 'ACT', NT: 'Northern Territory' };
// Tile-map grid positions [col, row], roughly geographic.
const TILES = { NT: [1, 0], QLD: [2, 0], WA: [0, 1], SA: [1, 1], NSW: [2, 1], ACT: [3, 1], VIC: [2, 2], TAS: [2, 3] };
const S = { state: 'VIC', from: 1910, to: 2025, metric: 'warm' };
let D, charts = {};

const f1 = v => (v > 0 ? '+' : '') + v.toFixed(1);
const f2 = v => (v > 0 ? '+' : '') + v.toFixed(2);
const mean = a => a.reduce((s, v) => s + v, 0) / (a.length || 1);
const fmtPop = v => v >= 1e6 ? (v / 1e6).toFixed(2) + 'M' : Math.round(v / 1e3) + 'k';

function hexMix(a, b, t) {
  const p = h => { h = h.replace('#', ''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); };
  const x = p(a), y = p(b);
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('');
}
function showTip(e, html) { tip.innerHTML = html; tip.style.display = 'block';
  const x = Math.min(e.clientX + 14, innerWidth - tip.offsetWidth - 8); tip.style.left = x + 'px'; tip.style.top = e.clientY + 14 + 'px'; }
const hideTip = () => tip.style.display = 'none';
// Touch devices fire a synthetic hover on tap but never a matching "leave", so the fixed-position
// tooltip would stay on screen and ride along while scrolling. Hide it on scroll and on any tap elsewhere.
addEventListener('scroll', hideTip, { passive: true });
addEventListener('pointerdown', e => { if (!e.target.closest('#stripes, #tilemap .tile')) hideTip(); }, { passive: true });
let tipTimer;
const autoHide = e => { if (e.pointerType && e.pointerType !== 'mouse') { clearTimeout(tipTimer); tipTimer = setTimeout(hideTip, 1600); } };

// ---------- derived metrics ----------
function climateSeries(st) { return D.climate[st].filter(([y]) => y >= S.from && y <= S.to); }
function warming(st) {
  const s = climateSeries(st).map(r => r[1]); const n = Math.min(10, Math.floor(s.length / 2));
  return n ? mean(s.slice(-n)) - mean(s.slice(0, n)) : 0;
}
function wageWindow() { return [Math.max(S.from, 2005), Math.min(S.to, 2025)]; }
function growthPct(series) { const [a, b] = wageWindow(); return series[a] && series[b] ? (series[b] / series[a] - 1) * 100 : 0; }
const metricVal = { warm: st => warming(st), pop: st => D.population.states[st].growth, wage: st => growthPct(D.wages[st]) };
const metricFmt = { warm: v => f2(v) + '°C', pop: v => f2(v) + '%', wage: v => f1(v) + '%' };
const metricHue = { warm: '--warm', pop: '--series-1', wage: '--series-3' };

// ---------- state & URL ----------
function readHash() {
  const h = new URLSearchParams(location.hash.slice(1));
  if (STATES.includes(h.get('state'))) S.state = h.get('state');
  const a = +h.get('from'), b = +h.get('to');
  if (a >= 1910 && b <= 2025 && a < b) { S.from = a; S.to = b; }
  if (metricVal[h.get('m')]) S.metric = h.get('m');
}
function writeHash() { history.replaceState(null, '', `#state=${S.state}&from=${S.from}&to=${S.to}&m=${S.metric}`); }
function set(patch) { Object.assign(S, patch); writeHash(); render(); }

// ---------- filters ----------
function buildFilters() {
  $('chips').innerHTML = STATES.map(s => `<button data-s="${s}">${s}</button>`).join('');
  $('chips').onclick = e => { const b = e.target.closest('button'); if (b) set({ state: b.dataset.s }); };
  const from = $('from'), to = $('to');
  const onRange = () => { let a = +from.value, b = +to.value; if (a > b - 5) { if (document.activeElement === from) a = b - 5; else b = a + 5; }
    set({ from: Math.max(1910, a), to: Math.min(2025, b) }); };
  from.oninput = to.oninput = onRange;
  document.querySelectorAll('.presets button').forEach(b => b.onclick = () => { const [a, c] = b.dataset.p.split(',').map(Number); set({ from: a, to: c }); });
  $('metricSeg').onclick = e => { const b = e.target.closest('button'); if (b) set({ metric: b.dataset.m }); };
}

// ---------- tile map ----------
function renderMap() {
  const vals = Object.keys(TILES).map(s => metricVal[S.metric](s));
  const lo = Math.min(...vals), hi = Math.max(...vals), hue = css(metricHue[S.metric]), base = css('--ramp-lo');
  const size = 96, gap = 6, ox = 14, oy = 6;
  $('tilemap').innerHTML = Object.entries(TILES).map(([s, [c, r]]) => {
    const v = metricVal[S.metric](s), t = hi > lo ? (v - lo) / (hi - lo) : 1;
    const fill = hexMix(base, hue, 0.2 + 0.8 * t), ink = t > 0.55 ? '#ffffff' : css('--text-primary');
    const x = ox + c * (size + gap), y = oy + r * (size * 0.78 + gap), h = size * 0.78;
    return `<g class="tile${S.state === s ? ' on' : ''}" data-s="${s}" tabindex="0" role="button" aria-label="${NAMES[s]} ${metricFmt[S.metric](v)}">
      <rect x="${x}" y="${y}" width="${size}" height="${h}" rx="12" fill="${fill}"/>
      <text x="${x + 12}" y="${y + 26}" font-size="15" font-weight="700" fill="${ink}">${s}</text>
      <text x="${x + 12}" y="${y + h - 14}" font-size="13" font-weight="500" fill="${ink}" opacity=".9">${metricFmt[S.metric](v)}</text></g>`;
  }).join('');
  $('tilemap').querySelectorAll('.tile').forEach(g => {
    g.onclick = () => set({ state: S.state === g.dataset.s ? 'AUS' : g.dataset.s });
    g.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); g.onclick(); } };
    g.onpointermove = e => { if (e.pointerType === 'mouse') showTip(e, `<b>${NAMES[g.dataset.s]}</b><br>${$('metricSeg').querySelector('.on').textContent}: ${metricFmt[S.metric](metricVal[S.metric](g.dataset.s))}`); };
    g.onpointerleave = hideTip;
  });
  $('ramp').style.background = `linear-gradient(90deg, ${hexMix(base, hue, .2)}, ${hue})`;
  $('rampMin').textContent = metricFmt[S.metric](lo); $('rampMax').textContent = metricFmt[S.metric](hi);
}

// ---------- KPIs ----------
function spark(points, color) {
  const ys = points.map(p => p[1]), lo = Math.min(...ys), hi = Math.max(...ys), w = 200, h = 36;
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${(i / (points.length - 1) * w).toFixed(1)},${(h - 4 - (p[1] - lo) / ((hi - lo) || 1) * (h - 8)).toFixed(1)}`).join('');
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><path d="${d}" fill="none" stroke="${color}" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linecap="round"/></svg>`;
}
function renderKpis() {
  const st = S.state, p = D.population.states[st], [wa, wb] = wageWindow();
  const w = warming(st), rent = growthPct(D.rents), wage = growthPct(D.wages[st]);
  const cs = climateSeries(st);
  $('kpis').innerHTML = `
    <div class="kpi wide"><span class="k-l">${NAMES[st]} · ${S.from}–${S.to}</span>
      <span class="k-v" style="color:${w > 0 ? css('--warm') : css('--cool')}">${f2(w)}°C</span>
      <span class="k-s">warming: last decade of the window vs first decade${st === 'ACT' ? ' (NSW series)' : ''}</span>${spark(cs, css('--warm'))}</div>
    <div class="kpi"><span class="k-l">Population</span><span class="k-v">${fmtPop(p.erp)}</span>
      <span class="k-s">${f2(p.growth)}% in the year to ${D.population.period}</span>${spark(p.trend, css('--series-1'))}</div>
    <div class="kpi"><span class="k-l">Rents vs wages ${wa}–${wb}</span><span class="k-v">${f1(rent - wage)} pts</span>
      <span class="k-s">rents ${f1(rent)}% · ${st} wages ${f1(wage)}%</span></div>`;
}

// ---------- chart helpers ----------
function base(extra = {}) {
  const grid = css('--line-soft'), ink = css('--text-muted');
  const o = {
    responsive: true, maintainAspectRatio: false, animation: { duration: 500, easing: 'easeOutQuart' },
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { position: 'top', align: 'end', labels: { color: css('--text-secondary'), usePointStyle: true, pointStyle: 'line', boxWidth: 18, font: { size: 12 } } },
      tooltip: { backgroundColor: css('--surface-2'), titleColor: css('--text-primary'), bodyColor: css('--text-secondary'), borderColor: css('--line'), borderWidth: 1, padding: 10, boxPadding: 4, usePointStyle: true }
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: ink, maxTicksLimit: 9, maxRotation: 0 }, border: { color: css('--line') } },
      y: { grid: { color: grid }, ticks: { color: ink }, border: { display: false } }
    }
  };
  return deepMerge(o, extra);
}
function deepMerge(a, b) { for (const k in b) a[k] = b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) ? deepMerge(a[k] || {}, b[k]) : b[k]; return a; }
function upsert(key, canvas, cfg) {
  if (charts[key]) { charts[key].data = cfg.data; charts[key].options = cfg.options; charts[key].update(); }
  else charts[key] = new Chart($(canvas), cfg);
}
function rolling(arr, n = 10) { return arr.map((_, i) => i < n - 1 ? null : mean(arr.slice(i - n + 1, i + 1))); }
// vertical crosshair on hover for line charts
const crosshair = { id: 'crosshair', afterDatasetsDraw(c) {
  const a = c.tooltip?.getActiveElements?.(); if (!a?.length || c.config.type !== 'line') return;
  const x = a[0].element.x, { top, bottom } = c.chartArea, ctx = c.ctx;
  ctx.save(); ctx.strokeStyle = css('--text-muted'); ctx.globalAlpha = .5; ctx.setLineDash([3, 3]);
  ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bottom); ctx.stroke(); ctx.restore(); } };
Chart.register(crosshair);

// ---------- climate ----------
function buildStripes() {
  const el = $('stripes'); let dragFrom = null;
  const yearAt = e => { const r = el.getBoundingClientRect(); return 1910 + Math.round(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * 115); };
  el.onpointerdown = e => { dragFrom = yearAt(e); el.setPointerCapture(e.pointerId); };
  el.onpointermove = e => {
    const y = yearAt(e), row = D.climate[S.state].find(r => r[0] === y);
    if (dragFrom !== null) { const a = Math.min(dragFrom, y), b = Math.max(dragFrom, y); if (b - a >= 5) set({ from: a, to: b }); }
    if (row) showTip(e, `<b>${y}</b> · ${f2(row[1])}°C vs ${D.baseline}`);
  };
  el.onpointerup = el.onpointercancel = e => { dragFrom = null; autoHide(e); };
  el.onpointerleave = e => { if (e.pointerType === 'mouse') hideTip(); };
}
function renderClimate() {
  const st = S.state, all = D.climate[st], max = Math.max(...all.map(r => Math.abs(r[1])));
  $('stripes').innerHTML = all.map(([y, a]) => {
    const t = Math.min(Math.abs(a) / max, 1), c = hexMix(css('--mid'), a > 0 ? css('--warm') : css('--cool'), t);
    return `<div style="background:${c}" class="${y < S.from || y > S.to ? 'out' : ''}"></div>`;
  }).join('');
  $('climateTitle').textContent = `${NAMES[st]} is ${warming(st) >= 0 ? 'warming' : 'cooling'}`;
  // rolling mean computed on full series so the window edges stay accurate
  const roll = rolling(all.map(r => r[1])), inWin = all.map(([y]) => y >= S.from && y <= S.to);
  const pick = arr => arr.filter((_, i) => inWin[i]);
  const ds = [
    { label: `${st} annual`, data: pick(all.map(r => r[1])), borderColor: css('--series-1') + '66', borderWidth: 1.5, pointRadius: 0, tension: .2 },
    { label: `${st} 10-yr average`, data: pick(roll), borderColor: css('--series-1'), borderWidth: 3, pointRadius: 0, tension: .3 },
  ];
  if (st !== 'AUS') {
    const ar = rolling(D.climate.AUS.map(r => r[1]));
    ds.push({ label: 'Australia 10-yr average', data: pick(ar), borderColor: css('--ghost'), borderWidth: 2, borderDash: [5, 4], pointRadius: 0, tension: .3 });
  }
  upsert('climate', 'climateChart', { type: 'line', data: { labels: pick(all.map(r => r[0])), datasets: ds },
    options: base({ scales: { y: { ticks: { callback: v => f1(v) + '°' } } },
      plugins: { tooltip: { callbacks: { label: c => c.raw == null ? null : ` ${c.dataset.label}: ${f2(c.raw)}°C` } } } }) });
  const rows = climateSeries(st), hot = [...rows].sort((a, b) => b[1] - a[1]).slice(0, 3).map(r => r[0]);
  $('climateFinding').innerHTML = `Between ${S.from} and ${S.to}, ${NAMES[st]} warmed by <b>${f2(warming(st))}°C</b> (last decade vs first). Hottest years in the window: <b>${hot.join(', ')}</b>.`;
}

// ---------- pyramid ----------
function renderPyramid() {
  const st = S.state, p = D.population.states[st], au = D.population.states.AUS;
  const share = (src) => { const tot = src.pyramid.reduce((s, r) => s + r[1] + r[2], 0); return src.pyramid.map(r => [r[0], r[1] / tot * 100, r[2] / tot * 100]); };
  const sp = share(p).reverse(), sa = share(au).reverse();
  const labels = sp.map(r => r[0].replace(' and over', '+'));
  const ds = [
    { label: 'Males', data: sp.map(r => -r[1]), backgroundColor: css('--series-1'), borderRadius: 3, barPercentage: .92, categoryPercentage: 1, order: 2 },
    { label: 'Females', data: sp.map(r => r[2]), backgroundColor: css('--series-3'), borderRadius: 3, barPercentage: .92, categoryPercentage: 1, order: 2 },
  ];
  if (st !== 'AUS') {
    ds.push({ label: 'Australia', data: sa.map(r => -r[1]), backgroundColor: 'transparent', borderColor: css('--text-primary'), borderWidth: 1.2, borderRadius: 3, barPercentage: .92, categoryPercentage: 1, order: 1, grouped: false });
    ds.push({ label: '_au', data: sa.map(r => r[2]), backgroundColor: 'transparent', borderColor: css('--text-primary'), borderWidth: 1.2, borderRadius: 3, barPercentage: .92, categoryPercentage: 1, order: 1, grouped: false });
  }
  ds.forEach(d => d.grouped = false);
  upsert('pyr', 'pyrChart', { type: 'bar', data: { labels, datasets: ds },
    options: base({ indexAxis: 'y', interaction: { mode: 'index', intersect: false },
      scales: { x: { grid: { display: true, color: css('--line-soft') }, ticks: { callback: v => Math.abs(v).toFixed(0) + '%' } }, y: { grid: { display: false }, ticks: { font: { size: 10 } } } },
      plugins: { legend: { labels: { pointStyle: 'rectRounded', filter: i => i.text !== '_au' } },
        tooltip: { callbacks: { title: c => `Age ${c[0].label}`, label: c => c.dataset.label === '_au' ? ` Australia (F): ${Math.abs(c.raw).toFixed(2)}%` : ` ${c.dataset.label}${c.dataset.label === 'Australia' ? ' (M)' : ''}: ${Math.abs(c.raw).toFixed(2)}%` } } } }) });
  const under25 = r => r.slice(0, 5).reduce((s, x) => s + x[1] + x[2], 0), over65 = r => r.slice(13).reduce((s, x) => s + x[1] + x[2], 0);
  const sNat = share(p), aNat = share(au);
  $('pyrTitle').textContent = `Who lives in ${NAMES[st]}`;
  $('pyrSrc').textContent = `ABS ERP · ${D.population.period}`;
  $('pyrFinding').innerHTML = `<b>${under25(sNat).toFixed(1)}%</b> are under 25 and <b>${over65(sNat).toFixed(1)}%</b> are 65+` +
    (st === 'AUS' ? '.' : ` (Australia: ${under25(aNat).toFixed(1)}% and ${over65(aNat).toFixed(1)}%).`);
}

// ---------- rents vs wages ----------
function renderRent() {
  const st = S.state, [a, b] = wageWindow(), yrs = [];
  for (let y = a; y <= b; y++) yrs.push(y);
  const idx = s => yrs.map(y => s[y] / s[a] * 100);
  const ds = [
    { label: 'Rents (8 capitals)', data: idx(D.rents), borderColor: css('--series-2'), borderWidth: 2.5, pointRadius: 0, tension: .3 },
    { label: `Wages (${st})`, data: idx(D.wages[st]), borderColor: css('--series-1'), borderWidth: 2.5, pointRadius: 0, tension: .3 },
  ];
  if (st !== 'AUS') ds.push({ label: 'Wages (AUS)', data: idx(D.wages.AUS), borderColor: css('--ghost'), borderWidth: 1.5, borderDash: [5, 4], pointRadius: 0, tension: .3 });
  upsert('rent', 'rentChart', { type: 'line', data: { labels: yrs, datasets: ds },
    options: base({ plugins: { tooltip: { callbacks: { label: c => ` ${c.dataset.label}: ${c.raw.toFixed(1)}` } } } }) });
  const r = growthPct(D.rents), w = growthPct(D.wages[st]);
  $('rentFinding').innerHTML = b - a < 1 ? 'Choose a window that includes 2005–2025 to compare rents and wages.' :
    `From ${a} to ${b}, rents rose <b>${r.toFixed(0)}%</b> while ${st} wages rose <b>${w.toFixed(0)}%</b>: renting got ${r > w ? '<b>less</b>' : '<b>more</b>'} affordable.`;
}

// ---------- momentum ----------
function renderMomentum() {
  const labels = D.population.states.AUS.trend.map(t => t[0].replace('-', ' '));
  const order = STATES.filter(s => s !== S.state).concat(S.state);
  const ds = order.map(s => {
    const on = s === S.state;
    return { label: s, data: D.population.states[s].trend.map(t => t[1]), borderColor: on ? css('--series-1') : css('--ghost') + '88',
      borderWidth: on ? 3.5 : 1.5, pointRadius: on ? 3 : 0, pointHoverRadius: 5, pointBackgroundColor: css('--series-1'), tension: .3 };
  });
  upsert('mom', 'momChart', { type: 'line', data: { labels, datasets: ds },
    options: base({ interaction: { mode: 'nearest', intersect: false, axis: 'xy' },
      onClick: (e, els) => { if (els.length) set({ state: charts.mom.data.datasets[els[0].datasetIndex].label }); },
      onHover: (e, els) => e.native.target.style.cursor = els.length ? 'pointer' : 'default',
      scales: { y: { ticks: { callback: v => v.toFixed(1) + '%' } } },
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ` ${NAMES[c.dataset.label]}: ${c.raw.toFixed(2)}%` } } } }) });
}

// ---------- render ----------
function render() {
  document.querySelectorAll('#chips button').forEach(b => b.classList.toggle('on', b.dataset.s === S.state));
  document.querySelectorAll('#metricSeg button').forEach(b => b.classList.toggle('on', b.dataset.m === S.metric));
  $('from').value = S.from; $('to').value = S.to;
  $('rangeLabel').textContent = `${S.from}–${S.to}`;
  const pct = v => (v - 1910) / 115 * 100;
  $('rangeFill').style.left = pct(S.from) + '%'; $('rangeFill').style.width = pct(S.to) - pct(S.from) + '%';
  renderMap(); renderKpis(); renderClimate(); renderPyramid(); renderRent(); renderMomentum();
}

fetch('data/dashboard.json').then(r => r.json()).then(d => {
  D = d; D.rents = Object.fromEntries(Object.entries(D.rents).map(([k, v]) => [+k, v]));
  for (const s in D.wages) D.wages[s] = Object.fromEntries(Object.entries(D.wages[s]).map(([k, v]) => [+k, v]));
  readHash(); buildFilters(); buildStripes(); render();
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { Object.values(charts).forEach(c => c.destroy()); charts = {}; render(); });
}).catch(e => { document.querySelector('main').insertAdjacentHTML('afterbegin', `<p class="finding">Could not load data: ${e.message}</p>`); });
