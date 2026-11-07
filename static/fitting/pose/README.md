# Local pose detection assets

MediaPipe Tasks Vision 0.10.22-rc.20250304, unmodified ESM and SIMD WASM files.
Source: https://registry.npmjs.org/@mediapipe/tasks-vision/-/tasks-vision-0.10.22-rc.20250304.tgz
Upstream: https://github.com/google-ai-edge/mediapipe
Apache 2.0 license text: LICENSE.txt.

Official Pose Landmarker Lite float16 model, version 1:
https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task
Model documentation: https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker

All resources are served from the shop origin. They load only after the user
clicks shoulder detection. No photo leaves the browser. Inference runs in a
short-lived CPU worker. Devices without WASM SIMD retain manual placement.

SHA-256

pose_landmarker_lite.task: 59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a
vision_bundle.mjs: 3252b10e0fd26c4095e4b6ee545c1c898120b3a3813388ecd4876abe6f1399a9
wasm\vision_wasm_internal.wasm: f00ec4731faa23b3e714d00e88d4d10e2df5c0a427d3a2b4ae6e3526fdd14ef7
