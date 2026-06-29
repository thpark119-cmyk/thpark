import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { Mic, MicOff, AlertCircle, RefreshCw } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

const NOTE_STRINGS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

const isMobileLike = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
const RMS_THRESHOLD = isMobileLike ? 0.003 : 0.005;

const MIN_A4_FREQUENCY = 415;
const MAX_A4_FREQUENCY = 466;
const DEFAULT_A4_FREQUENCY = 440;

const INSTRUMENT_PRESETS: Record<string, { note: string; octave: number }[]> = {
  chromatic: [],
  violin: [{note: 'G', octave: 3}, {note: 'D', octave: 4}, {note: 'A', octave: 4}, {note: 'E', octave: 5}],
  viola: [{note: 'C', octave: 3}, {note: 'G', octave: 3}, {note: 'D', octave: 4}, {note: 'A', octave: 4}],
  cello: [{note: 'C', octave: 2}, {note: 'G', octave: 2}, {note: 'D', octave: 3}, {note: 'A', octave: 3}],
  doubleBass: [{note: 'E', octave: 1}, {note: 'A', octave: 1}, {note: 'D', octave: 2}, {note: 'G', octave: 2}],
  guitar: [{note: 'E', octave: 2}, {note: 'A', octave: 2}, {note: 'D', octave: 3}, {note: 'G', octave: 3}, {note: 'B', octave: 3}, {note: 'E', octave: 4}],
  bassGuitar: [{note: 'E', octave: 1}, {note: 'A', octave: 1}, {note: 'D', octave: 2}, {note: 'G', octave: 2}],
  ukulele: [{note: 'G', octave: 4}, {note: 'C', octave: 4}, {note: 'E', octave: 4}, {note: 'A', octave: 4}],
  flute: [{note: 'C', octave: 4}, {note: 'D', octave: 4}, {note: 'E', octave: 4}, {note: 'F', octave: 4}, {note: 'G', octave: 4}, {note: 'A', octave: 4}, {note: 'B', octave: 4}, {note: 'C', octave: 5}],
  clarinet: [{note: 'E', octave: 3}, {note: 'F', octave: 3}, {note: 'G', octave: 3}, {note: 'A', octave: 3}, {note: 'B', octave: 3}, {note: 'C', octave: 4}, {note: 'D', octave: 4}, {note: 'E', octave: 4}],
  saxophone: [{note: 'A#', octave: 3}, {note: 'C', octave: 4}, {note: 'D', octave: 4}, {note: 'D#', octave: 4}, {note: 'F', octave: 4}, {note: 'G', octave: 4}, {note: 'A', octave: 4}, {note: 'A#', octave: 4}],
  trumpet: [{note: 'C', octave: 4}, {note: 'D', octave: 4}, {note: 'E', octave: 4}, {note: 'F', octave: 4}, {note: 'G', octave: 4}, {note: 'A', octave: 4}, {note: 'A#', octave: 4}, {note: 'C', octave: 5}],
  trombone: [{note: 'A#', octave: 1}, {note: 'F', octave: 2}, {note: 'A#', octave: 2}, {note: 'D', octave: 3}, {note: 'F', octave: 3}, {note: 'A#', octave: 3}],
  voice: []
};

function getNoteFromPitch(frequency: number, a4: number): number {
  const noteNum = 12 * (Math.log(frequency / a4) / Math.log(2));
  return Math.round(noteNum) + 69;
}

function getFrequencyFromNoteNumber(note: number, a4: number): number {
  return a4 * Math.pow(2, (note - 69) / 12);
}

function getCentsOffFromPitch(frequency: number, note: number, a4: number): number {
  return Math.floor(1200 * Math.log(frequency / getFrequencyFromNoteNumber(note, a4)) / Math.log(2));
}

