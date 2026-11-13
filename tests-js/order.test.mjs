import test from 'node:test';
import assert from 'node:assert/strict';
import {orderManifest,buildOrder} from '../static/studio/order-export.js';
test('unknown price and custom designs never produce a false total',()=>{assert.equal(orderManifest([{price:null,quantity:2}],[]).total,null);assert.equal(orderManifest([{price:10000,quantity:2}],[]).total,20000);assert.equal(orderManifest([{price:10000,quantity:2}],[{id:'one',snapshot:{}}]).total,null)});
test('archive rejects path traversal',async()=>{await assert.rejects(buildOrder([],[{id:'valid',snapshot:{},exportFiles:[{path:'../private.png',blob:new Blob()}]}]),/путь/)});
test('personal fitting photo is absent from manifest',()=>{const data=orderManifest([],[{id:'one',snapshot:{layers:{front:[],back:[]}}}]);assert.equal('photo' in data,false);assert.equal('photo' in data.designs[0],false)});
