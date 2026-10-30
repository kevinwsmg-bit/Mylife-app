// Medications: schedules, taken/skipped log, adherence, reminders, calendar export.
import { Store } from '../core/store.js';
import { mount, h, modal, confirmBox, toast, empty } from '../core/dom.js';
import { dstr, parseD, addDays, fmtTime, fmtDate, fmtStamp, toLocalInput, uid, pad, download } from '../core/util.js';
import { notifStatus, notifSupported, askPermission, beep } from '../core/notify.js';

const data = () => {
  const d = Store.get('meds', { meds: [], log: [], prn: [] });
  d.prn ||= []; // as-needed doses: { id, medId, at, note }
  return d;
};
const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export const isCurrent = (med, today = dstr()) => !med.end || med.end >= today;
export const allMeds = () => data().meds;

// As-needed doses between two timestamps, oldest first, each with its medication.
export function prnEntries(fromMs, toMs) {
  const d = data();
  return d.prn.filter((p) => p.at >= fromMs && p.at <= toMs)
    .map((p) => ({ ...p, med: d.meds.find((m) => m.id === p.medId) })).filter((p) => p.med).sort((a, b) => a.at - b.at);
}

// Scheduled-dose log entries (taken/skipped with the time recorded) between two dates.
export function takenEntries(fromDate, toDate) {
  const d = data();
  return d.log.filter((l) => l.date >= fromDate && l.date <= toDate)
    .map((l) => ({ ...l, med: d.meds.find((m) => m.id === l.medId) })).filter((l) => l.med)
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
}

// "taken 9:45 AM (45 min late)" for a logged scheduled dose.
export function doseDetail(dose) {
  const e = dose.entry;
  if (!e) return '';
  const when = fmtStamp(e.at);
  const diff = Math.round((e.at - dose.due) / 60000);
  const abs = Math.abs(diff);
  const span = abs >= 60 ? `${Math.floor(abs / 60)}h${abs % 60 ? ' ' + (abs % 60) + 'm' : ''}` : `${abs} min`;
  const off = abs >= 10 ? ` (${span} ${diff > 0 ? 'late' : 'early'})` : '';
  return `${e.status === 'skipped' ? 'skipped' : 'taken'} ${when}${e.status === 'taken' ? off : ''}`;
}

export const asNeededMeds = () => data().meds.filter((m) => m.asNeeded && isCurrent(m));
const lastPrn = (med) => data().prn.filter((p) => p.medId === med.id).sort((a, b) => b.at - a.at)[0];

