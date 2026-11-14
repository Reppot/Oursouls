// Seeded image watershed: labels follow photographic edges rather than a white
// colour key. The center of these studio garment photographs is foreground.
export function removeBackdrop(pixels,width,height){
 const size=width*height,dist=new Float32Array(size).fill(Infinity),labels=new Uint8Array(size),fixed=new Uint8Array(size),heap=[];
 function push(cost,index,label){
  let at=heap.length;heap.push([cost,index,label]);
  while(at){const parent=(at-1)>>1;if(heap[parent][0]<=cost)break;heap[at]=heap[parent];at=parent}heap[at]=[cost,index,label];
 }
 function pop(){const first=heap[0],last=heap.pop();if(heap.length){let at=0;while(at*2+1<heap.length){let child=at*2+1;if(child+1<heap.length&&heap[child+1][0]<heap[child][0])child++;if(heap[child][0]>=last[0])break;heap[at]=heap[child];at=child}heap[at]=last}return first}
 function seed(i,label){dist[i]=0;labels[i]=label;fixed[i]=1;push(0,i,label)}
 for(let x=0;x<width;x++){seed(x,1);seed((height-1)*width+x,1)}
 for(let y=1;y<height-1;y++){seed(y*width,1);seed(y*width+width-1,1)}
 for(let y=Math.ceil(height*.35);y<height*.80;y++)for(let x=Math.ceil(width*.40);x<width*.60;x++)seed(y*width+x,2);
 // High-confidence fabric/print pixels also anchor sleeves and shoulders.
 // Grey studio shadows are not foreground seeds.
 for(let y=Math.ceil(height*.08);y<height*.92;y++)for(let x=Math.ceil(width*.03);x<width*.97;x++){
  const i=y*width+x,at=i*4,mix=x/(width-1),left=y*width*4,right=(y*width+width-1)*4;
  let difference=0;for(let c=0;c<3;c++)difference+=pixels[at+c]-(pixels[left+c]*(1-mix)+pixels[right+c]*mix);
  difference/=3;
  const spread=Math.max(pixels[at],pixels[at+1],pixels[at+2])-Math.min(pixels[at],pixels[at+1],pixels[at+2]);
  if(pixels[at+3]>220&&(difference>12||difference< -55||spread>25))seed(i,2);
 }
 const visit=(from,to,cost,label)=>{
  if(fixed[to])return;
  let gradient=0;
  for(let c=0;c<3;c++)gradient+=(pixels[from*4+c]-pixels[to*4+c])**2;
  const next=Math.max(cost,Math.sqrt(gradient))+.035;
  if(next<dist[to]){dist[to]=next;labels[to]=label;push(next,to,label)}
 };
 while(heap.length){const [cost,i,label]=pop();if(cost>dist[i]+.001)continue;const x=i%width,y=Math.floor(i/width);
  if(x)visit(i,i-1,cost,label);if(x<width-1)visit(i,i+1,cost,label);if(y)visit(i,i-width,cost,label);if(y<height-1)visit(i,i+width,cost,label);
 }
 let removed=0;
 for(let i=0;i<size;i++)if(labels[i]===1||pixels[i*4+3]<20){pixels[i*4+3]=0;removed++}
 return removed;
}
