// Quiet motion: visible by default, no animation framework or scroll interception.
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const active=new Set(),running=new WeakMap();
function play(element,frames,options={}){
 if(!element||reduced.matches||!element.animate)return;
 running.get(element)?.cancel();
 const animation=element.animate(frames,{duration:260,easing:'cubic-bezier(.16,1,.3,1)',...options});
 running.set(element,animation);active.add(animation);
 const clear=()=>active.delete(animation);animation.onfinish=clear;animation.oncancel=clear;
}
function stop(){for(const animation of active)animation.cancel();active.clear()}
reduced.addEventListener('change',()=>{if(reduced.matches)stop()});
window.addEventListener('pagehide',stop);
if('IntersectionObserver' in window){
 const seen=new WeakSet();
 const observer=new IntersectionObserver(entries=>{
  for(const entry of entries){if(!entry.isIntersecting)continue;const card=entry.target;observer.unobserve(card);if(seen.has(card))continue;seen.add(card);
   const image=card.querySelector('img');
   const show=()=>{if(card.getBoundingClientRect().bottom<0||document.hidden)return;play(card,[{opacity:.65,transform:'translateY(12px)',clipPath:'inset(0 0 4% 0)'},{opacity:1,transform:'none',clipPath:'inset(0 0 0 0)'}],{duration:520,delay:Number(card.dataset.arrival||0)})};
   if(image&&!image.complete)Promise.race([image.decode().catch(()=>{}),new Promise(resolve=>setTimeout(resolve,1200))]).then(show);else show();
  }
 },{threshold:.06});
 document.querySelectorAll('.page-catalog .product-card').forEach((card,index)=>{card.dataset.arrival=String((index%4)*40);observer.observe(card)});
}
const dialogs=new MutationObserver(records=>{
 for(const record of records){const target=record.target;if(target.tagName==='DIALOG'&&target.open)play(target,[{opacity:0,transform:'translateY(12px) scale(.985)'},{opacity:1,transform:'none'}],{duration:300})}
});
dialogs.observe(document.body,{subtree:true,attributes:true,attributeFilter:['open']});
const studio=document.querySelector('#our-print');
if(studio){
 new MutationObserver(records=>{if(!records.some(record=>record.oldValue))return;play(document.getElementById('op-panel-'+studio.dataset.step),[{opacity:.55,transform:'translateX(8px)'},{opacity:1,transform:'none'}],{duration:220})}).observe(studio,{attributes:true,attributeFilter:['data-step'],attributeOldValue:true});
}

// One composited sheen for the whole page; freeze it while editing or dragging.
let backdropHeld=false;
function syncBackdrop(){document.body.classList.toggle('ambient-paused',document.hidden||reduced.matches||backdropHeld||!!document.querySelector('dialog[open]')||!!document.activeElement?.matches('input,select,textarea'))}
document.addEventListener('visibilitychange',syncBackdrop);
document.addEventListener('pointerdown',()=>{backdropHeld=true;syncBackdrop()},{passive:true});
for(const event of ['pointerup','pointercancel'])window.addEventListener(event,()=>{backdropHeld=false;syncBackdrop()},{passive:true});
window.addEventListener('blur',()=>{backdropHeld=false;syncBackdrop()});
document.addEventListener('focusin',syncBackdrop);document.addEventListener('focusout',()=>queueMicrotask(syncBackdrop));
reduced.addEventListener('change',syncBackdrop);
new MutationObserver(syncBackdrop).observe(document.body,{subtree:true,attributes:true,attributeFilter:['open']});
syncBackdrop();
