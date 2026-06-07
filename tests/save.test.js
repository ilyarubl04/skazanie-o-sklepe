'use strict';
require('../js/heroes.js');
var state = require('../js/state.js');
var save = require('../js/save.js');

// in-memory localStorage shim for Node
function memStore() {
  var data = {};
  return {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null; },
    setItem: function (k, v) { data[k] = String(v); },
    removeItem: function (k) { delete data[k]; }
  };
}

test('serialize then deserialize round-trips party essentials', function () {
  var store = memStore();
  var p = state.createParty(['brand', 'lira']);
  p.sceneId = 'chapel';
  state.setFlag(p, 'knowsBell', true);
  state.damageHero(p.heroes[0], 5);
  save.write(p, store);
  var loaded = save.read(store);
  assertEqual(loaded.sceneId, 'chapel');
  assertEqual(loaded.flags.knowsBell, true);
  assertEqual(loaded.heroes[0].id, 'brand');
  assertEqual(loaded.heroes[0].hp, p.heroes[0].hp);
  assert(loaded.heroes[0].def, 'def re-linked after load');
});
test('hasSave reflects presence', function () {
  var store = memStore();
  assertEqual(save.hasSave(store), false);
  save.write(state.createParty(['finn', 'kael']), store);
  assertEqual(save.hasSave(store), true);
});
test('clear removes the save', function () {
  var store = memStore();
  save.write(state.createParty(['finn', 'kael']), store);
  save.clear(store);
  assertEqual(save.hasSave(store), false);
});
test('checkpoint stores and restores a snapshot', function () {
  var store = memStore();
  var p = state.createParty(['brand', 'mira']);
  p.sceneId = 'boss';
  save.checkpoint(p, store);
  p.sceneId = 'defeat_scene';
  var cp = save.restoreCheckpoint(store);
  assertEqual(cp.sceneId, 'boss');
});
