// Shows and movies you follow, with upcoming-date reminders on the Today screen.
// Dates are entered by hand for now; automatic release dates could come later.
import { Store } from '../core/store.js';
import { mount, h, toast, empty } from '../core/dom.js';
import { uid, dstr, fmtDate, relDay, daysBetween, capFirst } from '../core/util.js';
import { micButton } from '../core/voice.js';

const data = () => Store.get('tv', { items: [] });

function render(root) {
  const d = data();
  const rerender = () => render(root);
  const title = h('input', { placeholder: 'Show or movie title', autocomplete: 'off' });
  const kind = h('select', null, h('option', { value: 'show' }, 'TV show'), h('option', { value: 'movie' }, 'Movie'));
  const date = h('input', { type: 'date' });
  const note = h('input', { placeholder: 'e.g. Season 2 premiere, episode 3' });
  const mic = micButton((t) => { title.value = capFirst(t.replace(/[.!?]$/, '')); }, 'Say a title');
  const add = () => {
    if (!title.value.trim()) return toast('Enter a title.');
    d.items.push({ id: uid(), title: capFirst(title.value.trim()), kind: kind.value, date: date.value || null, note: note.value.trim(), done: false });
    Store.save();
    rerender();
  };
  const today = dstr();
  const upcoming = d.items.filter((i) => !i.done && i.date && i.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const undated = d.items.filter((i) => !i.done && !i.date);
  const past = d.items.filter((i) => i.done || (i.date && i.date < today));
  const row = (i) => h('div', { class: 'item' }, h('span', null, i.kind === 'movie' ? '🎬' : '📺'),
    h('div', { class: 'grow' }, h('strong', null, i.title), i.note ? ` · ${i.note}` : '', i.date ? h('div', { class: 'muted small' }, `${fmtDate(i.date)} · ${relDay(i.date)}`) : null),
    h('input', { type: 'date', value: i.date || '', 'aria-label': 'Next date', style: 'width:150px', onchange: (e) => { i.date = e.target.value || null; Store.save(); rerender(); } }),
    h('button', { class: 'btn small ghost', 'aria-label': 'Remove', onclick: () => { d.items = d.items.filter((x) => x.id !== i.id); Store.save(); rerender(); } }, '✕'));

  mount(root, 
    h('div', { class: 'card' }, h('h2', null, 'Add a show or movie'), h('div', { class: 'row' }, h('div', { class: 'grow' }, title), mic),
      h('div', { class: 'grid2' }, h('div', null, h('label', { class: 'field' }, 'Type'), kind), h('div', null, h('label', { class: 'field' }, 'Next date'), date)),
      h('label', { class: 'field' }, 'Note'), note,
      h('button', { class: 'btn primary block', style: 'margin-top:10px', onclick: add }, 'Add')),
    h('div', { class: 'card' }, h('h2', null, 'Coming up'), upcoming.length ? upcoming.map(row) : empty('Add a date to get a reminder on your Today screen.')),
    undated.length ? h('div', { class: 'card' }, h('h2', null, 'No date yet'), undated.map(row)) : null,
    past.length ? h('div', { class: 'card' }, h('h2', null, 'Past'), past.map((i) => h('div', { class: 'item' }, h('div', { class: 'grow muted' }, i.title, i.date ? ` · ${fmtDate(i.date)}` : ''),
      h('button', { class: 'btn small', onclick: () => { i.date = null; i.done = false; Store.save(); rerender(); } }, 'Reset date'),
      h('button', { class: 'btn small ghost', 'aria-label': 'Remove', onclick: () => { d.items = d.items.filter((x) => x.id !== i.id); Store.save(); rerender(); } }, '✕'))) ) : null);
}

function todayCard() {
  const today = dstr();
  const soon = data().items.filter((i) => !i.done && i.date && i.date >= today && daysBetween(today, i.date) <= 7).sort((a, b) => a.date.localeCompare(b.date));
  if (!soon.length) return null;
  const card = h('div', { class: 'card' }, h('div', { class: 'row' }, h('h2', { class: 'grow' }, '📺 Coming up'), h('a', { href: '#/tv' }, 'All →')));
  soon.forEach((i) => card.append(h('div', { class: 'item' }, h('span', null, i.kind === 'movie' ? '🎬' : '📺'), h('div', { class: 'grow' }, h('strong', null, i.title), i.note ? ` · ${i.note}` : ''), h('span', { class: 'pill due' }, relDay(i.date)))));
  return card;
}

export default { id: 'tv', name: 'TV & Movies', icon: '📺', blurb: 'Premieres and reminders', render, todayCard };
