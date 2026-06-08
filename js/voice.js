(function (root) {
  'use strict';
  root.DnD = root.DnD || {};

  // Narrator voice-over. Plays a pre-generated mp3 per scene from assets/audio/vo/<sceneId>.mp3.
  // Files are produced offline by tools/generate-vo.js (OpenRouter TTS). If a file is absent,
  // every call is a graceful no-op, so the game works with or without voice-over.
  var voice = {};
  var KEY = 'skazanie_voice_on';
  var DIR = 'assets/audio/vo/';

  voice.on = true;          // default on; overridden from storage in init()
  voice._el = null;
  voice._unlocked = false;

  function el() {
    if (!voice._el && typeof document !== 'undefined') voice._el = document.getElementById('vo');
    return voice._el;
  }
  // lower the background music while the narrator speaks, restore when done
  function duck(on) {
    var au = root.DnD && root.DnD.audio;
    if (au && au.duck) au.duck(on);
  }

  voice.init = function () {
    if (typeof localStorage !== 'undefined') {
      var saved = localStorage.getItem(KEY);
      if (saved !== null) voice.on = saved === '1';
    }
    return voice.on;
  };

  // call on a user gesture so Safari/iOS will allow later programmatic play()
  voice.unlock = function () {
    var a = el();
    if (!a || voice._unlocked) return;
    voice._unlocked = true;
    // a tiny silent nudge; ignored if it fails
    try { a.muted = true; a.play().then(function () { a.pause(); a.muted = false; a.currentTime = 0; }).catch(function () { a.muted = false; }); }
    catch (e) { a.muted = false; }
  };

  voice.stop = function () {
    var a = el();
    if (!a) return;
    try { a.pause(); a.currentTime = 0; } catch (e) {}
  };

  // Play the narration for a scene. No-op if voice is off or the file is missing.
  voice.playScene = function (sceneId) {
    var a = el();
    if (!a || !voice.on || !sceneId) return;
    voice.stop();
    a.src = DIR + sceneId + '.mp3';
    a.onerror = function () { duck(false); /* no voice file — restore music */ };
    a.onended = function () { duck(false); /* narration finished — restore music */ };
    var p = a.play();
    if (p && p.catch) p.catch(function () { duck(false); /* autoplay blocked until a gesture */ });
    duck(true); // narrator speaking → lower the background music
  };

  voice.toggle = function () {
    voice.on = !voice.on;
    if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, voice.on ? '1' : '0');
    if (!voice.on) { voice.stop(); duck(false); }
    return voice.on;
  };

  root.DnD.voice = voice;
  if (typeof module !== 'undefined' && module.exports) module.exports = voice;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
