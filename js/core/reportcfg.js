// Doctor-report settings, shared so a module can offer its own "include in my doctor report" checkbox.
import { Store } from './store.js';

export const reportConfig = () => Store.get('report', { range: 30, detail: false, show: {}, hiddenMeds: [] });

export const inReport = (key) => reportConfig().show[key] !== false;
export function setInReport(key, on) {
  reportConfig().show[key] = on;
  Store.save();
}
