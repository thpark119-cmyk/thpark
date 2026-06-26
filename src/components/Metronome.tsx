import React, { useState, useEffect, useRef } from 'react';
import { Play, Square, Plus, Minus, Volume2, VolumeX, Hand } from 'lucide-react';
import { motion } from 'framer-motion';
import { useLanguage } from '../context/LanguageContext';

const MIN_BPM = 10;
const MAX_BPM = 400;
const STORAGE_KEY = 'musicianlog_metronome_settings';

type BeatState = 'accent' | 'normal' | 'mute';

interface MetronomeSettings {
  bpm: number;
  numerator: number;
  denominator: number;
  beatStates: BeatState[];
  volume: number;
  isMuted: boolean;
}

const defaultSettings: MetronomeSettings = {
  bpm: 120,
  numerator: 4,
  denominator: 4,
  beatStates: ['accent', 'normal', 'normal', 'normal'],
  volume: 0.8,
  isMuted: false,
};

export default function Metronome() {
  const { t } = useLanguage();

  const [settings, setSettings] = useState<MetronomeSettings>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return { ...defaultSettings, ...parsed };
      } catch (e) {
        console.error(e);
      }
    }
    return defaultSettings;
  });

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentBeat, setCurrentBeat] = useState(0);

  // Audio Context and Scheduling
  const audioCtxRef = useRef<AudioContext | null>(null);
  const nextNoteTimeRef = useRef(0);
  const currentBeatInBarRef = useRef(0);
  const timerIDRef = useRef<number | null>(null);
  const lookahead = 25.0; // ms
  const scheduleAheadTime = 0.1; // s

  // Settings refs for audio callback
  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  // Tap tempo
  const tapTimesRef = useRef<number[]>([]);

  // Init audio context
  const initAudio = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
  };

  const nextNote = () => {
    const secondsPerBeat = 60.0 / settingsRef.current.bpm;
    nextNoteTimeRef.current += secondsPerBeat;
    currentBeatInBarRef.current = (currentBeatInBarRef.current + 1) % settingsRef.current.numerator;
  };

  const playClick = (time: number, beatState: BeatState) => {
    if (beatState === 'mute' || settingsRef.current.isMuted) return;
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    if (beatState === 'accent') {
      osc.frequency.value = 880.0;
    } else {
      osc.frequency.value = 440.0;
    }

    gainNode.gain.value = settingsRef.current.volume;
    
    // Envelope to avoid clicks
    gainNode.gain.setValueAtTime(gainNode.gain.value, time);
    gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.1);

    osc.start(time);
    osc.stop(time + 0.1);
  };

  const scheduler = () => {
    while (audioCtxRef.current && nextNoteTimeRef.current < audioCtxRef.current.currentTime + scheduleAheadTime) {
      // Ensure we stay in bounds if numerator was just decreased
      currentBeatInBarRef.current = currentBeatInBarRef.current % settingsRef.current.numerator;
      
      const currentB = currentBeatInBarRef.current;
      const bState = settingsRef.current.beatStates[currentB];
      
      playClick(nextNoteTimeRef.current, bState);
      
      // Update visual indicator slightly before the actual sound using setTimeout
      const timeToPlay = (nextNoteTimeRef.current - audioCtxRef.current.currentTime) * 1000;
      setTimeout(() => {
        // Need to pass the latest isPlaying value conceptually, or just let UI update if it was playing.
        // It's safer to just set currentBeat and clear it when stopping.
        setCurrentBeat(currentB);
      }, Math.max(0, timeToPlay));

      nextNote();
    }
    timerIDRef.current = window.setTimeout(scheduler, lookahead);
  };

  useEffect(() => {
    if (isPlaying) {
      if (!audioCtxRef.current) {
        initAudio();
      }
      currentBeatInBarRef.current = 0;
      setCurrentBeat(0);
      nextNoteTimeRef.current = audioCtxRef.current!.currentTime + 0.05;
      scheduler();
    } else {
      if (timerIDRef.current !== null) {
        window.clearTimeout(timerIDRef.current);
        timerIDRef.current = null;
      }
      setCurrentBeat(0);
    }
    return () => {
      if (timerIDRef.current !== null) {
        window.clearTimeout(timerIDRef.current);
      }
    };
  }, [isPlaying]);

  const togglePlay = () => {
    if (!isPlaying) {
      initAudio();
    }
    setIsPlaying(!isPlaying);
  };

  const updateBpm = (newBpm: number) => {
    const clamped = Math.max(MIN_BPM, Math.min(MAX_BPM, newBpm));
    setSettings(s => ({ ...s, bpm: clamped }));
  };

  const handleTap = () => {
    const now = performance.now();
    const times = tapTimesRef.current;
    
    // Reset if more than 2 seconds since last tap
    if (times.length > 0 && now - times[times.length - 1] > 2000) {
      tapTimesRef.current = [];
    }
    
    tapTimesRef.current.push(now);
    
    if (tapTimesRef.current.length > 1) {
      // Keep only last 5 intervals (6 taps)
      if (tapTimesRef.current.length > 6) {
        tapTimesRef.current.shift();
      }
      
      let totalInterval = 0;
      for (let i = 1; i < tapTimesRef.current.length; i++) {
        totalInterval += tapTimesRef.current[i] - tapTimesRef.current[i-1];
      }
      const avgInterval = totalInterval / (tapTimesRef.current.length - 1);
      const calculatedBpm = Math.round(60000 / avgInterval);
      
      updateBpm(calculatedBpm);
    }
  };

  const updateNumerator = (num: number) => {
    setSettings(s => {
      const newStates = [...s.beatStates];
      if (num > newStates.length) {
        for (let i = newStates.length; i < num; i++) {
          newStates.push('normal');
        }
      } else if (num < newStates.length) {
        newStates.length = num;
      }
      return { ...s, numerator: num, beatStates: newStates };
    });
  };

  const cycleBeatState = (index: number) => {
    setSettings(s => {
      const newStates = [...s.beatStates];
      const current = newStates[index];
      const next: BeatState = current === 'accent' ? 'normal' : current === 'normal' ? 'mute' : 'accent';
      newStates[index] = next;
      return { ...s, beatStates: newStates };
    });
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-12 max-w-2xl mx-auto">
      <div className="flex justify-between items-center px-1">
        <div>
          <h2 className="text-3xl font-serif italic text-white leading-none">{t('metronome.title')}</h2>
        </div>
      </div>

      <div className="bg-bg-card border border-white/5 p-6 md:p-8 rounded-[32px] space-y-8">
        
        {/* BPM Display and Controls */}
        <div className="flex flex-col items-center space-y-6">
          <div className="text-center w-full">
            <input
              type="number"
              value={settings.bpm}
              onChange={(e) => updateBpm(parseInt(e.target.value) || MIN_BPM)}
              onBlur={(e) => updateBpm(parseInt(e.target.value) || MIN_BPM)}
              className="text-7xl font-bold text-center bg-transparent text-white outline-none w-full max-w-[200px]"
              min={MIN_BPM}
              max={MAX_BPM}
            />
            <p className="text-stone-500 font-bold uppercase tracking-widest text-sm">{t('metronome.bpm')}</p>
          </div>

          <div className="w-full flex items-center gap-4">
            <input
              type="range"
              min={MIN_BPM}
              max={MAX_BPM}
              value={settings.bpm}
              onChange={(e) => updateBpm(parseInt(e.target.value))}
              className="flex-1 accent-brand h-2 bg-stone-800 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <div className="flex items-center gap-2 md:gap-4 w-full justify-center">
            <button onClick={() => updateBpm(settings.bpm - 5)} className="w-12 h-12 flex items-center justify-center bg-stone-800 rounded-2xl text-stone-400 active:scale-95 transition-all text-sm font-bold">-5</button>
            <button onClick={() => updateBpm(settings.bpm - 1)} className="w-12 h-12 flex items-center justify-center bg-stone-800 rounded-2xl text-stone-400 active:scale-95 transition-all"><Minus size={20} /></button>
            <button
              onClick={togglePlay}
              className={`w-20 h-20 flex items-center justify-center rounded-full text-white shadow-xl active:scale-95 transition-all ${
                isPlaying ? 'bg-amber-500 shadow-amber-500/20' : 'bg-brand shadow-brand/20'
              }`}
            >
              {isPlaying ? <Square size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" className="ml-2" />}
            </button>
            <button onClick={() => updateBpm(settings.bpm + 1)} className="w-12 h-12 flex items-center justify-center bg-stone-800 rounded-2xl text-stone-400 active:scale-95 transition-all"><Plus size={20} /></button>
            <button onClick={() => updateBpm(settings.bpm + 5)} className="w-12 h-12 flex items-center justify-center bg-stone-800 rounded-2xl text-stone-400 active:scale-95 transition-all text-sm font-bold">+5</button>
          </div>
          
          <button 
            onClick={handleTap}
            className="w-full max-w-[200px] h-12 bg-stone-800/50 border border-white/5 rounded-2xl text-stone-300 font-bold text-sm uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <Hand size={16} />
            {t('metronome.tapTempo')}
          </button>
        </div>

        <hr className="border-white/5" />

        {/* Time Signature and Beats */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-xs font-bold text-stone-500 uppercase tracking-widest">{t('metronome.timeSignature')}</p>
            <div className="flex items-center gap-2 bg-stone-800/50 p-1 rounded-xl">
              <select 
                value={settings.numerator}
                onChange={(e) => updateNumerator(parseInt(e.target.value))}
                className="bg-transparent text-white font-bold outline-none text-center appearance-none px-2"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => (
                  <option key={n} value={n} className="bg-stone-900">{n}</option>
                ))}
              </select>
              <span className="text-stone-500 font-bold">/</span>
              <select
                value={settings.denominator}
                onChange={(e) => setSettings({...settings, denominator: parseInt(e.target.value)})}
                className="bg-transparent text-white font-bold outline-none text-center appearance-none px-2"
              >
                {[4, 8].map(n => (
                  <option key={n} value={n} className="bg-stone-900">{n}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-2 md:gap-3 py-4">
            {settings.beatStates.map((state, i) => (
              <button
                key={i}
                onClick={() => cycleBeatState(i)}
                className={`w-10 h-10 md:w-12 md:h-12 rounded-full border-2 transition-all flex items-center justify-center
                  ${isPlaying && currentBeat === i ? 'ring-4 ring-white/20' : ''}
                  ${state === 'accent' ? 'bg-brand border-brand' : 
                    state === 'normal' ? 'bg-stone-700 border-stone-600' : 
                    'bg-transparent border-stone-800 text-stone-600'
                  }
                `}
              >
                {state === 'mute' && <VolumeX size={16} />}
              </button>
            ))}
          </div>
          <p className="text-center text-[10px] text-stone-600">{t('metronome.beatSettings')}</p>
        </div>

        <hr className="border-white/5" />

        {/* Volume */}
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setSettings({...settings, isMuted: !settings.isMuted})}
            className={`w-10 h-10 flex items-center justify-center rounded-xl transition-colors ${settings.isMuted ? 'bg-red-500/20 text-red-500' : 'bg-stone-800 text-stone-400'}`}
          >
            {settings.isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={settings.volume}
            onChange={(e) => setSettings({...settings, volume: parseFloat(e.target.value)})}
            disabled={settings.isMuted}
            className="flex-1 accent-stone-400 h-2 bg-stone-800 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
          />
        </div>

      </div>
    </motion.div>
  );
}
