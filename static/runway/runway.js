const hero=document.querySelector('[data-runway]');
if(hero) {
    const host=hero.querySelector('.runway-stage');
    const controls=hero.querySelector('.runway-controls');
    const start=hero.querySelector('[data-runway-start]');
    const live=hero.querySelector('[data-runway-live]');
    const play=hero.querySelector('[data-runway-play]');
    const outfit=hero.querySelector('[data-runway-look]');
    const label=hero.querySelector('[data-runway-name]');
    const reset=hero.querySelector('[data-runway-reset]');
    const message=hero.querySelector('[data-runway-message]');
    const mobile=matchMedia('(max-width: 720px)');
    const reduced=matchMedia('(prefers-reduced-motion: reduce)');
    const query=new URLSearchParams(location.search).get('runway');
    const constrained=()=>Boolean(navigator.connection?.saveData
        || ['slow-2g','2g','3g'].includes(navigator.connection?.effectiveType)
        || (navigator.deviceMemory && navigator.deviceMemory<=2)
        || (mobile.matches && navigator.hardwareConcurrency && navigator.hardwareConcurrency<=4));
    let runway=null,loading=false,visible=false;

    function fallback() {
        runway=null;
        hero.removeAttribute('data-runway-ready');
        live.hidden=true; start.hidden=false; start.disabled=false;
        start.textContent='Включить 3D';
        message.textContent='3D-подиум недоступен.';
    }
    async function load() {
        if(runway || loading) return;
        loading=true;
        start.disabled=true;
        start.textContent='Загрузка 3D…';
        message.textContent='';
        try {
            const {createRunway}=await import('./scene.js?v=5');
            const low=constrained();
            runway=await createRunway(host,{mobile,low,reduced,manual:low || query==='manual',onError:fallback});
            runway.setVisible(visible);
            runway.onMode(playing=>{
                play.setAttribute('aria-pressed',String(playing));
                play.textContent=playing?'Пауза':'Автокамера';
                play.setAttribute('aria-label',playing?'Поставить движение камеры на паузу':'Включить автоматическое движение камеры');
            });
            hero.setAttribute('data-runway-ready','');
            live.hidden=false; start.hidden=true;
        } catch(error) {
            fallback();
            console.warn('Our Souls runway unavailable:',error);
        } finally {
            loading=false;
        }
    }
    start.addEventListener('click',load);
    play.addEventListener('click',()=>runway?.toggle());
    reset.addEventListener('click',()=>runway?.reset());
    outfit.addEventListener('click',async()=>{
        if(!runway) return;
        outfit.disabled=true;
        try {
            const next=await runway.changeLook(runway.index+1);
            label.textContent=next.name;
            label.href=next.url;
            outfit.textContent='Образ '+(next.index+1)+' / '+next.total+' →';
            message.textContent='';
        } catch {
            message.textContent='Этот образ не загрузился. Попробуй ещё раз.';
        } finally {
            outfit.disabled=false;
        }
    });
    controls.hidden=false;
    start.hidden=false;
    const queue=()=>{
        if('requestIdleCallback' in window) requestIdleCallback(()=>{if(visible) load();},{timeout:1400});
        else setTimeout(()=>{if(visible) load();},180);
    };
    const firstPaint=()=>{
        const observer=new IntersectionObserver(([entry])=>{
            visible=entry.isIntersecting;
            runway?.setVisible(visible);
            if(visible && !constrained() && query!=='off' && !runway && !loading) queue();
        },{threshold:.05});
        observer.observe(hero);
    };
    if(document.readyState==='complete') firstPaint();
    else window.addEventListener('load',firstPaint,{once:true});
}
