let outputAudioContext: AudioContext | null = null;

export function getOutputAudioContext(): AudioContext {
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;

  if (!AudioContextClass) {
    throw new Error('AUDIO_CONTEXT_NOT_SUPPORTED');
  }

  if (!outputAudioContext || outputAudioContext.state === 'closed') {
    outputAudioContext = new AudioContextClass();
  }

  return outputAudioContext;
}

export async function ensureOutputAudioRunning(): Promise<AudioContext> {
  const ctx = getOutputAudioContext();

  if (ctx.state === 'suspended') {
    await ctx.resume();
  }

  return ctx;
}

export async function playAudibleTestBeep(): Promise<{
  state: string;
  sampleRate: number;
  currentTime: number;
  startedAt: number;
  stoppedAt: number;
}> {
  const ctx = await ensureOutputAudioRunning();

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(440, now);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.3, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.20);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.22);

  return {
    state: ctx.state,
    sampleRate: ctx.sampleRate,
    currentTime: ctx.currentTime,
    startedAt: now,
    stoppedAt: now + 0.22,
  };
}
