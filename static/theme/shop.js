const toggle=document.querySelector('.mobile-menu-toggle'), nav=document.querySelector('#main-navigation');
toggle?.addEventListener('click',()=>{const open=toggle.getAttribute('aria-expanded')!=='true';toggle.setAttribute('aria-expanded',String(open));nav.classList.toggle('is-open',open)});
nav?.addEventListener('click',e=>{if(e.target.closest('a')){nav.classList.remove('is-open');toggle.setAttribute('aria-expanded','false')}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&nav?.classList.contains('is-open')){nav.classList.remove('is-open');toggle.setAttribute('aria-expanded','false');toggle.focus()}});
document.querySelector('[data-sort]')?.addEventListener('change',e=>e.target.form.requestSubmit());
const filters=document.querySelector('[data-filter-toggle]'), panel=document.querySelector('.catalog-filters');
filters?.addEventListener('click',()=>{const open=filters.getAttribute('aria-expanded')!=='true';filters.setAttribute('aria-expanded',String(open));panel.classList.toggle('is-open',open)});
document.querySelector('[data-copy-order]')?.addEventListener('click',async e=>{const text=document.querySelector('#order-text');try{await navigator.clipboard.writeText(text.value);e.target.textContent='Состав скопирован'}catch{text.hidden=false;text.focus();text.select();e.target.textContent='Выдели и скопируй текст ниже'}});

const cartLink=document.querySelector('.header-cart');
if(cartLink){import('../studio/draft-store.js').then(async({drafts})=>{const count=+cartLink.dataset.readyCount+(await drafts.list()).filter(p=>p.inCart).reduce((sum,p)=>sum+(+p.snapshot.quantity||1),0);let badge=cartLink.querySelector('span');if(count&&!badge){badge=document.createElement('span');cartLink.append(badge)}if(badge)badge.textContent=count;cartLink.setAttribute('aria-label','Корзина, товаров '+count)}).catch(()=>{});}
