// Voice-friendly grocery list with regulars and share/copy/Walmart hand-off.
import { Store } from '../core/store.js';
import { mount, h, toast, empty } from '../core/dom.js';
import { uid, splitItems, copyText } from '../core/util.js';
import { micButton } from '../core/voice.js';

const data = () => Store.get('groceries', { items: [], regulars: [] });
export const openCount = () => data().items.filter((i) => !i.done).length;
const walmartUrl = (q) => `https://www.walmart.com/search?q=${encodeURIComponent(q)}`;

export function addItems(names) {
  const d = data();
  const added = [];
  for (const name of names) {
    const hit = d.items.find((i) => i.name.toLowerCase() === name.toLowerCase());
    if (hit) { if (hit.done) { hit.done = false; added.push(name); } continue; }
    d.items.push({ id: uid(), name, done: false, added: Date.now() });
    added.push(name);
  }
  Store.save();
  return added;
}

function render(root) {
  const d = data();
  const rerender = () => render(root);
  const input = h('input', { placeholder: 'Add item (or several: eggs, milk)…', enterkeyhint: 'done', autocomplete: 'off' });
  const addTyped = () => {
    const names = splitItems(input.value);
    if (!names.length) return;
    const a = addItems(names);
    toast(a.length ? `Added ${a.join(', ')}` : 'Already on the list.');
    rerender();
  };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') addTyped(); });
  const mic = micButton((text) => {
    const names = splitItems(text);
    const a = addItems(names);
    toast(a.length ? `Added ${a.join(', ')}` : 'Already on the list.');
    rerender();
  }, 'Say what you need');

  const need = d.items.filter((i) => !i.done);
  const got = d.items.filter((i) => i.done);
  const isReg = (n) => d.regulars.some((r) => r.toLowerCase() === n.toLowerCase());
  const itemRow = (i) => h('div', { class: `item ${i.done ? 'done' : ''}` },
    h('input', { type: 'checkbox', checked: i.done, 'aria-label': `Got ${i.name}`, onchange: (e) => { i.done = e.target.checked; Store.save(); rerender(); } }),
    h('div', { class: 'grow' }, i.name),
    h('a', { class: 'small', href: walmartUrl(i.name), target: '_blank', rel: 'noopener' }, 'Walmart'),
    h('button', { class: 'btn small ghost', 'aria-label': isReg(i.name) ? 'Remove from regulars' : 'Save as regular', onclick: () => {
      d.regulars = isReg(i.name) ? d.regulars.filter((r) => r.toLowerCase() !== i.name.toLowerCase()) : [...d.regulars, i.name];
      Store.save(); rerender();
    } }, isReg(i.name) ? '★' : '☆'),
    h('button', { class: 'btn small ghost', 'aria-label': `Remove ${i.name}`, onclick: () => { d.items = d.items.filter((x) => x.id !== i.id); Store.save(); rerender(); } }, '✕'));

  const text = () => need.map((i) => `• ${i.name}`).join('\n');
  const missingRegs = d.regulars.filter((r) => !d.items.some((i) => !i.done && i.name.toLowerCase() === r.toLowerCase()));

  mount(root, 
    h('div', { class: 'card' }, h('div', { class: 'row' }, h('div', { class: 'grow' }, input), mic),
      h('p', { class: 'muted small' }, 'Tap 🎤 and say: “I’m out of eggs and milk”'),
      h('button', { class: 'btn block', onclick: addTyped }, 'Add')),
    missingRegs.length ? h('div', { class: 'card' }, h('h2', null, '★ Regulars'), h('div', { class: 'seg' }, missingRegs.map((r) =>
      h('button', { class: 'btn small', onclick: () => { addItems([r]); rerender(); } }, `+ ${r}`)))) : null,
    h('div', { class: 'card' }, h('h2', null, `Need (${need.length})`), need.length ? need.map(itemRow) : empty('Nothing needed. Say what you’re missing!'),
      need.length ? h('div', { class: 'row wrap', style: 'margin-top:10px' },
        h('button', { class: 'btn small', onclick: async () => toast((await copyText(text())) ? 'List copied. Paste it into your Walmart app or a message.' : 'Could not copy.') }, '📋 Copy list'),
        navigator.share ? h('button', { class: 'btn small', onclick: () => navigator.share({ title: 'Grocery list', text: text() }).catch(() => {}) }, '↗ Share') : null,
        h('a', { class: 'btn small', style: 'text-decoration:none', href: 'https://www.walmart.com/', target: '_blank', rel: 'noopener' }, 'Open Walmart')) : null),
    got.length ? h('div', { class: 'card' }, h('h2', null, `Got it (${got.length})`), got.map(itemRow),
      h('button', { class: 'btn small', style: 'margin-top:8px', onclick: () => { d.items = d.items.filter((i) => !i.done); Store.save(); rerender(); } }, 'Clear got-it items')) : null);
}

function todayCard() {
  const n = openCount();
  return h('div', { class: 'card' }, h('div', { class: 'row' }, h('h2', { class: 'grow' }, '🛒 Groceries'), h('a', { href: '#/groceries' }, n ? `${n} needed →` : 'Add →')),
    n ? h('p', { class: 'muted small' }, data().items.filter((i) => !i.done).slice(0, 6).map((i) => i.name).join(', ')) : null);
}

export default { id: 'groceries', name: 'Groceries', icon: '🛒', blurb: 'Voice list, Walmart hand-off', render, todayCard };
