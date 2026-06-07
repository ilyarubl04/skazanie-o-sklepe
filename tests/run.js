'use strict';
var fs = require('fs');
var path = require('path');

var passed = 0, failed = 0, failures = [];

global.test = function (name, fn) {
  try { fn(); passed++; process.stdout.write('.'); }
  catch (e) { failed++; failures.push({ name: name, err: e }); process.stdout.write('F'); }
};

global.assert = function (cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
};
global.assertEqual = function (actual, expected, msg) {
  if (actual !== expected) throw new Error((msg || 'not equal') + ' — expected ' + expected + ', got ' + actual);
};
global.assertClose = function (actual, expected, tol, msg) {
  if (Math.abs(actual - expected) > tol) throw new Error((msg || 'not close') + ' — expected ~' + expected + ', got ' + actual);
};

var dir = path.join(__dirname);
var files = process.argv.slice(2);
if (files.length === 0) {
  files = fs.readdirSync(dir).filter(function (f) { return /\.test\.js$/.test(f); }).map(function (f) { return path.join(dir, f); });
}
files.forEach(function (f) { require(path.resolve(f)); });

process.stdout.write('\n');
failures.forEach(function (x) {
  console.log('FAIL: ' + x.name);
  console.log('  ' + x.err.message);
});
console.log(passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
