'use strict';
var ADVENTURE = require('../js/adventure.js');

function ids(adv) { var m = {}; adv.scenes.forEach(function (s) { m[s.id] = s; }); return m; }

test('adventure has a start scene', function () {
  assert(ids(ADVENTURE)[ADVENTURE.start], 'start scene exists');
  assertEqual(ADVENTURE.start, 'start');
});
test('every referenced sceneId exists (no dead links)', function () {
  var map = ids(ADVENTURE);
  ADVENTURE.scenes.forEach(function (s) {
    (s.choices || []).forEach(function (c) { assert(map[c.goto], s.id + ' -> missing ' + c.goto); });
    if (s.check) { assert(map[s.check.onSuccess], s.id + ' check.onSuccess ' + s.check.onSuccess); assert(map[s.check.onFail], s.id + ' check.onFail ' + s.check.onFail); }
    if (s.combat) { assert(map[s.combat.onWin], s.id + ' combat.onWin'); assert(map[s.combat.onLose], s.id + ' combat.onLose'); }
  });
});
test('every scene has a music mood', function () {
  ADVENTURE.scenes.forEach(function (s) { assert(s.music, 'music for ' + s.id); });
});
test('at least 4 endings exist (light, bitter, clever, defeat)', function () {
  var endings = {};
  ADVENTURE.scenes.forEach(function (s) { if (s.ending) endings[s.ending] = true; });
  ['light', 'bitter', 'clever', 'defeat'].forEach(function (e) { assert(endings[e], 'ending ' + e); });
});
test('every non-terminal scene can progress', function () {
  ADVENTURE.scenes.forEach(function (s) {
    if (s.ending) return;
    assert((s.choices && s.choices.length) || s.check || s.combat, 'scene ' + s.id + ' must progress');
  });
});
