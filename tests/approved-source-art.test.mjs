import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

const directory = new URL('../art-source/approved-originals/', import.meta.url);
const expected = [
  'ChatGPT Image Nov 10, 2026, 11_04_58 PM.png',
  'Combat Culture Gym Asset Board(3).png',
  'Combat Culture Gym Asset Sheet(3).png',
  'Combat Culture Gym Pixel Asset Sheet(2).png',
  'Combat Culture Gym Tileset Showcase(1).png',
  'Erin Student Pixel Sprite Sheet(1).png',
  'Female Coach Chibi Sprite Customization Sheet(1).png',
  'Frank_ Combat Culture Gym Sprite Sheet.png',
  'Gao’s Combat Gym Character Sheet(1).png',
  'Gym Equipment States Pixel Art Sprite Sheet(1).png',
  'Gym Maintenance Pixel Art Asset Sheet(1).png',
  'Holly Approved (sheet says Erin).png',
  'Level 1 Garage Gym Asset Sheet(2).png',
  'Marshall Chibi Combat Character Sheet(1).png',
  'Pixel Art Country Flags Wall Chart(1).png',
  'Pixel-Art Combat Culture Gym Banner(1).png',
  'Player Coach Approved.png',
  'Pudge Student Sprite Sheet(1).png',
  'Radish Student Sprite Sheet(1).png',
];
const sourceFiles = readdirSync(directory).filter(name => name.endsWith('.png'));

test('all 19 approved source-art filenames are present', () => {
  assert.deepEqual([...sourceFiles].sort(), [...expected].sort());
});

test('source artwork is intact PNG data, not empty placeholders', () => {
  for (const name of expected) {
    const bytes = readFileSync(new URL(encodeURIComponent(name), directory));
    assert.ok(bytes.length > 1000, name + ': unexpectedly small');
    assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', name);
    assert.ok(bytes.readUInt32BE(16) > 0 && bytes.readUInt32BE(20) > 0, name);
  }
});

test('uploaded artwork matches the supplied source manifest where listed', () => {
  const manifest = JSON.parse(readFileSync(new URL('manifest.json', directory), 'utf8'));
  assert.ok(Array.isArray(manifest));
  const entries = new Map(manifest.map(item => [item.filename, item]));
  for (const name of expected) {
    const entry = entries.get(name);
    assert.ok(entry, name + ': missing from manifest');
    const bytes = readFileSync(new URL(encodeURIComponent(name), directory));
    assert.equal(bytes.length, entry.bytes, name + ': byte count differs');
    assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256,
      name + ': checksum differs');
  }
});

test('Holly is the approved identity of the sheet also labeled Erin', () => {
  const holly = readFileSync(new URL('Holly%20Approved%20(sheet%20says%20Erin).png', directory));
  const erin = readFileSync(new URL('Erin%20Student%20Pixel%20Sprite%20Sheet(1).png', directory));
  assert.deepEqual(holly, erin);
});
