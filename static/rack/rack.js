import {studioCutout} from '../shared/cutout.js';
import {rackLayout,clampPhase} from './layout.mjs';

const root=document.querySelector('[data-rack]');
if(root?.querySelector('[data-rack-data]')){
 const products=JSON.parse(root.querySelector('[data-rack-data]').textContent);
 const pieces=[...root.querySelectorAll('[data-rack-index]')],track=root.querySelector('.rack-track');
 const q=name=>root.querySelector('[data-rack-'+name+']');
 const form=q('form'),large=q('large'),zoom=root.querySelector('.rack-zoom'),rail=root.querySelector('.rack-rail');
 const reduced=matchMedia('(prefers-reduced-motion: reduce)'),mobile=matchMedia('(max-width: 700px)');
 const variants=new Map(),sizes=new Map();let detailsKey='';
 let phase=0,visualPhase=0,animation=null,previewIndex=0,hovered=-1,picked=false,width=0,height=0,frame=0,drag=null,wheelTimer,suppressClick=false;

 if(!q('return')){const button=document.createElement('button');button.type='button';button.className='rack-return';button.dataset.rackReturn='';button.textContent='← Вернуть на вешалку';button.hidden=true;root.querySelector('.rack-wardrobe').append(button)}
 if(!q('description')){const paragraph=document.createElement('p');paragraph.className='rack-description';paragraph.dataset.rackDescription='';q('price').after(paragraph)}
 const back=q('return');root.querySelector('.rack-navigation').insertBefore(back,root.querySelector('.rack-navigation p'));
 if(!q('gallery')){const gallery=document.createElement('div');gallery.className='rack-gallery';gallery.dataset.rackGallery='';gallery.setAttribute('role','group');gallery.setAttribute('aria-label','Фотографии изделия');q('description').after(gallery)}
 root.dataset.enhanced='true';root.classList.add('is-depth');track.prepend(rail);
 const detail=root.querySelector('.rack-detail'),placeholder=document.createComment('rack detail');detail.before(placeholder);
 const dialog=document.createElement('dialog');dialog.className='rack-mobile-detail';dialog.setAttribute('aria-label','Выбранная вещь');
 const close=document.createElement('button');close.type='button';close.className='rack-mobile-close';close.setAttribute('aria-label','Закрыть просмотр');close.textContent='×';dialog.append(close);root.append(dialog);
 const returnToRack=()=>{picked=false;hovered=-1;placeholder.after(detail);schedule();track.focus({preventScroll:true})};close.onclick=()=>dialog.close();dialog.addEventListener('close',returnToRack);const returnButton=document.createElement('button');returnButton.type='button';returnButton.className='button rack-dialog-return';returnButton.textContent='Вернуться к вешалке';returnButton.onclick=()=>dialog.close();dialog.append(returnButton);
 mobile.addEventListener('change',()=>{if(!mobile.matches&&dialog.open)dialog.close();schedule()});

 async function photo(image,url,isCutout=false){
  image.dataset.source=url;image.src=url;
  try{if(!isCutout){const canvas=await studioCutout(url,1000);if(image.dataset.source!==url)return;image.src=canvas.toDataURL('image/webp',.91)}image.classList.add('is-cutout');}
  catch{if(image.dataset.source!==url)return;image.classList.remove('is-cutout');}
  image.closest('.rack-piece')?.classList.add('is-ready');
 }
 function preparePiece(i,variant=products[i].variants[0]){
  const image=pieces[i].querySelector('[data-rack-photo]');if(image.dataset.variant===variant.id)return;image.dataset.variant=variant.id;photo(image,variant.rack_image||variant.images.front,!!variant.rack_image);
 }
 function updateDetails(i){
  previewIndex=i;const product=products[i];
  const variant=product.variants.find(v=>v.id===variants.get(product.id))||product.variants.find(v=>v.availability!=='unavailable')||product.variants[0];
  variants.set(product.id,variant.id);preparePiece(i,variant);const key=i+':'+variant.id;if(detailsKey===key)return;detailsKey=key;
  q('name').textContent=product.name;q('category').textContent=product.category;q('description').textContent='';
  const price=product.sale_price??product.price;
  q('price').textContent=price==null?'Цена по запросу':new Intl.NumberFormat('ru-RU',{style:'currency',currency:'RUB',maximumFractionDigits:0}).format(price/100);
  const photos=[variant.images.front,variant.images.back,...(variant.images.details||[])].filter(Boolean);
  q('gallery').replaceChildren(...(photos.length>1?photos.map((url,n)=>{const button=document.createElement('button');button.type='button';button.setAttribute('aria-label','Фото '+(n+1));button.setAttribute('aria-pressed',String(n===0));const image=document.createElement('img');image.src=url;image.loading='lazy';image.alt='';button.append(image);button.onclick=()=>{large.dataset.source=url;large.src=url;large.alt=product.name+', фото '+(n+1);q('gallery').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b===button)))};return button}):[]));
  const image=variant.rack_image||variant.images.front;large.alt=product.name;photo(large,image,!!variant.rack_image);
  form.elements.id.value=product.id;form.elements.variant_id.value=variant.id;q('color-name').textContent=variant.color_name;
  q('colors').replaceChildren(...product.variants.map(v=>{
   const button=document.createElement('button');button.type='button';button.title=v.color_name;button.setAttribute('aria-label',v.color_name);button.setAttribute('aria-pressed',String(v.id===variant.id));button.style.setProperty('--swatch',v.color_hex||'#777');button.disabled=v.availability==='unavailable';
   button.onclick=()=>{variants.set(product.id,v.id);updateDetails(i)};return button;
  }));
  const saved=sizes.get(product.id)||'';form.elements.size.replaceChildren(new Option('Выбрать размер',''),...variant.sizes.map(size=>new Option(size,size)));
  if(variant.sizes.includes(saved))form.elements.size.value=saved;
  q('add').disabled=!product.available||variant.availability==='unavailable';q('link').href='/product/'+encodeURIComponent(product.slug)+'/?variant='+encodeURIComponent(variant.id);
 }
 form.elements.size.addEventListener('change',()=>sizes.set(products[previewIndex].id,form.elements.size.value));

 function layout(now){
  frame=0;if(!width||!height)return;
  if(drag?.moved||reduced.matches){visualPhase=phase;animation=null}
  else if(animation){const progress=Math.min(1,Math.max(0,(now-animation.start)/620));visualPhase=animation.from+(animation.to-animation.from)*(1-Math.pow(1-progress,4));if(progress===1)animation=null}
  else visualPhase=phase;
  root.classList.toggle('is-moving',!!animation);
  const front=rackLayout(0,0,width,height),slope=front.stepY/front.stepX;
  const startX=front.x-width*.35,startY=front.y-width*.35*slope,length=width*1.28;
  rail.style.cssText=`left:${startX}px;top:${startY}px;width:${length}px;transform:rotate(${Math.atan(slope)*180/Math.PI}deg)`;
  track.style.setProperty('--piece-width',front.pieceWidth+'px');
  const nearest=Math.round(phase);
  pieces.forEach((piece,i)=>{
   const point=rackLayout(i,visualPhase,width,height,{hovered:i===hovered,picked:picked&&i===nearest});
   piece.style.transform=`translate3d(${point.x}px,${point.y}px,0) rotate(${point.angle}deg) scale(${point.scale}) translate(${-point.hookX}px,${-point.hookY}px)`;
   piece.style.opacity=point.opacity*(picked&&i!==nearest?0:1);piece.style.zIndex=point.zIndex;
   piece.style.pointerEvents=point.opacity<.1||(picked&&i!==nearest)?'none':'auto';piece.tabIndex=point.opacity<.1||(picked&&i!==nearest)?-1:0;
   piece.classList.toggle('is-selected',i===nearest);piece.setAttribute('aria-current',String(i===nearest));
   if(point.opacity>0&&i>=Math.floor(phase)&&i<=Math.floor(phase)+6)preparePiece(i,products[i].variants.find(v=>v.id===variants.get(products[i].id))||products[i].variants[0]);
  });
  const count=`${nearest+1} / ${products.length}`;if(q('count').textContent!==count)q('count').textContent=count;q('prev').disabled=nearest===0;q('next').disabled=nearest===products.length-1;
  q('return').hidden=!picked;root.classList.toggle('has-picked',picked);if(animation)frame=requestAnimationFrame(layout);
 }
 function schedule(){if(!frame)frame=requestAnimationFrame(layout)}
 function go(value,{choose=true}={}){
  phase=clampPhase(value,products.length);animation=reduced.matches||Math.abs(phase-visualPhase)<.001?null:{from:visualPhase,to:phase,start:performance.now()};hovered=-1;picked=false;
  if(choose)updateDetails(Math.round(phase));schedule();
 }
 const observer=new ResizeObserver(entries=>{width=entries[0].contentRect.width;height=entries[0].contentRect.height;schedule()});observer.observe(track);
 q('prev').onclick=()=>go(Math.round(phase)-1);q('next').onclick=()=>go(Math.round(phase)+1);
 q('return').onclick=()=>{if(dialog.open)dialog.close();else returnToRack()};

 pieces.forEach((piece,i)=>{
  piece.addEventListener('mouseenter',()=>{if(!mobile.matches&&!drag&&!picked){hovered=i;updateDetails(i);schedule()}});

  piece.addEventListener('focus',()=>{if(!drag&&!dialog.open){hovered=mobile.matches?-1:i;updateDetails(i);schedule()}});
  piece.addEventListener('click',event=>{
   event.preventDefault();if(suppressClick)return;go(i);hovered=-1;
   picked=false;dialog.insertBefore(detail,returnButton);if(!dialog.open)dialog.showModal();schedule();
  });
 });
 track.addEventListener('mouseleave',()=>{if(!drag&&!picked){hovered=-1;schedule()}});
 track.addEventListener('keydown',event=>{
  if(event.target===track&&(event.key==='Enter'||event.key===' ')){event.preventDefault();pieces[Math.round(phase)]?.click();return}
  if(event.key==='Escape'&&picked){picked=false;schedule();return}
  const next={ArrowLeft:Math.round(phase)-1,ArrowRight:Math.round(phase)+1,Home:0,End:products.length-1}[event.key];
  if(next!==undefined){event.preventDefault();go(next);track.focus({preventScroll:true})}
 });
 track.addEventListener('pointerdown',event=>{
  if(event.button!==0)return;
  phase=visualPhase;animation=null;root.classList.remove('is-moving');
  drag={id:event.pointerId,x:event.clientX,y:event.clientY,phase,lastX:event.clientX,lastTime:event.timeStamp,velocity:0,moved:false};
 });
 track.addEventListener('pointermove',event=>{
  if(!drag||event.pointerId!==drag.id)return;
  const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
  if(!drag.moved){if(Math.max(Math.abs(dx),Math.abs(dy))<7)return;drag.axis=Math.abs(dy)>Math.abs(dx)?'y':'x';drag.moved=true;track.setPointerCapture(event.pointerId);root.classList.add('is-dragging');hovered=-1;picked=false;}
  event.preventDefault();const position=drag.axis==='y'?event.clientY:event.clientX;const previous=drag.axis==='y'?(drag.lastY??drag.y):drag.lastX;const dt=Math.max(1,event.timeStamp-drag.lastTime);drag.velocity=(previous-position)/dt;drag.lastX=event.clientX;drag.lastY=event.clientY;drag.lastTime=event.timeStamp;
  phase=clampPhase(drag.phase-(drag.axis==='y'?dy:dx)/Math.max(70,width*.19),products.length);updateDetails(Math.round(phase));schedule();
 });
 function release(event){
  if(!drag||event.pointerId!==drag.id)return;const state=drag;drag=null;root.classList.remove('is-dragging');
  if(state.moved){suppressClick=true;setTimeout(()=>suppressClick=false,350);const momentum=event.type==='pointercancel'?0:Math.max(-.7,Math.min(.7,state.velocity*.25));go(Math.round(phase+momentum));}
 }
 track.addEventListener('pointerup',release);track.addEventListener('pointercancel',release);track.addEventListener('lostpointercapture',release);
 track.addEventListener('dragstart',event=>event.preventDefault());
 root.addEventListener('wheel',event=>{
  if(event.ctrlKey||dialog.open||zoom.open)return;
  const primary=Math.abs(event.deltaY)>=Math.abs(event.deltaX)?event.deltaY:event.deltaX;
  const delta=primary*(event.deltaMode===1?16:event.deltaMode===2?height:1);if(!delta)return;
  event.preventDefault();go(phase+delta/150);clearTimeout(wheelTimer);wheelTimer=setTimeout(()=>go(Math.round(phase)),150);
 },{passive:false});
 q('enlarge').onclick=()=>{q('zoom-photo').src=large.src;q('zoom-photo').alt=large.alt;zoom.showModal()};q('close').onclick=()=>zoom.close();zoom.onclick=event=>{if(event.target===zoom)zoom.close()};
 document.addEventListener('visibilitychange',()=>{if(document.hidden){clearTimeout(wheelTimer);if(frame)cancelAnimationFrame(frame);frame=0;phase=Math.round(phase);visualPhase=phase;animation=null;root.classList.remove('is-dragging');drag=null}else schedule()});
 window.addEventListener('pagehide',()=>{observer.disconnect();clearTimeout(wheelTimer);if(frame)cancelAnimationFrame(frame)});
 window.addEventListener('pageshow',event=>{if(event.persisted){observer.observe(track);schedule()}});
 reduced.addEventListener('change',schedule);updateDetails(0);schedule();
}
