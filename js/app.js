// App shell: header, bottom tabs, hash routing, profile switching, service worker.
import { Store } from './core/store.js';
import { mount, h, modal } from './core/dom.js';
import { MODULES, settings } from './modules/index.js';
import { startReminders } from './core/reminders.js';

const view = document.getElementById('view');
const title = document.getElementById('title');
const tabs = document.getElementById('tabs');
const profileBtn = document.getElementById('profileBtn');

const PRIMARY = ['today', 'meds', 'bp', 'groceries', 'todos'];

function currentId() {
  return (location.hash.replace(/^#\/?/, '') || 'today').split('?')[0];
}

function drawTabs(active) {
  const ids = PRIMARY.filter((id) => Store.enabled(id)).slice(0, 4);
  const link = (href, icon, label, on) => h('a', { href, class: on ? 'on' : '', 'aria-current': on ? 'page' : null }, h('span', null, icon), label);
  tabs.replaceChildren(
    ...ids.map((id) => {
      const m = MODULES.find((x) => x.id === id);
      return link(`#/${id}`, m.icon, m.tab || m.name, active === id);
    }),
    link('#/more', '☰', 'More', !ids.includes(active))
  );
}

function moreScreen() {
  const mods = MODULES.filter((m) => m.id !== 'today' && Store.enabled(m.id));
  mount(view, 
    h('div', { class: 'grid2' }, [...mods, settings].map((m) => h('a', { class: 'tile', href: `#/${m.id}` }, h('span', null, m.icon), m.name, h('small', null, m.blurb)))));
}

let lastId = null;
function route() {
  let id = currentId();
  profileBtn.textContent = '👤 ' + Store.profile().name;
  const mod = id === 'settings' ? settings : MODULES.find((m) => m.id === id);
  if (id === 'more') {
    title.textContent = 'More';
    drawTabs('more');
    moreScreen();
  } else if (!mod || !Store.enabled(id) && id !== 'settings') {
    location.hash = '#/today';
    return;
  } else {
    title.textContent = mod.name;
    drawTabs(id);
    try {
      if (id !== lastId) mod.enter?.(); // fresh visit to a page (not a redraw)
      lastId = id;
      mod.render(view, { onProfileChange: (go = true) => (go ? ((location.hash = '#/today'), route()) : route()) });
    } catch (e) {
      console.error(e);
      mount(view, h('div', { class: 'banner' }, `Something went wrong in ${mod.name}: ${e.message}`));
    }
  }
  window.scrollTo(0, 0);
}

profileBtn.addEventListener('click', () => {
  const list = h('div', null, Store.state.profiles.map((p) => h('button', { class: `btn block ${p.id === Store.profile().id ? 'primary' : ''}`, style: 'margin-bottom:8px', onclick: () => {
    Store.switchProfile(p.id);
    box.close();
    location.hash = '#/today';
    route();
  } }, p.name)));
  const box = modal('Who is using the app?', list, [{ label: 'Manage profiles', onClick: () => { location.hash = '#/settings'; } }, { label: 'Close' }]);
});

window.addEventListener('hashchange', route);
// Modules ask for a redraw after quick actions (e.g. marking a dose taken from the Today screen).
window.addEventListener('mylife:refresh', () => {
  if (!document.querySelector('.overlay')) route();
});

route();
startReminders();

navigator.storage?.persist?.().catch(() => {});
if ('serviceWorker' in navigator) {
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('./sw.js').catch(() => {});
  // A newly installed service worker means newer app files are available: offer a one-tap refresh.
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || document.getElementById('updateBar')) return;
    document.body.append(h('div', { id: 'updateBar', class: 'banner no-print', style: 'position:fixed;left:12px;right:12px;bottom:76px;z-index:25;display:flex;gap:10px;align-items:center;background:var(--card)' },
      h('span', { class: 'grow' }, 'A new version of MyLife is ready.'), h('button', { class: 'btn small primary', onclick: () => location.reload() }, 'Update now')));
  });
}
