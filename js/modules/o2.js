// Oxygen saturation (SpO2) and pulse log. Fingertip oximeter readings are the trusted ones;
// watch readings are experimental and are kept out of the doctor report.
import { Store } from '../core/store.js';
import { mount, h, toast, confirmBox, empty } from '../core/dom.js';
import { dstr, fmtDate, fmtStamp, avg, round, uid, toLocalInput } from '../core/util.js';
import { micButton } from '../core/voice.js';
import { lineChart } from '../core/charts.js';

const data = () => Store.get('o2', { readings: [] });
export const o2Readings = () => data().readings;
const label = (s) => (s === 'watch' ? 'Watch (experimental)' : 'Fingertip');

// "97 percent pulse 72" / "98% heart rate 64" -> {spo2, pulse}
export function parseO2(text) {
  let t = text.toLowerCase().replace(/,/g, ' ');
  let pulse = null;
  const pm = t.match(/(?:pulse|heart\s*rate|heartrate|hr|rate|bpm)\D{0,12}(\d{2,3})/);
  if (pm) {
    pulse = Number(pm[1]);
    t = t.replace(pm[0], ' ');
  }
  const [first, second] = [...t.matchAll(/\d{2,3}/g)].map((m) => Number(m[0]));
  if (pulse == null && second != null) pulse = second;
  const ok = (v, lo, hi) => (v >= lo && v <= hi ? v : null);
  return { spo2: ok(first, 50, 100), pulse: ok(pulse, 30, 220) };
}

export function summary(list) {
  const sp = list.map((r) => r.spo2);
  return {
    n: list.length,
    avg: round(avg(sp), 1),
    min: sp.length ? Math.min(...sp) : null,
    pulse: round(avg(list.filter((r) => r.pulse).map((r) => r.pulse))),
  };
}

const inRange = (list, days) => list.filter((r) => r.at >= Date.now() - days * 864e5);
const byDay = (list) => {
  const map = {};
  for (const r of list) (map[dstr(new Date(r.at))] ||= []).push(r);
  return map;
};

// Pair each watch reading with the closest fingertip reading within 15 minutes.
function pairs(all) {
  const tips = all.filter((r) => r.source !== 'watch');
  const out = [];
  for (const w of all.filter((r) => r.source === 'watch')) {
    let best = null;
    for (const t of tips) if (Math.abs(t.at - w.at) <= 15 * 60000 && (!best || Math.abs(t.at - w.at) < Math.abs(best.at - w.at))) best = t;
    if (best) out.push({ watch: w, tip: best, diff: w.spo2 - best.spo2 });
  }
  return out;
}

