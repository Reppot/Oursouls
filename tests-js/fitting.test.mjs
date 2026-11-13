import test from 'node:test';
import assert from 'node:assert/strict';
import {shoulderAngle} from '../static/fitting/photo-fitting.js';
test('shoulder slope does not depend on anatomical landmark order',()=>{const a={x:.7,y:.3},b={x:.3,y:.4};assert.ok(shoulderAngle(a,b,100,100)<0);assert.equal(shoulderAngle(a,b,100,100),shoulderAngle(b,a,100,100));assert.equal(shoulderAngle({x:.2,y:.5},{x:.8,y:.5},100,100),0)});
