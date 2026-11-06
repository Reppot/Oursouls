import * as T from '../studio/three/three.module.min.js';
import {createCast, looks} from './cast.js?v=2';

const v = (x,y,z) => new T.Vector3(x,y,z);
const mix = (a,b,t) => a + (b-a)*t;
const clamp = (n,a,b) => Math.max(a,Math.min(b,n));
const ease = t => t*t*(3-2*t);

function canvasTexture(w,h,paint,color = true) {
    const canvas = document.createElement('canvas');
    canvas.width=w; canvas.height=h;
    paint(canvas.getContext('2d'),w,h);
    const tex = new T.CanvasTexture(canvas);
    if (color) tex.colorSpace=T.SRGBColorSpace;
    return tex;
}

function studioReflection(renderer) {
    const map=canvasTexture(256,128,(c,w,h)=>{
        c.fillStyle='#292824'; c.fillRect(0,0,w,h);
        for (const [x,y,r,color] of [[51,26,39,'#f5e2c9'],[184,37,31,'#bccac6'],[130,18,15,'#e6d5b7']]) {
            const light=c.createRadialGradient(x,y,r*.16,x,y,r);
            light.addColorStop(0,color); light.addColorStop(1,'transparent');
            c.fillStyle=light; c.fillRect(x-r,y-r,r*2,r*2);
        }
    });
    const pmrem=new T.PMREMGenerator(renderer);
    const reflection=pmrem.fromEquirectangular(map);
    map.dispose(); pmrem.dispose();
    return reflection;
}

function architecture(scene) {
    const surface=(color,roughness,extra={})=>new T.MeshStandardMaterial({color,roughness,...extra});
    const mesh=(geometry,material,x,y,z)=>{
        const object=new T.Mesh(geometry,material);
        object.position.set(x,y,z);
        scene.add(object);
        return object;
    };
    const ground=mesh(new T.PlaneGeometry(28,32),surface('#222523',.61),0,-.205,-3);
    ground.rotation.x=-Math.PI/2; ground.receiveShadow=true;
    const grain=canvasTexture(128,128,(c,w,h)=>{
        const data=c.createImageData(w,h);
        let seed=4517;
        for(let y=0;y<h;y++) for(let x=0;x<w;x++) {
            seed=(Math.imul(seed,1664525)+1013904223)>>>0;
            const i=(y*w+x)*4;
            data.data[i]=data.data[i+1]=data.data[i+2]=127 + 36*(seed/4294967296-.5) + 7*Math.sin(.41*x+.32*y);
            data.data[i+3]=255;
        }
        c.putImageData(data,0,0);
    },false);
    grain.wrapS=grain.wrapT=T.RepeatWrapping;
    grain.repeat.set(.65,.65);
    const stageTop=surface('#41443f',.34,{metalness:.19,bumpMap:grain,bumpScale:.013,envMapIntensity:.74});
    const stageEdge=surface('#272b27',.48,{metalness:.32});
    const shape=new T.Shape(), half=1.53, end=7.8, corner=.11;
    shape.moveTo(-half+corner,-end); shape.lineTo(half-corner,-end);
    shape.quadraticCurveTo(half,-end,half,-end+corner);
    shape.lineTo(half,end-corner); shape.quadraticCurveTo(half,end,half-corner,end);
    shape.lineTo(-half+corner,end); shape.quadraticCurveTo(-half,end,-half,end-corner);
    shape.lineTo(-half,-end+corner); shape.quadraticCurveTo(-half,-end,-half+corner,-end);
    const platform=mesh(new T.ExtrudeGeometry(shape,{
        depth:.178, bevelEnabled:true, bevelSegments:2, bevelSize:.017, bevelThickness:.017,curveSegments:6
    }),[stageTop,stageEdge],0,-.195,-.4);
    platform.rotation.x=-Math.PI/2; platform.receiveShadow=true;

    const wall=surface('#181c19',.9), inset=surface('#101411',.88), trim=surface('#262b25',.66,{metalness:.2});
    mesh(new T.BoxGeometry(19,7,.14),wall,0,3.29,-9.04);
    for(const sign of [-1,1]) {
        mesh(new T.BoxGeometry(.16,6,24),wall,sign*7.3,2.8,-2);
        for(let i=0;i<4;i++) {
            mesh(new T.BoxGeometry(1.46,4.18,.10),inset,sign*(2.47+i*1.51),1.94,-8.94);
            mesh(new T.BoxGeometry(.042,4.2,.13),trim,sign*(1.72+i*1.51),1.94,-8.87);
        }
    }
    // An acoustic curtain encloses the stage entrance. The pleats are geometry.
    const curtain=new T.PlaneGeometry(3.53,4.38,90,14);
    const points=curtain.attributes.position;
    for(let i=0;i<points.count;i++) {
        const x=points.getX(i),y=points.getY(i);
        points.setZ(i,.068*Math.cos(x*35+Math.sin(x*10)*.55+y*.13)+.022*Math.cos(x*67+y*.3));
    }
    curtain.computeVertexNormals();
    mesh(curtain,surface('#1a1c18',.98),0,2.0,-8.8);
    mesh(new T.BoxGeometry(3.66,.18,.26),trim,0,4.18,-8.83);
    // A subtle, local contact shadow reinforces the shoes at lower shadow quality.
    const contact=canvasTexture(64,64,(c,w,h)=>{
        const gradient=c.createRadialGradient(w/2,h/2,1,w/2,h/2,w/2);
        gradient.addColorStop(0,'rgba(0,0,0,.62)'); gradient.addColorStop(.45,'rgba(0,0,0,.27)');
        gradient.addColorStop(1,'rgba(0,0,0,0)');
        c.fillStyle=gradient; c.fillRect(0,0,w,h);
    });
    const shadow=mesh(new T.PlaneGeometry(.83,.73),new T.MeshBasicMaterial({
        map:contact,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,
    }),0,.003,-1);
    shadow.rotation.x=-Math.PI/2;
}

