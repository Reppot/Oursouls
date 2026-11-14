import test from 'node:test';
import assert from 'node:assert/strict';
import {removeBackdrop} from '../static/shared/backdrop-mask.mjs';

test('white fabric and its print survive on a grey studio backdrop',()=>{
 const w=60,h=80,p=new Uint8ClampedArray(w*h*4);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const at=(y*w+x)*4,bg=190+y*.3;
  const cloth=x>=12&&x<48&&y>=10&&y<70;
  p.set(cloth?[238,238,235,255]:[bg,bg,bg,255],at);
 }
 p.set([200,15,25,255],(40*w+30)*4);
 const removed=removeBackdrop(p,w,h);
 assert.ok(removed>w*h*.3);
 assert.equal(p[(35*w+20)*4+3],255);
 assert.equal(p[(40*w+30)*4+3],255);
 assert.equal(p[(5*w+5)*4+3],0);
});
test('backdrop-coloured artwork enclosed by fabric is kept intact',()=>{
 const w=30,h=40,p=new Uint8ClampedArray(w*h*4);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++)p.set(x>5&&x<25&&y>5&&y<35?[20,24,22,255]:[220,220,220,255],(y*w+x)*4);
 p.set([220,220,220,255],(20*w+15)*4);
 removeBackdrop(p,w,h);
 assert.equal(p[(20*w+15)*4+3],255);
 assert.equal(p[3],0);
});
