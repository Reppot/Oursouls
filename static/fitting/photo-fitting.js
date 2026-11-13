import {studioCutout} from '../shared/cutout.js';
const bound=(n,a,b)=>Math.max(a,Math.min(b,n));
export function shoulderAngle(a,b,width,height){
 const [left,right]=a.x<=b.x?[a,b]:[b,a];
 return bound(Math.atan2((right.y-left.y)*height,(right.x-left.x)*width)*180/Math.PI,-45,45);
}
export function createFittingRoom(dialog,studio){
 const q=key=>dialog.querySelector('[data-fit-'+key+']'), canvas=q('photo-canvas'),ctx=canvas.getContext('2d');
 const productNode=dialog.querySelector('#fitting-product'), product=productNode?JSON.parse(productNode.textContent):null;
 let photo=null,garment=null,worker=null,drag=null,revision=0,photoRevision=0,placement={x:50,y:28,scale:65,angle:0};
 const status=text=>q('status').textContent=text;
 function draw(){
  q('photo-empty').hidden=!!photo;canvas.hidden=!photo;q('sliders').hidden=!photo;q('photo-actions').hidden=!photo;q('save').disabled=!photo||!garment;q('auto').disabled=!photo||!garment;
  if(!photo)return;
  canvas.width=photo.width;canvas.height=photo.height;ctx.drawImage(photo,0,0);
  if(garment){const w=photo.width*placement.scale/100,h=w*garment.height/garment.width;ctx.save();ctx.translate(photo.width*placement.x/100,photo.height*placement.y/100);ctx.rotate(placement.angle*Math.PI/180);ctx.drawImage(garment,-w/2,-h*.12,w,h);ctx.restore()}
  for(const key of ['x','y','scale','angle']){const input=dialog.querySelector('[data-fit-adjust="'+key+'"]');if(input)input.value=placement[key];const out=dialog.querySelector('[data-fit-value="'+key+'"]');if(out)out.textContent=Math.round(placement[key])+(key==='angle'?'°':'%')}
 }
 async function updateGarment(){
  const current=++revision;status('Подготавливаем одежду…');
  try{let next;if(product&&q('source')?.value!=='design'){
    const side=q('side').value,url=side==='back'?product.images?.back:product.cutout||product.image;
    if(!url)throw new Error('Фото спины этого изделия пока не добавлено. Выбери перед.');
    if(product.cutout&&side==='front'){const im=new Image();im.crossOrigin='anonymous';im.src=url;await im.decode();next=im}else next=await studioCutout(url);
   }else next=await studio.garment(q('side').value);
   if(current!==revision)return;garment=next;status('Визуальное наложение. Посадку и размер уточним по замерам.');draw();
  }catch(error){if(current===revision){garment=null;status(error.message||'Изображение не загрузилось. Попробуй ещё раз.');draw()}}
 }
 async function load(file){
  if(!file)return;if(file.size>16*1024*1024||!file.type.startsWith('image/'))return status('Выбери фотографию до 16 МБ.');
  const current=++photoRevision,url=URL.createObjectURL(file);status('Открываем фото…');
  try{const im=new Image();im.src=url;await im.decode();if(im.width*im.height>40_000_000)throw new Error('Выбери фото до 40 мегапикселей.');if(current!==photoRevision)return;
   const ratio=Math.min(1,1200/Math.max(im.width,im.height));photo=document.createElement('canvas');photo.width=Math.round(im.width*ratio);photo.height=Math.round(im.height*ratio);photo.getContext('2d').drawImage(im,0,0,photo.width,photo.height);placement={x:50,y:28,scale:65,angle:0};q('file-name').textContent=file.name;draw();await updateGarment();
  }catch(error){status(error.message||'Не удалось открыть фото. Попробуй JPG или PNG.')}finally{URL.revokeObjectURL(url)}
 }
 q('file').onchange=e=>load(e.target.files[0]);q('camera').onchange=e=>load(e.target.files[0]);
 q('side').onchange=updateGarment;if(q('source'))q('source').onchange=updateGarment;
 dialog.querySelectorAll('[data-fit-adjust]').forEach(input=>input.oninput=()=>{placement[input.dataset.fitAdjust]=+input.value;draw()});
 q('reset').onclick=()=>{placement={x:50,y:28,scale:65,angle:0};draw()};
 function clear(){revision++;photoRevision++;worker?.terminate();worker=null;photo=null;garment=null;canvas.width=canvas.height=1;q('file').value='';q('camera').value='';q('file-name').textContent='JPG, PNG или WebP · до 16 МБ';draw()}
 q('clear').onclick=()=>{clear();updateGarment()};dialog.addEventListener('close',clear);
 canvas.onpointerdown=event=>{if(!photo||!garment)return;const rect=canvas.getBoundingClientRect();drag={x:event.clientX,y:event.clientY,px:placement.x,py:placement.y,w:rect.width,h:rect.height};canvas.setPointerCapture(event.pointerId);event.preventDefault()};
 canvas.onpointermove=event=>{if(!drag)return;placement.x=bound(drag.px+(event.clientX-drag.x)/drag.w*100,0,100);placement.y=bound(drag.py+(event.clientY-drag.y)/drag.h*100,0,100);draw()};
 canvas.onpointerup=canvas.onpointercancel=canvas.onlostpointercapture=()=>drag=null;
 q('save').onclick=()=>canvas.toBlob(blob=>{if(!blob)return status('Не удалось подготовить снимок.');const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='our-souls-fitting.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000)});
 q('auto').onclick=async()=>{
  if(!photo)return;const button=q('auto'),current=revision;button.disabled=true;status('Ищем плечи на фотографии…');
  try{const bitmap=await createImageBitmap(photo);const points=await new Promise((resolve,reject)=>{
   worker?.terminate();worker=new Worker(new URL('./pose/worker.js',import.meta.url));const timer=setTimeout(()=>{worker?.terminate();worker=null;reject(new Error('Автоподгонка заняла слишком много времени. Размести одежду вручную.'))},20000);
   worker.onmessage=event=>{clearTimeout(timer);event.data.points?resolve(event.data.points):reject(new Error('Не удалось найти плечи. Размести одежду вручную.'))};worker.onerror=()=>{clearTimeout(timer);reject(new Error('Автоподгонка недоступна. Используй ползунки.'))};worker.postMessage(bitmap,[bitmap]);
  });if(current!==revision)return;const a=points[11],b=points[12];if(!a||!b)throw new Error('Плечи не найдены.');placement.x=(a.x+b.x)*50;placement.y=(a.y+b.y)*50;placement.scale=bound(Math.hypot((a.x-b.x)*photo.width,(a.y-b.y)*photo.height)/photo.width/.62*100,10,155);placement.angle=shoulderAngle(a,b,photo.width,photo.height);status('Проверь положение и при необходимости поправь вручную.');draw();
  }catch(error){if(current===revision)status(error.message)}finally{button.disabled=!photo}
 };
 q('size')?.addEventListener('click',()=>{const chest=+q('chest').value;if(chest<60||chest>160)return q('size-result').textContent='Укажи обхват груди от 60 до 160 см.';const candidates=Object.entries(product?.measurements||{}).filter(([,w])=>w*2-chest>=6).sort((a,b)=>a[1]-b[1]);q('size-result').textContent=candidates.length?'Ориентир — '+candidates[0][0]+'. Проверь остальные замеры.':'Подходящий размер по имеющимся замерам не найден.'});
 return {async open(){q('side').value=studio.side();dialog.showModal();draw();await updateGarment()}};
}
