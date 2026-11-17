// Ambient offset-print screen. Geometry and timing match the chosen preview.
// This layer never receives input; rack movement always takes priority.
export function mountHalftone(root){
 const canvas=document.createElement('canvas');canvas.className='rack-ambient';canvas.setAttribute('aria-hidden','true');root.prepend(canvas);
 const ctx=canvas.getContext('2d');
 if(!ctx){canvas.remove();return {setBusy(){}}}
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 let width=0,height=0,points=[],spacing=13,time=46,rate=1,busy=false,visible=true,frame=0,last=0,lastPaint=0,disposed=false;
 const strength=.48,speed=.6;

 function paint(){
  if(!width||!height)return;
  ctx.clearRect(0,0,width,height);
  const scale=spacing/13;
  for(let layer=0;layer<2;layer++){
   ctx.beginPath();
   for(const p of points){
    const wave=Math.sin(p.a+time*.07)+Math.cos(p.b-time*.045);
    const density=Math.max(0,(wave+1.1)/3.1),radius=(.3+density*2.1)*scale;
    const x=p.x+(layer?2.1:0)*scale+Math.sin(time*.06+p.y*.004)*2.4;
    const y=p.y+(layer?1.5:0)*scale;
    ctx.moveTo(x+radius,y);ctx.arc(x,y,radius,0,Math.PI*2);
   }
   ctx.fillStyle=layer?`rgba(177,43,63,${strength*.13})`:`rgba(144,30,49,${strength*.34})`;
   ctx.fill();
  }
  ctx.save();ctx.globalCompositeOperation='destination-out';
  ctx.translate(width*.57,height*.49);ctx.scale(width*.57,height*.32);
  const quiet=ctx.createRadialGradient(0,0,.32,0,0,1);
  quiet.addColorStop(0,'rgba(0,0,0,1)');quiet.addColorStop(.65,'rgba(0,0,0,.94)');quiet.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=quiet;ctx.fillRect(-1,-1,2,2);ctx.restore();
 }
 function stop(){if(frame)cancelAnimationFrame(frame);frame=0;last=0}
 function request(){if(!disposed&&!frame&&visible&&!document.hidden&&!reduced.matches&&width&&height)frame=requestAnimationFrame(tick)}
 function tick(now){
  frame=0;if(disposed||!visible||document.hidden||reduced.matches){last=0;return}
  const dt=Math.min(50,last?now-last:16.67);last=now;
  rate+=((busy?0:1)-rate)*(1-Math.exp(-dt/220));
  if(rate>.025){
   time+=dt*.001*speed*rate;
   if(now-lastPaint>=1000/(width<600?20:24)){paint();lastPaint=now}
   request();
  }else{rate=0;last=0}
 }
 const resize=new ResizeObserver(entries=>{
  const rect=entries[0].contentRect;if(!rect.width||!rect.height)return;
  width=rect.width;height=rect.height;
  const ratio=Math.min(devicePixelRatio||1,width<600?1.25:1.5);
  canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);ctx.setTransform(ratio,0,0,ratio,0,0);
  // Bound the print screen to about 7,200 dots, irrespective of monitor size.
  spacing=Math.max(width<600?12:13,Math.sqrt(width*height/3600));points=[];
  for(let y=-spacing;y<height+spacing;y+=spacing)for(let x=-spacing;x<width+spacing;x+=spacing){
   points.push({x,y,a:x/width*6.6+y/height*4.1,b:y/height*7-x/width*2.7});
  }
  paint();request();
 });resize.observe(root);
 const intersection=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible)request();else stop()});intersection.observe(root);
 const visibility=()=>{if(document.hidden)stop();else request()};
 const preference=()=>{stop();paint();request()};
 const restore=()=>{paint();request()};
 document.addEventListener('visibilitychange',visibility);reduced.addEventListener('change',preference);
 window.addEventListener('pagehide',stop);window.addEventListener('pageshow',restore);
 return {
  setBusy(value){if(busy===Boolean(value))return;busy=Boolean(value);if(busy){rate=0;stop()}else request()},
  dispose(){disposed=true;stop();resize.disconnect();intersection.disconnect();document.removeEventListener('visibilitychange',visibility);reduced.removeEventListener('change',preference);window.removeEventListener('pagehide',stop);window.removeEventListener('pageshow',restore);canvas.remove()}
 };
}
