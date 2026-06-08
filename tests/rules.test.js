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
test('resolveCheck flags partial on a near-miss within 2 below difficulty', function () {
  // d20=10 (rng so floor(rng*20)+1=10 -> rng 0.5 gives 11; use 0.46 -> 10); stat1=+0; diff 12 -> 10, within 2
  var r = rules.resolveCheck({ statValue: 1, difficulty: 12 }, function () { return 0.46; });
  assertEqual(r.d20, 10);
  assertEqual(r.success, false);
  assertEqual(r.partial, true);
});
test('resolveCheck does not flag partial on a clear miss', function () {
  // d20=5; diff 12 -> 5, more than 2 below
  var r = rules.resolveCheck({ statValue: 1, difficulty: 12 }, function () { return 0.21; });
  assertEqual(r.d20, 5);
  assertEqual(r.partial, false);
});
test('resolveCheck does not flag partial on a natural 1', function () {
  var r = rules.resolveCheck({ statValue: 5, difficulty: 5 }, function () { return 0; });
  assertEqual(r.critFail, true);
  assertEqual(r.partial, false);
});
test('resolveCheck applies flat extra bonus (e.g. Bless)', function () {
  // rng 0.5 -> d20=11; stat 1 (=+0); +2 extra; medium 12 -> 13 >= 12 success
  var r = rules.resolveCheck({ statValue: 1, difficulty: 12, extra: 2 }, function () { return 0.5; });
  assertEqual(r.total, 13);
  assertEqual(r.success, true);
});
