import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

export default function TimeoutScreen({ onResume, onReset, rippleConfig = null }) {
  const canvasRef = useRef(null);
  const buttonRef = useRef(null);
  const animationIdRef = useRef(null);
  const [secondsLeft, setSecondsLeft] = useState(15);

  const RIPPLE_COUNT = rippleConfig?.RIPPLE_COUNT ?? 3;
  const RIPPLE_CYCLE_DURATION = rippleConfig?.RIPPLE_CYCLE_DURATION ?? 4;
  const RIPPLE_MAX_SCALE = rippleConfig?.RIPPLE_MAX_SCALE ?? 3.2;
  const RIPPLE_SPACING = rippleConfig?.RIPPLE_SPACING ?? 0.34;
  const WAVE_GROUP_DELAY = rippleConfig?.WAVE_GROUP_DELAY ?? 0;
  const RIPPLE_BASE_OPACITY = rippleConfig?.RIPPLE_BASE_OPACITY ?? 1;

  // --- Accessibility: Initial Focus ---
  useEffect(() => {
    // When the screen appears, move focus to the "Explore" button
    // so keyboard/screen-reader users are immediately in the right place.
    if (buttonRef.current) {
      buttonRef.current.focus();
    }
  }, []);

  // --- Countdown Logic ---
  useEffect(() => {
    if (secondsLeft <= 0) {
      onReset();
      return;
    }
    const timer = setInterval(() => setSecondsLeft(s => s - 1), 1000);
    return () => clearInterval(timer);
  }, [secondsLeft, onReset]);

  // --- Three.js Logic ---
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: "high-performance"
    });

    const size = 275;
    renderer.setSize(size, size);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    camera.position.z = 1;

    const ripples = [];
    for (let i = 0; i < RIPPLE_COUNT; i++) {
      const geometry = new THREE.RingGeometry(0.35, 0.4, 64);
      const material = new THREE.MeshBasicMaterial({
        color: 0x4ecdc4,
        transparent: true,
        opacity: RIPPLE_BASE_OPACITY,
        side: THREE.DoubleSide
      });
      const ring = new THREE.Mesh(geometry, material);
      ring.userData.rippleIndex = i;
      ring.userData.baseOpacity = RIPPLE_BASE_OPACITY;
      scene.add(ring);
      ripples.push(ring);
    }

    const buttonCanvas = document.createElement('canvas');
    buttonCanvas.width = 256;
    buttonCanvas.height = 256;
    const ctx = buttonCanvas.getContext('2d', { alpha: true });
    ctx.fillStyle = '#4B9CA3';
    ctx.beginPath();
    ctx.arc(128, 128, 120, 0, Math.PI * 2);
    ctx.fill();

    const texture = new THREE.CanvasTexture(buttonCanvas);
    const buttonGeometry = new THREE.PlaneGeometry(0.7, 0.7);
    const buttonMaterial = new THREE.MeshBasicMaterial({ map: texture, transparent: true });
    const buttonMesh = new THREE.Mesh(buttonGeometry, buttonMaterial);
    buttonMesh.userData.targetScale = 2;
    scene.add(buttonMesh);

    let startTime = performance.now();
    function animate() {
      const time = (performance.now() - startTime) * 0.001;
      const effectiveCycleDuration = RIPPLE_CYCLE_DURATION + WAVE_GROUP_DELAY;
      const baseTouchingDelay = RIPPLE_CYCLE_DURATION / (RIPPLE_MAX_SCALE - 1);
      const delayBetweenRipples = baseTouchingDelay * RIPPLE_SPACING;

      ripples.forEach((ripple) => {
        const totalTime = time + (ripple.userData.rippleIndex * delayBetweenRipples);
        const phase = totalTime % effectiveCycleDuration;
        if (phase < RIPPLE_CYCLE_DURATION) {
          const progress = phase / RIPPLE_CYCLE_DURATION;
          const scale = 0.7 * (1 + progress * (RIPPLE_MAX_SCALE - 1));
          ripple.scale.set(scale, scale, 1);
          ripple.material.opacity = ripple.userData.baseOpacity * (1 - progress);
          ripple.visible = true;
        } else {
          ripple.visible = false;
        }
      });

      const newScale = buttonMesh.scale.x + (buttonMesh.userData.targetScale - buttonMesh.scale.x) * 0.1;
      buttonMesh.scale.set(newScale, newScale, 1);

      renderer.render(scene, camera);
      animationIdRef.current = requestAnimationFrame(animate);
    }

    animate();
    return () => {
      if (animationIdRef.current) cancelAnimationFrame(animationIdRef.current);
      ripples.forEach(r => { r.geometry.dispose(); r.material.dispose(); });
      buttonGeometry.dispose(); buttonMaterial.dispose(); texture.dispose();
      renderer.dispose();
    };
  }, [rippleConfig, RIPPLE_COUNT, RIPPLE_CYCLE_DURATION, RIPPLE_MAX_SCALE, RIPPLE_SPACING, WAVE_GROUP_DELAY, RIPPLE_BASE_OPACITY]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="timeout-heading"
      style={{
        position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
        backgroundColor: 'rgba(21, 21, 21, 0.95)', zIndex: 10000,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        color: 'white', textAlign: 'center', backdropFilter: 'blur(10px)', userSelect: 'none'
      }}
    >
      {/* Accessibility: Hidden text that announces only every 5 seconds
        to avoid overwhelming screen reader users.
      */}
      <div aria-live="polite" className="sr-only">
        {secondsLeft % 5 === 0 && `Timeout warning. Resetting in ${secondsLeft} seconds.`}
      </div>

      <div style={{ marginBottom: '40px', display: 'flex', flexDirection: 'column' }}>
        <h2 id="timeout-heading" style={{
          fontSize: '6.5rem', fontFamily: "'Sabon Next LT Pro', serif",
          margin: 0, fontWeight: '400', letterSpacing: '-0.01em'
        }}>
          Are you still there?
        </h2>

        <div aria-hidden="true" style={{
          fontSize: '1.75rem', opacity: 0.7, marginTop: '3rem',
          fontFamily: '"Ideal Sans", Helvetica, Arial, sans-serif',
          letterSpacing: '0.05em', textTransform: 'uppercase'
        }}>
          0:{secondsLeft < 10 ? `0${secondsLeft}` : secondsLeft}
        </div>
      </div>

      <button
        ref={buttonRef}
        onClick={onResume}
        aria-label="Continue exploring the digital collection"
        onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.03)'}
        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
        style={{
          background: 'none', border: 'none', padding: 0,
          position: 'relative', width: '525px', height: '525px',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
          outline: 'none' // We rely on visual state, but you can add a focus ring if desired
        }}
      >
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          style={{ width: '275px', height: '275px', display: 'block' }}
        />

        <div style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          fontSize: '1.2rem', fontWeight: '550', letterSpacing: '0.25em',
          textTransform: 'uppercase', pointerEvents: 'none',
          fontFamily: '"Ideal Sans", Helvetica, Arial, sans-serif', color: '#FFFFFF'
        }}>
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

        /* Ensure the button shows focus for keyboard users */
        button:focus-visible {
          border-radius: 50%;
          box-shadow: 0 0 0 4px #4ecdc4;
        }
      `}</style>
    </div>
  );
}