import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import "./App.css";
import aicLogo from "../public/aic-favicon.svg";
import defaultCubeUrl from "./assets/aic-test-cube.glb";
import { useExplorerData } from "./lib/hooks/useExplorerData";
import { useScene } from "./lib/hooks/useScene";
import { useControls } from "./lib/hooks/useControls";
import { AnnotationManager } from "./components/AnnotationManager";
import { ModelLoader } from "./components/ModelLoader";
import InfoCard from "./components/InfoCard";
import TitleScreen from "./components/TitleScreen";
import TimeoutScreen from "./components/TimeoutScreen";
import DebugOverlay from "./components/DebugOverlay";
import BrailleGestureButton from "./components/BrailleGestureButton";
import BuilderPanel from "./components/BuilderPanel";
import sendGAEvent from "./lib/utils/sendGAEvent";

let globalUtterance = null;
let persistentUtterance = null;

export default function App({
  models: propModels,
  lights: propLights,
  annotations: propAnnotations,
  settings: propSettings,
  title_data: propTitleData,
  info_card_data: propInfoData,
  fallbackModelUrl: propFallbackModelUrl,
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
  const inactivityTimerRef = useRef(null);

  const poiCenterRef = useRef(null);
  const maxPanDistRef = useRef(null);
  const defaultPanDistRef = useRef(null);
  const zoomLimitsRef = useRef(null);
  const defaultZoomLimitsRef = useRef({ min: 0, max: Infinity });
  const isCustomBoundsEnabledRef = useRef(false);
  const customBoundsOffsetRef = useRef([0, 0, 0]);
  const deactivateForcefieldRef = useRef(false);
  const isBuilderOpenRef = useRef(false);

  const [showTitleScreen, setShowTitleScreen] = useState(true);
  const [isTitleExiting, setIsTitleExiting] = useState(false);
  const [showTimeoutScreen, setShowTimeoutScreen] = useState(false);
  const [isSceneFullyReady, setIsSceneFullyReady] = useState(false);
  const [rippleConfig, setRippleConfig] = useState(null);
  const [isInfoCardOpen, setIsInfoCardOpen] = useState(true);
  const [isAnnotationOpen, setIsAnnotationOpen] = useState(false);
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);

  useEffect(() => {
     isBuilderOpenRef.current = isBuilderOpen;
  }, [isBuilderOpen]);

  // Voice State
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [voices, setVoices] = useState([]);

  const safetyTimeoutRef = useRef(null);

  // New State for Voice Over Mode
  const [isVOModeActive, setIsVOModeActive] = useState(false);

  const isBlocked = showTitleScreen || showTimeoutScreen;

  // --- Voice Selection Logic ---
  const findBestVoice = useCallback((availableVoices) => {
    const noveltyVoices = [
      "Zarvox",
      "Cellos",
      "Good News",
      "Pipe Organ",
      "Bells",
      "Boing",
      "Bubbles",
    ];

    const usableVoices = availableVoices.filter(
      (v) =>
        !noveltyVoices.some((novelty) => v.name.includes(novelty)) &&
        (v.lang.startsWith("en") || v.default)
    );

    const preferredNames = [
      "Samantha",
      "Nicky",
      "Daniel",
      "Alex",
      "Google US English",
    ];

    const found = preferredNames.reduce((acc, name) => {
      return acc || usableVoices.find((v) => v.name.includes(name));
    }, null);

    return found || usableVoices[0] || availableVoices[0];
  }, []);

  // --- Physical Braille Gesture Logic ---

  const toggleVO = useCallback(
    (forceState) => {
      const nextState = forceState !== undefined ? forceState : !isVOModeActive;
      setIsVOModeActive(nextState);

      const synth = window.speechSynthesis;
      synth.cancel();

      const text = nextState
        ? "Voice Over On. Single tap for info, Double tap for next slide, Triple tap to exit Voice Over Mode"
        : "Voice Over Off";

      persistentUtterance = new SpeechSynthesisUtterance(text);

      const availableVoices = synth.getVoices();
      const bestVoice = selectedVoice || findBestVoice(availableVoices);

      if (bestVoice) {
        persistentUtterance.voice = bestVoice;
      }

      persistentUtterance.pitch = 1;
      persistentUtterance.rate = 1.1;

      synth.speak(persistentUtterance);
    },
    [isVOModeActive, selectedVoice, findBestVoice]
  );

  const handleTactileAction = {
    tap: () => {
      if (isVOModeActive) {
        setIsInfoCardOpen((prev) => !prev);
      }
    },
    doubleTap: () => {
      if (!isVOModeActive) return;
      if (showTitleScreen) setShowTitleScreen(false);

      const annots = annotationManagerRef.current?.annotations;
      if (annots?.length) {
        const currentIndex = annots.findIndex((a) => a.isActive);
        const nextIndex = (currentIndex + 1) % annots.length;
        annotationManagerRef.current.toggleAnnotation(annots[nextIndex], true);
      }
    },
    tripleTap: () => {
      toggleVO(!isVOModeActive);
    },
    longPress: () => {
      handleReset();
    },
  };

  const handleReset = useCallback(() => {
    sendGAEvent({
      eventCategory: 'Explorer',
      eventAction: 'end session',
      eventLabel: 'Session Ended'
    });

    if (initialCameraPosition.current && cameraRef.current) {
      cameraRef.current.position.copy(initialCameraPosition.current);
    }
    if (initialControlsTarget.current && controlsRef.current) {
      controlsRef.current.target.copy(initialControlsTarget.current);
      controlsRef.current.update();
    }
    if (annotationManagerRef.current) {
      annotationManagerRef.current.reset();
      annotationManagerRef.current.updateBillboards();
    }
    setShowTitleScreen(true);
    setShowTimeoutScreen(false);
    setIsInfoCardOpen(true);
    setIsAnnotationOpen(false);
    setIsVOModeActive(false);
    containerRef.current?.focus();
  }, []);

  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);

    if (!showTitleScreen && !showTimeoutScreen) {
      const delay = isVOModeActive ? 30000 : 30000;

      inactivityTimerRef.current = setTimeout(() => {
        setShowTimeoutScreen(true);
      }, delay);
    }
  }, [showTitleScreen, showTimeoutScreen, isVOModeActive]);

  const handleResume = () => {
    setShowTimeoutScreen(false);
    resetInactivityTimer();
  };

  const handleExploreClick = () => {
    setIsTitleExiting(true);
    if (renderer && scene && camera) renderer.render(scene, camera);

    sendGAEvent({
      eventCategory: 'Explorer',
      eventAction: 'start session',
      eventLabel: title_data?.title || 'Unknown Title'
    });

    setTimeout(() => {
      setShowTitleScreen(false);
      setIsTitleExiting(false);
      containerRef.current?.focus();
    }, 800);
  };

  // --- Voice Loading Effect ---
  useEffect(() => {
    const synth = window.speechSynthesis;

    const loadVoices = () => {
      const availableVoices = synth.getVoices();
      if (availableVoices.length > 0) {
        setVoices(availableVoices);
        const bestVoice = findBestVoice(availableVoices);
        setSelectedVoice((current) =>
          current?.name.includes("Samantha") ? current : bestVoice
        );
      }
    };

    loadVoices();
    if (synth.onvoiceschanged !== undefined) {
      synth.onvoiceschanged = loadVoices;
    }

    const timer = setTimeout(loadVoices, 500);
    return () => clearTimeout(timer);
  }, [findBestVoice]);

  useEffect(() => {
    if (annotationManagerRef.current) {
      annotationManagerRef.current.setVOMode(isVOModeActive);
    }
  }, [isVOModeActive]);

  useEffect(() => {
    if (settings?.builderEnabled) return;

    const activityEvents = [
      "pointermove",
      "pointerdown",
      "keydown",
      "touchstart",
      "wheel",
      "scroll",
      "click",
    ];
    const handleActivity = () => resetInactivityTimer();
    activityEvents.forEach((e) => {
      const options =
        e === "wheel" || e === "scroll" ? { passive: true } : false;
      window.addEventListener(e, handleActivity, options);
    });
    return () => {
      activityEvents.forEach((e) =>
        window.removeEventListener(e, handleActivity)
      );
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    };
  }, [resetInactivityTimer]);

  useEffect(() => {
    if (!isSceneFullyReady) {
      safetyTimeoutRef.current = setTimeout(
        () => setIsSceneFullyReady(true),
        3000
      );
    }
    return () => {
      if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current);
    };
  }, [isSceneFullyReady]);

  const {
    models,
    lights,
    annotations,
    settings,
    title_data,
    info_card_data,
    isLoading,
  } = useExplorerData(
    propModels,
    propLights,
    propAnnotations,
    propSettings,
    propTitleData,
    propInfoData
  );

  const { scene, renderer, sceneReady } = useScene(
    containerRef,
    settings,
    lights
  );
  const { camera, controls, controlsReady } = useControls(
    containerRef,
    renderer,
    settings,
    models
  );

  useEffect(() => {
    if (renderer && renderer.domElement && containerRef.current) {
      const canvas = renderer.domElement;
      if (!containerRef.current.contains(canvas))
        containerRef.current.appendChild(canvas);
      canvas.setAttribute("role", "img");
      canvas.setAttribute("aria-label", "3D Interactive Model Viewer");

      Object.assign(canvas.style, {
        position: "absolute",
        top: "0",
        left: "0",
        width: "100%",
        height: "100%",
        zIndex: "10",
        display: "block",
        transition: "opacity 0.4s ease-in-out",
        opacity: isAnnotationOpen ? "0.4" : "1",
      });
    }
  }, [renderer, isAnnotationOpen]);

  useEffect(() => {
    if (isLoading || !sceneReady || !controlsReady || modelsLoadedRef.current)
      return;

    if (!sceneContainerRef.current && scene) {
      const sceneContainer = new THREE.Group();
      sceneContainer.name = "SceneContainer";
      scene.add(sceneContainer);
      sceneContainerRef.current = sceneContainer;
    }

    cameraRef.current = camera;
    controlsRef.current = controls;

    if (!initialCameraPosition.current) {
      initialCameraPosition.current = camera.position.clone();
      initialControlsTarget.current = controls.target.clone();
    }

    const annotationManager = new AnnotationManager(
      scene,
      camera,
      renderer.domElement,
      containerRef.current
    );

    if (selectedVoice) {
      annotationManager.setVoice(selectedVoice);
    }

    annotationManager.onAnnotationToggle = (isOpen) => {
      setIsAnnotationOpen(isOpen);
      if (isOpen) setIsInfoCardOpen(false);
    };
    annotationManager.setControls(controls);
    annotationManagerRef.current = annotationManager;

    const modelLoader = new ModelLoader(scene, sceneContainerRef.current);
    modelLoaderRef.current = modelLoader;
    setIsSceneFullyReady(true);

    if (models.length > 0) {
      const modelPromises = models.map((m) =>
        modelLoader.loadModel(m, annotationManager)
      );
      Promise.all(modelPromises).then((loadedModels) => {
        const firstModelInfo = loadedModels[0];
        if (firstModelInfo && firstModelInfo.model) {
            const { model, maxDim, minDistance, is2D, width, height, depth } = firstModelInfo;
            const box = new THREE.Box3().setFromObject(model);
            const targetVec = new THREE.Vector3(0, 0, 0);
            if (settings?.orbitControls?.target) {
                targetVec.fromArray(settings.orbitControls.target);
            }
            poiCenterRef.current = targetVec;

            const size = box.getSize(new THREE.Vector3());

            // A 3D asset mapped strictly onto a singular plane (e.g. YZ) will yield microscopic floats
            // for its raw empty axis. We mathematically clamp to maxDim to prevent flat walls freezing X/Y focal pans.
            const safeX = is2D ? 0 : (size.z > 0.05 ? size.z : maxDim);
            const safeY = is2D ? (height > 0.05 ? height : maxDim) : (size.y > 0.05 ? size.y : maxDim);
            const safeZ = is2D ? (width > 0.05 ? width : maxDim) : (size.x > 0.05 ? size.x : maxDim);

            // Dynamically scale bounding constraints tightly to the physical aspect ratio of the object
            const defaultBounds = [
                safeX / 2,
                safeY / 2,
                safeZ / 2
            ];
            defaultPanDistRef.current = defaultBounds;

            // Snapshot physical zoom constraints before altering dynamically
            if (!defaultZoomLimitsRef.current) {
                defaultZoomLimitsRef.current = {
                    min: controls.minDistance,
                    max: maxDim
                };
            }
        }

        controls.update();
        modelsLoadedRef.current = true;
        setModelsLoaded(true);
      });
    } else {
      modelLoader
        .loadFallbackCube(
          propFallbackModelUrl || defaultCubeUrl,
          camera,
          controls,
          scene
        )
        .then(() => {
            modelsLoadedRef.current = true;
            setModelsLoaded(true);
        });
    }

    annotations.forEach((a) => annotationManager.addAnnotation(a));
    return () => annotationManagerRef.current?.dispose();
  }, [
    isLoading,
    sceneReady,
    controlsReady,
    scene,
    camera,
    controls,
    renderer,
    models,
    annotations,
    propFallbackModelUrl,
  ]);

  useEffect(() => {
    if (!defaultPanDistRef.current || !controls) return;

    const getVal = (val, def) => (val !== undefined && val !== "" && !isNaN(parseFloat(val))) ? parseFloat(val) : def;

    isCustomBoundsEnabledRef.current = !!settings?.enableCustomBounds;

    if (settings?.enableCustomBounds && settings?.customBounds) {
        maxPanDistRef.current = [
            getVal(settings.customBounds[0], defaultPanDistRef.current[0] * 2) / 2,
            getVal(settings.customBounds[1], defaultPanDistRef.current[1] * 2) / 2,
            getVal(settings.customBounds[2], defaultPanDistRef.current[2] * 2) / 2
        ];
    } else {
        maxPanDistRef.current = defaultPanDistRef.current;
    }

    if (settings?.enableCustomBounds && settings?.customBoundsOffset) {
        customBoundsOffsetRef.current = [
            getVal(settings.customBoundsOffset[0], 0),
            getVal(settings.customBoundsOffset[1], 0),
            getVal(settings.customBoundsOffset[2], 0)
        ];
    } else {
        customBoundsOffsetRef.current = [0, 0, 0];
    }

    if (settings?.enableCustomBounds && settings?.zoomLimits) {
        zoomLimitsRef.current = {
            min: getVal(settings.zoomLimits[0], 0),
            max: getVal(settings.zoomLimits[1], Infinity)
        };
    } else {
        zoomLimitsRef.current = null;
    }

  }, [settings, controls, modelsLoaded]);

  useEffect(() => {
    if (annotationManagerRef.current && selectedVoice) {
      annotationManagerRef.current.setVoice(selectedVoice);
    }
  }, [selectedVoice]);

  useEffect(() => {
    if (
      !sceneReady ||
      !controlsReady ||
      !renderer ||
      !scene ||
      !camera ||
      !controls
    )
      return;
    function animate() {
      animationIdRef.current = requestAnimationFrame(animate);

      if (poiCenterRef.current && controls.target && maxPanDistRef.current) {
          // Determine if Custom Bounds dictates removing the native boundaries entirely
          const isAnyAnnotationActive = annotationManagerRef.current?.annotations?.some(a => a.isActive);
          const builderDeactivated = isBuilderOpenRef.current && isCustomBoundsEnabledRef.current && deactivateForcefieldRef.current;
          const boundsEnforced = !builderDeactivated && !isAnyAnnotationActive;

          if (isCustomBoundsEnabledRef.current && !boundsEnforced) {
              controls.minDistance = 0;
              controls.maxDistance = Infinity;
          } else if (boundsEnforced && isCustomBoundsEnabledRef.current && isBuilderOpenRef.current) {
              controls.minDistance = zoomLimitsRef.current ? zoomLimitsRef.current.min : defaultZoomLimitsRef.current.min;
              controls.maxDistance = zoomLimitsRef.current && zoomLimitsRef.current.max > 0 ? zoomLimitsRef.current.max : defaultZoomLimitsRef.current.max;
          } else if (isCustomBoundsEnabledRef.current && !isBuilderOpenRef.current) {
             controls.minDistance = zoomLimitsRef.current ? zoomLimitsRef.current.min : defaultZoomLimitsRef.current.min;
             controls.maxDistance = zoomLimitsRef.current && zoomLimitsRef.current.max > 0 ? zoomLimitsRef.current.max : defaultZoomLimitsRef.current.max;

             // If Zoom Limits were explicitly not set, fall back to Infinite exclusively
             // in published mode following earlier parity if max equals the default uninitialized max
             if (!zoomLimitsRef.current) {
                 controls.minDistance = 0;
                 controls.maxDistance = Infinity;
             }
          }

          if (boundsEnforced) {
              const limits = maxPanDistRef.current; // [x, y, z]

              const poi = poiCenterRef.current.clone().add(
                  new THREE.Vector3(
                      customBoundsOffsetRef.current[0],
                      customBoundsOffsetRef.current[1],
                      customBoundsOffsetRef.current[2]
                  )
              );

              let clamped = false;
              const clampTarget = controls.target.clone();

              // Calculate dynamic frustum dimensions at target plane to ensure screen edges don't overflow the box
              const dist = camera.position.distanceTo(controls.target);
              const fov = camera.fov * (Math.PI / 180);
              const halfHeight = Math.tan(fov / 2) * dist;
              const halfWidth = halfHeight * camera.aspect;

              // Project the camera's true screen axes into World Space to ensure padding corresponds to viewing angle
              const cameraX = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
              const cameraY = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);

              const padX = Math.abs(cameraX.x * halfWidth) + Math.abs(cameraY.x * halfHeight);
              const padY = Math.abs(cameraX.y * halfWidth) + Math.abs(cameraY.y * halfHeight);
              const padZ = Math.abs(cameraX.z * halfWidth) + Math.abs(cameraY.z * halfHeight);

              // Subtract the exact visible frustum padding from the boundary limits so the
              // screen edge stops precisely on the wireframe instead of bleeding past it
              const allowedX = Math.max(0, limits[0] - padX);
              const allowedY = Math.max(0, limits[1] - padY);
              const allowedZ = Math.max(0, limits[2] - padZ);

              if (Math.abs(clampTarget.x - poi.x) > allowedX) {
                  clampTarget.x = poi.x + Math.sign(clampTarget.x - poi.x) * allowedX;
                  clamped = true;
              }
              if (Math.abs(clampTarget.y - poi.y) > allowedY) {
                  clampTarget.y = poi.y + Math.sign(clampTarget.y - poi.y) * allowedY;
                  clamped = true;
              }
              if (Math.abs(clampTarget.z - poi.z) > allowedZ) {
                  clampTarget.z = poi.z + Math.sign(clampTarget.z - poi.z) * allowedZ;
                  clamped = true;
              }

              if (clamped) {
                  const delta = new THREE.Vector3().subVectors(clampTarget, controls.target);
                  controls.target.copy(clampTarget);
                  camera.position.add(delta);
              }
          }
      }

      controls.update();

      if (
        (!showTitleScreen || isTitleExiting) &&
        !showTimeoutScreen &&
        annotationManagerRef.current
      ) {
        annotationManagerRef.current.updateBillboards();
      }

      renderer.render(scene, camera);
    }
    animate();
    return () => cancelAnimationFrame(animationIdRef.current);
  }, [
    sceneReady,
    controlsReady,
    renderer,
    scene,
    camera,
    controls,
    showTitleScreen,
    isTitleExiting,
    showTimeoutScreen,
  ]);

  if (isLoading) {
    return (
      <div
        role="status"
        aria-live="polite"
        style={{
          width: "100%",
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#1a1a1a",
        }}
      >
        <img
          style={{ width: "5vw", height: "auto" }}
          src={aicLogo}
          alt="Loading..."
        />
      </div>
    );
  }

  return (
    <div
      id="app-root"
      style={{
        width: "100%",
        height: "100vh",
        position: "relative",
        backgroundColor: "#1a1a1a",
        overflow: "hidden",
      }}
    >
      {settings?.brailleButton && (
        <BrailleGestureButton
          isVOActive={isVOModeActive}
          onSingleTap={handleTactileAction.tap}
          onDoubleTap={handleTactileAction.doubleTap}
          onTripleTap={handleTactileAction.tripleTap}
          onLongPress={handleTactileAction.longPress}
        />
      )}

      {isVOModeActive && (
        <div
          style={{
            position: "absolute",
            top: "30px",
            right: "30px",
            backgroundColor: "#151515",
            color: "#f6f6f6",
            padding: "12px 24px",
            borderRadius: "40px",
            fontFamily: '"Ideal Sans A", "Helvetica Neue", Arial, sans-serif',
            fontWeight: "700",
            zIndex: 70,
            display: "flex",
            alignItems: "center",
            gap: "15px",
            boxShadow: "0 4px 20px rgba(255, 255, 255, 0.12)",
          }}
        >
          <span
            style={{
              width: "10px",
              height: "10px",
              backgroundColor: "#fff",
              borderRadius: "50%",
              animation: "pulse 1.5s infinite",
            }}
          />
          VOICE OVER ON
          <button
            onClick={() => toggleVO(false)}
            style={{
              background: "#4B9CA3",
              color: "#fff",
              border: "none",
              borderRadius: "20px",
              padding: "5px 15px",
              cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>
      )}

      {showTitleScreen && !isVOModeActive && (
        <TitleScreen
          titleData={title_data}
          onExplore={handleExploreClick}
          isSceneReady={isSceneFullyReady}
          rippleConfig={rippleConfig}
        />
      )}

      {showTimeoutScreen && (
        <div
          role="alert"
          aria-live="assertive"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            zIndex: 90,
          }}
        >
          <TimeoutScreen onResume={handleResume} onReset={handleReset} />
        </div>
      )}

      <main
        ref={containerRef}
        inert={isBlocked ? true : undefined}
        style={{
          width: "100%",
          height: "100%",
          position: "absolute",
          top: 0,
          left: 0,
          transform:
            showTitleScreen && !isTitleExiting ? "scale(0.92)" : "scale(1)",
          opacity: showTitleScreen && !isTitleExiting ? 0.4 : 1,
          transition:
            "transform 0.8s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        {!isAnnotationOpen && (
          <InfoCard
            infoCardData={info_card_data}
            isToggled={isInfoCardOpen}
            setIsToggled={setIsInfoCardOpen}
            isVOModeActive={isVOModeActive}
            selectedVoice={selectedVoice}
          />
        )}

        {settings?.debug && (
          <DebugOverlay
            scene={scene}
            renderer={renderer}
            camera={camera}
            controls={controls}
            showTitleScreen={showTitleScreen}
            isSceneReady={isSceneFullyReady}
            onRippleConfigChange={setRippleConfig}
          />
        )}
      </main>

      {settings?.builderEnabled && (
        <BuilderPanel
          modelsData={models}
          lightsData={lights}
          annotationsData={annotations}
          settingsData={settings}
          annotationManagerRef={annotationManagerRef}
          poiCenterRef={poiCenterRef}
          isSceneReady={isSceneFullyReady}
          maxPanDistRef={maxPanDistRef}
          defaultPanDistRef={defaultPanDistRef}
          defaultZoomLimitsRef={defaultZoomLimitsRef}
          zoomLimitsRef={zoomLimitsRef}
          isCustomBoundsEnabledRef={isCustomBoundsEnabledRef}
          customBoundsOffsetRef={customBoundsOffsetRef}
          deactivateForcefieldRef={deactivateForcefieldRef}
          scene={scene}
          renderer={renderer}
          camera={camera}
          isOpen={isBuilderOpen}
          setIsOpen={setIsBuilderOpen}
          modelsLoaded={modelsLoaded}
        />
      )}


      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.4); opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
