function canvas(width, height) {
    const node = document.createElement('canvas');
    node.width = width;
    node.height = height;
    return node;
}
const between = (value, min, max) => Math.max(min, Math.min(max, value));

async function decode(file, maximum = 1200) {
    const url = URL.createObjectURL(file);
    try {
        const image = new Image();
        image.src = url;
        await image.decode();
        if (image.naturalWidth * image.naturalHeight > 40_000_000) throw new Error('Снимок слишком большой.');
        const scale = Math.min(1, maximum / Math.max(image.naturalWidth, image.naturalHeight));
        const output = canvas(Math.max(1,Math.round(image.naturalWidth*scale)),Math.max(1,Math.round(image.naturalHeight*scale)));
        output.getContext('2d').drawImage(image,0,0,output.width,output.height);
        return output;
    } finally { URL.revokeObjectURL(url); }
}

function crop(source) {
    const {width,height}=source;
    const pixels=source.getContext('2d').getImageData(0,0,width,height).data;
    let left=width,top=height,right=-1,bottom=-1;
    for (let y=0;y<height;y++) for (let x=0;x<width;x++) {
        if (pixels[(y*width+x)*4+3]<28) continue;
        left=Math.min(left,x); right=Math.max(right,x);
        top=Math.min(top,y); bottom=Math.max(bottom,y);
    }
    if (right-left<10 || bottom-top<10) throw new Error('Не удалось выделить одежду на снимке товара.');
    const result=canvas(right-left+1,bottom-top+1);
    result.getContext('2d').drawImage(source,left,top,result.width,result.height,0,0,result.width,result.height);
    return result;
}

async function catalogueCutout(url) {
    const response=await fetch(url,{credentials:'omit'});
    if (!response.ok) throw new Error('Фотография товара не загрузилась.');
    const source=await decode(await response.blob(),640);
    const {width,height}=source, ctx=source.getContext('2d',{willReadFrequently:true});
    const image=ctx.getImageData(0,0,width,height), {data}=image;
    // Product photos use a studio backdrop. Flood only the connected background,
    // keeping pale and coloured details inside the garment.
    const corners=[0,width-1,(height-1)*width,width*height-1].map(i=>Array.from(data.slice(i*4,i*4+3)));
    const visited=new Uint8Array(width*height), queue=new Uint32Array(width*height);
    let head=0,tail=0;
    function visit(i) {
        if (visited[i]) return;
        visited[i]=1;
        const at=i*4;
        const background=data[at+3]<24 || corners.some(c=>Math.hypot(data[at]-c[0],data[at+1]-c[1],data[at+2]-c[2])<52);
        if (background) queue[tail++]=i;
    }
    for (let x=0;x<width;x++) {visit(x); visit((height-1)*width+x);}
    for (let y=0;y<height;y++) {visit(y*width); visit(y*width+width-1);}
    while (head<tail) {
        const i=queue[head++], x=i%width, y=Math.floor(i/width);
        data[i*4+3]=0;
        if (x) visit(i-1);
        if (x<width-1) visit(i+1);
        if (y) visit(i-width);
        if (y<height-1) visit(i+width);
    }
    if (tail < width*height*.14 || tail > width*height*.92) {
        throw new Error('Для этой фотографии не удалось отделить фон. Попробуй режим «Мой макет».');
    }
    ctx.putImageData(image,0,0);
    return crop(source);
}

function poseFrom(points, width, height) {
    const [a,b]=[points?.[11],points?.[12]];
    if (!a || !b || Math.min(a.visibility,b.visibility)<.55) return null;
    const [left,right]=a.x<b.x?[a,b]:[b,a];
    const dx=(right.x-left.x)*width,dy=(right.y-left.y)*height;
    const span=Math.hypot(dx,dy);
    if (span < width*.075 || Math.abs(Math.atan2(dy,dx))>.75) return null;
    return {
        x:between((left.x+right.x)*50,0,100),
        y:between((left.y+right.y)*50,0,100),
        scale:between(span/width*100/.52,10,155),
        angle:between(Math.atan2(dy,dx)*180/Math.PI,-45,45),
    };
}

