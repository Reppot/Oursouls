import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceRack,wheelDistance} from '../static/rack/motion.mjs';
test('rapid wheel input cannot create a jump or unbounded speed',()=>{
 assert.ok(wheelDistance(120)<.3);assert.equal(wheelDistance(12000),wheelDistance(180));
 const next=advanceRack(0,50,16.67);assert.ok(next>0&&next<=2.6*.01667);
});
test('damping approaches a garment monotonically without overshoot',()=>{
 let value=0;for(let i=0;i<300;i++){const next=advanceRack(value,1,16.67);assert.ok(next>=value&&next<=1);value=next}assert.ok(Math.abs(value-1)<.0005);
});
test('motion speed is comparable at 60 and 120 frames per second',()=>{
 let a=0,b=0;for(let i=0;i<60;i++)a=advanceRack(a,20,1000/60);for(let i=0;i<120;i++)b=advanceRack(b,20,1000/120);assert.ok(Math.abs(a-b)<.01);
});
