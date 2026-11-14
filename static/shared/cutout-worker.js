import {removeBackdrop} from './backdrop-mask.mjs';
self.onmessage=({data})=>{
 try{
  const pixels=new Uint8ClampedArray(data.pixels);
  const removed=removeBackdrop(pixels,data.width,data.height);
  self.postMessage({id:data.id,pixels:pixels.buffer,removed},[pixels.buffer]);
 }catch(error){self.postMessage({id:data.id,error:error.message})}
};
