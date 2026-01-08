import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import './App.css';
import defaultCubeUrl from './aic-test-cube.glb';
import { useExplorerData } from './lib/hooks/useExplorerData';
import { useScene } from './lib/hooks/useScene';
import { useControls } from './lib/hooks/useControls';
import { AnnotationManager } from './components/AnnotationManager';
import { ModelLoader } from './components/ModelLoader';
import TitleScreen from './components/TitleScreen';
import DebugOverlay from './components/DebugOverlay';

export default function App({
  models: propModels,
  lights: propLights,
  annotations: propAnnotations,
  settings: propSettings,
  title_data: propTitleData,
  fallbackModelUrl: propFallbackModelUrl,
  type: propType,
  title: propTitle,
  slug: propSlug
}) {
  const containerRef = useRef(null);
  const annotationManagerRef = useRef(null);
  const modelLoaderRef = useRef(null);
  const animationIdRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const initialCameraPosition = useRef(null);
  const initialControlsTarget = useRef(null);
  const sceneContainerRef = useRef(null);

  const [showTitleScreen, setShowTitleScreen] = useState(true);
  const [isSceneFullyReady, setIsSceneFullyReady] = useState(false);
  const safetyTimeoutRef = useRef(null);
  const [rippleConfig, setRippleConfig] = useState(null);

  useEffect(() => {
    if (!isSceneFullyReady) {
      safetyTimeoutRef.current = setTimeout(() => {
        console.log('⏰ Safety timeout reached - forcing scene ready');
        setIsSceneFullyReady(true);
      }, 3000);
    }

    return () => {
      if (safetyTimeoutRef.current) {
        clearTimeout(safetyTimeoutRef.current);
      }
    };
  }, [isSceneFullyReady]);

  const { models, lights, annotations, settings, title_data, isLoading } = useExplorerData(
    propModels,
    propLights,
    propAnnotations,
    propSettings,
    propTitleData
  );

  const { scene, renderer, sceneReady } = useScene(containerRef, settings, lights);
  const { camera, controls, controlsReady } = useControls(containerRef, renderer, settings, models);

  useEffect(() => {
    if (renderer && renderer.domElement && containerRef.current) {
      const canvas = renderer.domElement;
      const container = containerRef.current;

      if (!container.contains(canvas)) {
        console.log('⚠️ Canvas not in container, appending it now');
        container.appendChild(canvas);
      }

      canvas.style.position = 'absolute';
      canvas.style.top = '0';
      canvas.style.left = '0';
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.zIndex = '1';
      canvas.style.display = 'block';

      console.log('🎨 Canvas styling applied:', {
        position: canvas.style.position,
        zIndex: canvas.style.zIndex,
        display: canvas.style.display,
        inContainer: container.contains(canvas)
      });
    }
  }, [renderer]);

  useEffect(() => {
    if (isLoading || !sceneReady || !controlsReady) {
      console.log('⏳ Waiting for initialization:', {
        isLoading,
        sceneReady,
        controlsReady
      });
      return;
    }

    console.log('🎨 Initializing Three.js scene...');
    console.log('📊 Models count:', models.length);

    if (!sceneContainerRef.current && scene) {
      const sceneContainer = new THREE.Group();
      sceneContainer.name = 'SceneContainer';

      if (settings.sceneTransform) {
        const pos = settings.sceneTransform.position || [0, 0, 0];
        const rot = settings.sceneTransform.rotation || [0, 0, 0];
        const scl = settings.sceneTransform.scale || [1, 1, 1];

        sceneContainer.position.set(pos[0], pos[1], pos[2]);
        sceneContainer.rotation.set(rot[0], rot[1], rot[2]);
        sceneContainer.scale.set(scl[0], scl[1], scl[2]);

        console.log('🎬 Scene container transforms applied:', { pos, rot, scl });
      }

      scene.add(sceneContainer);
      sceneContainerRef.current = sceneContainer;
      console.log('✅ Scene container created');
    }

    cameraRef.current = camera;
    controlsRef.current = controls;

    if (!initialCameraPosition.current) {
      initialCameraPosition.current = camera.position.clone();
      initialControlsTarget.current = controls.target.clone();
    }

    const annotationManager = new AnnotationManager(scene, camera, renderer.domElement);
    annotationManager.setControls(controls)
    annotationManagerRef.current = annotationManager;

    const modelLoader = new ModelLoader(scene, sceneContainerRef.current);
    modelLoaderRef.current = modelLoader;

    console.log('🎬 Scene initialized, marking as ready for exploration');
    setIsSceneFullyReady(true);

    const modelPromises = [];

    if (models.length > 0) {
      console.log(`📦 Loading ${models.length} model(s) in background...`);
      models.forEach((modelData) => {
        const promise = modelLoader.loadModel(modelData, annotationManager);
        if (promise && typeof promise.then === 'function') {
          modelPromises.push(promise);
        }
      });

      if (modelPromises.length > 0) {
        Promise.all(modelPromises).then((results) => {
          console.log('✅ All models loaded successfully');
          console.log('📊 Results:', results);

          const allModels2D = results.every(r => r && r.is2D);
          const hasAny2D = results.some(r => r && r.is2D);

          console.log('🔍 2D Detection:', { allModels2D, hasAny2D, results });

          if (allModels2D) {
            console.log('🖼️ All models are 2D - configuring 2D controls');
            console.log('🎮 Before:', {
              enableRotate: controls.enableRotate,
              mouseButtons: controls.mouseButtons,
              touches: controls.touches
            });

            controls.enableRotate = false;
            controls.enablePan = true;
            controls.enableZoom = true;

            controls.mouseButtons = {
              LEFT: THREE.MOUSE.PAN,
              MIDDLE: THREE.MOUSE.DOLLY,
              RIGHT: THREE.MOUSE.PAN
            };

            controls.touches = {
              ONE: THREE.TOUCH.PAN,
              TWO: THREE.TOUCH.DOLLY_PAN
            };

            console.log('🎮 After:', {
              enableRotate: controls.enableRotate,
              mouseButtons: controls.mouseButtons,
              touches: controls.touches
            });
          } else if (hasAny2D) {
            console.log('🎨 Mixed 2D/3D content - allowing all controls');
          }

          const maxDimensions = results
            .filter(r => r && r.maxDim)
            .map(r => r.maxDim);

          if (maxDimensions.length > 0) {
            const largestDim = Math.max(...maxDimensions);
            controls.minDistance = largestDim * 0.6;
            controls.maxDistance = largestDim * 10;
            console.log('🎮 Controls distances set:', {
              minDistance: controls.minDistance,
              maxDistance: controls.maxDistance
            });
          }

          controls.update();
        }).catch((error) => {
          console.error('❌ Some models failed to load:', error);
        });
      }
    } else {
      const fallbackUrl = propFallbackModelUrl || defaultCubeUrl;
      console.log('📦 No models provided, loading fallback cube from:', fallbackUrl);

      modelLoader.loadFallbackCube(fallbackUrl, camera, controls, scene)
        .then(() => {
          console.log('🎉 Fallback cube loaded!');
        })
        .catch((error) => {
          console.error('❌ Fallback cube failed to load:', error);
        });
    }

    if (annotations.length > 0) {
      annotations.forEach(annotation => {
        annotationManager.addAnnotation(annotation);
      });
    }

    function animate() {
      animationIdRef.current = requestAnimationFrame(animate);
      controls.update();

      if (!showTitleScreen) {
        annotationManager.updateBillboards();
      }

      renderer.render(scene, camera);
    }
    animate();

    const handleReset = () => {
      console.log('🔄 Resetting explorer to initial state...');

      if (initialCameraPosition.current) {
        camera.position.copy(initialCameraPosition.current);
      }

      if (initialControlsTarget.current) {
        controls.target.copy(initialControlsTarget.current);
      }

      controls.update();

      if (annotationManagerRef.current) {
        annotationManagerRef.current.reset();
      }

      setShowTitleScreen(true);

      console.log('✅ Explorer reset complete - title screen shown');
    };

    window.addEventListener('resetDigitalExplorer', handleReset);

    return () => {
      window.removeEventListener('resetDigitalExplorer', handleReset);
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
      if (annotationManagerRef.current) {
        annotationManagerRef.current.dispose();
      }
    };
  }, [isLoading, sceneReady, controlsReady, scene, camera, controls, renderer, models, annotations, propFallbackModelUrl, showTitleScreen]);

  const handleExploreClick = () => {
    console.log('🚀 User clicked explore - dismissing title screen');
    setShowTitleScreen(false);

    if (renderer && scene && camera) {
      console.log('🎬 Forcing initial render after title screen dismissal');
      renderer.render(scene, camera);
    }
  };

  if (isLoading) {
    return (
      <div style={{
        width: '100%',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#1a1a1a',
        color: 'white',
        fontFamily: '"Helvetica Neue", Arial, sans-serif'
      }}>
        <p>Loading explorer...</p>
      </div>
    );
  }

  console.log(settings);

  return (
    <div
      ref={containerRef}
      id="canvas-container"
      style={{
        width: '100%',
        height: '100vh',
        position: 'relative',
        backgroundColor: '#1a1a1a'
      }}
    >
      {showTitleScreen && (
        <TitleScreen
          titleData={title_data}
          onExplore={handleExploreClick}
          isSceneReady={isSceneFullyReady}
          rippleConfig={rippleConfig}
        />
      )}

      {settings?.debug && (
        <DebugOverlay
          scene={scene}
          renderer={renderer}
          camera={camera}
          controls={controls}
          showTitleScreen={showTitleScreen}
          isSceneReady={isSceneReady}
          models={models}
          annotationManager={annotationManagerRef.current}
          sceneContainer={sceneContainerRef.current}
          onRippleConfigChange={setRippleConfig}
        />
      )}
    </div>
  );
}