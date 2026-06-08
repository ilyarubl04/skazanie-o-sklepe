'use strict';
require('../js/dice.js');
var rules = require('../js/rules.js');

test('DIFFICULTY has the four named levels', function () {
  assertEqual(rules.DIFFICULTY.easy, 8);
  assertEqual(rules.DIFFICULTY.medium, 11);
  assertEqual(rules.DIFFICULTY.hard, 14);
  assertEqual(rules.DIFFICULTY.veryHard, 17);
});
test('statBonus maps dots 1..5 to flat ladder 0,1,2,3,4', function () {
  assertEqual(rules.statBonus(1), 0);
  assertEqual(rules.statBonus(2), 1);
  assertEqual(rules.statBonus(3), 2);
  assertEqual(rules.statBonus(4), 3);
  assertEqual(rules.statBonus(5), 4);
});
test('resolveCheck success when d20+bonus >= difficulty', function () {
  // rng 0.999 -> nat 20; bonus from stat 3 (=+2); medium 11 -> 22 >= 11
  var r = rules.resolveCheck({ statValue: 3, difficulty: rules.DIFFICULTY.medium }, function () { return 0.999; });
  assertEqual(r.success, true);
  assertEqual(r.total, 22);
});
test('resolveCheck failure on low roll', function () {
  // rng 0 -> nat 1; bonus stat 2 (=+1); hard 14 -> 2 < 14 fail
  var r = rules.resolveCheck({ statValue: 2, difficulty: rules.DIFFICULTY.hard }, function () { return 0; });
  assertEqual(r.success, false);
  assertEqual(r.total, 2);
  assertEqual(r.critFail, true);
});
test('resolveCheck applies flat extra bonus (e.g. Bless)', function () {
  // rng 0.5 -> d20=11; stat 1 (=+0); +2 extra; medium 12 -> 13 >= 12 success
  var r = rules.resolveCheck({ statValue: 1, difficulty: 12, extra: 2 }, function () { return 0.5; });
  assertEqual(r.total, 13);
  assertEqual(r.success, true);
});
