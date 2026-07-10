import re

with open('src/components/Metronome.tsx', 'r') as f:
    content = f.read()

target = """    const isAccent = beatState === 'accent';
    const type = isAccent ? (settingsRef.current.accentSound || 'classic') : (settingsRef.current.normalSound || 'classic');
    const volume = Math.min(Math.max(settingsRef.current.volume || 0.5, 0.05), 0.75);
    const peak = isAccent ? Math.min(volume * 0.48, 0.36) : Math.min(volume * 0.32, 0.24);

    if (type === 'classic') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(isAccent ? 1050 : 760, time);
      gainNode.gain.setValueAtTime(0.0001, time);
      gainNode.gain.exponentialRampToValueAtTime(peak, time + 0.008);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, time + 0.10);
      osc.connect(gainNode);
      gainNode.connect(masterGainNode);
      osc.start(time);
      osc.stop(time + 0.13);
    } else if (type === 'digital') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(isAccent ? 1200 : 800, time);
      gainNode.gain.setValueAtTime(0.0001, time);
      gainNode.gain.exponentialRampToValueAtTime(peak * 0.8, time + 0.005);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, time + 0.08);
      osc.connect(gainNode);
      gainNode.connect(masterGainNode);
      osc.start(time);
      osc.stop(time + 0.1);
    } else if (type === 'woodblock') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(isAccent ? 1200 : 800, time);
      osc.frequency.exponentialRampToValueAtTime(isAccent ? 800 : 400, time + 0.05);
      gainNode.gain.setValueAtTime(0.0001, time);
      gainNode.gain.exponentialRampToValueAtTime(peak * 0.9, time + 0.005);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, time + 0.06);
      osc.connect(gainNode);
      gainNode.connect(masterGainNode);
      osc.start(time);
      osc.stop(time + 0.07);
    } else if (type === 'soft') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(isAccent ? 600 : 400, time);
      gainNode.gain.setValueAtTime(0.0001, time);
      gainNode.gain.linearRampToValueAtTime(peak * 0.6, time + 0.015);
      gainNode.gain.linearRampToValueAtTime(0.0001, time + 0.08);
      osc.connect(gainNode);
      gainNode.connect(masterGainNode);
      osc.start(time);
      osc.stop(time + 0.1);
    } else if (type === 'drum') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(isAccent ? 250 : 180, time);
      osc.frequency.exponentialRampToValueAtTime(40, time + 0.08);
      gainNode.gain.setValueAtTime(0.0001, time);
      gainNode.gain.exponentialRampToValueAtTime(peak * 1.2, time + 0.005);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, time + 0.1);
      osc.connect(gainNode);
      gainNode.connect(masterGainNode);
      osc.start(time);
      osc.stop(time + 0.12);
    }"""

replacement = """    const isAccent = beatState === 'accent';
    const isSecondary = beatState === 'secondary';
    const type = isAccent ? (settingsRef.current.accentSound || 'classic') : (settingsRef.current.normalSound || 'classic');
    const volume = Math.min(Math.max(settingsRef.current.volume || 0.5, 0.05), 0.75);
    const peak = isAccent ? Math.min(volume * 0.48, 0.36) : (isSecondary ? Math.min(volume * 0.4, 0.3) : Math.min(volume * 0.32, 0.24));

    if (type === 'classic') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(isAccent ? 1050 : (isSecondary ? 880 : 760), time);
      gainNode.gain.setValueAtTime(0.0001, time);
      gainNode.gain.exponentialRampToValueAtTime(peak, time + 0.008);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, time + 0.10);
      osc.connect(gainNode);
      gainNode.connect(masterGainNode);
      osc.start(time);
      osc.stop(time + 0.13);
    } else if (type === 'digital') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(isAccent ? 1200 : (isSecondary ? 1000 : 800), time);
      gainNode.gain.setValueAtTime(0.0001, time);
      gainNode.gain.exponentialRampToValueAtTime(peak * 0.8, time + 0.005);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, time + 0.08);
      osc.connect(gainNode);
      gainNode.connect(masterGainNode);
      osc.start(time);
      osc.stop(time + 0.1);
    } else if (type === 'woodblock') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(isAccent ? 1200 : (isSecondary ? 950 : 800), time);
      osc.frequency.exponentialRampToValueAtTime(isAccent ? 800 : (isSecondary ? 550 : 400), time + 0.05);
      gainNode.gain.setValueAtTime(0.0001, time);
      gainNode.gain.exponentialRampToValueAtTime(peak * 0.9, time + 0.005);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, time + 0.06);
      osc.connect(gainNode);
      gainNode.connect(masterGainNode);
      osc.start(time);
      osc.stop(time + 0.07);
    } else if (type === 'soft') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(isAccent ? 600 : (isSecondary ? 480 : 400), time);
      gainNode.gain.setValueAtTime(0.0001, time);
      gainNode.gain.linearRampToValueAtTime(peak * 0.6, time + 0.015);
      gainNode.gain.linearRampToValueAtTime(0.0001, time + 0.08);
      osc.connect(gainNode);
      gainNode.connect(masterGainNode);
      osc.start(time);
      osc.stop(time + 0.1);
    } else if (type === 'drum') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(isAccent ? 250 : (isSecondary ? 210 : 180), time);
      osc.frequency.exponentialRampToValueAtTime(40, time + 0.08);
      gainNode.gain.setValueAtTime(0.0001, time);
      gainNode.gain.exponentialRampToValueAtTime(peak * 1.2, time + 0.005);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, time + 0.1);
      osc.connect(gainNode);
      gainNode.connect(masterGainNode);
      osc.start(time);
      osc.stop(time + 0.12);
    }"""

content = content.replace(target, replacement)

with open('src/components/Metronome.tsx', 'w') as f:
    f.write(content)