function autoCorrelate(buf: Float32Array, sampleRate: number): number {
  let SIZE = buf.length;
  let rms = 0;

  for (let i = 0; i < SIZE; i++) {
    const val = buf[i];
    rms += val * val;
  }
  rms = Math.sqrt(rms / SIZE);
  if (rms < RMS_THRESHOLD) return -1; // Not enough signal

  let r1 = 0, r2 = SIZE - 1, thres = 0.2;
  for (let i = 0; i < SIZE / 2; i++)
    if (Math.abs(buf[i]) < thres) { r1 = i; break; }
  for (let i = 1; i < SIZE / 2; i++)
    if (Math.abs(buf[SIZE - i]) < thres) { r2 = SIZE - i; break; }

  buf = buf.subarray(r1, r2);
  SIZE = buf.length;

  const c = new Float32Array(SIZE).fill(0);
  for (let i = 0; i < SIZE; i++) {
    for (let j = 0; j < SIZE - i; j++) {
      c[i] = c[i] + buf[j] * buf[j + i];
    }
  }

  let d = 0; while (c[d] > c[d + 1]) d++;
  let maxval = -1, maxpos = -1;
  for (let i = d; i < SIZE; i++) {
    if (c[i] > maxval) {
      maxval = c[i];
      maxpos = i;
    }
  }
  let T0 = maxpos;

  const x1 = c[T0 - 1], x2 = c[T0], x3 = c[T0 + 1];
  const a = (x1 + x3 - 2 * x2) / 2;
  const b = (x3 - x1) / 2;
  if (a) T0 = T0 - b / (2 * a);

  return sampleRate / T0;
}

const createAudioContext = () => {
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) {
    throw new Error('AUDIO_CONTEXT_NOT_SUPPORTED');
  }
  return new AudioContextClass();
};

