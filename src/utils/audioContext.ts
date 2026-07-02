export const getAudioContext = (() => {
  let audioCtx: AudioContext | null = null;
  return () => {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) {
        throw new Error('AUDIO_CONTEXT_NOT_SUPPORTED');
      }
      audioCtx = new AudioContextClass();
    }
    return audioCtx;
  };
})();

export const ensureAudioContextRunning = async (): Promise<AudioContext> => {
  const audioCtx = getAudioContext();
  if (audioCtx.state === 'suspended') {
    await audioCtx.resume();
  }
  return audioCtx;
};
