let opening;
function database(){return opening ||= new Promise((resolve,reject)=>{const request=indexedDB.open('our-souls-designs',1);request.onupgradeneeded=()=>request.result.createObjectStore('projects',{keyPath:'id'});request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)}).catch(e=>{opening=null;throw e})}
async function operation(mode,run){const db=await database();return new Promise((resolve,reject)=>{const tx=db.transaction('projects',mode),request=run(tx.objectStore('projects'));let result;request.onsuccess=()=>{result=request.result};tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('Не удалось сохранить макет.'))})}
export const drafts={
 save:project=>operation('readwrite',store=>store.put({...project,updatedAt:Date.now()})),
 load:id=>operation('readonly',store=>store.get(id)),
 list:()=>operation('readonly',store=>store.getAll()),
 delete:id=>operation('readwrite',store=>store.delete(id)),
};
