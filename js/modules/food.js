// Food and drink log: one tap or one sentence, stamped with the date and time automatically.
import { Store } from '../core/store.js';
import { mount, h, whenInput, toast, confirmBox, empty } from '../core/dom.js';
import { dstr, fmtDate, fmtStamp, uid, capFirst, toLocalInput } from '../core/util.js';
import { micButton } from '../core/voice.js';
import { inReport, setInReport } from '../core/reportcfg.js';

const MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Drink'];

const data = () => {
  const d = Store.get('food', { entries: [], imported: false });
  if (!d.imported) {
    // One-time move of food entries that used to live in the Journal module.
    const j = Store.get('journal', { entries: {}, food: [] });
    if (Array.isArray(j.food) && j.food.length) {
      d.entries.push(...j.food);
      j.food = [];
    }
    d.imported = true;
    Store.save();
  }
  return d;
};
export const foodEntries = () => data().entries;
export const guessMeal = (hr = new Date().getHours()) => (hr < 11 ? 'Breakfast' : hr < 15 ? 'Lunch' : hr < 20 ? 'Dinner' : 'Snack');

export function addFood(text, { meal = guessMeal(), at = Date.now(), note = '' } = {}) {
  const t = text.trim();
  if (!t) return null;
  const entry = { id: uid(), at, meal, text: capFirst(t), note: note.trim() };
  data().entries.push(entry);
  Store.save();
  return entry;
}

// Foods logged at least twice in the last 60 days, most frequent first (one-tap re-log).
function frequent(list) {
  const cut = Date.now() - 60 * 864e5;
  const by = {};
  for (const e of list) {
    if (e.at < cut) continue;
    const k = e.text.toLowerCase();
    (by[k] ||= { text: e.text, meal: e.meal, n: 0 }).n++;
  }
  return Object.values(by).filter((c) => c.n >= 2).sort((a, b) => b.n - a.n).slice(0, 8);
}

function includeBox() {
  return h('label', { class: 'item' },
    h('input', { type: 'checkbox', checked: inReport('food'), onchange: (e) => { setInReport('food', e.target.checked); toast(e.target.checked ? 'Food log will be in your doctor report.' : 'Food log left out of your doctor report.'); } }),
    h('div', { class: 'grow' }, 'Include my food log in the doctor report', h('div', { class: 'muted small' }, 'You can change this any time. Nothing is shared until you share the report.')));
}

function render(root) {
  const d = data();
  const rerender = () => render(root);
  let meal = guessMeal();

  const text = h('input', { placeholder: 'What did you eat or drink?', autocomplete: 'off', enterkeyhint: 'done', 'aria-label': 'Food or drink' });
  const note = h('input', { placeholder: 'Note (optional)' });
  const whenBox = whenInput();
  const when = whenBox.el;
  const mealBtns = MEALS.map((m) => h('button', { type: 'button', class: `btn ${m === meal ? 'on' : ''}`, onclick: () => {
    meal = m;
    mealBtns.forEach((b) => b.classList.toggle('on', b.textContent === meal));
  } }, m));

  const log = (t, opts = {}) => {
    const e = addFood(t, { meal, note: note.value, at: whenBox.at(), ...opts });
    if (!e) return toast('Type or say what you ate first.');
    toast(`Logged ${e.text} at ${fmtStamp(e.at)}`);
    rerender();
  };
  text.addEventListener('keydown', (e) => { if (e.key === 'Enter') log(text.value); });
  const mic = micButton((t) => log(t), 'Say what you ate');

  const entry = h('div', { class: 'card' }, h('h2', null, 'Log food or drink'),
    h('div', { class: 'row' }, h('div', { class: 'grow' }, text), mic),
    h('p', { class: 'muted small' }, 'Tap 🎤 and say it, or type it. The date and time are saved automatically.'),
    h('div', { class: 'seg' }, mealBtns), note,
    h('details', { style: 'margin:8px 0' }, h('summary', { class: 'muted' }, 'Change date/time'), when),
    h('button', { class: 'btn primary block', onclick: () => log(text.value) }, 'Log it'),
    includeBox());

  const freq = frequent(d.entries);
  const freqCard = freq.length ? h('div', { class: 'card' }, h('h2', null, 'Your usual'), h('div', { class: 'seg' }, freq.map((f) =>
    h('button', { class: 'btn small', onclick: () => { addFood(f.text, { meal: guessMeal() }); toast(`Logged ${f.text} at ${fmtStamp(Date.now())}`); rerender(); } }, `+ ${f.text}`)))) : null;

  const all = [...d.entries].sort((a, b) => b.at - a.at);
  const days = {};
  for (const e of all) (days[dstr(new Date(e.at))] ||= []).push(e);
  const keys = Object.keys(days).sort().reverse().slice(0, 14);
  const history = h('div', { class: 'card' }, h('h2', null, 'History'));
  if (!all.length) history.append(empty('Nothing logged yet.'));
  for (const k of keys) {
    history.append(h('h3', null, fmtDate(k), ` · ${days[k].length}`));
    for (const e of days[k].sort((a, b) => b.at - a.at)) {
      history.append(h('div', { class: 'item' },
        h('div', { class: 'grow' }, h('strong', null, fmtStamp(e.at)), ' ', e.text, h('div', { class: 'muted small' }, e.meal || '', e.note ? ` · ${e.note}` : '')),
        h('button', { class: 'btn small ghost', 'aria-label': `Delete ${e.text}`, onclick: async () => {
          if (await confirmBox(`Delete “${e.text}”?`)) { d.entries = d.entries.filter((x) => x.id !== e.id); Store.save(); rerender(); }
        } }, '✕')));
    }
  }
  mount(root, entry, freqCard, history);
}

function todayCard() {
  const d = data();
  const refresh = () => window.dispatchEvent(new Event('mylife:refresh'));
  const todays = d.entries.filter((e) => dstr(new Date(e.at)) === dstr()).sort((a, b) => b.at - a.at);
  const input = h('input', { placeholder: 'What are you eating?', autocomplete: 'off', enterkeyhint: 'done', 'aria-label': 'Food or drink' });
  const log = (t) => {
    const e = addFood(t);
    if (!e) return;
    toast(`Logged ${e.text} at ${fmtStamp(e.at)}`);
    refresh();
  };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') log(input.value); });
  return h('div', { class: 'card' }, h('div', { class: 'row' }, h('h2', { class: 'grow' }, '🍽️ Food'), h('a', { href: '#/food' }, 'Log →')),
    h('div', { class: 'row' }, h('div', { class: 'grow' }, input), micButton((t) => log(t), 'Say what you ate'), h('button', { class: 'btn primary', onclick: () => log(input.value) }, 'Add')),
    todays.length ? h('p', { class: 'muted small' }, `Last: ${todays[0].text} at ${fmtStamp(todays[0].at)} · ${todays.length} today`) : h('p', { class: 'muted small' }, 'Nothing logged today.'));
}

export default { id: 'food', name: 'Food Log', tab: 'Food', icon: '🍽️', blurb: 'What you eat, time-stamped', render, todayCard };
