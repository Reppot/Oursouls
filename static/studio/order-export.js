import {createArchive} from './order-archive.js';
import {drafts} from './draft-store.js';

export function orderManifest(items,projects){
 const unknown=projects.length>0||items.some(i=>i.price===null||i.price===undefined);
 return {version:7,createdAt:new Date().toISOString(),items,designs:projects.map(p=>({id:p.id,name:p.name,color:p.color,design:p.snapshot})),
  total:unknown?null:items.reduce((n,i)=>n+i.price*i.quantity,0),placementAgreementRequired:projects.length>0,
  instructions:'Стоимость, наличие и размещение согласуем перед печатью. Прикрепите архив в Telegram @oursouls33.'};
}
export async function buildOrder(items,projects){
 const manifest=orderManifest(items,projects),files=[];
 for(const project of projects){
  if(!/^[a-zA-Z0-9-]{1,80}$/.test(project.id))throw new Error('Некорректный идентификатор проекта.');
  for(const entry of project.exportFiles||[]){if(!/^[a-zA-Z0-9_./-]+$/.test(entry.path)||entry.path.includes('..')||entry.path.startsWith('/'))throw new Error('Некорректный путь файла.');files.push(['designs/'+project.id+'/'+entry.path,entry.blob])}
  files.push(['designs/'+project.id+'/design.json',new Blob([JSON.stringify(project.snapshot,null,2)],{type:'application/json'})]);
 }
 const lines=['Заказ Our Souls','',...items.map(i=>`${i.name} · ${i.color} · ${i.size} · ${i.quantity} шт.`),
  ...projects.map(p=>`${p.name} · ${p.color} · ${p.snapshot.size} · ${p.snapshot.quantity} шт. (свой макет)`),'',manifest.instructions];
 files.push(['order.json',new Blob([JSON.stringify(manifest,null,2)],{type:'application/json'})],['order.txt',new Blob([lines.join('\n')],{type:'text/plain;charset=utf-8'})]);
 return {blob:await createArchive(files),text:lines.join('\n'),manifest};
}

export async function prepareOrder(csrf,currentProject=null){
 let dialog=document.getElementById('shared-order-dialog');
 if(!dialog){dialog=document.createElement('dialog');dialog.id='shared-order-dialog';dialog.className='shared-order-dialog';dialog.setAttribute('aria-labelledby','shared-order-title');dialog.innerHTML='<button type="button" class="dialog-close" aria-label="Закрыть">×</button><h2 id="shared-order-title">Твой заказ</h2><p data-order-state role="status">Подготавливаем файл…</p><textarea data-order-text aria-label="Состав заказа" readonly hidden></textarea><div class="actions"><a class="button" data-order-download hidden download="our-souls-order.zip">Скачать файл заказа</a><a class="button outline" data-order-telegram hidden target="_blank" rel="noopener">Открыть Telegram ↗</a><button type="button" class="button outline" data-order-copy hidden>Скопировать состав</button></div><a class="button outline" href="/cart/" data-order-cart hidden>Проверить корзину</a><p data-order-help hidden>Прикрепи <strong>our-souls-order.zip</strong> в переписке с @oursouls33. Отправка файла выполняется тобой в Telegram.</p>';document.body.append(dialog);dialog.querySelector('.dialog-close').onclick=()=>dialog.close()}
 const q=s=>dialog.querySelector('[data-order-'+s+']');dialog.showModal();q('state').textContent='Подготавливаем файл…';for(const key of ['download','telegram','copy','text','help','cart'])q(key).hidden=true;
 try{
  const response=await fetch('/api/cart/validate/',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({csrf})});
  if(!response.ok){if(response.status===409){const result=await response.json();const error=new Error(result.errors.join(' ')+' Проверь корзину, затем повтори подготовку.');error.cart=true;throw error}throw new Error('Не удалось проверить товары. Обнови страницу и повтори. Макет сохранён на устройстве.')}
  const {items}=await response.json();let projects=[];try{projects=(await drafts.list()).filter(p=>p.inCart)}catch{throw new Error('Не удалось открыть локальные макеты. Заказ не собран, чтобы не потерять часть позиций. Повтори попытку или открой конструктор.')}
  if(currentProject)projects=[...projects.filter(p=>p.id!==currentProject.id),currentProject];
  if(!items.length&&!projects.length)throw new Error('Добавь товар или свой макет в корзину.');
  const result=await buildOrder(items,projects);
  const download=q('download');if(download.dataset.url)URL.revokeObjectURL(download.dataset.url);download.href=download.dataset.url=URL.createObjectURL(result.blob);
  q('text').value=result.text;q('telegram').href='https://t.me/oursouls33?text='+encodeURIComponent(result.text.slice(0,3500));q('state').textContent='Файл подготовлен. Скачай его и прикрепи в Telegram.';
  for(const key of ['download','telegram','copy','text','help'])q(key).hidden=false;
  q('copy').onclick=async()=>{try{await navigator.clipboard.writeText(result.text);q('state').textContent='Состав заказа скопирован.'}catch{q('text').focus();q('text').select();q('state').textContent='Выдели и скопируй состав заказа вручную.'}};
 }catch(error){if(error.cart)q('cart').hidden=false;q('state').textContent=error.message||'Не удалось собрать заказ. Закрой окно и повтори. Макет остаётся на устройстве.'}
}
