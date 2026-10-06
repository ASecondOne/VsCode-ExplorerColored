'use strict';

function hash(text) {
  let value = 2166136261;
  for (let i = 0; i < text.length; i++) value = Math.imul(value ^ text.charCodeAt(i), 16777619);
  return value >>> 0;
}

function assignColors(names, previous = {}, size = 16) {
  const sorted = [...new Set(names)].sort();
  const result = Object.create(null);
  const used = new Set();
  // Preserve assignments of all surviving folders, even when alphabetical order changes.
  for (const name of sorted) {
    const slot = previous && Object.hasOwn(previous, name) ? previous[name] : undefined;
    if (Number.isInteger(slot) && slot >= 0 && slot < size &&
        (sorted.length > size || !used.has(slot))) {
      result[name] = slot;
      used.add(slot);
    }
  }
  for (const name of sorted) {
    if (Object.hasOwn(result, name)) continue;
    let slot = hash(name) % size;
    for (let i = 0; used.has(slot) && i < size; i++) slot = (slot + 1) % size;
    result[name] = slot;
    used.add(slot);
  }
  return result;
}

function rootParts(value) {
  if (typeof value !== 'string' || !value || /^[\\/]/.test(value) || value.includes(':')) return;
  const parts = value.replace(/\\/g, '/').split('/').filter(part => part && part !== '.');
  if (!parts.length || parts.includes('..')) return;
  return parts;
}

module.exports = { assignColors, rootParts };
