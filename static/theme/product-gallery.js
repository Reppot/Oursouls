const gallery=document.querySelector('[data-product-gallery]');
if(gallery){
 const image=gallery.querySelector('[data-gallery-image]'),full=gallery.querySelector('[data-gallery-full]');
 const thumbs=[...gallery.querySelectorAll('[data-gallery-thumb]')];
 function select(thumb){
  image.src=thumb.href;image.alt=thumb.dataset.label;full.href=thumb.href;
  thumbs.forEach(item=>{if(item===thumb)item.setAttribute('aria-current','true');else item.removeAttribute('aria-current')});
 }
 thumbs.forEach((thumb,index)=>{
  thumb.addEventListener('click',event=>{if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;event.preventDefault();select(thumb)});
  thumb.addEventListener('keydown',event=>{
   const next={ArrowRight:index+1,ArrowLeft:index-1,Home:0,End:thumbs.length-1}[event.key];
   if(next===undefined)return;
   event.preventDefault();const target=thumbs[Math.max(0,Math.min(thumbs.length-1,next))];select(target);target.focus();
  });
 });
}
const orderForm=document.getElementById('product-order'),mobileOrder=document.querySelector('[data-mobile-product-order]');
orderForm?.addEventListener('change',event=>{
 if(event.target.name!=='size')return;
 const size=new FormData(orderForm).get('size');
 if(mobileOrder)mobileOrder.textContent='В корзину · '+size;
});
mobileOrder?.addEventListener('click',()=>{
 if(new FormData(orderForm).get('size')){orderForm.requestSubmit();return}
 const first=orderForm.querySelector('input[name=size]');first?.scrollIntoView({block:'center',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});first?.focus({preventScroll:true});
});
try{const previous=new URL(sessionStorage.getItem('os-catalog-return')||'/catalog/',location.origin);if(previous.origin===location.origin&&previous.pathname==='/catalog/'){const back=document.querySelector('[data-catalog-return]');if(back)back.href=previous.pathname+previous.search}}catch{}
