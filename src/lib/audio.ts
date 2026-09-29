let ctx: AudioContext | null = null;
const ac = () => (ctx ||= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)());

/** Pleasant three-note chime. */
export function chime() {
  try {
    const c = ac();
    [523.25, 659.25, 783.99].forEach((f, i) => {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      const t = c.currentTime + i * 0.18;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.25, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
      o.connect(g).connect(c.destination);
      o.start(t);
      o.stop(t + 1);
    });
  } catch {
    /* audio unsupported */
  }
}

export function tick() {
  try {
    const c = ac();
    const o = c.createOscillator();
    const g = c.createGain();
    o.frequency.value = 1200;
    g.gain.setValueAtTime(0.08, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.05);
    o.connect(g).connect(c.destination);
    o.start();
    o.stop(c.currentTime + 0.06);
  } catch {
    /* noop */
  }
}

export type NoiseKind = 'off' | 'white' | 'pink' | 'brown' | 'rain';
let noiseNode: AudioBufferSourceNode | null = null;
let noiseGain: GainNode | null = null;

export function playNoise(kind: NoiseKind, volume = 0.4) {
  stopNoise();
  if (kind === 'off') return;
  const c = ac();
  const len = c.sampleRate * 4;
  const buf = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'white') d[i] = w * 0.3;
      else if (kind === 'pink') {
        b0 = 0.99886 * b0 + w * 0.0555179;
        b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856;
        b4 = 0.55 * b4 + w * 0.5329522;
        b5 = -0.7616 * b5 - w * 0.016898;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.08;
        b6 = w * 0.115926;
      } else if (kind === 'brown') {
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.2;
      } else {
        // rain: filtered noise with random droplets
        last = (last + 0.08 * w) / 1.08;
        d[i] = last * 1.6 + (Math.random() < 0.0008 ? (Math.random() - 0.5) * 0.6 : 0);
      }
    }
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const g = c.createGain();
  g.gain.value = volume;
  src.connect(g).connect(c.destination);
  src.start();
  noiseNode = src;
  noiseGain = g;
}

export function setNoiseVolume(v: number) {
  if (noiseGain) noiseGain.gain.value = v;
}

export function stopNoise() {
  try {
    noiseNode?.stop();
  } catch {
    /* noop */
  }
  noiseNode = null;
  noiseGain = null;
}

export function notify(title: string, body: string) {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') new Notification(title, { body });
}
