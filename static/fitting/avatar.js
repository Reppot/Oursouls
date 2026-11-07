import * as T from '../studio/three/three.module.min.js';
import {GLTFLoader} from '../runway/vendor/GLTFLoader.js';
import {loadOutfits,createDrawstrings} from './outfits.js?v=4';

function printable(material, prints) {
    material = material.clone();
    material.roughness = .91;
    material.metalness = 0;
    if (material.normalScale) material.normalScale.setScalar(.45);
    material.onBeforeCompile = shader => {
        shader.uniforms.fitFront = {value:prints.front.texture};
        shader.uniforms.fitBack = {value:prints.back.texture};
        shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 fitPosition;')
            .replace('#include <begin_vertex>', '#include <begin_vertex>\nfitPosition = position;');
        shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 fitPosition; uniform sampler2D fitFront; uniform sampler2D fitBack;')
            .replace('#include <color_fragment>', `#include <color_fragment>
                bool forward = fitPosition.z > -.015;
                vec2 printUV = vec2(.5 + fitPosition.x / .405 * (forward ? 245. : -245.) / 600.,
                    (350. + (fitPosition.y - 1.29) / .325 * 245.) / 700.);
                if (gl_FrontFacing && all(greaterThan(printUV,vec2(0))) && all(lessThan(printUV,vec2(1)))) {
                    vec4 ink = forward ? texture2D(fitFront, printUV) : texture2D(fitBack, printUV);
                    float weaveShade = 1.;
                    #ifdef USE_MAP
                        weaveShade = clamp(dot(texture2D(map,vMapUv).rgb,vec3(.2126,.7152,.0722)) / .55,.72,1.13);
                    #endif
                    diffuseColor.rgb = mix(diffuseColor.rgb, ink.rgb * weaveShade, ink.a);
                }
            `);
    };
    material.customProgramCacheKey = () => 'fitted-clothing-ink-v3';
    return material;
}

export async function createPresentation(prints) {
    const loader = new GLTFLoader();
    const [person, garments] = await Promise.all([
        loader.loadAsync('/static/runway/models/runway-human.glb?v=3'),
        loadOutfits(),
    ]);
    const scene = new T.Scene();
    scene.background = new T.Color('#ecebe4');
    const camera = new T.PerspectiveCamera(29,1,.1,20);
    const body = new T.Group();
    person.scene.traverse(part => {
        if (!part.isMesh) return;
        if (part.name==='Cloth_tshirt') {part.visible=false;return;}
        part.castShadow = !/^(Eyes|Eyelashes|Eyebrows)/.test(part.name);
        part.receiveShadow=true;
        if (part.name==='base') {
            part.material=part.material.clone();part.material.roughness=.82;
            part.material.normalScale.setScalar(.55);
        }
    });
    body.add(person.scene);
    const outfits = new Map();
    garments.scene.clone(true).traverse(part => {
        if (!part.isMesh) return;
        part.material=printable(part.material,prints);
        part.castShadow=true;part.receiveShadow=true;
        part.material.side=T.DoubleSide;
        outfits.set(part.name,part);
    });
    if (outfits.size!==3) throw new Error('Fitted garments unavailable');
    for (const mesh of outfits.values()) body.add(mesh);
    const cords=createDrawstrings();body.add(cords);scene.add(body);
    const key=new T.DirectionalLight('#fff9ef',2.1);
    key.position.set(-3.4,4.4,4.1);key.castShadow=true;
    key.shadow.mapSize.set(1024,1024);key.shadow.bias=-.00018;key.shadow.normalBias=.007;
    Object.assign(key.shadow.camera,{left:-1.9,right:1.9,top:2.3,bottom:-1.5,near:.1,far:10});
    const fill=new T.DirectionalLight('#e8edff',.75);fill.position.set(3,2.4,2);
    const rim=new T.DirectionalLight('#fff4df',1.15);rim.position.set(1.2,3.1,-3.4);
    scene.add(key,fill,rim,new T.HemisphereLight('#fff9f1','#8d9389',1.25));
    const floor=new T.Mesh(new T.PlaneGeometry(200,200),new T.ShadowMaterial({color:'#394334',opacity:.12}));
    floor.rotation.x=-Math.PI/2;floor.position.y=-.006;floor.receiveShadow=true;scene.add(floor);
    const names={tee:'Cloth_tshirt',long:'Cloth_longsleeve',hoodie:'Cloth_hoodie'};
    return {
        scene,camera,
        prepare(profile,kind,color,aspect) {
            const height=profile.height/184, chest=Math.sqrt(profile.chest/96),waist=Math.sqrt(profile.waist/82);
            body.scale.set(chest*.72+waist*.28,height,chest);
            for (const [name,mesh] of outfits) {
                mesh.visible=name===names[kind];
                mesh.material.color.set(color).multiplyScalar(1.65);
            }
            cords.visible=kind==='hoodie';
            camera.aspect=aspect;camera.updateProjectionMatrix();
            const close=profile.framing===1;
            const angle=profile.angle*Math.PI/180, distance=(close?2.35:4.3)*height;
            const aim=(close?1.34:.94)*height;
            camera.position.set(Math.sin(angle)*distance,aim+.13*height,Math.cos(angle)*distance);
            camera.lookAt(0,aim,0);camera.updateMatrixWorld();
        },
    };
}
