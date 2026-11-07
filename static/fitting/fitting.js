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

function poseFrom(points, width, height, shoulderShare = .52) {
    const [a,b]=[points?.[11],points?.[12]];
    if (!a || !b || Math.min(a.visibility,b.visibility)<.55) return null;
    const [left,right]=a.x<b.x?[a,b]:[b,a];
    const dx=(right.x-left.x)*width,dy=(right.y-left.y)*height;
    const span=Math.hypot(dx,dy);
    if (span < width*.075 || Math.abs(Math.atan2(dy,dx))>.75) return null;
    return {
        x:between((left.x+right.x)*50,0,100),
        y:between((left.y+right.y)*50,0,100),
        scale:between(span/width*100/shoulderShare,10,155),
        angle:between(Math.atan2(dy,dx)*180/Math.PI,-45,45),
    };
}

export function createFittingRoom(dialog, studio) {
    const select = name => dialog.querySelector('[data-fit-'+name+']');
    const productScript=dialog.querySelector('#fitting-product');
    const product=productScript ? JSON.parse(productScript.textContent) : null;
    const views={photo:select('photo-canvas'),avatar:select('avatar-canvas')};
    const contexts={photo:views.photo.getContext('2d'),avatar:views.avatar.getContext('2d')};
    const slider=key=>dialog.querySelector('[data-fit-adjust="'+key+'"]');
    const adjustments={x:50,y:39,scale:53,angle:0};
    const isProduct=()=>select('source')?.value==='product';
    let mode=product?'photo':'avatar';
    let photo=null,garment=null,productArt=null,worker=null,pendingPose=null;
    let photoSequence=0,renderSequence=0,poseSequence=0,pointer=null,pageOverflow='',updateTimer;
    const status=message=>{select('status').textContent=message;};
    const current=ticket=>ticket===renderSequence && dialog.open;
    function setSliders(values) {
        Object.assign(adjustments,values);
        for (const key of Object.keys(adjustments)) {
            slider(key).value=adjustments[key];
            dialog.querySelector('[data-fit-value="'+key+'"]').textContent=Math.round(adjustments[key])+(key==='angle'?'°':'%');
        }
    }
    function blank(which,message) {
        views[which].hidden=true;
        select(which+'-empty').hidden=false;
        select(which+'-empty').textContent=message;
        if(mode===which) select('save').disabled=true;
    }
    function present(which,image) {
        const target=views[which];
        target.width=image.width;target.height=image.height;
        contexts[which].setTransform(1,0,0,1,0,0);
        contexts[which].clearRect(0,0,target.width,target.height);
        contexts[which].drawImage(image,0,0);
        target.hidden=false;select(which+'-empty').hidden=true;
        if(mode===which) select('save').disabled=false;
    }
    function drawPhoto() {
        if(!photo || mode!=='photo' || !dialog.open) return;
        present('photo',photo);
        select('save').disabled=!garment;
        if(!garment) return;
        const w=photo.width*adjustments.scale/100,h=w*garment.height/garment.width;
        const shoulder=isProduct() ? .14 : studio.kind()==='tee' ? .14 : .17;
        const context=contexts.photo;
        context.save();context.translate(photo.width*adjustments.x/100,photo.height*adjustments.y/100);
        context.rotate(adjustments.angle*Math.PI/180);
        context.drawImage(garment,-w/2,-h*shoulder,w,h);context.restore();
    }
    async function refreshPhoto() {
        if(!photo || mode!=='photo' || !dialog.open) return;
        const ticket=++renderSequence;garment=null;drawPhoto();
        try {
            if(isProduct() && select('side').value==='back') {
                status('У товара есть фото только спереди. Для спины выбери свой макет.');return;
            }
            const image=isProduct() ? (productArt || (productArt=await catalogueCutout(product.image)))
                : crop(studio.garment(select('side').value));
            if(!current(ticket) || mode!=='photo') return;
            garment=image;drawPhoto();
            status('Подгони одежду по фигуре кнопкой ниже или перетащи её вручную.');
        } catch(error) {if(current(ticket) && mode==='photo') status(error.message || 'Не удалось подготовить одежду.');}
    }
    function endPose() {
        poseSequence++;worker?.terminate();worker=null;
        pendingPose?.reject(new Error('Cancelled'));pendingPose=null;
    }
    function clearPhoto() {
        photoSequence++;renderSequence++;endPose();photo=null;garment=null;pointer=null;
        views.photo.width=1;views.photo.height=1;
        select('sliders').hidden=true;select('photo-actions').hidden=true;
        select('auto').disabled=true;select('file-name').textContent='JPG, PNG или WebP · до 16 МБ';
        blank('photo','Добавь фото анфас с опущенными руками. Плечи и бёдра должны быть в кадре.');
        if(mode==='photo') status('');
    }
    async function loadPhoto(file) {
        if(!file) return;
        const ticket=++photoSequence;endPose();select('auto').disabled=true;
        status('Открываем фото…');
        try {
            if(file.size>16*1024*1024) throw new Error('Выбери фото размером до 16 МБ.');
            const image=await decode(file);
            if(ticket!==photoSequence || !dialog.open) return;
            photo=image;select('file-name').textContent=file.name;
            setSliders({x:50,y:39,scale:53,angle:0});
            select('sliders').hidden=false;select('photo-actions').hidden=false;
            if(mode==='photo') await refreshPhoto();
        } catch(error) {if(ticket===photoSequence && mode==='photo') status(error.message || 'Не удалось открыть фото.');}
        finally {if(ticket===photoSequence) select('auto').disabled=!photo;}
    }
    async function locatePose() {
        if(!photo || mode!=='photo') return;
        const ticket=photoSequence,poseTicket=++poseSequence;
        const valid=()=>ticket===photoSequence && poseTicket===poseSequence && mode==='photo' && dialog.open;
        select('auto').disabled=true;status('Подгоняем одежду по плечам. Фото остаётся на устройстве…');
        try {
            worker ||= new Worker(new URL('./pose/worker.js',import.meta.url));
            const bitmap=await createImageBitmap(photo);
            if(!valid()) {bitmap.close();return;}
            const points=await new Promise((resolve,reject)=>{
                const timeout=setTimeout(()=>{worker?.terminate();worker=null;finish(new Error('Timeout'));},45000);
                function finish(error,points) {clearTimeout(timeout);error?reject(error):resolve(points);}
                pendingPose={reject:error=>finish(error)};
                worker.onmessage=({data})=>finish(data.error?new Error('Pose unavailable'):null,data.points);
                worker.onerror=error=>{worker?.terminate();worker=null;finish(error);};
                try {worker.postMessage(bitmap,[bitmap]);} catch(error) {bitmap.close();finish(error);}
            });
            if(!valid()) return;
            const shoulderShare=isProduct() ? .52 : studio.kind()==='tee' ? .72 : .60;
            const placement=poseFrom(points,photo.width,photo.height,shoulderShare);
            if(!placement) {status('Плечи не распознаны. Попробуй снимок анфас или настрой положение вручную.');return;}
            setSliders(placement);drawPhoto();status('Готово. При необходимости уточни размер и положение одежды.');
        } catch {if(valid()) status('Автоподгонка недоступна. Одежду можно переместить вручную.');}
        finally {if(valid()) {pendingPose=null;select('auto').disabled=false;}}
    }
    async function renderAvatar(event) {
        event?.preventDefault();clearTimeout(updateTimer);
        if(mode!=='avatar' || !dialog.open) return;
        const form=select('measures');
        if(!form.checkValidity()) {if(event) form.reportValidity();return;}
        const ticket=++renderSequence,button=form.querySelector('button');
        button.disabled=true;blank('avatar','Готовим модель…');status('');
        try {
            const profile=Object.fromEntries([...new FormData(form)].map(([key,value])=>[key,Number(value)]));
            const image=await studio.avatar(profile);
            if(!current(ticket) || mode!=='avatar') return;
            present('avatar',image);status('Цвет и принты взяты из твоего макета.');
        } catch(error) {if(current(ticket) && mode==='avatar') {blank('avatar','Не удалось загрузить 3D-просмотр.');status(error.message || 'Попробуй ещё раз.');}}
        finally {if(current(ticket)) button.disabled=false;}
    }
    function switchMode(next) {
        mode=next;renderSequence++;clearTimeout(updateTimer);pointer=null;endPose();
        if(next==='avatar' && isProduct()) select('source').value='design';
        for(const node of dialog.querySelectorAll('[data-fit-mode]')) node.setAttribute('aria-pressed',String(node.dataset.fitMode===next));
        for(const node of dialog.querySelectorAll('[data-fit-panel],[data-fit-view]')) node.hidden=(node.dataset.fitPanel||node.dataset.fitView)!==next;
        status('');select('save').disabled=true;select('auto').disabled=!photo;
        select('measures').querySelector('button').disabled=false;
        if(next==='avatar') renderAvatar();
        else if(photo) refreshPhoto();
        else blank('photo','Добавь фото анфас с опущенными руками. Плечи и бёдра должны быть в кадре.');
    }
    for(const button of dialog.querySelectorAll('[data-fit-mode]')) button.onclick=()=>switchMode(button.dataset.fitMode);
    for(const name of ['file','camera']) select(name).onchange=event=>{loadPhoto(event.target.files[0]);event.target.value='';};
    select('clear').onclick=clearPhoto;
    select('reset').onclick=()=>{setSliders({x:50,y:39,scale:53,angle:0});drawPhoto();status('Положение сброшено.');};
    select('side').onchange=refreshPhoto;
    if(select('source')) select('source').onchange=()=>{
        if(isProduct() && mode==='avatar') switchMode('photo');
        else if(mode==='photo') refreshPhoto();else renderAvatar();
    };
    select('auto').onclick=locatePose;select('measures').onsubmit=renderAvatar;
    select('measures').onchange=()=>{clearTimeout(updateTimer);updateTimer=setTimeout(renderAvatar,120);};
    for(const key of Object.keys(adjustments)) slider(key).oninput=event=>{setSliders({[key]:Number(event.target.value)});drawPhoto();};
    views.photo.onpointerdown=event=>{
        if(mode!=='photo' || !garment || event.button!==0) return;
        pointer={x:event.clientX,y:event.clientY};views.photo.setPointerCapture(event.pointerId);
    };
    views.photo.onpointermove=event=>{
        if(!pointer || mode!=='photo') return;
        const box=views.photo.getBoundingClientRect();
        setSliders({x:between(adjustments.x+(event.clientX-pointer.x)/box.width*100,0,100),y:between(adjustments.y+(event.clientY-pointer.y)/box.height*100,0,100)});
        pointer={x:event.clientX,y:event.clientY};drawPhoto();
    };
    views.photo.onpointerup=views.photo.onpointercancel=views.photo.onlostpointercapture=()=>{pointer=null;};
    select('save').onclick=()=>{
        if(select('save').disabled) return;
        const target=views[mode];
        target.toBlob(blob=>{
            if(!blob) return;
            const link=document.createElement('a'),url=URL.createObjectURL(blob);
            link.href=url;link.download='our-souls-fitting-'+mode+'.png';link.click();setTimeout(()=>URL.revokeObjectURL(url),3000);
        },'image/png');
    };
    if(select('size')) select('size').onclick=()=>{
        const field=select('chest');
        if(!field.value || !field.checkValidity()) {select('size-result').textContent='Укажи обхват груди от 60 до 160 см.';return;}
        const chest=Number(field.value);
        const candidates=Object.entries(product.measurements).map(([name,width])=>({name,ease:width*2-chest})).filter(size=>size.ease>=6).sort((a,b)=>a.ease-b.ease);
        select('size-result').textContent=candidates.length?'Ориентир — '+candidates[0].name+' (запас '+Math.round(candidates[0].ease)+' см по груди).':'Нет измеренного размера с запасом от 6 см по груди.';
    };
    dialog.addEventListener('close',()=>{
        document.documentElement.style.overflow=pageOverflow;clearTimeout(updateTimer);clearPhoto();
        views.avatar.width=1;views.avatar.height=1;select('save').disabled=true;
    });
    setSliders(adjustments);
    return {open() {
        if(!dialog.open) {pageOverflow=document.documentElement.style.overflow;dialog.showModal();document.documentElement.style.overflow='hidden';}
        select('side').value=isProduct()?'front':studio.side();switchMode(mode);
    }};
}
