import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import './App.css';
import aicLogo from '../public/aic-favicon.svg';
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
  info_card_data: propInfoData,
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
  const modelsLoadedRef = useRef(false);

  const [showTitleScreen, setShowTitleScreen] = useState(true);
  const [isSceneFullyReady, setIsSceneFullyReady] = useState(false);
  const safetyTimeoutRef = useRef(null);
  const [rippleConfig, setRippleConfig] = useState(null);

  useEffect(() => {
    if (!isSceneFullyReady) {
      safetyTimeoutRef.current = setTimeout(() => {
        setIsSceneFullyReady(true);
      }, 3000);
    }

    return () => {
      if (safetyTimeoutRef.current) {
        clearTimeout(safetyTimeoutRef.current);
      }
    };
  }, [isSceneFullyReady]);

  const { models, lights, annotations, settings, title_data, info_card_data, isLoading } = useExplorerData(
    propModels,
    propLights,
    propAnnotations,
    propSettings,
    propTitleData,
    propInfoData,
  );

  const { scene, renderer, sceneReady } = useScene(containerRef, settings, lights);
  const { camera, controls, controlsReady } = useControls(containerRef, renderer, settings, models);

  useEffect(() => {
    if (renderer && renderer.domElement && containerRef.current) {
      const canvas = renderer.domElement;
      const container = containerRef.current;

      if (!container.contains(canvas)) {
        container.appendChild(canvas);
      }

      canvas.style.position = 'absolute';
      canvas.style.top = '0';
      canvas.style.left = '0';
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.zIndex = '1';
      canvas.style.display = 'block';
    }
  }, [renderer]);

  useEffect(() => {
    if (isLoading || !sceneReady || !controlsReady || modelsLoadedRef.current) {
      return;
    }

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
      }

      scene.add(sceneContainer);
      sceneContainerRef.current = sceneContainer;
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

    setIsSceneFullyReady(true);

    const modelPromises = [];

    if (models.length > 0) {
      models.forEach((modelData) => {
        const promise = modelLoader.loadModel(modelData, annotationManager);
        if (promise && typeof promise.then === 'function') {
          modelPromises.push(promise);
        }
      });

      if (modelPromises.length > 0) {
        Promise.all(modelPromises).then((results) => {

          const allModels2D = results.every(r => r && r.is2D);
          const hasAny2D = results.some(r => r && r.is2D);


          if (allModels2D) {

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
          }

          const maxDimensions = results
            .filter(r => r && r.maxDim)
            .map(r => r.maxDim);

          if (maxDimensions.length > 0) {
            const largestDim = Math.max(...maxDimensions);
            controls.minDistance = largestDim * 0.6;
            controls.maxDistance = largestDim * 2;
          }

          controls.update();
          modelsLoadedRef.current = true;
        }).catch((error) => {
          console.error('❌ Some models failed to load:', error);
        });
      }
    } else {
      const fallbackUrl = propFallbackModelUrl || defaultCubeUrl;

      modelLoader.loadFallbackCube(fallbackUrl, camera, controls, scene)
        .then(() => {
          console.log('🎉 Fallback cube loaded!');
          modelsLoadedRef.current = true;
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

    return () => {
      if (annotationManagerRef.current) {
        annotationManagerRef.current.dispose();
      }
    };
  }, [isLoading, sceneReady, controlsReady, scene, camera, controls, renderer, models, annotations, propFallbackModelUrl, settings]);

  useEffect(() => {
    if (!sceneReady || !controlsReady || !renderer || !scene || !camera || !controls) {
      return;
    }

    function animate() {
      animationIdRef.current = requestAnimationFrame(animate);
      controls.update();

      if (!showTitleScreen && annotationManagerRef.current) {
        annotationManagerRef.current.updateBillboards();
      }

      renderer.render(scene, camera);
    }

    animate();

    return () => {
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
    };
  }, [sceneReady, controlsReady, renderer, scene, camera, controls, showTitleScreen]);

  useEffect(() => {
    const handleReset = () => {
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
    };

    window.addEventListener('resetDigitalExplorer', handleReset);

    return () => {
      window.removeEventListener('resetDigitalExplorer', handleReset);
    };
  }, [camera, controls]);

  const handleExploreClick = () => {
    setShowTitleScreen(false);

    if (renderer && scene && camera) {
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
        <img style={{width: '5vw', height: 'auto'}} src={aicLogo}/>
      </div>
    );
  }

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