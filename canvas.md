<!-- <Canvas
  // ═══════════ RENDERER PROPERTIES ═══════════
  gl={{
    alpha: true,
    antialias: true,
    precision: 'highp', // 'highp' | 'mediump' | 'lowp'
    powerPreference: 'high-performance', // 'high-performance' | 'low-power' | 'default'
    premultipliedAlpha: true,
    preserveDrawingBuffer: false,
    logarithmicDepthBuffer: false,
    toneMapping: THREE.ACESFilmicToneMapping,
    outputColorSpace: THREE.SRGBColorSpace,
  }}

  // ═══════════ CAMERA PROPERTIES ═══════════
  camera={{
    position: [0, 0, 5],
    rotation: [0, 0, 0],
    fov: 75,
    near: 0.1,
    far: 1000,
    zoom: 1,
    up: [0, 1, 0],
    // For orthographic camera:
    // left, right, top, bottom, near, far
  }}
  orthographic={false} // Set to true for orthographic camera!

  // ═══════════ SCENE PROPERTIES ═══════════
  scene={{
    background: new THREE.Color('black'),
    environment: null,
    fog: new THREE.Fog('white', 1, 100),
  }}

  // ═══════════ RAYCASTER PROPERTIES ═══════════
  raycaster={{
    enabled: true,
    filter: (items, state) => items,
    computeOffsets: (event, state) => ({ offsetX: event.offsetX, offsetY: event.offsetY }),
  }}

  // ═══════════ SIZE & LAYOUT ═══════════
  resize={{ scroll: true, debounce: { scroll: 50, resize: 0 } }}
  style={{ width: '100%', height: '100vh' }}
  className="my-canvas"

  // ═══════════ RENDERING BEHAVIOR ═══════════
  frameloop="always" // 'always' | 'demand' | 'never'
  dpr={[1, 2]} // Device pixel ratio: number or [min, max]
  performance={{ min: 0.5, max: 1, debounce: 200 }}
  linear={false} // Use linear color space instead of sRGB
  flat={false} // Use THREE.NoToneMapping
  legacy={false} // Legacy mode for THREE < r139

  // ═══════════ EVENT HANDLING ═══════════
  events={(store) => ({
    // Custom event manager - ADVANCED!
    priority: 1,
    enabled: true,
    compute: (event, state) => { /* custom compute */ },
    connected: undefined,
  })}
  eventSource={document.getElementById('root')} // Custom event source
  eventPrefix="offset" // 'offset' | 'client' | 'page' | 'layer' | 'screen'

  // ═══════════ RENDERING CALLBACKS ═══════════
  onCreated={(state) => {
    // Called when Canvas is created
    // Access: state.gl, state.scene, state.camera, etc.
  }}
  onPointerMissed={(event) => {
    // Called when clicking outside objects
  }}

  // ═══════════ SHADOWS ═══════════
  shadows={false} // boolean | 'basic' | 'percentage' | 'soft' | 'variance'

  // ═══════════ XR (VR/AR) ═══════════
  xr={false} // Enable XR mode

  // ═══════════ ROOT STATE ═══════════
  mode="concurrent" // 'legacy' | 'blocking' | 'concurrent'

  // ═══════════ TONE MAPPING ═══════════
  // Set via gl.toneMapping (see above)
  // THREE.NoToneMapping
  // THREE.LinearToneMapping
  // THREE.ReinhardToneMapping
  // THREE.CineonToneMapping
  // THREE.ACESFilmicToneMapping (default)
>
</Canvas> -->