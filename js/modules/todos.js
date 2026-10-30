// To-do list with voice entry ("call the pharmacy tomorrow").
import { Store } from '../core/store.js';
import { mount, h, toast, empty } from '../core/dom.js';
import { uid, dstr, fmtDate, relDay, extractDate, capFirst } from '../core/util.js';
import { micButton } from '../core/voice.js';

const data = () => Store.get('todos', { items: [] });
export const openTodos = () => data().items.filter((i) => !i.done);

function render(root) {
  const d = data();
  const rerender = () => render(root);
  const text = h('input', { placeholder: 'New to-do…', enterkeyhint: 'done', autocomplete: 'off' });
  const due = h('input', { type: 'date', 'aria-label': 'Due date' });
  const add = (t, date) => {
    if (!t.trim()) return;
    d.items.push({ id: uid(), text: capFirst(t.trim()), due: date || null, done: false, created: Date.now() });
    Store.save();
    rerender();
  };
  const addTyped = () => {
    const ex = extractDate(text.value);
    add(ex.text, due.value || ex.date);
  };
  text.addEventListener('keydown', (e) => { if (e.key === 'Enter') addTyped(); });
  const mic = micButton((heard) => {
    const ex = extractDate(heard.replace(/^(add|remind me to|i need to|to do)\s+/i, ''));
    add(ex.text, ex.date);
    toast(`Added: ${ex.text}${ex.date ? ' (due ' + fmtDate(ex.date) + ')' : ''}`);
  }, 'Say a to-do');

  const today = dstr();
  const open = d.items.filter((i) => !i.done).sort((a, b) => (a.due || '9999') .localeCompare(b.due || '9999') || a.created - b.created);
  const done = d.items.filter((i) => i.done).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
  const row = (i) => h('div', { class: `item ${i.done ? 'done' : ''}` },
    h('input', { type: 'checkbox', checked: i.done, 'aria-label': `Done: ${i.text}`, onchange: (e) => { i.done = e.target.checked; i.doneAt = i.done ? Date.now() : null; Store.save(); rerender(); } }),
    h('div', { class: 'grow' }, i.text, i.due ? h('div', { class: `small ${!i.done && i.due < today ? 'up' : 'muted'}` }, `${fmtDate(i.due)} · ${relDay(i.due)}`) : null),
    h('button', { class: 'btn small ghost', 'aria-label': 'Delete', onclick: () => { d.items = d.items.filter((x) => x.id !== i.id); Store.save(); rerender(); } }, '✕'));

  mount(root, 
    h('div', { class: 'card' }, h('div', { class: 'row' }, h('div', { class: 'grow' }, text), mic),
      h('label', { class: 'field' }, 'Due date (optional)'), due,
      h('p', { class: 'muted small' }, 'Say: “call the pharmacy tomorrow” and the date is filled in.'),
      h('button', { class: 'btn primary block', onclick: addTyped }, 'Add to-do')),
    h('div', { class: 'card' }, h('h2', null, `To do (${open.length})`), open.length ? open.map(row) : empty('All clear. 🎉')),
    done.length ? h('div', { class: 'card' }, h('h2', null, 'Done'), done.slice(0, 15).map(row),
      h('button', { class: 'btn small', style: 'margin-top:8px', onclick: () => { d.items = d.items.filter((i) => !i.done); Store.save(); rerender(); } }, 'Clear done')) : null);
}

function todayCard() {
  const today = dstr();
  const open = openTodos().filter((i) => !i.due || i.due <= today).sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'));
  const card = h('div', { class: 'card' }, h('div', { class: 'row' }, h('h2', { class: 'grow' }, '✅ To-do'), h('a', { href: '#/todos' }, `${openTodos().length} open →`)));
  if (!open.length) card.append(h('p', { class: 'muted' }, 'Nothing due today.'));
  for (const i of open.slice(0, 5)) {
    card.append(h('div', { class: 'item' },
      h('input', { type: 'checkbox', 'aria-label': `Done: ${i.text}`, onchange: () => { i.done = true; i.doneAt = Date.now(); Store.save(); window.dispatchEvent(new Event('mylife:refresh')); } }),
      h('div', { class: 'grow' }, i.text), i.due && i.due < today ? h('span', { class: 'pill missed' }, 'overdue') : null));
  }
  return card;
}

export default { id: 'todos', name: 'To-Do', tab: 'To-Do', icon: '✅', blurb: 'Voice to-do list', render, todayCard };
