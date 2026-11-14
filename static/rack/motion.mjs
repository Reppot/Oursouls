// Time-based damping, bounded independently of wheel event frequency.
export function advanceRack(position,target,elapsedMs){
 const dt=Math.max(0,Math.min(64,elapsedMs));
 const delta=(target-position)*(1-Math.exp(-dt/180));
 const step=Math.sign(delta)*Math.min(Math.abs(delta),dt*.0026);
 return Math.abs(target-position)<.0005?target:position+step;
}
export const wheelDistance=delta=>Math.max(-180,Math.min(180,delta))/460;
