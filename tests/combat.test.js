'use strict';
require('../js/dice.js'); require('../js/rules.js');
require('../js/heroes.js'); require('../js/bestiary.js');
require('../js/state.js');
var combat = require('../js/combat.js');
var state = require('../js/state.js');

function maxRng() { return function () { return 0.999; }; }
function minRng() { return function () { return 0; }; }

test('startCombat creates enemy instances with hp', function () {
  var p = state.createParty(['brand', 'lira']);
  combat.startCombat(p, [{ type: 'skeleton' }, { type: 'skeleton' }]);
  assertEqual(p.combat.enemies.length, 2);
  assertEqual(p.combat.enemies[0].hp, 12);
  assertEqual(p.combat.status, 'ongoing');
});
test('heroAttack with high roll hits and damages enemy', function () {
  var p = state.createParty(['brand', 'lira']);
  combat.startCombat(p, [{ type: 'skeleton' }]);
  var enemyId = p.combat.enemies[0].uid;
  var res = combat.heroAttack(p, 0, enemyId, maxRng());
  assertEqual(res.hit, true);
  assert(p.combat.enemies[0].hp < 12, 'enemy took damage');
});
test('killing all enemies sets status won', function () {
  var p = state.createParty(['brand', 'lira']);
  combat.startCombat(p, [{ type: 'wolf' }]);
  var uid = p.combat.enemies[0].uid;
  // wolf has 10 hp; brand d8+3 max=11 -> dies in one max hit
  combat.heroAttack(p, 0, uid, maxRng());
  assertEqual(combat.combatStatus(p), 'won');
});
test('enemiesTurn can down a hero and partyWiped triggers lost', function () {
  var p = state.createParty(['lira', 'lira']);
  // both fragile mages 20hp; give enemy guaranteed hits with maxRng repeatedly
  combat.startCombat(p, [{ type: 'morven' }]);
  for (var i = 0; i < 30 && combat.combatStatus(p) !== 'lost'; i++) {
    combat.enemiesTurn(p, maxRng());
  }
  assertEqual(combat.combatStatus(p), 'lost');
});
test('turn_undead ability damages undead enemies', function () {
  var p = state.createParty(['mira', 'brand']);
  combat.startCombat(p, [{ type: 'skeleton' }]);
  var uid = p.combat.enemies[0].uid;
  var before = p.combat.enemies[0].hp;
  combat.heroAbility(p, 0, 'turn_undead', uid, maxRng());
  assert(p.combat.enemies[0].hp < before || p.combat.enemies[0].fled, 'undead affected');
  assertEqual(p.heroes[0].abilityUses.turn_undead, 1);
});
test('heal ability restores a downed ally', function () {
  var p = state.createParty(['mira', 'brand']);
  state.damageHero(p.heroes[1], 999);
  combat.startCombat(p, [{ type: 'skeleton' }]);
  combat.heroAbility(p, 0, 'heal', p.heroes[1].id, maxRng());
  assert(p.heroes[1].hp > 0, 'ally healed');
  assertEqual(p.heroes[1].downed, false);
});
