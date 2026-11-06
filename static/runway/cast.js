import * as T from '../studio/three/three.module.min.js';

// Photo rectangles are normalized against the actual storefront photos.
// The base tone is sampled from the fabric next to each print.
export const looks = [
    {name:'Красная тьма', url:'/product/красная-тьма/', art:'../catalog/12.webp',
     rect:[290/864, 1-775/1184, 290/864, 450/1184], fit:[.239,.371,1.285],
     fabric:'#202523', photo:'#151c1b', trousers:'#474944'},
    {name:'Лучшие друзья', url:'/product/лучшие-друзья/', art:'../catalog/14.webp',
     rect:[299/896, 1-652/1200, 296/896, 308/1200], fit:[.231,.240,1.328],
     fabric:'#6764a7', photo:'#5d5996', trousers:'#3e4142'},
    {name:'Terrifying', url:'/product/terrifying/', art:'../catalog/16.webp',
     rect:[283/896, 1-709/1200, 331/896, 365/1200], fit:[.263,.290,1.303],
     fabric:'#252525', photo:'#222221', trousers:'#51514a'},
];
export const assets = {
    model:'./models/runway-human.glb?v=3',
    shirtMesh:'Cloth_tshirt',
    idleClip:null,
};

function makeShirt(material) {
    const ink = {
        runwayPhoto:{value:null}, runwayPhotoTone:{value:new T.Color()}, runwayPhotoRect:{value:new T.Vector4()},
        runwayPrintFit:{value:new T.Vector3()}, runwayHasPrint:{value:false}
    };
    material.onBeforeCompile = shader => {
        Object.assign(shader.uniforms,ink);
        shader.vertexShader = shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 runwayCloth;')
            .replace('#include <begin_vertex>','#include <begin_vertex>\nrunwayCloth = position;');
        shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
            varying vec3 runwayCloth;
            uniform sampler2D runwayPhoto;
            uniform vec3 runwayPhotoTone;
            uniform vec4 runwayPhotoRect;
            uniform vec3 runwayPrintFit;
            uniform bool runwayHasPrint;`).replace('#include <color_fragment>', `#include <color_fragment>
            vec2 uvInk = vec2(runwayCloth.x,(runwayCloth.y - runwayPrintFit.z)) / runwayPrintFit.xy + .5;
            if (runwayHasPrint && gl_FrontFacing && runwayCloth.z > .035
                    && all(greaterThan(uvInk,vec2(0))) && all(lessThan(uvInk,vec2(1)))) {
                vec3 photo = texture2D(runwayPhoto, runwayPhotoRect.xy + uvInk * runwayPhotoRect.zw).rgb;
                vec2 rim = min(uvInk, 1. - uvInk);
                float fade = smoothstep(.012,.079,min(rim.x,rim.y));
                vec3 delta = photo - runwayPhotoTone;
                float inkCoverage = smoothstep(.018,.095,length(delta));
                diffuseColor.rgb = mix(diffuseColor.rgb, clamp(diffuseColor.rgb + delta,0.,1.), fade * inkCoverage);
            }`);
    };
    return ink;
}

function disposeActor(actor) {
    const resources = new Set();
    actor.traverse(part=>{
        if(part.geometry) resources.add(part.geometry);
        if(part.skeleton) resources.add(part.skeleton);
        for(const mat of [].concat(part.material||[])) {
            resources.add(mat);
            for(const value of Object.values(mat)) if(value?.isTexture) resources.add(value);
        }
    });
    resources.forEach(resource=>resource.dispose());
}

export async function createCast() {
    const {GLTFLoader} = await import('./vendor/GLTFLoader.js');
    const root = new T.Group();
    const loader = new GLTFLoader(), photoLoader = new T.TextureLoader();
    const actors = new Map(), photos = new Map();
    let mixer = null, disposed = false;
    async function use(index) {
        const look = looks[index];
        if(!look) throw new Error('Unknown outfit');
        const model = look.model || assets.model;
        let asset = actors.get(model);
        let photo = photos.get(look.art);
        if(!asset) {
            const gltf = await loader.loadAsync(new URL(model, import.meta.url).href);
            if(disposed) {disposeActor(gltf.scene); return false;}
            let shirt, trousers;
            gltf.scene.traverse(part=>{
                if(!part.isMesh) return;
                part.castShadow=!/^(Eyes|Eyelashes|Eyebrows)/.test(part.name);
                part.receiveShadow=true;
                if(part.name === (look.shirtMesh || assets.shirtMesh)) shirt=part.material;
                if(part.name === 'Cloth_jeans') trousers=part.material;
            });
            asset={actor:gltf.scene,clips:gltf.animations,shirt,trousers,ink:shirt && makeShirt(shirt)};
            actors.set(model,asset);
        }
        if(look.art && asset.ink && !photo) {
            photo=await photoLoader.loadAsync(new URL(look.art,import.meta.url).href).catch(()=>null);
            if(disposed) {photo?.dispose(); return false;}
            if(photo) {
                photo.colorSpace=T.SRGBColorSpace;
                photo.anisotropy=4;
                photos.set(look.art,photo);
            }
        }
        if(asset.ink) {
            const {ink,shirt,trousers}=asset;
            shirt.color.set(look.fabric).multiplyScalar(1.45);
            ink.runwayHasPrint.value=Boolean(photo);
            ink.runwayPhoto.value=photo||null;
            ink.runwayPhotoTone.value.set(look.photo);
            ink.runwayPhotoRect.value.fromArray(look.rect);
            ink.runwayPrintFit.value.fromArray(look.fit);
            if(trousers) trousers.color.set(look.trousers).multiplyScalar(1.45);
        }
        if(root.children[0] !== asset.actor) {
            mixer?.stopAllAction();
            mixer=null;
            root.clear(); root.add(asset.actor);
            const clipName=look.idleClip || assets.idleClip;
            const clip=clipName && T.AnimationClip.findByName(asset.clips,clipName);
            if(clip) {
                mixer=new T.AnimationMixer(asset.actor);
                mixer.clipAction(clip).play();
            }
        }
        return true;
    }
    try { await use(0); }
    catch(error) { actors.forEach(asset=>disposeActor(asset.actor)); throw error; }
    return {
        root,use,animate(dt) {mixer?.update(dt);},get animated() {return Boolean(mixer);},
        dispose() {
            disposed=true; mixer?.stopAllAction(); root.clear();
            actors.forEach(asset=>disposeActor(asset.actor));
            photos.forEach(texture=>texture.dispose());
            actors.clear(); photos.clear();
        },
    };
}
