// Doctor report: choose what to include, then print/save as PDF, share, copy or download the data.
// Nothing leaves the device unless the user chooses to share it.
import { Store } from '../core/store.js';
import { reportConfig } from '../core/reportcfg.js';
import { mount, h, toast, empty } from '../core/dom.js';
import { dstr, addDays, fmtDate, fmtStamp, avg, round, copyText, download } from '../core/util.js';
import { readings, stats, byDay } from './bp.js';
import { weights, weightUnit } from './weight.js';
import { o2Readings, summary as o2Summary } from './o2.js';
import { adherence, prnEntries, takenEntries, allMeds } from './meds.js';
import { activityEntries, summary as actSummary, feelLabel } from './activity.js';
import { foodEntries } from './food.js';

const SECTIONS = [
  ['bp', 'Blood pressure & heart rate'],
  ['o2', 'Oxygen & pulse (fingertip readings)'],
  ['weight', 'Weight'],
  ['meds', 'Prescriptions (scheduled medications)'],
  ['prn', 'As-needed medications'],
  ['activity', 'Activity & how I feel (pain, notes)'],
  ['food', 'Food & drink log'],
];
const config = reportConfig;
const when = (ms) => `${fmtDate(dstr(new Date(ms)))} ${fmtStamp(ms)}`;
const dose = (m) => `${m.name}${m.dose ? ' ' + m.dose : ''}`;
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

