(function (root) {
  'use strict';
  root.DnD = root.DnD || {};

  // ---------------------------------------------------------------------------
  // 2.5D world map (Heroes-of-Might-and-Magic-style overworld).
  // The party travels between location NODES; edges are the ink-drawn paths.
  //
  // Each node:
  //   id     — stable key (matches `done` flag naming, used by save/fog logic)
  //   label  — display name (Forum)
  //   x, y   — position in PERCENT (0..100) of the map canvas, so layout is
  //            resolution-independent (hit-testing scales with the viewport)
  //   act    — story act (1..5); only Act 3 nodes have working `enter` scenes now
  //   icon   — short emoji marker (no asset needed; readable on parchment)
  //   enter  — the entry scene id of that location's cluster (where the map
  //            hands control back to the scene-flow). null for placeholders.
  //   done   — name of the party flag set once this location's cluster finishes.
  //            Acts 1–2 nodes are already `done` (the party traversed them in
  //            normal scene-flow before the map opens).
  //
  // Edges are the path graph from the design §3:
  //   1→2→4→5→6 (Акт 1–2), 6→7 (хаб), 7 ветвится 8/9 →10→11→12,
  //   12→13→14→15, 15→16 (финал). (3, 9 — optional side-locations.)
  // ---------------------------------------------------------------------------
  var WORLDMAP = {
    nodes: [
      // ---- Акт 1–2 — already traversed (shown done, anchor the map's south) ----
      { id: 'tihiy_brod',   label: 'Тихий Брод',        x: 17, y: 86, act: 1, icon: '🏘️', enter: null, done: 'map_tihiy_brod' },
      { id: 'cherny_les',   label: 'Чёрный лес',        x: 30, y: 74, act: 1, icon: '🌲', enter: null, done: 'map_cherny_les' },
      { id: 'kolodec',      label: 'Колодец Майи',      x: 9,  y: 72, act: 1, icon: '🪣', enter: null, done: 'map_kolodec' },
      { id: 'chasovnya',    label: 'Часовня',           x: 41, y: 66, act: 1, icon: '⛪', enter: null, done: 'map_chasovnya' },
      { id: 'sklep',        label: 'Склеп',             x: 50, y: 58, act: 2, icon: '🪦', enter: null, done: 'map_sklep' },
      { id: 'zal_kolokola', label: 'Зал колокола',      x: 44, y: 50, act: 2, icon: '🔔', enter: null, done: 'map_zal_kolokola' },

      // ---- Акт 3 — «Гать Сумрачи» — the playable cluster (working enter scenes) ----
      { id: 'pereputie',    label: 'Перепутье',         x: 55, y: 44, act: 3, icon: '🪧', enter: 'crossroads',      done: 'map_pereputie' },
      { id: 'top',          label: 'Топь',              x: 44, y: 33, act: 3, icon: '🌫️', enter: 'bog_marsh',       done: 'map_top' },
      { id: 'shepot_les',   label: 'Шёпот-лес',         x: 68, y: 34, act: 3, icon: '🌳', enter: 'whisper_forest',  done: 'map_shepot_les' },
      { id: 'zastava',      label: 'Застава',           x: 56, y: 24, act: 3, icon: '🏕️', enter: 'outpost',         done: 'map_zastava' },
      { id: 'gat',          label: 'Гать',              x: 64, y: 15, act: 3, icon: '🪵', enter: 'gat',             done: 'map_gat' },

      // ---- Акт 4–5 — placeholders (locked / under the fog until built) ----
      { id: 'monastyr',     label: 'Монастырь',         x: 76, y: 9,  act: 4, icon: '🏰', enter: null, done: 'map_monastyr' },
      { id: 'kolokolnya',   label: 'Колокольня',        x: 86, y: 16, act: 4, icon: '🗼', enter: null, done: 'map_kolokolnya' },
      { id: 'kripta',       label: 'Крипта Ордена',     x: 90, y: 30, act: 4, icon: '⚰️', enter: null, done: 'map_kripta' },
      { id: 'zatopl_cerkov',label: 'Затопл. церковь',   x: 84, y: 44, act: 4, icon: '🌊', enter: null, done: 'map_zatopl_cerkov' },
      { id: 'serdce',       label: 'Сердце-Колокол',    x: 90, y: 58, act: 5, icon: '🕳️', enter: null, done: 'map_serdce' }
    ],
    // undirected path graph (an edge means "you can travel between these two")
    edges: [
      ['tihiy_brod', 'cherny_les'],
      ['tihiy_brod', 'kolodec'],
      ['cherny_les', 'chasovnya'],
      ['chasovnya', 'sklep'],
      ['sklep', 'zal_kolokola'],
      ['zal_kolokola', 'pereputie'],
      ['pereputie', 'top'],
      ['pereputie', 'shepot_les'],
      ['top', 'zastava'],
      ['shepot_les', 'zastava'],
      ['zastava', 'gat'],
      ['gat', 'monastyr'],
      ['monastyr', 'kolokolnya'],
      ['kolokolnya', 'kripta'],
      ['kripta', 'zatopl_cerkov'],
      ['zatopl_cerkov', 'serdce']
    ]
  };

  // index helpers (used by main.js for fog/reachability/hit-testing)
  WORLDMAP.byId = function (id) {
    for (var i = 0; i < WORLDMAP.nodes.length; i++) {
      if (WORLDMAP.nodes[i].id === id) return WORLDMAP.nodes[i];
    }
    return null;
  };
  // ids directly connected to `id` by an edge (graph neighbours)
  WORLDMAP.neighbors = function (id) {
    var out = [];
    WORLDMAP.edges.forEach(function (e) {
      if (e[0] === id && out.indexOf(e[1]) < 0) out.push(e[1]);
      if (e[1] === id && out.indexOf(e[0]) < 0) out.push(e[0]);
    });
    return out;
  };

  root.DnD.WORLDMAP = WORLDMAP;
  if (typeof module !== 'undefined' && module.exports) module.exports = WORLDMAP;
})(typeof window !== 'undefined' ? window : global);
