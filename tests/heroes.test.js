'use strict';
var heroes = require('../js/heroes.js');

test('there are exactly 6 heroes', function () {
  assertEqual(heroes.length, 6);
});
test('every hero has required fields and valid stats', function () {
  var ids = {};
  heroes.forEach(function (h) {
    assert(h.id && !ids[h.id], 'unique id: ' + h.id); ids[h.id] = true;
    assert(h.name && h.role && h.story, 'text fields: ' + h.id);
    assert(h.portrait, 'portrait path: ' + h.id);
    ['str', 'dex', 'int', 'cha'].forEach(function (s) {
      assert(h.stats[s] >= 1 && h.stats[s] <= 5, 'stat ' + s + ' in 1..5 for ' + h.id);
    });
    assert(h.maxHp > 0 && h.defense > 0, 'hp/defense: ' + h.id);
    assert(h.attack && h.attack.bonus !== undefined && h.attack.damage, 'attack: ' + h.id);
    assert(h.abilities.length >= 2 && h.abilities.length <= 3, 'abilities count: ' + h.id);
    h.abilities.forEach(function (a) {
      assert(a.id && a.name && a.icon && a.desc, 'ability fields: ' + h.id + '/' + (a.id || '?'));
      assert(a.uses === 'unlimited' || (a.uses >= 1), 'ability uses: ' + a.id);
    });
  });
});
test('warrior Бранд exists with high strength', function () {
  var brand = heroes.filter(function (h) { return h.id === 'brand'; })[0];
  assert(brand, 'brand present');
  assertEqual(brand.stats.str, 5);
});
