let sharedAudioContext: AudioContext | null = null;

export function getSharedAudioContext(): AudioContext {
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;

  if (!AudioContextClass) {
    throw new Error('AUDIO_CONTEXT_NOT_SUPPORTED');
  }

  if (!sharedAudioContext || sharedAudioContext.state === 'closed') {
    sharedAudioContext = new AudioContextClass();
  }

  return sharedAudioContext;
}

export async function ensureAudioContextRunning(): Promise<AudioContext> {
  const audioCtx = getSharedAudioContext();

  if (audioCtx.state === 'suspended') {
    await audioCtx.resume();
  }

  return audioCtx;
}

export async function unlockAudioForMobile(): Promise<{
  state: string;
  sampleRate: number;
  currentTime: number;
}> {
  const audioCtx = await ensureAudioContextRunning();

  const oscillator = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(440, audioCtx.currentTime);
  gain.gain.setValueAtTime(0.0001, audioCtx.currentTime);

  oscillator.connect(gain);
  gain.connect(audioCtx.destination);

  oscillator.start(audioCtx.currentTime);
  oscillator.stop(audioCtx.currentTime + 0.03);

  return {
    state: audioCtx.state,
    sampleRate: audioCtx.sampleRate,
    currentTime: audioCtx.currentTime,
  };
}