function render(root) {
  const d = data();
  const rerender = () => render(root);
  const spo2 = h('input', { type: 'number', inputmode: 'numeric', placeholder: 'O2 %', 'aria-label': 'Oxygen saturation percent' });
  const pulse = h('input', { type: 'number', inputmode: 'numeric', placeholder: 'Pulse', 'aria-label': 'Pulse' });
  const source = h('select', { 'aria-label': 'Source' }, h('option', { value: 'fingertip' }, 'Fingertip oximeter'), h('option', { value: 'watch' }, 'Watch (experimental)'));
  const note = h('input', { placeholder: 'Note (optional): resting, after walking…' });
  const when = h('input', { type: 'datetime-local', value: toLocalInput(Date.now()) });
  const heard = h('p', { class: 'muted small' });

  const save = () => {
    const s = Number(spo2.value);
    const p = Number(pulse.value) || null;
    if (!(s >= 50 && s <= 100)) return toast('Enter the oxygen percent (50 to 100).');
    d.readings.push({ id: uid(), at: new Date(when.value).getTime() || Date.now(), spo2: s, pulse: p, source: source.value, note: note.value.trim() });
    Store.save();
    toast(`Saved ${s}%${p ? ' · pulse ' + p : ''}`);
    rerender();
  };

  const mic = micButton((text) => {
    const r = parseO2(text);
    heard.textContent = `Heard: “${text}”`;
    if (r.spo2) spo2.value = r.spo2;
    if (r.pulse) pulse.value = r.pulse;
    toast(r.spo2 ? 'Check the numbers, then tap Save.' : 'Could not get the oxygen number. Say “97 percent pulse 72”.');
  }, 'Say your reading');

  const entry = h('div', { class: 'card' },
    h('div', { class: 'row' }, h('h2', { class: 'grow' }, 'Log a reading'), mic),
    h('div', { class: 'grid2' }, spo2, pulse),
    h('p', { class: 'muted small' }, 'Tap 🎤 and say: “97 percent pulse 72”'), heard,
    h('label', { class: 'field' }, 'Measured with'), source,
    h('p', { class: 'muted small' }, 'Watch readings are experimental. They are not used in your doctor report.'),
    note,
    h('details', { style: 'margin:8px 0' }, h('summary', { class: 'muted' }, 'Change date/time'), when),
    h('button', { class: 'btn primary block', onclick: save }, 'Save reading'));

  const trusted = d.readings.filter((r) => r.source !== 'watch');
  const sc = (days) => {
    const s = summary(inRange(trusted, days));
    return h('div', { class: 'stat' }, h('div', { class: 'big' }, s.n ? `${s.avg}%` : '–'),
      h('div', { class: 'lbl' }, `${days} days · ${s.n} readings`), s.n ? h('div', { class: 'lbl' }, `lowest ${s.min}%`) : null, s.pulse ? h('div', { class: 'lbl' }, `pulse ${s.pulse}`) : null);
  };
  const stats3 = h('div', { class: 'card' }, h('h2', null, 'Fingertip averages'), h('div', { class: 'grid3' }, sc(7), sc(30), sc(90)),
    h('p', { class: 'muted small' }, 'Ask your doctor what range is right for you. This app only records readings.'));

  const days30 = byDay(inRange(trusted, 30));
  const keys = Object.keys(days30).sort();
  const t = (k) => new Date(k + 'T12:00').getTime();
  const spoPts = keys.map((k) => ({ t: t(k), y: avg(days30[k].map((r) => r.spo2)) }));
  const pulsePts = keys.map((k) => ({ t: t(k), y: avg(days30[k].filter((r) => r.pulse).map((r) => r.pulse)) })).filter((p) => !Number.isNaN(p.y) && p.y != null);
  const charts = h('div', { class: 'card' }, h('h2', null, 'Daily average, last 30 days'),
    keys.length ? [h('h3', null, 'Oxygen %'), lineChart([{ label: 'O2', color: 'var(--c1)', points: spoPts }]),
      pulsePts.length ? [h('h3', null, 'Pulse'), lineChart([{ label: 'Pulse', color: 'var(--c2)', points: pulsePts }])] : null] : empty('Log a few readings to see a trend.'));

  const pr = pairs(d.readings);
  const watchCard = h('div', { class: 'card' }, h('h2', null, 'Watch vs fingertip (experiment)'),
    pr.length ? [h('p', null, h('strong', null, `${pr.length} matched pair${pr.length === 1 ? '' : 's'}`), `: the watch averaged ${round(avg(pr.map((p) => p.diff)), 1) > 0 ? '+' : ''}${round(avg(pr.map((p) => p.diff)), 1)} points from the fingertip reading, and was off by up to ${Math.max(...pr.map((p) => Math.abs(p.diff)))} points.`),
      h('p', { class: 'muted small' }, 'A pair is a watch reading and a fingertip reading taken within 15 minutes. Take several before trusting any pattern.')]
      : empty('Take a watch reading and a fingertip reading together and log both. This card then shows how far apart they are.'));

  const all = [...d.readings].sort((a, b) => b.at - a.at);
  const grouped = byDay(all);
  const dayKeys = Object.keys(grouped).sort().reverse();
  const history = h('div', { class: 'card' }, h('h2', null, 'History'));
  if (!all.length) history.append(empty('No readings yet.'));
  dayKeys.slice(0, 30).forEach((k) => {
    history.append(h('h3', null, fmtDate(k)));
    for (const r of grouped[k].sort((a, b) => b.at - a.at)) {
      history.append(h('div', { class: 'item' },
        h('div', { class: 'grow' }, h('strong', null, `${r.spo2}%`), r.pulse ? ` · ♥ ${r.pulse}` : '', ` · ${fmtStamp(r.at)}`,
          h('div', { class: 'muted small' }, label(r.source), r.note ? ` · ${r.note}` : '')),
        h('button', { class: 'btn small ghost', 'aria-label': 'Delete reading', onclick: async () => {
          if (await confirmBox(`Delete ${r.spo2}%?`)) { d.readings = d.readings.filter((x) => x.id !== r.id); Store.save(); rerender(); }
        } }, '✕')));
    }
  });

  mount(root, entry, stats3, charts, watchCard, history);
}

function todayCard() {
  const trusted = o2Readings().filter((r) => r.source !== 'watch');
  const last = [...trusted].sort((a, b) => b.at - a.at)[0];
  const s = summary(inRange(trusted, 7));
  return h('div', { class: 'card' }, h('div', { class: 'row' }, h('h2', { class: 'grow' }, '🫁 Oxygen & pulse'), h('a', { href: '#/o2' }, 'Log →')),
    last ? h('p', null, h('span', { class: 'big' }, `${last.spo2}%`), last.pulse ? ` ♥ ${last.pulse}` : '', h('span', { class: 'muted' }, `  ${fmtDate(dstr(new Date(last.at)))} ${fmtStamp(last.at)}`)) : h('p', { class: 'muted' }, 'No readings yet.'),
    s.n ? h('p', { class: 'muted small' }, `7-day average ${s.avg}% (${s.n} readings)`) : null);
}

export default { id: 'o2', name: 'Oxygen & Pulse', tab: 'O2', icon: '🫁', blurb: 'SpO2 and pulse log', render, todayCard };
