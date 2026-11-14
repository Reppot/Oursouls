import {removeBackdrop} from './backdrop-mask.mjs';
// Connected studio-backdrop removal. Interior print pixels are never recoloured.
const cache = new Map();
let worker,workerFailed=false,sequence=0;const jobs=new Map();
async function segment(image){
 if(!workerFailed&&typeof Worker!=='undefined'){
  try{
   if(!worker){worker=new Worker(new URL('./cutout-worker.js',import.meta.url),{type:'module'});
    worker.onmessage=({data})=>{const job=jobs.get(data.id);if(!job)return;clearTimeout(job.timer);jobs.delete(data.id);data.error?job.reject(new Error(data.error)):job.resolve(data)};
    worker.onerror=()=>{workerFailed=true;worker.terminate();worker=null;for(const job of jobs.values()){clearTimeout(job.timer);job.reject(new Error('Image worker unavailable'))}jobs.clear()};
   }
   const data=await new Promise((resolve,reject)=>{const id=++sequence,pixels=image.data.slice().buffer;const timer=setTimeout(()=>{jobs.delete(id);reject(new Error('Image worker timeout'))},10000);jobs.set(id,{resolve,reject,timer});worker.postMessage({id,width:image.width,height:image.height,pixels},[pixels])});
   return {image:new ImageData(new Uint8ClampedArray(data.pixels),image.width,image.height),removed:data.removed};
  }catch{workerFailed=true}
 }
 return {image,removed:removeBackdrop(image.data,image.width,image.height)};
}
export async function studioCutout(url, maximum = 1100) {
    const key = url + ':' + maximum;
    if (cache.has(key)) {const task=cache.get(key);cache.delete(key);cache.set(key,task);return task;}
    const task = (async () => {
        const image = new Image(); image.crossOrigin = 'anonymous'; image.src = url;
        await image.decode();
        const ratio = Math.min(1, maximum / Math.max(image.naturalWidth,image.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(image.naturalWidth*ratio); canvas.height = Math.round(image.naturalHeight*ratio);
        const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0,canvas.width,canvas.height);
        const {width:w,height:h}=canvas;
        const mask=document.createElement('canvas'),scale=Math.min(1,480/Math.max(w,h));
        mask.width=Math.round(w*scale);mask.height=Math.round(h*scale);
        const mc=mask.getContext('2d',{willReadFrequently:true});mc.drawImage(canvas,0,0,mask.width,mask.height);
        const {image:data,removed:tail}=await segment(mc.getImageData(0,0,mask.width,mask.height));
        if(tail<mask.width*mask.height*.06||tail>mask.width*mask.height*.94)throw new Error('Для примерки нужна подготовленная вырезка изделия.');
        mc.putImageData(data,0,0);
        ctx.globalCompositeOperation='destination-in';ctx.drawImage(mask,0,0,w,h);ctx.globalCompositeOperation='source-over';
        const p=ctx.getImageData(0,0,w,h).data;let l=w,t=h,r=-1,b=-1;
        for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(p[(y*w+x)*4+3]>30){l=Math.min(l,x);t=Math.min(t,y);r=Math.max(r,x);b=Math.max(b,y)}
        const out=document.createElement('canvas');out.width=r-l+1;out.height=b-t+1;
        if(out.width<20||out.height<20)throw new Error('Не удалось подготовить изображение.');
        out.getContext('2d').drawImage(canvas,l,t,out.width,out.height,0,0,out.width,out.height);
        return out;
    })();
    cache.set(key,task);while(cache.size>12)cache.delete(cache.keys().next().value);try{return await task}catch(error){cache.delete(key);throw error}
}
