// Blood pressure and heart rate log with voice entry, averages and trends.
import { Store } from '../core/store.js';
import { mount, h, whenInput, toast, confirmBox, empty } from '../core/dom.js';
import { dstr, fmtDate, fmtStamp, avg, round, uid, toLocalInput } from '../core/util.js';
import { micButton } from '../core/voice.js';
import { lineChart } from '../core/charts.js';

const data = () => Store.get('bp', { readings: [] });

// "128 over 82 pulse 71" / "128/82 heart rate 71" -> {sys, dia, pulse}
export function parseBP(text) {
  let t = text.toLowerCase().replace(/,/g, ' ');
  let pulse = null;
  const pm = t.match(/(?:pulse|heart\s*rate|heartrate|hr|rate|bpm)\D{0,12}(\d{2,3})/);
  if (pm) {
    pulse = Number(pm[1]);
    t = t.replace(pm[0], ' ');
  }
  const nums = [...t.matchAll(/\d{2,3}/g)].map((m) => Number(m[0]));
  const [sys, dia, third] = nums;
  if (pulse == null && third != null) pulse = third;
  const ok = (v, lo, hi) => (v >= lo && v <= hi ? v : null);
  return { sys: ok(sys, 60, 260), dia: ok(dia, 30, 160), pulse: ok(pulse, 30, 220) };
}

export const readings = () => data().readings;
export function inRange(days, now = Date.now()) {
  return readings().filter((r) => r.at >= now - days * 864e5);
}
export function stats(list) {
  return {
    n: list.length,
    sys: round(avg(list.map((r) => r.sys))),
    dia: round(avg(list.map((r) => r.dia))),
    pulse: round(avg(list.filter((r) => r.pulse).map((r) => r.pulse))),
  };
}
export function byDay(list) {
  const map = {};
  for (const r of list) (map[dstr(new Date(r.at))] ||= []).push(r);
  return map;
}

