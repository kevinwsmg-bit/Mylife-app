// All data lives in this browser's localStorage (on-device). One bucket of data per profile.
import { uid } from './util.js';

const KEY = 'mylife:v1';
export const ALL_MODULES = ['meds', 'bp', 'weight', 'groceries', 'todos', 'calendar', 'journal', 'tv', 'ideas', 'report'];

const fresh = () => {
  const id = uid();
  return { version: 1, activeProfile: id, profiles: [{ id, name: 'Me', modules: [...ALL_MODULES] }], data: { [id]: {} } };
};

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s && Array.isArray(s.profiles) && s.profiles.length) return s;
    }
  } catch (e) {}
  return fresh();
}

let state = read();

export const Store = {
  saveFailed: false,
  get state() {
    return state;
  },
  profile() {
    return state.profiles.find((p) => p.id === state.activeProfile) || state.profiles[0];
  },
  enabled(id) {
    return id === 'today' || this.profile().modules.includes(id);
  },
  // Returns the live data object for a module (created from `def` the first time). Mutate it, then call save().
  get(mod, def) {
    const bucket = (state.data[state.activeProfile] ||= {});
    if (!(mod in bucket)) bucket[mod] = structuredClone(def);
    return bucket[mod];
  },
  save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      this.saveFailed = false;
    } catch (e) {
      this.saveFailed = true;
    }
  },
  addProfile(name) {
    const id = uid();
    state.profiles.push({ id, name: name || 'New profile', modules: [...ALL_MODULES] });
    state.data[id] = {};
    state.activeProfile = id;
    this.save();
  },
  switchProfile(id) {
    if (state.profiles.some((p) => p.id === id)) {
      state.activeProfile = id;
      this.save();
    }
  },
  renameProfile(id, name) {
    const p = state.profiles.find((x) => x.id === id);
    if (p && name.trim()) p.name = name.trim();
    this.save();
  },
  deleteProfile(id) {
    if (state.profiles.length < 2) return false;
    state.profiles = state.profiles.filter((p) => p.id !== id);
    delete state.data[id];
    if (state.activeProfile === id) state.activeProfile = state.profiles[0].id;
    this.save();
    return true;
  },
  setModuleEnabled(mod, on) {
    const p = this.profile();
    p.modules = p.modules.filter((m) => m !== mod);
    if (on) p.modules.push(mod);
    this.save();
  },
  exportJSON() {
    return JSON.stringify({ exportedAt: new Date().toISOString(), ...state }, null, 2);
  },
  importJSON(text) {
    const s = JSON.parse(text);
    if (!s || !Array.isArray(s.profiles) || !s.profiles.length || !s.data) throw new Error('Not a MyLife backup file.');
    delete s.exportedAt;
    state = s;
    if (!state.profiles.some((p) => p.id === state.activeProfile)) state.activeProfile = state.profiles[0].id;
    this.save();
  },
};
