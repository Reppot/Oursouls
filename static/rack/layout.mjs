export const clampPhase=(value,count)=>Math.max(0,Math.min(Math.max(0,count-1),value));

// All anchors share one physical rail. Depth changes image size, never its artwork.
export function rackLayout(item,phase,width,height,{hovered=false,picked=false}={}){
 const mobile=width<600;
 const pieceWidth=Math.min(width*(mobile ? .80 : .58),height*.65);
 const depth=item-phase;
 const visibleDepth=depth>=0?depth/(1+.12*depth):depth*3;
 const stepX=width*(mobile ? .15 : .16),stepY=height*.09;
 const pull=hovered && !picked && depth>.25 ? .30 : 0;
 const anchorDepth=visibleDepth-pull;
 let scale=depth>=0?1/(1+.20*depth):1-depth*.15;
 if(hovered)scale*=1.045;
 if(picked)scale*=1.045;
 return {pieceWidth,hookX:pieceWidth*.5,hookY:pieceWidth*.006,
  x:width*(mobile ? .44 : .325)+stepX*anchorDepth,y:height*.03+stepY*anchorDepth,
  scale,angle:hovered?-1.5:0,opacity:depth<0?Math.max(0,1+depth*1.5):depth>9?0:1,
  zIndex:picked?6000:hovered?5000:Math.round(3000-depth*30),stepX,stepY};
}