function lighting(scene,shadowSize) {
    const ambient=new T.HemisphereLight('#e3e5de','#67675a',.86);
    scene.add(ambient);
    const key=new T.DirectionalLight('#ffe7cc',2.95);
    key.position.set(-2.7,4.8,2.6);
    key.target.position.set(0,.6,-1);
    key.castShadow=true;
    key.shadow.mapSize.set(shadowSize,shadowSize);
    Object.assign(key.shadow.camera,{left:-2.7,right:2.7,top:2.5,bottom:-2.7,near:.1,far:13});
    key.shadow.normalBias=.021; key.shadow.bias=-.00019; key.shadow.radius=3.2;
    scene.add(key,key.target);
    const bounce=new T.DirectionalLight('#d2e3de',.88);
    bounce.position.set(3.9,2.65,3.15);
    scene.add(bounce);
    const spot=(color,intensity,pos,target,angle)=>{
        const light=new T.SpotLight(color,intensity,24,angle,.74,2);
        light.position.copy(pos); light.target.position.copy(target);
        scene.add(light,light.target);
    };
    spot('#fff0d3',96,v(1.3,4.3,-3.6),v(0,1.2,-1),.48);
    spot('#a4b5a7',125,v(-1,5.1,-5.8),v(0,1.3,-8.7),.65);
    spot('#dec5a3',49,v(1.5,3.8,1.7),v(.1,0,2.7),.61);
}

// The closed spline gives the return shot the same velocity as the opening shot.
const tour=new T.CatmullRomCurve3([
    v(-.73,1.51,4.32),v(-.37,1.38,3.36),v(.47,1.26,2.51),
    v(1.40,1.36,2.87),v(1.13,1.58,4.29),v(.08,1.59,4.77),
],true,'centripetal');
const targetTrack=new T.CatmullRomCurve3([
    v(0,1.00,-1),v(0,1.02,-1),v(0,1.18,-1),
    v(0,1.14,-1),v(0,1.02,-1),v(0,1.00,-1),
],true,'centripetal');

