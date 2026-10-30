// Voice input using the browser's built-in speech recognition (works in Chrome on Android).
import { h, toast } from './dom.js';

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
export const voiceSupported = !!SR;

export function dictate() {
  return new Promise((resolve, reject) => {
    if (!SR) return reject(new Error('Voice input is not supported in this browser. Try Chrome.'));
    const rec = new SR();
    rec.lang = 'en-US';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    let heard = '';
    rec.onresult = (e) => {
      heard = Array.from(e.results).map((r) => r[0].transcript).join(' ');
    };
    rec.onerror = (e) => {
      const msg = {
        'not-allowed': 'Microphone is blocked. Allow it in the browser site settings.',
        'no-speech': "Didn't hear anything. Tap the mic and try again.",
        'audio-capture': 'No microphone found.',
      }[e.error] || `Voice error: ${e.error}`;
      reject(new Error(msg));
    };
    rec.onend = () => resolve(heard.trim());
    try {
      rec.start();
    } catch (e) {
      reject(e);
    }
  });
}

// A mic button. onText(text) is called with what was heard.
export function micButton(onText, label = 'Speak') {
  const btn = h('button', { type: 'button', class: 'mic', 'aria-label': label, title: label }, '🎤');
  btn.addEventListener('click', async () => {
    if (btn.classList.contains('live')) return;
    btn.classList.add('live');
    btn.textContent = '…';
    try {
      const text = await dictate();
      if (text) await onText(text);
      else toast("Didn't catch that. Try again.");
    } catch (e) {
      toast(e.message || 'Voice input failed.');
    } finally {
      btn.classList.remove('live');
      btn.textContent = '🎤';
    }
  });
  return btn;
}
