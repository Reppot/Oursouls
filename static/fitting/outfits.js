import * as T from '../studio/three/three.module.min.js';
import {GLTFLoader} from '../runway/vendor/GLTFLoader.js';

let promise;
export function loadOutfits() {
    if (!promise) promise=new GLTFLoader().loadAsync(new URL('./outfits.glb?v=4',import.meta.url).href)
        .catch(error=>{promise=null;throw error;});
    return promise;
}

export function createDrawstrings() {
    const group = new T.Group();
    const cotton = new T.MeshStandardMaterial({color:'#d7d3c3',roughness:.98});
    const metal = new T.MeshStandardMaterial({color:'#59584f',roughness:.55,metalness:.35});
    for (const sign of [-1,1]) {
        const y = sign === 1 ? 1.29 : 1.315;
        const points = [new T.Vector3(sign*.042,1.49,.146),new T.Vector3(sign*.045,1.43,.162),
            new T.Vector3(sign*.052,1.36,.169),new T.Vector3(sign*.047,y,.168)];
        const path = new T.CatmullRomCurve3(points);
        const cord = new T.Mesh(new T.TubeGeometry(path,22,.0026,6,false),cotton);
        cord.castShadow = true;group.add(cord);
        const tip = new T.Mesh(new T.CylinderGeometry(.003,.003,.014,7),metal);
        tip.position.copy(points[3]);tip.position.y-=.006;group.add(tip);
    }
    return group;
}

