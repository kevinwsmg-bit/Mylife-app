// A place to capture "it would be nice if the app could..." ideas, by voice or typing.
import { Store } from '../core/store.js';
import { mount, h, toast, empty } from '../core/dom.js';
import { uid, capFirst, copyText, fmtDate, dstr } from '../core/util.js';
import { micButton } from '../core/voice.js';

const data = () => Store.get('ideas', { items: [] });
const STATUS = ['new', 'planned', 'done'];
let filter = 'open';

function render(root) {
  const d = data();
  const rerender = () => render(root);
  const input = h('input', { placeholder: 'An idea for the app…', enterkeyhint: 'done', autocomplete: 'off' });
  const add = (t) => {
    if (!t.trim()) return;
    d.items.push({ id: uid(), text: capFirst(t.trim()), status: 'new', created: Date.now() });
    Store.save();
    toast('Idea saved 💡');
    rerender();
  };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') add(input.value); });
  const mic = micButton((t) => add(t), 'Say an idea');

  const shown = d.items.filter((i) => (filter === 'open' ? i.status !== 'done' : filter === 'all' ? true : i.status === filter)).sort((a, b) => b.created - a.created);
  const next = (s) => STATUS[(STATUS.indexOf(s) + 1) % STATUS.length];
  mount(root, 
    h('div', { class: 'card' }, h('div', { class: 'row' }, h('div', { class: 'grow' }, input), mic),
      h('button', { class: 'btn primary block', style: 'margin-top:10px', onclick: () => add(input.value) }, 'Save idea')),
    h('div', { class: 'card' }, h('h2', null, 'Ideas'),
      h('div', { class: 'seg' }, ['open', 'new', 'planned', 'done', 'all'].map((f) => h('button', { class: `btn ${filter === f ? 'on' : ''}`, onclick: () => { filter = f; rerender(); } }, f))),
      shown.length ? shown.map((i) => h('div', { class: `item ${i.status === 'done' ? 'done' : ''}` },
        h('div', { class: 'grow' }, i.text, h('div', { class: 'muted small' }, fmtDate(dstr(new Date(i.created))))),
        h('button', { class: 'btn small', title: 'Tap to change status', onclick: () => { i.status = next(i.status); Store.save(); rerender(); } }, i.status),
        h('button', { class: 'btn small ghost', 'aria-label': 'Delete idea', onclick: () => { d.items = d.items.filter((x) => x.id !== i.id); Store.save(); rerender(); } }, '✕'))) : empty('No ideas here yet.'),
      d.items.length ? h('button', { class: 'btn small', style: 'margin-top:10px', onclick: async () => {
        const txt = d.items.filter((i) => i.status !== 'done').map((i) => `- ${i.text} [${i.status}]`).join('\n');
        toast((await copyText(txt)) ? 'Copied. Paste it to Claude to add these to the app.' : 'Could not copy.');
      } }, '📋 Copy ideas to paste to Claude') : null));
}

export default { id: 'ideas', name: 'App Ideas', icon: '💡', blurb: 'Capture ideas for new modules', render };
