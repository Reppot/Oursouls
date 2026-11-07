import * as T from '../studio/three/three.module.min.js';

export function studioEnvironment(renderer) {
    // Invisible softboxes provide broad, controlled reflections in skin and eyes.
    const room=new T.Scene();
    const box=new T.Mesh(new T.BoxGeometry(7,7,7),new T.MeshBasicMaterial({color:'#73776e',side:T.BackSide}));
    box.position.y=1.5;room.add(box);
    const resources=[box.geometry,box.material];
    for(const [x,y,z,width,height,color] of [[-3,2.4,1.5,2,3,'#fff4e4'],[3,2.5,1,2,3,'#e9efff'],[0,4.6,0,3,3,'#ffffff']]) {
        const material=new T.MeshBasicMaterial({color:new T.Color(color).multiplyScalar(3),side:T.DoubleSide});
        const mesh=new T.Mesh(new T.PlaneGeometry(width,height),material);
        mesh.position.set(x,y,z);mesh.lookAt(0,1.2,0);room.add(mesh);resources.push(mesh.geometry,material);
    }
    const generator=new T.PMREMGenerator(renderer);
    const target=generator.fromScene(room,.04);
    generator.dispose();resources.forEach(resource=>resource.dispose());
    return target.texture;
}

function physical(source,values) {
    return new T.MeshPhysicalMaterial({color:source.color,map:source.map,normalMap:source.normalMap,
        normalScale:source.normalScale,side:source.side,alphaTest:source.alphaTest,
        opacity:source.opacity,transparent:source.transparent,metalness:0,...values});
}

export function detailMaterials(root) {
    root.traverse(part=>{
        if(!part.isMesh) return;
        const original=part.material;
        for(const map of [original.map,original.normalMap]) if(map) map.anisotropy=4;
        if(part.name==='base') {
            part.material=physical(original,{roughness:.58,ior:1.4,specularIntensity:.36,
                clearcoat:.025,clearcoatRoughness:.6,sheen:.06,sheenRoughness:.8,
                sheenColor:new T.Color('#e9ab8e'),normalScale:new T.Vector2(.78,.78),side:T.FrontSide});
        } else if(original.name==='Cornea') {
            part.material=physical(original,{color:'#ffffff',roughness:.035,ior:1.38,
                clearcoat:1,clearcoatRoughness:.025,transparent:true,opacity:.065,
                specularIntensity:.9,depthWrite:false,side:T.FrontSide});
        } else if(original.name==='Iris' || original.name==='Eye') {
            part.material=physical(original,{roughness:.3,ior:1.38,specularIntensity:.55});
        } else if(/^Hair/.test(part.name)) {
            part.material=physical(original,{roughness:.64,anisotropy:.45,anisotropyRotation:Math.PI/2,
                specularIntensity:.32,alphaTest:.28,alphaToCoverage:true});
        } else if(/^(Eyebrow|Eyelash)/.test(original.name)) {
            part.material=original.clone();part.material.alphaToCoverage=true;part.material.alphaTest=.26;
        }
    });
}
