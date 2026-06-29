import React, { useState, useEffect, useRef } from 'react';
import { Play, Square, Plus, Minus, Volume2, VolumeX, Hand, Save, ListMusic, Timer, TrendingUp, Ear, ChevronDown, ChevronUp, Trash2, Edit2, Check, Eye } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '../context/LanguageContext';

const MIN_BPM = 10;
const MAX_BPM = 400;
const STORAGE_KEY = 'musicianlog_metronome_settings';
const PRESETS_STORAGE_KEY = 'musicianlog_metronome_presets';
const SETLISTS_STORAGE_KEY = 'musicianlog_metronome_setlists';

function NumberInput({
  value,
  onChange,
  onBlur,
  min,
  max,
  className,
  placeholder,
}: {
  value: number;
  onChange: (val: number) => void;
  onBlur?: (val: number) => void;
  min: number;
  max: number;
  className?: string;
  placeholder?: string;
}) {
  const [localValue, setLocalValue] = useState(value.toString());

  useEffect(() => {
    const localNum = localValue === '' ? 0 : parseInt(localValue, 10);
    if (localNum !== value) {
      setLocalValue(value.toString());
    }
  }, [value]); // intentional: don't put localValue in dependency to avoid infinite loop, just run when prop 'value' changes

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value;
    // If the visible value was '0' (either localValue was '0' or '') and we typed something
    if ((localValue === '0' || localValue === '') && raw.length > 1 && raw.startsWith('0')) {
      raw = raw.substring(1);
    }
    
    const onlyDigits = raw.replace(/\D/g, '');
    
    setLocalValue(onlyDigits);
    
    if (onlyDigits === '') {
      onChange(0);
    } else {
      let num = parseInt(onlyDigits, 10);
      onChange(num);
    }
  };

  const handleBlur = () => {
    let num = localValue === '' ? 0 : parseInt(localValue, 10);
    num = Math.max(min, Math.min(max, num));
    setLocalValue(num.toString());
    if (onBlur) {
      onBlur(num);
    } else {
      onChange(num);
    }
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      value={localValue === '' ? '0' : localValue}
      onChange={handleChange}
      onBlur={handleBlur}
      className={className}
      placeholder={placeholder}
    />
  );
}

const getTempoMarking = (bpm: number) => {
  if (bpm <= 40) return 'Grave';
  if (bpm <= 60) return 'Largo';
  if (bpm <= 76) return 'Adagio';
  if (bpm <= 108) return 'Andante';
  if (bpm <= 120) return 'Moderato';
  if (bpm <= 168) return 'Allegro';
  if (bpm <= 200) return 'Presto';
  return 'Prestissimo';
};

const TEMPO_MARKINGS = [
  { name: 'Grave', bpm: 40 },
  { name: 'Largo', bpm: 50 },
  { name: 'Lento', bpm: 55 },
  { name: 'Adagio', bpm: 66 },
  { name: 'Andante', bpm: 84 },
  { name: 'Moderato', bpm: 108 },
  { name: 'Allegretto', bpm: 116 },
  { name: 'Allegro', bpm: 132 },
  { name: 'Vivace', bpm: 160 },
  { name: 'Presto', bpm: 184 },
  { name: 'Prestissimo', bpm: 208 }
];

const STANDARD_TIME_SIGNATURES = [
  '1/4', '2/4', '3/4', '4/4', '5/4', '6/4', '7/4',
  '3/8', '4/8', '5/8', '6/8', '7/8', '9/8', '12/8',
  '2/2', '3/2', '4/2'
];

type BeatState = 'accent' | 'normal' | 'mute';

export type MetronomeMode = 'basic' | 'preset' | 'setlist' | 'practice' | 'gig';
export type SoundType = 'classic' | 'woodblock' | 'digital' | 'soft' | 'drum';

interface MetronomeSettings {
  bpm: number;
  numerator: number;
  denominator: number;
  beatStates: BeatState[];
  volume: number;
  isMuted: boolean;
  currentMode?: MetronomeMode;
  ledEnabled?: boolean;
  flashEnabled?: boolean;
  pendulumEnabled?: boolean;
  focusViewEnabled?: boolean;
  normalSound?: SoundType;
  accentSound?: SoundType;
}

