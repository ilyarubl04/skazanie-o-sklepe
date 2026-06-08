'use strict';
require('../js/heroes.js'); require('../js/bestiary.js');
require('../js/state.js');
var ADVENTURE = require('../js/adventure.js');
require('../js/ui.js');
var ui = (typeof window !== 'undefined' ? window : global).DnD.ui;
var state = require('../js/state.js');

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

// ---- hero/ability-gated choices show only for matching parties (and never strand a scene) ----
test('hero- and ability-gated choices respect party composition', function () {
  var withMira = state.createParty(['mira', 'brand']); // has turn_undead + no thea/kael
  var withThea = state.createParty(['thea', 'lira']);
  var withKael = state.createParty(['kael', 'finn']);
  var miraChoice = { requires: { ability: 'turn_undead' } };
  var theaChoice = { requires: { hero: 'thea' } };
  var kaelChoice = { requires: { hero: 'kael' } };
  assertEqual(ui.choiceVisible(miraChoice, withMira), true);
  assertEqual(ui.choiceVisible(miraChoice, withThea), false);
  assertEqual(ui.choiceVisible(theaChoice, withThea), true);
  assertEqual(ui.choiceVisible(theaChoice, withMira), false);
  assertEqual(ui.choiceVisible(kaelChoice, withKael), true);
  assertEqual(ui.choiceVisible(kaelChoice, withThea), false);
});

test('flag-gated choices still work and ungated choices are always visible', function () {
  var p = state.createParty(['brand', 'lira']);
  assertEqual(ui.choiceVisible({ requires: { flag: 'hasRelic' } }, p), false);
  state.setFlag(p, 'hasRelic', true);
  assertEqual(ui.choiceVisible({ requires: { flag: 'hasRelic' } }, p), true);
  assertEqual(ui.choiceVisible({ label: 'plain' }, p), true);
});

test('no scene is left with zero available options for any 2-hero party', function () {
  // any party that could reach a choice scene; test a few representative comps
  var parties = [
    state.createParty(['brand', 'lira']),  // no gated heroes/abilities
    state.createParty(['mira', 'thea']),
    state.createParty(['kael', 'finn'])
  ];
  ADVENTURE.scenes.forEach(function (s) {
    if (!s.choices) return; // checks/combats/endings progress on their own
    parties.forEach(function (p) {
      var available = s.choices.filter(function (c) { return ui.choiceVisible(c, p); });
      assert(available.length > 0, s.id + ' has no available choice for a party');
    });
  });
});
