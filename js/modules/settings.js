// Profiles, which modules are on, notifications, and backup/restore.
import { Store, ALL_MODULES } from '../core/store.js';
import { mount, h, modal, toast, confirmBox } from '../core/dom.js';
import { download, dstr } from '../core/util.js';
import { notifStatus, notifSupported, askPermission, showNotification, beep } from '../core/notify.js';
import { voiceSupported } from '../core/voice.js';
import { APP_VERSION } from '../core/version.js';

let getModules = () => [];
export const setSettingsModules = (fn) => { getModules = fn; };

function render(root, { onProfileChange }) {
  const rerender = () => render(root, { onProfileChange });
  const profile = Store.profile();

  const profiles = h('div', { class: 'card' }, h('h2', null, 'Profiles'),
    h('p', { class: 'muted small' }, 'Each profile has its own data and its own set of modules (for example, one for you and one for your dad).'),
    Store.state.profiles.map((p) => h('div', { class: 'item' },
      h('div', { class: 'grow' }, p.id === profile.id ? h('strong', null, p.name + ' (active)') : p.name),
      p.id !== profile.id ? h('button', { class: 'btn small', onclick: () => { Store.switchProfile(p.id); onProfileChange(); } }, 'Switch') : null,
      h('button', { class: 'btn small', onclick: () => {
        const input = h('input', { value: p.name });
        modal('Rename profile', input, [{ label: 'Cancel' }, { label: 'Save', kind: 'primary', onClick: () => { Store.renameProfile(p.id, input.value); onProfileChange(); } }]);
      } }, 'Rename'),
      Store.state.profiles.length > 1 ? h('button', { class: 'btn small danger', 'aria-label': `Delete ${p.name}`, onclick: async () => {
        if (await confirmBox(`Delete profile “${p.name}” and ALL of its data on this device?`)) { Store.deleteProfile(p.id); onProfileChange(); }
      } }, '✕') : null)),
    h('button', { class: 'btn block', style: 'margin-top:10px', onclick: () => {
      const input = h('input', { placeholder: 'e.g. Dad' });
      modal('New profile', input, [{ label: 'Cancel' }, { label: 'Create', kind: 'primary', onClick: () => { Store.addProfile(input.value.trim()); onProfileChange(); } }]);
    } }, '+ Add profile'));

  const mods = h('div', { class: 'card' }, h('h2', null, `Modules for ${profile.name}`),
    getModules().filter((m) => ALL_MODULES.includes(m.id)).map((m) => h('label', { class: 'item' },
      h('input', { type: 'checkbox', checked: Store.enabled(m.id), onchange: (e) => { Store.setModuleEnabled(m.id, e.target.checked); onProfileChange(false); } }),
      h('div', { class: 'grow' }, `${m.icon} ${m.name}`, h('div', { class: 'muted small' }, m.blurb)))));

  const notif = h('div', { class: 'card' }, h('h2', null, 'Reminders & voice'),
    h('p', null, `Notifications: ${notifSupported ? notifStatus() : 'not supported'}`),
    h('p', null, `Voice input: ${voiceSupported ? 'available' : 'not available in this browser (use Chrome)'}`),
    h('div', { class: 'row wrap' },
      notifSupported && notifStatus() !== 'granted' ? h('button', { class: 'btn', onclick: async () => { await askPermission(); rerender(); } }, 'Turn on notifications') : null,
      h('button', { class: 'btn', onclick: async () => { beep(2); const ok = await showNotification('MyLife test', 'If you see and hear this, reminders can reach you.', 'test'); toast(ok ? 'Test sent.' : 'Notification not shown (not allowed yet).'); } }, 'Send test alert')),
    h('p', { class: 'muted small' }, 'Reminders only work while the app is open in the browser. Keep a phone alarm as backup.'));

  const file = h('input', { type: 'file', accept: 'application/json,.json', style: 'display:none', onchange: async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      if (!(await confirmBox('Replace everything on this device with the backup file?', 'Restore'))) return;
      Store.importJSON(await f.text());
      toast('Backup restored.');
      onProfileChange();
    } catch (err) { toast(err.message || 'Could not read that file.'); }
  } });
  const about = h('div', { class: 'card' }, h('h2', null, 'About & updates'),
    h('p', null, `MyLife version ${APP_VERSION}`),
    h('p', { class: 'muted small' }, 'If something new is not showing up, tap below. It reloads the newest version. Your saved data is not touched.'),
    h('button', { class: 'btn', onclick: async () => {
      try {
        const regs = await navigator.serviceWorker?.getRegistrations?.() || [];
        await Promise.all(regs.map((r) => r.unregister()));
        await Promise.all((await caches.keys()).map((k) => caches.delete(k)));
      } catch (e) {}
      location.reload();
    } }, '↻ Get the latest version'));
  const backup = h('div', { class: 'card' }, h('h2', null, 'Backup'),
    h('p', { class: 'muted small' }, 'Your data is stored only on this device. Save a backup file now and then (and before changing phones).'),
    Store.saveFailed ? h('div', { class: 'banner' }, 'Could not save to this browser. Storage may be full or blocked.') : null,
    h('div', { class: 'row wrap' },
      h('button', { class: 'btn primary', onclick: () => { download(`mylife-backup-${dstr()}.json`, Store.exportJSON(), 'application/json'); toast('Backup downloaded.'); } }, '⬇ Download backup'),
      h('button', { class: 'btn', onclick: () => file.click() }, '⬆ Restore from file'), file));

  mount(root, profiles, mods, notif, backup, about,
    h('p', { class: 'muted small', style: 'text-align:center' }, 'MyLife · logs and reminders only, not medical advice.'));
}

export default { id: 'settings', name: 'Settings', icon: '⚙️', blurb: 'Profiles, modules, backup', render };
