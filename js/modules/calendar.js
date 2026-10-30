// Month calendar showing events, to-dos with due dates and TV/movie dates.
import { Store } from '../core/store.js';
import { mount, h, toast, empty } from '../core/dom.js';
import { uid, dstr, pad, fmtDate, fmtTime, extractDate, extractTime, capFirst } from '../core/util.js';
import { micButton } from '../core/voice.js';

const data = () => Store.get('calendar', { events: [] });
export const eventsOn = (date) => data().events.filter((e) => e.date === date).sort((a, b) => (a.time || '').localeCompare(b.time || ''));

function itemsOn(date) {
  const out = eventsOn(date).map((e) => ({ kind: 'event', id: e.id, label: e.title, time: e.time, icon: '📅' }));
  const todos = Store.get('todos', { items: [] }).items.filter((t) => !t.done && t.due === date);
  const tv = Store.get('tv', { items: [] }).items.filter((t) => !t.done && t.date === date);
  todos.forEach((t) => out.push({ kind: 'todo', label: t.text, icon: '✅' }));
  tv.forEach((t) => out.push({ kind: 'tv', label: `${t.title}${t.note ? ' · ' + t.note : ''}`, icon: '📺' }));
  return out;
}

let cursor = null; // first of month being shown
let selected = dstr();

function render(root) {
  const d = data();
  const rerender = () => render(root);
  const base = cursor || new Date(selected + 'T00:00');
  const year = base.getFullYear();
  const month = base.getMonth();
  cursor = new Date(year, month, 1);
  const first = new Date(year, month, 1).getDay();
  const dim = new Date(year, month + 1, 0).getDate();
  const today = dstr();

  const cells = [];
  for (let i = 0; i < first; i++) cells.push(h('button', { class: 'blank', tabindex: '-1', 'aria-hidden': 'true' }));
  for (let day = 1; day <= dim; day++) {
    const ds = `${year}-${pad(month + 1)}-${pad(day)}`;
    cells.push(h('button', { class: `${ds === today ? 'today' : ''} ${ds === selected ? 'sel' : ''}`, 'aria-label': fmtDate(ds), onclick: () => { selected = ds; rerender(); } },
      day, itemsOn(ds).length ? h('span', { class: 'dot' }) : null));
  }

  const title = h('input', { placeholder: 'New event (e.g. doctor at 3pm tomorrow)', autocomplete: 'off' });
  const date = h('input', { type: 'date', value: selected });
  const time = h('input', { type: 'time' });
  const addEvent = (t, dt, tm) => {
    if (!t.trim()) return toast('Enter a title.');
    d.events.push({ id: uid(), title: capFirst(t.trim()), date: dt || selected, time: tm || '' });
    Store.save();
    if (dt) selected = dt;
    cursor = null;
    rerender();
  };
  const mic = micButton((heard) => {
    const t = extractTime(heard.replace(/^(add|schedule|put)\s+/i, ''));
    const ex = extractDate(t.text);
    addEvent(ex.text, ex.date || selected, t.time);
    toast(`Added: ${ex.text}`);
  }, 'Say an event');

  const items = itemsOn(selected);
  mount(root, 
    h('div', { class: 'card' },
      h('div', { class: 'row' },
        h('button', { class: 'btn small', 'aria-label': 'Previous month', onclick: () => { cursor = new Date(year, month - 1, 1); rerender(); } }, '‹'),
        h('h2', { class: 'grow', style: 'text-align:center;margin:0' }, cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })),
        h('button', { class: 'btn small', 'aria-label': 'Next month', onclick: () => { cursor = new Date(year, month + 1, 1); rerender(); } }, '›')),
      h('div', { class: 'cal', style: 'margin-top:10px' }, ['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((x) => h('div', { class: 'dow' }, x)), cells),
      h('button', { class: 'btn small ghost', onclick: () => { selected = today; cursor = null; rerender(); } }, 'Jump to today')),
    h('div', { class: 'card' }, h('h2', null, fmtDate(selected, { weekday: 'long', month: 'long', day: 'numeric' })),
      items.length ? items.map((i) => h('div', { class: 'item' }, h('span', null, i.icon), h('div', { class: 'grow' }, i.time ? h('strong', null, fmtTime(i.time) + ' ') : null, i.label),
        i.kind === 'event' ? h('button', { class: 'btn small ghost', 'aria-label': 'Delete event', onclick: () => { d.events = d.events.filter((e) => e.id !== i.id); Store.save(); rerender(); } }, '✕') : null)) : empty('Nothing on this day.')),
    h('div', { class: 'card' }, h('h2', null, 'Add event'),
      h('div', { class: 'row' }, h('div', { class: 'grow' }, title), mic),
      h('div', { class: 'grid2' }, h('div', null, h('label', { class: 'field' }, 'Date'), date), h('div', null, h('label', { class: 'field' }, 'Time (optional)'), time)),
      h('button', { class: 'btn primary block', style: 'margin-top:10px', onclick: () => {
        const t = extractTime(title.value);
        const ex = extractDate(t.text);
        addEvent(ex.text, ex.date || date.value, t.time || time.value);
      } }, 'Add event')));
}

function todayCard() {
  const items = itemsOn(dstr()).filter((i) => i.kind === 'event');
  if (!items.length) return null;
  const card = h('div', { class: 'card' }, h('div', { class: 'row' }, h('h2', { class: 'grow' }, '📅 Today'), h('a', { href: '#/calendar' }, 'Calendar →')));
  items.forEach((i) => card.append(h('div', { class: 'item' }, h('div', { class: 'grow' }, i.time ? h('strong', null, fmtTime(i.time) + ' ') : null, i.label))));
  return card;
}

export default { id: 'calendar', name: 'Calendar', icon: '📅', blurb: 'Events and due dates', render, todayCard };