const ago = (ms) => {
  const mins = Math.round((Date.now() - ms) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h${mins % 60 ? ' ' + (mins % 60) + 'm' : ''} ago`;
};

export function logPrn(med, { at = Date.now(), note = '' } = {}) {
  data().prn.push({ id: uid(), medId: med.id, at, note });
  Store.save();
}

// One-tap "I took it now". If the user set a wait time for this med, confirm before logging a close dose.
async function takeNow(med, after) {
  const last = lastPrn(med);
  if (med.minHours && last && Date.now() - last.at < med.minHours * 3600000) {
    const ok = await confirmBox(`You noted waiting at least ${med.minHours} hours between doses. Your last ${med.name} was ${ago(last.at)}. Log it anyway?`, 'Log it');
    if (!ok) return;
  }
  logPrn(med);
  toast(`Logged ${med.name} at ${fmtStamp(Date.now())}`);
  setTimeout(after, 0); // after any confirm dialog has closed
}

// Counts of as-needed doses taken between two timestamps, per medication.
export function prnSummary(fromMs, toMs) {
  const d = data();
  const by = {};
  for (const p of d.prn) {
    if (p.at < fromMs || p.at > toMs) continue;
    const med = d.meds.find((m) => m.id === p.medId);
    if (!med) continue;
    const e = (by[med.id] ||= { med, n: 0, last: 0 });
    e.n++;
    e.last = Math.max(e.last, p.at);
  }
  return Object.values(by);
}

function scheduledOn(med, date) {
  if (date < med.start) return false;
  if (med.end && date > med.end) return false;
  if (med.days?.length && !med.days.includes(parseD(date).getDay())) return false;
  return true;
}

export function dosesForDate(date) {
  const d = data();
  const out = [];
  for (const med of d.meds) {
    if (!scheduledOn(med, date)) continue;
    for (const time of med.times) {
      const key = `${med.id}|${date}|${time}`;
      const [hh, mm] = time.split(':').map(Number);
      const due = parseD(date);
      due.setHours(hh, mm, 0, 0);
      out.push({ med, time, key, date, due, entry: d.log.find((l) => l.key === key) });
    }
  }
  return out.sort((a, b) => a.due - b.due);
}

export function doseState(dose, now = new Date()) {
  if (dose.entry) return dose.entry.status;
  const mins = (now - dose.due) / 60000;
  if (mins < 0) return 'upcoming';
  return mins > 120 ? 'missed' : 'due';
}

export function logDose(dose, status, at = Date.now()) {
  const d = data();
  d.log = d.log.filter((l) => l.key !== dose.key);
  if (status) d.log.push({ key: dose.key, medId: dose.med.id, date: dose.date, time: dose.time, status, at });
  Store.save();
}

// Counts doses between two dates (inclusive) that are already in the past.
export function adherence(fromDate, toDate, now = new Date()) {
  const r = { taken: 0, skipped: 0, missed: 0 };
  const byMed = {};
  for (let d = parseD(fromDate); dstr(d) <= toDate; d = addDays(d, 1)) {
    for (const dose of dosesForDate(dstr(d))) {
      const s = doseState(dose, now);
      if (s !== 'taken' && s !== 'skipped' && s !== 'missed') continue;
      r[s]++;
      const m = (byMed[dose.med.id] ||= { med: dose.med, taken: 0, skipped: 0, missed: 0 });
      m[s]++;
    }
  }
  const total = r.taken + r.skipped + r.missed;
  return { ...r, total, pct: total ? Math.round((r.taken / total) * 100) : null, byMed: Object.values(byMed) };
}

function medForm(existing, preset = {}) {
  const m = existing || { name: '', dose: '', times: ['08:00'], days: [], start: dstr(), end: null, notes: '', asNeeded: false, minHours: null, ...preset };
  const name = h('input', { value: m.name, placeholder: 'e.g. Lisinopril', autocomplete: 'off' });
  const dose = h('input', { value: m.dose, placeholder: 'e.g. 10 mg' });
  const notes = h('input', { value: m.notes, placeholder: 'e.g. with food' });
  const start = h('input', { type: 'date', value: m.start });
  const kind = h('select', { value: m.end ? 'temp' : 'long' }, h('option', { value: 'long' }, 'Long-term (no end date)'), h('option', { value: 'temp' }, 'Temporary (has an end date)'));
  const end = h('input', { type: 'date', value: m.end || dstr(addDays(new Date(), 7)) });
  const endWrap = h('div', null, h('label', { class: 'field' }, 'Last day to take it'), end);
  const syncKind = () => (endWrap.style.display = kind.value === 'temp' ? '' : 'none');
  kind.addEventListener('change', syncKind);
  syncKind();

  const timesBox = h('div');
  const timeInputs = [];
  const addTime = (val) => {
    const input = h('input', { type: 'time', value: val });
    const row = h('div', { class: 'row', style: 'margin-bottom:6px' }, h('div', { class: 'grow' }, input), h('button', { type: 'button', class: 'btn small ghost', onclick: () => {
      if (timeInputs.length > 1) { timeInputs.splice(timeInputs.indexOf(input), 1); row.remove(); }
    } }, '✕'));
    timeInputs.push(input);
    timesBox.append(row);
  };
  (m.times.length ? m.times : ['08:00']).forEach(addTime);

  const dayBoxes = DOW.map((l, i) => h('label', null, h('input', { type: 'checkbox', checked: m.days.includes(i) }), l));
  const schedWrap = h('div', null,
    h('label', { class: 'field' }, 'Times each day'), timesBox,
    h('button', { type: 'button', class: 'btn small', onclick: () => addTime('12:00') }, '+ Add another time'),
    h('label', { class: 'field' }, 'Days (leave all unselected for every day)'), h('div', { class: 'days' }, dayBoxes));
  const minHours = h('input', { type: 'number', inputmode: 'decimal', min: '0', step: '0.5', value: m.minHours ?? '', placeholder: 'e.g. 4 (optional)' });
  const prnWrap = h('div', null,
    h('label', { class: 'field' }, 'Hours to wait between doses, if your doctor or the label says so (optional)'), minHours,
    h('p', { class: 'muted small' }, 'You tap “Take now” each time you take it. If you tap again before this many hours have passed, the app asks you to confirm.'));
  const sched = h('select', { value: m.asNeeded ? 'prn' : 'sched' },
    h('option', { value: 'sched' }, 'Scheduled (set times each day)'), h('option', { value: 'prn' }, 'As needed (no set time)'));
  const syncSched = () => {
    const prn = sched.value === 'prn';
    schedWrap.style.display = prn ? 'none' : '';
    prnWrap.style.display = prn ? '' : 'none';
  };
  sched.addEventListener('change', syncSched);
  syncSched();

  const body = h('div', null,
    h('label', { class: 'field' }, 'Medication name'), name,
    h('label', { class: 'field' }, 'Dose'), dose,
    h('label', { class: 'field' }, 'How do you take it?'), sched,
    schedWrap, prnWrap,
    h('label', { class: 'field' }, 'Type'), kind, endWrap,
    h('label', { class: 'field' }, 'Start date'), start,
    h('label', { class: 'field' }, 'Notes'), notes);

  const read = () => {
    if (!name.value.trim()) { toast('Enter a medication name.'); return null; }
    const asNeeded = sched.value === 'prn';
    let times = [];
    if (!asNeeded) {
      times = [...new Set(timeInputs.map((i) => i.value).filter(Boolean))].sort();
      if (!times.length) { toast('Add at least one time.'); return null; }
    }
    const days = asNeeded ? [] : dayBoxes.map((l, i) => (l.firstChild.checked ? i : -1)).filter((i) => i >= 0);
    return {
      name: name.value.trim(), dose: dose.value.trim(), times, days: days.length === 7 ? [] : days, asNeeded,
      minHours: asNeeded && Number(minHours.value) > 0 ? Number(minHours.value) : null,
      start: start.value || dstr(), end: kind.value === 'temp' ? end.value : null, notes: notes.value.trim(),
    };
  };
  return { body, read };
}

function icsFor(meds) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
  const names = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//MyLife//Meds//EN'];
  for (const med of meds) {
    for (const t of med.times) {
      const start = med.start.replace(/-/g, '') + 'T' + t.replace(':', '') + '00';
      const rule = ['FREQ=DAILY'];
      if (med.days?.length) rule[0] = `FREQ=WEEKLY;BYDAY=${med.days.map((d) => names[d]).join(',')}`;
      if (med.end) rule.push('UNTIL=' + med.end.replace(/-/g, '') + 'T235959');
      lines.push('BEGIN:VEVENT', `UID:${med.id}-${t}@mylife`, `DTSTAMP:${stamp}`, `DTSTART:${start}`, 'DURATION:PT15M',
        `RRULE:${rule.join(';')}`, `SUMMARY:Take ${med.name}${med.dose ? ' ' + med.dose : ''}`,
        'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Medication reminder', 'TRIGGER:PT0M', 'END:VALARM', 'END:VEVENT');
    }
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

function render(root) {
  const d = data();
  const today = dstr();
  const now = new Date();
  const rerender = () => render(root);
  const doses = dosesForDate(today);

  const notifLine = !notifSupported
    ? 'This browser cannot show notifications.'
    : notifStatus() === 'granted'
      ? 'Notifications are on.'
      : notifStatus() === 'denied'
        ? 'Notifications are blocked. Allow them in the browser site settings.'
        : null;

  const takenAt = (dose) => {
    const when = h('input', { type: 'datetime-local', value: toLocalInput(dose.due.getTime()) });
    modal(`${dose.med.name}: when did you take it?`, h('div', null, h('label', { class: 'field' }, 'Time taken'), when,
      h('p', { class: 'muted small' }, `Scheduled for ${fmtTime(dose.time)}.`)),
      [{ label: 'Cancel' }, { label: 'Save', kind: 'primary', onClick: () => {
        const ts = new Date(when.value).getTime();
        if (!ts) { toast('Pick a time.'); return false; }
        logDose(dose, 'taken', ts);
        toast(`Logged ${dose.med.name} at ${fmtStamp(ts)}`);
        rerender();
      } }]);
  };
  const prnMeds = asNeededMeds();
  const todayCount = (med) => d.prn.filter((p) => p.medId === med.id && dstr(new Date(p.at)) === today).length;
  const recent = [...d.prn].sort((a, b) => b.at - a.at).slice(0, 8);
  const logLater = (med) => {
    const when = h('input', { type: 'datetime-local', value: toLocalInput(Date.now()) });
    const note = h('input', { placeholder: 'Note (optional): reason, how you feel…' });
    modal(`Log ${med.name}`, h('div', null, h('label', { class: 'field' }, 'When'), when, h('label', { class: 'field' }, 'Note'), note),
      [{ label: 'Cancel' }, { label: 'Save', kind: 'primary', onClick: () => {
        logPrn(med, { at: new Date(when.value).getTime() || Date.now(), note: note.value.trim() });
        toast(`Logged ${med.name}`);
        rerender();
      } }]);
  };
  const prnCard = h('div', { class: 'card' }, h('h2', null, 'As needed'),
    prnMeds.length ? prnMeds.map((med) => {
      const last = lastPrn(med);
      return h('div', { class: 'item' },
        h('div', { class: 'grow' }, h('strong', null, med.name), med.dose ? ` · ${med.dose}` : '',
          h('div', { class: 'muted small' }, last ? `Last: ${fmtStamp(last.at)} (${ago(last.at)}) · ${todayCount(med)} today` : 'Not taken yet', med.minHours ? ` · wait ${med.minHours}h` : '')),
        h('button', { class: 'btn small primary', onclick: () => takeNow(med, rerender) }, 'Take now'),
        h('button', { class: 'btn small', 'aria-label': `Log ${med.name} with a note or an earlier time`, onclick: () => logLater(med) }, '✎'));
    }) : h('p', { class: 'muted' }, 'For medicines you take only when you need them, with no set time. Add one, then tap “Take now” each time and the time is recorded.'),
    h('button', { class: 'btn block', style: 'margin-top:8px', onclick: () => editMed(null, { asNeeded: true, times: [] }) }, '+ Add an as-needed medication'),
    recent.length ? [h('h3', null, 'Recent as-needed doses'), recent.map((p) => {
      const med = d.meds.find((x) => x.id === p.medId);
      return h('div', { class: 'item' },
        h('div', { class: 'grow' }, h('strong', null, med ? med.name : '(removed)'), ` · ${fmtDate(dstr(new Date(p.at)))} ${fmtStamp(p.at)}`, p.note ? h('div', { class: 'muted small' }, p.note) : null),
        h('button', { class: 'btn small ghost', 'aria-label': 'Delete entry', onclick: () => { d.prn = d.prn.filter((x) => x.id !== p.id); Store.save(); rerender(); } }, '✕'));
    })] : null);

  const view = h('div', null,
    h('div', { class: 'banner' }, '⚠️ Reminders only fire while this app is open in your browser. Keep a regular phone alarm as a backup until you trust them. You can also export your schedule to your phone calendar below.'),
    prnCard,
    h('div', { class: 'card' },
      h('h2', null, "Today's doses"),
      doses.length ? doses.map((dose) => {
        const s = doseState(dose, now);
        return h('div', { class: 'item stack' },
          h('div', { class: 'grow' }, h('strong', null, fmtTime(dose.time)), ' ', dose.med.name, dose.med.dose ? ` · ${dose.med.dose}` : '', dose.med.notes ? h('div', { class: 'muted small' }, dose.med.notes) : null,
            dose.entry ? h('div', { class: 'small' }, h('span', { class: `pill ${s}` }, doseDetail(dose))) : s === 'missed' ? h('div', null, h('span', { class: 'pill missed' }, 'missed')) : s === 'due' ? h('div', null, h('span', { class: 'pill due' }, 'due now')) : null),
          dose.entry
            ? h('button', { class: 'btn small ghost', onclick: () => { logDose(dose, null); rerender(); } }, 'Undo')
            : h('div', { class: 'actions' },
                h('button', { class: 'btn small primary', onclick: () => { logDose(dose, 'taken'); toast(`Logged ${dose.med.name} at ${fmtStamp(Date.now())}`); rerender(); } }, 'Taken now'),
                h('button', { class: 'btn small', onclick: () => takenAt(dose) }, 'Taken at…'),
                h('button', { class: 'btn small', onclick: () => { logDose(dose, 'skipped'); rerender(); } }, 'Skip')));
      }) : empty('Nothing scheduled today.')),
    notifLine ? h('p', { class: 'muted small' }, notifLine) : h('button', { class: 'btn block', onclick: async () => { await askPermission(); beep(1); rerender(); } }, '🔔 Turn on notifications'),
  );

  const current = d.meds.filter((m) => isCurrent(m, today));
  const past = d.meds.filter((m) => !isCurrent(m, today));
  const medRow = (m) => h('div', { class: 'item' },
    h('div', { class: 'grow' }, h('strong', null, m.name), m.dose ? ` · ${m.dose}` : '',
      h('div', { class: 'muted small' }, m.asNeeded ? 'As needed' + (m.minHours ? ` · wait ${m.minHours}h between doses` : '') : [m.times.map(fmtTime).join(', '), m.days?.length ? ' · ' + m.days.map((i) => DOW[i]).join('') : ' · daily'], m.end ? ` · until ${fmtDate(m.end)}` : '')),
    h('button', { class: 'btn small', onclick: () => editMed(m) }, 'Edit'));

  function editMed(m, preset) {
    const f = medForm(m, preset);
    const actions = [{ label: 'Cancel' }, { label: 'Save', kind: 'primary', onClick: () => {
      const v = f.read();
      if (!v) return false;
      if (m) Object.assign(m, v); else d.meds.push({ id: uid(), ...v });
      Store.save();
      rerender();
    } }];
    modal(m ? 'Edit medication' : 'Add medication', f.body, actions);
    if (m) {
      const extra = h('div', { class: 'row', style: 'margin-top:12px' },
        isCurrent(m) ? h('button', { class: 'btn small', onclick: () => { m.end = dstr(); Store.save(); document.querySelector('.overlay')?.remove(); rerender(); } }, 'Stop taking (as of today)') : null,
        h('button', { class: 'btn small danger', onclick: async () => {
          if (await confirmBox(`Delete ${m.name} and its history?`)) {
            d.meds = d.meds.filter((x) => x.id !== m.id); d.log = d.log.filter((l) => l.medId !== m.id); d.prn = d.prn.filter((p) => p.medId !== m.id);
            Store.save(); document.querySelector('.overlay')?.remove(); rerender();
          }
        } }, 'Delete'));
      document.querySelector('.sheet-body').append(extra);
    }
  }

  const a7 = adherence(dstr(addDays(new Date(), -6)), today);
  const a30 = adherence(dstr(addDays(new Date(), -29)), today);
  view.append(
    h('div', { class: 'card' }, h('h2', null, 'My medications'),
      current.length ? current.map(medRow) : empty('No medications yet.'),
      h('button', { class: 'btn primary block', style: 'margin-top:10px', onclick: () => editMed(null) }, '+ Add medication')),
    h('div', { class: 'card' }, h('h2', null, 'Adherence'),
      h('div', { class: 'grid2' },
        h('div', { class: 'stat' }, h('div', { class: 'big' }, a7.pct == null ? '–' : a7.pct + '%'), h('div', { class: 'lbl' }, `Last 7 days (${a7.taken}/${a7.total})`)),
        h('div', { class: 'stat' }, h('div', { class: 'big' }, a30.pct == null ? '–' : a30.pct + '%'), h('div', { class: 'lbl' }, `Last 30 days (${a30.taken}/${a30.total})`))),
      h('p', { class: 'muted small' }, 'Missed = no response within 2 hours of the scheduled time.')),
    current.some((m) => !m.asNeeded) ? h('button', { class: 'btn block', onclick: () => { download('mylife-medications.ics', icsFor(current.filter((m) => !m.asNeeded)), 'text/calendar'); toast('Open the file to add reminders to your calendar.'); } }, '📅 Export schedule to phone calendar (.ics)') : null,
    past.length ? h('div', { class: 'card', style: 'margin-top:14px' }, h('h2', null, 'Past medications'), past.map(medRow)) : null);

  mount(root, view);
}

function todayCard() {
  const doses = dosesForDate(dstr());
  const prn = asNeededMeds();
  if (!doses.length && !prn.length) return null;
  const now = new Date();
  const open = doses.filter((x) => !x.entry);
  const next = open.filter((x) => doseState(x, now) !== 'missed').slice(0, 3);
  const taken = doses.filter((x) => x.entry?.status === 'taken').length;
  const refresh = () => window.dispatchEvent(new Event('mylife:refresh'));
  const card = h('div', { class: 'card' }, h('div', { class: 'row' }, h('h2', { class: 'grow' }, '💊 Medications'), doses.length ? h('span', { class: 'muted' }, `${taken}/${doses.length} taken`) : null));
  if (doses.length && !next.length) card.append(h('p', { class: 'muted' }, open.length ? 'Some doses were missed today.' : 'All done for today. 🎉'));
  for (const dose of next) {
    const s = doseState(dose, now);
    card.append(h('div', { class: 'item' }, h('div', { class: 'grow' }, h('strong', null, fmtTime(dose.time)), ' ', dose.med.name, dose.med.dose ? ` · ${dose.med.dose}` : ''),
      s === 'due' ? h('span', { class: 'pill due' }, 'due') : null,
      h('button', { class: 'btn small primary', onclick: () => { logDose(dose, 'taken'); toast(`Logged ${dose.med.name} at ${fmtStamp(Date.now())}`); refresh(); } }, 'Taken now')));
  }
  for (const med of prn) {
    const last = lastPrn(med);
    card.append(h('div', { class: 'item' },
      h('div', { class: 'grow' }, h('strong', null, med.name), med.dose ? ` · ${med.dose}` : '', h('div', { class: 'muted small' }, 'As needed · ', last ? `last ${fmtStamp(last.at)} (${ago(last.at)})` : 'not taken yet')),
      h('button', { class: 'btn small primary', onclick: () => takeNow(med, refresh) }, 'Take now')));
  }
  card.append(h('a', { class: 'small', href: '#/meds' }, 'Open medications →'));
  return card;
}

export default { id: 'meds', name: 'Medications', tab: 'Meds', icon: '💊', blurb: 'Reminders and dose log', render, todayCard };
