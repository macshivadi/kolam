/** Optional soft temple-bell / ambient tone for Draw along. Off by default. */

const STORAGE_KEY = "kolam-sound";

let ctx: AudioContext | null = null;

export function soundEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "on";
  } catch {
    return false;
  }
}

export function setSoundEnabled(on: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, on ? "on" : "off");
  } catch {
    /* ignore quota / private mode */
  }
}

function audio(): AudioContext | null {
  const C = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!C) return null;
  if (!ctx) ctx = new C();
  return ctx;
}

/** A quiet bell cluster. Must be called from a user gesture. */
export function playDrawAlongSound(): void {
  if (!soundEnabled()) return;
  const ac = audio();
  if (!ac) return;
  void ac.resume();
  const t = ac.currentTime;
  const freqs = [392, 588, 784];
  const master = ac.createGain();
  master.gain.setValueAtTime(0.07, t);
  master.connect(ac.destination);
  for (let i = 0; i < freqs.length; i++) {
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freqs[i], t);
    osc.frequency.exponentialRampToValueAtTime(freqs[i] * 0.97, t + 1.8);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.45 / (i + 1), t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.1 + i * 0.15);
    osc.connect(g);
    g.connect(master);
    osc.start(t);
    osc.stop(t + 2.4);
  }
}
