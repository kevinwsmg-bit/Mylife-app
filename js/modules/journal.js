// Daily journal (with mood) and a simple food log.
import { Store } from '../core/store.js';
import { mount, h, toast, empty } from '../core/dom.js';
import { dstr, fmtDate, fmtStamp, uid, capFirst, toLocalInput } from '../core/util.js';
import { micButton } from '../core/voice.js';

const data = () => Store.get('journal', { entries: {}, food: [] });
const MOODS = ['😞', '😕', '😐', '🙂', '😄'];
let date = dstr();

function render(root) {
  const d = data();
  const rerender = () => render(root);
  const entry = (d.entries[date] ||= { text: '', mood: null });
  const text = h('textarea', { placeholder: 'How was today? Anything worth remembering…' }, entry.text);
  text.value = entry.text;
  let mood = entry.mood;
  const moodRow = h('div', { class: 'seg' }, MOODS.map((m, i) => h('button', { class: `btn ${mood === i + 1 ? 'on' : ''}`, 'aria-label': `Mood ${i + 1} of 5`, onclick: (e) => {
    mood = mood === i + 1 ? null : i + 1;
    [...moodRow.children].forEach((b, j) => b.classList.toggle('on', mood === j + 1));
  } }, m)));
  const mic = micButton((t) => { text.value = (text.value ? text.value + ' ' : '') + t; }, 'Dictate');

  const food = h('input', { placeholder: 'What did you eat?', autocomplete: 'off', enterkeyhint: 'done' });
  const meal = h('select', null, ['Breakfast', 'Lunch', 'Dinner', 'Snack'].map((m) => h('option', { value: m }, m)));
  const hr = new Date().getHours();
  meal.value = hr < 11 ? 'Breakfast' : hr < 15 ? 'Lunch' : hr < 20 ? 'Dinner' : 'Snack';
  const addFood = (t) => {
    if (!t.trim()) return;
    d.food.push({ id: uid(), at: Date.now(), meal: meal.value, text: capFirst(t.trim()) });
    Store.save();
    toast('Food logged');
    rerender();
  };
  food.addEventListener('keydown', (e) => { if (e.key === 'Enter') addFood(food.value); });
  const foodMic = micButton((t) => addFood(t), 'Say what you ate');

  const todaysFood = d.food.filter((f) => dstr(new Date(f.at)) === date).sort((a, b) => a.at - b.at);
  const past = Object.keys(d.entries).filter((k) => k !== date && (d.entries[k].text || d.entries[k].mood)).sort().reverse().slice(0, 14);

  mount(root, 
    h('div', { class: 'card' }, h('h2', null, 'Journal'),
      h('input', { type: 'date', value: date, max: dstr(), onchange: (e) => { if (e.target.value) { date = e.target.value; rerender(); } } }),
      h('div', { class: 'row', style: 'margin-top:8px' }, h('div', { class: 'grow' }, text), mic),
      h('label', { class: 'field' }, 'Mood'), moodRow,
      h('button', { class: 'btn primary block', onclick: () => {
        entry.text = text.value.trim();
        entry.mood = mood;
        if (!entry.text && !entry.mood) delete d.entries[date];
        Store.save();
        toast('Journal saved');
      } }, 'Save')),
    h('div', { class: 'card' }, h('h2', null, `Food · ${fmtDate(date)}`),
      h('div', { class: 'row' }, h('div', { style: 'width:120px' }, meal), h('div', { class: 'grow' }, food), foodMic),
      h('button', { class: 'btn block', style: 'margin-top:8px', onclick: () => addFood(food.value) }, 'Log food'),
      todaysFood.length ? todaysFood.map((f) => h('div', { class: 'item' }, h('div', { class: 'grow' }, h('strong', null, f.meal), ' · ', f.text, h('span', { class: 'muted small' }, ` ${fmtStamp(f.at)}`)),
        h('button', { class: 'btn small ghost', 'aria-label': 'Delete', onclick: () => { d.food = d.food.filter((x) => x.id !== f.id); Store.save(); rerender(); } }, '✕'))) : empty('Nothing logged for this day.')),
    past.length ? h('div', { class: 'card' }, h('h2', null, 'Earlier entries'), past.map((k) => h('div', { class: 'item' },
      h('div', { class: 'grow' }, h('strong', null, fmtDate(k)), ' ', d.entries[k].mood ? MOODS[d.entries[k].mood - 1] : '', h('div', { class: 'muted small' }, (d.entries[k].text || '').slice(0, 140))),
      h('button', { class: 'btn small', onclick: () => { date = k; rerender(); } }, 'Open')))) : null);
}

function todayCard() {
  const d = data();
  const e = d.entries[dstr()];
  const n = d.food.filter((f) => dstr(new Date(f.at)) === dstr()).length;
  return h('div', { class: 'card' }, h('div', { class: 'row' }, h('h2', { class: 'grow' }, '📔 Journal & food'), h('a', { href: '#/journal' }, e?.text ? 'Edit →' : 'Write →')),
    h('p', { class: 'muted small' }, `${e?.text ? 'Journal written' : 'No journal yet'} · ${n} food ${n === 1 ? 'entry' : 'entries'} today`));
}

export default { id: 'journal', name: 'Journal & Food', icon: '📔', blurb: 'Daily log, mood, meals', render, todayCard };
