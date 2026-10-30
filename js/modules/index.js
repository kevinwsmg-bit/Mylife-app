// Registry of modules. To add one: create js/modules/<id>.js, add it to ALL_MODULES in core/store.js, and list it here.
import today, { setModuleSource } from './today.js';
import meds from './meds.js';
import bp from './bp.js';
import weight from './weight.js';
import groceries from './groceries.js';
import todos from './todos.js';
import calendar from './calendar.js';
import journal from './journal.js';
import tv from './tv.js';
import ideas from './ideas.js';
import report from './report.js';
import settings, { setSettingsModules } from './settings.js';

export const MODULES = [today, meds, bp, weight, groceries, todos, calendar, journal, tv, ideas, report];
export { settings };
setModuleSource(() => MODULES);
setSettingsModules(() => MODULES);
