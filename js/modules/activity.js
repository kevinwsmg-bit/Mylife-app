// Physical activity plus how you feel (pain level and area, mood, notes), so a care team sees the full picture.
import { Store } from '../core/store.js';
import { mount, h, toast, confirmBox, empty } from '../core/dom.js';
import { dstr, fmtDate, fmtStamp, avg, round, uid, toLocalInput } from '../core/util.js';
import { micButton } from '../core/voice.js';
import { lineChart } from '../core/charts.js';

const data = () => Store.get('activity', { entries: [], lastArea: 'Back' });
export const activityEntries = () => data().entries;

export const ACTIVITIES = ['Walking', 'Stretching / physical therapy', 'Strength / weights', 'Cycling', 'Swimming', 'Housework / errands', 'Standing', 'Resting / lying down', 'Just checking in'];
const AREAS = ['Back', 'Neck', 'Hip', 'Leg', 'Head', 'Chest', 'Stomach', 'Other'];
export const FEELS = ['😞', '😕', '😐', '🙂', '😄'];
export const feelLabel = (n) => (n ? FEELS[n - 1] : '');

export function summary(list) {
  const withPain = list.filter((e) => e.pain != null);
  const worst = [...withPain].sort((a, b) => b.pain - a.pain || b.at - a.at)[0];
  return {
    n: list.length,
    minutes: list.reduce((s, e) => s + (e.minutes || 0), 0),
    avgPain: round(avg(withPain.map((e) => e.pain)), 1),
    worstPain: worst ? worst.pain : null,
    worstAt: worst ? worst.at : null,
  };
}

// Quick entry used by the Today screen: one tap logs a pain level.
export function addEntry(fields) {
  const d = data();
  d.entries.push({ id: uid(), at: Date.now(), activity: 'Just checking in', minutes: null, pain: null, area: d.lastArea, feeling: null, notes: '', ...fields });
  if (fields.area) d.lastArea = fields.area;
  Store.save();
}

const painClass = (n) => (n >= 7 ? 'missed' : n >= 4 ? 'due' : '');
const inRange = (list, days) => list.filter((e) => e.at >= Date.now() - days * 864e5);
const byDay = (list) => {
  const map = {};
  for (const e of list) (map[dstr(new Date(e.at))] ||= []).push(e);
  return map;
};