export async function createRunway(host,{mobile,low,reduced,manual,onError}) {
    const renderer=new T.WebGLRenderer({antialias:!low,powerPreference:'low-power',failIfMajorPerformanceCaveat:false});
    renderer.toneMapping=T.ACESFilmicToneMapping;
    renderer.toneMappingExposure=1.06;
    renderer.shadowMap.enabled=true;
    renderer.shadowMap.type=T.PCFShadowMap;
    renderer.shadowMap.autoUpdate=false;
    const surface=renderer.domElement;
    surface.tabIndex=0;
    surface.setAttribute('role','img');
    surface.setAttribute('aria-label','3D-подиум с манекеном. Стрелки меняют ракурс камеры.');
    const scene=new T.Scene();
    scene.background=new T.Color('#111512');
    scene.fog=new T.FogExp2('#101310',.043);
    const reflections=studioReflection(renderer);
    scene.environment=reflections.texture; scene.environmentIntensity=.54;
    const camera=new T.PerspectiveCamera(39,1,.08,36);
    const listeners=new AbortController();
    const options={signal:listeners.signal};
    const aim=v(0,1,-1), from=v(0,0,0), fromAim=v(0,0,0);
    let cast,playing=!reduced.matches && !manual,visible=true,disposed=false;
    let phase=0,transition=1,frame=0,last=0,drag=null,w=1,h=1;
    let activeIndex=0;
    const listenersForMode=new Set();
    const status=()=>listenersForMode.forEach(fn=>fn(playing));
    const render=()=>renderer.render(scene,camera);
    const position=()=>{
        if(playing) {
            const t=ease(transition);
            camera.position.copy(from).lerp(tour.getPointAt(phase),t);
            aim.copy(fromAim).lerp(targetTrack.getPointAt(phase),t);
        }
        camera.lookAt(aim);
        if(mobile.matches) camera.clearViewOffset();
        else camera.setViewOffset(w,h,-w*.225,0,w,h);
    };
    function resize() {
        w=Math.max(1,host.clientWidth); h=Math.max(1,host.clientHeight);
        const dpr=Math.min(devicePixelRatio||1,low?1:mobile.matches?1.28:1.5,Math.sqrt(1_600_000/(w*h)));
        renderer.setPixelRatio(dpr);
        renderer.setSize(w,h,false);
        camera.aspect=w/h;
        camera.fov=mobile.matches?46:39;
        camera.clearViewOffset();
        camera.updateProjectionMatrix();
        position();
        if(cast) render();
    }
    function schedule() {
        if(!frame && !disposed && visible && !document.hidden && playing) frame=requestAnimationFrame(update);
    }
    function update(now) {
        frame=0;
        if(disposed || !visible || document.hidden || !playing) return;
        const dt=last?Math.min(.1,(now-last)/1000):0;
        if(last && now-last < (low?45:30)) { schedule(); return; }
        last=now;
        phase=(phase+dt/24)%1;
        transition=Math.min(1,transition+dt/1.2);
        if(cast.animated) { cast.animate(dt); renderer.shadowMap.needsUpdate=true; }
        position(); render(); schedule();
    }
    function pauseFrames() {
        if(frame) cancelAnimationFrame(frame);
        frame=0; last=0;
    }
    function setPlaying(value) {
        if(playing===value) return;
        playing=value;
        if(playing) {
            from.copy(camera.position); fromAim.copy(aim);
            transition=0; schedule();
        } else pauseFrames();
        status();
    }
    function orbit(dx,dy) {
        setPlaying(false);
        const orbit=new T.Spherical().setFromVector3(camera.position.clone().sub(aim));
        orbit.theta=clamp(orbit.theta+dx,-.68,.79);
        orbit.phi=clamp(orbit.phi+dy,1.16,1.66);
        camera.position.copy(aim).add(new T.Vector3().setFromSpherical(orbit));
        position(); render();
    }
    function reset() {
        setPlaying(false);
        phase=0; transition=1;
        camera.position.copy(tour.getPointAt(0)); aim.copy(targetTrack.getPointAt(0));
        position(); render();
    }
    const observer=new ResizeObserver(resize);
    function destroy() {
        if(disposed) return;
        disposed=true; pauseFrames(); observer.disconnect(); listeners.abort();
        cast?.dispose();
        const resources=new Set();
        scene.traverse(obj=>{
            if(obj.geometry) resources.add(obj.geometry);
            for(const mat of [].concat(obj.material||[])) {
                resources.add(mat);
                for(const tex of [mat.map,mat.bumpMap]) if(tex) resources.add(tex);
            }
        });
        for(const item of resources) item.dispose();
        reflections.dispose(); renderer.dispose(); surface.remove();
    }
    surface.addEventListener('webglcontextlost',event=>{event.preventDefault(); destroy(); onError();},options);
    surface.addEventListener('pointerdown',event=>{
        if(event.button!==0) return;
        drag={id:event.pointerId,x:event.clientX,y:event.clientY};
        if(event.pointerType==='mouse') surface.setPointerCapture(event.pointerId);
    },options);
    surface.addEventListener('pointermove',event=>{
        if(drag?.id!==event.pointerId) return;
        const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
        if(Math.abs(dx)+Math.abs(dy)<2) return;
        drag.x=event.clientX; drag.y=event.clientY;
        orbit(-dx*.004,dy*.0025);
    },options);
    for(const name of ['pointerup','pointercancel','lostpointercapture','pointerleave']) {
        surface.addEventListener(name,()=>{drag=null;},options);
    }
    surface.addEventListener('keydown',event=>{
        const key={ArrowLeft:[-.10,0],ArrowRight:[.10,0],ArrowUp:[0,-.06],ArrowDown:[0,.06]}[event.key];
        if(!key) return;
        event.preventDefault(); orbit(...key);
    },options);
    document.addEventListener('visibilitychange',()=>{
        if(document.hidden) pauseFrames();
        else schedule();
    },options);
    reduced.addEventListener('change',()=>{if(reduced.matches) setPlaying(false);},options);
    window.addEventListener('pagehide',event=>{if(!event.persisted) destroy();},options);

    try {
        architecture(scene);
        lighting(scene,low?512:mobile.matches?768:1024);
        cast=await createCast();
        if (disposed) { cast.dispose(); throw new Error('WebGL context lost'); }
        cast.root.position.z=-1;
        scene.add(cast.root);
        camera.position.copy(tour.getPointAt(0)); aim.copy(targetTrack.getPointAt(0));
        from.copy(camera.position); fromAim.copy(aim);
        host.append(surface);
        renderer.shadowMap.needsUpdate=true;
        resize(); observer.observe(host); schedule();
    } catch(error) {
        destroy();
        throw error;
    }
    return {
        setVisible(value) {visible=value; if(value) schedule(); else pauseFrames();},
        toggle() {setPlaying(!playing);}, reset,
        onMode(fn) {listenersForMode.add(fn); fn(playing);},
        get index() {return activeIndex;},
        async changeLook(index) {
            if(await cast.use((index+looks.length)%looks.length) && !disposed) {
                activeIndex=(index+looks.length)%looks.length;
                renderer.shadowMap.needsUpdate=true;
                render();
            }
            return {index:activeIndex,name:looks[activeIndex].name,total:looks.length};
        },
    };
}
