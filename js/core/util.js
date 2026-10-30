// Small helpers for dates, numbers and parsing spoken text.
export const pad = (n) => String(n).padStart(2, '0');
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export const dstr = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseD = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const addDays = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
export const daysBetween = (a, b) => Math.round((parseD(b) - parseD(a)) / 864e5);

export const fmtDate = (s, opts) =>
  parseD(s).toLocaleDateString(undefined, opts || { weekday: 'short', month: 'short', day: 'numeric' });
export const fmtTime = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};
export const fmtStamp = (ms) => new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
export const toLocalInput = (ms) => {
  const d = new Date(ms);
  return `${dstr(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export function relDay(s) {
  const n = daysBetween(dstr(), s);
  if (n === 0) return 'today';
  if (n === 1) return 'tomorrow';
  if (n === -1) return 'yesterday';
  return n > 0 ? `in ${n} days` : `${-n} days ago`;
}

export const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
export const round = (n, p = 0) => (n == null ? null : Math.round(n * 10 ** p) / 10 ** p);
export const capFirst = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

// Pull "today", "tomorrow" or a weekday name out of spoken text.
export function extractDate(text) {
  const now = new Date();
  let date = null;
  let m = text.match(/\b(?:by|on|for|due)?\s*\b(today|tonight)\b/i);
  if (m) date = dstr(now);
  if (!m) {
    m = text.match(/\b(?:by|on|for|due)?\s*\btomorrow\b/i);
    if (m) date = dstr(addDays(now, 1));
  }
  if (!m) {
    m = text.match(new RegExp(`\\b(?:by|on|for|due|next)?\\s*\\b(${DAYS.join('|')})\\b`, 'i'));
    if (m) {
      const idx = DAYS.indexOf(m[1].toLowerCase());
      const diff = (idx - now.getDay() + 7) % 7 || 7;
      date = dstr(addDays(now, diff));
    }
  }
  const out = m ? text.replace(m[0], ' ') : text;
  return { text: out.replace(/\s+/g, ' ').trim(), date };
}

// Pull "at 3pm" or "at 14:30" out of spoken text. Returns HH:MM.
export function extractTime(text) {
  const m = text.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?/i);
  if (!m) return { text, time: null };
  let h = Number(m[1]);
  const min = Number(m[2] || 0);
  const ap = (m[3] || '').toLowerCase().replace(/\./g, '');
  if (ap === 'pm' && h < 12) h += 12;
  if (ap === 'am' && h === 12) h = 0;
  if (h > 23 || min > 59) return { text, time: null };
  return { text: text.replace(m[0], ' ').replace(/\s+/g, ' ').trim(), time: `${pad(h)}:${pad(min)}` };
}

// "add eggs and milk to my list" -> ["Eggs", "Milk"]
export function splitItems(text) {
  let t = text.trim().toLowerCase();
  t = t.replace(/^(please\s+)?(add|put|buy|get|pick up|i need|we need|i'm out of|im out of|we're out of|out of|we are out of|i am out of|i'm low on|we're low on)\s+/i, '');
  t = t.replace(/\s+(to|on|onto)\s+(my|the|our)\s+(grocery\s+)?(list|shopping list)\s*$/i, '');
  return t
    .split(/\s*(?:,|\band\b|\bplus\b|\n)\s*/i)
    .map((s) => s.trim())
    .filter(Boolean)
    .map(capFirst);
}

export function download(filename, text, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.append(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch (e2) {}
    ta.remove();
    return ok;
  }
}
