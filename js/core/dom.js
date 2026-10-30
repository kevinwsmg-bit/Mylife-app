import { toLocalInput } from './util.js';
// Tiny DOM helpers: element builder, toast, modal sheet, confirm.
export function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  let value;
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'value') value = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'checked' || k === 'disabled' || k === 'selected') el[k] = !!v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat(Infinity)) {
    if (k == null || k === false) continue;
    el.append(k.nodeType ? k : document.createTextNode(String(k)));
  }
  if (value !== undefined) el.value = value;
  return el;
}

export function toast(msg) {
  const box = document.getElementById('toasts');
  const t = h('div', { class: 'toast' }, msg);
  box.append(t);
  setTimeout(() => t.remove(), 3200);
}

// Bottom-sheet modal. actions: [{label, kind, onClick}] (onClick returning false keeps it open).
export function modal(title, body, actions = []) {
  const overlay = h('div', { class: 'overlay no-print' });
  const close = () => overlay.remove();
  const sheet = h(
    'div',
    { class: 'sheet', role: 'dialog', 'aria-label': title },
    h('h2', null, title),
    h('div', { class: 'sheet-body' }, body),
    h(
      'div',
      { class: 'sheet-actions' },
      actions.map((a) =>
        h(
          'button',
          {
            class: `btn ${a.kind || ''}`,
            onclick: async () => {
              const r = a.onClick ? await a.onClick() : undefined;
              if (r !== false) close();
            },
          },
          a.label
        )
      )
    )
  );
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  overlay.append(sheet);
  document.body.append(overlay);
  const first = sheet.querySelector('input,select,textarea');
  if (first) first.focus();
  return { close };
}

export function confirmBox(message, okLabel = 'Delete') {
  return new Promise((resolve) => {
    modal('Are you sure?', h('p', null, message), [
      { label: 'Cancel', onClick: () => resolve(false) },
      { label: okLabel, kind: 'danger', onClick: () => resolve(true) },
    ]);
  });
}

export const empty = (text) => h('p', { class: 'empty' }, text);

// Replace a container's contents. Accepts nested arrays and skips null/false (unlike replaceChildren).
export function mount(root, ...kids) {
  root.replaceChildren(...kids.flat(Infinity).filter((k) => k != null && k !== false).map((k) => (k.nodeType ? k : document.createTextNode(String(k)))));
}

// Date/time box that shows "right now" but only overrides the real time if the user edits it,
// so a form left open for a while still stamps the moment you tap Save.
export function whenInput() {
  const el = h('input', { type: 'datetime-local', value: toLocalInput(Date.now()) });
  let touched = false;
  el.addEventListener('input', () => { touched = true; });
  return { el, at: () => (touched ? new Date(el.value).getTime() : 0) || Date.now() };
}

// Append children to an element, skipping null/false and flattening arrays (plain append() would print "null").
export function addTo(el, ...kids) {
  for (const k of kids.flat(Infinity)) {
    if (k == null || k === false) continue;
    el.append(k.nodeType ? k : document.createTextNode(String(k)));
  }
  return el;
}
