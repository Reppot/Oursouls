import * as T from './three/three.module.min.js';
import { createGarment } from './garment-geometry.js?ver=2.3.3';

const clamp = (n, low, high) => Math.min(high, Math.max(low, n));
const printUnits = 245;
const TAU = 2 * Math.PI;
const vec = (x, y, z) => new T.Vector3(x, y, z);
const nearestTurn = (from, to) => from + Math.atan2(Math.sin(to - from), Math.cos(to - from));

function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

function grain() {
    const c = canvas(96, 96), g = c.getContext('2d'), im = g.createImageData(96, 96);
    let seed = 4189;
    for (let y = 0; y < 96; y++) for (let x = 0; x < 96; x++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        const thread = 132 + 18 * Math.cos(x * Math.PI * .5) * Math.sin(y * Math.PI * .5) + 19 * (seed / 4294967296 - .5);
        const i = (y * 96 + x) * 4;
        im.data[i] = im.data[i + 1] = im.data[i + 2] = thread; im.data[i + 3] = 255;
    }
    g.putImageData(im, 0, 0);
    const texture = new T.CanvasTexture(c);
    texture.wrapS = texture.wrapT = T.RepeatWrapping;
    texture.repeat.set(14, 14);
    return texture;
}

function layers() {
    const result = {};
    for (const side of ['front', 'back']) {
        const c = canvas(1020, 1190);
        const texture = new T.CanvasTexture(c);
        texture.colorSpace = T.SRGBColorSpace;
        texture.anisotropy = 4;
        result[side] = { canvas: c, texture, paint: null, stamp: null, dirty: false };
    }
    return result;
}

