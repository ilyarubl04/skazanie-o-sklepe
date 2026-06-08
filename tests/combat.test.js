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
test('heroAttack with fixedD20=20 is a guaranteed hit and natural 20', function () {
  var p = state.createParty(['brand', 'lira']);
  combat.startCombat(p, [{ type: 'skeleton' }]);
  var uid = p.combat.enemies[0].uid;
  var res = combat.heroAttack(p, 0, uid, minRng(), 20); // min rng => min damage, still hits
  assertEqual(res.hit, true);
  assert(p.combat.enemies[0].hp < 12, 'enemy took damage on natural 20');
});
test('heroAttack with low fixedD20 misses a high-defense enemy', function () {
  var p = state.createParty(['brand', 'lira']);
  // morven is the boss with a high defense; a 2 + small bonus cannot reach it
  combat.startCombat(p, [{ type: 'morven' }]);
  var uid = p.combat.enemies[0].uid;
  var before = p.combat.enemies[0].hp;
  var res = combat.heroAttack(p, 0, uid, maxRng(), 2);
  assertEqual(res.hit, false);
  assertEqual(p.combat.enemies[0].hp, before, 'enemy unharmed on a miss');
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

// ---- buff_rolls (bless/inspire) actually boosts to-hit ----
test('bless adds its value to the blessed hero to-hit and lands a borderline hit', function () {
  // brand bonus 5; skeleton defense — pick a fixedD20 that misses without bless but hits with +2.
  var p = state.createParty(['mira', 'brand']);
  combat.startCombat(p, [{ type: 'skeleton' }]);
  var def = p.combat.enemies[0].defense;
  // choose face so that face+5 < def but face+5+2 >= def
  var face = def - 5 - 1; // misses by 1 without bless
  var uid = p.combat.enemies[0].uid;
  // without bless: miss
  var miss = combat.heroAttack(p, 1, uid, minRng(), face);
  assertEqual(miss.hit, false);
  // now bless brand (+2) then attack with same face: should hit
  combat.heroAbility(p, 0, 'bless', p.heroes[1].id, maxRng());
  var hit = combat.heroAttack(p, 1, uid, minRng(), face);
  assertEqual(hit.hit, true);
});

// ---- summon_ally (animal_call): the beast strikes enemies ----
test('animal_call summons a beast that damages an enemy and expires after 2 rounds', function () {
  var p = state.createParty(['thea', 'brand']);
  combat.startCombat(p, [{ type: 'skeleton' }]);
  combat.heroAbility(p, 0, 'animal_call', null, maxRng());
  assert(p.combat.ally && p.combat.ally.turns === 2, 'ally summoned with 2 turns');
  var before = p.combat.enemies[0].hp;
  combat.enemiesTurn(p, maxRng());
  assert(p.combat.enemies[0].hp < before, 'beast damaged the enemy');
  assertEqual(p.combat.ally.turns, 1, 'ally turns decremented');
  combat.enemiesTurn(p, maxRng());
  assert(!p.combat.ally, 'ally gone after 2 rounds');
});

// ---- guard_ally (Brand's guard): redirects a hit to the guardian ----
test('guard redirects an enemy hit from the ally to Brand, then is consumed', function () {
  var p = state.createParty(['brand', 'lira']);
  combat.startCombat(p, [{ type: 'skeleton' }]);
  combat.heroAbility(p, 0, 'guard', null, maxRng());
  var brandHpBefore = p.heroes[0].hp;
  var liraHpBefore = p.heroes[1].hp;
  combat.enemiesTurn(p, maxRng()); // maxRng => enemy hits
  assert(p.heroes[1].hp === liraHpBefore, 'ally (Lira) unharmed — hit redirected');
  assert(p.heroes[0].hp < brandHpBefore, 'guardian (Brand) took the damage');
  var stillGuarding = p.heroes[0].statuses.some(function (s) { return s.type === 'guard'; });
  assertEqual(stillGuarding, false, 'guard consumed');
});
