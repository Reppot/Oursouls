import test from 'node:test';
import assert from 'node:assert/strict';
import {validatePrintFile} from '../static/studio/image-info.mjs';
function png(width,height){const b=new ArrayBuffer(24),v=new DataView(b);v.setUint32(0,0x89504e47);v.setUint32(4,0x0d0a1a0a);v.setUint32(16,width);v.setUint32(20,height);return new Blob([b])}
test('rejects oversized dimensions before image decoding',async()=>{await assert.rejects(validatePrintFile(png(50000,50000)),/40 мегапикселей/);assert.deepEqual(await validatePrintFile(png(4000,3000)),{width:4000,height:3000})});
test('rejects arbitrary data with a misleading filename',async()=>{await assert.rejects(validatePrintFile(new Blob(['not a picture'])),/PNG\/JPEG/)});
