import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

export default function TitleScreen({
  titleData,
  onExplore,
  isSceneReady = false,
  rippleConfig = null
}) {
  const [isVisible, setIsVisible] = useState(true);
  const [isExiting, setIsExiting] = useState(false);
  const canvasRef = useRef(null);
  const animationIdRef = useRef(null);
  const videoRef = useRef(null);
  const [videoLoaded, setVideoLoaded] = useState(false);

  const title = titleData?.title || 'Digital Explorer';
  const titleDisplay = titleData?.title_display || null;
  const titleMedia = titleData?.title_media;

  const RIPPLE_COUNT = rippleConfig?.RIPPLE_COUNT ?? 3;
  const RIPPLE_CYCLE_DURATION = rippleConfig?.RIPPLE_CYCLE_DURATION ?? 4;
  const RIPPLE_MAX_SCALE = rippleConfig?.RIPPLE_MAX_SCALE ?? 3.2;
  const RIPPLE_SPACING = rippleConfig?.RIPPLE_SPACING ?? 0.34;
  const WAVE_GROUP_DELAY = rippleConfig?.WAVE_GROUP_DELAY ?? 0;
  const RIPPLE_BASE_OPACITY = rippleConfig?.RIPPLE_BASE_OPACITY ?? 1;

  useEffect(() => {
    if (!canvasRef.current || !isVisible) return;

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
    // The camera bounds match a square aspect ratio - this keeps things centered
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

    ctx.clearRect(0, 0, 256, 256);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    ctx.fillStyle = '#4B9CA3';
    ctx.beginPath();
    ctx.arc(128, 128, 120, 0, Math.PI * 2);
    ctx.fill();

    const texture = new THREE.CanvasTexture(buttonCanvas);
    texture.generateMipmaps = false;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;

    const buttonGeometry = new THREE.PlaneGeometry(0.7, 0.7);
    const buttonMaterial = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 1.0
    });

    const buttonMesh = new THREE.Mesh(buttonGeometry, buttonMaterial);
    buttonMesh.position.set(0, 0, 0); // Explicitly centered
    buttonMesh.userData.baseScale = 2;
    buttonMesh.userData.targetScale = 2;
    scene.add(buttonMesh);

    let startTime = performance.now();

    function animate() {
      const currentTime = performance.now();
      const time = (currentTime - startTime) * 0.001;

      const effectiveCycleDuration = RIPPLE_CYCLE_DURATION + WAVE_GROUP_DELAY;

      const baseTouchingDelay = RIPPLE_CYCLE_DURATION / (RIPPLE_MAX_SCALE - 1);
      const delayBetweenRipples = baseTouchingDelay * RIPPLE_SPACING;

      ripples.forEach((ripple) => {
        const rippleIndex = ripple.userData.rippleIndex;
        const rippleDelay = rippleIndex * delayBetweenRipples;

        const totalTime = time + rippleDelay;
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

      const currentScale = buttonMesh.scale.x;
      const targetScale = buttonMesh.userData.targetScale;
      const newScale = currentScale + (targetScale - currentScale) * 0.1;
      buttonMesh.scale.set(newScale, newScale, 1);

      renderer.render(scene, camera);
      animationIdRef.current = requestAnimationFrame(animate);
    }

    animate();

    return () => {
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }

      ripples.forEach(ripple => {
        ripple.geometry.dispose();
        ripple.material.dispose();
      });
      buttonGeometry.dispose();
      buttonMaterial.dispose();
      texture.dispose();
      renderer.dispose();
    };
  }, [isVisible, rippleConfig, RIPPLE_COUNT, RIPPLE_CYCLE_DURATION, RIPPLE_MAX_SCALE, RIPPLE_SPACING, WAVE_GROUP_DELAY, RIPPLE_BASE_OPACITY]);

  const handleExplore = () => {
    setIsExiting(true);

    setTimeout(() => {
      setIsVisible(false);
      if (onExplore) {
        onExplore();
      }
    }, 800);
  };

  const handleMouseEnter = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (canvas.style) {
      canvas.style.transform = 'scale(1.1)';
    }
  };

  const handleMouseLeave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (canvas.style) {
      canvas.style.transform = 'scale(1.0)';
    }
  };

  if (!isVisible) return null;

  return (
    <div
      style={{
        position: 'relative',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 9999,
        opacity: isExiting ? 0 : 1,
        transform: isExiting ? 'scale(1.1)' : 'scale(1)',
        transition: 'opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1), transform 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
        pointerEvents: isExiting ? 'none' : 'auto'
      }}
    >
      {titleMedia?.video ? (
        <video
          ref={videoRef}
          autoPlay
          loop
          muted
          playsInline
          onLoadedData={() => setVideoLoaded(true)}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: videoLoaded ? 1 : 0,
            transition: 'opacity 1s ease-in-out'
          }}
        >
          <source src={titleMedia.video} type="video/mp4" />
        </video>
      ) : titleMedia ? (
        <img
          src={titleMedia}
          alt={title}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover'
          }}
        />
      ) : null}

      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'linear-gradient(180deg, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.7) 100%)',
          pointerEvents: 'none'
        }}
      />

      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          textAlign: 'center',
          padding: '2rem'
        }}
      >
        {titleDisplay ? (
          <div
            dangerouslySetInnerHTML={{ __html: titleDisplay }}
            style={{
              animation: 'fadeInUp 1s ease-out',
              fontSize: '4.2rem',
              fontWeight: '400',
              letterSpacing: '-0.02em',
              textShadow: '0 4px 24px rgba(0,0,0,0.5)',
              maxWidth: '90vw',
              fontFamily: "'Sabon Next LT Pro'"
            }}
          />
        ) : (
          <h2
            style={{
              animation: 'fadeInUp 1s ease-out',
              fontSize: '4.2rem',
              fontWeight: '400',
              letterSpacing: '-0.02em',
              textShadow: '0 4px 24px rgba(0,0,0,0.5)',
              maxWidth: '90vw',
              fontFamily: "'Sabon Next LT Pro'"
            }}
          >
            {title}
          </h2>
        )}

        <div
          style={{
            position: 'relative',
            width: '525px',
            height: '525px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            opacity: isSceneReady ? 1 : 0.7,
            transition: 'opacity 0.3s ease'
          }}
          onClick={handleExplore}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <canvas
            ref={canvasRef}
            style={{
              display: 'block',
              transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
            }}
          />

          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              animation: 'fadeInUp 1s ease-out 0.3s backwards',
              fontSize: '1.25rem',
              fontWeight: '400',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: '#ffffff',
              pointerEvents: 'none',
              textShadow: '0 2px 8px rgba(0,0,0,0.2)',
              fontFamily: '"Ideal Sans", "Helvetica Neue", Arial, sans-serif',
            }}
          >
            Explore
          </div>
        </div>

        {!isSceneReady && (
          <div
            style={{
              marginTop: '2rem',
              fontSize: '0.875rem',
              color: 'rgba(255,255,255,0.7)',
              animation: 'pulse 2s ease-in-out infinite',
              fontFamily: '"Helvetica Neue", Arial, sans-serif'
            }}
          >
            Loading experience...
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes pulse {
          0%, 100% {
            opacity: 0.5;
          }
          50% {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}