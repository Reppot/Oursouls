const decoder=new TextDecoder();
export async function importDesignArchive(blob){
 if(blob.size>256*1024*1024)throw new Error('Архив больше 256 МБ. Открой отдельный проект.');
 const buffer=await blob.arrayBuffer(),v=new DataView(buffer),files=new Map();let at=0,total=0;
 while(at+4<=v.byteLength&&v.getUint32(at,true)===0x04034b50){
  if(at+30>v.byteLength)throw new Error('Архив повреждён.');
  const flags=v.getUint16(at+6,true),method=v.getUint16(at+8,true),length=v.getUint32(at+18,true),unpacked=v.getUint32(at+22,true),nameLength=v.getUint16(at+26,true),extra=v.getUint16(at+28,true);
  if(flags&9||method!==0||length!==unpacked)throw new Error('Открой ZIP, созданный конструктором Our Souls, без перепаковки.');
  const start=at+30+nameLength+extra,end=start+length;
  if(end>v.byteLength||files.size>=256||(total+=length)>256*1024*1024)throw new Error('Некорректный размер архива.');
  const name=decoder.decode(new Uint8Array(buffer,at+30,nameLength));
  if(name.startsWith('/')||name.includes('..')||name.includes('\\')||!name||files.has(name))throw new Error('Некорректный путь в архиве.');
  files.set(name,new Blob([buffer.slice(start,end)]));at=end;
 }
 if(!files.size)throw new Error('Не удалось прочитать архив Our Souls.');
 const projects=[];
 for(const [path,file] of files){
  if(!/^designs\/[a-zA-Z0-9-]+\/design\.json$/.test(path))continue;
  const state=JSON.parse(await file.text()),base=path.slice(0,-'design.json'.length);projects.push(await restore(state,base,files));
 }
 if(!projects.length&&files.has('order.json')){
  const old=JSON.parse(await files.get('order.json').text());
  if(old.version===6&&old.sides){const state={id:crypto.randomUUID(),version:7,garment:old.garmentId,color:old.colorHex,size:old.size,quantity:old.quantity,comment:old.comment||'',side:'front',tab:'print',selected:{front:null,back:null},nextId:0,layers:{front:[],back:[]}};const sources=[];
   for(const side of ['front','back'])for(const l of old.sides[side]||[]){const id=++state.nextId,assetId=crypto.randomUUID(),file=files.get(l.source);if(!file||file.size>20*1024*1024)throw new Error('Исходник отсутствует или больше 20 МБ.');sources.push([assetId,new File([file],String(l.fileName||'print.png'),{type:l.source.endsWith('.jpg')?'image/jpeg':'image/png'})]);state.layers[side].push({...l,id,assetId,name:l.fileName||'Принт',effects:l.effects});state.selected[side]=id;}validate(state);projects.push({state,sources});}
 }
 if(!projects.length)throw new Error('В архиве нет редактируемого макета.');
 return projects;
}
function validate(s){

 if(s.version!==7||!['tee','long','hoodie'].includes(s.garment)||!/^#[a-fA-F0-9]{6}$/.test(s.color)||!['S','M','L','XL','2XL','3XL'].includes(s.size))throw new Error('Неподдерживаемые параметры проекта.');
 const layers=[...(s.layers?.front||[]),...(s.layers?.back||[])];if(layers.length>10)throw new Error('В проекте больше 10 принтов.');
 if(!Number.isFinite(+s.quantity)||+s.quantity<1||+s.quantity>9999)throw new Error('Некорректное количество.');
 for(const layer of layers){if(!['x','y','scale','angle'].every(k=>Number.isFinite(layer[k]))||layer.scale<15||layer.scale>160||Math.abs(layer.angle)>180||!layer.effects)throw new Error('Некорректное положение принта.');}
 const ids=layers.map(l=>l.id);if(ids.some(id=>!Number.isInteger(id)||id<1)||new Set(ids).size!==ids.length)throw new Error('Некорректные слои проекта.');
 const defaults={mode:'original',tint:'#e85a65',from:'#355d31',to:'#9b2f45',gradientType:'linear',gradientAngle:90,amount:100,brightness:100,contrast:100,saturation:100,opacity:100,flipX:false,flipY:false};
 for(const layer of layers){
  if(typeof layer.assetId!=='string'||layer.assetId.length>80)throw new Error('Некорректный исходник принта.');
  const e={...defaults,...layer.effects};if(!['original','solid','gradient'].includes(e.mode)||!['linear','radial'].includes(e.gradientType)||!['tint','from','to'].every(k=>/^#[a-fA-F0-9]{6}$/.test(e[k])))throw new Error('Некорректные цвета принта.');
  for(const [key,max] of Object.entries({gradientAngle:360,amount:100,brightness:200,contrast:200,saturation:200,opacity:100}))if(!Number.isFinite(e[key])||e[key]<0||e[key]>max)throw new Error('Некорректные эффекты принта.');
  layer.effects=Object.fromEntries(Object.keys(defaults).map(k=>[k,e[k]]));layer.name=String(layer.name||'Принт').slice(0,150);
 }
 s.selected={front:s.layers.front.at(-1)?.id??null,back:s.layers.back.at(-1)?.id??null};s.nextId=Math.max(0,...ids);
 if(!/^[a-zA-Z0-9-]{1,80}$/.test(s.id||''))s.id=crypto.randomUUID();
 s.side=['front','back'].includes(s.side)?s.side:'front';s.tab='print';s.comment=String(s.comment||'').slice(0,1000);
}
async function restore(state,base,files){
 validate(state);const sources=[];
 for(const side of ['front','back'])for(const [i,layer] of state.layers[side].entries()){
  const prefix=base+'prints/'+side+'-'+(i+1),path=files.has(prefix+'.png')?prefix+'.png':prefix+'.jpg',file=files.get(path);
  if(!file||file.size>20*1024*1024)throw new Error('Отсутствует исходник или он больше 20 МБ.');
  sources.push([layer.assetId,new File([file],String(layer.name||'print.png'),{type:path.endsWith('.jpg')?'image/jpeg':'image/png'})]);
 }
 return {state,sources};
}
