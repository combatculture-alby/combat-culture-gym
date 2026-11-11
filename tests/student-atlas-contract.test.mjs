import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const names = ['frank', 'radish', 'marshall', 'pudge', 'holly', 'gao'];
const atlasWidth = 12 * 48;
const atlasHeight = 3 * 64;

test('all six runtime student atlases use the 12-column, 3-row character contract', () => {
  for (const name of names) {
    const file = new URL(`../src/assets/${name}.png`, import.meta.url);
    const bytes = readFileSync(file);
    assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', name);
    assert.equal(bytes.readUInt32BE(16), atlasWidth, `${name}: atlas width`);
    assert.equal(bytes.readUInt32BE(20), atlasHeight, `${name}: atlas height`);
    const colorType = bytes[25];
    assert.ok(colorType === 6 || colorType === 4,
      `${name}: atlas must have an alpha channel (PNG type 4 or 6), got ${colorType}`);
  }
});
