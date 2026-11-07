import * as T from '../studio/three/three.module.min.js';
import {GLTFLoader} from '../runway/vendor/GLTFLoader.js';

let promise;
export function loadOutfits() {
    if (!promise) promise=new GLTFLoader().loadAsync(new URL('./outfits.glb?v=4',import.meta.url).href)
        .catch(error=>{promise=null;throw error;});
    return promise;
}

export function createDrawstrings(hoodie) {
    const group = new T.Group();
    if (!hoodie?.isMesh) return group;
    hoodie.updateWorldMatrix(true,false);
    const ray = new T.Raycaster();
    const normalMatrix = new T.Matrix3().getNormalMatrix(hoodie.matrixWorld);
    const surface = (x,y) => {
        ray.set(new T.Vector3(x,y,.8),new T.Vector3(0,0,-1));
        return ray.intersectObject(hoodie,false).find(hit=>hit.point.z>.025 && hit.face.normal.z>.15);
    };
    group.userData.anchors=[];
    group.userData.clearances=[];
    const cotton = new T.MeshStandardMaterial({color:'#d7d3c3',roughness:.98});
    const metal = new T.MeshStandardMaterial({color:'#59584f',roughness:.55,metalness:.35});
    for (const sign of [-1,1]) {
        let anchor;
        for(let y=1.50;y>=1.40;y-=.004) {
            anchor=surface(sign*.041,y);
            if(anchor) break;
        }
        if(!anchor) continue;
        const normal=anchor.face.normal.clone().applyMatrix3(normalMatrix).normalize();
        const attachment=anchor.point.clone().addScaledVector(normal,.0008);
        const eyelet=new T.Mesh(new T.TorusGeometry(.0052,.0011,8,20),metal);
        eyelet.position.copy(attachment);
        eyelet.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),normal);
        eyelet.castShadow=true;group.add(eyelet);
        group.userData.anchors.push({point:anchor.point.toArray(),attachment:attachment.toArray()});
        const points=[anchor.point.clone().addScaledVector(normal,.001)];
        const length=sign===1?.174:.192;
        for(let i=1;i<=18;i++) {
            const t=i/18, x=sign*(.041+.005*Math.sin(t*Math.PI)-.003*t);
            const hit=surface(x,anchor.point.y-length*t);
            if(!hit) break;
            const point=hit.point.clone();point.z+=.0027;
            points.push(point);
            group.userData.clearances.push(point.z-hit.point.z);
        }
        if(points.length<4) continue;
        const path = new T.CatmullRomCurve3(points);
        const cord = new T.Mesh(new T.TubeGeometry(path,54,.0022,8,false),cotton);
        cord.castShadow = true;group.add(cord);
        const tip = new T.Mesh(new T.CylinderGeometry(.003,.003,.014,7),metal);
        tip.position.copy(points.at(-1));tip.position.y-=.004;tip.castShadow=true;group.add(tip);
    }
    return group;
}

