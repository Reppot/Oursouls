import * as T from '../studio/three/three.module.min.js';
import { createGarment } from '../studio/garment-geometry.js';

// The built-in mannequin and externally fitted garments share this catalogue.
export const looks = [
    { name: 'Футболка · Мотылёк', kind: 'tee', color: '#242823', art: './moth.webp', trousers: '#2f3331' },
    { name: 'Лонгслив · Пепел', kind: 'long', color: '#a59f96', art: './moth.webp', trousers: '#282a27' },
    { name: 'Худи · Хвоя', kind: 'hoodie', color: '#283d31', trousers: '#2d312d' },
];
export const assets = {
    // A self-contained model in metres, facing +Z, with feet on Y=0.
    model: null,
    idleClip: null,
};

const matte = (color, roughness = .8) => new T.MeshStandardMaterial({ color, roughness });
const tau = Math.PI * 2;

// Sculpted cross-sections. Each row gives Y, centre X/Z, and ellipse radii.
// The spline keeps ankles, elbows, hands and the face continuous.
function loft(rows, material, { segments = 28, samples = 44, detail = () => 0 } = {}) {
    const centres = new T.CatmullRomCurve3(rows.map(([y,x,z]) => new T.Vector3(x,y,z)), false, 'centripetal');
    const profiles = new T.CatmullRomCurve3(rows.map(([y,,,x,z]) => new T.Vector3(x,z,y)), false, 'centripetal');
    const points = [], indices = [];
    for (let j = 0; j <= samples; j++) {
        const t = j / samples, c = centres.getPoint(t), r = profiles.getPoint(t);
        for (let i = 0; i < segments; i++) {
            const angle = i / segments * tau, fold = detail(t, angle);
            points.push(c.x + Math.sin(angle) * Math.max(.001,r.x + fold),
                c.y, c.z + Math.cos(angle) * Math.max(.001,r.y + fold));
            if (j < samples) {
                const a = j * segments + i, b = j * segments + (i + 1) % segments;
                indices.push(a,b,b+segments,a,b+segments,a+segments);
            }
        }
    }
    const bottom = points.length / 3;
    const [y,x,z] = rows[0], [topY,topX,topZ] = rows.at(-1);
    points.push(x,y,z,topX,topY,topZ);
    for (let i = 0; i < segments; i++) {
        const next = (i + 1) % segments, end = samples * segments;
        indices.push(bottom,next,i,bottom+1,end+i,end+next);
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.Float32BufferAttribute(points,3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return new T.Mesh(geo,material);
}

function face() {
    const skin = new T.MeshStandardMaterial({ color:'#4a4842', roughness:.39, metalness:.23 });
    return loft([
        [1.421,0,-.004,.071,.062], [1.52,0,-.004,.059,.062],
        [1.57,0,.018,.064,.072], [1.62,0,.012,.084,.088],
        [1.69,0,.004,.093,.094], [1.76,0,-.005,.094,.099],
        [1.817,0,-.012,.074,.082], [1.852,0,-.014,.040,.051], [1.864,0,-.017,.001,.001]
    ],skin,{segments:40,detail:(t,a)=>.012*Math.exp(-((t-.55)**2)/.013)*Math.exp(-(Math.atan2(Math.sin(a),Math.cos(a))**2)/.18)});
}

function arms(kind, material) {
    return [-1,1].map(sign => {
        const front = sign * .013;
        const outer = kind === 'tee' ? .397 : .405;
        return loft([
            [.750,sign*(outer-.028),front+.036,.009,.012],
            [.777,sign*(outer-.014),front+.028,.023,.017],
            [.819,sign*outer,front+.014,.033,.021],
            [.866,sign*(outer+.006),front+.007,.026,.024],
            [.921,sign*.387,front,.030,.029],
            [1.041,sign*.354,front-.004,.042,.039],
            [1.14,sign*.315,front-.011,.047,.043],
            [1.255,sign*.284,front-.014,.055,.055],
            [1.393,sign*.232,front-.020,.061,.058],
        ],material);
    });
}

function bottoms(color) {
    const cloth = matte(color, .9), sole = matte('#1e201e', .85), leather = matte('#232725', .46);
    const result = [loft([
        [.754,0,0,.129,.083],[.829,0,0,.179,.104],[.981,0,0,.186,.113],[1.053,0,-.007,.171,.104]
    ],cloth)];
    for (const sign of [-1,1]) {
        const x = sign*.131, stride = sign*.059;
        result.push(loft([
            [.087,x,stride,.064,.057],[.146,x,stride,.065,.066],
            [.305,sign*.12,stride*.83,.065,.069],[.47,sign*.108,stride*.61,.071,.075],
            [.635,sign*.101,stride*.29,.080,.083],[.819,sign*.091,0,.093,.10],[.945,sign*.085,0,.091,.10]
        ],cloth,{detail:(t,a)=>.003*Math.sin(a*4+t*9)+.005*Math.exp(-((t-.11+.045*Math.sin(a))**2)/.003)*Math.cos(a)}));
        const shoe = (rows, material) => {
            const mesh=loft(rows.map(([y,z,rx,rz])=>[y,0,z,rx,rz]),material,{segments:32,samples:16});
            mesh.position.set(x,0,stride); mesh.rotation.y=sign*.095;
            return mesh;
        };
        result.push(shoe([[0,.039,.067,.145],[.018,.04,.070,.149],[.031,.04,.067,.147]],sole));
        result.push(shoe([[.022,.04,.066,.143],[.049,.043,.062,.139],[.071,.027,.059,.114],[.103,-.026,.055,.071],[.129,-.036,.047,.055]],leather));
    }
    return result;
}

function fabric(color, ink) {
    const base = matte(color,.92);
    base.side = T.DoubleSide;
    if (!ink) return base;
    base.onBeforeCompile = shader => {
        shader.uniforms.runwayInk = {value:ink};
        shader.vertexShader = shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 clothPoint;')
            .replace('#include <begin_vertex>','#include <begin_vertex>\nclothPoint = position;');
        shader.fragmentShader = shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 clothPoint; uniform sampler2D runwayInk;')
            .replace('#include <color_fragment>', `#include <color_fragment>
                vec2 artUV = vec2(clothPoint.x / 1.01 + .5, (clothPoint.y + .46) / .85);
                if (gl_FrontFacing && clothPoint.z > .035 && all(greaterThan(artUV,vec2(0))) && all(lessThan(artUV,vec2(1)))) {
                    vec4 artwork = texture2D(runwayInk,artUV);
                    diffuseColor.rgb = mix(diffuseColor.rgb, artwork.rgb, artwork.a * .93);
                }`);
    };
    return base;
}

function mannequin(look, artwork) {
    const actor = new T.Group();
    const head = face();
    actor.add(head, ...arms(look.kind, head.material), ...bottoms(look.trousers));
    const cloth = fabric(look.color,artwork);
    const sameCloth = (factor) => {
        const m = matte(look.color,.93);
        m.color.multiplyScalar(factor); m.side=T.DoubleSide;
        return m;
    };
    const {group} = createGarment(look.kind,{
        fabric:cloth,rib:sameCloth(.75),hood:sameCloth(.84),pocket:sameCloth(.97),
        stitch:sameCloth(.62),cord:sameCloth(.7),hardware:matte('#4d504b',.43)
    });
    group.scale.set(.39,.316,.43);
    group.position.set(0,1.262,0);
    actor.add(group);
    return actor;
}

export async function createCast() {
    const root = new T.Group();
    const cache = new Map();
    const textures = new Map();
    let disposed = false;
    let mixer, request = 0;
    async function use(index) {
        if (disposed) return false;
        const ticket = ++request;
        const look = looks[index];
        if (!look) throw new Error('Unknown outfit');
        let asset = cache.get(index);
        if (!asset) {
            const url = look.model || assets.model;
            if (url) {
                const {GLTFLoader} = await import('./vendor/GLTFLoader.js');
                const gltf = await new GLTFLoader().loadAsync(new URL(url, import.meta.url).href);
                asset = {actor:gltf.scene, clips:gltf.animations};
            } else {
                let artwork = null;
                if (look.art) {
                    artwork = textures.get(look.art);
                    if (!artwork) {
                        artwork = await new T.TextureLoader().loadAsync(new URL(look.art,import.meta.url).href).catch(()=>null);
                        if (artwork) {
                            artwork.colorSpace = T.SRGBColorSpace;
                            artwork.anisotropy = 4;
                            textures.set(look.art,artwork);
                        }
                    }
                }
                asset = {actor:mannequin(look,artwork),clips:[]};
            }
            asset.actor.traverse(part => {
                if (part.isMesh) { part.castShadow = true; part.receiveShadow = true; }
            });
            if (disposed) {
                disposeActors([asset]);
                textures.forEach(texture=>texture.dispose());
                textures.clear();
                return false;
            }
            cache.set(index,asset);
        }
        if (ticket !== request) return false;
        mixer?.stopAllAction();
        mixer = null;
        root.clear();
        root.add(asset.actor);
        const clipName = look.idleClip || assets.idleClip;
        const clip = clipName && T.AnimationClip.findByName(asset.clips,clipName);
        if (clip) {
            mixer = new T.AnimationMixer(asset.actor);
            mixer.clipAction(clip).play();
        }
        return true;
    }
    function disposeActors(actors) {
        const resources = new Set();
        for (const {actor} of actors) actor.traverse(part => {
            if (part.geometry) resources.add(part.geometry);
            if (part.skeleton) resources.add(part.skeleton);
            for (const mat of [].concat(part.material || [])) {
                resources.add(mat);
                for (const value of Object.values(mat)) if (value?.isTexture) resources.add(value);
            }
        });
        resources.forEach(resource=>resource.dispose());
    }
    await use(0);
    return {root,use, animate(dt) { mixer?.update(dt); }, get animated() { return Boolean(mixer); },
        dispose() {
            disposed=true; request++;
            mixer?.stopAllAction();
            root.clear();
            disposeActors(cache.values());
            textures.forEach(texture=>texture.dispose());
            cache.clear(); textures.clear();
        }
    };
}