function createMaterials(prints) {
    const bump = grain();
    const textile = (more = {}) => new T.MeshStandardMaterial({ roughness: .96, metalness: 0, side: T.DoubleSide, bumpMap: bump, bumpScale: .0045, ...more });
    const fabric = textile();
    fabric.onBeforeCompile = shader => {
        shader.uniforms.ospFront = {value: prints.front.texture};
        shader.uniforms.ospBack = {value: prints.back.texture};
        shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 ospPosition;')
            .replace('#include <begin_vertex>', '#include <begin_vertex>\nospPosition = position;');
        shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 ospPosition; uniform sampler2D ospFront; uniform sampler2D ospBack;')
            .replace('#include <color_fragment>', `#include <color_fragment>
                if (gl_FrontFacing) {
                    bool forward = ospPosition.z >= 0.0;
                    vec2 uvPrint = vec2(.5 + ospPosition.x * (forward ? ${printUnits}.0 : -${printUnits}.0) / 600.0, (350.0 + ospPosition.y * ${printUnits}.0) / 700.0);
                    if (uvPrint.x > 0.0 && uvPrint.x < 1.0 && uvPrint.y > 0.0 && uvPrint.y < 1.0) {
                        vec4 ink = forward ? texture2D(ospFront, uvPrint) : texture2D(ospBack, uvPrint);
                        diffuseColor.rgb = mix(diffuseColor.rgb, ink.rgb, ink.a);
                    }
                } else { diffuseColor.rgb *= .42; }
            `);
    };
    fabric.customProgramCacheKey = () => 'os-fabric-decal-v1';
    const inside = material => {
        material.onBeforeCompile = shader => { shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\nif (!gl_FrontFacing) diffuseColor.rgb *= .52;'); };
        material.customProgramCacheKey = () => 'os-textile-inside-v1';
        return material;
    };
    return {
        fabric, rib: inside(textile({ bumpScale: .008 })), hood: inside(textile()), pocket: textile(),
        stitch: textile({ bumpMap: null }), cord: textile({ bumpScale: .006 }),
        hardware: new T.MeshStandardMaterial({ color: '#615f52', metalness: .56, roughness: .45 })
    };
}

function addStudio(scene) {
    const key = new T.DirectionalLight('#fff6e9', 2.8);
    key.position.set(-4.4, 3.7, 3.5);
    key.castShadow = true;
    key.shadow.mapSize.set(1536, 1536);
    Object.assign(key.shadow.camera, { left: -2.2, right: 2.2, top: 2.2, bottom: -2.2, near: .1, far: 12 });
    key.shadow.bias = -.00028;
    key.shadow.normalBias = .023;
    const fill = new T.DirectionalLight('#edf2ff', .61);
    fill.position.set(4, 1.7, 2.1);
    const rim = new T.DirectionalLight('#fff9ef', 2.10);
    rim.position.set(1.2, 4, -4.7);
    scene.add(key, fill, rim, new T.HemisphereLight('#f7f8ee', '#858b81', 1.21));
    const soft = canvas(128, 128), c = soft.getContext('2d');
    const g = c.createRadialGradient(64, 64, 5, 64, 64, 60);
    g.addColorStop(0, 'rgba(34,38,28,.23)'); g.addColorStop(.48, 'rgba(34,38,28,.09)'); g.addColorStop(1, 'rgba(34,38,28,0)');
    c.fillStyle = g; c.fillRect(0, 0, 128, 128);
    const shadow = new T.Mesh(new T.PlaneGeometry(2.65, 1.75), new T.MeshBasicMaterial({ map: new T.CanvasTexture(soft), transparent: true, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = -1.133;
    scene.add(shadow);
    return shadow;
}

export function createViewer(host, callbacks) {
    const renderer = new T.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.11;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFShadowMap;
    renderer.shadowMap.autoUpdate = false;
    const el = renderer.domElement;
    el.tabIndex = 0;
    el.setAttribute('aria-label', '3D-модель одежды. Стрелки вращают модель или двигают принт в режиме размещения.');
    host.appendChild(el);

    const scene = new T.Scene(), camera = new T.OrthographicCamera(-1, 1, 1, -1, .1, 30);
    const print = layers(), materials = createMaterials(print), models = new Map();
    const contactShadow = addStudio(scene);
    let presentationPromise;
    const detailedMaterials=[];
    let garment = null, yaw = .28, pitch = .115, zoom = 1, orient = null;
    let raf = 0, disposed = false, mode = 'orbit', side = 'front', pointers = new Map(), gesture = null;
    let viewport = { width: 1, height: 1, ratio: 1 };

    function placeCamera(width, height, viewYaw = yaw, viewPitch = pitch, viewZoom = zoom) {
        const ratio = width / height;
        const viewHeight = Math.max(garment.span, 2.51 / ratio) / viewZoom;
        Object.assign(camera, { left: -viewHeight * ratio / 2, right: viewHeight * ratio / 2, top: viewHeight / 2, bottom: -viewHeight / 2 });
        camera.updateProjectionMatrix();
        const distance = 6.1;
        camera.position.set(Math.sin(viewYaw) * Math.cos(viewPitch) * distance,
            garment.center + Math.sin(viewPitch) * distance, Math.cos(viewYaw) * Math.cos(viewPitch) * distance);
        camera.lookAt(0, garment.center, 0);
        camera.updateMatrixWorld();
    }

    function paintPrints() {
        for (const item of Object.values(print)) {
            if (!item.dirty) continue;
            const c = item.canvas, ctx = c.getContext('2d');
            ctx.setTransform(c.width / 600, 0, 0, c.height / 700, 0, 0);
            ctx.clearRect(0, 0, 600, 700);
            if (item.paint) {
                item.paint(ctx);
            }
            item.texture.needsUpdate = true; item.dirty = false;
        }
    }

    function renderFrame(time) {
        raf = 0;
        if (!garment || disposed) return;
        if (orient) {
            const fraction = clamp((time - orient.start) / 300, 0, 1);
            const eased = 1 - Math.pow(1 - fraction, 3);
            yaw = orient.from + (orient.to - orient.from) * eased;
            if (fraction === 1) orient = null;
        }
        paintPrints(); placeCamera(viewport.width, viewport.height); renderer.render(scene, camera);
        if (orient) schedule();
    }

    function schedule() { if (!raf && !disposed) raf = requestAnimationFrame(renderFrame); }
    function resize() {
        const rect = host.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        viewport = { width: Math.round(rect.width), height: Math.round(rect.height), ratio: Math.min(window.devicePixelRatio || 1, 1.8) };
        renderer.setPixelRatio(viewport.ratio); renderer.setSize(viewport.width, viewport.height, false); schedule();
    }

    function setGarment(kind) {
        if (!models.has(kind)) models.set(kind, createGarment(kind, materials));
        const next = models.get(kind);
        if (next === garment) return;
        if (garment) scene.remove(garment.group);
        garment = next; scene.add(garment.group); renderer.shadowMap.needsUpdate = true; schedule();
    }

    let lastColor;
    function setColor(hex) {
        if (lastColor === hex) return;
        lastColor = hex;
        const base = new T.Color(hex), white = new T.Color('#fff0da');
        materials.fabric.color.copy(base);
        materials.hood.color.copy(base).multiplyScalar(.94);
        materials.pocket.color.copy(base).multiplyScalar(.96);
        materials.rib.color.copy(base).multiplyScalar(.82);
        materials.stitch.color.copy(base).multiplyScalar(.67);
        materials.cord.color.copy(base).lerp(white, .055);
        for (const material of detailedMaterials) material.color.copy(base).multiplyScalar(1.65);
        schedule();
    }

    // Replace the editor's fallback geometry with the same fitted, textured
    // garments used by the person. Canonical coordinates keep print positions
    // and order exports consistent with existing saved designs.
    import('../fitting/outfits.js').then(async module=>({asset:await module.loadOutfits(),cords:module.createDrawstrings})).then(({asset,cords})=>{
        if (disposed) return;
        const names={Cloth_tshirt:'tee',Cloth_longsleeve:'long',Cloth_hoodie:'hoodie'};
        const transform=new T.Matrix4().makeScale(1/.405,1/.325,1/.54);
        transform.setPosition(0,-1.29/.325,0);
        const activeKind=garment?.group.name;
        asset.scene.traverse(part=>{
            const kind=names[part.name];
            if (!part.isMesh || !kind) return;
            const geometry=part.geometry.clone().applyMatrix4(transform);
            geometry.computeBoundingBox();
            const material=materials.fabric.clone();
            material.onBeforeCompile=materials.fabric.onBeforeCompile;
            material.customProgramCacheKey=materials.fabric.customProgramCacheKey;
            material.map=part.material.map;material.normalMap=part.material.normalMap;
            material.normalScale.setScalar(.45);material.bumpMap=null;
            material.color.set(lastColor||'#202321').multiplyScalar(1.65);
            detailedMaterials.push(material);
            const fabric=new T.Mesh(geometry,material);fabric.castShadow=true;fabric.receiveShadow=true;
            const group=new T.Group();group.name=kind;group.add(fabric);
            if(kind==='hoodie') {const strings=cords();strings.applyMatrix4(transform);group.add(strings);}
            const box=geometry.boundingBox;
            const fitted={group,fabric,center:(box.min.y+box.max.y)/2,span:Math.max(2.25,(box.max.y-box.min.y)*1.13)};
            models.set(kind,fitted);
        });
        if (activeKind) setGarment(activeKind);
    }).catch(()=>{/* The existing geometry keeps the editor usable if an asset fails. */});

    function setPrint(key, paint, stamp) {
        const item = print[key];
        if (item.stamp === stamp) return;
        item.paint = paint; item.stamp = stamp; item.dirty = true; schedule();
    }

    function showSide(value, animate = true) {
        side = value;
        const to = nearestTurn(yaw, value === 'front' ? 0 : Math.PI);
        if (animate && !matchMedia('(prefers-reduced-motion: reduce)').matches) orient = { from: yaw, to, start: performance.now() };
        else { orient = null; yaw = to; }
        pitch = .115; schedule();
    }

    function reportFacing() {
        side = Math.cos(yaw) >= 0 ? 'front' : 'back';
        callbacks.facing(side);
    }

    const ray = new T.Raycaster(), ndc = new T.Vector2();
    function pick(event, fallbackDepth) {
        const r = el.getBoundingClientRect();
        ndc.set((event.clientX - r.left) / r.width * 2 - 1, 1 - (event.clientY - r.top) / r.height * 2);
        ray.setFromCamera(ndc, camera);
        const sign = side === 'front' ? 1 : -1;
        const hit = ray.intersectObject(garment.fabric, false).find(h => h.face.materialIndex === 0 && h.point.z * sign > .006 && h.face.normal.dot(ray.ray.direction) < 0);
        const point = hit ? hit.point : Number.isFinite(fallbackDepth) ? ray.ray.intersectPlane(new T.Plane(vec(0, 0, 1), -fallbackDepth), vec(0, 0, 0)) : null;
        return point ? { x: 300 + point.x * sign * printUnits, y: 350 - point.y * printUnits, z: point.z } : null;
    }

    function pinchDistance() { const [a, b] = pointers.values(); return Math.hypot(a.x - b.x, a.y - b.y); }
    function zoomBy(factor) { zoom = clamp(zoom * factor, .85, 2.05); schedule(); }
    el.addEventListener('pointerdown', event => {
        if (!garment || event.button > 0) return;
        el.focus({ preventScroll: true });
        orient = null; el.setPointerCapture(event.pointerId);
        pointers.set(event.pointerId, {x: event.clientX, y: event.clientY});
        if (pointers.size === 2) gesture = { type: 'pinch', distance: Math.max(1, pinchDistance()), zoom };
        else if (pointers.size === 1) {
            const current = mode === 'print' && callbacks.position(side);
            const point = current ? pick(event) : null;
            gesture = point ? { type: 'print', dx: point.x - current.x, dy: point.y - current.y, depth: point.z } : { type: 'orbit' };
        }
        el.dataset.dragging = 'true';
    });
    el.addEventListener('pointermove', event => {
        const prior = pointers.get(event.pointerId);
        if (!prior || !gesture) return;
        pointers.set(event.pointerId, {x: event.clientX, y: event.clientY});
        if (gesture.type === 'pinch' && pointers.size === 2) { zoom = clamp(gesture.zoom * pinchDistance() / gesture.distance, .85, 2.05); schedule(); }
        if (gesture.type === 'orbit') {
            yaw = (yaw - (event.clientX - prior.x) * .012) % TAU;
            pitch = clamp(pitch + (event.clientY - prior.y) * .008, -.48, .82); schedule();
        }
        if (gesture.type === 'print') {
            const point = pick(event, gesture.depth);
            if (point) callbacks.move(side, point.x - gesture.dx, point.y - gesture.dy);
        }
    });
    const release = event => {
        if (!pointers.delete(event.pointerId)) return;
        if (!pointers.size) { const wasOrbit = gesture && gesture.type !== 'print'; gesture = null; delete el.dataset.dragging; if (wasOrbit) reportFacing(); }
        else if (pointers.size === 1) gesture = { type: 'orbit' };
    };
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => el.addEventListener(type, release));
    el.addEventListener('keydown', event => {
        const deltas = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
        if (!deltas[event.key]) return;
        event.preventDefault();
        const [x, y] = deltas[event.key], current = mode === 'print' && callbacks.position(side);
        if (current) { const step = event.shiftKey ? 10 : 2; callbacks.move(side, current.x + x * step, current.y + y * step); }
        else { orient = null; yaw += x * .15; pitch = clamp(pitch - y * .105, -.48, .82); reportFacing(); schedule(); }
    });
    el.addEventListener('webglcontextlost', event => { event.preventDefault(); disposed = true; observer.disconnect(); if (raf) cancelAnimationFrame(raf); callbacks.unavailable(); });
    const observer = new ResizeObserver(resize);
    observer.observe(host);

    function exportPair() {
        if (!garment || disposed) throw new Error('Preview unavailable');
        paintPrints();
        const out = canvas(1600, 900), ctx = out.getContext('2d');
        renderer.setPixelRatio(1); renderer.setSize(800, 900, false);
        try {
            for (const [index, label] of [[0, 'ПЕРЕД'], [1, 'СПИНА']]) {
                const x = index * 800;
                const bg = ctx.createLinearGradient(x, 0, x + 800, 900);
                bg.addColorStop(0, '#f6f6f0'); bg.addColorStop(1, '#e3e6dd'); ctx.fillStyle = bg; ctx.fillRect(x, 0, 800, 900);
                placeCamera(800, 900, index * Math.PI, .085, 1);
                renderer.render(scene, camera); ctx.drawImage(el, x, -12);
                ctx.fillStyle = '#465542'; ctx.font = '18px Arial'; ctx.textAlign = 'center'; ctx.fillText(label, x + 400, 859);
            }
        } finally { resize(); }
        return out;
    }

    function capture(width, height, aim, cameraYaw, viewHeight) {
        const out = canvas(width, height);
        paintPrints();
        renderer.setPixelRatio(1);
        renderer.setSize(width, height, false);
        const half = viewHeight / 2, horizontal = half * width / height;
        Object.assign(camera, {left:-horizontal,right:horizontal,top:half,bottom:-half});
        camera.updateProjectionMatrix();
        camera.position.set(Math.sin(cameraYaw)*6,aim,Math.cos(cameraYaw)*6);
        camera.lookAt(0,aim,0);
        renderer.render(scene,camera);
        out.getContext('2d').drawImage(el,0,0);
        return out;
    }

    function exportGarment(which) {
        if (!garment || disposed) throw new Error('Preview unavailable');
        contactShadow.visible = false;
        try { return capture(760,860,garment.center,which==='back'?Math.PI:0,Math.max(garment.span,2.83)); }
        finally { contactShadow.visible = true; resize(); }
    }

    async function fittingSnapshot(profile) {
        if (!presentationPromise) presentationPromise=import('../fitting/avatar.js?v=3').then(module=>module.createPresentation(print))
            .catch(error=>{presentationPromise=null;throw error;});
        const presentation = await presentationPromise;
        if (!garment || disposed) throw new Error('Preview unavailable');
        const out=canvas(900,1120);
        paintPrints();
        presentation.prepare(profile,garment.group.name,lastColor||'#202321',out.width/out.height);
        const exposure=renderer.toneMappingExposure;
        renderer.setPixelRatio(1);renderer.setSize(out.width,out.height,false);
        renderer.toneMappingExposure=1.04;
        renderer.shadowMap.needsUpdate=true;
        try {
            renderer.render(presentation.scene,presentation.camera);
            out.getContext('2d').drawImage(el,0,0);
            return out;
        }
        finally {
            renderer.toneMappingExposure=exposure;
            renderer.shadowMap.needsUpdate = true;
            resize();
        }
    }

    return { setGarment, setColor, setPrint, showSide, resize, zoomBy, exportPair, exportGarment, fittingSnapshot,
        setMode(value) { mode = value; el.dataset.mode = value; },
        reset() { zoom = 1; showSide(side); },
        syncSide(value) { side = value; }
    };
}
