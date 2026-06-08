#!/usr/bin/env node
'use strict';
/*
  Narrator voice-over generator for «Сказание о Старом Склепе».
  Reads each scene's narration from js/adventure.js and calls OpenRouter's
  TTS endpoint to produce assets/audio/vo/<sceneId>.mp3 (baked into the game,
  played offline by js/voice.js). Run ONCE; re-run only to regenerate.

  Setup (key never touches git — see .gitignore):
    echo 'sk-or-…' > .openrouter_key        # or: export OPENROUTER_API_KEY=sk-or-…

  Usage:
    node tools/generate-vo.js --sample       # voice a couple lines in several voices to compare
    node tools/generate-vo.js                # voice every scene (skips ones already done)
    VO_FORCE=1 node tools/generate-vo.js     # regenerate everything
    VO_MODEL=google/gemini-3.1-flash-tts-preview VO_VOICE=<voice> node tools/generate-vo.js

  Pricing: a few cents for the whole game. The script prints a running byte total.
*/

var fs = require('fs');
var os = require('os');
var path = require('path');
var cp = require('child_process');

var ROOT = path.join(__dirname, '..');
var ADV = require(path.join(ROOT, 'js', 'adventure.js'));
var OUT_DIR = path.join(ROOT, 'assets', 'audio', 'vo');

// Gemini TTS returns raw PCM (24kHz/16-bit/mono); we convert to mp3 with ffmpeg.
var MODEL = process.env.VO_MODEL || 'google/gemini-3.1-flash-tts-preview';
var VOICE = process.env.VO_VOICE || 'Charon';      // deep narrator voice
var FORCE = !!process.env.VO_FORCE;

function readKey() {
  if (process.env.OPENROUTER_API_KEY) return process.env.OPENROUTER_API_KEY.trim();
  try { return fs.readFileSync(path.join(ROOT, '.openrouter_key'), 'utf8').trim(); } catch (e) { return ''; }
}
var KEY = readKey();
if (!KEY) {
  console.error('Нет ключа OpenRouter. Положи его в .openrouter_key или экспортируй OPENROUTER_API_KEY.');
  process.exit(1);
}

fs.mkdirSync(OUT_DIR, { recursive: true });

// Auth header goes into a curl config file (-K), so the key is never in the process arg list.
var confPath = path.join(os.tmpdir(), 'vo_curl_' + process.pid + '.conf');
fs.writeFileSync(confPath, 'header = "Authorization: Bearer ' + KEY + '"\nheader = "Content-Type: application/json"\n', { mode: 0o600 });
process.on('exit', function () { try { fs.unlinkSync(confPath); } catch (e) {} });

function synth(model, voice, text, outFile) {
  // Gemini TTS only supports response_format=pcm; convert pcm -> mp3 with ffmpeg.
  var needsPcm = /gemini/i.test(model) || process.env.VO_PCM === '1';
  var fmt = needsPcm ? 'pcm' : 'mp3';
  var rawFile = needsPcm ? outFile.replace(/\.mp3$/, '.pcm') : outFile;

  var payloadPath = path.join(os.tmpdir(), 'vo_payload_' + process.pid + '.json');
  fs.writeFileSync(payloadPath, JSON.stringify({ model: model, input: text, voice: voice, response_format: fmt }));
  try {
    cp.execFileSync('curl', [
      '-sS', '-X', 'POST', 'https://openrouter.ai/api/v1/audio/speech',
      '-K', confPath, '--data', '@' + payloadPath, '--output', rawFile
    ], { stdio: ['ignore', 'ignore', 'inherit'] });
  } finally {
    try { fs.unlinkSync(payloadPath); } catch (e) {}
  }

  var rawSize = fs.existsSync(rawFile) ? fs.statSync(rawFile).size : 0;
  if (rawSize < 1200) {
    var body = '';
    try { body = fs.readFileSync(rawFile, 'utf8').slice(0, 300); } catch (e) {}
    try { fs.unlinkSync(rawFile); } catch (e) {}
    throw new Error('ответ слишком мал (' + rawSize + 'б): ' + body);
  }

  if (needsPcm) {
    // raw PCM: 24kHz, 16-bit signed LE, mono
    cp.execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y',
      '-f', 's16le', '-ar', '24000', '-ac', '1', '-i', rawFile, outFile]);
    try { fs.unlinkSync(rawFile); } catch (e) {}
  }
  return fs.existsSync(outFile) ? fs.statSync(outFile).size : 0;
}

function sceneText(s) {
  // strip the guillemet flavor markers so the narrator doesn't read « »
  return (s.text || []).join('\n\n').replace(/[«»]/g, '').trim();
}

var totalBytes = 0, ok = 0, fail = 0, skip = 0;

if (process.argv.indexOf('--sample') !== -1) {
  var sampleScene = ADV.scenes.filter(function (s) { return s.id === 'start'; })[0] || ADV.scenes[0];
  var text = sceneText(sampleScene);
  var trials = [
    { model: 'openai/gpt-4o-mini-tts', voice: 'onyx' },
    { model: 'openai/gpt-4o-mini-tts', voice: 'fable' },
    { model: 'google/gemini-3.1-flash-tts-preview', voice: process.env.VO_VOICE || 'Charon' }
  ];
  console.log('Сэмплы вступления (для сравнения голосов):');
  trials.forEach(function (t) {
    var name = (t.model.split('/')[1]) + '__' + t.voice;
    var out = path.join(OUT_DIR, '_sample__' + name + '.mp3');
    try { var sz = synth(t.model, t.voice, text, out); totalBytes += sz; ok++; console.log('  ✓', name, Math.round(sz / 1024) + 'KB'); }
    catch (e) { fail++; console.log('  ✗', name, '—', e.message); }
  });
  console.log('Готово. Послушай файлы assets/audio/vo/_sample__*.mp3 и выбери модель/голос.');
  console.log('Затем: VO_MODEL=<model> VO_VOICE=<voice> node tools/generate-vo.js');
} else {
  var scenes = ADV.scenes.filter(function (s) { return s.text && s.text.length; });
  console.log('Озвучиваю ' + scenes.length + ' сцен моделью ' + MODEL + ' голосом ' + VOICE + '…');
  scenes.forEach(function (s) {
    var out = path.join(OUT_DIR, s.id + '.mp3');
    if (!FORCE && fs.existsSync(out)) { skip++; console.log('  • пропуск', s.id); return; }
    try { var sz = synth(MODEL, VOICE, sceneText(s), out); totalBytes += sz; ok++; console.log('  ✓', s.id, Math.round(sz / 1024) + 'KB'); }
    catch (e) { fail++; console.log('  ✗', s.id, '—', e.message); }
  });
  console.log('\nИтог: ' + ok + ' озвучено, ' + skip + ' пропущено, ' + fail + ' ошибок, ' +
    Math.round(totalBytes / 1024) + 'KB аудио.');
  if (ok) console.log('Файлы в assets/audio/vo/ — игра подхватит их автоматически (кнопка 🎙️).');
}
