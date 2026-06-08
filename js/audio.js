(function (root) {
  'use strict';
  root.DnD = root.DnD || {};
  var audio = {
    musicOn: true, soundOn: true,
    _ctx: null, _unlocked: false,
    _current: null,        // currently playing mood
    _mode: null,           // 'file' (Lyria mp3) | 'proc' (procedural) | null
    _musicGain: null,      // master gain for procedural music
    _voices: [],           // active scheduler handles (setInterval ids)
    _fade: null,           // active procedural gain-fade interval id
    _fileFade: null,       // active <audio> volume-fade interval id
    _ducked: false         // true while the narrator speaks (music lowered)
  };

  function ctx() {
    if (!audio._ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      audio._ctx = new AC();
    }
    return audio._ctx;
  }

  // master gain node that all procedural music routes through (separate from SFX)
  function musicGain() {
    var c = ctx(); if (!c) return null;
    if (!audio._musicGain) {
      audio._musicGain = c.createGain();
      audio._musicGain.gain.value = 0;
      audio._musicGain.connect(c.destination);
    }
    return audio._musicGain;
  }

  audio.unlock = function () {
    var c = ctx(); if (!c) return;
    try { if (c.state === 'suspended') c.resume(); } catch (e) {}
    if (!audio._unlocked) {
      try {
        var b = c.createBuffer(1, 1, 22050); var s = c.createBufferSource();
        s.buffer = b; s.connect(c.destination); s.start(0); audio._unlocked = true;
      } catch (e) {}
    }
    // if a mood was requested before unlock, (re)start it now that audio is allowed
    if (audio.musicOn && audio._current && !audio._mode) {
      var mood = audio._current; audio._current = null; audio.playMusic(mood);
    }
    // a file track whose play() was blocked before the first gesture: resume it
    var el = (typeof document !== 'undefined') ? document.getElementById('music') : null;
    if (el && audio._mode === 'file' && el.paused && audio.musicOn) {
      var pr = el.play(); if (pr && pr.catch) pr.catch(function () {});
    }
  };

  // ------------------------------------------------------------------
  // Procedural adaptive music: each mood is a soft drone + slow arpeggio.
  // Note frequencies (equal temperament).
  // ------------------------------------------------------------------
  var NOTE = {
    C2: 65.41, D2: 73.42, E2: 82.41, G2: 98.00,
    C3: 130.81, Eb3: 155.56, E3: 164.81, F3: 174.61, G3: 196.00, A3: 220.00, B3: 246.94,
    C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.00, A4: 440.00, B4: 493.88,
    C5: 523.25, Db4: 277.18
  };

  // mood -> { drone:[freqs], arp:[freqs], step:ms, noteDur:s, gain, droneGain, wave }
  var MOODS = {
    menu: {
      drone: [NOTE.D2], arp: [NOTE.D3 || 146.83, NOTE.A3, NOTE.F4, NOTE.D4],
      step: 2600, noteDur: 3.4, gain: 0.10, droneGain: 0.06, wave: 'sine'
    },
    tavern: {
      drone: [NOTE.G2], arp: [NOTE.G3, NOTE.B3, NOTE.D4, NOTE.G4],
      step: 2000, noteDur: 2.6, gain: 0.11, droneGain: 0.06, wave: 'triangle'
    },
    forest: {
      drone: [NOTE.A3 / 2], arp: [NOTE.A3, NOTE.C4, NOTE.E4, NOTE.F4 /* min-2nd tension */],
      step: 3000, noteDur: 2.8, gain: 0.07, droneGain: 0.05, wave: 'sine', sparse: true
    },
    crypt: {
      drone: [NOTE.C2, NOTE.Eb3, NOTE.G3], arp: [NOTE.C3, NOTE.Eb3],
      step: 4200, noteDur: 4.4, gain: 0.06, droneGain: 0.07, wave: 'sine', sparse: true
    },
    battle: {
      drone: [NOTE.E2], arp: [NOTE.E3, NOTE.G3, NOTE.B3, NOTE.E4],
      step: 1100, noteDur: 1.2, gain: 0.10, droneGain: 0.07, wave: 'triangle', pulse: true
    },
    victory: {
      drone: [NOTE.C3], arp: [NOTE.C4, NOTE.E4, NOTE.G4, NOTE.C5],
      step: 1500, noteDur: 2.0, gain: 0.12, droneGain: 0.06, wave: 'triangle'
    }
  };
  // D3 fallback (not in NOTE map above as a clean key)
  NOTE.D3 = 146.83;
  MOODS.menu.arp[0] = NOTE.D3;

  function softNote(freq, dur, wave, gain) {
    var c = ctx(); if (!c) return;
    var bus = musicGain(); if (!bus) return;
    var o = c.createOscillator();
    var g = c.createGain();
    o.type = wave || 'sine';
    o.frequency.value = freq;
    var t = c.currentTime;
    // gentle attack + long release so notes never click or sound harsh
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), t + Math.min(0.6, dur * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus);
    o.start(t); o.stop(t + dur + 0.05);
  }

  function startMood(mood) {
    var m = MOODS[mood]; if (!m) return;
    var c = ctx(); if (!c) return;
    // sustained drone(s): re-trigger each note ~3x its duration so it loops seamlessly
    m.drone.forEach(function (df) {
      var droneTick = function () { softNote(df, m.noteDur * 3, m.wave, m.droneGain); };
      droneTick();
      audio._voices.push(setInterval(droneTick, m.noteDur * 3 * 1000 - 200));
    });
    // slow arpeggio walks through the note set, looping indefinitely
    var idx = 0;
    var arpTick = function () {
      if (!audio.musicOn) return;
      // sparse moods occasionally skip a beat for breathing room
      if (m.sparse && Math.random() < 0.35) { idx = (idx + 1) % m.arp.length; return; }
      softNote(m.arp[idx % m.arp.length], m.noteDur, m.wave, m.gain);
      // battle pulse: add a low driving note under the arpeggio
      if (m.pulse) softNote(m.drone[0], m.step / 1000 * 0.9, m.wave, m.droneGain * 0.9);
      idx++;
    };
    arpTick();
    audio._voices.push(setInterval(arpTick, m.step));
  }

  function stopVoices() {
    audio._voices.forEach(function (id) { clearInterval(id); });
    audio._voices = [];
  }

  // ---- file-based adaptive music (original Lyria tracks) with procedural fallback ----
  var MUSIC_BASE = 'assets/audio/music/';
  var FILE_VOL = 0.55;
  var PROC_VOL = 0.6;
  var DUCK = 0.72;   // music drops to ~72% (≈28% quieter) while the narrator speaks
  function musicEl() { return (typeof document !== 'undefined') ? document.getElementById('music') : null; }
  function fileTarget() { return FILE_VOL * (audio._ducked ? DUCK : 1); }

  function fadeEl(el, target, step, onDone) {
    if (audio._fileFade) { clearInterval(audio._fileFade); audio._fileFade = null; }
    step = step || 0.05;
    audio._fileFade = setInterval(function () {
      var cur = el.volume;
      var v = cur < target ? cur + step : cur - step;
      if (Math.abs(v - target) <= step) { v = target; clearInterval(audio._fileFade); audio._fileFade = null; }
      try { el.volume = Math.max(0, Math.min(1, v)); } catch (e) {}
      if (v === target && onDone) onDone();
    }, 60);
  }
  function muteBus() {
    if (audio._fade) { clearInterval(audio._fade); audio._fade = null; }
    var b = audio._musicGain; if (b) { try { b.gain.value = 0; } catch (e) {} }
  }
  function stopAllMusic() {
    stopVoices(); muteBus();
    if (audio._fileFade) { clearInterval(audio._fileFade); audio._fileFade = null; }
    var el = musicEl(); if (el) { try { el.pause(); } catch (e) {} }
    audio._mode = null;
  }

  // procedural fallback (used only if a mood's mp3 is missing)
  function startProcedural(mood) {
    if (!MOODS[mood]) { audio._mode = null; return; }
    var c = ctx(); if (!c) return;        // context not ready; unlock() will retry
    var bus = musicGain(); if (!bus) return;
    audio._mode = 'proc';
    stopVoices(); startMood(mood);
    if (audio._fade) { clearInterval(audio._fade); audio._fade = null; }
    var v = 0, target = PROC_VOL * (audio._ducked ? DUCK : 1);
    try { bus.gain.value = 0; } catch (e) {}
    audio._fade = setInterval(function () {
      v += 0.05; try { bus.gain.value = Math.min(target, v); } catch (e) {}
      if (v >= target) { clearInterval(audio._fade); audio._fade = null; }
    }, 70);
  }

  // duck background music while the narrator speaks (called by js/voice.js)
  audio.duck = function (on) {
    audio._ducked = !!on;
    if (audio._mode === 'file') {
      var el = musicEl(); if (el) fadeEl(el, fileTarget(), 0.05);
    } else if (audio._mode === 'proc') {
      var bus = audio._musicGain;
      if (bus) { try { bus.gain.value = PROC_VOL * (audio._ducked ? DUCK : 1); } catch (e) {} }
    }
  };

  audio.playMusic = function (mood) {
    if (audio._current === mood && audio._mode) return;   // already on this mood
    audio._current = mood;
    if (!audio.musicOn) { stopAllMusic(); return; }

    var el = musicEl();
    if (!el) { startProcedural(mood); return; }

    var src = MUSIC_BASE + mood + '.mp3';
    el.loop = true;
    el.onerror = function () { el.onerror = null; el.onplaying = null; startProcedural(mood); };
    el.onplaying = function () { el.onplaying = null; audio._mode = 'file'; stopVoices(); muteBus(); fadeEl(el, fileTarget()); };

    var doSwitch = function () {
      try { el.pause(); el.currentTime = 0; } catch (e) {}
      el.src = src; el.volume = 0;
      var p = el.play();
      if (p && p.catch) p.catch(function () { /* blocked until a gesture; unlock() resumes */ });
    };
    // quick fade-out of a currently-playing file track, then switch; else just switch
    if (audio._mode === 'file' && !el.paused) { fadeEl(el, 0, 0.08, doSwitch); }
    else { muteBus(); doSwitch(); }
  };

  audio.toggleMusic = function () {
    audio.musicOn = !audio.musicOn;
    if (!audio.musicOn) {
      stopAllMusic();
    } else if (audio._current) {
      var mood = audio._current; audio._current = null; audio.playMusic(mood);
    }
    return audio.musicOn;
  };
  audio.toggleSound = function () { audio.soundOn = !audio.soundOn; return audio.soundOn; };

  // ----- procedural SFX (no files) -----
  function tone(freq, dur, type, gain) {
    if (!audio.soundOn) return;
    var c = ctx(); if (!c) return;
    var o = c.createOscillator(); var g = c.createGain();
    o.type = type || 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(gain || 0.2, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime + dur);
  }
  function noise(dur, gain) {
    if (!audio.soundOn) return;
    var c = ctx(); if (!c) return;
    var n = Math.floor(c.sampleRate * dur);
    var buf = c.createBuffer(1, n, c.sampleRate); var d = buf.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    var s = c.createBufferSource(); s.buffer = buf; var g = c.createGain();
    g.gain.value = gain || 0.25; s.connect(g); g.connect(c.destination); s.start();
  }
  // softer, lower-pitched noise burst used for woody dice clacks
  function thunk(freq, dur, gain, noiseGain) {
    if (!audio.soundOn) return;
    tone(freq, dur, 'sine', gain);
    noise(Math.min(dur, 0.06), noiseGain);
  }
  // filtered noise burst (band/low-passed) for whooshes and rattles
  function filteredNoise(dur, gain, type, freq, sweepTo) {
    if (!audio.soundOn) return;
    var c = ctx(); if (!c) return;
    var n = Math.floor(c.sampleRate * dur);
    var buf = c.createBuffer(1, n, c.sampleRate); var d = buf.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    var s = c.createBufferSource(); s.buffer = buf;
    var f = c.createBiquadFilter(); f.type = type || 'lowpass';
    var t = c.currentTime;
    f.frequency.setValueAtTime(freq || 1000, t);
    if (typeof sweepTo === 'number') f.frequency.exponentialRampToValueAtTime(Math.max(60, sweepTo), t + dur);
    var g = c.createGain(); g.gain.value = gain || 0.2;
    s.connect(f); f.connect(g); g.connect(c.destination); s.start();
  }
  audio.sfx = {
    dice: function () { noise(0.25, 0.3); setTimeout(function(){tone(180,0.08,'square',0.15);}, 120); },
    // a single wooden knock: short resonant body + a dry click, pitch varied for realism
    woodKnock: function (intensity) {
      if (!audio.soundOn) return;
      var c = ctx(); if (!c) return;
      var g = intensity || 0.5;
      var f0 = 150 + Math.random() * 110;            // body resonance, slightly random
      // resonant wooden body (two quick decaying partials)
      tone(f0, 0.055 + g * 0.05, 'sine', 0.14 * g);
      tone(f0 * 1.5, 0.04, 'triangle', 0.07 * g);
      // dry surface click (band-passed noise) — the "tap" on the board
      filteredNoise(0.035, 0.16 * g, 'bandpass', 1800 + Math.random() * 1400);
    },
    // each board/edge contact while the die tumbles
    diceBounce: function () { audio.sfx.woodKnock(0.55); },
    // the final, heavier knock as the die settles on the board
    diceLand: function () {
      audio.sfx.woodKnock(1.0);
      setTimeout(function () { tone(70, 0.16, 'sine', 0.2); filteredNoise(0.05, 0.12, 'lowpass', 600); }, 18);
    },
    hit:  function () { tone(90, 0.18, 'sawtooth', 0.3); noise(0.12, 0.2); },
    miss: function () { tone(220, 0.12, 'sine', 0.12); },
    heal: function () { tone(523, 0.18, 'sine', 0.2); setTimeout(function(){tone(784,0.22,'sine',0.18);},90); },
    click:function () { tone(330, 0.05, 'triangle', 0.12); },
    win:  function () { [523,659,784,1046].forEach(function(f,i){setTimeout(function(){tone(f,0.25,'sine',0.2);},i*140);}); },
    // metallic sword clash — bright high-pass noise + ringing high tone
    sword: function () {
      filteredNoise(0.14, 0.22, 'highpass', 2200);
      tone(1400, 0.10, 'square', 0.10);
      setTimeout(function(){ tone(2100, 0.12, 'triangle', 0.07); }, 20);
    },
    // fire whoosh — descending low-pass filtered noise
    fire: function () { filteredNoise(0.45, 0.26, 'lowpass', 1800, 200); },
    // bow twang — quick pitch-dropping pluck
    bow: function () {
      if (!audio.soundOn) return;
      var c = ctx(); if (!c) return;
      var o = c.createOscillator(); var g = c.createGain();
      o.type = 'triangle';
      var t = c.currentTime;
      o.frequency.setValueAtTime(620, t);
      o.frequency.exponentialRampToValueAtTime(180, t + 0.18);
      g.gain.setValueAtTime(0.22, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + 0.24);
    },
    // dry bone rattle — a few short band-passed noise ticks
    bones: function () {
      [0, 55, 105, 150].forEach(function (ms) {
        setTimeout(function(){ filteredNoise(0.05, 0.16, 'bandpass', 2600); }, ms);
      });
    }
  };

  root.DnD.audio = audio;
})(typeof window !== 'undefined' ? window : global);
