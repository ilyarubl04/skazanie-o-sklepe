'use strict';
require('../js/heroes.js');
var state = require('../js/state.js');

test('createParty builds runtime heroes from two ids', function () {
  var p = state.createParty(['brand', 'lira']);
  assertEqual(p.heroes.length, 2);
  assertEqual(p.heroes[0].id, 'brand');
  assertEqual(p.heroes[0].hp, p.heroes[0].maxHp);
  assertEqual(p.activePlayer, 0);
  assertEqual(p.sceneId, 'start');
});
test('ability use counters initialise from definitions', function () {
  var p = state.createParty(['brand', 'lira']);
  assertEqual(p.heroes[0].abilityUses.power_strike, 2);
  assertEqual(p.heroes[1].abilityUses.fireball, 3);
});
test('damageHero reduces hp and never below 0; marks downed', function () {
  var p = state.createParty(['brand', 'lira']);
  state.damageHero(p.heroes[1], 999);
  assertEqual(p.heroes[1].hp, 0);
  assertEqual(p.heroes[1].downed, true);
});
test('healHero restores hp capped at maxHp and clears downed', function () {
  var p = state.createParty(['brand', 'lira']);
  state.damageHero(p.heroes[0], 10);
  state.healHero(p.heroes[0], 999);
  assertEqual(p.heroes[0].hp, p.heroes[0].maxHp);
  assertEqual(p.heroes[0].downed, false);
});
test('flags helpers set and read', function () {
  var p = state.createParty(['brand', 'lira']);
  state.setFlag(p, 'hasRelic', true);
  assertEqual(state.getFlag(p, 'hasRelic'), true);
  assertEqual(state.getFlag(p, 'missing'), undefined);
});
test('partyWiped true only when all heroes downed', function () {
  var p = state.createParty(['brand', 'lira']);
  assertEqual(state.partyWiped(p), false);
  p.heroes.forEach(function (h) { state.damageHero(h, 999); });
  assertEqual(state.partyWiped(p), true);
});

// ---- progression: party.upgrades + level ----
test('createParty initialises empty upgrades and level 0', function () {
  var p = state.createParty(['brand', 'lira']);
  assertEqual(typeof p.upgrades, 'object');
  assertEqual(Object.keys(p.upgrades).length, 0);
  assertEqual(p.level, 0);
});
test('applyLevelUp raises maxHp, heals to full, and increments level', function () {
  var p = state.createParty(['brand', 'lira']);
  state.damageHero(p.heroes[0], 5);
  var oldMax = p.heroes[0].maxHp;
  state.applyLevelUp(p, { hp: 6, uses: 'bestCombat' });
  assertEqual(p.heroes[0].maxHp, oldMax + 6);
  assertEqual(p.heroes[0].hp, p.heroes[0].maxHp, 'healed to full');
  assertEqual(p.heroes[0].downed, false);
  assertEqual(p.level, 1);
});
test('applyLevelUp records +1 use on the strongest combat ability', function () {
  var p = state.createParty(['lira', 'brand']);
  state.applyLevelUp(p, { hp: 6, uses: 'bestCombat' });
  // Lira fireball has the highest base uses (3) among her damaging abilities
  assertEqual(p.upgrades['lira'].extraUses.fireball, 1);
});
test('heroAtkBonus/heroDefBonus default to 0 and reflect a set upgrade', function () {
  var p = state.createParty(['brand', 'lira']);
  assertEqual(state.heroAtkBonus(p, 'brand'), 0);
  assertEqual(state.heroDefBonus(p, 'brand'), 0);
  var rec = state.upgradeRec(p, 'brand');
  rec.atkDieBonus = 2; rec.defBonus = 3;
  assertEqual(state.heroAtkBonus(p, 'brand'), 2);
  assertEqual(state.heroDefBonus(p, 'brand'), 3);
});
