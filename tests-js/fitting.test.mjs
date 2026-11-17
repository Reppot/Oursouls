import test from 'node:test';
import assert from 'node:assert/strict';
import {shoulderAngle,fitPlacement} from '../static/fitting/photo-fitting.js';
test('shoulder slope does not depend on anatomical landmark order',()=>{const a={x:.7,y:.3},b={x:.3,y:.4};assert.ok(shoulderAngle(a,b,100,100)<0);assert.equal(shoulderAngle(a,b,100,100),shoulderAngle(b,a,100,100));assert.equal(shoulderAngle({x:.2,y:.5},{x:.8,y:.5},100,100),0)});

test('fitting uses shoulders for width and visible hips for garment length',()=>{
 const p=[];p[11]={x:.3,y:.3,visibility:1};p[12]={x:.7,y:.3,visibility:1};p[23]={x:.35,y:.7,visibility:1};p[24]={x:.65,y:.7,visibility:1};
 const f=fitPlacement(p,600,1000,1.3);assert.equal(f.x,50);assert.equal(f.y,30);assert.equal(f.angle,0);assert.ok(f.scale>70&&f.scale<90);assert.ok(f.height>80&&f.height<110);
 p[11].visibility=.2;assert.equal(fitPlacement(p,600,1000,1.3),null);
});
test('missing hips keeps natural length and reversed shoulder order keeps the same fitting',()=>{
 const p=[];p[11]={x:.7,y:.3,visibility:1};p[12]={x:.3,y:.3,visibility:1};const f=fitPlacement(p,600,1000,1.3);assert.equal(f.height,100);assert.equal(f.angle,0);
});
