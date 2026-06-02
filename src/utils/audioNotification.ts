/**
 * Synthetic dynamic notification chime using pure Web Audio API. Playable completely offline.
 */
export function playChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    // High quality soft chime harmony
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, now); // A5 note
    osc1.frequency.exponentialRampToValueAtTime(1320, now + 0.12); // E6 note

    gain1.gain.setValueAtTime(0.001, now);
    gain1.gain.linearRampToValueAtTime(0.12, now + 0.04);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    // Warm undertone triangle synth
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(440, now); // A4
    osc2.frequency.exponentialRampToValueAtTime(880, now + 0.18); // A5

    gain2.gain.setValueAtTime(0.001, now);
    gain2.gain.linearRampToValueAtTime(0.06, now + 0.06);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);

    osc1.start(now);
    osc1.stop(now + 0.6);

    osc2.start(now);
    osc2.stop(now + 0.8);
  } catch (err) {
    console.error('Failed to play dynamic HTML5 chimes:', err);
  }
}

/**
 * Triggers standard native HTML5 system notifications
 */
export function triggerPushNotification(userName: string) {
  try {
    if (!('Notification' in window)) return;

    if (Notification.permission === 'granted') {
      new Notification("طلب تسجيل جديد / New Registration", {
        body: `عضو جديد: ${userName}`,
        tag: `new-user-${Date.now()}`
      });
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          new Notification("طلب تسجيل جديد / New Registration", {
            body: `عضو جديد: ${userName}`,
            tag: `new-user-${Date.now()}`
          });
        }
      });
    }
  } catch (err) {
    console.error('Failed to trigger native HTML5 browser notifications:', err);
  }
}
