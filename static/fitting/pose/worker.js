let detector;
async function detect(image) {
    if (!detector) {
        const {FilesetResolver,PoseLandmarker}=await import('./vision_bundle.mjs');
        const files=await FilesetResolver.forVisionTasks(new URL('./wasm/',self.location.href).href.replace(/\/$/,''));
        if (files.wasmBinaryPath.includes('nosimd')) throw new Error('WASM SIMD unavailable');
        detector=await PoseLandmarker.createFromOptions(files,{
            baseOptions:{modelAssetPath:new URL('./pose_landmarker_lite.task',self.location.href).href,delegate:'CPU'},
            runningMode:'IMAGE',numPoses:1,
        });
    }
    return detector.detect(image).landmarks[0] || null;
}
self.onmessage=async ({data:image})=>{
    try { self.postMessage({points:await detect(image)}); }
    catch { self.postMessage({error:true}); }
    finally { image.close(); }
};
