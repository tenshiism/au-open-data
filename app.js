// Renders the three projects from data/*.json (made by ../pipeline).
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const tip = document.getElementById('tip');
const fmt = (v, d = 1) => Number(v).toFixed(d);

function table(el, cols, rows) {
  el.innerHTML = '<table><tr>' + cols.map(c => `<th>${c}</th>`).join('') + '</tr>' +
    rows.map(r => '<tr>' + r.map(v => `<td>${v}</td>`).join('') + '</tr>').join('') + '</table>';
}

function baseOpts(extra = {}) {
  const grid = css('--line'), ink = css('--text-secondary');
  return Object.assign({
    responsive: true, maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { labels: { color: ink, usePointStyle: true, boxHeight: 8 } },
      tooltip: { backgroundColor: css('--surface-2'), titleColor: css('--text-primary'), bodyColor: ink, borderColor: grid, borderWidth: 1, padding: 10 }
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: ink, maxTicksLimit: 10 }, border: { color: grid } },
      y: { grid: { color: grid }, ticks: { color: ink }, border: { display: false } }
    }
  }, extra);
}

function mix(a, b, t) {
  const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return 'rgb(' + x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(',') + ')';
}

async function load(name) {
  const r = await fetch(`data/${name}.json`);
  if (!r.ok) throw new Error(name);
  return r.json();
}

async function climate() {
  const d = await load('climate');
  if (d.sample) document.getElementById('climate').classList.add('sample');
  // Real BoM data is already an anomaly vs the 1961–1990 baseline; sample data is absolute °C.
  const mean = d.years.reduce((s, y) => s + (y.temp ?? 0), 0) / d.years.length;
  const anoms = d.years.map(y => y.anom ?? (y.temp - mean));
  d.years.forEach((y, i) => { y.temp = anoms[i]; });
  const max = Math.max(...anoms.map(Math.abs));
  const S = document.getElementById('stripes');
  d.years.forEach((y, i) => {
    const a = anoms[i], t = Math.min(Math.abs(a) / max, 1);
    const el = document.createElement('div');
    el.style.background = mix(css('--div-mid'), a > 0 ? css('--div-warm') : css('--div-cool'), t);
    el.onmousemove = e => { tip.style.display = 'block'; tip.style.left = e.clientX + 12 + 'px'; tip.style.top = e.clientY + 12 + 'px';
      tip.innerHTML = `<b>${y.year}</b> · ${a > 0 ? '+' : ''}${fmt(a, 2)}°C vs ${d.baseline || 'average'}`; };
    el.onmouseleave = () => tip.style.display = 'none';
    S.appendChild(el);
  });
  new Chart(document.getElementById('climateChart'), {
    type: 'line',
    data: { labels: d.years.map(y => y.year), datasets: [
      { label: 'Anomaly °C', data: d.years.map(y => y.temp), borderColor: css('--series-1'), borderWidth: 2, pointRadius: 0, tension: .25 },
    ] },
    options: baseOpts({ plugins: { ...baseOpts().plugins, legend: { display: false } } })
  });
  const first = d.years.slice(0, 10), last = d.years.slice(-10);
  const avg = a => a.reduce((s, y) => s + y.temp, 0) / a.length;
  document.getElementById('climateFinding').innerHTML =
    `<b>The last decade averaged ${fmt(avg(last) - avg(first), 2)}°C warmer</b> than the first decade on record (${first[0].year}–${first.at(-1).year}).`;
  table(document.getElementById('climateTable'), ['Year', `Anomaly °C (vs ${d.baseline || 'avg'})`], d.years.map((y, i) => [y.year, fmt(anoms[i], 2)]));
  return { label: (d.sample ? 'SAMPLE · ' : '') + 'warmer, last decade vs first', value: '+' + fmt(avg(last) - avg(first), 1) + '°C' };
}

async function housing() {
  const d = await load('housing');
  if (d.sample) document.getElementById('housing').classList.add('sample');
  const idx = (arr) => arr.map(v => v / arr[0] * 100);
  const rent = idx(d.rows.map(r => r.rent)), wage = idx(d.rows.map(r => r.wage));
  new Chart(document.getElementById('housingChart'), {
    type: 'line',
    data: { labels: d.rows.map(r => r.year), datasets: [
      { label: 'Rents', data: rent, borderColor: css('--series-2'), borderWidth: 2, pointRadius: 0, tension: .25 },
      { label: 'Wages', data: wage, borderColor: css('--series-1'), borderWidth: 2, pointRadius: 0, tension: .25 },
    ] },
    options: baseOpts()
  });
  const gap = rent.at(-1) - wage.at(-1);
  document.getElementById('housingFinding').innerHTML =
    `Since ${d.rows[0].year}, rents rose <b>${fmt(rent.at(-1) - 100, 0)}%</b> and wages <b>${fmt(wage.at(-1) - 100, 0)}%</b>: a gap of ${fmt(gap, 0)} index points.`;
  table(document.getElementById('housingTable'), ['Year', 'Rent idx', 'Wage idx'], d.rows.map((r, i) => [r.year, fmt(rent[i]), fmt(wage[i])]));
  return { label: (d.sample ? 'SAMPLE · ' : '') + `rents vs wages since ${d.rows[0].year}`, value: (gap > 0 ? '+' : '') + fmt(gap, 0) + ' pts' };
}

async function people() {
  const d = await load('population');
  if (d.sample) document.getElementById('people').classList.add('sample');
  const rows = [...d.states].sort((a, b) => b.growth - a.growth);
  new Chart(document.getElementById('popChart'), {
    type: 'bar',
    data: { labels: rows.map(r => r.state), datasets: [{ label: 'Annual growth %', data: rows.map(r => r.growth),
      backgroundColor: css('--series-3'), borderRadius: { topLeft: 4, topRight: 4 }, borderSkipped: 'start', maxBarThickness: 44 }] },
    options: baseOpts({ interaction: { mode: 'nearest', intersect: true }, plugins: { ...baseOpts().plugins, legend: { display: false } } })
  });
  document.getElementById('popFinding').innerHTML = `<b>${rows[0].state}</b> grew fastest (${fmt(rows[0].growth)}%); <b>${rows.at(-1).state}</b> slowest (${fmt(rows.at(-1).growth)}%).`;
  table(document.getElementById('popTable'), ['State', 'Growth %'], rows.map(r => [r.state, fmt(r.growth)]));
  return { label: (d.sample ? 'SAMPLE · ' : '') + `fastest-growing state (${rows[0].state})`, value: fmt(rows[0].growth) + '%' };
}

Promise.allSettled([climate(), housing(), people()]).then(rs => {
  document.getElementById('stats').innerHTML = rs.map(r => r.status === 'fulfilled'
    ? `<div class="stat"><b>${r.value.value}</b><small>${r.value.label}</small></div>`
    : `<div class="stat"><b>–</b><small>data not loaded: run the pipeline</small></div>`).join('');
});
