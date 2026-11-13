import test from 'node:test';
import assert from 'node:assert/strict';
import {buildOrder} from '../static/studio/order-export.js';
import {importDesignArchive} from '../static/studio/project-import.js';
test('own archive roundtrip preserves position, effects and original bytes',async()=>{
 const state={id:'demo',version:7,garment:'tee',color:'#202321',size:'M',quantity:1,comment:'test',side:'front',tab:'print',selected:{front:1,back:null},nextId:1,layers:{front:[{id:1,assetId:'art',name:'print.png',x:250,y:300,scale:65,angle:15,effects:{mode:'original'}}],back:[]}};
 const {blob}=await buildOrder([],[{id:'demo',name:'tee',snapshot:state,exportFiles:[{path:'prints/front-1.png',blob:new Blob(['original'])}]}]);
 const [project]=await importDesignArchive(blob);
 assert.equal(project.state.layers.front[0].angle,15);
 assert.equal(await project.sources[0][1].text(),'original');
});
test('arbitrary archives and broken inputs are rejected',async()=>{await assert.rejects(importDesignArchive(new Blob(['not zip'])),/архив/)});
