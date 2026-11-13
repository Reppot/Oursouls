// Connected studio-backdrop removal. Interior print pixels are never recoloured.
const cache = new Map();
export async function studioCutout(url, maximum = 1100) {
    const key = url + ':' + maximum;
    if (cache.has(key)) return cache.get(key);
    const task = (async () => {
        const image = new Image(); image.crossOrigin = 'anonymous'; image.src = url;
        await image.decode();
        const ratio = Math.min(1, maximum / Math.max(image.naturalWidth,image.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(image.naturalWidth*ratio); canvas.height = Math.round(image.naturalHeight*ratio);
        const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0,canvas.width,canvas.height);
        const {width:w,height:h}=canvas, im=ctx.getImageData(0,0,w,h), p=im.data;
        const corners=[0,w-1,(h-1)*w,w*h-1].map(i=>[p[i*4],p[i*4+1],p[i*4+2]]);
        const seen=new Uint8Array(w*h), queue=new Uint32Array(w*h);let head=0,tail=0;
        const visit=i=>{if(seen[i])return;seen[i]=1;const at=i*4;
            if(p[at+3]<20||corners.some(c=>Math.hypot(p[at]-c[0],p[at+1]-c[1],p[at+2]-c[2])<58))queue[tail++]=i;};
        for(let x=0;x<w;x++){visit(x);visit((h-1)*w+x)}for(let y=0;y<h;y++){visit(y*w);visit(y*w+w-1)}
        while(head<tail){const i=queue[head++],x=i%w,y=Math.floor(i/w);p[i*4+3]=0;
            if(x)visit(i-1);if(x<w-1)visit(i+1);if(y)visit(i-w);if(y<h-1)visit(i+w)}
        if(tail<w*h*.06||tail>w*h*.94)throw new Error('Для примерки нужна подготовленная вырезка изделия.');
        ctx.putImageData(im,0,0);let l=w,t=h,r=-1,b=-1;
        for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(p[(y*w+x)*4+3]>30){l=Math.min(l,x);t=Math.min(t,y);r=Math.max(r,x);b=Math.max(b,y)}
        const out=document.createElement('canvas');out.width=r-l+1;out.height=b-t+1;
        if(out.width<20||out.height<20)throw new Error('Не удалось подготовить изображение.');
        out.getContext('2d').drawImage(canvas,l,t,out.width,out.height,0,0,out.width,out.height);
        return out;
    })();
    cache.set(key,task);try{return await task}catch(error){cache.delete(key);throw error}
}
