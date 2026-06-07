'use strict';
var dice = require('../js/dice.js');
test('dice module loads in Node', function () {
  assertEqual(typeof dice.rollDie, 'function');
});
