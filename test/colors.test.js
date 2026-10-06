'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { assignColors, rootParts } = require('../colors');

test('all palette slots are distinct, regardless of directory enumeration order', () => {
  const names = Array.from({ length: 16 }, (_, i) => `folder-${i}`);
  const colors = assignColors(names);
  assert.equal(new Set(Object.values(colors)).size, 16);
  assert.deepEqual(colors, assignColors(names.reverse()));
});

test('saved assignments survive restart, insertion and deletion', () => {
  const names = ['executers', 'i_core', 'psychoparser', 'symbolresolver'];
  const initial = assignColors(names);
  const saved = JSON.parse(JSON.stringify(initial));
  const updated = assignColors(['aaa', ...names, 'zzz'], saved);
  for (const name of names) assert.equal(updated[name], initial[name]);
  assert.equal(new Set(Object.values(updated)).size, 6);
  const removed = assignColors(names.slice(1), updated);
  for (const name of names.slice(1)) assert.equal(removed[name], initial[name]);
  assert.equal(Object.hasOwn(removed, 'executers'), false);
});

test('unusual names are safe and overflow remains bounded', () => {
  const names = ['__proto__', 'constructor', 'toString', '日本語', ...Array.from({ length: 40 }, (_, i) => `${i}`)];
  const colors = assignColors(names);
  assert.equal(Object.keys(colors).length, names.length);
  for (const value of Object.values(colors)) assert.ok(value >= 0 && value < 16);
  assert.deepEqual(assignColors(names, JSON.parse(JSON.stringify(colors))), colors);
});

test('root accepts nested relative paths and rejects paths outside the workspace', () => {
  assert.deepEqual(rootParts('packages/app/src'), ['packages', 'app', 'src']);
  assert.deepEqual(rootParts('.\\packages\\src\\'), ['packages', 'src']);
  for (const value of ['', '.', '../src', 'a/../b', '/src', 'C:\\src', '\\\\server\\src', null]) {
    assert.equal(rootParts(value), undefined);
  }
});

test('returning below the palette limit resolves previously repeated colors', () => {
  const names = Array.from({ length: 24 }, (_, i) => `folder-${i}`);
  const overflowing = assignColors(names);
  const duplicate = names.find((name, i) => names.slice(0, i).some(other => overflowing[other] === overflowing[name]));
  const first = names.find(name => name !== duplicate && overflowing[name] === overflowing[duplicate]);
  const reduced = assignColors([first, duplicate], overflowing);
  assert.equal(new Set(Object.values(reduced)).size, 2);
});

test('children never use their parent color, including palette overflow and saved collisions', () => {
  for (let parent = 0; parent < 16; parent++) {
    for (const count of [1, 15, 16, 40]) {
      const names = Array.from({ length: count }, (_, i) => `child-${i}`);
      const previous = Object.fromEntries(names.map(name => [name, parent]));
      const colors = assignColors(names, previous, 16, parent);
      assert.ok(Object.values(colors).every(slot => slot !== parent));
      if (count <= 15) assert.equal(new Set(Object.values(colors)).size, count);
      assert.deepEqual(assignColors(names, JSON.parse(JSON.stringify(colors)), 16, parent), colors);
    }
  }
});

test('adding a nested sibling preserves existing child colors', () => {
  const initial = assignColors(['datastore', 'math'], {}, 16, 3);
  const next = assignColors(['aaa', 'datastore', 'math'], initial, 16, 3);
  assert.equal(next.datastore, initial.datastore);
  assert.equal(next.math, initial.math);
  assert.notEqual(next.aaa, 3);
});