// Each section: { key, title, paras: [string], table: { head, rows } | null, none: string | null }
function build(from, to, c) {
  const f = new Date(from + 'T00:00').getTime();
  const t = new Date(to + 'T23:59:59').getTime();
  const on = (k) => c.show[k] !== false;
  const hidden = new Set(c.hiddenMeds);
  const inR = (r) => r.at >= f && r.at <= t;
  const out = [];
  const title = (k) => SECTIONS.find((s) => s[0] === k)[1];

  if (on('bp')) {
    const list = readings().filter(inR).sort((a, b) => a.at - b.at);
    const sec = { key: 'bp', title: title('bp'), paras: [], table: null, none: list.length ? null : 'No readings in this range.' };
    if (list.length) {
      const s = stats(list);
      sec.paras.push(`${plural(s.n, 'reading')}. Average ${s.sys}/${s.dia}${s.pulse ? `, pulse ${s.pulse}` : ''}.`,
        `Highest ${Math.max(...list.map((x) => x.sys))}/${Math.max(...list.map((x) => x.dia))}, lowest ${Math.min(...list.map((x) => x.sys))}/${Math.min(...list.map((x) => x.dia))}.`);
      if (c.detail) sec.table = { head: ['Date', 'Time', 'BP', 'Pulse', 'Note'], rows: list.map((x) => [fmtDate(dstr(new Date(x.at))), fmtStamp(x.at), `${x.sys}/${x.dia}`, x.pulse || '', x.note || '']) };
      else {
        const days = byDay(list);
        sec.table = { head: ['Date', '#', 'Average', 'Pulse', 'Range'], rows: Object.keys(days).sort().map((k) => {
          const l = days[k], ds = stats(l);
          return [fmtDate(k), ds.n, `${ds.sys}/${ds.dia}`, ds.pulse || '', `${Math.min(...l.map((x) => x.sys))}-${Math.max(...l.map((x) => x.sys))} / ${Math.min(...l.map((x) => x.dia))}-${Math.max(...l.map((x) => x.dia))}`];
        }) };
      }
    }
    out.push(sec);
  }

  if (on('o2')) {
    const list = o2Readings().filter((r) => r.source !== 'watch' && inR(r)).sort((a, b) => a.at - b.at);
    const sec = { key: 'o2', title: title('o2'), paras: [], table: null, none: list.length ? null : 'No readings in this range.' };
    if (list.length) {
      const o = o2Summary(list);
      sec.paras.push(`${plural(o.n, 'reading')}. Average ${o.avg}%, lowest ${o.min}%${o.pulse ? `, average pulse ${o.pulse}` : ''}.`);
      if (c.detail) sec.table = { head: ['Date', 'Time', 'O2 %', 'Pulse', 'Note'], rows: list.map((x) => [fmtDate(dstr(new Date(x.at))), fmtStamp(x.at), x.spo2, x.pulse || '', x.note || '']) };
    }
    out.push(sec);
  }

  if (on('weight')) {
    const list = weights().filter(inR).sort((a, b) => a.at - b.at);
    const sec = { key: 'weight', title: title('weight'), paras: [], table: null, none: list.length ? null : 'No entries in this range.' };
    if (list.length) {
      sec.paras.push(`${list[0].value} to ${list[list.length - 1].value} ${weightUnit()} (${plural(list.length, 'entry')}, average ${round(avg(list.map((x) => x.value)), 1)}).`);
      if (c.detail) sec.table = { head: ['Date', 'Weight'], rows: list.map((x) => [when(x.at), `${x.value} ${weightUnit()}`]) };
    }
    out.push(sec);
  }

  if (on('meds')) {
    const a = adherence(from, to);
    const by = a.byMed.filter((m) => !hidden.has(m.med.id));
    const sum = by.reduce((s, m) => ({ taken: s.taken + m.taken, skipped: s.skipped + m.skipped, missed: s.missed + m.missed }), { taken: 0, skipped: 0, missed: 0 });
    const total = sum.taken + sum.skipped + sum.missed;
    const sec = { key: 'meds', title: title('meds'), paras: [], table: null, none: total ? null : 'No scheduled doses in this range.' };
    if (total) {
      sec.paras.push(`Overall ${Math.round((sum.taken / total) * 100)}% taken (${sum.taken} taken, ${sum.skipped} skipped, ${sum.missed} missed of ${total}).`,
        ...by.map((m) => `${dose(m.med)}: ${m.taken}/${m.taken + m.skipped + m.missed} taken`));
      if (c.detail) {
        const log = takenEntries(from, to).filter((l) => !hidden.has(l.med.id) && !l.med.asNeeded);
        sec.table = { head: ['Date', 'Medication', 'Scheduled', 'Status', 'Recorded at'], rows: log.map((l) => [fmtDate(l.date), dose(l.med), l.time, l.status, fmtStamp(l.at)]) };
      }
    }
    out.push(sec);
  }

  if (on('prn')) {
    const list = prnEntries(f, t).filter((p) => !hidden.has(p.med.id));
    const sec = { key: 'prn', title: title('prn'), paras: [], table: null, none: list.length ? null : 'None logged in this range.' };
    if (list.length) {
      const by = {};
      for (const p of list) {
        const e = (by[p.med.id] ||= { med: p.med, n: 0, last: 0 });
        e.n++;
        e.last = Math.max(e.last, p.at);
      }
      sec.paras.push(...Object.values(by).map((m) => `${dose(m.med)}: ${plural(m.n, 'dose')} (last ${when(m.last)})`));
      sec.table = { head: ['Date', 'Time', 'Medication', 'Note'], rows: list.map((p) => [fmtDate(dstr(new Date(p.at))), fmtStamp(p.at), dose(p.med), p.note || '']) };
    }
    out.push(sec);
  }

  if (on('activity')) {
    const list = activityEntries().filter(inR).sort((a, b) => a.at - b.at);
    const sec = { key: 'activity', title: title('activity'), paras: [], table: null, none: list.length ? null : 'No entries in this range.' };
    if (list.length) {
      const s = actSummary(list);
      sec.paras.push(`${plural(s.n, 'entry')}, ${s.minutes} active minutes${s.avgPain != null ? `, average pain ${s.avgPain}/10` : ''}${s.worstPain != null ? `, worst ${s.worstPain}/10 (${when(s.worstAt)})` : ''}.`);
      sec.table = { head: ['Date', 'Time', 'Activity', 'Min', 'Pain', 'Feeling', 'Notes'], rows: list.map((e) => [fmtDate(dstr(new Date(e.at))), fmtStamp(e.at), e.activity, e.minutes || '', e.pain != null ? `${e.area || ''} ${e.pain}/10`.trim() : '', feelLabel(e.feeling), e.notes || '']) };
    }
    out.push(sec);
  }
  if (on('food')) {
    const list = foodEntries().filter(inR).sort((a, b) => a.at - b.at);
    const sec = { key: 'food', title: title('food'), paras: [], table: null, none: list.length ? null : 'No entries in this range.' };
    if (list.length) {
      const dayCount = new Set(list.map((e) => dstr(new Date(e.at)))).size;
      sec.paras.push(`${plural(list.length, 'entry')} across ${plural(dayCount, 'day')}.`);
      sec.table = { head: ['Date', 'Time', 'Meal', 'What I ate or drank', 'Note'], rows: list.map((e) => [fmtDate(dstr(new Date(e.at))), fmtStamp(e.at), e.meal || '', e.text, e.note || '']) };
    }
    out.push(sec);
  }
  return out;
}

function asText(name, from, to, sections) {
  const L = [`Health summary for ${name}`, `${fmtDate(from)} to ${fmtDate(to)}`];
  for (const s of sections) {
    L.push('', s.title.toUpperCase());
    if (s.none) { L.push(s.none); continue; }
    L.push(...s.paras);
    if (s.table) L.push('', s.table.head.join(' | '), ...s.table.rows.map((r) => r.join(' | ')));
  }
  L.push('', 'Self-reported log from the MyLife app. Not a medical record.');
  return L.join('\n');
}

