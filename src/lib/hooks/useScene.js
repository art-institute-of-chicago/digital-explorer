import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { toVector3Array } from '../utils/helpers';

/**
 * Hook to set up and manage the Three.js scene
 */
export function useScene(containerRef, settings, lights) {
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const backgroundColor = settings.backgroundColor || '#1a1a1a';
    scene.background = new THREE.Color(backgroundColor);

    // Renderer setup
    const sceneSettings = settings.sceneSettings || { antialiasing: false, shadows: false };
    const renderer = new THREE.WebGLRenderer({
      antialias: sceneSettings.antialiasing,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance'
    });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = sceneSettings.shadows;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lights setup
    if (lights.length > 0) {
      lights.forEach((lightData) => {
        const { content, position } = lightData;
        const lightType = content?.lightType || 'ambient';
        const lightPosition = toVector3Array(content?.position || position, [0, 0, 0]);
        const intensity = content?.intensity || 1;
        const color = content?.color || '#ffffff';

        let light;
        switch (lightType) {
          case 'directional':
            light = new THREE.DirectionalLight(color, intensity);
            light.position.set(lightPosition[0], lightPosition[1], lightPosition[2]);
            break;
          case 'point':
            light = new THREE.PointLight(color, intensity);
            light.position.set(lightPosition[0], lightPosition[1], lightPosition[2]);
            break;
          case 'spot':
            light = new THREE.SpotLight(color, intensity);
            light.position.set(lightPosition[0], lightPosition[1], lightPosition[2]);
            light.angle = content?.angle || Math.PI / 4;
            light.penumbra = content?.penumbra || 0.1;
            break;
          case 'ambient':
          default:
            light = new THREE.AmbientLight(color, intensity);
            break;
        }
        scene.add(light);
      });
    } else {
      // Default lights
      scene.add(new THREE.AmbientLight(0xffffff, 0.5));
      const pointLight = new THREE.PointLight(0xffffff, 1);
      pointLight.position.set(10, 10, 10);
      scene.add(pointLight);
    }

    setIsReady(true);

    return () => {
      if (rendererRef.current) {
        rendererRef.current.dispose();
        if (containerRef.current && rendererRef.current.domElement) {
          containerRef.current.removeChild(rendererRef.current.domElement);
        }
      }
      if (sceneRef.current) {
        sceneRef.current.traverse((object) => {
          if (object.geometry) object.geometry.dispose();
          if (object.material) {
            if (Array.isArray(object.material)) {
              object.material.forEach(material => material.dispose());
            } else {
              object.material.dispose();
            }
          }
        });
      }
    };
  }, [containerRef, settings, lights]);

  return {
    scene: sceneRef.current,
    renderer: rendererRef.current,
    sceneReady: isReady
  };
}