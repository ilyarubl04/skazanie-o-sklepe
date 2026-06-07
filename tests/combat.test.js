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

// ---- per-combat reset (fix 1) ----
test('startCombat resets ability uses and clears statuses each fight', function () {
  var p = state.createParty(['lira', 'mira']);
  combat.startCombat(p, [{ type: 'skeleton' }]);
  var uid = p.combat.enemies[0].uid;
  combat.heroAbility(p, 0, 'fireball', uid, maxRng());      // spend a fireball
  combat.heroAbility(p, 1, 'bless', p.heroes[0].id, maxRng()); // apply a buff status
  assertEqual(p.heroes[0].abilityUses.fireball, 2);
  assert(p.heroes[0].statuses.length > 0, 'buff applied before reset');
  combat.startCombat(p, [{ type: 'skeleton' }]);            // new fight
  assertEqual(p.heroes[0].abilityUses.fireball, 3, 'fireball refilled');
  assertEqual(p.heroes[0].statuses.length, 0, 'statuses cleared');
});

// ---- nil-guard target lookups (fix 2) ----
test('heroAttack on unknown uid returns invalid and does not throw', function () {
  var p = state.createParty(['brand', 'lira']);
  combat.startCombat(p, [{ type: 'skeleton' }]);
  var res = combat.heroAttack(p, 0, 'nope-uid', maxRng());
  assertEqual(res.hit, false);
  assertEqual(res.invalid, true);
});
test('heroAttack on an already-dead enemy returns invalid, not a hit', function () {
  var p = state.createParty(['brand', 'lira']);
  combat.startCombat(p, [{ type: 'wolf' }, { type: 'skeleton' }]);
  var deadUid = p.combat.enemies[0].uid;
  combat.heroAttack(p, 0, deadUid, maxRng()); // kill the wolf (10hp, d8+3 max=11)
  assert(p.combat.enemies[0].hp <= 0, 'wolf dead');
  var res = combat.heroAttack(p, 1, deadUid, maxRng()); // attack the corpse
  assertEqual(res.invalid, true);
  assertEqual(res.hit, false);
});

// ---- no-op instead of throw for unusable abilities (fix 3) ----
test('heroAbility with no uses left returns invalid, does not throw or go negative', function () {
  var p = state.createParty(['lira', 'mira']);
  combat.startCombat(p, [{ type: 'skeleton' }]);
  var uid = p.combat.enemies[0].uid;
  p.heroes[0].abilityUses.fireball = 0;
  var res = combat.heroAbility(p, 0, 'fireball', uid, maxRng());
  assertEqual(res.invalid, true);
  assertEqual(p.heroes[0].abilityUses.fireball, 0);
});
test('heroAbility with unknown id returns invalid and does not throw', function () {
  var p = state.createParty(['lira', 'mira']);
  combat.startCombat(p, [{ type: 'skeleton' }]);
  var res = combat.heroAbility(p, 0, 'no_such_ability', p.combat.enemies[0].uid, maxRng());
  assertEqual(res.invalid, true);
});