const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
function asCsv(from, to, c) {
  const rows = [['type', 'date', 'time', 'item', 'value_1', 'value_2', 'value_3', 'notes']];
  for (const s of build(from, to, { ...c, detail: true })) {
    if (!s.table) continue;
    for (const r of s.table.rows) rows.push([s.key, ...r]);
  }
  return rows.map((r) => r.map(csvCell).join(',')).join('\n');
}

function render(root) {
  const c = config();
  const refresh = () => { const y = window.scrollY; render(root); window.scrollTo(0, y); };
  const to = dstr();
  const from = dstr(addDays(new Date(), -((c.range || 30) - 1)));
  const name = Store.profile().name;
  const sections = build(from, to, c);

  const toggle = (label, checked, onChange, sub) => h('label', { class: 'item' },
    h('input', { type: 'checkbox', checked, onchange: (e) => onChange(e.target.checked) }), h('div', { class: 'grow' }, label, sub ? h('div', { class: 'muted small' }, sub) : null));

  const meds = allMeds();
  const medToggle = (m) => toggle(dose(m), !c.hiddenMeds.includes(m.id), (on) => {
    c.hiddenMeds = on ? c.hiddenMeds.filter((x) => x !== m.id) : [...c.hiddenMeds, m.id];
    Store.save(); refresh();
  }, m.end ? `until ${fmtDate(m.end)}` : null);
  const scheduled = meds.filter((m) => !m.asNeeded);
  const asNeeded = meds.filter((m) => m.asNeeded);

  const controls = h('div', { class: 'card no-print' }, h('h2', null, 'Doctor report'),
    h('div', { class: 'seg' }, [7, 14, 30, 60, 90].map((n) => h('button', { class: `btn ${c.range === n ? 'on' : ''}`, onclick: () => { c.range = n; Store.save(); refresh(); } }, `${n} days`))),
    h('h3', null, 'Include'),
    SECTIONS.map(([k, label]) => toggle(label, c.show[k] !== false, (on) => { c.show[k] = on; Store.save(); refresh(); })),
    scheduled.length ? [h('h3', null, 'Prescriptions to include'), scheduled.map(medToggle)] : null,
    asNeeded.length ? [h('h3', null, 'As-needed medications to include'), asNeeded.map(medToggle)] : null,
    h('h3', null, 'Detail'),
    toggle('List every reading and dose with times', !!c.detail, (on) => { c.detail = on; Store.save(); refresh(); }, 'Longer, but shows exact times.'),
    h('div', { class: 'row wrap', style: 'margin-top:12px' },
      h('button', { class: 'btn primary', onclick: () => window.print() }, '🖨 Print / Save as PDF'),
      navigator.share ? h('button', { class: 'btn', onclick: () => navigator.share({ title: `Health summary for ${name}`, text: asText(name, from, to, sections) }).catch(() => {}) }, '↗ Share') : null,
      h('button', { class: 'btn', onclick: async () => toast((await copyText(asText(name, from, to, sections))) ? 'Copied. Paste into a message or email.' : 'Could not copy.') }, '📋 Copy text'),
      h('button', { class: 'btn', onclick: () => { download(`mylife-data-${dstr()}.csv`, asCsv(from, to, c), 'text/csv'); toast('Downloaded. Open it in a spreadsheet app.'); } }, '⬇ Data file (CSV)')),
    h('p', { class: 'muted small' }, 'Nothing leaves your phone until you choose to share. To give this to your doctor: Save as PDF or Share, then send it through their patient portal, email or text. I can’t send it to a doctor’s system directly.'));

  const preview = h('div', { class: 'card' }, h('h2', null, `Health summary: ${name}`), h('p', { class: 'muted' }, `${fmtDate(from)} to ${fmtDate(to)}`),
    sections.length ? sections.map((s) => [h('h3', null, s.title),
      s.none ? empty(s.none) : [s.paras.map((p) => h('p', { class: 'small' }, p)),
        s.table ? h('table', { class: 'rep' }, h('thead', null, h('tr', null, s.table.head.map((x) => h('th', null, x)))), h('tbody', null, s.table.rows.map((r) => h('tr', null, r.map((x) => h('td', null, x)))))) : null]])
      : empty('Everything is switched off. Turn on a section above.'),
    h('p', { class: 'muted small' }, 'Self-reported log from the MyLife app. Not a medical record.'));

  mount(root, controls, preview);
}

export default { id: 'report', name: 'Doctor Report', icon: '🩺', blurb: 'Choose what to share with your doctor', render };
