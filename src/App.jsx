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

  const [showTitleScreen, setShowTitleScreen] = useState(true);
  const [isTitleExiting, setIsTitleExiting] = useState(false);
  const [showTimeoutScreen, setShowTimeoutScreen] = useState(false);
  const [isSceneFullyReady, setIsSceneFullyReady] = useState(false);
  const [rippleConfig, setRippleConfig] = useState(null);
  const [isInfoCardOpen, setIsInfoCardOpen] = useState(true);
  const [isAnnotationOpen, setIsAnnotationOpen] = useState(false);
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);

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
      const delay = isVOModeActive ? 30000 : 15000;

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
      Promise.all(modelPromises).then(() => {
        controls.update();
        modelsLoadedRef.current = true;
      });
    } else {
      modelLoader
        .loadFallbackCube(
          propFallbackModelUrl || defaultCubeUrl,
          camera,
          controls,
          scene
        )
        .then(() => (modelsLoadedRef.current = true));
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
        inert={isBlocked ? "" : undefined}
        aria-hidden={isBlocked}
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
          annotationsData={annotations}
          annotationManagerRef={annotationManagerRef}
          scene={scene}
          isOpen={isBuilderOpen}
          setIsOpen={setIsBuilderOpen}
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
