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

// ---- finale: all 7 endings exist and pickEnding is a TOTAL deterministic router ----
test('all 7 ending scenes exist and are routable', function () {
  var map = ids(ADVENTURE);
  ['ending_dawn', 'ending_light', 'ending_clever', 'ending_bitter',
   'ending_yoren', 'ending_silence', 'defeat_scene'].forEach(function (e) {
    assert(map[e], 'ending scene ' + e + ' exists');
    assert(map[e].ending, e + ' is flagged as an ending');
  });
});
test('serdce node wires into Act 5 and the finale fight routes to finale_resolve', function () {
  var map = ids(ADVENTURE);
  assert(map.abyss_descent, 'Act 5 entry scene exists');
  assertEqual(map.abyss_descent.levelUp, 4, 'level-up #4 fires entering Act 5');
  assert(map.serdce_fight.combat.enemies.some(function (e) { return e.type === 'shepherd'; }), 'final fight is the shepherd');
  assertEqual(map.serdce_fight.combat.onWin, 'finale_resolve', 'win routes to the finale router');
  assertEqual(map.serdce_fight.combat.onLose, 'defeat_scene', 'loss routes to defeat');
});
test('pickEnding is total: every probed flag-state lands on a real ending scene', function () {
  var map = ids(ADVENTURE);
  function partyWith(flags) { var p = state.createParty(['kael', 'mira']); p.flags = flags || {}; return p; }
  // exhaustively sweep the decisive flags and assert each result is a defined ending scene
  var bools = [false, true];
  var count = 0;
  bools.forEach(function (f1) { bools.forEach(function (f2) { bools.forEach(function (f3) {
    bools.forEach(function (relic) { bools.forEach(function (ritual) {
      bools.forEach(function (yA) { bools.forEach(function (yD) { bools.forEach(function (maya) {
        var p = partyWith({ tuningFork1: f1, tuningFork2: f2, tuningFork3: f3,
          hasRelic: relic, knowsRitual: ritual, yorenAlive: yA, yorenDead: yD, mayaSaved: maya });
        var e = ADVENTURE.pickEnding(p);
        assert(map[e] && map[e].ending, 'pickEnding -> real ending for state #' + count + ' (' + e + ')');
        count++;
      }); }); });
    }); });
  }); }); });
});
test('pickEnding hits each finale ending for some flag-state (all reachable)', function () {
  function p(flags) { var pp = state.createParty(['kael', 'mira']); pp.flags = flags; return pp; }
  // 1) dawn — full set + ritual + Йорен жив + уговор Майи
  assertEqual(ADVENTURE.pickEnding(p({ tuningFork1: 1, tuningFork2: 1, tuningFork3: 1, hasRelic: 1, knowsRitual: 1, yorenAlive: 1, mayaSaved: 1 })), 'ending_dawn');
  // 6) silence — почти пусто (0 камертонов, без Светоча)
  assertEqual(ADVENTURE.pickEnding(p({})), 'ending_silence');
  assertEqual(ADVENTURE.pickEnding(p({ tuningFork1: 1 })), 'ending_silence');
  // 5) yoren — Йорен погиб
  assertEqual(ADVENTURE.pickEnding(p({ tuningFork1: 1, tuningFork2: 1, hasRelic: 1, yorenDead: 1 })), 'ending_yoren');
  // 2) light — Светоч + ритуал, Майя спасена
  assertEqual(ADVENTURE.pickEnding(p({ tuningFork1: 1, tuningFork2: 1, hasRelic: 1, knowsRitual: 1, mayaSaved: 1 })), 'ending_light');
  // 3) clever — достучались словом (без Светоча/ритуала)
  assertEqual(ADVENTURE.pickEnding(p({ tuningFork1: 1, tuningFork2: 1, mayaSaved: 1 })), 'ending_clever');
  // 4) bitter — сила без перенастройки (камертоны, но ни Светоча, ни ритуала, ни уговора)
  assertEqual(ADVENTURE.pickEnding(p({ tuningFork1: 1, tuningFork2: 1, tuningFork3: 1 })), 'ending_bitter');
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