export function createFittingRoom(dialog, studio) {
    const select = name => dialog.querySelector('[data-fit-'+name+']');
    const canvasOut=select('canvas'), context=canvasOut.getContext('2d');
    const status=message=>{select('status').textContent=message;};
    const productScript=dialog.querySelector('#fitting-product');
    const product=productScript ? JSON.parse(productScript.textContent) : null;
    const slider=key=>dialog.querySelector('[data-fit-adjust="'+key+'"]');
    const adjustments={x:50,y:39,scale:53,angle:0};
    const isProduct=()=>select('source')?.value==='product';
    const isBack=()=>select('side').value==='back';
    let photo, garment, productArt, worker, pendingPose, photoSequence=0, renderSequence=0, mode='photo';
    let pointer=null;

    function setSliders(values) {
        Object.assign(adjustments,values);
        for (const key of Object.keys(adjustments)) slider(key).value=adjustments[key];
    }
    function present(image) {
        canvasOut.width=image.width;
        canvasOut.height=image.height;
        context.drawImage(image,0,0);
        canvasOut.hidden=false;
        select('empty').hidden=true;
        select('save').disabled=false;
    }
    function blank(message) {
        canvasOut.hidden=true;
        select('empty').hidden=false;
        select('empty').textContent=message;
        select('save').disabled=true;
    }
    function drawPhoto() {
        if (!photo || mode!=='photo') return;
        present(photo);
        select('save').disabled=!garment;
        if (!garment) return;
        const w=photo.width*adjustments.scale/100, h=w*garment.height/garment.width;
        const shoulder=isProduct() ? 0.14 : studio.kind()==='hoodie' ? 0.28 : 0.14;
        context.save();
        context.translate(photo.width*adjustments.x/100,photo.height*adjustments.y/100);
        context.rotate(adjustments.angle*Math.PI/180);
        context.drawImage(garment,-w/2,-h*shoulder,w,h);
        context.restore();
    }
    async function refreshPhoto() {
        if (!photo || mode!=='photo') return;
        const request=++renderSequence;
        garment=null;
        drawPhoto();
        try {
            if (isProduct() && isBack()) {
                status('В карточке используется передний ракурс. Для спины выбери макет конструктора.');
                return;
            }
            const image=isProduct()
                ? (productArt || (productArt=await catalogueCutout(product.image)))
                : crop(studio.garment(select('side').value));
            if (request!==renderSequence) return;
            garment=image;
            drawPhoto();
            status('Передвинь одежду на снимке или уточни положение ползунками.');
        } catch(error) {
            if (request===renderSequence) status(error.message || 'Не удалось подготовить одежду.');
        }
    }
    function endPose() {
        worker?.terminate();
        worker=null;
        pendingPose?.reject(new Error('Cancelled'));
        pendingPose=null;
    }
    async function loadPhoto(file) {
        if (!file) return;
        const ticket=++photoSequence;
        endPose();
        select('auto').disabled=true;
        status('Открываем снимок…');
        try {
            if (file.size>16*1024*1024) throw new Error('Выбери снимок размером до 16 МБ.');
            const image=await decode(file);
            if (ticket!==photoSequence) return;
            photo=image;
            setSliders({x:50,y:39,scale:53,angle:0});
            select('sliders').hidden=false;
            await refreshPhoto();
        } catch(error) {
            if (ticket===photoSequence) status(error.message || 'Не удалось открыть снимок.');
        } finally {
            if (ticket===photoSequence) select('auto').disabled=!photo;
        }
    }
    async function locatePose() {
        if (!photo) return;
        const ticket=photoSequence;
        select('auto').disabled=true;
        status('Определяем положение плеч на этом устройстве…');
        try {
            worker ||= new Worker(new URL('./pose/worker.js',import.meta.url));
            const bitmap=await createImageBitmap(photo);
            if (ticket!==photoSequence) { bitmap.close(); return; }
            const points=await new Promise((resolve,reject)=>{
                const timeout=setTimeout(()=>{
                    worker?.terminate(); worker=null;
                    finish(new Error('Pose timeout'));
                },45000);
                function finish(error,points) {
                    clearTimeout(timeout);
                    if (error) reject(error); else resolve(points);
                }
                pendingPose={reject:error=>finish(error)};
                worker.onmessage=({data})=>finish(data.error?new Error('Pose unavailable'):null,data.points);
                worker.onerror=error=>{worker?.terminate(); worker=null; finish(error);};
                try {worker.postMessage(bitmap,[bitmap]);}
                catch(error) {bitmap.close(); finish(error);}
            });
            if (ticket!==photoSequence) return;
            const placement=poseFrom(points,photo.width,photo.height);
            if (!placement) {
                status('Плечи на снимке не распознаны. Поставь одежду вручную.');
                return;
            }
            setSliders(placement);
            drawPhoto();
            status('Положение обновлено. Поправь его ползунками, если нужно.');
        } catch {
            if (ticket===photoSequence) status('Автоподгонка недоступна. Можно настроить положение вручную.');
        } finally {
            if (ticket===photoSequence) {
                pendingPose=null;
                select('auto').disabled=false;
            }
        }
    }
    async function renderAvatar(event) {
        event?.preventDefault();
        const form=select('measures');
        if (!form.reportValidity()) return;
        const ticket=++renderSequence;
        const button=form.querySelector('button');
        button.disabled=true;
        status('Готовим 3D-ракурс…');
        try {
            const profile=Object.fromEntries([...new FormData(form)].map(([key,value])=>[key,Number(value)]));
            const image=await studio.avatar(profile);
            if (ticket!==renderSequence || !dialog.open) return;
            present(image);
            status(isProduct()?'На 3D-модели показан макет конструктора. Товар из каталога можно примерить на фото.':'Показан макет конструктора с выбранными пропорциями.');
        } catch(error) {
            if (ticket===renderSequence) status(error.message || 'Не удалось подготовить 3D-ракурс.');
        } finally { button.disabled=false; }
    }
    function switchMode(next) {
        mode=next;
        renderSequence++;
        for (const node of dialog.querySelectorAll('[data-fit-mode]')) node.setAttribute('aria-pressed',String(node.dataset.fitMode===next));
        for (const node of dialog.querySelectorAll('[data-fit-panel]')) node.hidden=node.dataset.fitPanel!==next;
        status('');
        if (next==='photo') {
            blank('Добавь фото, чтобы примерить одежду.');
            if (photo) refreshPhoto();
        } else {
            blank('Укажи мерки и выбери ракурс.');
            renderAvatar();
        }
    }

    for (const button of dialog.querySelectorAll('[data-fit-mode]')) button.onclick=()=>switchMode(button.dataset.fitMode);
    for (const key of ['file','camera']) select(key).onchange=event=>{
        loadPhoto(event.target.files[0]); event.target.value='';
    };
    select('side').onchange=refreshPhoto;
    if (select('source')) select('source').onchange=()=>mode==='photo'?refreshPhoto():renderAvatar();
    select('auto').onclick=locatePose;
    select('measures').onsubmit=renderAvatar;
    for (const key of Object.keys(adjustments)) slider(key).oninput=event=>{
        adjustments[key]=Number(event.target.value);
        drawPhoto();
    };
    canvasOut.onpointerdown=event=>{
        if (mode!=='photo' || !garment || event.button!==0) return;
        pointer={x:event.clientX,y:event.clientY};
        canvasOut.setPointerCapture(event.pointerId);
    };
    canvasOut.onpointermove=event=>{
        if (!pointer) return;
        const box=canvasOut.getBoundingClientRect();
        setSliders({x:between(adjustments.x+(event.clientX-pointer.x)/box.width*100,0,100),
                    y:between(adjustments.y+(event.clientY-pointer.y)/box.height*100,0,100)});
        pointer={x:event.clientX,y:event.clientY};
        drawPhoto();
    };
    canvasOut.onpointerup=canvasOut.onpointercancel=canvasOut.onlostpointercapture=()=>{pointer=null;};
    select('save').onclick=()=>canvasOut.toBlob(blob=>{
        if (!blob) return;
        const link=document.createElement('a'), url=URL.createObjectURL(blob);
        link.href=url; link.download='our-souls-fitting.png'; link.click();
        setTimeout(()=>URL.revokeObjectURL(url),3000);
    },'image/png');
    if (select('size')) select('size').onclick=()=>{
        const field=select('chest');
        if (!field.value || !field.checkValidity()) {
            select('size-result').textContent='Укажи обхват груди от 60 до 160 см.';
            return;
        }
        const chest=Number(field.value);
        const candidates=Object.entries(product.measurements).map(([name,width])=>({name,ease:width*2-chest}))
            .filter(size=>size.ease>=6).sort((a,b)=>a.ease-b.ease);
        select('size-result').textContent=candidates.length
            ? 'Для свободного облегания ориентир — '+candidates[0].name+' (запас '+Math.round(candidates[0].ease)+' см по груди).'
            : 'Среди измеренных размеров нет варианта с запасом от 6 см по груди.';
    };
    dialog.addEventListener('close',()=>{
        photoSequence++; renderSequence++; endPose();
        photo=null; garment=null; pointer=null;
        canvasOut.width=1; canvasOut.height=1;
        select('auto').disabled=true; select('sliders').hidden=true;
        switchMode('photo');
    });
    return {open() {
        if (!dialog.open) dialog.showModal();
        select('side').value=isProduct()?'front':studio.side();
        if (mode==='photo') refreshPhoto();
    }};
}
