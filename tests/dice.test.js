'use strict';
var dice = require('../js/dice.js');

// Deterministic RNG: returns each value in sequence, then loops.
function seq(values) {
  var i = 0;
  return function () { var v = values[i % values.length]; i++; return v; };
}

test('rollDie(6) with rng=0 returns 1 (lowest face)', function () {
  assertEqual(dice.rollDie(6, function () { return 0; }), 1);
});
test('rollDie(6) with rng just under 1 returns 6 (highest face)', function () {
  assertEqual(dice.rollDie(6, function () { return 0.999; }), 6);
});
test('rollDie(20) midpoint returns 11', function () {
  assertEqual(dice.rollDie(20, function () { return 0.5; }), 11);
});
test('roll("d8+3") with max rng returns 11', function () {
  var r = dice.roll('d8+3', function () { return 0.999; });
  assertEqual(r.total, 11);
  assertEqual(r.rolls.length, 1);
  assertEqual(r.modifier, 3);
});
test('roll("2d6") sums two dice', function () {
  var r = dice.roll('2d6', function () { return 0.999; });
  assertEqual(r.total, 12);
  assertEqual(r.rolls.length, 2);
});
test('roll("d20") with min rng returns 1 and flags natural 1', function () {
  var r = dice.roll('d20', function () { return 0; });
  assertEqual(r.total, 1);
  assertEqual(r.natural, 1);
});
test('rollD20 returns natural 20 flag', function () {
  var r = dice.rollD20(5, function () { return 0.999; });
  assertEqual(r.natural, 20);
  assertEqual(r.total, 25);
});
