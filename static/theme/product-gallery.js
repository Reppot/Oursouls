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
document.getElementById('product-order')?.elements.size.addEventListener('change',function(){
 const link=document.getElementById('product-try');if(!link)return;
 const url=new URL(link.href);url.searchParams.set('size',this.value);link.href=url.href;
});
