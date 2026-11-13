import {studioCutout} from '../shared/cutout.js';
const root=document.querySelector('[data-rack]');
if(root?.querySelector('[data-rack-data]')){
 const data=JSON.parse(root.querySelector('[data-rack-data]').textContent), pieces=[...root.querySelectorAll('[data-rack-index]')];
 const q=s=>root.querySelector('[data-rack-'+s+']'), form=q('form'), large=q('large'), dialog=root.querySelector('dialog');
 root.dataset.enhanced='true';
 const detail=root.querySelector('.rack-detail'),home=detail.parentNode,placeholder=document.createComment('rack detail');home.insertBefore(placeholder,detail);
 const mobileDialog=document.createElement('dialog');mobileDialog.className='rack-mobile-detail';mobileDialog.setAttribute('aria-label','Выбранная вещь');const close=document.createElement('button');close.type='button';close.className='rack-mobile-close';close.setAttribute('aria-label','Закрыть просмотр');close.textContent='×';mobileDialog.append(close);root.append(mobileDialog);close.onclick=()=>mobileDialog.close();mobileDialog.addEventListener('close',()=>placeholder.after(detail));
 const openMobile=()=>{mobileDialog.append(detail);mobileDialog.showModal()};
 let index=0, token=0; const choices=new Map(); const touch=()=>matchMedia('(hover: none)').matches;
 async function prepare(image,url,prepared=false){
  image.src=url; if(prepared){image.classList.add('is-cutout');return}
  try{const c=await studioCutout(url,850);if(image.dataset.source!==url&&image===large)return;
   image.src=c.toDataURL('image/webp',.9);image.classList.add('is-cutout')}catch{image.classList.remove('is-cutout')}
 }
 function select(n,scroll=false){
  index=Math.max(0,Math.min(data.length-1,n));const p=data[index],vs=p.variants;
  const v=vs.find(v=>v.id===choices.get(p.id))||vs.find(v=>v.availability!=='unavailable')||vs[0]; choices.set(p.id,v.id);token++;
  pieces.forEach((piece,i)=>{piece.classList.toggle('is-selected',i===index);piece.setAttribute('aria-current',String(i===index))});
  q('name').textContent=p.name;q('category').textContent=p.category;q('count').textContent=`${index+1} / ${data.length}`;
  q('price').textContent=p.sale_price!==null||p.price!==null?new Intl.NumberFormat('ru-RU',{style:'currency',currency:'RUB',maximumFractionDigits:0}).format((p.sale_price??p.price)/100):'Цена по запросу';
  const url=v.rack_image||v.images.front;large.dataset.source=url;large.alt=p.name;prepare(large,url,!!v.rack_image);
  form.elements.id.value=p.id;form.elements.variant_id.value=v.id;
  q('color-name').textContent=v.color_name;
  q('colors').replaceChildren(...vs.map(variant=>{const b=document.createElement('button');b.type='button';b.title=variant.color_name;b.setAttribute('aria-label',variant.color_name);b.setAttribute('aria-pressed',String(variant.id===v.id));b.style.setProperty('--swatch',variant.color_hex||'#777');b.disabled=variant.availability==='unavailable';b.onclick=()=>{choices.set(p.id,variant.id);select(index)};return b}));
  const old=form.elements.size.value;form.elements.size.replaceChildren(new Option('Выбрать размер',''),...v.sizes.map(s=>new Option(s,s)));if(v.sizes.includes(old))form.elements.size.value=old;
  q('add').disabled=!p.available||v.availability==='unavailable';q('link').href='/product/'+encodeURIComponent(p.slug)+'/?variant='+encodeURIComponent(v.id);
  q('prev').disabled=index===0;q('next').disabled=index===data.length-1;
  if(scroll)pieces[index].scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'nearest',inline:'center'});
 }
 pieces.forEach((piece,i)=>{piece.addEventListener('mouseenter',()=>{if(!touch())select(i)});piece.addEventListener('focus',()=>select(i));piece.addEventListener('click',event=>{event.preventDefault();select(i);if(touch()||innerWidth<=650)openMobile()});
  const img=piece.querySelector('img');const start=()=>prepare(img,img.getAttribute('src'),!!data[i].variants[0].rack_image);
  if(i<4)start();else{const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){start();observer.disconnect()}},{rootMargin:'150px'});observer.observe(piece)}
 });
 q('prev').onclick=()=>select(index-1,true);q('next').onclick=()=>select(index+1,true);
 root.querySelector('.rack-track').addEventListener('keydown',event=>{if(['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();select(index+(event.key==='ArrowRight'?1:-1),true)}});
 q('enlarge').onclick=()=>{q('zoom-photo').src=large.src;q('zoom-photo').alt=large.alt;dialog.showModal()};q('close').onclick=()=>dialog.close();dialog.onclick=e=>{if(e.target===dialog)dialog.close()};
 select(0);
}
