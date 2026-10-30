// Doctor report: BP, weight and medication adherence for a date range. Print/save as PDF or copy as text.
import { Store } from '../core/store.js';
import { mount, h, toast, empty } from '../core/dom.js';
import { dstr, addDays, fmtDate, fmtStamp, avg, round, copyText } from '../core/util.js';
import { readings, stats, byDay } from './bp.js';
import { weights, weightUnit } from './weight.js';
import { o2Readings, summary as o2Summary } from './o2.js';
import { adherence } from './meds.js';

let range = 30;
let everyReading = false;

function build(from, to) {
  const f = new Date(from + 'T00:00').getTime();
  const t = new Date(to + 'T23:59:59').getTime();
  const bp = readings().filter((r) => r.at >= f && r.at <= t).sort((a, b) => a.at - b.at);
  const wt = weights().filter((r) => r.at >= f && r.at <= t).sort((a, b) => a.at - b.at);
  const o2 = o2Readings().filter((r) => r.source !== 'watch' && r.at >= f && r.at <= t).sort((a, b) => a.at - b.at);
  const days = byDay(bp);
  return { bp, wt, o2, days, bpStats: stats(bp), adh: adherence(from, to) };
}

function asText(name, from, to, r) {
  const L = [`Health summary for ${name}`, `${fmtDate(from)} to ${fmtDate(to)}`, ''];
  L.push('BLOOD PRESSURE');
  if (r.bp.length) {
    const sys = r.bp.map((x) => x.sys), dia = r.bp.map((x) => x.dia);
    L.push(`${r.bpStats.n} readings. Average ${r.bpStats.sys}/${r.bpStats.dia}${r.bpStats.pulse ? `, pulse ${r.bpStats.pulse}` : ''}.`,
      `Highest ${Math.max(...sys)}/${Math.max(...dia)}, lowest ${Math.min(...sys)}/${Math.min(...dia)}.`, '');
    for (const k of Object.keys(r.days).sort()) {
      const s = stats(r.days[k]);
      L.push(`${k}: avg ${s.sys}/${s.dia} (${s.n} readings: ${r.days[k].map((x) => `${x.sys}/${x.dia}`).join(', ')})`);
    }
  } else L.push('No readings in this range.');
  L.push('', 'OXYGEN SATURATION (fingertip oximeter)');
  if (r.o2.length) {
    const o = o2Summary(r.o2);
    L.push(`${o.n} readings. Average ${o.avg}%, lowest ${o.min}%${o.pulse ? `, average pulse ${o.pulse}` : ''}.`);
  } else L.push('No readings in this range.');
  L.push('', 'WEIGHT');
  if (r.wt.length) L.push(`${r.wt[0].value} → ${r.wt[r.wt.length - 1].value} ${weightUnit()} (${r.wt.length} entries, average ${round(avg(r.wt.map((x) => x.value)), 1)}).`);
  else L.push('No entries in this range.');
  L.push('', 'MEDICATION ADHERENCE');
  if (r.adh.total) {
    L.push(`Overall ${r.adh.pct}% taken (${r.adh.taken} taken, ${r.adh.skipped} skipped, ${r.adh.missed} missed of ${r.adh.total}).`);
    r.adh.byMed.forEach((m) => L.push(`- ${m.med.name}${m.med.dose ? ' ' + m.med.dose : ''}: ${m.taken}/${m.taken + m.skipped + m.missed} taken`));
  } else L.push('No scheduled doses in this range.');
  L.push('', 'Self-reported log from the MyLife app. Not a medical record.');
  return L.join('\n');
}

