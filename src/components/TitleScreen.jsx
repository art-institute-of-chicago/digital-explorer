import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import KennyBurns from "./KennyBurns";

export default function TitleScreen({
  titleData,
  onExplore,
  isSceneReady = false,
  rippleConfig = null,
}) {
  const [isVisible, setIsVisible] = useState(true);
  const [isExiting, setIsExiting] = useState(false);
  const canvasRef = useRef(null);
  const animationIdRef = useRef(null);

  const title = titleData?.title || "Digital Explorer";
  const titleDisplay = titleData?.title_display || null;
  const titleMedia = titleData?.title_media;

  // Extracted relevant configs, omitting count and spacing for the single ripple
  const RIPPLE_CYCLE_DURATION = rippleConfig?.RIPPLE_CYCLE_DURATION ?? 3;
  const RIPPLE_MAX_SCALE = rippleConfig?.RIPPLE_MAX_SCALE ?? 3.2;
  const WAVE_GROUP_DELAY = rippleConfig?.WAVE_GROUP_DELAY ?? 0;
  const RIPPLE_BASE_OPACITY = rippleConfig?.RIPPLE_BASE_OPACITY ?? 1;

  useEffect(() => {
    if (!canvasRef.current || !isVisible) return;

    const canvas = canvasRef.current;
    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });

    // Measure actual rendered size after layout (canvas CSS fills the button)
    const size = Math.round(window.innerWidth * 0.15);
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    renderer.setSize(size, size, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Re-sync after layout settles (Safari flex sizing differs from Chrome)
    const raf = requestAnimationFrame(() => {
      const actual = canvas.clientWidth || size;
      renderer.setSize(actual, actual, false);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    });

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    camera.position.z = 1;

    // --- Create a single solid circle ripple ---
    const geometry = new THREE.CircleGeometry(0.4, 64);
    const material = new THREE.MeshBasicMaterial({
      color: 0x4ecdc4,
      transparent: true,
      opacity: RIPPLE_BASE_OPACITY,
      side: THREE.DoubleSide,
    });

    const ripple = new THREE.Mesh(geometry, material);
    ripple.userData.baseOpacity = RIPPLE_BASE_OPACITY;
    ripple.renderOrder = 0; // Ensure it renders behind the button
    scene.add(ripple);

    // --- Create the main button mesh ---
    const buttonCanvas = document.createElement("canvas");
    buttonCanvas.width = size;
    buttonCanvas.height = size;
    const ctx = buttonCanvas.getContext("2d", { alpha: true });

    ctx.clearRect(0, 0, size, size);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    const half = size / 2;
    const radius = half * 0.9375; // 120/128 ratio
    ctx.fillStyle = "#4B9CA3";
    ctx.beginPath();
    ctx.arc(half, half, radius, 0, Math.PI * 2);
    ctx.fill();

    const texture = new THREE.CanvasTexture(buttonCanvas);
    texture.generateMipmaps = false;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;

    const buttonGeometry = new THREE.PlaneGeometry(0.7, 0.7);
    const buttonMaterial = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 1.0,
    });

    const buttonMesh = new THREE.Mesh(buttonGeometry, buttonMaterial);
    buttonMesh.position.set(0, 0, 0);
    buttonMesh.userData.baseScale = 2;
    buttonMesh.userData.targetScale = 2;
    buttonMesh.renderOrder = 10; // Ensure it renders on top
    scene.add(buttonMesh);

    let startTime = performance.now();

    function animate() {
      const currentTime = performance.now();
      const time = (currentTime - startTime) * 0.001;

      const effectiveCycleDuration = RIPPLE_CYCLE_DURATION + WAVE_GROUP_DELAY;
      const phase = time % effectiveCycleDuration;

      // Animate the single ripple
      if (phase < RIPPLE_CYCLE_DURATION) {
        const progress = phase / RIPPLE_CYCLE_DURATION;
        const scale = 0.7 * (1 + progress * (RIPPLE_MAX_SCALE - 1));
        ripple.scale.set(scale, scale, 1);
        ripple.material.opacity = ripple.userData.baseOpacity * (1 - progress);
        ripple.visible = true;
      } else {
        ripple.visible = false;
      }

      // Animate button hover scale
      const currentScale = buttonMesh.scale.x;
      const targetScale = buttonMesh.userData.targetScale;
      const newScale = currentScale + (targetScale - currentScale) * 0.1;
      buttonMesh.scale.set(newScale, newScale, 1);

      renderer.render(scene, camera);
      animationIdRef.current = requestAnimationFrame(animate);
    }

    animate();

    return () => {
      if (animationIdRef.current) cancelAnimationFrame(animationIdRef.current);
      geometry.dispose();
      material.dispose();
      buttonGeometry.dispose();
      buttonMaterial.dispose();
      texture.dispose();
      renderer.dispose();
      cancelAnimationFrame(raf);
    };
  }, [
    isVisible,
    rippleConfig,
    RIPPLE_CYCLE_DURATION,
    RIPPLE_MAX_SCALE,
    WAVE_GROUP_DELAY,
    RIPPLE_BASE_OPACITY,
  ]);

  const handleExplore = () => {
    setIsExiting(true);
    if (onExplore) onExplore();

    setTimeout(() => {
      setIsVisible(false);
    }, 800);
  };

  const handleMouseEnter = () => {
    const canvas = canvasRef.current;
    if (canvas?.style) canvas.style.transform = "scale(1.1)";
  };

  const handleMouseLeave = () => {
    const canvas = canvasRef.current;
    if (canvas?.style) canvas.style.transform = "scale(1.0)";
  };

  if (!isVisible) return null;

  return (
    <div
      role="region"
      aria-label="Introduction"
      style={{
        position: "relative",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        zIndex: 20,
        opacity: isExiting ? 0 : 1,
        transform: isExiting ? "scale(1.25)" : "scale(1)",
        transition:
          "opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1), transform 0.8s cubic-bezier(0.4, 0, 0.2, 1)",
        pointerEvents: isExiting ? "none" : "auto",
      }}
    >
      {Array.isArray(titleMedia) && titleMedia.length > 0 ? (
        <KennyBurns images={titleMedia.map(m => typeof m === 'string' ? m : (m?.src || ''))} />
      ) : typeof titleMedia === "string" ? (
        <KennyBurns images={[titleMedia]} />
      ) : null}

      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.7) 100%)",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          textAlign: "center",
          padding: "2rem",
        }}
      >
        {titleDisplay ? (
          <div
            dangerouslySetInnerHTML={{ __html: titleDisplay }}
            style={{
              animation: "fadeInUp 1s ease-out",
              fontSize: "8.75rem",
              fontWeight: "400",
              letterSpacing: "-0.02em",
              textShadow: "0 4px 24px rgba(0,0,0,0.5)",
              maxWidth: "90vw",
              marginBottom: "4%",
              fontFamily: "'Sabon'",
            }}
          />
        ) : (
          <h2
            style={{
              animation: "fadeInUp 1s ease-out",
              fontSize: "8.75rem",
              fontWeight: "400",
              letterSpacing: "-0.02em",
              textShadow: "0 4px 24px rgba(0,0,0,0.5)",
              maxWidth: "90vw",
              marginBottom: "4%",
              fontFamily: "'Sabon'",
            }}
          >
            {title}
          </h2>
        )}

        <button
          type="button"
          aria-label="Explore the digital experience"
          disabled={!isSceneReady}
          style={{
            position: "relative",
            width: "20vw",
            height: "20vw",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: isSceneReady ? "pointer" : "wait",
            opacity: isSceneReady ? 1 : 0.7,
            transition: "opacity 0.3s ease",
            background: "none",
            border: "none",
            padding: 0,
            color: "inherit",
            font: "inherit",
            outline: "none",
          }}
          onClick={handleExplore}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <canvas
            ref={canvasRef}
            aria-hidden="true"
            style={{
              display: "block",
              width: "100%",
              height: "100%",
              transition: "transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
            }}
          />

          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              animation: "fadeInUp 1s ease-out 0.3s backwards",
              fontSize: "1.75rem",
              fontWeight: "500",
              letterSpacing: "18%",
              textTransform: "uppercase",
              color: "#ffffff",
              pointerEvents: "none",
              textShadow: "0 2px 8px rgba(0,0,0,0.2)",
              fontFamily: '"Ideal Sans A", "Ideal Sans B", "Helvetica Neue", Arial, sans-serif',
            }}
          >
            Explore
          </div>
        </button>
      </div>

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          * {
            animation-duration: 0.01ms !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>
    </div>
  );
}