function render(root) {
  const d = data();
  const rerender = () => render(root);
  const sys = h('input', { type: 'number', inputmode: 'numeric', placeholder: 'Top', 'aria-label': 'Systolic' });
  const dia = h('input', { type: 'number', inputmode: 'numeric', placeholder: 'Bottom', 'aria-label': 'Diastolic' });
  const pulse = h('input', { type: 'number', inputmode: 'numeric', placeholder: 'Pulse', 'aria-label': 'Heart rate' });
  const note = h('input', { placeholder: 'Note (optional): after walk, felt dizzy…' });
  const whenBox = whenInput();
  const when = whenBox.el;
  const heard = h('p', { class: 'muted small' });

  const save = () => {
    const s = Number(sys.value), di = Number(dia.value), p = Number(pulse.value) || null;
    if (!(s >= 60 && s <= 260 && di >= 30 && di <= 160)) return toast('Enter the top and bottom numbers (e.g. 128 and 82).');
    d.readings.push({ id: uid(), at: whenBox.at(), sys: s, dia: di, pulse: p, note: note.value.trim() });
    Store.save();
    toast(`Saved ${s}/${di}${p ? ' · pulse ' + p : ''}`);
    rerender();
  };

  const mic = micButton((text) => {
    const r = parseBP(text);
    heard.textContent = `Heard: “${text}”`;
    if (r.sys) sys.value = r.sys;
    if (r.dia) dia.value = r.dia;
    if (r.pulse) pulse.value = r.pulse;
    if (r.sys && r.dia) toast('Check the numbers, then tap Save.');
    else toast('Could not get both numbers. Say it like “128 over 82 pulse 71”.');
  }, 'Say your reading');

  const entry = h('div', { class: 'card' },
    h('div', { class: 'row' }, h('h2', { class: 'grow' }, 'Log a reading'), mic),
    h('div', { class: 'grid3' }, sys, dia, pulse),
    h('p', { class: 'muted small' }, 'Tap 🎤 and say: “128 over 82 pulse 71”'), heard,
    note,
    h('details', { style: 'margin:8px 0' }, h('summary', { class: 'muted' }, 'Change date/time'), when),
    h('button', { class: 'btn primary block', onclick: save }, 'Save reading'));

  const sc = (days) => {
    const s = stats(inRange(days));
    return h('div', { class: 'stat' }, h('div', { class: 'big' }, s.n ? `${s.sys}/${s.dia}` : '–'),
      h('div', { class: 'lbl' }, `${days} days · ${s.n} readings`), s.pulse ? h('div', { class: 'lbl' }, `pulse ${s.pulse}`) : null);
  };

  const recent = inRange(30);
  const days = byDay(recent);
  const keys = Object.keys(days).sort();
  const sysPts = keys.map((k) => ({ t: new Date(k + 'T12:00').getTime(), y: avg(days[k].map((r) => r.sys)) }));
  const diaPts = keys.map((k) => ({ t: new Date(k + 'T12:00').getTime(), y: avg(days[k].map((r) => r.dia)) }));

  const stats3 = h('div', { class: 'card' }, h('h2', null, 'Averages'), h('div', { class: 'grid3' }, sc(7), sc(30), sc(90)));
  const chart = h('div', { class: 'card' }, h('h2', null, 'Daily average, last 30 days'),
    keys.length ? [lineChart([{ label: 'Top', color: 'var(--c1)', points: sysPts }, { label: 'Bottom', color: 'var(--c2)', points: diaPts }]),
      h('div', { class: 'legend' }, h('span', null, h('i', { style: 'background:var(--c1)' }), 'Top (systolic)'), h('span', null, h('i', { style: 'background:var(--c2)' }), 'Bottom (diastolic)'))]
      : empty('Log a few readings to see a trend.'));

  // History grouped by day, with change from the previous day that has data.
  const all = [...d.readings].sort((a, b) => b.at - a.at);
  const grouped = byDay(all);
  const dayKeys = Object.keys(grouped).sort().reverse();
  const history = h('div', { class: 'card' }, h('h2', null, 'History'));
  if (!all.length) history.append(empty('No readings yet.'));
  dayKeys.slice(0, 30).forEach((k, i) => {
    const list = grouped[k].sort((a, b) => b.at - a.at);
    const s = stats(list);
    const prevKey = dayKeys[i + 1];
    const ps = prevKey ? stats(grouped[prevKey]) : null;
    const delta = ps ? s.sys - ps.sys : null;
    history.append(h('h3', null, fmtDate(k), ` · avg ${s.sys}/${s.dia} (${list.length})`,
      delta != null && delta !== 0 ? h('span', { class: delta > 0 ? 'up' : 'down' }, ` ${delta > 0 ? '▲' : '▼'}${Math.abs(delta)}`) : null));
    for (const r of list) {
      history.append(h('div', { class: 'item' },
        h('div', { class: 'grow' }, h('strong', null, `${r.sys}/${r.dia}`), r.pulse ? ` · ♥ ${r.pulse}` : '', ` · ${fmtStamp(r.at)}`, r.note ? h('div', { class: 'muted small' }, r.note) : null),
        h('button', { class: 'btn small ghost', 'aria-label': 'Delete reading', onclick: async () => {
          if (await confirmBox(`Delete ${r.sys}/${r.dia}?`)) { d.readings = d.readings.filter((x) => x.id !== r.id); Store.save(); rerender(); }
        } }, '✕')));
    }
  });
  if (dayKeys.length > 30) history.append(h('p', { class: 'muted small' }, 'Showing the last 30 days. Older readings are included in the Doctor Report.'));

  mount(root, entry, stats3, chart, history);
}

function todayCard() {
  const all = readings();
  const last = [...all].sort((a, b) => b.at - a.at)[0];
  const s = stats(inRange(7));
  const todayN = all.filter((r) => dstr(new Date(r.at)) === dstr()).length;
  return h('div', { class: 'card' },
    h('div', { class: 'row' }, h('h2', { class: 'grow' }, '❤️ Blood pressure'), h('span', { class: 'muted' }, `${todayN} today`)),
    last ? h('p', null, h('span', { class: 'big' }, `${last.sys}/${last.dia}`), last.pulse ? ` ♥ ${last.pulse}` : '', h('span', { class: 'muted' }, `  ${fmtDate(dstr(new Date(last.at)))} ${fmtStamp(last.at)}`)) : h('p', { class: 'muted' }, 'No readings yet.'),
    s.n ? h('p', { class: 'muted small' }, `7-day average ${s.sys}/${s.dia} (${s.n} readings)`) : null,
    h('a', { class: 'btn primary block', href: '#/bp', style: 'text-decoration:none;display:block;text-align:center;line-height:28px' }, '+ Log reading'));
}

export default { id: 'bp', name: 'Blood Pressure', tab: 'BP', icon: '❤️', blurb: 'Voice log, averages, trends', render, todayCard };
