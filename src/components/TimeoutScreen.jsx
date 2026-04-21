import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

export default function TimeoutScreen({
  onResume,
  onReset,
  rippleConfig = null,
  timeoutDuration = 15
}) {
  const canvasRef = useRef(null);
  const buttonRef = useRef(null);
  const animationIdRef = useRef(null);

  // Initialize state with the dynamic duration
  const [secondsLeft, setSecondsLeft] = useState(timeoutDuration);

  const RIPPLE_CYCLE_DURATION = rippleConfig?.RIPPLE_CYCLE_DURATION ?? 3;
  const RIPPLE_MAX_SCALE = rippleConfig?.RIPPLE_MAX_SCALE ?? 3.2;
  const WAVE_GROUP_DELAY = rippleConfig?.WAVE_GROUP_DELAY ?? 0;
  const RIPPLE_BASE_OPACITY = rippleConfig?.RIPPLE_BASE_OPACITY ?? 1;

  // --- Accessibility: Initial Focus ---
  useEffect(() => {
    if (buttonRef.current) {
      buttonRef.current.focus();
    }
  }, []);

  // --- Countdown Logic (Drift-Proof) ---
  useEffect(() => {
    // Calculate the exact real-world timestamp based on the dynamic duration
    const endTime = Date.now() + timeoutDuration * 1000;

    const timer = setInterval(() => {
      // Calculate real seconds remaining
      const remaining = Math.max(0, Math.round((endTime - Date.now()) / 1000));
      setSecondsLeft(remaining);

      if (remaining <= 0) {
        clearInterval(timer);
        onReset();
      }
    }, 250); // Checking every 250ms prevents visual lag and guarantees accuracy

    return () => clearInterval(timer);
  }, [onReset, timeoutDuration]); // Added timeoutDuration to dependencies

  // Helper to cleanly format seconds into M:SS
  const formattedTime = () => {
    const minutes = Math.floor(secondsLeft / 60);
    const seconds = secondsLeft % 60;
    return `${minutes}:${seconds < 10 ? `0${seconds}` : seconds}`;
  };

  // --- Three.js Logic ---
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });

    const size = 275;
    renderer.setSize(size, size);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

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
    buttonCanvas.width = 256;
    buttonCanvas.height = 256;
    const ctx = buttonCanvas.getContext("2d", { alpha: true });
    ctx.fillStyle = "#4B9CA3";
    ctx.beginPath();
    ctx.arc(128, 128, 120, 0, Math.PI * 2);
    ctx.fill();

    const texture = new THREE.CanvasTexture(buttonCanvas);
    const buttonGeometry = new THREE.PlaneGeometry(0.7, 0.7);
    const buttonMaterial = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
    });

    const buttonMesh = new THREE.Mesh(buttonGeometry, buttonMaterial);
    buttonMesh.userData.targetScale = 2;
    buttonMesh.renderOrder = 10; // Ensure it renders on top
    scene.add(buttonMesh);

    let startTime = performance.now();
    function animate() {
      const time = (performance.now() - startTime) * 0.001;
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
      const newScale =
        buttonMesh.scale.x +
        (buttonMesh.userData.targetScale - buttonMesh.scale.x) * 0.1;
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
    };
  }, [
    rippleConfig,
    RIPPLE_CYCLE_DURATION,
    RIPPLE_MAX_SCALE,
    WAVE_GROUP_DELAY,
    RIPPLE_BASE_OPACITY,
  ]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="timeout-heading"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        backgroundColor: "rgba(21, 21, 21, 0.95)",
        zIndex: 90,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        color: "white",
        textAlign: "center",
        backdropFilter: "blur(10px)",
        userSelect: "none",
      }}
    >
      <div aria-live="polite" className="sr-only">
        {secondsLeft % 5 === 0 &&
          `Timeout warning. Resetting in ${secondsLeft} seconds.`}
      </div>

      <div
        style={{
          marginBottom: "40px",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <h2
          id="timeout-heading"
          style={{
            fontSize: "6.5rem",
            fontFamily: "'Sabon Next LT Pro', serif",
            margin: 0,
            fontWeight: "400",
            letterSpacing: "-0.01em",
          }}
        >
          Are you still there?
        </h2>

        <div
          aria-hidden="true"
          style={{
            fontSize: "1.75rem",
            opacity: 0.7,
            marginTop: "3rem",
            fontFamily: '"Ideal Sans A", Helvetica, Arial, sans-serif',
            letterSpacing: "0.05em",
            textTransform: "uppercase",
          }}
        >
          {formattedTime()}
        </div>
      </div>

      <button
        ref={buttonRef}
        onClick={onResume}
        aria-label="Continue exploring the digital collection"
        onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.03)")}
        onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
        style={{
          background: "none",
          border: "none",
          padding: 0,
          position: "relative",
          width: "525px",
          height: "525px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
          outline: "none",
        }}
      >
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          style={{ width: "275px", height: "275px", display: "block" }}
        />

        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            fontSize: "1.2rem",
            fontWeight: "550",
            letterSpacing: "0.25em",
            textTransform: "uppercase",
            pointerEvents: "none",
            fontFamily: '"Ideal Sans A", Helvetica, Arial, sans-serif',
            color: "#FFFFFF",
          }}
        >
          Explore
        </div>
      </button>

      <style>{`
        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border-width: 0;
        }

        button:focus-visible {
          border-radius: 50%;
        }
      `}</style>
    </div>
  );
}