function render(root) {
  const rerender = () => render(root);
  const to = dstr();
  const from = dstr(addDays(new Date(), -(range - 1)));
  const name = Store.profile().name;
  const r = build(from, to);

  const seg = h('div', { class: 'seg no-print' }, [7, 14, 30, 60, 90].map((n) => h('button', { class: `btn ${range === n ? 'on' : ''}`, onclick: () => { range = n; rerender(); } }, `${n} days`)));
  const opt = h('label', { class: 'row no-print', style: 'margin:6px 0' }, h('input', { type: 'checkbox', checked: everyReading, onchange: (e) => { everyReading = e.target.checked; rerender(); } }), 'List every reading (longer)');

  const dayRows = Object.keys(r.days).sort().map((k) => {
    const list = r.days[k];
    const s = stats(list);
    return h('tr', null, h('td', null, fmtDate(k)), h('td', null, s.n), h('td', null, `${s.sys}/${s.dia}`), h('td', null, s.pulse || '–'),
      h('td', null, everyReading ? list.sort((a, b) => a.at - b.at).map((x) => `${fmtStamp(x.at)} ${x.sys}/${x.dia}${x.pulse ? ' ♥' + x.pulse : ''}`).join(' · ') : `${Math.min(...list.map((x) => x.sys))}–${Math.max(...list.map((x) => x.sys))} / ${Math.min(...list.map((x) => x.dia))}–${Math.max(...list.map((x) => x.dia))}`));
  });

  mount(root, 
    h('div', { class: 'card no-print' }, h('h2', null, 'Doctor report'), seg, opt,
      h('div', { class: 'row wrap' },
        h('button', { class: 'btn primary', onclick: () => window.print() }, '🖨 Print / Save as PDF'),
        h('button', { class: 'btn', onclick: async () => toast((await copyText(asText(name, from, to, r))) ? 'Copied. Paste into a message or email.' : 'Could not copy.') }, '📋 Copy as text'))),
    h('div', { class: 'card' }, h('h2', null, `Health summary: ${name}`), h('p', { class: 'muted' }, `${fmtDate(from)} to ${fmtDate(to)}`),
      h('h3', null, 'Blood pressure'),
      r.bp.length ? [h('p', null, h('strong', null, `${r.bpStats.n} readings. Average ${r.bpStats.sys}/${r.bpStats.dia}`), r.bpStats.pulse ? `, pulse ${r.bpStats.pulse}` : '',
        h('br'), `Highest ${Math.max(...r.bp.map((x) => x.sys))}/${Math.max(...r.bp.map((x) => x.dia))} · lowest ${Math.min(...r.bp.map((x) => x.sys))}/${Math.min(...r.bp.map((x) => x.dia))}`),
        h('table', { class: 'rep' }, h('thead', null, h('tr', null, ['Date', '#', 'Avg', 'Pulse', everyReading ? 'Readings' : 'Range'].map((x) => h('th', null, x)))), h('tbody', null, dayRows))] : empty('No readings in this range.'),
      h('h3', null, 'Oxygen saturation (fingertip oximeter)'),
      r.o2.length ? h('p', null, `${o2Summary(r.o2).n} readings · average ${o2Summary(r.o2).avg}% · lowest ${o2Summary(r.o2).min}%`, o2Summary(r.o2).pulse ? ` · average pulse ${o2Summary(r.o2).pulse}` : '') : empty('No readings in this range.'),
      h('h3', null, 'Weight'),
      r.wt.length ? h('p', null, `${r.wt[0].value} → ${r.wt[r.wt.length - 1].value} ${weightUnit()} · ${r.wt.length} entries · average ${round(avg(r.wt.map((x) => x.value)), 1)}`) : empty('No entries in this range.'),
      h('h3', null, 'Medication adherence'),
      r.adh.total ? [h('p', null, h('strong', null, `${r.adh.pct}% taken`), ` (${r.adh.taken} taken, ${r.adh.skipped} skipped, ${r.adh.missed} missed of ${r.adh.total})`),
        r.adh.byMed.map((m) => h('p', { class: 'small' }, `${m.med.name}${m.med.dose ? ' ' + m.med.dose : ''}: ${m.taken}/${m.taken + m.skipped + m.missed} taken`))] : empty('No scheduled doses in this range.'),
      h('p', { class: 'muted small' }, 'Self-reported log from the MyLife app. Not a medical record.')));
}

export default { id: 'report', name: 'Doctor Report', icon: '🩺', blurb: 'Printable summary for visits', render };
