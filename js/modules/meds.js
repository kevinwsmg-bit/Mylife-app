// Medications: schedules, taken/skipped log, adherence, reminders, calendar export.
import { Store } from '../core/store.js';
import { mount, h, modal, confirmBox, toast, empty } from '../core/dom.js';
import { dstr, parseD, addDays, fmtTime, fmtDate, uid, pad, download } from '../core/util.js';
import { notifStatus, notifSupported, askPermission, beep } from '../core/notify.js';

const data = () => Store.get('meds', { meds: [], log: [] });
const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export const isCurrent = (med, today = dstr()) => !med.end || med.end >= today;

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

export function logDose(dose, status) {
  const d = data();
  d.log = d.log.filter((l) => l.key !== dose.key);
  if (status) d.log.push({ key: dose.key, medId: dose.med.id, date: dose.date, time: dose.time, status, at: Date.now() });
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

function medForm(existing) {
  const m = existing || { name: '', dose: '', times: ['08:00'], days: [], start: dstr(), end: null, notes: '' };
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
  m.times.forEach(addTime);

  const dayBoxes = DOW.map((l, i) => h('label', null, h('input', { type: 'checkbox', checked: m.days.includes(i) }), l));
  const body = h('div', null,
    h('label', { class: 'field' }, 'Medication name'), name,
    h('label', { class: 'field' }, 'Dose'), dose,
    h('label', { class: 'field' }, 'Times each day'), timesBox,
    h('button', { type: 'button', class: 'btn small', onclick: () => addTime('12:00') }, '+ Add another time'),
    h('label', { class: 'field' }, 'Days (leave all unselected for every day)'), h('div', { class: 'days' }, dayBoxes),
    h('label', { class: 'field' }, 'Type'), kind, endWrap,
    h('label', { class: 'field' }, 'Start date'), start,
    h('label', { class: 'field' }, 'Notes'), notes);

  const read = () => {
    if (!name.value.trim()) { toast('Enter a medication name.'); return null; }
    const times = [...new Set(timeInputs.map((i) => i.value).filter(Boolean))].sort();
    if (!times.length) { toast('Add at least one time.'); return null; }
    const days = dayBoxes.map((l, i) => (l.firstChild.checked ? i : -1)).filter((i) => i >= 0);
    return { name: name.value.trim(), dose: dose.value.trim(), times, days: days.length === 7 ? [] : days, start: start.value || dstr(), end: kind.value === 'temp' ? end.value : null, notes: notes.value.trim() };
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

  const view = h('div', null,
    h('div', { class: 'banner' }, '⚠️ Reminders only fire while this app is open in your browser. Keep a regular phone alarm as a backup until you trust them. You can also export your schedule to your phone calendar below.'),
    h('div', { class: 'card' },
      h('h2', null, "Today's doses"),
      doses.length ? doses.map((dose) => {
        const s = doseState(dose, now);
        return h('div', { class: 'item' },
          h('div', { class: 'grow' }, h('strong', null, fmtTime(dose.time)), ' ', dose.med.name, dose.med.dose ? ` · ${dose.med.dose}` : '', dose.med.notes ? h('div', { class: 'muted small' }, dose.med.notes) : null),
          dose.entry
            ? [h('span', { class: `pill ${s}` }, s), h('button', { class: 'btn small ghost', onclick: () => { logDose(dose, null); rerender(); } }, 'Undo')]
            : [s === 'missed' ? h('span', { class: 'pill missed' }, 'missed') : null,
               h('button', { class: 'btn small primary', onclick: () => { logDose(dose, 'taken'); toast(`Logged ${dose.med.name}`); rerender(); } }, 'Taken'),
               h('button', { class: 'btn small', onclick: () => { logDose(dose, 'skipped'); rerender(); } }, 'Skip')]);
      }) : empty('Nothing scheduled today.')),
    notifLine ? h('p', { class: 'muted small' }, notifLine) : h('button', { class: 'btn block', onclick: async () => { await askPermission(); beep(1); rerender(); } }, '🔔 Turn on notifications'),
  );

  const current = d.meds.filter((m) => isCurrent(m, today));
  const past = d.meds.filter((m) => !isCurrent(m, today));
  const medRow = (m) => h('div', { class: 'item' },
    h('div', { class: 'grow' }, h('strong', null, m.name), m.dose ? ` · ${m.dose}` : '',
      h('div', { class: 'muted small' }, m.times.map(fmtTime).join(', '), m.days?.length ? ' · ' + m.days.map((i) => DOW[i]).join('') : ' · daily', m.end ? ` · until ${fmtDate(m.end)}` : '')),
    h('button', { class: 'btn small', onclick: () => editMed(m) }, 'Edit'));

  function editMed(m) {
    const f = medForm(m);
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
            d.meds = d.meds.filter((x) => x.id !== m.id); d.log = d.log.filter((l) => l.medId !== m.id);
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
    current.length ? h('button', { class: 'btn block', onclick: () => { download('mylife-medications.ics', icsFor(current), 'text/calendar'); toast('Open the file to add reminders to your calendar.'); } }, '📅 Export schedule to phone calendar (.ics)') : null,
    past.length ? h('div', { class: 'card', style: 'margin-top:14px' }, h('h2', null, 'Past medications'), past.map(medRow)) : null);

  mount(root, view);
}

function todayCard() {
  const doses = dosesForDate(dstr());
  if (!doses.length) return null;
  const now = new Date();
  const open = doses.filter((x) => !x.entry);
  const next = open.filter((x) => doseState(x, now) !== 'missed').slice(0, 3);
  const taken = doses.filter((x) => x.entry?.status === 'taken').length;
  const card = h('div', { class: 'card' }, h('div', { class: 'row' }, h('h2', { class: 'grow' }, '💊 Medications'), h('span', { class: 'muted' }, `${taken}/${doses.length} taken`)));
  if (!next.length) card.append(h('p', { class: 'muted' }, open.length ? 'Some doses were missed today.' : 'All done for today. 🎉'));
  for (const dose of next) {
    const s = doseState(dose, now);
    card.append(h('div', { class: 'item' }, h('div', { class: 'grow' }, h('strong', null, fmtTime(dose.time)), ' ', dose.med.name, dose.med.dose ? ` · ${dose.med.dose}` : ''),
      s === 'due' ? h('span', { class: 'pill due' }, 'due') : null,
      h('button', { class: 'btn small primary', onclick: () => { logDose(dose, 'taken'); window.dispatchEvent(new Event('mylife:refresh')); } }, 'Taken')));
  }
  card.append(h('a', { class: 'small', href: '#/meds' }, 'Open medications →'));
  return card;
}

export default { id: 'meds', name: 'Medications', tab: 'Meds', icon: '💊', blurb: 'Reminders and dose log', render, todayCard };
