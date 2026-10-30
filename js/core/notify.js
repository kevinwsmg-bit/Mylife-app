// Notifications, sound and vibration for reminders.
export const notifSupported = 'Notification' in window;
export const notifStatus = () => (notifSupported ? Notification.permission : 'unsupported');

export async function askPermission() {
  if (!notifSupported) return 'unsupported';
  try {
    return await Notification.requestPermission();
  } catch (e) {
    return Notification.permission;
  }
}

export async function showNotification(title, body, tag) {
  if (notifStatus() !== 'granted') return false;
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) {
      await reg.showNotification(title, {
        body,
        tag,
        icon: 'icons/icon-192.png',
        badge: 'icons/icon-192.png',
        vibrate: [300, 150, 300, 150, 300],
        requireInteraction: true,
      });
      return true;
    }
    new Notification(title, { body, tag });
    return true;
  } catch (e) {
    return false;
  }
}

let audio;
export function beep(times = 3) {
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
    for (let i = 0; i < times; i++) {
      const o = audio.createOscillator();
      const g = audio.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, audio.currentTime + i * 0.5);
      g.gain.exponentialRampToValueAtTime(0.4, audio.currentTime + i * 0.5 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + i * 0.5 + 0.4);
      o.connect(g).connect(audio.destination);
      o.start(audio.currentTime + i * 0.5);
      o.stop(audio.currentTime + i * 0.5 + 0.45);
    }
  } catch (e) {}
  try {
    navigator.vibrate?.([300, 150, 300, 150, 300]);
  } catch (e) {}
}
