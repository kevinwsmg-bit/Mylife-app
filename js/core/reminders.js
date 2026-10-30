// Medication reminders. Only runs while the app is open or in the background of the browser,
// so it is a convenience, not a guaranteed alarm. Keep a backup alarm on the phone.
import { dstr, addDays, fmtTime } from './util.js';
import { h, modal } from './dom.js';
import { beep, showNotification } from './notify.js';
import { dosesForDate, logDose } from '../modules/meds.js';

const KEY = 'mylife:alerts';
const REPEAT_MIN = 10;
const MAX_ALERTS = 4;
const WINDOW_MIN = 180;

const load = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {};
  } catch (e) {
    return {};
  }
};
const save = (a) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(a));
  } catch (e) {}
};

let open = null;

function ring(dose) {
  const label = `${dose.med.name}${dose.med.dose ? ' ' + dose.med.dose : ''}`;
  beep();
  showNotification('Time for your medication', `${label} (${fmtTime(dose.time)})`, dose.key);
  if (document.querySelector('.alarm')) return;
  const body = h('div', { class: 'alarm' }, h('div', { class: 'alarm-time' }, fmtTime(dose.time)), h('div', { class: 'alarm-med' }, label));
  const done = (status) => () => {
    logDose(dose, status);
    open = null;
    setTimeout(() => window.dispatchEvent(new Event('mylife:refresh')), 0); // after the modal closes
  };
  open = modal('Medication reminder', body, [
    { label: '✓ Taken now', kind: 'primary', onClick: done('taken') },
    { label: 'Snooze 10 min', onClick: () => { open = null; } },
    { label: 'Skip', onClick: done('skipped') },
  ]);
}

export function tick() {
  const now = new Date();
  const alerts = load();
  const doses = [...dosesForDate(dstr(addDays(now, -1))), ...dosesForDate(dstr(now))];
  for (const d of doses) {
    if (d.entry) continue;
    const mins = (now - d.due) / 60000;
    if (mins < 0 || mins > WINDOW_MIN) continue;
    const a = alerts[d.key] || { n: 0, last: 0 };
    if (a.n >= MAX_ALERTS) continue;
    if (a.n > 0 && now - a.last < REPEAT_MIN * 60000) continue;
    alerts[d.key] = { n: a.n + 1, last: now.getTime() };
    save(alerts);
    ring(d);
    break; // one at a time
  }
  // forget old alert records
  const cutoff = now.getTime() - 2 * 864e5;
  for (const k of Object.keys(alerts)) if (alerts[k].last < cutoff) delete alerts[k];
  save(alerts);
}

export function startReminders() {
  tick();
  setInterval(tick, 20000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) tick();
  });
}
