/**
 * Notification Sound Utility
 * Plays a subtle notification sound using Web Audio API
 */

let audioContext: AudioContext | null = null;

function audioContextConstructor() {
  const legacyWindow: Window & { webkitAudioContext?: typeof AudioContext } = window;
  return window.AudioContext || legacyWindow.webkitAudioContext;
}

/**
 * Initialize audio context (needed for iOS/Safari)
 */
export function initAudioContext() {
  if (!audioContext) {
    const Constructor = audioContextConstructor();
    if (!Constructor) throw new Error('Web Audio is unavailable');
    audioContext = new Constructor();
  }
  return audioContext;
}

/**
 * Play a subtle notification sound
 * Uses a pleasant two-tone beep similar to macOS notifications
 */
export function playNotificationSound() {
  try {
    const ctx = initAudioContext();

    // Resume context if suspended (Safari requirement)
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const now = ctx.currentTime;

    // Create oscillator for first tone (higher pitch)
    const oscillator1 = ctx.createOscillator();
    const gainNode1 = ctx.createGain();

    oscillator1.connect(gainNode1);
    gainNode1.connect(ctx.destination);

    // Settings for pleasant notification sound
    oscillator1.type = 'sine';
    oscillator1.frequency.value = 800; // Hz (pleasant high tone)

    // Fade in and out for smooth sound
    gainNode1.gain.setValueAtTime(0, now);
    gainNode1.gain.linearRampToValueAtTime(0.1, now + 0.01); // Fade in (quiet volume)
    gainNode1.gain.linearRampToValueAtTime(0, now + 0.15); // Fade out

    oscillator1.start(now);
    oscillator1.stop(now + 0.15);

    // Create second tone (lower pitch) - plays after first
    const oscillator2 = ctx.createOscillator();
    const gainNode2 = ctx.createGain();

    oscillator2.connect(gainNode2);
    gainNode2.connect(ctx.destination);

    oscillator2.type = 'sine';
    oscillator2.frequency.value = 600; // Hz (pleasant low tone)

    // Second tone timing
    gainNode2.gain.setValueAtTime(0, now + 0.1);
    gainNode2.gain.linearRampToValueAtTime(0.1, now + 0.11);
    gainNode2.gain.linearRampToValueAtTime(0, now + 0.25);

    oscillator2.start(now + 0.1);
    oscillator2.stop(now + 0.25);

  } catch (error) {
    console.error('[NotificationSound] Failed to play sound:', error);
  }
}

/**
 * Check if notification sounds are supported
 */
export function isNotificationSoundSupported(): boolean {
  return !!audioContextConstructor();
}