function render(root) {
  const d = data();
  const rerender = () => render(root);
  let pain = null;
  let feeling = null;

  const activity = h('select', { 'aria-label': 'Activity', value: 'Just checking in' }, ACTIVITIES.map((a) => h('option', { value: a }, a)));
  const minutes = h('input', { type: 'number', inputmode: 'numeric', min: '0', placeholder: 'Optional', 'aria-label': 'Minutes' });
  const area = h('select', { value: d.lastArea, 'aria-label': 'Where does it hurt' }, AREAS.map((a) => h('option', { value: a }, a)));
  const notes = h('textarea', { placeholder: 'Notes: what you were doing, what it felt like, what helped or made it worse…' });
  const when = h('input', { type: 'datetime-local', value: toLocalInput(Date.now()) });

  const painBtns = [...Array(11).keys()].map((n) => h('button', { type: 'button', class: 'btn num', 'aria-label': `Pain ${n}`, onclick: () => {
    pain = pain === n ? null : n;
    painBtns.forEach((b, i) => b.classList.toggle('on', pain === i));
  } }, n));
  const feelBtns = FEELS.map((f, i) => h('button', { type: 'button', class: 'btn', 'aria-label': `Feeling ${i + 1} of 5`, onclick: () => {
    feeling = feeling === i + 1 ? null : i + 1;
    feelBtns.forEach((b, j) => b.classList.toggle('on', feeling === j + 1));
  } }, f));
  const mic = micButton((t) => { notes.value = (notes.value ? notes.value + ' ' : '') + t; }, 'Dictate a note');

  const save = () => {
    const min = Number(minutes.value) || null;
    if (pain == null && feeling == null && !notes.value.trim() && !min && activity.value === 'Just checking in') {
      return toast('Add a pain level, how you feel, minutes or a note first.');
    }
    d.entries.push({ id: uid(), at: new Date(when.value).getTime() || Date.now(), activity: activity.value, minutes: min, pain, area: area.value, feeling, notes: notes.value.trim() });
    d.lastArea = area.value;
    Store.save();
    toast('Saved');
    rerender();
  };

  const entry = h('div', { class: 'card' }, h('h2', null, 'Log activity and how you feel'),
    h('label', { class: 'field' }, 'What are you doing?'), activity,
    h('div', { class: 'grid2' }, h('div', null, h('label', { class: 'field' }, 'Minutes'), minutes), h('div', null, h('label', { class: 'field' }, 'Where is the pain?'), area)),
    h('label', { class: 'field' }, 'Pain right now (0 = none, 10 = worst)'), h('div', { class: 'seg' }, painBtns),
    h('label', { class: 'field' }, 'Overall, how are you feeling?'), h('div', { class: 'seg' }, feelBtns),
    h('div', { class: 'row', style: 'margin-top:8px' }, h('div', { class: 'grow' }, notes), mic),
    h('details', { style: 'margin:8px 0' }, h('summary', { class: 'muted' }, 'Change date/time'), when),
    h('button', { class: 'btn primary block', onclick: save }, 'Save'));

  const week = summary(inRange(d.entries, 7));
  const month = summary(inRange(d.entries, 30));
  const stat = (label, s) => h('div', { class: 'stat' }, h('div', { class: 'big' }, s.n ? (s.avgPain == null ? '–' : s.avgPain) : '–'), h('div', { class: 'lbl' }, `${label} avg pain`),
    h('div', { class: 'lbl' }, `${s.minutes} active min · ${s.n} entries`), s.worstPain != null ? h('div', { class: 'lbl' }, `worst ${s.worstPain}/10`) : null);
  const stats = h('div', { class: 'card' }, h('h2', null, 'Summary'), h('div', { class: 'grid2' }, stat('7-day', week), stat('30-day', month)));

  const days30 = byDay(inRange(d.entries, 30));
  const keys = Object.keys(days30).sort();
  const t = (k) => new Date(k + 'T12:00').getTime();
  const painDays = keys.filter((k) => days30[k].some((e) => e.pain != null));
  const avgPts = painDays.map((k) => ({ t: t(k), y: avg(days30[k].filter((e) => e.pain != null).map((e) => e.pain)) }));
  const maxPts = painDays.map((k) => ({ t: t(k), y: Math.max(...days30[k].filter((e) => e.pain != null).map((e) => e.pain)) }));
  const minPts = keys.map((k) => ({ t: t(k), y: days30[k].reduce((s, e) => s + (e.minutes || 0), 0) })).filter((p) => p.y > 0);
  const charts = h('div', { class: 'card' }, h('h2', null, 'Last 30 days'),
    painDays.length ? [h('h3', null, 'Pain by day (0 to 10)'), lineChart([{ label: 'Worst', color: 'var(--c2)', points: maxPts }, { label: 'Average', color: 'var(--c1)', points: avgPts }]),
      h('div', { class: 'legend' }, h('span', null, h('i', { style: 'background:var(--c2)' }), 'Worst of the day'), h('span', null, h('i', { style: 'background:var(--c1)' }), 'Average'))] : null,
    minPts.length ? [h('h3', null, 'Active minutes per day'), lineChart([{ label: 'Minutes', color: 'var(--c3)', points: minPts }])] : null,
    !painDays.length && !minPts.length ? empty('Log a few entries to see your pain and activity over time.') : null);

  const all = [...d.entries].sort((a, b) => b.at - a.at);
  const grouped = byDay(all);
  const dayKeys = Object.keys(grouped).sort().reverse();
  const history = h('div', { class: 'card' }, h('h2', null, 'History'));
  if (!all.length) history.append(empty('No entries yet.'));
  dayKeys.slice(0, 30).forEach((k) => {
    history.append(h('h3', null, fmtDate(k)));
    for (const e of grouped[k].sort((a, b) => b.at - a.at)) {
      history.append(h('div', { class: 'item' },
        h('div', { class: 'grow' }, h('strong', null, e.activity), e.minutes ? ` · ${e.minutes} min` : '', ` · ${fmtStamp(e.at)}`, e.feeling ? ` ${feelLabel(e.feeling)}` : '',
          e.pain != null ? h('div', null, h('span', { class: `pill ${painClass(e.pain)}` }, `${e.area || 'Pain'} ${e.pain}/10`)) : null,
          e.notes ? h('div', { class: 'muted small' }, e.notes) : null),
        h('button', { class: 'btn small ghost', 'aria-label': 'Delete entry', onclick: async () => {
          if (await confirmBox('Delete this entry?')) { d.entries = d.entries.filter((x) => x.id !== e.id); Store.save(); rerender(); }
        } }, '✕')));
    }
  });

  mount(root, entry, stats, charts, history);
}

function todayCard() {
  const d = data();
  const last = [...d.entries].sort((a, b) => b.at - a.at)[0];
  const today = d.entries.filter((e) => dstr(new Date(e.at)) === dstr());
  const s = summary(today);
  const refresh = () => window.dispatchEvent(new Event('mylife:refresh'));
  const card = h('div', { class: 'card' }, h('div', { class: 'row' }, h('h2', { class: 'grow' }, '🏃 Activity & how I feel'), h('a', { href: '#/activity' }, 'Details →')),
    h('p', { class: 'muted small', style: 'margin-top:0' }, 'Tap your pain level right now (0 = none, 10 = worst):'),
    h('div', { class: 'seg' }, [...Array(11).keys()].map((n) => h('button', { class: 'btn num', 'aria-label': `Log pain ${n}`, onclick: () => { addEntry({ pain: n }); toast(`Logged ${d.lastArea || 'pain'} ${n}/10`); refresh(); } }, n))),
    last ? h('p', { class: 'muted small' }, `Last: ${last.pain != null ? `${last.area || 'pain'} ${last.pain}/10 · ` : ''}${last.activity} · ${fmtDate(dstr(new Date(last.at)))} ${fmtStamp(last.at)}`) : null,
    s.n ? h('p', { class: 'muted small' }, `Today: ${s.n} entr${s.n === 1 ? 'y' : 'ies'}${s.minutes ? ` · ${s.minutes} active min` : ''}${s.worstPain != null ? ` · worst pain ${s.worstPain}/10` : ''}`) : null);
  return card;
}

export default { id: 'activity', name: 'Activity & How I Feel', tab: 'Activity', icon: '🏃', blurb: 'Exercise, pain level, mood, notes', render, todayCard };
