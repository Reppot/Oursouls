import test from 'node:test';
import assert from 'node:assert/strict';
import {createHistory} from '../static/studio/history.mjs';
test('undo restores layers and redo is discarded after a new edit',()=>{const h=createHistory();h.push({layers:[1]});h.push({layers:[]});assert.deepEqual(h.undo(),{layers:[1]});assert.deepEqual(h.redo(),{layers:[]});h.undo();h.push({layers:[1,2]});assert.equal(h.redo(),null)});
test('history caps actions and ignores repeated snapshots',()=>{const h=createHistory(2);for(let i=0;i<5;i++)h.push({i});assert.equal(h.push({i:4}),false);assert.equal(h.undo().i,3);assert.equal(h.undo().i,2);assert.equal(h.undo(),null)});