interface MetronomePreset extends MetronomeSettings {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

interface MetronomeSetlist {
  id: string;
  name: string;
  presetIds: string[];
  createdAt: number;
  updatedAt: number;
}

interface PracticeSettings {
  targetTime: number; // minutes
  targetBars: number;
}

interface AutoTempoSettings {
  enabled: boolean;
  mode: 'bars' | 'time';
  intervalBars: number;
  intervalSeconds: number;
  increment: number;
  maxBpm: number;
}

interface CoachSettings {
  enabled: boolean;
  soundBars: number;
  silentBars: number;
}

const defaultSettings: MetronomeSettings = {
  bpm: 120,
  numerator: 4,
  denominator: 4,
  beatStates: ['accent', 'normal', 'normal', 'normal'],
  volume: 0.8,
  isMuted: false,
  currentMode: 'basic',
  ledEnabled: true,
  flashEnabled: false,
  pendulumEnabled: false,
  focusViewEnabled: false,
  normalSound: 'classic',
  accentSound: 'classic',
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

  // New States
  const [presets, setPresets] = useState<MetronomePreset[]>(() => {
    const saved = localStorage.getItem(PRESETS_STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  });

  const [setlists, setSetlists] = useState<MetronomeSetlist[]>(() => {
    const saved = localStorage.getItem(SETLISTS_STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  });

  const [activeSetlistId, setActiveSetlistId] = useState<string | null>(null);
  const [activePresetIndex, setActivePresetIndex] = useState<number>(0);
  const [isPresetsExpanded, setIsPresetsExpanded] = useState(false);
  const [isPracticeExpanded, setIsPracticeExpanded] = useState(false);
  const [isAutoTempoExpanded, setIsAutoTempoExpanded] = useState(false);
  const [isCoachExpanded, setIsCoachExpanded] = useState(false);
  const [isVisualsExpanded, setIsVisualsExpanded] = useState(false);
  const [isSoundsExpanded, setIsSoundsExpanded] = useState(false);

  const [practiceSettings, setPracticeSettings] = useState<PracticeSettings>({
    targetTime: 0,
    targetBars: 0,
  });
  const [practiceState, setPracticeState] = useState({
    active: false,
    elapsedTime: 0,
    barCount: 0,
  });

  const [autoTempo, setAutoTempo] = useState<AutoTempoSettings>({
    enabled: false,
    mode: 'bars',
    intervalBars: 8,
    intervalSeconds: 60,
    increment: 5,
    maxBpm: 200,
  });

  const [coachMode, setCoachMode] = useState<CoachSettings>({
    enabled: false,
    soundBars: 4,
    silentBars: 4,
  });
  const [isSilentPhase, setIsSilentPhase] = useState(false);

  const [presetNameInput, setPresetNameInput] = useState('');
  const [setlistNameInput, setSetlistNameInput] = useState('');
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [editingSetlistId, setEditingSetlistId] = useState<string | null>(null);

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

  useEffect(() => {
    localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(presets));
  }, [presets]);

  useEffect(() => {
    localStorage.setItem(SETLISTS_STORAGE_KEY, JSON.stringify(setlists));
  }, [setlists]);

  const practiceStateRef = useRef(practiceState);
  useEffect(() => { practiceStateRef.current = practiceState; }, [practiceState]);

  const practiceSettingsRef = useRef(practiceSettings);
  useEffect(() => { practiceSettingsRef.current = practiceSettings; }, [practiceSettings]);

  const autoTempoRef = useRef(autoTempo);
  useEffect(() => { autoTempoRef.current = autoTempo; }, [autoTempo]);

  const coachModeRef = useRef(coachMode);
  useEffect(() => { coachModeRef.current = coachMode; }, [coachMode]);

  const isSilentPhaseRef = useRef(isSilentPhase);
  useEffect(() => { isSilentPhaseRef.current = isSilentPhase; }, [isSilentPhase]);

  const totalBarsPlayedRef = useRef(0);
  const lastTempoIncreaseRef = useRef({ bars: 0, time: 0 });
  const playStartTimeRef = useRef(0);
  const playStartAudioTimeRef = useRef(0);
  const practiceIntervalRef = useRef<number | null>(null);

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

    if (currentBeatInBarRef.current === 0) {
      totalBarsPlayedRef.current += 1;
      const newBarCount = totalBarsPlayedRef.current;

      if (practiceStateRef.current.active) {
        setPracticeState(s => ({ ...s, barCount: newBarCount }));
        if (practiceSettingsRef.current.targetBars > 0 && newBarCount >= practiceSettingsRef.current.targetBars) {
          setIsPlaying(false);
          setTimeout(() => alert(t('metronome.targetReached')), 100);
        }
      }

      if (autoTempoRef.current.enabled && autoTempoRef.current.mode === 'bars') {
        if (newBarCount - lastTempoIncreaseRef.current.bars >= autoTempoRef.current.intervalBars) {
          lastTempoIncreaseRef.current.bars = newBarCount;
          setSettings(s => {
            const newBpm = Math.min(s.bpm + autoTempoRef.current.increment, autoTempoRef.current.maxBpm);
            return { ...s, bpm: newBpm };
          });
        }
      }

      if (coachModeRef.current.enabled) {
        const cycleLength = coachModeRef.current.soundBars + coachModeRef.current.silentBars;
        if (cycleLength > 0) {
          const currentCycleBar = newBarCount % cycleLength;
          const newIsSilent = currentCycleBar >= coachModeRef.current.soundBars;
          if (newIsSilent !== isSilentPhaseRef.current) {
            setIsSilentPhase(newIsSilent);
          }
        }
      }
    }
  };

  const playClick = (time: number, beatState: BeatState) => {
    if (beatState === 'mute' || settingsRef.current.isMuted) return;

    if (coachModeRef.current.enabled) {
      const cycleLength = coachModeRef.current.soundBars + coachModeRef.current.silentBars;
      if (cycleLength > 0) {
        const currentCycleBar = totalBarsPlayedRef.current % cycleLength;
        if (currentCycleBar >= coachModeRef.current.soundBars) {
          // Inside silent bars
          return;
        }
      }
    }

    const ctx = audioCtxRef.current;
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    const isAccent = beatState === 'accent';
    const type = isAccent ? (settingsRef.current.accentSound || 'classic') : (settingsRef.current.normalSound || 'classic');
    const vol = settingsRef.current.volume;

    if (type === 'classic') {
      osc.type = 'sine';
      osc.frequency.value = isAccent ? 880 : 440;
      gainNode.gain.setValueAtTime(vol, time);
      gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
      osc.start(time);
      osc.stop(time + 0.1);
    } else if (type === 'digital') {
      osc.type = 'square';
      osc.frequency.value = isAccent ? 1200 : 800;
      gainNode.gain.setValueAtTime(vol * 0.5, time);
      gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
      osc.start(time);
      osc.stop(time + 0.15);
    } else if (type === 'woodblock') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(isAccent ? 1200 : 800, time);
      osc.frequency.exponentialRampToValueAtTime(isAccent ? 800 : 400, time + 0.05);
      gainNode.gain.setValueAtTime(vol * 0.8, time);
      gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
      osc.start(time);
      osc.stop(time + 0.05);
    } else if (type === 'soft') {
      osc.type = 'sine';
      osc.frequency.value = isAccent ? 600 : 400;
      gainNode.gain.setValueAtTime(vol * 0.4, time);
      gainNode.gain.linearRampToValueAtTime(0.001, time + 0.05);
      osc.start(time);
      osc.stop(time + 0.05);
    } else if (type === 'drum') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(isAccent ? 150 : 100, time);
      osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.1);
      gainNode.gain.setValueAtTime(vol * 0.8, time);
      gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
      osc.start(time);
      osc.stop(time + 0.1);
    }
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
      playStartAudioTimeRef.current = audioCtxRef.current!.currentTime;
      playStartTimeRef.current = Date.now();
      totalBarsPlayedRef.current = 0;
      lastTempoIncreaseRef.current = { bars: 0, time: 0 };
      setIsSilentPhase(false);

      if (practiceStateRef.current.active) {
        setPracticeState(s => ({ ...s, elapsedTime: 0, barCount: 0 }));
      }

      scheduler();

      practiceIntervalRef.current = window.setInterval(() => {
        if (!audioCtxRef.current) return;
        const elapsedSeconds = audioCtxRef.current.currentTime - playStartAudioTimeRef.current;
        
        if (practiceStateRef.current.active) {
          setPracticeState(s => ({ ...s, elapsedTime: Math.floor(elapsedSeconds) }));
          
          if (practiceSettingsRef.current.targetTime > 0 && elapsedSeconds >= practiceSettingsRef.current.targetTime * 60) {
            setIsPlaying(false);
            // using setTimeout to allow render before alert, or simply stop
            setTimeout(() => alert(t('metronome.targetReached')), 100);
            return;
          }
        }
        
        if (autoTempoRef.current.enabled && autoTempoRef.current.mode === 'time') {
          if (elapsedSeconds - lastTempoIncreaseRef.current.time >= autoTempoRef.current.intervalSeconds) {
            lastTempoIncreaseRef.current.time = elapsedSeconds;
            setSettings(s => {
              const newBpm = Math.min(s.bpm + autoTempoRef.current.increment, autoTempoRef.current.maxBpm);
              return { ...s, bpm: newBpm };
            });
          }
        }
      }, 1000);

    } else {
      if (timerIDRef.current !== null) {
        window.clearTimeout(timerIDRef.current);
        timerIDRef.current = null;
      }
      if (practiceIntervalRef.current !== null) {
        window.clearInterval(practiceIntervalRef.current);
        practiceIntervalRef.current = null;
      }
      setCurrentBeat(0);
    }
    return () => {
      if (timerIDRef.current !== null) {
        window.clearTimeout(timerIDRef.current);
      }
      if (practiceIntervalRef.current !== null) {
        window.clearInterval(practiceIntervalRef.current);
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

  const holdTimeoutRef = useRef<number | null>(null);
  const holdIntervalRef = useRef<number | null>(null);

  const stopHoldChange = () => {
    if (holdTimeoutRef.current !== null) {
      window.clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
    }
    if (holdIntervalRef.current !== null) {
      window.clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
  };

  const startHoldChange = (delta: number) => {
    stopHoldChange();
    setSettings(s => ({ ...s, bpm: Math.max(MIN_BPM, Math.min(MAX_BPM, s.bpm + delta)) }));

    holdTimeoutRef.current = window.setTimeout(() => {
      holdIntervalRef.current = window.setInterval(() => {
        setSettings(s => ({ ...s, bpm: Math.max(MIN_BPM, Math.min(MAX_BPM, s.bpm + delta)) }));
      }, 120);
    }, 350);
  };

  // Cleanup hold on unmount
  useEffect(() => {
    return () => stopHoldChange();
  }, []);

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

  const updateTimeSignature = (num: number, den: number) => {
    setSettings(s => {
      const newStates = [...s.beatStates];
      if (num > newStates.length) {
        for (let i = newStates.length; i < num; i++) {
          newStates.push('normal');
        }
      } else if (num < newStates.length) {
        newStates.length = num;
      }
      if (newStates.length > 0) {
        newStates[0] = 'accent';
      }
      return { ...s, numerator: num, denominator: den, beatStates: newStates };
    });
  };

  const savePreset = () => {
    if (!presetNameInput.trim()) return;
    
    if (editingPresetId) {
      setPresets(presets.map(p => p.id === editingPresetId ? {
        ...p,
        name: presetNameInput.trim(),
        bpm: settings.bpm,
        numerator: settings.numerator,
        denominator: settings.denominator,
        beatStates: settings.beatStates,
        volume: settings.volume,
        isMuted: settings.isMuted,
        updatedAt: Date.now()
      } : p));
      setEditingPresetId(null);
    } else {
      const newPreset: MetronomePreset = {
        id: 'preset_' + Date.now(),
        name: presetNameInput.trim(),
        bpm: settings.bpm,
        numerator: settings.numerator,
        denominator: settings.denominator,
        beatStates: settings.beatStates,
        volume: settings.volume,
        isMuted: settings.isMuted,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      setPresets([...presets, newPreset]);
    }
    setPresetNameInput('');
  };

  const loadPreset = (preset: MetronomePreset) => {
    setSettings({
      bpm: preset.bpm,
      numerator: preset.numerator,
      denominator: preset.denominator,
      beatStates: preset.beatStates,
      volume: preset.volume,
      isMuted: preset.isMuted,
    });
  };

  const deletePreset = (id: string) => {
    setPresets(presets.filter(p => p.id !== id));
    // Also remove from setlists
    setSetlists(setlists.map(sl => ({
      ...sl,
      presetIds: sl.presetIds.filter(pid => pid !== id)
    })));
  };

  const createSetlist = () => {
    if (!setlistNameInput.trim()) return;
    
    if (editingSetlistId) {
      setSetlists(setlists.map(sl => sl.id === editingSetlistId ? {
        ...sl,
        name: setlistNameInput.trim(),
        updatedAt: Date.now()
      } : sl));
      setEditingSetlistId(null);
    } else {
      const newSetlist: MetronomeSetlist = {
        id: 'setlist_' + Date.now(),
        name: setlistNameInput.trim(),
        presetIds: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      setSetlists([...setlists, newSetlist]);
    }
    setSetlistNameInput('');
  };

  const deleteSetlist = (id: string) => {
    setSetlists(setlists.filter(sl => sl.id !== id));
    if (activeSetlistId === id) setActiveSetlistId(null);
  };

  const addPresetToSetlist = (setlistId: string, presetId: string) => {
    setSetlists(setlists.map(sl => sl.id === setlistId ? {
      ...sl,
      presetIds: [...sl.presetIds, presetId],
      updatedAt: Date.now()
    } : sl));
  };

  const removePresetFromSetlist = (setlistId: string, index: number) => {
    setSetlists(setlists.map(sl => {
      if (sl.id === setlistId) {
        const newIds = [...sl.presetIds];
        newIds.splice(index, 1);
        return { ...sl, presetIds: newIds, updatedAt: Date.now() };
      }
      return sl;
    }));
  };

  const goSetlistPrev = () => {
    if (!activeSetlistId) return;
    const sl = setlists.find(s => s.id === activeSetlistId);
    if (!sl || sl.presetIds.length === 0) return;
    const newIdx = (activePresetIndex - 1 + sl.presetIds.length) % sl.presetIds.length;
    setActivePresetIndex(newIdx);
    const p = presets.find(pr => pr.id === sl.presetIds[newIdx]);
    if (p) loadPreset(p);
  };

  const goSetlistNext = () => {
    if (!activeSetlistId) return;
    const sl = setlists.find(s => s.id === activeSetlistId);
    if (!sl || sl.presetIds.length === 0) return;
    const newIdx = (activePresetIndex + 1) % sl.presetIds.length;
    setActivePresetIndex(newIdx);
    const p = presets.find(pr => pr.id === sl.presetIds[newIdx]);
    if (p) loadPreset(p);
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
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-12 max-w-5xl mx-auto">
      <div className="flex justify-between items-center px-1">
        <div>
          <h2 className="text-3xl font-serif italic text-white leading-none">{t('metronome.title')}</h2>
        </div>
      </div>

      {/* Mode Selector */}
      <div className="flex overflow-x-auto pb-2 gap-2 px-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {(['basic', 'gig'] as MetronomeMode[]).map((mode) => (
          <button
            key={mode}
            onClick={() => setSettings(s => ({ ...s, currentMode: mode }))}
            className={`px-4 py-2 rounded-full whitespace-nowrap text-sm font-bold transition-colors ${
              settings.currentMode === mode ? 'bg-white text-black' : 'bg-stone-800 text-stone-400 hover:bg-stone-700'
            }`}
          >
            {mode === 'basic' ? t('metronome.basicMetronome') : t(`metronome.mode${mode.charAt(0).toUpperCase() + mode.slice(1)}` as any)}
          </button>
        ))}
      </div>

      <div className="lg:grid lg:grid-cols-2 lg:gap-6 lg:items-start">
        <div className="space-y-6">
          {settings.currentMode === 'gig' || settings.focusViewEnabled ? (
            <div className="bg-bg-card border border-white/5 p-6 md:p-12 rounded-[32px] space-y-12 min-h-[60vh] flex flex-col items-center justify-center relative overflow-hidden">
          {settings.flashEnabled && isPlaying && currentBeat === 0 && !isSilentPhase && (
            <motion.div initial={{opacity:0.3}} animate={{opacity:0}} transition={{duration:0.5}} className="absolute inset-0 bg-white z-0 pointer-events-none" />
          )}
          
          {settings.currentMode === 'gig' && activeSetlistId && (
            <div className="absolute top-6 left-6 right-6 flex justify-between items-center z-10">
              <span className="text-sm font-bold text-stone-500 uppercase tracking-widest">{setlists.find(s=>s.id===activeSetlistId)?.name}</span>
              {setlists.find(s=>s.id===activeSetlistId)?.presetIds.length ? (
                <span className="text-white font-bold">{presets.find(p => p.id === setlists.find(s=>s.id===activeSetlistId)?.presetIds[activePresetIndex])?.name}</span>
              ) : null}
            </div>
          )}

          <div className="z-10 text-center space-y-4">
            <div className="relative inline-flex flex-col items-center">
              <div className="relative">
                <select
                  value={getTempoMarking(settings.bpm)}
                  onChange={(e) => {
                    const selectedMarking = TEMPO_MARKINGS.find(m => m.name === e.target.value);
                    if (selectedMarking) {
                      updateBpm(selectedMarking.bpm);
                    }
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                >
                  <option disabled>{t('metronome.chooseTempo')}</option>
                  {TEMPO_MARKINGS.map(m => (
                    <option key={m.name} value={m.name}>{m.name}</option>
                  ))}
                </select>
                <div className="flex items-center gap-1 justify-center cursor-pointer">
                  <p className="text-stone-500 font-bold uppercase tracking-widest text-sm">{getTempoMarking(settings.bpm)}</p>
                  <ChevronDown size={14} className="text-stone-500" />
                </div>
              </div>
            </div>
            <div className="text-[120px] md:text-[160px] font-bold text-white leading-none tracking-tighter">
              {settings.bpm}
            </div>
            <p className="text-stone-500 font-bold uppercase tracking-widest">{settings.numerator} / {settings.denominator}</p>
          </div>

          <div className="z-10 flex flex-col items-center gap-8 w-full max-w-sm">
            {settings.ledEnabled && (
              <div className="flex gap-4">
                {Array.from({ length: settings.numerator }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-4 h-4 rounded-full transition-all duration-75 ${
                      isPlaying && currentBeat === i && !isSilentPhase
                        ? settings.beatStates[i] === 'accent' ? 'bg-brand scale-125 shadow-[0_0_15px_rgba(var(--brand),0.5)]' : 'bg-white scale-110 shadow-[0_0_10px_rgba(255,255,255,0.5)]'
                        : 'bg-stone-800'
                    }`}
                  />
                ))}
              </div>
            )}
            
            <button
              onClick={togglePlay}
              className={`w-32 h-32 rounded-full flex items-center justify-center transition-all ${
                isPlaying ? 'bg-red-500 text-white shadow-[0_0_30px_rgba(239,68,68,0.3)]' : 'bg-brand text-white shadow-[0_0_30px_rgba(var(--brand),0.3)]'
              }`}
            >
              {isPlaying ? <Square fill="currentColor" size={48} /> : <Play fill="currentColor" size={48} className="ml-2" />}
            </button>

            {settings.currentMode === 'gig' && (
              <div className="flex w-full gap-2">
                <button onClick={goSetlistPrev} className="flex-1 py-4 bg-stone-800 rounded-2xl text-xs font-bold text-white uppercase tracking-widest flex items-center justify-center gap-2"><ListMusic size={14}/> {t('metronome.prevSong')}</button>
                <button onClick={goSetlistNext} className="flex-1 py-4 bg-stone-800 rounded-2xl text-xs font-bold text-white uppercase tracking-widest flex items-center justify-center gap-2">{t('metronome.nextSong')} <ListMusic size={14}/></button>
              </div>
            )}
            
            {settings.currentMode === 'gig' && (
              <p className="text-xs text-stone-500 flex items-center justify-center gap-2 mt-4"><Check size={14}/> {t('metronome.editLocked')}. {t('metronome.switchToBasic')}</p>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-bg-card border border-white/5 p-6 md:p-8 rounded-[32px] space-y-8 relative overflow-hidden">
          {settings.flashEnabled && isPlaying && currentBeat === 0 && !isSilentPhase && (
            <motion.div initial={{opacity:0.2}} animate={{opacity:0}} transition={{duration:0.4}} className="absolute inset-0 bg-white z-0 pointer-events-none" />
          )}
        
        {/* BPM Display and Controls */}
        <div className="flex flex-col items-center space-y-6">
          <div className="text-center w-full">
            <NumberInput
              value={settings.bpm}
              onChange={(val) => setSettings(s => ({ ...s, bpm: val }))}
              onBlur={(val) => updateBpm(val)}
              className="text-7xl font-bold text-center bg-transparent text-white outline-none w-full max-w-[200px]"
              min={MIN_BPM}
              max={MAX_BPM}
            />
            <p className="text-stone-500 font-bold uppercase tracking-widest text-sm">{t('metronome.bpm')}</p>
            <div className="relative inline-flex flex-col items-center mt-2">
              <div className="relative">
                <select
                  value={getTempoMarking(settings.bpm)}
                  onChange={(e) => {
                    const selectedMarking = TEMPO_MARKINGS.find(m => m.name === e.target.value);
                    if (selectedMarking) {
                      updateBpm(selectedMarking.bpm);
                    }
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                >
                  <option disabled>{t('metronome.chooseTempo')}</option>
                  {TEMPO_MARKINGS.map(m => (
                    <option key={m.name} value={m.name}>{m.name}</option>
                  ))}
                </select>
                <div className="flex items-center gap-1 justify-center cursor-pointer">
                  <p className="text-brand font-bold uppercase tracking-widest text-xs">{getTempoMarking(settings.bpm)}</p>
                  <ChevronDown size={12} className="text-brand" />
                </div>
              </div>
              <p className="text-[9px] text-stone-600 mt-1">{t('metronome.tempoReference')}</p>
            </div>
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
            <button 
              onPointerDown={(e) => { e.preventDefault(); startHoldChange(-5); }}
              onPointerUp={stopHoldChange}
              onPointerLeave={stopHoldChange}
              onPointerCancel={stopHoldChange}
              className="w-12 h-12 flex items-center justify-center bg-stone-800 rounded-2xl text-stone-400 active:scale-95 transition-all text-sm font-bold select-none touch-manipulation">-5</button>
            <button 
              onPointerDown={(e) => { e.preventDefault(); startHoldChange(-1); }}
              onPointerUp={stopHoldChange}
              onPointerLeave={stopHoldChange}
              onPointerCancel={stopHoldChange}
              className="w-12 h-12 flex items-center justify-center bg-stone-800 rounded-2xl text-stone-400 active:scale-95 transition-all select-none touch-manipulation"><Minus size={20} /></button>
            <button
              onClick={togglePlay}
              className={`w-20 h-20 flex items-center justify-center rounded-full text-white shadow-xl active:scale-95 transition-all ${
                isPlaying ? 'bg-amber-500 shadow-amber-500/20' : 'bg-brand shadow-brand/20'
              }`}
            >
              {isPlaying ? <Square size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" className="ml-2" />}
            </button>
            <button 
              onPointerDown={(e) => { e.preventDefault(); startHoldChange(1); }}
              onPointerUp={stopHoldChange}
              onPointerLeave={stopHoldChange}
              onPointerCancel={stopHoldChange}
              className="w-12 h-12 flex items-center justify-center bg-stone-800 rounded-2xl text-stone-400 active:scale-95 transition-all select-none touch-manipulation"><Plus size={20} /></button>
            <button 
              onPointerDown={(e) => { e.preventDefault(); startHoldChange(5); }}
              onPointerUp={stopHoldChange}
              onPointerLeave={stopHoldChange}
              onPointerCancel={stopHoldChange}
              className="w-12 h-12 flex items-center justify-center bg-stone-800 rounded-2xl text-stone-400 active:scale-95 transition-all text-sm font-bold select-none touch-manipulation">+5</button>
          </div>
          
          <p className="text-[10px] text-stone-600 mt-2">{t('metronome.holdToChange')}</p>
          
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
            <div className="flex items-center gap-2 bg-stone-800/50 p-1 rounded-xl relative">
              <select 
                value={`${settings.numerator}/${settings.denominator}`}
                onChange={(e) => {
                  const [num, den] = e.target.value.split('/').map(Number);
                  updateTimeSignature(num, den);
                }}
                className="bg-transparent text-white font-bold outline-none text-center appearance-none px-4 py-1 cursor-pointer w-full"
              >
                {!STANDARD_TIME_SIGNATURES.includes(`${settings.numerator}/${settings.denominator}`) && (
                  <option value={`${settings.numerator}/${settings.denominator}`} className="bg-stone-900">
                    {settings.numerator}/{settings.denominator} ({t('metronome.custom') || 'Custom'})
                  </option>
                )}
                {STANDARD_TIME_SIGNATURES.map(ts => (
                  <option key={ts} value={ts} className="bg-stone-900">{ts}</option>
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

        <div className="flex flex-col items-center gap-6">
          {/* LED Display */}
          {settings.ledEnabled && (
            <div className="flex gap-4">
              {settings.beatStates.map((state, i) => (
                <div
                  key={i}
                  className={`w-4 h-4 rounded-full transition-all duration-75 ${
                    isPlaying && currentBeat === i && !isSilentPhase
                      ? state === 'accent' ? 'bg-brand scale-125 shadow-[0_0_15px_rgba(var(--brand),0.5)]' : 'bg-white scale-110 shadow-[0_0_10px_rgba(255,255,255,0.5)]'
                      : 'bg-stone-800'
                  }`}
                />
              ))}
            </div>
          )}

          {/* Pendulum Display */}
          {settings.pendulumEnabled && (
            <div className="w-full max-w-[300px] h-2 bg-stone-800 rounded-full relative overflow-hidden mt-4">
              <motion.div
                initial={false}
                animate={{
                  x: isPlaying ? (currentBeat % 2 === 0 ? '-100%' : '100%') : '0%',
                }}
                transition={{
                  duration: 60 / settings.bpm,
                  ease: 'easeInOut',
                  repeat: isPlaying ? Infinity : 0,
                  repeatType: "reverse"
                }}
                className="absolute top-0 bottom-0 left-1/2 w-4 bg-brand rounded-full -ml-2"
              />
            </div>
          )}
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
      )}
      </div>

      {settings.currentMode !== 'gig' && !settings.focusViewEnabled && (
      <div className="space-y-4 mt-6 lg:mt-0 flex flex-col">
        {/* Presets & Setlists */}
        <div className="bg-bg-card border border-white/5 rounded-[32px] overflow-hidden order-4">
          <button 
            onClick={() => setIsPresetsExpanded(!isPresetsExpanded)}
            className="w-full p-6 flex justify-between items-center text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand/10 text-brand flex items-center justify-center">
                <ListMusic size={20} />
              </div>
              <span className="font-bold text-white">{t('metronome.presetsAndSetlists')}</span>
            </div>
            {isPresetsExpanded ? <ChevronUp size={20} className="text-stone-500" /> : <ChevronDown size={20} className="text-stone-500" />}
          </button>
          <AnimatePresence>
            {isPresetsExpanded && (
              <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                <div className="p-6 pt-0 space-y-8 border-t border-white/5 mt-2">
                  
                  {/* Presets */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-stone-500 uppercase tracking-widest">{t('metronome.preset')}</h3>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={presetNameInput}
                        onChange={(e) => setPresetNameInput(e.target.value)}
                        placeholder={t('metronome.presetName')}
                        className="flex-1 bg-stone-800/50 border border-white/5 rounded-2xl px-4 text-white outline-none focus:border-brand/40 transition-colors text-sm"
                      />
                      <button onClick={savePreset} disabled={!presetNameInput.trim()} className="px-4 bg-brand text-white font-bold text-xs uppercase tracking-widest rounded-2xl disabled:opacity-50 flex items-center gap-2">
                        {editingPresetId ? <Check size={16}/> : <Save size={16}/>}
                        {editingPresetId ? t('metronome.overwrite') : t('metronome.savePreset')}
                      </button>
                      {editingPresetId && <button onClick={() => {setEditingPresetId(null); setPresetNameInput('');}} className="px-4 bg-stone-800 text-white font-bold text-xs uppercase tracking-widest rounded-2xl">Cancel</button>}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {presets.map(p => (
                        <div key={p.id} className="flex items-center justify-between bg-stone-800/30 border border-white/5 p-3 rounded-2xl">
                          <button onClick={() => loadPreset(p)} className="flex-1 text-left">
                            <p className="text-sm text-white font-bold truncate">{p.name}</p>
                            <p className="text-xs text-stone-500">{p.bpm} BPM • {p.numerator}/{p.denominator}</p>
                          </button>
                          <div className="flex gap-1 ml-2">
                            <button onClick={() => {setEditingPresetId(p.id); setPresetNameInput(p.name);}} className="p-2 text-stone-400 hover:text-white transition-colors"><Edit2 size={14} /></button>
                            <button onClick={() => deletePreset(p.id)} className="p-2 text-stone-400 hover:text-red-400 transition-colors"><Trash2 size={14} /></button>
                          </div>
                        </div>
                      ))}
                      {presets.length === 0 && <p className="text-xs text-stone-500">{t('repertoire.empty')}</p>}
                    </div>
                  </div>

                  {/* Setlists */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-stone-500 uppercase tracking-widest">{t('metronome.setlist')}</h3>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={setlistNameInput}
                        onChange={(e) => setSetlistNameInput(e.target.value)}
                        placeholder="Setlist Name"
                        className="flex-1 bg-stone-800/50 border border-white/5 rounded-2xl px-4 text-white outline-none focus:border-brand/40 transition-colors text-sm"
                      />
                      <button onClick={createSetlist} disabled={!setlistNameInput.trim()} className="px-4 bg-stone-700 text-white font-bold text-xs uppercase tracking-widest rounded-2xl disabled:opacity-50">
                        {editingSetlistId ? <Check size={16}/> : <Plus size={16}/>}
                        {editingSetlistId ? t('common.edit') : t('metronome.createSetlist')}
                      </button>
                      {editingSetlistId && <button onClick={() => {setEditingSetlistId(null); setSetlistNameInput('');}} className="px-4 bg-stone-800 text-white font-bold text-xs uppercase tracking-widest rounded-2xl">Cancel</button>}
                    </div>

                    <div className="space-y-4">
                      {setlists.map(sl => (
                        <div key={sl.id} className={`border p-4 rounded-2xl space-y-4 transition-colors ${activeSetlistId === sl.id ? 'border-brand bg-brand/5' : 'border-white/5 bg-stone-800/20'}`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <input 
                                type="radio" 
                                name="activeSetlist" 
                                checked={activeSetlistId === sl.id} 
                                onChange={() => {setActiveSetlistId(sl.id); setActivePresetIndex(0);}} 
                                className="accent-brand w-4 h-4 cursor-pointer"
                              />
                              <span className="text-sm font-bold text-white">{sl.name}</span>
                            </div>
                            <div className="flex gap-1">
                              <button onClick={() => {setEditingSetlistId(sl.id); setSetlistNameInput(sl.name);}} className="p-2 text-stone-400 hover:text-white transition-colors"><Edit2 size={14} /></button>
                              <button onClick={() => deleteSetlist(sl.id)} className="p-2 text-stone-400 hover:text-red-400 transition-colors"><Trash2 size={14} /></button>
                            </div>
                          </div>

                          {/* Presets in this setlist */}
                          <div className="pl-7 space-y-2">
                            {sl.presetIds.map((pid, idx) => {
                              const p = presets.find(pr => pr.id === pid);
                              if (!p) return null;
                              return (
                                <div key={idx} className={`flex items-center justify-between p-2 rounded-xl border ${activeSetlistId === sl.id && activePresetIndex === idx ? 'bg-brand/20 border-brand/50 text-white' : 'bg-stone-800/50 border-white/5 text-stone-400'}`}>
                                  <button onClick={() => {setActiveSetlistId(sl.id); setActivePresetIndex(idx); loadPreset(p);}} className="flex-1 text-left text-xs font-bold truncate">
                                    {idx + 1}. {p.name} ({p.bpm} BPM)
                                  </button>
                                  <button onClick={() => removePresetFromSetlist(sl.id, idx)} className="p-1 text-stone-500 hover:text-red-400"><Trash2 size={12} /></button>
                                </div>
                              );
                            })}
                            <div className="flex gap-2">
                              <select 
                                className="flex-1 bg-stone-900 border border-white/5 rounded-xl px-3 py-2 text-xs text-white outline-none"
                                onChange={(e) => {
                                  if(e.target.value) addPresetToSetlist(sl.id, e.target.value);
                                  e.target.value = '';
                                }}
                                defaultValue=""
                              >
                                <option value="" disabled>+ Add Preset</option>
                                {presets.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                              </select>
                            </div>
                          </div>

                          {activeSetlistId === sl.id && sl.presetIds.length > 0 && (
                            <div className="pl-7 flex gap-2">
                              <button onClick={goSetlistPrev} className="flex-1 py-2 bg-stone-800 rounded-xl text-xs font-bold text-white uppercase tracking-widest">{t('metronome.prevPreset')}</button>
                              <button onClick={goSetlistNext} className="flex-1 py-2 bg-brand rounded-xl text-xs font-bold text-white uppercase tracking-widest">{t('metronome.nextPreset')}</button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Auto Tempo */}
        <div className="bg-bg-card border border-white/5 rounded-[32px] overflow-hidden order-1">
          <button 
            onClick={() => setIsAutoTempoExpanded(!isAutoTempoExpanded)}
            className="w-full p-6 flex justify-between items-center text-left"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-brand/10 text-brand flex items-center justify-center">
                <TrendingUp size={20} />
              </div>
              <span className="font-bold text-white">{t('metronome.autoTempo')}</span>
            </div>
            {isAutoTempoExpanded ? <ChevronUp size={20} className="text-stone-500" /> : <ChevronDown size={20} className="text-stone-500" />}
          </button>
          
          <AnimatePresence>
            {isAutoTempoExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="p-6 pt-0 space-y-6 border-t border-white/5 mt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-stone-300">{t('metronome.enableAutoTempo')}</span>
                    <button 
                      onClick={() => setAutoTempo(s => ({...s, enabled: !s.enabled}))}
                      className={`w-12 h-6 rounded-full transition-colors relative ${autoTempo.enabled ? 'bg-brand' : 'bg-stone-700'}`}
                    >
                      <div className={`absolute top-1 bottom-1 w-4 bg-white rounded-full transition-all ${autoTempo.enabled ? 'left-7' : 'left-1'}`} />
                    </button>
                  </div>

                  <div className={`space-y-4 transition-opacity ${autoTempo.enabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                    <div className="flex gap-2 p-1 bg-stone-900 rounded-xl">
                      {(['bars', 'seconds'] as const).map(mode => (
                        <button
                          key={mode}
                          onClick={() => setAutoTempo(s => ({...s, mode}))}
                          className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${
                            autoTempo.mode === mode ? 'bg-stone-800 text-white' : 'text-stone-500'
                          }`}
                        >
                          {mode === 'bars' ? t('metronome.bars') : t('metronome.seconds')}
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-bold text-stone-500 uppercase tracking-widest block mb-2">{t('metronome.increaseInterval')} ({autoTempo.mode === 'bars' ? t('metronome.bars') : t('metronome.seconds')})</label>
                        <NumberInput min={1} max={9999} value={autoTempo.mode === 'bars' ? autoTempo.intervalBars : autoTempo.intervalSeconds} onChange={val => {
                          setAutoTempo(s => s.mode === 'bars' ? {...s, intervalBars: val} : {...s, intervalSeconds: val});
                        }} className="w-full bg-stone-800/50 border border-white/5 rounded-2xl p-3 text-white outline-none text-sm" />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-stone-500 uppercase tracking-widest block mb-2">{t('metronome.increment')}</label>
                        <NumberInput min={1} max={100} value={autoTempo.increment} onChange={val => setAutoTempo(s => ({...s, increment: val}))} className="w-full bg-stone-800/50 border border-white/5 rounded-2xl p-3 text-white outline-none text-sm" />
                      </div>
                      <div className="col-span-2">
                        <label className="text-[10px] font-bold text-stone-500 uppercase tracking-widest block mb-2">{t('metronome.maxBpm')}</label>
                        <NumberInput min={10} max={400} value={autoTempo.maxBpm} onChange={val => setAutoTempo(s => ({...s, maxBpm: val}))} className="w-full bg-stone-800/50 border border-white/5 rounded-2xl p-3 text-white outline-none text-sm" />
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Practice Mode */}
        <div className="bg-bg-card border border-white/5 rounded-[32px] overflow-hidden order-2">
          <button 
            onClick={() => setIsPracticeExpanded(!isPracticeExpanded)}
            className="w-full p-6 flex justify-between items-center text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                <Timer size={20} />
              </div>
              <span className="font-bold text-white">{t('metronome.practiceMode')}</span>
            </div>
            {isPracticeExpanded ? <ChevronUp size={20} className="text-stone-500" /> : <ChevronDown size={20} className="text-stone-500" />}
          </button>
          <AnimatePresence>
            {isPracticeExpanded && (
              <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                <div className="p-6 pt-0 space-y-6 border-t border-white/5 mt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-white">Enable Practice Mode</span>
                    <button 
                      onClick={() => setPracticeState(s => ({...s, active: !s.active}))}
                      className={`w-12 h-6 rounded-full transition-colors relative ${practiceState.active ? 'bg-amber-500' : 'bg-stone-700'}`}
                    >
                      <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${practiceState.active ? 'left-7' : 'left-1'}`} />
                    </button>
                  </div>

                  <div className={`space-y-4 transition-opacity ${practiceState.active ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-bold text-stone-500 uppercase tracking-widest block mb-2">{t('metronome.targetTime')} (min)</label>
                        <NumberInput min={0} max={999} value={practiceSettings.targetTime} onChange={val => setPracticeSettings(s => ({...s, targetTime: val}))} className="w-full bg-stone-800/50 border border-white/5 rounded-2xl p-3 text-white outline-none text-sm" />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-stone-500 uppercase tracking-widest block mb-2">{t('metronome.targetBars')}</label>
                        <NumberInput min={0} max={9999} value={practiceSettings.targetBars} onChange={val => setPracticeSettings(s => ({...s, targetBars: val}))} className="w-full bg-stone-800/50 border border-white/5 rounded-2xl p-3 text-white outline-none text-sm" />
                      </div>
                    </div>

                    <div className="bg-stone-900 border border-white/5 rounded-2xl p-4 flex justify-around">
                      <div className="text-center">
                        <p className="text-[10px] text-stone-500 uppercase tracking-widest mb-1">{t('metronome.currentTime')}</p>
                        <p className="text-xl font-mono text-amber-500">{Math.floor(practiceState.elapsedTime / 60)}:{(practiceState.elapsedTime % 60).toString().padStart(2, '0')}</p>
                      </div>
                      <div className="w-px bg-white/5" />
                      <div className="text-center">
                        <p className="text-[10px] text-stone-500 uppercase tracking-widest mb-1">{t('metronome.currentBars')}</p>
                        <p className="text-xl font-mono text-amber-500">{practiceState.barCount}</p>
                      </div>
                    </div>
                    
                    <button onClick={() => setPracticeState(s => ({...s, elapsedTime: 0, barCount: 0}))} className="w-full py-3 bg-stone-800 rounded-2xl text-xs font-bold text-white uppercase tracking-widest">{t('metronome.reset')}</button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Coach Mode */}
        <div className="bg-bg-card border border-white/5 rounded-[32px] overflow-hidden order-3">
          <button 
            onClick={() => setIsCoachExpanded(!isCoachExpanded)}
            className="w-full p-6 flex justify-between items-center text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
                <Ear size={20} />
              </div>
              <span className="font-bold text-white">{t('metronome.coachMode')}</span>
            </div>
            {isCoachExpanded ? <ChevronUp size={20} className="text-stone-500" /> : <ChevronDown size={20} className="text-stone-500" />}
          </button>
          <AnimatePresence>
            {isCoachExpanded && (
              <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                <div className="p-6 pt-0 space-y-6 border-t border-white/5 mt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-white">Enable Coach Mode</span>
                    <button 
                      onClick={() => setCoachMode(s => ({...s, enabled: !s.enabled}))}
                      className={`w-12 h-6 rounded-full transition-colors relative ${coachMode.enabled ? 'bg-blue-500' : 'bg-stone-700'}`}
                    >
                      <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${coachMode.enabled ? 'left-7' : 'left-1'}`} />
                    </button>
                  </div>

                  <div className={`space-y-4 transition-opacity ${coachMode.enabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-bold text-stone-500 uppercase tracking-widest block mb-2">{t('metronome.soundBars')}</label>
                        <NumberInput min={1} max={999} value={coachMode.soundBars} onChange={val => setCoachMode(s => ({...s, soundBars: val}))} className="w-full bg-stone-800/50 border border-white/5 rounded-2xl p-3 text-white outline-none text-sm" />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-stone-500 uppercase tracking-widest block mb-2">{t('metronome.silentBars')}</label>
                        <NumberInput min={1} max={999} value={coachMode.silentBars} onChange={val => setCoachMode(s => ({...s, silentBars: val}))} className="w-full bg-stone-800/50 border border-white/5 rounded-2xl p-3 text-white outline-none text-sm" />
                      </div>
                    </div>
                    {isPlaying && coachMode.enabled && (
                      <div className={`p-4 rounded-2xl text-center font-bold text-sm transition-colors ${isSilentPhase ? 'bg-blue-500/20 text-blue-400' : 'bg-stone-800 text-stone-400'}`}>
                        {isSilentPhase ? t('metronome.silentSection') : `${t('metronome.soundBars')}...`}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Visual Options */}
        <div className="bg-bg-card border border-white/5 rounded-[32px] overflow-hidden order-5">
          <button 
            onClick={() => setIsVisualsExpanded(!isVisualsExpanded)}
            className="w-full p-6 flex justify-between items-center text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-pink-500/10 text-pink-500 flex items-center justify-center">
                <Eye size={20} />
              </div>
              <span className="font-bold text-white">{t('metronome.focusView')} & Visuals</span>
            </div>
            {isVisualsExpanded ? <ChevronUp size={20} className="text-stone-500" /> : <ChevronDown size={20} className="text-stone-500" />}
          </button>
          <AnimatePresence>
            {isVisualsExpanded && (
              <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                <div className="p-6 pt-0 space-y-4 border-t border-white/5 mt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-white">{t('metronome.focusView')}</span>
                    <button 
                      onClick={() => setSettings(s => ({...s, focusViewEnabled: !s.focusViewEnabled}))}
                      className={`w-12 h-6 rounded-full transition-colors relative ${settings.focusViewEnabled ? 'bg-brand' : 'bg-stone-700'}`}
                    >
                      <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${settings.focusViewEnabled ? 'left-7' : 'left-1'}`} />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-white">{t('metronome.ledDisplay')}</span>
                    <button 
                      onClick={() => setSettings(s => ({...s, ledEnabled: !s.ledEnabled}))}
                      className={`w-12 h-6 rounded-full transition-colors relative ${settings.ledEnabled ? 'bg-brand' : 'bg-stone-700'}`}
                    >
                      <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${settings.ledEnabled ? 'left-7' : 'left-1'}`} />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-white">{t('metronome.screenFlash')}</span>
                    <button 
                      onClick={() => setSettings(s => ({...s, flashEnabled: !s.flashEnabled}))}
                      className={`w-12 h-6 rounded-full transition-colors relative ${settings.flashEnabled ? 'bg-brand' : 'bg-stone-700'}`}
                    >
                      <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${settings.flashEnabled ? 'left-7' : 'left-1'}`} />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-white">{t('metronome.pendulumView')}</span>
                    <button 
                      onClick={() => setSettings(s => ({...s, pendulumEnabled: !s.pendulumEnabled}))}
                      className={`w-12 h-6 rounded-full transition-colors relative ${settings.pendulumEnabled ? 'bg-brand' : 'bg-stone-700'}`}
                    >
                      <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${settings.pendulumEnabled ? 'left-7' : 'left-1'}`} />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Sound Options */}
        <div className="bg-bg-card border border-white/5 rounded-[32px] overflow-hidden order-6">
          <button 
            onClick={() => setIsSoundsExpanded(!isSoundsExpanded)}
            className="w-full p-6 flex justify-between items-center text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-500 flex items-center justify-center">
                <Volume2 size={20} />
              </div>
              <span className="font-bold text-white">{t('metronome.soundType')}</span>
            </div>
            {isSoundsExpanded ? <ChevronUp size={20} className="text-stone-500" /> : <ChevronDown size={20} className="text-stone-500" />}
          </button>
          <AnimatePresence>
            {isSoundsExpanded && (
              <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                <div className="p-6 pt-0 space-y-4 border-t border-white/5 mt-2">
                  <div>
                    <label className="text-[10px] font-bold text-stone-500 uppercase tracking-widest block mb-2">{t('metronome.normalSound')}</label>
                    <select 
                      className="w-full bg-stone-900 border border-white/5 rounded-xl px-3 py-3 text-sm text-white outline-none"
                      value={settings.normalSound || 'classic'}
                      onChange={(e) => setSettings(s => ({...s, normalSound: e.target.value as SoundType}))}
                    >
                      <option value="classic">{t('metronome.classicClick')}</option>
                      <option value="woodblock">{t('metronome.woodBlock')}</option>
                      <option value="digital">{t('metronome.digitalBeep')}</option>
                      <option value="soft">{t('metronome.softTick')}</option>
                      <option value="drum">{t('metronome.drumClick')}</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-stone-500 uppercase tracking-widest block mb-2">{t('metronome.accentSound')}</label>
                    <select 
                      className="w-full bg-stone-900 border border-white/5 rounded-xl px-3 py-3 text-sm text-white outline-none"
                      value={settings.accentSound || 'classic'}
                      onChange={(e) => setSettings(s => ({...s, accentSound: e.target.value as SoundType}))}
                    >
                      <option value="classic">{t('metronome.classicClick')}</option>
                      <option value="woodblock">{t('metronome.woodBlock')}</option>
                      <option value="digital">{t('metronome.digitalBeep')}</option>
                      <option value="soft">{t('metronome.softTick')}</option>
                      <option value="drum">{t('metronome.drumClick')}</option>
                    </select>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </div>
      )}

      </div>

    </motion.div>
  );
}
