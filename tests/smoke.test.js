'use strict';
var dice = require('../js/dice.js');
test('dice module loads in Node', function () {
  assertEqual(dice.__loaded, true);
});
