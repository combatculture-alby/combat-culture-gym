import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// Prevent a connector/API edit from silently duplicating or truncating
// the monolithic Phaser scene before the TypeScript compiler starts.
const source=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8');
const lines=source.split('\n');
assert.ok(source.length>170000&&source.length<240000,
  'Main scene size is unexpected; inspect for truncation or duplicate content');
assert.ok(lines.length>3000&&lines.length<4000,
  'Main scene line count is unexpected; inspect for malformed edits');
for(const anchor of [
  'private nextDay():void',
  'private openClassSchedule():void',
  'private openExpansion():void',
  'private confirmNewGym():void',
  'private advanceGymPhase():void'
]){
  assert.equal(source.split(anchor).length-1,1,
    'Expected exactly one '+anchor+' in main scene');
}
assert.ok(!source.includes("'BASE \\n"),
  'Main scene contains a broken class preview string');
console.log('Main scene integrity verified ('+lines.length+' lines).');
