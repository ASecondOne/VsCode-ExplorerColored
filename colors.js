'use strict';

function hash(text) {
  let value = 2166136261;
  for (let i = 0; i < text.length; i++) value = Math.imul(value ^ text.charCodeAt(i), 16777619);
  return value >>> 0;
}

function assignColors(names, previous = {}, size = 16, parentSlot) {
  const sorted = [...new Set(names)].sort();
  const available = Array.from({ length: size }, (_, slot) => slot).filter(slot => slot !== parentSlot);
  if (!available.length) throw new RangeError('Palette must include a color different from the parent.');
  const result = Object.create(null);
  const used = new Set();
  // Preserve assignments of all surviving folders, even when alphabetical order changes.
  for (const name of sorted) {
    const slot = previous && Object.hasOwn(previous, name) ? previous[name] : undefined;
    if (Number.isInteger(slot) && available.includes(slot) &&
        (sorted.length > available.length || !used.has(slot))) {
      result[name] = slot;
      used.add(slot);
    }
  }
  for (const name of sorted) {
    if (Object.hasOwn(result, name)) continue;
    const start = hash(name) % available.length;
    let slot = available[start];
    for (let i = 1; used.has(slot) && i < available.length; i++) {
      slot = available[(start + i) % available.length];
    }
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
