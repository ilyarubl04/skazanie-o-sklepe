#!/usr/bin/env node
'use strict';
/*
  Adaptive background-music generator for «Сказание о Старом Склепе».
  Generates one original instrumental track per mood with Google Lyria 3 Pro
  (via OpenRouter) → assets/audio/music/<mood>.mp3. We own the output; no
  third-party rights. js/audio.js plays these loops and falls back to the
  built-in procedural music if a file is missing.

  Setup: put the OpenRouter key in .openrouter_key (gitignored) or OPENROUTER_API_KEY.

  Usage:
    node tools/generate-music.js                # all moods (skips done)
    VO_FORCE=1 node tools/generate-music.js     # regenerate
    node tools/generate-music.js tavern crypt   # only named moods

  Cost: ~$0.08 per track (Lyria 3 Pro). Six moods ≈ $0.48.
*/

var fs = require('fs');
var os = require('os');
var path = require('path');
var cp = require('child_process');

var ROOT = path.join(__dirname, '..');
var OUT_DIR = path.join(ROOT, 'assets', 'audio', 'music');
var MODEL = process.env.MUSIC_MODEL || 'google/lyria-3-pro-preview';
var FORCE = !!process.env.VO_FORCE;
var BITRATE = process.env.MUSIC_BITRATE || '96k';   // mono background music

var MOODS = {
  menu:    'Instrumental dark-fantasy main theme. Slow, mysterious, cinematic strings and low choir pads, candlelit and foreboding. Seamless ambient loop. Absolutely no vocals, no lyrics.',
  tavern:  'Instrumental medieval tavern music. Warm lute, fiddle and soft hand drum, cozy yet a little mysterious. Seamless background loop. Absolutely no vocals, no singing.',
  forest:  'Instrumental eerie night-forest ambience. Sparse and tense, low strings and distant woodwinds, quiet suspense. Seamless dark loop. Absolutely no vocals.',
  crypt:   'Instrumental dark dungeon ambience for a fantasy game. Slow low drone, soft deep strings, gentle distant echoes, mysterious and tense. Seamless ambient background loop. No vocals, no singing.',
  battle:  'Instrumental fantasy battle music. Driving percussion, urgent low strings and brass stabs, heroic tension. Seamless combat loop. Absolutely no vocals.',
  victory: 'Instrumental triumphant fantasy theme. Warm strings and horns, hopeful and resolved, a gentle celebration. Seamless loop. Absolutely no vocals.'
};

function readKey() {
  if (process.env.OPENROUTER_API_KEY) return process.env.OPENROUTER_API_KEY.trim();
  try { return fs.readFileSync(path.join(ROOT, '.openrouter_key'), 'utf8').trim(); } catch (e) { return ''; }
}
var KEY = readKey();
if (!KEY) { console.error('Нет ключа OpenRouter (.openrouter_key или OPENROUTER_API_KEY).'); process.exit(1); }

fs.mkdirSync(OUT_DIR, { recursive: true });

function generate(mood, prompt) {
  var reqPath = path.join(os.tmpdir(), 'music_req_' + process.pid + '.json');
  var streamPath = path.join(os.tmpdir(), 'music_stream_' + process.pid + '.txt');
  var rawPath = path.join(os.tmpdir(), 'music_raw_' + process.pid + '.audio');
  fs.writeFileSync(reqPath, JSON.stringify({
    model: MODEL, modalities: ['audio', 'text'], audio: { format: 'wav' }, stream: true,
    messages: [{ role: 'user', content: prompt }]
  }));
  try {
    cp.execFileSync('curl', ['-sS', '-N', '-X', 'POST', 'https://openrouter.ai/api/v1/chat/completions',
      '-H', 'Authorization: Bearer ' + KEY, '-H', 'Content-Type: application/json',
      '--data', '@' + reqPath, '--output', streamPath], { stdio: ['ignore', 'ignore', 'inherit'] });

    var b64 = '', cost = null;
    fs.readFileSync(streamPath, 'utf8').split('\n').forEach(function (line) {
      if (line.indexOf('data:') !== 0) return;
      var p = line.slice(5).trim();
      if (!p || p === '[DONE]') return;
      var d; try { d = JSON.parse(p); } catch (e) { return; }
      try {
        var a = d.choices && d.choices[0] && d.choices[0].delta && d.choices[0].delta.audio;
        if (a && a.data) b64 += a.data;
      } catch (e) {}
      if (d.usage && typeof d.usage.cost === 'number') cost = d.usage.cost;
    });
    if (!b64) {
      var head = fs.readFileSync(streamPath, 'utf8').slice(0, 300);
      throw new Error('аудио не пришло: ' + head);
    }
    fs.writeFileSync(rawPath, Buffer.from(b64, 'base64'));
    // re-encode to compact mono mp3 for the web
    var out = path.join(OUT_DIR, mood + '.mp3');
    cp.execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y',
      '-i', rawPath, '-ac', '1', '-b:a', BITRATE, out]);
    return { size: fs.statSync(out).size, cost: cost };
  } finally {
    [reqPath, streamPath, rawPath].forEach(function (f) { try { fs.unlinkSync(f); } catch (e) {} });
  }
}

var want = process.argv.slice(2).filter(function (m) { return MOODS[m]; });
var moods = want.length ? want : Object.keys(MOODS);
console.log('Генерирую музыку (' + MODEL + ') для: ' + moods.join(', '));
var ok = 0, fail = 0, skip = 0, totalCost = 0, totalBytes = 0;
moods.forEach(function (mood) {
  var out = path.join(OUT_DIR, mood + '.mp3');
  if (!FORCE && fs.existsSync(out)) { skip++; console.log('  • пропуск', mood); return; }
  try {
    var r = generate(mood, MOODS[mood]);
    ok++; totalBytes += r.size; if (r.cost) totalCost += r.cost;
    console.log('  ✓', mood, Math.round(r.size / 1024) + 'KB' + (r.cost ? '  ($' + r.cost + ')' : ''));
  } catch (e) { fail++; console.log('  ✗', mood, '—', e.message); }
});
console.log('\nИтог: ' + ok + ' создано, ' + skip + ' пропущено, ' + fail + ' ошибок, ' +
  Math.round(totalBytes / 1024) + 'KB, ~$' + totalCost.toFixed(2) + '.');
if (ok) console.log('Файлы в assets/audio/music/ — js/audio.js будет крутить их как фон.');
