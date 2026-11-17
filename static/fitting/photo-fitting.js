import {studioCutout} from '../shared/cutout.js';
const bound=(n,a,b)=>Math.max(a,Math.min(b,n));
export function shoulderAngle(a,b,width,height){
 const [left,right]=a.x<=b.x?[a,b]:[b,a];
 return bound(Math.atan2((right.y-left.y)*height,(right.x-left.x)*width)*180/Math.PI,-45,45);
}
export function fitPlacement(points,width,height,aspect,shoulderShare=.52){
 const a=points?.[11],b=points?.[12];
 if(!a||!b||Math.min(a.visibility??1,b.visibility??1)<.55)return null;
 const span=Math.hypot((a.x-b.x)*width,(a.y-b.y)*height);if(span<width*.07)return null;
 const garmentWidth=span/shoulderShare,normalHeight=garmentWidth*aspect;
 const hips=[points[23],points[24]],validHips=hips.every(p=>p&&(p.visibility??1)>.5);
 const torso=validHips?Math.hypot(((hips[0].x+hips[1].x-a.x-b.x)/2)*width,((hips[0].y+hips[1].y-a.y-b.y)/2)*height):normalHeight*.72;
 return {x:bound((a.x+b.x)*50,0,100),y:bound((a.y+b.y)*50,0,100),scale:bound(garmentWidth/width*100,10,155),height:bound(torso/.72/normalHeight*100,60,160),angle:shoulderAngle(a,b,width,height)};
}
function trimGarment(source){
 const c=document.createElement('canvas');c.width=source.width||source.naturalWidth;c.height=source.height||source.naturalHeight;const x=c.getContext('2d');x.drawImage(source,0,0);const p=x.getImageData(0,0,c.width,c.height).data;let l=c.width,t=c.height,r=0,b=0;
 for(let y=0;y<c.height;y++)for(let i=0;i<c.width;i++)if(p[(y*c.width+i)*4+3]>24){l=Math.min(l,i);r=Math.max(r,i);t=Math.min(t,y);b=Math.max(b,y)}
 if(r<=l||b<=t)throw Error('Не удалось выделить одежду.');const out=document.createElement('canvas');out.width=r-l+1;out.height=b-t+1;out.getContext('2d').drawImage(c,l,t,out.width,out.height,0,0,out.width,out.height);return out;
}
export function createFittingRoom(dialog,studio){
 const q=key=>dialog.querySelector('[data-fit-'+key+']'), canvas=q('photo-canvas'),ctx=canvas.getContext('2d');
 const productNode=dialog.querySelector('#fitting-product'), product=productNode?JSON.parse(productNode.textContent):null;
 let photo=null,garment=null,worker=null,drag=null,revision=0,photoRevision=0,placement={x:50,y:28,scale:65,height:100,angle:0};
 let posePoints=null,armsLayer=null,poseBusy=false,poseRun=0,pendingCancel=null;
 const status=text=>q('status').textContent=text;
 function draw(){
  q('photo-empty').hidden=!!photo;canvas.hidden=!photo;q('sliders').hidden=!photo;q('photo-actions').hidden=!photo;q('save').disabled=!photo||!garment;q('auto').disabled=!photo||!garment||poseBusy;
  if(!photo)return;
  canvas.width=photo.width;canvas.height=photo.height;ctx.drawImage(photo,0,0);
  if(garment){const w=photo.width*placement.scale/100,h=w*garment.height/garment.width*placement.height/100;ctx.save();ctx.translate(photo.width*placement.x/100,photo.height*placement.y/100);ctx.rotate(placement.angle*Math.PI/180);ctx.drawImage(garment,-w/2,-h*.14,w,h);ctx.restore();restoreArms()}
  for(const key of ['x','y','scale','height','angle']){const input=dialog.querySelector('[data-fit-adjust="'+key+'"]');if(input)input.value=placement[key];const out=dialog.querySelector('[data-fit-value="'+key+'"]');if(out)out.textContent=Math.round(placement[key])+(key==='angle'?'°':'%')}
 }
 function restoreArms(){if(armsLayer&&q('arms')?.checked)ctx.drawImage(armsLayer,0,0)}
 function prepareArms(){
  armsLayer=null;if(!posePoints?.[0])return;
  const region=document.createElement('canvas');region.width=photo.width;region.height=photo.height;const rc=region.getContext('2d');
  const shoulder=Math.hypot((posePoints[11].x-posePoints[12].x)*photo.width,(posePoints[11].y-posePoints[12].y)*photo.height),radius=shoulder*.09;
  rc.strokeStyle=rc.fillStyle='#fff';rc.lineWidth=radius*2;rc.lineCap='round';
  for(const [elbow,wrist]of [[13,15],[14,16]]){const a=posePoints[elbow],b=posePoints[wrist];if(!a||!b||Math.min(a.visibility??0,b.visibility??0)<.6)continue;rc.beginPath();rc.moveTo(a.x*photo.width,a.y*photo.height);rc.lineTo(b.x*photo.width,b.y*photo.height);rc.stroke();for(const index of [wrist,wrist+2,wrist+4,wrist+6]){const p=posePoints[index];if(!p||(p.visibility??0)<.5)continue;rc.beginPath();rc.arc(p.x*photo.width,p.y*photo.height,radius,0,Math.PI*2);rc.fill()}}
  const original=photo.getContext('2d').getImageData(0,0,photo.width,photo.height),mask=rc.getImageData(0,0,photo.width,photo.height),nose=posePoints[0];
  const tones=[];for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++){const x=bound(Math.round(nose.x*photo.width)+dx,0,photo.width-1),y=bound(Math.round(nose.y*photo.height)+dy,0,photo.height-1),i=(y*photo.width+x)*4;const sum=original.data[i]+original.data[i+1]+original.data[i+2];if(sum>40)tones.push([original.data[i]/sum,original.data[i+1]/sum,original.data[i+2]/sum])}
  if(!tones.length)return;const tone=[0,1,2].map(k=>tones.map(t=>t[k]).sort((a,b)=>a-b)[Math.floor(tones.length/2)]);
  for(let i=0;i<original.data.length;i+=4){const sum=original.data[i]+original.data[i+1]+original.data[i+2];const distance=sum?Math.hypot(original.data[i]/sum-tone[0],original.data[i+1]/sum-tone[1],original.data[i+2]/sum-tone[2]):1;original.data[i+3]=mask.data[i+3]&&sum>40?Math.round(mask.data[i+3]*bound((.09-distance)/.025,0,1)):0}
  rc.putImageData(original,0,0);armsLayer=region;
 }
 function stopPose(){poseRun++;worker?.terminate();worker=null;poseBusy=false;pendingCancel?.();pendingCancel=null}
 async function updateGarment(){
  const current=++revision;status('Подготавливаем одежду…');
  try{let next;if(product&&q('source')?.value!=='design'){
    const side=q('side').value,url=side==='back'?product.images?.back:product.cutout||product.image;
    if(!url)throw new Error('Фото спины этого изделия пока не добавлено. Выбери перед.');
    if(product.cutout&&side==='front'){const im=new Image();im.crossOrigin='anonymous';im.src=url;await im.decode();next=im}else next=await studioCutout(url);
   }else next=await studio.garment(q('side').value);
   if(current!==revision)return;garment=trimGarment(next);status('Визуальное наложение. Посадку и размер уточним по замерам.');draw();
  }catch(error){if(current===revision){garment=null;status(error.message||'Изображение не загрузилось. Попробуй ещё раз.');draw()}}
 }
 async function load(file){
  if(!file)return;if(file.size>16*1024*1024||!file.type.startsWith('image/'))return status('Выбери фотографию до 16 МБ.');
  stopPose();revision++;const current=++photoRevision,url=URL.createObjectURL(file);status('Открываем фото…');
  try{const im=new Image();im.src=url;await im.decode();if(im.width*im.height>40_000_000)throw new Error('Выбери фото до 40 мегапикселей.');if(current!==photoRevision)return;
   const ratio=Math.min(1,1200/Math.max(im.width,im.height));posePoints=null;armsLayer=null;photo=document.createElement('canvas');photo.width=Math.round(im.width*ratio);photo.height=Math.round(im.height*ratio);photo.getContext('2d').drawImage(im,0,0,photo.width,photo.height);placement={x:50,y:28,scale:65,height:100,angle:0};q('file-name').textContent=file.name;draw();await updateGarment();await locatePose();
  }catch(error){status(error.message||'Не удалось открыть фото. Попробуй JPG или PNG.')}finally{URL.revokeObjectURL(url)}
 }
 q('file').onchange=e=>load(e.target.files[0]);q('camera').onchange=e=>load(e.target.files[0]);
 q('side').onchange=updateGarment;if(q('source'))q('source').onchange=updateGarment;
 dialog.querySelectorAll('[data-fit-adjust]').forEach(input=>input.oninput=()=>{placement[input.dataset.fitAdjust]=+input.value;draw()});
 q('reset').onclick=()=>{placement={x:50,y:28,scale:65,height:100,angle:0};draw()};
 function clear(){revision++;photoRevision++;stopPose();photo=null;garment=null;posePoints=null;armsLayer=null;poseBusy=false;canvas.width=canvas.height=1;q('file').value='';q('camera').value='';q('file-name').textContent='JPG, PNG или WebP · до 16 МБ';draw()}
 q('clear').onclick=()=>{clear();updateGarment()};dialog.addEventListener('close',clear);
 canvas.onpointerdown=event=>{if(!photo||!garment)return;const rect=canvas.getBoundingClientRect();drag={x:event.clientX,y:event.clientY,px:placement.x,py:placement.y,w:rect.width,h:rect.height};canvas.setPointerCapture(event.pointerId);event.preventDefault()};
 canvas.onpointermove=event=>{if(!drag)return;placement.x=bound(drag.px+(event.clientX-drag.x)/drag.w*100,0,100);placement.y=bound(drag.py+(event.clientY-drag.y)/drag.h*100,0,100);draw()};
 canvas.onpointerup=canvas.onpointercancel=canvas.onlostpointercapture=()=>drag=null;
 q('save').onclick=()=>canvas.toBlob(blob=>{if(!blob)return status('Не удалось подготовить снимок.');const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='our-souls-fitting.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000)});
 async function locatePose(){
  if(!photo||!garment||poseBusy)return;const button=q('auto'),current=revision,run=++poseRun;poseBusy=true;button.disabled=true;status('Ищем плечи на фотографии…');
  try{const bitmap=await createImageBitmap(photo);const points=await new Promise((resolve,reject)=>{
   worker?.terminate();worker=new Worker(new URL('./pose/worker.js',import.meta.url));const timer=setTimeout(()=>{worker?.terminate();worker=null;reject(new Error('Автоподгонка заняла слишком много времени. Размести одежду вручную.'))},30000);pendingCancel=()=>{clearTimeout(timer);reject(new Error('Отменено'))};
   worker.onmessage=event=>{clearTimeout(timer);event.data.points?resolve(event.data.points):reject(new Error('Не удалось найти плечи. Размести одежду вручную.'))};worker.onerror=()=>{clearTimeout(timer);reject(new Error('Автоподгонка недоступна. Используй ползунки.'))};worker.postMessage(bitmap,[bitmap]);
  });if(current!==revision||!dialog.open)return;const next=fitPlacement(points,photo.width,photo.height,garment.height/garment.width);if(!next)throw new Error('Плечи не видны достаточно чётко. Выбери фото анфас или подгони вручную.');posePoints=points;prepareArms();placement=next;status('Подогнано по плечам и длине торса. Это 2D-совмещение; сложную посадку уточни вручную.');draw();
  }catch(error){if(current===revision)status(error.message)}finally{if(run===poseRun){pendingCancel=null;poseBusy=false;button.disabled=!photo||!garment}}
 }
 q('auto').onclick=locatePose;if(q('arms'))q('arms').onchange=draw;

 q('size')?.addEventListener('click',()=>{const chest=+q('chest').value;if(chest<60||chest>160)return q('size-result').textContent='Укажи обхват груди от 60 до 160 см.';const candidates=Object.entries(product?.measurements||{}).filter(([,w])=>w*2-chest>=6).sort((a,b)=>a[1]-b[1]);q('size-result').textContent=candidates.length?'Ориентир — '+candidates[0][0]+'. Проверь остальные замеры.':'Подходящий размер по имеющимся замерам не найден.'});
 return {async open(){q('side').value=studio.side();dialog.showModal();draw();await updateGarment()}};
}
