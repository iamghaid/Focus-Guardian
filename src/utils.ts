let audioCtx: AudioContext | null = null;

/**
 * Plays a simple 440Hz beep sound for 0.3s using the Web Audio API
 */
export function playAlertBeep() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    if (!audioCtx) {
      audioCtx = new AudioContextClass();
    }

    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(900, audioCtx.currentTime); // Piercing 900Hz
    
    // Piercing loud volume, linear ramp-up to dodge browser popping
    gainNode.gain.setValueAtTime(0.01, audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.95, audioCtx.currentTime + 0.05);
    
    // Hold sustain at near maximum volume and decay gently at the absolute end
    const duration = 0.7; // At least 0.6 seconds
    gainNode.gain.setValueAtTime(0.95, audioCtx.currentTime + duration - 0.1);
    gainNode.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime + duration);

    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + duration);
  } catch (err) {
    console.warn('Failed to play alert beep via Web Audio API:', err);
  }
}

/**
 * Plays a soft, low-frequency warning chime for grace chances
 */
export function playSoftBeep() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    if (!audioCtx) {
      audioCtx = new AudioContextClass();
    }

    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(330, audioCtx.currentTime); // 330Hz cozy chime
    
    gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.25);

    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + 0.25);
  } catch (err) {
    console.warn('Failed to play soft beep chime:', err);
  }
}

/**
 * Formats a duration in seconds into MM:SS format
 */
export function formatMMSS(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Formats date into human readable string
 */
export function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return dateStr;
  }
}
