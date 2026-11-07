(() => {
    'use strict';
    const root = document.getElementById('our-print');
    if (!root || root.dataset.ready) return;
    root.dataset.ready = '1';
    const q = id => root.querySelector('#op-' + id);
    const all = selector => [...root.querySelectorAll(selector)];
    const cv = q('canvas'), ctx = cv.getContext('2d');
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
        const raw = s.cache ? s.cache.raw : document.createElement('canvas');
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
        s.cache = {key,raw,output}; return output;
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
        const bg = c.createRadialGradient(300,300,20,300,350,480);
        bg.addColorStop(0,'#fafaf7'); bg.addColorStop(1,'#e5e5df');
        if (!transparent) { c.fillStyle = bg; c.fillRect(0,0,600,700); }
        const photo = coloredPhoto(which);
        c.textAlign = 'center'; c.fillStyle = '#52604d';
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
                c.strokeRect(-d.w/2-4,-d.h/2-4,d.w+8,d.h+8); c.restore();
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
    function syncPreview() {
        if (viewer) {
            viewer.setGarment(q('garment').value); viewer.setColor(fabricColor);
            for (const key of ['front','back']) {
                const stack = layers[key];
                for (const layer of stack) { clamp(layer); renderPrint(layer); }
                const stamp = JSON.stringify(stack.map(s => [s.id, s.x, s.y, s.scale, s.angle, s.cache.key]));
                viewer.setPrint(key, c => stack.forEach(s => paintLayer(c, s)), stamp);
            }
        } else if (fallback) garment(ctx,side,mode === 'print');
    }
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
        q('position').textContent = s.img ? `${sideName(side)} · ${s.scale}% · ${s.angle}°` : sideName(side);
        syncPreview();
    }
    function selectSide(next, orient = true) {
        if (next === side && !orient) return;
        side = next; q('file').value = '';
        if (viewer) { if (orient) viewer.showSide(next); else viewer.syncSide(next); }
        setMode(mode); status(''); draw();
    }
    const narrowStudio = matchMedia('(max-width: 850px)');
    function syncPanels() {
        q('panel-garment').hidden = narrowStudio.matches && tab !== 'garment';
        q('panel-print').hidden = tab === 'order' || (narrowStudio.matches && tab !== 'print');
        q('panel-order').hidden = tab !== 'order';
        q('panel-print').closest('.os-studio-settings').hidden = narrowStudio.matches && tab === 'garment';
    }
    narrowStudio.addEventListener('change', syncPanels);
    syncPanels();
    function openTab(next, focus = false) {
        tab = next;
        for (const key of tabs) {
            const selected = key === next, button = q('tab-'+key);
            button.setAttribute('aria-selected', String(selected)); button.tabIndex = selected ? 0 : -1;

        }
        syncPanels();
        if (next !== 'print') setMode('orbit');
        if (focus) q('tab-'+next).focus({preventScroll:true});
        status(''); draw();
    }
    function move(key, x, y) {
        const s = sides[key]; if (!s.img) return;
        s.x = x; s.y = y; clamp(s); syncPreview();
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
            url = URL.createObjectURL(file);
            const im = await new Promise((resolve,reject) => {
                const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = url;
            });
            if (im.width * im.height > 40_000_000) throw new Error('Image too large');
            const layer = Object.assign(fresh(), {id:++nextId,img:im,file,name:sample ? 'Пример — мотылёк.png' : file.name});
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

    q('download-order').onclick = async () => {
        if (!ready() || pending) return;
        const button = q('download-order');
        button.disabled = true;
        status('Собираем архив заказа…');
        try {
            let mockup;
            if (viewer) mockup = viewer.exportPair();
            else {
                if (!atlasImage) throw new Error('Preview unavailable');
                mockup = document.createElement('canvas'); mockup.width = 1200; mockup.height = 700;
                const c = mockup.getContext('2d');
                garment(c,'front',false); c.translate(600,0); garment(c,'back',false);
            }
            const qty = bounded(Math.floor(+q('qty').value) || 1,1,9999); q('qty').value = qty;
            const data = { version:6, mockupStyle:viewer?'garment-3d-v1':'studio-photo-v1', createdAt:new Date().toISOString(),
                garment:garmentName(), garmentId:q('garment').value, color:colorName(), colorHex:fabricColor,
                colorRGB:rgb(fabricColor), size:q('size').value, quantity:qty, comment:q('comment').value,
                canvas:{width:600,height:700}, printArea:{x:45,y:72,w:510,h:548,clip:viewer?'garment-mesh':'garment-silhouette'},
                mockup:'mockup.png', sides:{} };
            const files = [], encodings = [];
            for (const key of ['front','back']) {
                data.sides[key] = layers[key].map((s, index) => {
                    const prefix = 'prints/' + key + '-' + (index + 1);
                    const source = prefix + (s.file.type === 'image/jpeg' ? '.jpg' : '.png');
                    const processed = prefix + '-processed.png';
                    files.push([source, s.file]);
                    encodings.push(pngBlob(renderPrint(s)).then(blob => [processed, blob]));
                    const {name, x, y, scale, angle, effects} = s;
                    return {fileName:name, source, processed, x, y, scale, angle, effects:{...effects}};
                });
            }
            encodings.push(pngBlob(mockup).then(blob => ['mockup.png', blob]));
            files.push(['order.json',new Blob([JSON.stringify(data,null,2)], {type:'application/json'})]);
            const [{createArchive}, images] = await Promise.all([import(root.dataset.archive), Promise.all(encodings)]);
            save(await createArchive([...files, ...images]), 'our-souls-order.zip');
            status('');
            q('send-dialog').showModal();
        } catch (error) { status('Не удалось собрать архив. Попробуй ещё раз.',true); }
        finally { button.disabled = false; }
    };
    q('print-png').onclick = () => { const key=side, s=sides[key]; if (s.img) renderPrint(s).toBlob(blob=>save(blob,`our-souls-print-${key}.png`),'image/png'); };

    function flatPoint(event) { const r=cv.getBoundingClientRect();return {x:(event.clientX-r.left)*600/r.width,y:(event.clientY-r.top)*700/r.height}; }
    cv.onpointerdown = event => {
        const s=sides[side]; if (mode!=='print'||!s.img) return;
        cv.focus({preventScroll:true}); cv.setPointerCapture(event.pointerId);
        const p=flatPoint(event); drag={x:p.x-s.x,y:p.y-s.y}; event.preventDefault();
    };
    cv.onpointermove = event => { if (drag) { const p=flatPoint(event); move(side,p.x-drag.x,p.y-drag.y); } };
    cv.onpointerup = cv.onpointercancel = cv.onlostpointercapture = () => { drag=null; };
    cv.onkeydown = event => {
        const m={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down'}[event.key];
        if (mode!=='print'||!m) return; event.preventDefault(); const [x,y]=direction[m],s=sides[side],step=event.shiftKey?10:2; move(side,s.x+x*step,s.y+y*step);
    };

    function usePhoto() {
        viewer=null; fallback=true; q('webgl').hidden=true; cv.hidden=false; q('zoom-tools').hidden=true;
        q('render-mode').textContent='Студийный вид'; q('loading').hidden=true; q('viewport').setAttribute('aria-busy','false');
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
                const {createFittingRoom} = await import('../fitting/fitting.js?v=2');
                fittingRoom = createFittingRoom(q('fitting'), {
                    side: () => side,
                    kind: () => q('garment').value,
                    garment(which) {
                        if (viewer) return viewer.exportGarment(which);
                        if (!atlasImage) throw new Error('Предпросмотр одежды загружается. Попробуй ещё раз.');
                        const preview = canvasLayer();
                        garment(preview.getContext('2d'), which, false, true);
                        return preview;
                    },
                    avatar(profile) {
                        if (!viewer) throw new Error('Для 3D-примерки нужен WebGL. Можно примерить на фото.');
                        return viewer.fittingSnapshot(profile);
                    },
                });
            }
            await fittingRoom.open();
        } catch { status('Примерочная пока недоступна. Попробуй ещё раз.', true); }
        finally { openFitting.disabled = false; }
    };
    if (document.getElementById('fitting-product')) openFitting.click();
    setColor(fabricColor);
    if (root.dataset.viewer) {
        import(root.dataset.viewer).then(module => {
            viewer = module.createViewer(q('webgl'), {
                facing: key => selectSide(key,false),
                position: key => sides[key].img ? sides[key] : null,
                move,
                unavailable: usePhoto,
            });
            cv.hidden=true; q('webgl').hidden=false; q('loading').hidden=true; q('zoom-tools').hidden=false;
            q('render-mode').textContent='Интерактивное 3D'; q('viewport').setAttribute('aria-busy','false');
            if (side==='back') viewer.showSide(side,false);
            setMode(mode); draw(); viewer.resize();
        }).catch(usePhoto);
    } else usePhoto();
})();