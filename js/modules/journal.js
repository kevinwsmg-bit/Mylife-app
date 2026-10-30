// Daily journal with mood. (Food logging now lives in the Food Log module.)
import { Store } from '../core/store.js';
import { mount, h, toast } from '../core/dom.js';
import { dstr, fmtDate } from '../core/util.js';
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
  const moodRow = h('div', { class: 'seg' }, MOODS.map((m, i) => h('button', { class: `btn ${mood === i + 1 ? 'on' : ''}`, 'aria-label': `Mood ${i + 1} of 5`, onclick: () => {
    mood = mood === i + 1 ? null : i + 1;
    [...moodRow.children].forEach((b, j) => b.classList.toggle('on', mood === j + 1));
  } }, m)));
  const mic = micButton((t) => { text.value = (text.value ? text.value + ' ' : '') + t; }, 'Dictate');

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
    past.length ? h('div', { class: 'card' }, h('h2', null, 'Earlier entries'), past.map((k) => h('div', { class: 'item' },
      h('div', { class: 'grow' }, h('strong', null, fmtDate(k)), ' ', d.entries[k].mood ? MOODS[d.entries[k].mood - 1] : '', h('div', { class: 'muted small' }, (d.entries[k].text || '').slice(0, 140))),
      h('button', { class: 'btn small', onclick: () => { date = k; rerender(); } }, 'Open')))) : null);
}

function todayCard() {
  const e = data().entries[dstr()];
  return h('div', { class: 'card' }, h('div', { class: 'row' }, h('h2', { class: 'grow' }, '📔 Journal'), h('a', { href: '#/journal' }, e?.text ? 'Edit →' : 'Write →')),
    h('p', { class: 'muted small' }, e?.text ? 'Journal written today.' : 'No journal entry yet today.'));
}

export default { id: 'journal', name: 'Journal', icon: '📔', blurb: 'Daily log and mood', render, todayCard };