export default function Tuner() {
  const { t } = useLanguage();
  
  // Load settings from localStorage
  const loadSettings = () => {
    try {
      const saved = localStorage.getItem('musicianlog_tuner_settings');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Failed to load tuner settings', e);
    }
    return {};
  };

  const initialSettings = loadSettings();

  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [pitch, setPitch] = useState<number>(0);
  const [note, setNote] = useState<string>('--');
  const [octave, setOctave] = useState<string>('');
  const [cents, setCents] = useState<number>(0);
  const [targetFreq, setTargetFreq] = useState<number>(0);
  const [rmsVolume, setRmsVolume] = useState<number>(0);

  // Settings
  const [a4Frequency, setA4Frequency] = useState<number>(initialSettings.a4Frequency || DEFAULT_A4_FREQUENCY);
  const [detectionMode, setDetectionMode] = useState<'fast' | 'standard' | 'stable'>(initialSettings.detectionMode || 'standard');
  const [selectedInstrument, setSelectedInstrument] = useState<string>(initialSettings.selectedInstrument || 'chromatic');
  const [toneGeneratorNote, setToneGeneratorNote] = useState<string>(initialSettings.toneGeneratorNote || 'A');
  const [toneGeneratorOctave, setToneGeneratorOctave] = useState<string>(initialSettings.toneGeneratorOctave || '4');
  const [toneGeneratorVolume, setToneGeneratorVolume] = useState<number>(initialSettings.toneGeneratorVolume ?? 0.5);
  const [isPlayingTone, setIsPlayingTone] = useState<boolean>(false);
  
  // Save settings whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('musicianlog_tuner_settings', JSON.stringify({
        a4Frequency,
        detectionMode,
        selectedInstrument,
        toneGeneratorNote,
        toneGeneratorOctave,
        toneGeneratorVolume
      }));
    } catch (e) {
      console.error('Failed to save tuner settings', e);
    }
  }, [a4Frequency, detectionMode, selectedInstrument, toneGeneratorNote, toneGeneratorOctave, toneGeneratorVolume]);
  
  // Debug states
  const [audioCtxState, setAudioCtxState] = useState<string>('closed');
  const [debugMsg, setDebugMsg] = useState<string>('waiting');
  const [frameCount, setFrameCount] = useState<number>(0);
  const [activeConstraintLabel, setActiveConstraintLabel] = useState<string>('');
  const [trackInfo, setTrackInfo] = useState<any>({});
  const [showDebug, setShowDebug] = useState<boolean>(false);
  
  const pitchSmootherRef = useRef<number>(0);
  const a4Ref = useRef<number>(a4Frequency);
  const detectionModeRef = useRef<'fast' | 'standard' | 'stable'>(detectionMode);
  
  useEffect(() => {
    a4Ref.current = a4Frequency;
  }, [a4Frequency]);

  useEffect(() => {
    detectionModeRef.current = detectionMode;
  }, [detectionMode]);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const toneOscillatorRef = useRef<OscillatorNode | null>(null);
  const toneGainRef = useRef<GainNode | null>(null);
  const requestRef = useRef<number>();

  const stopToneGenerator = () => {
    if (toneOscillatorRef.current) {
      toneOscillatorRef.current.stop();
      toneOscillatorRef.current.disconnect();
      toneOscillatorRef.current = null;
    }
    if (toneGainRef.current) {
      toneGainRef.current.disconnect();
      toneGainRef.current = null;
    }
    setIsPlayingTone(false);
  };

  const playToneGenerator = async () => {
    try {
      const audioCtx = audioContextRef.current ?? createAudioContext();
      audioContextRef.current = audioCtx;
      
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }
      setAudioCtxState(audioCtx.state);

      stopToneGenerator();

      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      
      const noteIndex = NOTE_STRINGS.indexOf(toneGeneratorNote);
      const noteNum = noteIndex + (parseInt(toneGeneratorOctave) + 1) * 12;
      const freq = getFrequencyFromNoteNumber(noteNum, a4Frequency);
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      
      gain.gain.setValueAtTime(0, audioCtx.currentTime);
      gain.gain.linearRampToValueAtTime(toneGeneratorVolume, audioCtx.currentTime + 0.1);
      
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      
      osc.start();
      
      toneOscillatorRef.current = osc;
      toneGainRef.current = gain;
      setIsPlayingTone(true);
    } catch (err) {
      console.error("Tone generator failed:", err);
    }
  };

  useEffect(() => {
    if (isPlayingTone && toneOscillatorRef.current && toneGainRef.current && audioContextRef.current) {
      const noteIndex = NOTE_STRINGS.indexOf(toneGeneratorNote);
      const noteNum = noteIndex + (parseInt(toneGeneratorOctave) + 1) * 12;
      const freq = getFrequencyFromNoteNumber(noteNum, a4Frequency);
      
      toneOscillatorRef.current.frequency.setValueAtTime(freq, audioContextRef.current.currentTime);
      toneGainRef.current.gain.setValueAtTime(toneGeneratorVolume, audioContextRef.current.currentTime);
    }
  }, [toneGeneratorNote, toneGeneratorOctave, toneGeneratorVolume, a4Frequency, isPlayingTone]);

  useEffect(() => {
    return () => {
      stopToneGenerator();
    };
  }, []);
  const isListeningRef = useRef<boolean>(false);
  const bufRef = useRef<Float32Array>(new Float32Array(isMobileLike ? 4096 : 2048));

  const requestMicrophoneStream = async () => {
    const constraintsList = [
      {
        label: 'music_constraints',
        constraints: {
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
            channelCount: 1
          }
        }
      },
      {
        label: 'mobile_simple_audio',
        constraints: {
          audio: {
            channelCount: 1
          }
        }
      },
      {
        label: 'plain_audio',
        constraints: {
          audio: true
        }
      }
    ];

    let lastError: unknown = null;

    for (const item of constraintsList) {
      try {
        setDebugMsg(`trying_${item.label}`);
        const stream = await navigator.mediaDevices.getUserMedia(item.constraints);
        setActiveConstraintLabel(item.label);
        
        // Extract track info for debugging
        if (stream.getAudioTracks().length > 0) {
          const track = stream.getAudioTracks()[0];
          const settings = track.getSettings();
          setTrackInfo({
            readyState: track.readyState,
            enabled: track.enabled,
            muted: track.muted,
            label: track.label,
            sampleRate: settings.sampleRate,
            channelCount: settings.channelCount
          });
        }
        
        return stream;
      } catch (err) {
        console.warn(`getUserMedia failed for ${item.label}`, err);
        lastError = err;
      }
    }

    throw lastError;
  };

  const startTuner = async () => {
    setError(null);
    setDebugMsg('starting_mobile_safe');
    
    try {
      // 1. Create and resume AudioContext immediately on user touch
      const audioCtx = audioContextRef.current ?? createAudioContext();
      audioContextRef.current = audioCtx;
      
      if (audioCtx.state === 'suspended') {
        setDebugMsg('resuming_audio_context');
        await audioCtx.resume();
      }
      setAudioCtxState(audioCtx.state);

      // 2. Request mic permission
      setDebugMsg('requesting_mic');
      const stream = await requestMicrophoneStream();
      streamRef.current = stream;

      // 3. Setup analyser
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = isMobileLike ? 4096 : 2048;
      analyserRef.current = analyser;
      bufRef.current = new Float32Array(analyser.fftSize);
      
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);
      sourceRef.current = source;
      
      // 4. Start loop
      isListeningRef.current = true;
      setIsActive(true);
      setDebugMsg('started');
      setFrameCount(0);
      updatePitch();
    } catch (err: any) {
      console.error("Error setting up audio graph:", err);
      if (err.message === 'AUDIO_CONTEXT_NOT_SUPPORTED') {
        setError(t('tuner.micNotAvailable') || 'Microphone tuner is not available in this browser.');
      } else if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError(t('tuner.micBlocked') || 'Microphone access was blocked.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setError(t('tuner.micNotAvailable') || 'Microphone not available.');
      } else {
        setError("Audio setup failed: " + err.message);
      }
      setIsActive(false);
      setDebugMsg('setup_error');
    }
  };

  const reactivateAudio = async () => {
    const audioCtx = audioContextRef.current;
    if (!audioCtx) return;

    try {
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }
      setAudioCtxState(audioCtx.state);

      if (!isListeningRef.current && analyserRef.current) {
        isListeningRef.current = true;
        requestRef.current = requestAnimationFrame(updatePitch);
      }
      setDebugMsg('audio_reactivated');
    } catch (error) {
      console.error('Audio reactivation failed:', error);
      setDebugMsg('audio_reactivation_failed');
    }
  };

  const stopTuner = () => {
    isListeningRef.current = false;
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
      requestRef.current = undefined;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setIsActive(false);
    setAudioCtxState('closed');
    setDebugMsg('stopped');
    setPitch(0);
    setNote('--');
    setOctave('');
    setCents(0);
    setTargetFreq(0);
    setRmsVolume(0);
  };

  useEffect(() => {
    return () => {
      stopTuner();
    };
  }, []);

  const updatePitch = () => {
    if (!isListeningRef.current) return;

    try {
      if (!analyserRef.current || !audioContextRef.current) return;
      
      const analyser = analyserRef.current;
      const buf = bufRef.current;
      analyser.getFloatTimeDomainData(buf);
      
      let rms = 0;
      for (let i = 0; i < buf.length; i++) {
        rms += buf[i] * buf[i];
      }
      rms = Math.sqrt(rms / buf.length);
      setRmsVolume(rms);
      
      setFrameCount(prev => prev + 1);

      if (rms < RMS_THRESHOLD) {
        setDebugMsg('too_quiet');
      } else {
        const ac = autoCorrelate(buf, audioContextRef.current.sampleRate);
        
        if (ac !== -1 && ac >= 35 && ac <= 2000) {
          let smoothingFactor = 0.5; // standard
          if (detectionModeRef.current === 'fast') smoothingFactor = 0.8;
          else if (detectionModeRef.current === 'stable') smoothingFactor = 0.2;

          let smoothedPitch = ac;
          if (pitchSmootherRef.current !== 0 && Math.abs(ac - pitchSmootherRef.current) < 50) {
             smoothedPitch = pitchSmootherRef.current * (1 - smoothingFactor) + ac * smoothingFactor;
          }
          pitchSmootherRef.current = smoothedPitch;
          
          setPitch(smoothedPitch);
          const noteNum = getNoteFromPitch(smoothedPitch, a4Ref.current);
          const noteStr = NOTE_STRINGS[noteNum % 12];
          const oct = Math.floor(noteNum / 12) - 1;
          
          setNote(noteStr);
          setOctave(oct.toString());
          setCents(getCentsOffFromPitch(smoothedPitch, noteNum, a4Ref.current));
          setTargetFreq(getFrequencyFromNoteNumber(noteNum, a4Ref.current));
          setDebugMsg(`detected_pitch`);
        } else if (ac !== -1) {
          setDebugMsg('out_of_range');
        } else {
          setDebugMsg('pitch_not_found');
        }
      }
    } catch (error) {
      console.error('Tuner updatePitch failed:', error);
      setDebugMsg('analysis_error');
    } finally {
      if (isListeningRef.current) {
        requestRef.current = requestAnimationFrame(updatePitch);
      }
    }
  };

  const getStatusText = () => {
    if (!isActive) return '';
    if (rmsVolume < RMS_THRESHOLD) return t('tuner.playNote') || 'Play a note to detect pitch.';
    
    if (Math.abs(cents) <= 5) return t('tuner.inTune') || 'In tune';
    if (Math.abs(cents) <= 15) return t('tuner.almostInTune') || 'Almost in tune';
    if (cents < 0) return t('tuner.flat') || 'Flat';
    return t('tuner.sharp') || 'Sharp';
  };

  const getStatusColor = () => {
    if (rmsVolume < RMS_THRESHOLD) return 'text-stone-500';
    if (Math.abs(cents) <= 5) return 'text-green-500';
    if (Math.abs(cents) <= 15) return 'text-brand';
    if (cents < 0) return 'text-orange-500';
    return 'text-red-500';
  };
  
  const getPointerColor = () => {
    if (Math.abs(cents) <= 5) return 'bg-green-500';
    if (Math.abs(cents) <= 15) return 'bg-brand';
    return 'bg-white';
  };

  const gaugePercent = Math.max(-50, Math.min(50, cents));
  const needleRotation = (gaugePercent / 50) * 45;

  const showReactivateButton = isActive && audioCtxState === 'suspended';
  const showNoSignalWarning = isActive && frameCount > 120 && rmsVolume === 0;

  const getNearestReferenceNote = (currentPitch: number) => {
    if (selectedInstrument === 'chromatic' || currentPitch === 0) return null;
    const presets = INSTRUMENT_PRESETS[selectedInstrument];
    if (!presets || presets.length === 0) return null;
    
    let minDiff = Infinity;
    let nearest = presets[0];
    let targetFreq = 0;
    
    presets.forEach(p => {
      const noteIndex = NOTE_STRINGS.indexOf(p.note);
      const noteNum = noteIndex + (p.octave + 1) * 12;
      const freq = getFrequencyFromNoteNumber(noteNum, a4Frequency);
      const diff = Math.abs(currentPitch - freq);
      if (diff < minDiff) {
        minDiff = diff;
        nearest = p;
        targetFreq = freq;
      }
    });
    
    return { ...nearest, freq: targetFreq };
  };

  const nearestNote = getNearestReferenceNote(pitch);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-12 relative max-w-2xl mx-auto">
      <div className="flex justify-between items-center px-1">
        <h2 className="text-3xl font-serif italic text-white leading-none">{t('tuner.title') || 'Tuner'}</h2>
      </div>
      
      {showDebug && (
        <div className="bg-stone-900/50 border border-stone-800 rounded-xl p-3 text-[10px] font-mono text-stone-400 space-y-1">
          <div className="flex justify-between">
            <span>Mic State: {isActive ? 'active' : 'inactive'}</span>
            <span>AudioCtx: {audioCtxState}</span>
          </div>
          <div className="flex justify-between">
            <span>Level RMS: {(rmsVolume * 100).toFixed(2)}%</span>
            <span>Frames: {frameCount}</span>
          </div>
          <div className="flex justify-between">
            <span>Constraint: {activeConstraintLabel}</span>
            <span>Mobile: {isMobileLike ? 'yes' : 'no'}</span>
          </div>
          <div className="flex flex-col border-t border-stone-800 mt-1 pt-1">
            <span>Track readyState: {trackInfo.readyState}</span>
            <span>Track enabled/muted: {trackInfo.enabled ? 'true' : 'false'} / {trackInfo.muted ? 'true' : 'false'}</span>
            <span className="truncate">Track label: {trackInfo.label}</span>
            <span>Sample rate: {trackInfo.sampleRate} (Channels: {trackInfo.channelCount})</span>
          </div>
          <div className="flex justify-between border-t border-stone-800 mt-1 pt-1">
            <span className="text-stone-300">Last msg: {debugMsg}</span>
          </div>
        </div>
      )}
      
      {error && (
        <div className="bg-red-950/30 border border-red-500/20 p-4 rounded-2xl flex items-start gap-3">
          <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={18} />
          <p className="text-sm text-red-200">{error}</p>
        </div>
      )}

      {showReactivateButton && (
        <div className="bg-orange-950/30 border border-orange-500/20 p-4 rounded-2xl flex flex-col gap-3">
          <p className="text-sm text-orange-200">{t('tuner.reactivateAudioDesc')}</p>
          <button 
            onClick={reactivateAudio}
            className="self-start px-4 py-2 bg-orange-500/20 text-orange-300 rounded-lg flex items-center gap-2 text-sm font-bold"
          >
            <RefreshCw size={16} />
            {t('tuner.reactivateAudio')}
          </button>
        </div>
      )}

      {showNoSignalWarning && (
        <div className="bg-yellow-950/30 border border-yellow-500/20 p-4 rounded-2xl flex items-start gap-3">
          <AlertCircle className="text-yellow-500 shrink-0 mt-0.5" size={18} />
          <p className="text-sm text-yellow-200">{t('tuner.noInputSignal')}</p>
        </div>
      )}
      
      <div className="bg-bg-card border border-white/5 rounded-[32px] p-8 flex flex-col items-center shadow-xl shadow-black/10 relative overflow-hidden">
        {/* Tuner Info */}
        <div className="text-center space-y-2 mb-12">
          <div className="h-8 flex items-center justify-center">
             <p className={`text-sm font-bold uppercase tracking-widest ${getStatusColor()}`}>
               {getStatusText()}
             </p>
          </div>
          
          <div className="flex items-end justify-center h-40">
            <span className="text-[120px] md:text-[140px] font-bold text-white leading-none tracking-tighter">
              {note}
            </span>
            <span className="text-4xl text-stone-500 font-bold mb-4 ml-1">
              {octave}
            </span>
          </div>
          
          <div className="flex items-center justify-center gap-6 mt-4">
            <div className="text-center w-24">
              <p className="text-[10px] font-bold text-stone-600 uppercase tracking-widest mb-1">{t('tuner.targetFreq')}</p>
              <p className="text-stone-400 font-mono">{targetFreq > 0 ? targetFreq.toFixed(1) : '0.0'} Hz</p>
            </div>
            <div className="text-center w-24">
              <p className="text-[10px] font-bold text-stone-600 uppercase tracking-widest mb-1">{t('tuner.pitchDiff')}</p>
              <p className={`font-mono font-bold ${cents > 0 ? 'text-red-400' : cents < 0 ? 'text-orange-400' : 'text-green-400'}`}>
                {cents > 0 ? '+' : ''}{cents}
              </p>
            </div>
            <div className="text-center w-24">
              <p className="text-[10px] font-bold text-stone-600 uppercase tracking-widest mb-1">{t('tuner.currentFreq')}</p>
              <p className="text-white font-mono">{pitch > 0 ? pitch.toFixed(1) : '0.0'} Hz</p>
            </div>
          </div>
        </div>

        {/* Gauge */}
        <div className="relative w-full max-w-sm h-32 flex justify-center items-end mb-8">
          <div className="absolute inset-0 flex justify-center items-end pb-2">
            <div className="w-full h-[1px] bg-white/10 absolute bottom-0"></div>
            {/* Ticks */}
            {[-50, -40, -30, -20, -10, 0, 10, 20, 30, 40, 50].map(tick => (
              <div 
                key={tick} 
                className={`absolute bottom-0 w-0.5 ${tick === 0 ? 'h-6 bg-brand' : tick % 20 === 0 ? 'h-4 bg-white/30' : 'h-2 bg-white/10'}`}
                style={{ left: `${(tick + 50)}%`, transform: 'translateX(-50%)' }}
              />
            ))}
          </div>
          
          {/* Needle */}
          <motion.div 
            className="absolute bottom-0 w-1 h-32 origin-bottom flex flex-col items-center justify-end z-10"
            animate={{ rotate: isActive && rmsVolume > RMS_THRESHOLD ? needleRotation : 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            <div className={`w-1 h-24 rounded-full ${getPointerColor()} shadow-[0_0_10px_rgba(255,255,255,0.3)] transition-colors`} />
            <div className={`w-3 h-3 rounded-full mt-1 ${getPointerColor()} transition-colors`} />
          </motion.div>
        </div>

        {/* Controls */}
        <div className="flex flex-col items-center w-full max-w-xs mt-8">
          <button 
            onClick={isActive ? stopTuner : startTuner}
            className={`w-full h-16 rounded-2xl flex items-center justify-center gap-3 font-bold uppercase tracking-widest transition-all active:scale-95 ${isActive ? 'bg-stone-800 text-white border border-white/5' : 'bg-brand text-black'}`}
          >
            {isActive ? <MicOff size={20} /> : <Mic size={20} />}
            {isActive ? t('tuner.stop') : t('tuner.start')}
          </button>
          
          <div className="w-full mt-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[10px] font-bold text-stone-600 uppercase tracking-widest">{t('tuner.inputLevel')}</span>
              <span className="text-[10px] font-bold text-stone-500">{(rmsVolume * 100).toFixed(0)}%</span>
            </div>
            <div className="w-full h-1.5 bg-stone-900 rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-brand"
                animate={{ width: `${Math.min(100, rmsVolume * 300)}%` }}
                transition={{ type: 'tween', ease: 'linear', duration: 0.1 }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Instrument & Reference Notes */}
        <div className="bg-stone-900/40 border border-stone-800 rounded-2xl p-6 flex flex-col gap-6">
          <div>
            <label className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-3 block">{t('tuner.chooseInstrument') || 'Choose Instrument'}</label>
            <select
              value={selectedInstrument}
              onChange={e => setSelectedInstrument(e.target.value)}
              className="w-full h-10 bg-stone-950 border border-stone-800 rounded-xl px-3 text-white font-bold appearance-none"
            >
              {Object.keys(INSTRUMENT_PRESETS).map(inst => (
                <option key={inst} value={inst}>{t(`tuner.${inst}`) || inst}</option>
              ))}
            </select>
          </div>

          {selectedInstrument !== 'chromatic' && INSTRUMENT_PRESETS[selectedInstrument].length > 0 && (
            <div>
              <div className="flex justify-between items-baseline mb-3">
                <label className="text-xs font-bold text-stone-400 uppercase tracking-widest">{t('tuner.referenceNotes') || 'Reference Notes'}</label>
                {nearestNote && (
                  <span className="text-[10px] text-brand bg-brand/10 px-2 py-0.5 rounded">
                    {t('tuner.nearestRefNote') || 'Nearest'}: {nearestNote.note}{nearestNote.octave} ({nearestNote.freq.toFixed(1)}Hz)
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {INSTRUMENT_PRESETS[selectedInstrument].map((p, i) => {
                  const isNearest = nearestNote && nearestNote.note === p.note && nearestNote.octave === p.octave;
                  const noteIndex = NOTE_STRINGS.indexOf(p.note);
                  const noteNum = noteIndex + (p.octave + 1) * 12;
                  const freq = getFrequencyFromNoteNumber(noteNum, a4Frequency);
                  
                  return (
                    <div 
                      key={i} 
                      className={`px-3 py-1.5 rounded-lg border flex flex-col items-center ${isNearest ? 'bg-brand/10 border-brand text-brand' : 'bg-stone-950 border-stone-800 text-stone-400'}`}
                    >
                      <span className="font-bold text-sm">{p.note}{p.octave}</span>
                      <span className="text-[9px] opacity-70">{freq.toFixed(1)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          {/* A4 & Detection Mode */}
          <div className="bg-stone-900/40 border border-stone-800 rounded-2xl p-6 flex flex-col gap-6">
             {/* A4 Frequency */}
             <div>
               <div className="flex justify-between items-center mb-3">
                 <label className="text-xs font-bold text-stone-400 uppercase tracking-widest">{t('tuner.a4Ref') || 'A4 Reference'}</label>
                 <button 
                   onClick={() => setA4Frequency(DEFAULT_A4_FREQUENCY)}
                   className="text-[10px] text-stone-500 hover:text-stone-300 transition-colors bg-stone-800/50 px-2 py-1 rounded"
                 >
                   {t('tuner.resetToDefault') || 'Reset'}
                 </button>
               </div>
               <div className="flex items-center gap-3">
                 <button onClick={() => setA4Frequency(prev => Math.max(MIN_A4_FREQUENCY, prev - 1))} className="w-10 h-10 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 flex items-center justify-center transition-colors font-mono">-1</button>
                 <input 
                   type="number" 
                   value={a4Frequency || ''} 
                   onChange={e => {
                     const val = e.target.value;
                     setA4Frequency(val ? parseInt(val) : 0);
                   }}
                   onBlur={() => {
                     if (a4Frequency < MIN_A4_FREQUENCY) setA4Frequency(MIN_A4_FREQUENCY);
                     if (a4Frequency > MAX_A4_FREQUENCY) setA4Frequency(MAX_A4_FREQUENCY);
                   }}
                   className="flex-1 h-10 bg-stone-950 border border-stone-800 rounded-xl text-center text-white font-mono"
                 />
                 <button onClick={() => setA4Frequency(prev => Math.min(MAX_A4_FREQUENCY, prev + 1))} className="w-10 h-10 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 flex items-center justify-center transition-colors font-mono">+1</button>
               </div>
             </div>

             {/* Detection Settings */}
             <div>
               <label className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-3 block">{t('tuner.detectionSettings') || 'Detection Settings'}</label>
               <div className="flex gap-2 bg-stone-950 p-1 rounded-xl border border-stone-800">
                  {(['fast', 'standard', 'stable'] as const).map(mode => (
                    <button
                      key={mode}
                      onClick={() => setDetectionMode(mode)}
                      className={`flex-1 py-2 rounded-lg text-[11px] font-bold transition-all ${detectionMode === mode ? 'bg-stone-800 text-white' : 'text-stone-500 hover:text-stone-300'}`}
                    >
                      {t(`tuner.${mode}`) || mode}
                    </button>
                  ))}
               </div>
             </div>
          </div>

          {/* Tone Generator */}
          <div className="bg-stone-900/40 border border-stone-800 rounded-2xl p-6 flex flex-col gap-6">
             <div>
               <div className="flex justify-between items-center mb-3">
                 <label className="text-xs font-bold text-stone-400 uppercase tracking-widest">{t('tuner.toneGenerator') || 'Tone Generator'}</label>
                 {isPlayingTone && <span className="text-orange-400 text-[9px] bg-orange-950/50 border border-orange-500/20 px-2 py-0.5 rounded">{t('tuner.toneGenWarning') || 'Mic inaccurate'}</span>}
               </div>
               <div className="flex gap-2 mb-3">
                 <select 
                   value={toneGeneratorNote}
                   onChange={e => setToneGeneratorNote(e.target.value)}
                   className="flex-1 h-10 bg-stone-950 border border-stone-800 rounded-xl px-3 text-white font-bold appearance-none text-center"
                 >
                   {NOTE_STRINGS.map(n => <option key={n} value={n}>{n}</option>)}
                 </select>
                 <select
                   value={toneGeneratorOctave}
                   onChange={e => setToneGeneratorOctave(e.target.value)}
                   className="flex-1 h-10 bg-stone-950 border border-stone-800 rounded-xl px-3 text-white font-bold appearance-none text-center"
                 >
                   {['1', '2', '3', '4', '5', '6'].map(o => <option key={o} value={o}>{o}</option>)}
                 </select>
               </div>
               
               <div className="flex items-center gap-3 mb-4">
                 <label className="text-[10px] font-bold text-stone-500 uppercase tracking-widest w-12">{t('tuner.volume') || 'Volume'}</label>
                 <input 
                   type="range" 
                   min="0" max="1" step="0.01"
                   value={toneGeneratorVolume}
                   onChange={e => setToneGeneratorVolume(parseFloat(e.target.value))}
                   className="flex-1 h-2 bg-stone-950 rounded-lg appearance-none cursor-pointer accent-brand"
                 />
               </div>

               <button
                 onClick={isPlayingTone ? stopToneGenerator : playToneGenerator}
                 className={`w-full h-10 rounded-xl flex items-center justify-center gap-2 font-bold text-sm transition-colors ${isPlayingTone ? 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30' : 'bg-stone-800 text-stone-300 hover:bg-stone-700'}`}
               >
                 {isPlayingTone ? (t('tuner.stopRefTone') || 'Stop Tone') : (t('tuner.playRefTone') || 'Play Tone')}
               </button>
             </div>
          </div>
        </div>
      </div>
      
      <div className="flex justify-center mt-4">
        <button
          type="button"
          onClick={() => setShowDebug((prev) => !prev)}
          className="text-stone-500 hover:text-stone-300 text-xs transition-colors py-2 px-4 rounded-full border border-stone-800/50 bg-stone-900/30"
        >
          {showDebug ? t('tuner.hideDebug') || 'Hide Debug' : t('tuner.showDebug') || 'Show Debug'}
        </button>
      </div>
    </motion.div>
  );
}
