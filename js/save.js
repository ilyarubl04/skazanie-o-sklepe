(function (root) {
  'use strict';
  root.DnD = root.DnD || {};
  var HEROES = root.DnD.HEROES;
  var save = {};
  var KEY = 'skazanie_save_v1';
  var CKEY = 'skazanie_checkpoint_v1';

  function store(given) {
    if (given) return given;
    if (typeof localStorage !== 'undefined') return localStorage;
    throw new Error('no storage available');
  }
  function heroDef(id) { for (var i = 0; i < HEROES.length; i++) if (HEROES[i].id === id) return HEROES[i]; return null; }

  // strip non-serialisable `def` back-references before saving
  function plain(party) {
    return JSON.parse(JSON.stringify(party, function (k, v) { return k === 'def' ? undefined : v; }));
  }
  // re-link def references after loading
  function rehydrate(party) {
    party.heroes.forEach(function (h) { h.def = heroDef(h.id); });
    return party;
  }

  save.write = function (party, s) { store(s).setItem(KEY, JSON.stringify(plain(party))); };
  save.read = function (s) {
    var raw = store(s).getItem(KEY);
    if (!raw) return null;
    return rehydrate(JSON.parse(raw));
  };
  save.hasSave = function (s) { return !!store(s).getItem(KEY); };
  save.clear = function (s) { store(s).removeItem(KEY); };

  save.checkpoint = function (party, s) { store(s).setItem(CKEY, JSON.stringify(plain(party))); };
  save.restoreCheckpoint = function (s) {
    var raw = store(s).getItem(CKEY);
    if (!raw) return null;
    return rehydrate(JSON.parse(raw));
  };

  root.DnD.save = save;
  if (typeof module !== 'undefined' && module.exports) module.exports = save;
})(typeof window !== 'undefined' ? window : global);
