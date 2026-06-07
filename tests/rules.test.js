'use strict';
require('../js/dice.js');
var rules = require('../js/rules.js');

test('DIFFICULTY has the four named levels', function () {
  assertEqual(rules.DIFFICULTY.easy, 8);
  assertEqual(rules.DIFFICULTY.medium, 12);
  assertEqual(rules.DIFFICULTY.hard, 16);
  assertEqual(rules.DIFFICULTY.veryHard, 20);
});
test('statBonus maps dots 1..5 to 0,2,4,5,6', function () {
  assertEqual(rules.statBonus(1), 0);
  assertEqual(rules.statBonus(2), 2);
  assertEqual(rules.statBonus(3), 4);
  assertEqual(rules.statBonus(4), 5);
  assertEqual(rules.statBonus(5), 6);
});
test('resolveCheck success when d20+bonus >= difficulty', function () {
  // rng 0.999 -> nat 20; bonus from stat 3 (=+4); medium 12
  var r = rules.resolveCheck({ statValue: 3, difficulty: rules.DIFFICULTY.medium }, function () { return 0.999; });
  assertEqual(r.success, true);
  assertEqual(r.total, 24);
});
test('resolveCheck failure on low roll', function () {
  // rng 0 -> nat 1; bonus stat 2 (=+2); hard 16 -> 3 < 16 fail
  var r = rules.resolveCheck({ statValue: 2, difficulty: rules.DIFFICULTY.hard }, function () { return 0; });
  assertEqual(r.success, false);
  assertEqual(r.critFail, true);
});
test('resolveCheck applies flat extra bonus (e.g. Bless)', function () {
  // rng 0.5 -> d20=11; stat 1 (=+0); +2 extra; medium 12 -> 13 >= 12 success
  var r = rules.resolveCheck({ statValue: 1, difficulty: 12, extra: 2 }, function () { return 0.5; });
  assertEqual(r.total, 13);
  assertEqual(r.success, true);
});
