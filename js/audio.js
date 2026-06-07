(function (root) {
  'use strict';
  root.DnD = root.DnD || {};
  var audio = {
    musicOn: true, soundOn: true,
    _ctx: null, _unlocked: false,
    _current: null,        // currently playing mood
    _musicGain: null,      // master gain for procedural music
    _voices: [],           // active scheduler handles (setInterval ids)
    _fade: null            // active gain-fade interval id
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
    // if a mood was requested before unlock, (re)start it now that the context is live
    if (audio.musicOn && audio._current && audio._voices.length === 0) {
      var mood = audio._current; audio._current = null; audio.playMusic(mood);
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

  // cross-fade: fade music bus down, swap voices, fade back up
  audio.playMusic = function (mood) {
    if (!MOODS[mood]) return;
    if (audio._current === mood && audio._voices.length) return;
    audio._current = mood;
    if (!audio.musicOn) { stopVoices(); return; }

    var c = ctx(); if (!c) return;        // context not ready yet; unlock() will retry
    var bus = musicGain(); if (!bus) return;

    if (audio._fade) { clearInterval(audio._fade); audio._fade = null; }
    var target = 0.6;

    var swap = function () {
      stopVoices();
      startMood(mood);
      var v = 0;
      audio._fade = setInterval(function () {
        v += 0.05;
        try { bus.gain.value = Math.min(target, v); } catch (e) {}
        if (v >= target) { clearInterval(audio._fade); audio._fade = null; }
      }, 70);
    };

    if (audio._voices.length) {
      // fade current mood out, then swap
      var down = bus.gain.value;
      audio._fade = setInterval(function () {
        down -= 0.08;
        try { bus.gain.value = Math.max(0, down); } catch (e) {}
        if (down <= 0) { clearInterval(audio._fade); audio._fade = null; swap(); }
      }, 50);
    } else {
      try { bus.gain.value = 0; } catch (e) {}
      swap();
    }
  };

  audio.toggleMusic = function () {
    audio.musicOn = !audio.musicOn;
    if (!audio.musicOn) {
      stopVoices();
      if (audio._fade) { clearInterval(audio._fade); audio._fade = null; }
      var bus = audio._musicGain; if (bus) { try { bus.gain.value = 0; } catch (e) {} }
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
  audio.sfx = {
    dice: function () { noise(0.25, 0.3); setTimeout(function(){tone(180,0.08,'square',0.15);}, 120); },
    // short woody clack — quick noise burst + low tone, for each wall bounce
    diceBounce: function () { thunk(150, 0.06, 0.14, 0.12); },
    // heavier thunk when the die finally settles on the table
    diceLand: function () { thunk(85, 0.18, 0.3, 0.22); setTimeout(function(){ tone(60, 0.12, 'sine', 0.18); }, 30); },
    hit:  function () { tone(90, 0.18, 'sawtooth', 0.3); noise(0.12, 0.2); },
    miss: function () { tone(220, 0.12, 'sine', 0.12); },
    heal: function () { tone(523, 0.18, 'sine', 0.2); setTimeout(function(){tone(784,0.22,'sine',0.18);},90); },
    click:function () { tone(330, 0.05, 'triangle', 0.12); },
    win:  function () { [523,659,784,1046].forEach(function(f,i){setTimeout(function(){tone(f,0.25,'sine',0.2);},i*140);}); }
  };

  root.DnD.audio = audio;
})(typeof window !== 'undefined' ? window : global);
