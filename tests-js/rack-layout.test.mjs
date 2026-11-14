import test from 'node:test';
import assert from 'node:assert/strict';
import {rackLayout,clampPhase} from '../static/rack/layout.mjs';
test('rack recedes along a straight rail with decreasing scale',()=>{
 const first=rackLayout(0,0,900,650),middle=rackLayout(3,0,900,650),last=rackLayout(7,0,900,650);
 assert.ok(first.scale>middle.scale&&middle.scale>last.scale);
 assert.ok(first.x<middle.x&&middle.x<last.x);
 assert.ok(first.y<middle.y&&middle.y<last.y);
 assert.ok(Math.abs((middle.y-first.y)/(middle.x-first.x)-(last.y-first.y)/(last.x-first.x))<1e-8);
});
test('scroll brings the next garment into the same front position',()=>{
 const before=rackLayout(0,0,900,650),after=rackLayout(4,4,900,650);
 assert.equal(before.x,after.x);assert.equal(before.y,after.y);assert.equal(before.scale,after.scale);
 assert.equal(clampPhase(-2,8),0);assert.equal(clampPhase(20,8),7);
});
test('mobile front garment fits and passed garments are hidden',()=>{
 const front=rackLayout(0,0,360,480);
 assert.ok(front.pieceWidth<360);
 assert.ok(front.x-front.hookX>=-5);
 assert.equal(rackLayout(0,2,360,480).opacity,0);
});
test('foreground garment stays inside the scene when selected',()=>{
 for(const [width,height] of [[600,1000],[900,733],[1440,790]]){
  const front=rackLayout(0,0,width,height,{picked:true});
  assert.ok(front.x-front.hookX*front.scale>=0);
 }
});
