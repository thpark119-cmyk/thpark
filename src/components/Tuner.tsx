import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { Mic, MicOff, AlertCircle } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

const NOTE_STRINGS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function getNoteFromPitch(frequency: number): number {
  const noteNum = 12 * (Math.log(frequency / 440) / Math.log(2));
  return Math.round(noteNum) + 69;
}

function getFrequencyFromNoteNumber(note: number): number {
  return 440 * Math.pow(2, (note - 69) / 12);
}

function getCentsOffFromPitch(frequency: number, note: number): number {
  return Math.floor(1200 * Math.log(frequency / getFrequencyFromNoteNumber(note)) / Math.log(2));
}

function autoCorrelate(buf: Float32Array, sampleRate: number): number {
  let SIZE = buf.length;
  let rms = 0;

  for (let i = 0; i < SIZE; i++) {
    const val = buf[i];
    rms += val * val;
  }
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.01) return -1; // Not enough signal

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

export default function Tuner() {
  const { t } = useLanguage();
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [pitch, setPitch] = useState<number>(0);
  const [note, setNote] = useState<string>('--');
  const [octave, setOctave] = useState<string>('');
  const [cents, setCents] = useState<number>(0);
  const [targetFreq, setTargetFreq] = useState<number>(0);
  const [rmsVolume, setRmsVolume] = useState<number>(0);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const requestRef = useRef<number>();
  const bufRef = useRef<Float32Array>(new Float32Array(2048));

  const startTuner = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioCtx;
      
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      analyserRef.current = analyser;
      
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);
      sourceRef.current = source;
      
      setIsActive(true);
      updatePitch();
    } catch (err: any) {
      console.error(err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError(t('tuner.micBlocked') || 'Microphone access was blocked.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setError(t('tuner.micNotAvailable') || 'Microphone not available.');
      } else {
        setError(t('tuner.micRequired') || 'Microphone permission is required.');
      }
      setIsActive(false);
    }
  };

  const stopTuner = () => {
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
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
    
    const ac = autoCorrelate(buf, audioContextRef.current.sampleRate);
    
    if (ac !== -1 && ac > 40 && ac < 2000) {
      const pitchValue = ac;
      setPitch(pitchValue);
      const noteNum = getNoteFromPitch(pitchValue);
      const noteStr = NOTE_STRINGS[noteNum % 12];
      const oct = Math.floor(noteNum / 12) - 1;
      
      setNote(noteStr);
      setOctave(oct.toString());
      setCents(getCentsOffFromPitch(pitchValue, noteNum));
      setTargetFreq(getFrequencyFromNoteNumber(noteNum));
    } else {
      // If noise, we don't clear it immediately to avoid jitter, but if it stays silent we could.
      // We will let it stay as last note, just low volume
    }

    if (isActive) {
      requestRef.current = requestAnimationFrame(updatePitch);
    }
  };

  const getStatusText = () => {
    if (!isActive) return '';
    if (rmsVolume < 0.01) return t('tuner.playNote') || 'Play a note to detect pitch.';
    
    if (Math.abs(cents) <= 5) return t('tuner.inTune') || 'In tune';
    if (Math.abs(cents) <= 15) return t('tuner.almostInTune') || 'Almost in tune';
    if (cents < 0) return t('tuner.flat') || 'Flat';
    return t('tuner.sharp') || 'Sharp';
  };

  const getStatusColor = () => {
    if (rmsVolume < 0.01) return 'text-stone-500';
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

  // calculate rotation/position. Cents range -50 to 50
  const gaugePercent = Math.max(-50, Math.min(50, cents)); // -50 to 50
  const needleRotation = (gaugePercent / 50) * 45; // -45deg to 45deg

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-12 relative max-w-2xl mx-auto">
      <div className="flex justify-between items-center px-1">
        <h2 className="text-3xl font-serif italic text-white leading-none">{t('tuner.title') || 'Tuner'}</h2>
      </div>
      
      {error && (
        <div className="bg-red-950/30 border border-red-500/20 p-4 rounded-2xl flex items-start gap-3">
          <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={18} />
          <p className="text-sm text-red-200">{error}</p>
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
            animate={{ rotate: isActive && rmsVolume > 0.01 ? needleRotation : 0 }}
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
    </motion.div>
  );
}
