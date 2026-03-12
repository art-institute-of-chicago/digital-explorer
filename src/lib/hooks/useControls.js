import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls, MapControls } from 'three/examples/jsm/controls/OrbitControls';
import { toVector3Array } from '../utils/helpers';

export function useControls(containerRef, renderer, settings, models) {
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current || !renderer) return;

    const cameraSettings = settings.camera || { position: [0, 0, 5], fov: 75, near: 0.1, far: 2000 };
    const cameraPosition = toVector3Array(cameraSettings.position, [0, 0, 5]);
    const camera = new THREE.PerspectiveCamera(
      cameraSettings.fov,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      cameraSettings.near,
      cameraSettings.far
    );
    camera.position.set(cameraPosition[0], cameraPosition[1], cameraPosition[2]);
    cameraRef.current = camera;

    const is2D = models.some(m => m.type === '2d' || m.modelType === '2d' || m.content?.modelType === '2d');

    // Use MapControls for 2D, OrbitControls for 3D
    const ControlClass = is2D ? MapControls : OrbitControls;
    const controls = new ControlClass(camera, renderer.domElement);

    let orbitTarget = new THREE.Vector3(0, 0, 0);
    if (settings.orbitControls?.target) {
      const targetArray = toVector3Array(settings.orbitControls.target, [0, 0, 0]);
      orbitTarget.set(targetArray[0], targetArray[1], targetArray[2]);
    }
    controls.target.copy(orbitTarget);

    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.panSpeed = 1.0;

    // Move the camera up/down/left/right relative to the screen
    controls.screenSpacePanning = is2D;

    if (is2D) {
      controls.enableRotate = false; // Disable tilting for the 2D plane
      controls.touches = {
        ONE: THREE.TOUCH.PAN, // Single finger drags the image
        TWO: THREE.TOUCH.DOLLY_PAN
      };
    } else {
      controls.touches = {
        ONE: THREE.TOUCH.ROTATE,
        TWO: THREE.TOUCH.DOLLY_PAN
      };
    }

    // Default distance limits (will be overridden by model loading results later)
    controls.minDistance = 1;
    controls.maxDistance = 100;

    controls.update();
    controlsRef.current = controls;
    setIsReady(true);

    function handleResize() {
      if (!containerRef.current) return;
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      // Only set size if the renderer hasn't been disposed
      if (renderer.domElement) {
        renderer.setSize(width, height);
      }
    }

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (controlsRef.current) {
        controlsRef.current.dispose();
      }
    };
  }, [containerRef, renderer, settings, models]);

  return {
    camera: cameraRef.current,
    controls: controlsRef.current,
    controlsReady: isReady
  };
}