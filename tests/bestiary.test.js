'use strict';
var ENEMIES = require('../js/bestiary.js');

test('bestiary has wolf, skeleton, morven', function () {
  ['wolf', 'skeleton', 'morven'].forEach(function (id) {
    assert(ENEMIES[id], 'missing enemy ' + id);
  });
});
test('every enemy has combat stats', function () {
  Object.keys(ENEMIES).forEach(function (id) {
    var e = ENEMIES[id];
    assert(e.name, 'name ' + id);
    assert(e.maxHp > 0 && e.defense > 0, 'hp/defense ' + id);
    assert(e.attack.bonus !== undefined && e.attack.damage, 'attack ' + id);
  });
});
test('skeleton is flagged undead (weak to turn/light)', function () {
  assertEqual(ENEMIES.skeleton.undead, true);
});
test('morven is a boss with summon and high hp', function () {
  assertEqual(ENEMIES.morven.boss, true);
  assert(ENEMIES.morven.maxHp >= 50, 'boss hp');
  assert(ENEMIES.morven.special, 'boss special');
});
