(async () => {
    'use strict';
    const root = document.getElementById('our-print');
    if (!root || root.dataset.ready) return;
    root.dataset.ready = '1';root.inert=true;
    const q = id => root.querySelector('#op-' + id);
    const all = selector => [...root.querySelectorAll(selector)];
    const {drafts} = await import('./draft-store.js');
    const {createHistory} = await import('./history.mjs');
    const {validatePrintFile} = await import('./image-info.mjs');
    const history = createHistory(30), sources = new Map();
    let restoring = true, saveTimer, projectId = crypto.randomUUID(), persistToken = 0;
    const cv = q('canvas'), ctx = cv.getContext('2d'), processingScratch=document.createElement('canvas');
    const layers = { front: [], back: [] }, selected = { front: null, back: null };
    const empty = fresh(), limit = 10;
    const active = key => layers[key].find(layer => layer.id === selected[key]) || empty;
    const count = () => layers.front.length + layers.back.length;
    let pending = 0, nextId = 0;
    const sides = { get front() { return active('front'); }, get back() { return active('back'); } };
    const tabs = ['garment', 'print', 'order'];
    const effectKeys = ['mode','tint','from','to','gradientType','gradientAngle','amount','brightness','contrast','saturation','opacity'];
    const sideName = key => key === 'front' ? 'Перед' : 'Спина';
    const bounded = (value, min, max) => Math.max(min, Math.min(max, value));
    let side = 'front', tab = 'garment', mode = 'orbit', viewer = null, fallback = false, drag = null;
    let fabricColor = q('color').value;

    function defaults() { return {mode:'original',tint:'#e85a65',from:'#355d31',to:'#9b2f45',gradientType:'linear',gradientAngle:90,amount:100,brightness:100,contrast:100,saturation:100,opacity:100,flipX:false,flipY:false}; }
    function fresh() { return {img:null,data:null,name:'',x:300,y:340,scale:65,angle:0,effects:defaults()}; }
    function dimensions(s) {
        const scale = s.scale / 100;
        const ratio = Math.min(210 * scale / s.img.width, 265 * scale / s.img.height);
        return { w:s.img.width * ratio, h:s.img.height * ratio };
    }
    function clamp(s) { s.x = bounded(s.x, 45, 555); s.y = bounded(s.y, 72, 620); }
    function hex(value) {
        let v = String(value).trim().replace(/^#/, '');
        if (/^[0-9a-f]{3}$/i.test(v)) v = [...v].map(c => c + c).join('');
        return /^[0-9a-f]{6}$/i.test(v) ? '#' + v.toLowerCase() : null;
    }
    function rgb(value) { return {r:parseInt(value.slice(1,3),16),g:parseInt(value.slice(3,5),16),b:parseInt(value.slice(5,7),16)}; }
    function colorName() { return q('color').selectedOptions[0].text; }
    function garmentName() { return q('garment').selectedOptions[0].text; }
    function status(text, error = false) { q('status').textContent = text; q('status').classList.toggle('os-error', error); }
    function setColor(value) {
        const v = hex(value); if (!v) return;
        fabricColor = v;
        q('fabric-picker').value = v; q('fabric-hex').value = v.toUpperCase();
        const c = rgb(v);
        for (const k of ['r','g','b']) q('fabric-'+k).value = c[k];
        q('color').value = [...q('color').options].some(o => o.value === v) ? v : 'custom';
        q('color-error').textContent = ''; draw();
    }
    function validColor() {
        const v = hex(q('fabric-hex').value);
        if (!v || !['r','g','b'].every(k => { const x = q('fabric-'+k).value; return x !== '' && Number.isInteger(+x) && +x >= 0 && +x <= 255; })) {
            status('Проверь свой цвет: HEX из 3 или 6 знаков, RGB — от 0 до 255.', true); return false;
        }
        if (fabricColor !== v) setColor(v);
        return true;
    }

    function renderPrint(s) {
        const key = JSON.stringify(s.effects);
        if (s.cache && s.cache.key === key) return s.cache.output;
        const e = s.effects, ratio = Math.min(1,1600/Math.max(s.img.width,s.img.height));
        const w = Math.max(1,Math.round(s.img.width*ratio)), h = Math.max(1,Math.round(s.img.height*ratio));
        const raw = processingScratch;
        const output = s.cache ? s.cache.output : document.createElement('canvas');
        raw.width = output.width = w; raw.height = output.height = h;
        const c = raw.getContext('2d');
        c.save(); c.translate(e.flipX?w:0,e.flipY?h:0); c.scale(e.flipX?-1:1,e.flipY?-1:1); c.drawImage(s.img,0,0,w,h); c.restore();
        if (e.mode !== 'original') {
            c.globalCompositeOperation = 'source-atop'; c.globalAlpha = e.amount / 100;
            let fill = e.tint;
            if (e.mode === 'gradient') {
                if (e.gradientType === 'radial') fill = c.createRadialGradient(w/2,h/2,0,w/2,h/2,Math.hypot(w,h)/2);
                else {
                    const angle = e.gradientAngle * Math.PI / 180, dx = Math.cos(angle), dy = Math.sin(angle);
                    const r = (Math.abs(w*dx)+Math.abs(h*dy))/2;
                    fill = c.createLinearGradient(w/2-dx*r,h/2-dy*r,w/2+dx*r,h/2+dy*r);
                }
                fill.addColorStop(0,e.from); fill.addColorStop(1,e.to);
            }
            c.fillStyle = fill; c.fillRect(0,0,w,h);
        }
        const target = output.getContext('2d');
        const supportsFilter = 'filter' in target;
        if (supportsFilter) target.filter = `brightness(${e.brightness}%) contrast(${e.contrast}%) saturate(${e.saturation}%)`;
        target.globalAlpha = e.opacity/100; target.drawImage(raw,0,0);
        if (!supportsFilter && (e.brightness !== 100 || e.contrast !== 100 || e.saturation !== 100)) {
            const data = target.getImageData(0,0,w,h), px = data.data;
            for (let i=0;i<px.length;i+=4) {
                const v = [px[i],px[i+1],px[i+2]].map(x => bounded((x * e.brightness/100 - 127.5) * e.contrast/100 + 127.5,0,255));
                const l = v[0]*.213 + v[1]*.715 + v[2]*.072;
                for (let k=0;k<3;k++) px[i+k] = l + (v[k]-l)*e.saturation/100;
            }
            target.putImageData(data,0,0);
        }
        s.cache = {key,output}; return output;
    }

var atlasImage=null,photoError=false,photoViews={},photoLayers={};
function canvasLayer(){var layer=document.createElement('canvas');layer.width=600;layer.height=700;return layer}
function photoView(which){var type=q('garment').value,key=type+'-'+which;if(photoViews[key])return photoViews[key];if(!atlasImage)return null;var col={tee:0,long:1,hoodie:2}[type],row=which==='back'?1:0,tw=atlasImage.width/3,th=atlasImage.height/2,tile=document.createElement('canvas');tile.width=Math.round(tw);tile.height=Math.round(th);var tc=tile.getContext('2d');tc.drawImage(atlasImage,col*tw,row*th,tw,th,0,0,tile.width,tile.height);var pixels=tc.getImageData(0,0,tile.width,tile.height).data,x0=tile.width,y0=tile.height,x1=0,y1=0;for(var y=0;y<tile.height;y++)for(var x=0;x<tile.width;x++)if(pixels[(y*tile.width+x)*4+3]>32){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y)}if(x1<=x0||y1<=y0)return null;var w=x1-x0+1,h=y1-y0+1,ratio=Math.min(490/w,530/h),view=canvasLayer(),vc=view.getContext('2d');vc.drawImage(tile,x0,y0,w,h,300-w*ratio/2,100,w*ratio,h*ratio);photoViews[key]=view;return view}
function coloredPhoto(which){var key=q('garment').value+'-'+which,view=photoView(which);if(!view)return null;var cached=photoLayers[key];if(cached&&cached.color===fabricColor)return cached;var layer=canvasLayer(),c=layer.getContext('2d');c.drawImage(view,0,0);var image=c.getImageData(0,0,600,700),px=image.data,base=rgb(fabricColor);for(var i=0;i<px.length;i+=4){if(!px[i+3])continue;var l=(px[i]*.2126+px[i+1]*.7152+px[i+2]*.0722),shade=Math.pow(l/230,1.15),highlight=Math.max(0,l-170)*.28*(1-Math.max(base.r,base.g,base.b)/255);px[i]=Math.min(255,base.r*shade+highlight);px[i+1]=Math.min(255,base.g*shade+highlight);px[i+2]=Math.min(255,base.b*shade+highlight)}c.putImageData(image,0,0);cached={color:fabricColor,canvas:layer,neutral:view};photoLayers[key]=cached;return cached}
    const printLayer = canvasLayer(), printMask = canvasLayer();
    function paintLayer(c, s) {
        clamp(s);
        const d = dimensions(s);
        c.save();
        c.translate(s.x, s.y);
        c.rotate(s.angle * Math.PI / 180);
        c.drawImage(renderPrint(s), -d.w / 2, -d.h / 2, d.w, d.h);
        c.restore();
    }
    function garment(c, which, edit, transparent = false) {
        c.save();
        const studioSurface=c.canvas===cv||c.canvas===q('review-front')||c.canvas===q('review-back');
        const bg = c.createRadialGradient(300,300,20,300,350,480);
        bg.addColorStop(0,studioSurface?'#46554d':'#fafaf7'); bg.addColorStop(1,studioSurface?'#2b3730':'#e5e5df');
        if (!transparent) { c.fillStyle = bg; c.fillRect(0,0,600,700); }
        const photo = coloredPhoto(which);
        c.textAlign = 'center'; c.fillStyle = studioSurface?'#e3ebe6':'#52604d';
        if (!photo) {
            c.font = '18px Arial';
            c.fillText(photoError ? 'Макет не загрузился. Обнови страницу.' : 'Готовим студийный макет…',300,350);
            c.restore();
            return;
        }
        c.save();
        if (!transparent) { c.shadowColor = 'rgba(25,29,24,.18)'; c.shadowBlur = 18; c.shadowOffsetY = 12; }
        c.drawImage(photo.canvas,0,0); c.restore();
        if (layers[which].length) {
            const pc = printLayer.getContext('2d'), mc = printMask.getContext('2d');
            pc.clearRect(0,0,600,700); mc.clearRect(0,0,600,700);
            for (const layer of layers[which]) paintLayer(pc, layer);
            mc.drawImage(printLayer,0,0);
            pc.globalCompositeOperation = 'multiply'; pc.drawImage(photo.neutral,0,0);
            pc.globalCompositeOperation = 'destination-in'; pc.drawImage(printMask,0,0); pc.drawImage(photo.neutral,0,0);
            pc.globalCompositeOperation = 'source-over'; c.drawImage(printLayer,0,0);
            const s = active(which);
            if (edit && s.img) {
                const d = dimensions(s);
                c.save(); c.translate(s.x,s.y); c.rotate(s.angle*Math.PI/180);
                c.strokeStyle='rgba(70,87,61,.65)'; c.setLineDash([7,6]); c.lineWidth=1.3;
                c.strokeRect(-d.w/2-4,-d.h/2-4,d.w+8,d.h+8);
                c.setLineDash([]);c.fillStyle='#f5f7ed';c.strokeStyle='#355d31';c.lineWidth=2;
                for(const x of [-d.w/2,d.w/2])for(const y of [-d.h/2,d.h/2]){c.beginPath();c.arc(x,y,5,0,Math.PI*2);c.fill();c.stroke()}
                c.beginPath();c.moveTo(0,-d.h/2);c.lineTo(0,-d.h/2-28);c.stroke();c.beginPath();c.arc(0,-d.h/2-28,6,0,Math.PI*2);c.fill();c.stroke();c.restore();
            }
        }
        c.font = '16px Arial';
        if (!transparent) c.fillText(which === 'front' ? 'ПЕРЕД' : 'СПИНА',300,670);
        c.restore();
    }

    function pressed(selector, key, value) {
        all(selector).forEach(button => button.setAttribute('aria-pressed', String(button.dataset[key] === value)));
    }
    function setMode(next) {
        mode = next === 'print' && sides[side].img ? 'print' : 'orbit';
        if (viewer) viewer.setMode(mode);
        cv.dataset.mode = mode;
        q('move-mode').setAttribute('aria-pressed', String(mode === 'print'));
        q('gesture').textContent = mode === 'print' ? 'Перетащи принт по ткани. Стрелки помогают двигать точнее.' : viewer ? 'Потяни модель, чтобы повернуть. Кнопки + и − меняют масштаб.' : 'Выбери перед или спину для студийного просмотра.';
    }
    function syncPreview() {if(fallback)garment(ctx,side,mode==='print');syncTouchTarget();}
    let reviewStamp='';
    function draw() {
        const s = sides[side], e = s.effects;
        pressed('[data-garment]', 'garment', q('garment').value);
        pressed('[data-color]', 'color', fabricColor);
        pressed('[data-side]', 'side', side);
        pressed('[data-size]', 'size', q('size').value);
        all('[data-file-dot]').forEach(dot => { dot.hidden = !layers[dot.dataset.fileDot].length; });
        q('color-name').textContent = colorName(); q('hex-preview').textContent = fabricColor.toUpperCase();
        q('stage-model').textContent = garmentName();
        q('transform-fields').hidden = !s.img; q('effects-panel').hidden = !s.img;
        q('file-info').hidden = !s.img; q('file-name').textContent = s.name;
        const capacity = count() + pending >= limit;
        q('upload-title').textContent = capacity ? 'Достигнут лимит принтов' : 'Добавить принт';
        q('file').disabled = capacity; q('example').disabled = capacity;
        q('layer-count').textContent = count() + ' / ' + limit;
        const list = q('layers');
        const signature = layers[side].map(layer => layer.id).join(',') + ':' + selected[side];
        if (list.dataset.signature !== signature) {
            list.dataset.signature = signature;
            list.replaceChildren(...layers[side].map((layer, index) => {
                const option = document.createElement('option');
                option.value = layer.id;
                option.textContent = (index + 1) + '. ' + layer.name;
                return option;
            }));
        }
        list.hidden = !layers[side].length; list.value = selected[side] ?? '';
        q('layer-down').disabled = layers[side].indexOf(s) < 1;
        q('layer-up').disabled = layers[side].indexOf(s) >= layers[side].length - 1;
        q('scale').value = s.scale; q('angle').value = s.angle;
        q('scale-value').textContent = s.scale + '%'; q('degrees').textContent = s.angle + '°';
        q('effect-fields').disabled = !s.img;
        effectKeys.forEach(k => { q('effect-'+k).value = e[k]; const out = q('value-'+k); if (out) out.textContent = e[k] + (k === 'gradientAngle' ? '°' : '%'); });
        q('solid-options').hidden = e.mode !== 'solid'; q('gradient-options').hidden = e.mode !== 'gradient'; q('amount-options').hidden = e.mode === 'original';
        q('gradient-direction').hidden = e.gradientType === 'radial';
        for (const k of ['X','Y']) q('flip'+k).setAttribute('aria-pressed', String(e['flip'+k]));
        const printed = ['front','back'].filter(k => sides[k].img).map(sideName);
        q('order-summary').textContent = `${garmentName()} · ${colorName()} · ${printed.length ? printed.join(' и ') : 'принт не добавлен'}`;
        renderReview();
        updateDraftControls();
        renderThumbnails();
        scheduleSave();
        q('position').textContent = s.img ? `${sideName(side)} · ${s.scale}% · ${s.angle}°` : sideName(side);
        syncPreview();
    }
    function selectSide(next, orient = true) {
        if (next === side && !orient) return;
        side = next; q('file').value = '';
        setMode(mode); status(''); draw();
    }
    const narrowStudio = matchMedia('(max-width: 850px)');
    function syncPanels() {
        root.dataset.step=tab;
        q('panel-garment').hidden = tab !== 'garment';
        q('panel-print').hidden = tab !== 'print';
        q('panel-order').hidden = tab !== 'order';
        q('panel-print').closest('.os-studio-settings').hidden = tab === 'garment';
    }
    narrowStudio.addEventListener('change', syncPanels);
    syncPanels();
    function openTab(next, focus = false) {
        const changed=tab!==next;tab = next;root.dataset.step=next;
        for (const key of tabs) {
            const selected = key === next, button = q('tab-'+key);
            button.setAttribute('aria-selected', String(selected)); button.tabIndex = selected ? 0 : -1;

        }
        syncPanels();
        setMode(next === 'print' ? 'print' : 'orbit');
        if (focus) q('tab-'+next).focus({preventScroll:true});
        status(''); draw();
        const panel=q('panel-'+next);
        if(changed&&!restoring&&!matchMedia('(prefers-reduced-motion: reduce)').matches){panel.getAnimations().forEach(a=>a.cancel());panel.animate([{opacity:0,transform:'translateY(14px)',clipPath:'inset(0 0 5% 0)'},{opacity:1,transform:'translateY(0)',clipPath:'inset(0)'}],{duration:380,easing:'cubic-bezier(.16,1,.3,1)'})}
    }
    function renderReview(){
        if(tab!=='order'||!q('review-front'))return;
        q('review-garment').textContent=garmentName();q('review-color').textContent=colorName()+' · '+fabricColor.toUpperCase();q('review-total').textContent=count()+' / 10';
        const stamp=JSON.stringify([!!atlasImage,q('garment').value,fabricColor,...['front','back'].map(key=>layers[key].map(l=>[l.id,l.x,l.y,l.scale,l.angle,l.cache?.key]))]);
        for(const key of ['front','back']){q('review-'+key+'-count').textContent=layers[key].length;const button=root.querySelector('[data-review-side='+key+']');button.setAttribute('aria-pressed',String(key===side));if(stamp!==reviewStamp)garment(q('review-'+key).getContext('2d'),key,false)}
        reviewStamp=stamp;
    }
    all('[data-review-side]').forEach(button=>button.onclick=()=>{selectSide(button.dataset.reviewSide);renderReview()});
    function move(key, x, y) {
        const s = sides[key]; if (!s.img) return;
        s.x = x; s.y = y; clamp(s); syncPreview();scheduleSave();
    }
    async function loadFile(file, key, sample = false) {
        if (!file) return;
        if (!['image/jpeg','image/png'].includes(file.type) || file.size > 20*1024*1024) {
            status('Выбери JPEG или PNG размером до 20 МБ.', true); q('file').value = ''; return;
        }
        if (count() + pending >= limit) { status('На один макет можно добавить до 10 принтов.', true); return; }
        pending++; draw(); status('Открываем изображение…');
        let url;
        try {
            await validatePrintFile(file);
            url = URL.createObjectURL(file);
            const im = await new Promise((resolve,reject) => {
                const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = url;
            });
            if (im.width * im.height > 40_000_000) throw new Error('Image too large');
            const preview=document.createElement('canvas'), factor=Math.min(1,720/Math.max(im.width,im.height));
            preview.width=Math.round(im.width*factor);preview.height=Math.round(im.height*factor);preview.getContext('2d').drawImage(im,0,0,preview.width,preview.height);
            const assetId=crypto.randomUUID();sources.set(assetId,file);
            const layer = Object.assign(fresh(), {id:++nextId,assetId,img:preview,file,name:sample ? 'Пример — мотылёк.png' : file.name});
            if (layers[key].length) {
                const slot = layers[key].length - 1;
                layer.x = 215 + slot % 3 * 85; layer.y = 265 + Math.floor(slot / 3) * 85; layer.scale = 42;
            } else if (sample) {
                layer.y = key === 'front' ? 280 : 326; layer.scale = key === 'front' ? 92 : 140;
            }
            layers[key].push(layer); selected[key] = layer.id;
            if (side === key && tab !== 'order') { if (tab !== 'print') openTab('print'); setMode('print'); }
            status(`${sideName(key)}: изображение добавлено.`); draw();
        } catch (error) { status('Не удалось открыть изображение. Выбери JPEG или PNG до 40 мегапикселей.', true); }
        finally { if (url) URL.revokeObjectURL(url); pending--; q('file').value = ''; draw(); }
    }

    all('[data-tab]').forEach(button => {
        button.onclick = () => openTab(button.dataset.tab);
        button.onkeydown = event => {
            const index = tabs.indexOf(button.dataset.tab);
            const next = {ArrowLeft:tabs[(index+2)%3],ArrowRight:tabs[(index+1)%3],Home:tabs[0],End:tabs[2]}[event.key];
            if (next) { event.preventDefault(); openTab(next,true); }
        };
    });
    all('[data-next]').forEach(button => { button.onclick = () => {
        if (!validColor()) return;
        openTab(button.dataset.next,true);
        const top = q('tab-'+button.dataset.next).getBoundingClientRect().top;
        if (top < 80 || top > window.innerHeight-70) q('tab-'+button.dataset.next).scrollIntoView({block:'center',behavior:'auto'});
    }; });
    all('[data-side]').forEach(button => { button.onclick = () => selectSide(button.dataset.side); });
    all('[data-garment]').forEach(button => { button.onclick = () => { q('garment').value = button.dataset.garment; draw(); }; });
    all('[data-color]').forEach(button => { button.onclick = () => setColor(button.dataset.color); });
    all('[data-size]').forEach(button => { button.onclick = () => { q('size').value = button.dataset.size; draw(); }; });
    q('fabric-picker').oninput = q('fabric-picker').onchange = event => setColor(event.target.value);
    q('fabric-hex').oninput = event => { if (/^#?[0-9a-f]{6}$/i.test(event.target.value.trim())) setColor(event.target.value); };
    q('fabric-hex').onchange = event => { const v = hex(event.target.value); if (v) setColor(v); else q('color-error').textContent = 'Укажи HEX, например #F08080.'; };
    for (const k of ['r','g','b']) q('fabric-'+k).oninput = () => {
        const a = ['r','g','b'].map(x => q('fabric-'+x).value);
        if (a.every(x => x !== '' && Number.isInteger(+x) && +x >= 0 && +x <= 255)) setColor('#'+a.map(x => (+x).toString(16).padStart(2,'0')).join(''));
        else q('color-error').textContent = 'R, G и B — числа от 0 до 255.';
    };
    async function addFiles(files, key) {
        for (const file of [...files]) {
            if (count() + pending >= limit) { status('На один макет можно добавить до 10 принтов.', true); break; }
            await loadFile(file, key);
        }
    }
    q('file').onchange = event => addFiles(event.target.files,side);
    const drop = q('drop');
    drop.ondragover = event => { event.preventDefault(); drop.classList.add('is-drop'); };
    drop.ondragleave = () => drop.classList.remove('is-drop');
    drop.ondrop = event => { event.preventDefault(); drop.classList.remove('is-drop'); addFiles(event.dataTransfer.files,side); };
    q('example').onclick = async () => {
        const key = side, button = q('example'); button.disabled = true;
        status('Загружаем пример…');
        try {
            const response = await fetch(root.dataset.sample);
            if (!response.ok) throw new Error('Example not available');
            await loadFile(await response.blob(),key,true);
        } catch (error) { status('Пример не загрузился. Можно выбрать свой файл.',true); }
        finally { draw(); }
    };
    q('scale').oninput = event => { sides[side].scale = +event.target.value; draw(); };
    q('angle').oninput = event => { sides[side].angle = +event.target.value; draw(); };
    q('reset').onclick = () => { Object.assign(sides[side],{x:300,y:340,scale:65,angle:0}); draw(); };
    q('layers').onchange = event => { selected[side] = +event.target.value; setMode('print'); draw(); };
    q('remove').onclick = () => {
        const stack = layers[side], index = stack.indexOf(active(side));
        if (index < 0) return;
        stack.splice(index, 1);
        selected[side] = stack[Math.min(index, stack.length - 1)]?.id ?? null;
        setMode(mode); status('Принт удалён.'); draw();
    };
    function reorder(step) {
        const stack = layers[side], index = stack.indexOf(active(side));
        if (index < 0 || !stack[index + step]) return;
        [stack[index], stack[index + step]] = [stack[index + step], stack[index]];
        draw();
    }
    q('layer-up').onclick = () => reorder(1);
    q('layer-down').onclick = () => reorder(-1);
    q('move-mode').onclick = () => setMode(mode === 'print' ? 'orbit' : 'print');
    const direction = {left:[-1,0],up:[0,-1],down:[0,1],right:[1,0]};
    all('[data-nudge]').forEach(button => { button.onclick = () => { const [x,y] = direction[button.dataset.nudge], s=sides[side]; move(side,s.x+x*5,s.y+y*5); }; });
    effectKeys.forEach(k => { q('effect-'+k).oninput = event => { const e = sides[side].effects; e[k] = typeof e[k] === 'number' ? +event.target.value : event.target.value; draw(); }; });
    for (const k of ['X','Y']) q('flip'+k).onclick = () => { const e = sides[side].effects; e['flip'+k] = !e['flip'+k]; draw(); };
    q('reset-effects').onclick = () => { sides[side].effects = defaults(); draw(); };
    q('zoom-in').onclick = () => viewer?.zoomBy(1.15); q('zoom-out').onclick = () => viewer?.zoomBy(1/1.15); q('reset-view').onclick = () => viewer?.reset();

    function save(blob,name) {
        if (!blob) { status('Файл не удалось сохранить. Попробуй ещё раз.',true); return; }
        const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href=url; a.download=name; a.click();
        setTimeout(() => URL.revokeObjectURL(url),10000);
    }
    function ready() {
        if (!validColor()) return false;
        if (!count()) { status('Сначала добавь принт во вкладке «Принт».',true); return false; }
        return true;
    }
    function pngBlob(canvas) {
        return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('PNG encoding failed')), 'image/png'));
    }

    async function processedBlob(layer){
        const url=URL.createObjectURL(layer.file);
        try{await validatePrintFile(layer.file);const image=new Image();image.src=url;await image.decode();const copy={...layer,img:image,cache:null};return await pngBlob(renderPrint(copy));}finally{URL.revokeObjectURL(url)}
    }
    async function packageProject(){
        if(pending)throw new Error("Дождись загрузки изображений.");
        const wasInert=root.inert;root.inert=true;try{
        if(!atlasImage)throw new Error('Макет ещё загружается. Попробуй через несколько секунд.');
        const exportFiles=[];
        for(const key of ['front','back']){
            const view=canvasLayer();garment(view.getContext('2d'),key,false);
            exportFiles.push({path:key+'.png',blob:await pngBlob(view)});
            for(const [index,layer] of layers[key].entries()){
                exportFiles.push({path:'prints/'+key+'-'+(index+1)+(layer.file.type==='image/jpeg'?'.jpg':'.png'),blob:layer.file});
                exportFiles.push({path:'prints/'+key+'-'+(index+1)+'-processed.png',blob:await processedBlob(layer)});
            }
        }
        const pair=document.createElement('canvas');pair.width=1200;pair.height=700;const context=pair.getContext('2d');garment(context,'front',false);context.translate(600,0);garment(context,'back',false);
        exportFiles.push({path:'mockup.png',blob:await pngBlob(pair)});
        const state=snapshot(),ids=new Set([...state.layers.front,...state.layers.back].map(l=>l.assetId));
        return {id:projectId,inCart:true,name:garmentName(),color:colorName(),snapshot:state,sources:[...sources].filter(([id])=>ids.has(id)),exportFiles,preview:exportFiles.find(f=>f.path===(layers.front.length?'front.png':'back.png')).blob};
        }finally{root.inert=wasInert}
    }
    q('download-order').onclick=async()=>{
        if(!ready()||pending)return;const button=q('download-order');button.disabled=true;status('Подготавливаем макет…');
        try{await persistCurrent();const project=await packageProject();const {prepareOrder}=await import('./order-export.js');await prepareOrder(document.querySelector('input[name=csrf]')?.value||root.dataset.csrf,project);status('')}
        catch(error){status(error.message||'Не удалось подготовить заказ. Макет сохранён.',true)}finally{button.disabled=false}
    };
    q('print-png').onclick = () => { const key=side, s=sides[key]; if (s.img) renderPrint(s).toBlob(blob=>save(blob,`our-souls-print-${key}.png`),'image/png'); };

    function flatPoint(event) { const r=cv.getBoundingClientRect();return {x:(event.clientX-r.left)*600/r.width,y:(event.clientY-r.top)*700/r.height}; }
    cv.onpointerdown = event => {
        if (tab !== 'print') return;
        const p=flatPoint(event), current=active(side);
        if(current.img){
            const d=dimensions(current),r=-current.angle*Math.PI/180,dx=p.x-current.x,dy=p.y-current.y,x=dx*Math.cos(r)-dy*Math.sin(r),y=dx*Math.sin(r)+dy*Math.cos(r),hit=24*600/cv.getBoundingClientRect().width;
            let kind=null;
            if(Math.hypot(x,y+d.h/2+28)<hit)kind='rotate';
            else if([-1,1].some(a=>[-1,1].some(b=>Math.hypot(x-a*d.w/2,y-b*d.h/2)<hit)))kind='scale';
            if(kind){drag={kind,original:{x:current.x,y:current.y,scale:current.scale,angle:current.angle},radius:Math.hypot(dx,dy),angle:Math.atan2(dy,dx)};cv.setPointerCapture(event.pointerId);event.preventDefault();return;}
        }
        let chosen=null;
        for (const layer of [...layers[side]].reverse()) {
            const d=dimensions(layer), angle=-layer.angle*Math.PI/180,dx=p.x-layer.x,dy=p.y-layer.y;
            const x=dx*Math.cos(angle)-dy*Math.sin(angle),y=dx*Math.sin(angle)+dy*Math.cos(angle);
            if(Math.abs(x)>d.w/2+12||Math.abs(y)>d.h/2+12)continue;
            if(Math.abs(x)<d.w/2&&Math.abs(y)<d.h/2){const raster=renderPrint(layer),px=Math.floor((x/d.w+.5)*raster.width),py=Math.floor((y/d.h+.5)*raster.height);if(raster.getContext('2d').getImageData(px,py,1,1).data[3]<16)continue;}
            chosen=layer;break;
        }
        if(!chosen)return;
        selected[side]=chosen.id;setMode('print');draw();
        cv.focus({preventScroll:true});cv.setPointerCapture(event.pointerId);
        drag={kind:'move',x:p.x-chosen.x,y:p.y-chosen.y,original:{x:chosen.x,y:chosen.y,scale:chosen.scale,angle:chosen.angle}};event.preventDefault();
    };
    cv.onpointermove = event => {
        if(!drag)return;const p=flatPoint(event),s=active(side);
        if(drag.kind==='scale'){s.scale=bounded(Math.round(drag.original.scale*Math.hypot(p.x-s.x,p.y-s.y)/Math.max(1,drag.radius)),15,160);draw()}
        else if(drag.kind==='rotate'){let value=drag.original.angle+(Math.atan2(p.y-s.y,p.x-s.x)-drag.angle)*180/Math.PI;value=(value+540)%360-180;s.angle=Math.round(value);draw()}
        else move(side,p.x-drag.x,p.y-drag.y);
    };
    cv.onpointerup = cv.onpointercancel = cv.onlostpointercapture = event => {if(drag){if(event.type==='pointercancel')Object.assign(active(side),drag.original);drag=null;draw()}};
    cv.onkeydown = event => {
        const m={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down'}[event.key];
        if (mode!=='print'||!m) return; event.preventDefault(); const [x,y]=direction[m],s=sides[side],step=event.shiftKey?10:2; move(side,s.x+x*step,s.y+y*step);
    };

    function syncTouchTarget(){
        const target=q('touch-target'),s=active(side);target.hidden=mode!=='print'||!s.img;
        if(target.hidden)return;
        const d=dimensions(s),r=cv.getBoundingClientRect(),host=q('viewport').getBoundingClientRect(),scale=r.width/600;
        target.style.width=(d.w+50)*scale+'px';target.style.height=(d.h+85)*scale+'px';
        target.style.left=(r.left-host.left+s.x*scale)+'px';target.style.top=(r.top-host.top+s.y*scale)+'px';
        target.style.transform=`translate(-50%,-50%) rotate(${s.angle}deg)`;
    }
    q('touch-target').onpointerdown=event=>cv.onpointerdown(event);
    q('import-button').onclick=()=>q('import-project').click();
    function snapshot(){return {id:projectId,version:7,templateVersion:'studio-photo-v1',canvas:{width:600,height:700},colorRGB:rgb(fabricColor),garment:q('garment').value,color:fabricColor,side,tab,size:q('size').value,quantity:bounded(Math.floor(+q('qty').value)||1,1,9999),comment:q('comment').value.slice(0,1000),selected:{...selected},nextId,layers:Object.fromEntries(['front','back'].map(key=>[key,layers[key].map(l=>({id:l.id,assetId:l.assetId,name:l.name,x:l.x,y:l.y,scale:l.scale,angle:l.angle,cx:l.x/600,cy:l.y/700,width:dimensions(l).w/600,height:dimensions(l).h/700,rotation:l.angle,effects:{...l.effects}}))]))};}
    function updateDraftControls(){q('undo').disabled=!history.canUndo||restoring;q('redo').disabled=!history.canRedo||restoring;}
    async function restoreSnapshot(state){
        restoring=true;const decoded={};
        try{
            for(const key of ['front','back']){
                const stack=[];
                for(const data of state.layers[key]){
                    const file=sources.get(data.assetId);if(!file)throw new Error('В черновике отсутствует файл принта.');
                    const old=layers[key].find(l=>l.assetId===data.assetId);
                    let img=old?.img;
                    if(!img){await validatePrintFile(file);const url=URL.createObjectURL(file);try{const im=new Image();im.src=url;await im.decode();const ratio=Math.min(1,720/Math.max(im.width,im.height));img=document.createElement('canvas');img.width=Math.round(im.width*ratio);img.height=Math.round(im.height*ratio);img.getContext('2d').drawImage(im,0,0,img.width,img.height)}finally{URL.revokeObjectURL(url)}}
                    stack.push({...data,effects:{...data.effects},file,img});
                }
                decoded[key]=stack;
            }
            for(const key of ['front','back']){layers[key].splice(0,layers[key].length,...decoded[key]);selected[key]=state.selected[key]}
            projectId=state.id||crypto.randomUUID();
            nextId=state.nextId;q('garment').value=state.garment;q('size').value=state.size;q('qty').value=state.quantity;q('comment').value=state.comment;side=state.side;tab=state.tab||'garment';
            setColor(state.color);openTab(tab);draw();
        }finally{restoring=false;updateDraftControls()}
    }
    function scheduleSave(){
        if(restoring||pending||drag)return;
        clearTimeout(saveTimer);saveTimer=setTimeout(async()=>{
            if(restoring||pending||drag)return;
            const state=snapshot(),changed=history.push(state);updateDraftControls();if(!changed)return;const retained=history.referencedAssets;for(const id of sources.keys())if(!retained.has(id))sources.delete(id);
            const revision=++persistToken;q('draft-status').textContent='Сохраняем…';
            try{const ids=new Set([...state.layers.front,...state.layers.back].map(l=>l.assetId));await drafts.save({id:'current',snapshot:state,sources:[...sources].filter(([id])=>ids.has(id))});if(revision===persistToken)q('draft-status').textContent='Сохранено на этом устройстве'}
            catch{q('draft-status').textContent='Не удалось сохранить. Скачай файл заказа перед выходом';}
        },450);
    }
    function renderThumbnails(){
        const host=q('layer-thumbs'), signature=side+':'+layers[side].map(l=>l.id).join(',')+':'+selected[side];if(host.dataset.signature===signature)return;host.dataset.signature=signature;
        host.replaceChildren(...layers[side].map(l=>{const b=document.createElement('button');b.type='button';b.title=l.name;b.setAttribute('aria-label','Выбрать '+l.name);b.setAttribute('aria-pressed',String(l.id===selected[side]));const im=document.createElement('img');const thumb=document.createElement('canvas');thumb.width=72;thumb.height=72;const ratio=Math.min(72/l.img.width,72/l.img.height);thumb.getContext('2d').drawImage(l.img,(72-l.img.width*ratio)/2,(72-l.img.height*ratio)/2,l.img.width*ratio,l.img.height*ratio);im.src=thumb.toDataURL();im.alt='';b.append(im);b.onclick=()=>{selected[side]=l.id;setMode('print');draw()};return b}));
    }
    q('undo').onclick=async()=>{const state=history.undo();if(state){clearTimeout(saveTimer);await restoreSnapshot(state);await persistCurrent()}};
    q('redo').onclick=async()=>{const state=history.redo();if(state){clearTimeout(saveTimer);await restoreSnapshot(state);await persistCurrent()}};
    async function persistCurrent(){try{const state=snapshot(),ids=new Set([...state.layers.front,...state.layers.back].map(l=>l.assetId));await drafts.save({id:'current',snapshot:state,sources:[...sources].filter(([id])=>ids.has(id))});q('draft-status').textContent='Сохранено на этом устройстве'}catch{q('draft-status').textContent='Не удалось сохранить черновик'}}
    q('duplicate').onclick=()=>{if(count()>=limit)return status('На макете уже 10 принтов.',true);const l=active(side);if(!l.img)return;const copy={...l,id:++nextId,x:l.x+18,y:l.y+18,effects:{...l.effects},cache:null};layers[side].push(copy);selected[side]=copy.id;draw()};
    q('new-design').onclick=()=>{projectId=crypto.randomUUID();for(const key of ['front','back']){layers[key].splice(0);selected[key]=null}q('comment').value='';openTab('garment');draw();status('Новый макет. Предыдущий можно вернуть кнопкой «Отменить».')};
    q('to-cart').onclick=async()=>{
        if(!ready())return;q('to-cart').disabled=true;
        try{const project=await packageProject();await drafts.save(project);window.location.href='/cart/'}catch(error){status(error.message||'Не удалось добавить макет. Можно скачать заказ прямо здесь.',true)}finally{q('to-cart').disabled=false}
    };
    root.querySelector('.os-project-menu')?.addEventListener('click',event=>{if(event.target.closest('button'))event.currentTarget.open=false});
    q('import-project').onchange=async event=>{
        const file=event.target.files[0];if(!file)return;status('Открываем проект…');
        try{const {importDesignArchive}=await import('./project-import.js');const projects=await importDesignArchive(file);
            const open=async project=>{for(const [id,source] of project.sources)sources.set(id,source);await restoreSnapshot(project.state);history.push(snapshot());await persistCurrent();draw();status('Проект открыт.');};
            if(projects.length===1)await open(projects[0]);else{const select=q('import-choice');select.hidden=false;select.replaceChildren(new Option('Выбери макет из заказа',''),...projects.map((p,i)=>new Option((p.state.garment==='tee'?'Футболка':p.state.garment==='long'?'Лонгслив':'Худи')+' · '+p.state.size+' · '+(i+1),String(i))));select.onchange=()=>{if(select.value!==''){open(projects[+select.value]);select.hidden=true}};status('В архиве несколько макетов. Выбери нужный.');}
        }catch(error){status(error.message||'Не удалось открыть проект.',true)}finally{event.target.value=''}
    };
    root.addEventListener('change',()=>{if(!restoring)scheduleSave()});
    q('comment').addEventListener('input',scheduleSave);q('qty').addEventListener('input',()=>{renderReview();scheduleSave()});
    document.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'&&!['INPUT','TEXTAREA'].includes(event.target.tagName)){event.preventDefault();(event.shiftKey?q('redo'):q('undo')).click()}});
    function usePhoto() {
        viewer=null; fallback=true; q('webgl').hidden=true; cv.hidden=false; q('zoom-tools').hidden=true;
        q('render-mode').textContent='Фотографический 2D'; q('loading').hidden=true; q('viewport').setAttribute('aria-busy','false');
        setMode(mode); draw();
        if (!atlasImage && root.dataset.atlas) {
            const im = new Image(); im.onload=()=>{atlasImage=im;draw();}; im.onerror=()=>{photoError=true;draw();}; im.src=root.dataset.atlas;
        }
    }
    let fittingRoom;
    const openFitting = q('open-fitting');
    openFitting.onclick = async () => {
        openFitting.disabled = true;
        try {
            if (!fittingRoom) {
                const {createFittingRoom} = await import('../fitting/photo-fitting.js?v=1');
                fittingRoom = createFittingRoom(q('fitting'), {
                    side: () => side,
                    kind: () => q('garment').value,
                    garment(which) {
                        if (!atlasImage) throw new Error('Предпросмотр одежды загружается. Попробуй ещё раз.');
                        const preview = canvasLayer();
                        garment(preview.getContext('2d'), which, false, true);
                        return preview;
                    },
                });
            }
            await fittingRoom.open();
        } catch { status('Примерочная пока недоступна. Попробуй ещё раз.', true); }
        finally { openFitting.disabled = false; }
    };
    if (document.getElementById('fitting-product')) openFitting.click();
    setColor(fabricColor);
    function fitCanvas(){const box=q('viewport'),w=Math.min(box.clientWidth,box.clientHeight*6/7);cv.style.width=w+'px';cv.style.height=w*7/6+'px';syncTouchTarget();}
    new ResizeObserver(fitCanvas).observe(q('viewport'));fitCanvas();
    usePhoto();
    try {
        const stored=await drafts.load('current');
        if(stored?.snapshot){for(const [key,file] of stored.sources)sources.set(key,file);await restoreSnapshot(stored.snapshot);q('draft-status').textContent='Черновик восстановлен';}
    } catch {q('draft-status').textContent='Автосохранение недоступно — сохрани файл перед выходом';}
    restoring=false;root.inert=false;history.push(snapshot());updateDraftControls();
})();
