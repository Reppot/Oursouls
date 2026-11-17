import {drafts} from '../studio/draft-store.js';
import {prepareOrder} from '../studio/order-export.js?v=2';
const host=document.querySelector('[data-local-projects]'),csrf=document.querySelector('[data-cart-csrf]').value;
const objectUrls=[];let lastRemoved=null;
async function render(){
 try{const projects=(await drafts.list()).filter(p=>p.inCart);objectUrls.splice(0).forEach(url=>URL.revokeObjectURL(url));host.replaceChildren();document.querySelector('[data-local-checkout]').hidden=!projects.length;const empty=document.querySelector('.osp-empty-cart');if(empty)empty.hidden=!!projects.length;
  if(projects.length){document.querySelector('.osp-empty-cart')?.setAttribute('hidden','');document.querySelector('[data-local-checkout]').hidden=false;}
  for(const p of projects){const row=document.createElement('article');row.className='local-project';
   if(p.preview){const im=document.createElement('img');im.src=URL.createObjectURL(p.preview);objectUrls.push(im.src);im.alt=p.name;row.append(im)}
   const info=document.createElement('div'),name=document.createElement('h2'),text=document.createElement('p'),edit=document.createElement('button'),remove=document.createElement('button');
   name.textContent=p.name;text.textContent=`${p.color} · ${p.snapshot.size} · ${p.snapshot.quantity} шт. · Свой макет`;edit.type=remove.type='button';edit.textContent='Редактировать';remove.textContent='Убрать';
   edit.onclick=async()=>{await drafts.save({...p,id:'current',inCart:false});location.href='/constructor/'};remove.onclick=async()=>{lastRemoved=p;await drafts.save({...p,inCart:false});await render();const undo=document.querySelector('[data-cart-undo]');undo.hidden=false;undo.onclick=async()=>{await drafts.save(lastRemoved);lastRemoved=null;undo.hidden=true;render()}};
   info.append(name,text,edit,remove);row.append(info);host.append(row);
  }
 }catch{host.textContent='Локальные макеты недоступны. Можно оформить готовые товары или открыть конструктор.'}
}
document.querySelectorAll('[data-prepare-order]').forEach(button=>button.onclick=()=>prepareOrder(csrf));
window.addEventListener('pagehide',()=>objectUrls.forEach(url=>URL.revokeObjectURL(url)));
render();
