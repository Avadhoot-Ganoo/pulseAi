# MediaPipe Local Assets

This app can use MediaPipe Face Landmarker for better ROI selection. To enable it offline and avoid network errors, place the required files under this folder.

Folder layout:

```
public/mediapipe/
  wasm/
    vision_wasm_internal.js
    vision_wasm_internal.wasm
    vision_wasm_internal.worker.js
  models/
    face_landmarker.task
```

Where to obtain files:
- Get the WASM bundle (`vision_wasm_internal.*`) from the MediaPipe Vision Tasks package distribution.
- Get the `face_landmarker.task` model from the MediaPipe Face Landmarker release.

Notes:
- Paths are referenced in code as `/mediapipe/wasm` and `/mediapipe/models`.
- If these files are missing, the app will skip initializing the Face Landmarker and fall back to a basic ROI heuristic.
- On some proxies/tunnels, `HEAD` requests may show `net::ERR_ABORTED` when checking asset existence. This is expected if assets are not present.