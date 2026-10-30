// The home screen: a summary card from every enabled module.
import { Store } from '../core/store.js';
import { mount, h } from '../core/dom.js';

let getModules = () => [];
export const setModuleSource = (fn) => { getModules = fn; };

function render(root) {
  const now = new Date();
  const hr = now.getHours();
  const greet = hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';
  const cards = [];
  // order matters: what you need first
  for (const id of ['meds', 'bp', 'o2', 'todos', 'calendar', 'tv', 'groceries', 'weight', 'journal']) {
    const mod = getModules().find((m) => m.id === id);
    if (!mod || !Store.enabled(id) || !mod.todayCard) continue;
    const c = mod.todayCard();
    if (c) cards.push(c);
  }
  mount(root, 
    h('h2', { style: 'margin:4px 0 2px;font-size:1.5rem' }, `${greet}, ${Store.profile().name}`),
    h('p', { class: 'muted', style: 'margin-bottom:14px' }, now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })),
    cards.length ? cards : h('p', { class: 'empty' }, 'Turn on some modules in More → Settings.'));
}

export default { id: 'today', name: 'Today', icon: '🏠', blurb: 'Your day at a glance', render };
