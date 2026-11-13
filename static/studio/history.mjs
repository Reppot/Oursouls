export function createHistory(limit=30){
 let states=[],cursor=-1;
 return {
  push(state){const text=JSON.stringify(state);if(cursor>=0&&JSON.stringify(states[cursor])===text)return false;states=states.slice(0,cursor+1);states.push(structuredClone(state));if(states.length>limit+1)states.shift();cursor=states.length-1;return true},
  undo(){if(cursor<1)return null;return structuredClone(states[--cursor])},
  redo(){if(cursor>=states.length-1)return null;return structuredClone(states[++cursor])},
  get canUndo(){return cursor>0},get canRedo(){return cursor<states.length-1},
  get referencedAssets(){return new Set(states.flatMap(s=>[...(s.layers?.front||[]),...(s.layers?.back||[])].map(l=>l.assetId)))},
  clear(){states=[];cursor=-1},
 };
}
