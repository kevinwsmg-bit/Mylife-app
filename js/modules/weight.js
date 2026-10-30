// Daily weigh-in with a trend line.
import { Store } from '../core/store.js';
import { mount, h, toast, confirmBox, empty } from '../core/dom.js';
import { dstr, fmtDate, avg, round, uid, toLocalInput } from '../core/util.js';
import { micButton } from '../core/voice.js';
import { lineChart } from '../core/charts.js';

const data = () => Store.get('weight', { entries: [], unit: 'lb' });
export const weights = () => data().entries;
export const weightUnit = () => data().unit;

function render(root) {
  const d = data();
  const rerender = () => render(root);
  const value = h('input', { type: 'number', inputmode: 'decimal', step: '0.1', placeholder: `Weight (${d.unit})`, 'aria-label': 'Weight' });
  const when = h('input', { type: 'datetime-local', value: toLocalInput(Date.now()) });
  const save = () => {
    const v = Number(value.value);
    if (!(v > 20 && v < 1500)) return toast('Enter your weight.');
    d.entries.push({ id: uid(), at: new Date(when.value).getTime() || Date.now(), value: v });
    Store.save();
    toast(`Saved ${v} ${d.unit}`);
    rerender();
  };
  const mic = micButton((text) => {
    const m = text.match(/\d+(?:\.\d+)?/);
    if (m) { value.value = m[0]; toast('Check it, then tap Save.'); } else toast('Say a number like “182.4”.');
  });

  const sorted = [...d.entries].sort((a, b) => b.at - a.at);
  const change = (days) => {
    const cut = Date.now() - days * 864e5;
    const older = d.entries.filter((e) => e.at <= cut).sort((a, b) => b.at - a.at)[0];
    const latest = sorted[0];
    return older && latest ? round(latest.value - older.value, 1) : null;
  };
  const chg = (days) => {
    const c = change(days);
    return h('div', { class: 'stat' }, h('div', { class: 'big' }, c == null ? '–' : `${c > 0 ? '+' : ''}${c}`), h('div', { class: 'lbl' }, `${days}-day change`));
  };
  const last30 = d.entries.filter((e) => e.at >= Date.now() - 30 * 864e5);

  mount(root, 
    h('div', { class: 'card' }, h('div', { class: 'row' }, h('h2', { class: 'grow' }, 'Weigh-in'), mic),
      h('div', { class: 'row' }, h('div', { class: 'grow' }, value),
        h('select', { value: d.unit, style: 'width:90px', onchange: (e) => { d.unit = e.target.value; Store.save(); rerender(); } }, h('option', { value: 'lb' }, 'lb'), h('option', { value: 'kg' }, 'kg'))),
      h('details', { style: 'margin:8px 0' }, h('summary', { class: 'muted' }, 'Change date/time'), when),
      h('button', { class: 'btn primary block', onclick: save }, 'Save')),
    h('div', { class: 'card' }, h('h2', null, 'Trend, last 30 days'),
      last30.length ? lineChart([{ label: 'Weight', color: 'var(--c1)', points: last30.map((e) => ({ t: e.at, y: e.value })) }]) : empty('Log your weight to see a trend.'),
      h('div', { class: 'grid2' }, chg(7), chg(30))),
    h('div', { class: 'card' }, h('h2', null, 'History'),
      sorted.length ? sorted.slice(0, 60).map((e, i) => {
        const prev = sorted[i + 1];
        const diff = prev ? round(e.value - prev.value, 1) : null;
        return h('div', { class: 'item' }, h('div', { class: 'grow' }, h('strong', null, `${e.value} ${d.unit}`), '  ', h('span', { class: 'muted' }, fmtDate(dstr(new Date(e.at)))),
          diff ? h('span', { class: diff > 0 ? 'up' : 'down' }, `  ${diff > 0 ? '▲' : '▼'}${Math.abs(diff)}`) : null),
          h('button', { class: 'btn small ghost', 'aria-label': 'Delete', onclick: async () => { if (await confirmBox(`Delete ${e.value} ${d.unit}?`)) { d.entries = d.entries.filter((x) => x.id !== e.id); Store.save(); rerender(); } } }, '✕'));
      }) : empty('No entries yet.')));
}

function todayCard() {
  const d = data();
  const last = [...d.entries].sort((a, b) => b.at - a.at)[0];
  const doneToday = last && dstr(new Date(last.at)) === dstr();
  return h('div', { class: 'card' }, h('div', { class: 'row' }, h('h2', { class: 'grow' }, '⚖️ Weight'),
    h('a', { href: '#/weight' }, doneToday ? 'Logged ✓' : 'Log today →')),
    last ? h('p', { class: 'muted' }, `Last: ${last.value} ${d.unit} on ${fmtDate(dstr(new Date(last.at)))}`) : h('p', { class: 'muted' }, 'No entries yet.'));
}

export default { id: 'weight', name: 'Weight', icon: '⚖️', blurb: 'Daily weigh-in and trend', render, todayCard };
