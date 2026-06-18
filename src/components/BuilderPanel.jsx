import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';

export default function BuilderPanel({
  modelsData,
  lightsData,
  annotationsData,
  annotationManagerRef,
  settingsData,
  poiCenterRef,
  isSceneReady,
  maxPanDistRef,
  defaultPanDistRef,
  defaultZoomLimitsRef,
  zoomLimitsRef,
  isCustomBoundsEnabledRef,
  customBoundsOffsetRef,
  deactivateForcefieldRef,
  scene,
  renderer,
  camera,
  isOpen,
  setIsOpen,
  modelsLoaded
}) {
  const [data, setData] = useState({ models: [], lights: [], annotations: [], settings: {} }); // Local state mapping
  const dragRef = useRef({ active: false, annotationId: null, annotation: null, plane: new THREE.Plane() });

  useEffect(() => {
    setData({
      models: JSON.parse(JSON.stringify(modelsData || [])),
      lights: JSON.parse(JSON.stringify(lightsData || [])),
      annotations: JSON.parse(JSON.stringify(annotationsData || [])),
      settings: JSON.parse(JSON.stringify(settingsData || {}))
    });
  }, [modelsData, lightsData, annotationsData, settingsData]);

  useEffect(() => {
      if (deactivateForcefieldRef) {
          deactivateForcefieldRef.current = data.settings?.deactivateForcefield || false;
      }
  }, [data.settings?.deactivateForcefield, deactivateForcefieldRef]);

  const getVal = (val, def) => (val !== undefined && val !== "" && !isNaN(parseFloat(val))) ? parseFloat(val) : def;

  // Re-establishing Native WebGL Sprite to avoid perspective shearing mathematically disconnected from the DOM
  useEffect(() => {
     if (!scene) return;
     let helper = scene.getObjectByName('customBoundsHelper');
      if (isOpen && data.settings?.enableCustomBounds) {
          if (!helper || helper.type !== 'Mesh') {
              if (helper) {
                  scene.remove(helper);
                  if (helper.geometry) helper.geometry.dispose();
                  if (helper.material) helper.material.dispose();
              }
              const geo = new THREE.BoxGeometry(1, 1, 1);
              const mat = new THREE.MeshBasicMaterial({
                  color: 0xff0000,
                  wireframe: true,
                  depthTest: false,
                  transparent: true,
                  opacity: 0.5
              });
              const newHelper = new THREE.Mesh(geo, mat);
              newHelper.renderOrder = 999;
              newHelper.name = 'customBoundsHelper';

              scene.add(newHelper);
              helper = newHelper;
          }

          const bounds = data.settings.customBounds || [];
          const defLimits = defaultPanDistRef?.current || [500, 500, 10];
          const w = getVal(bounds[0], defLimits[0] * 2);
          const h = getVal(bounds[1], defLimits[1] * 2);
          const d = getVal(bounds[2], defLimits[2] * 2);

          const offset = data.settings.customBoundsOffset || [0, 0, 0];
          const offX = getVal(offset[0], 0);
          const offY = getVal(offset[1], 0);
          const offZ = getVal(offset[2], 0);

          let cx = offX;
          let cy = offY;
          let cz = offZ;

          if (poiCenterRef && poiCenterRef.current) {
               cx += poiCenterRef.current.x;
               cy += poiCenterRef.current.y;
               cz += poiCenterRef.current.z;
          } else if (data.models[0]) {
               let pos = [0,0,0];
               try { pos = Array.isArray(data.models[0].content?.position) ? data.models[0].content.position : JSON.parse(data.models[0].content?.position || "[0,0,0]"); } catch(e) {}
               cx += pos[0];
               cy += pos[1];
               cz += pos[2];
          }

          // Map helper dimensions using accurate mathematical volumes (Z defaults to 0.001 minimum)
          helper.scale.set(w, h, Math.max(0.001, d));
          helper.position.set(cx, cy, cz);
     } else {
         if (helper) {
             scene.remove(helper);
             helper.geometry.dispose();
             helper.material.dispose();
         }
     }
  }, [data.settings, scene, data.models, isOpen, modelsLoaded]);

  useEffect(() => {
    return () => {
        if (!scene) return;
        const helper = scene.getObjectByName('customBoundsHelper');
        if (helper) {
            scene.remove(helper);
            helper.geometry.dispose();
            helper.material.dispose();
        }
    };
  }, [scene]);

  // Bulk position update for drag (avoids 3 separate state updates per frame)
  const handleAnnotationPositionBulk = useCallback((id, newPosition) => {
    setData((prev) => {
      const next = { ...prev };
      next.annotations = [...prev.annotations];
      next.models = prev.models.map(m => ({
        ...m,
        children: m.children ? [...m.children] : undefined
      }));

      let ann = next.annotations.find(a => a.id === id);
      if (ann) {
        const idx = next.annotations.indexOf(ann);
        ann = { ...ann, content: { ...(ann.content || {}) } };
        next.annotations[idx] = ann;
      } else {
        for (const model of next.models) {
          if (model.children) {
            const idx = model.children.findIndex(c => c.id === id);
            if (idx !== -1) {
              ann = { ...model.children[idx], content: { ...(model.children[idx].content || {}) } };
              model.children[idx] = ann;
              break;
            }
          }
        }
      }

      if (!ann) return prev;
      ann.content.position = [newPosition[0], newPosition[1], newPosition[2]];
      ann.content.coordinate = `[${newPosition.map(v => v.toFixed(2)).join(', ')}]`;
      return next;
    });
  }, []);

  // --- Annotation Drag in 3D Scene ---
  useEffect(() => {
    if (!isOpen || !renderer || !camera) return;

    const canvas = renderer.domElement;
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let dragMoved = false;

    const screenToNdc = (event) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
    };

    const getAnnotationAtPointer = (event) => {
      screenToNdc(event);
      const am = annotationManagerRef?.current;
      if (!am) return null;
      const clickables = am.annotations.map(a => a.clickable).filter(c => c);
      if (clickables.length === 0) return null;
      const intersects = raycaster.intersectObjects(clickables);
      if (intersects.length > 0) {
        return am.annotations.find(a => a.clickable === intersects[0].object) || null;
      }
      return null;
    };

    const onPointerDown = (event) => {
      if (event.button !== 0) return;
      const ann = getAnnotationAtPointer(event);
      if (!ann || ann.isActive) return;

      dragMoved = false;
      const worldPos = new THREE.Vector3();
      ann.group.getWorldPosition(worldPos);

      const cameraDir = new THREE.Vector3();
      camera.getWorldDirection(cameraDir);
      const dragPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(cameraDir, worldPos);

      // Capture click offset so annotation doesn't jump
      const startIntersection = new THREE.Vector3();
      raycaster.ray.intersectPlane(dragPlane, startIntersection);

      dragRef.current = {
        active: true,
        annotationId: ann.data?.id,
        annotation: ann,
        plane: dragPlane,
        startWorldPos: worldPos.clone(),
        startIntersection: startIntersection,
      };

      canvas.setPointerCapture(event.pointerId);
      event.stopImmediatePropagation();
      event.preventDefault();
    };

    const onPointerMove = (event) => {
      if (!dragRef.current.active) return;

      screenToNdc(event);
      const intersection = new THREE.Vector3();
      const hit = raycaster.ray.intersectPlane(dragRef.current.plane, intersection);
      if (!hit) return;

      dragMoved = true;
      const ann = dragRef.current.annotation;
      if (!ann || !ann.group) return;

      // Apply world-space delta, then convert to local
      const delta = intersection.clone().sub(dragRef.current.startIntersection);
      const newWorldPos = dragRef.current.startWorldPos.clone().add(delta);
      const localPos = ann.group.parent
        ? ann.group.parent.worldToLocal(newWorldPos.clone())
        : newWorldPos;

      ann.group.position.copy(localPos);
      annotationManagerRef?.current?.updatePositions();
      handleAnnotationPositionBulk(dragRef.current.annotationId, localPos.toArray());
    };

    const onPointerUp = (event) => {
      if (!dragRef.current.active) return;
      dragRef.current.active = false;
      canvas.releasePointerCapture(event.pointerId);

      // Restore cursor
      canvas.style.cursor = '';
    };

    const onLostCapture = () => {
      if (dragRef.current.active) {
        dragRef.current.active = false;
        canvas.style.cursor = '';
      }
    };

    // Capture phase fires before AnnotationManager's bubble-phase handlers
    canvas.addEventListener('pointerdown', onPointerDown, true);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('lostpointercapture', onLostCapture);

    const onPointerMoveCapture = (event) => {
      if (!dragRef.current.active) return;
      // Show grabbing cursor during drag
      if (canvas.style.cursor !== 'grabbing') canvas.style.cursor = 'grabbing';
    };
    canvas.addEventListener('pointermove', onPointerMoveCapture);

    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown, true);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointermove', onPointerMoveCapture);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('lostpointercapture', onLostCapture);
      if (dragRef.current.active) {
        dragRef.current.active = false;
      }
    };
  }, [isOpen, renderer, camera, annotationManagerRef, handleAnnotationPositionBulk]);

  const styleBlock = (
    <style>{`
      .builder-toggle-btn {
        position: absolute;
        top: 15px;
        right: 15px;
        z-index: 70;
        background: #333;
        color: white;
        border: 1px solid #555;
        padding: 8px 12px;
        border-radius: 6px;
        cursor: pointer;
        font-family: inherit;
        font-weight: bold;
      }

      .builder-toggle-btn:hover {
        background: #444;
      }

      .builder-panel {
        position: absolute;
        top: 0;
        right: 0;
        width: 320px;
        height: 100vh;
        background-color: rgba(26, 26, 26, 0.95);
        border-left: 1px solid #333;
        backdrop-filter: blur(8px);
        display: flex;
        flex-direction: column;
        z-index: 70;
        color: #f0f0f0;
        font-family: Arial, sans-serif;
        box-shadow: -4px 0 15px rgba(0, 0, 0, 0.3);
        box-sizing: border-box;
      }

      .builder-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 15px 20px;
        border-bottom: 1px solid #333;
      }

      .builder-header h2 {
        margin: 0;
        font-size: 1.2rem;
        color: #fff;
      }

      .builder-close {
        background: none;
        border: none;
        color: #aaa;
        font-size: 1.5rem;
        cursor: pointer;
        line-height: 1;
      }

      .builder-close:hover {
        color: #fff;
      }

      .builder-content {
        flex: 1;
        overflow-y: auto;
        padding: 15px;
        display: flex;
        flex-direction: column;
        gap: 20px;
      }

      .section-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 15px;
        border-bottom: 1px solid #444;
        padding-bottom: 5px;
      }

      .builder-section h3 {
        margin: 0;
        font-size: 1.1rem;
        color: #4ecdc4;
      }

      .builder-add-btn {
        background: #4ecdc4;
        color: #1a1a1a;
        border: none;
        border-radius: 4px;
        padding: 4px 8px;
        cursor: pointer;
        font-weight: bold;
        font-size: 0.8rem;
      }

      .builder-add-btn:hover {
        background: #3eb5ad;
      }

      .builder-item {
        background: #2a2a2a;
        padding: 12px;
        border-radius: 6px;
        border: 1px solid #3a3a3a;
        margin-bottom: 10px;
        box-sizing: border-box;
      }

      .builder-item h4 {
        margin: 0 0 10px 0;
        font-size: 0.9rem;
        color: #ddd;
      }

      .builder-group {
        margin-bottom: 10px;
      }

      .builder-group:last-child {
        margin-bottom: 0;
      }

      .builder-group label {
        display: block;
        font-size: 0.75rem;
        color: #888;
        margin-bottom: 5px;
        text-transform: uppercase;
      }

      .builder-inputs {
        display: flex;
        gap: 5px;
      }

      .builder-inputs input,
      .builder-inputs select {
        flex: 1;
        width: 100%;
        background: #111;
        border: 1px solid #333;
        color: #ffffff !important;
        padding: 6px;
        border-radius: 4px;
        font-family: monospace;
        font-size: 0.85rem;
        box-sizing: border-box;
      }

      .builder-inputs input::selection {
        background: #4ecdc4;
        color: #111 !important;
      }

      .builder-inputs input:focus,
      .builder-inputs select:focus {
        outline: none;
        border-color: #4ecdc4;
      }

      .builder-footer {
        padding: 15px;
        border-top: 1px solid #333;
      }

      .builder-action-btn {
        width: 100%;
        background: #333;
        color: white;
        border: 1px solid #444;
        padding: 10px;
        border-radius: 6px;
        cursor: pointer;
        font-weight: bold;
        box-sizing: border-box;
      }

      .builder-action-btn:hover {
        background: #444;
      }

      .builder-save {
        width: 100%;
        background: #ffffffaa;
        color: #333;
        border: 1px solid #333;
        padding: 10px;
        border-radius: 6px;
        cursor: pointer;
        font-weight: bold;
        box-sizing: border-box;
      }

      .builder-save:hover {
        background: #e5e5e5;
      }
    `}</style>
  );

  if (!isOpen) {
    return (
      <>
        <button className="builder-toggle-btn" onClick={() => setIsOpen(true)}>
          Scene Builder
        </button>
        {styleBlock}
      </>
    );
  }

  const handleCopyJSON = () => {
    const text = JSON.stringify(data, null, 2);

    // Modern approach
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(() => {
        alert('JSON copied to clipboard!');
      }).catch(err => {
        console.error('Failed to copy:', err);
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  };

  const fallbackCopy = (text) => {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.position = "fixed";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      const successful = document.execCommand('copy');
      if (successful) {
        alert('JSON copied to clipboard!');
      } else {
        alert('Failed to copy JSON.');
      }
    } catch (err) {
      console.error('Fallback copy failed', err);
      alert('Failed to copy JSON. See console.');
    }
    document.body.removeChild(textArea);
  };

  const updateThreeJSModel = (id, newProps) => {
    if (!scene) return;
    let target = null;
    scene.traverse((child) => {
      if (child.userData && child.userData.id === id) {
        target = child;
      }
    });

    if (target) {
      if (newProps.position) target.position.fromArray(newProps.position);
      if (newProps.rotation) target.rotation.fromArray(newProps.rotation);
      if (newProps.scale !== undefined) {
          if (target.isSprite && target.material?.map?.image) {
              const image = target.material.map.image;
              const aspectRatio = image.width / Math.max(1, image.height);
              target.scale.set(newProps.scale, newProps.scale / aspectRatio, 1);
          } else {
              if (Array.isArray(newProps.scale)) {
                  if (newProps.scale.length === 3) {
                      target.scale.fromArray(newProps.scale);
                  } else if (newProps.scale.length === 1) {
                      target.scale.setScalar(newProps.scale[0]);
                  }
              } else {
                  target.scale.setScalar(newProps.scale);
              }
          }
      }
    }
  };

  const updateThreeJSAnnotation = (id, newProps) => {
    if (!annotationManagerRef || !annotationManagerRef.current) return;
    const am = annotationManagerRef.current;

    // Find in manager
    const ann = am.annotations.find(a => a.data && a.data.id === id);
    if (ann && ann.group) {
      if (newProps.position) ann.group.position.fromArray(newProps.position);
      if (newProps.rotation) ann.group.rotation.fromArray(newProps.rotation);

      if (newProps.scale !== undefined) {
          const newSize = newProps.scale;
          ann.size = newSize;

          if (ann.circle) {
              if (ann.circle.userData && ann.circle.userData.sprite) {
                  ann.circle.userData.sprite.scale.set(newSize, newSize, 0.02);
                  ann.circle.userData.baseScale = newSize;
              } else {
                  ann.circle.scale.set(newSize, newSize, 0.02);
              }
          }
          if (ann.clickable) {
              ann.clickable.scale.set(newSize, newSize, 0.02);
          }
          if (ann.rippleSprites) {
              ann.rippleSprites.forEach(r => {
                  r.scale.set(newSize, newSize, 0.02);
                  if (r.userData) r.userData.baseScale = newSize;
              });
          }
      }

      if (newProps.isFocused !== undefined) {
          if (ann.circle && ann.circle.userData && ann.circle.userData.sprite) {
              const sprite = ann.circle.userData.sprite;
              sprite.material.color.setHex(newProps.isFocused ? 0xFF5555 : 0xffffff);
          }
          if (ann.rippleSprites) {
              ann.rippleSprites.forEach(r => {
                  r.material.color.setHex(newProps.isFocused ? 0xFF5555 : 0xffffff);
              });
          }
          if (ann.group) {
              // Add a slight bounce scale modifier to the actual root group for emphasis
              const activeScale = newProps.isFocused ? 1.5 : 1.0;
              if (ann.group.parent && ann.group.parent.scale) {
                  const parentScale = ann.group.parent.scale;
                  ann.group.scale.set(
                      activeScale / parentScale.x,
                      activeScale / parentScale.y,
                      activeScale / parentScale.z
                  );
              } else {
                  ann.group.scale.setScalar(activeScale);
              }
          }
      }

      if (newProps.label !== undefined && ann.labelElement) {
          ann.labelElement.textContent = newProps.label;
      }

      // Keep UI aligned
      am.updatePositions();
    }
  };

  const handleModelChange = (id, type, axis, value) => {
    setData((prev) => {
      const next = { ...prev };
      next.models = [...prev.models];
      const modelIndex = next.models.findIndex(m => m.id === id);
      if (modelIndex === -1) return next;

      const model = { ...next.models[modelIndex] };
      model.content = { ...model.content };
      next.models[modelIndex] = model;

      let numVal = value === '' || value === '-' || value.endsWith('.') 
                   ? value 
                   : (parseFloat(value) || 0);

      // Ensure properties exist
      if (!model.content.position) model.content.position = [0, 0, 0];
      if (!model.content.rotation) model.content.rotation = [0, 0, 0];

      if (type === 'position') {
        const arr = Array.isArray(model.content.position) 
          ? [...model.content.position] 
          : [0, 0, 0];
          
        if(typeof model.content.position === 'string') {
            try {
                const parsed = JSON.parse(model.content.position);
                if (Array.isArray(parsed)) arr.splice(0, 3, ...parsed);
            } catch(e) {}
        }
        arr[axis] = numVal;
        model.content.position = arr;
        model.content.coordinate = `[${arr.join(', ')}]`;
      } else if (type === 'rotation') {
        const arr = Array.isArray(model.content.rotation)
          ? [...model.content.rotation]
          : [0, 0, 0]; // fallback since rotation in data-exampe was a string initially?

        if(typeof model.content.rotation === 'string') {
            try {
                const parsed = JSON.parse(model.content.rotation);
                if (Array.isArray(parsed)) arr.splice(0, 3, ...parsed);
            } catch(e) {}
        }
        arr[axis] = numVal;
        model.content.rotation = `[${arr.join(', ')}]`;
      } else if (type === 'scale') {
        model.content.scale = numVal;
      }

      // Sync specific fields logic (if rotation is string array in model and coordinate is string)
      let parsedRotation = [0,0,0];
      try { parsedRotation = JSON.parse(model.content.rotation || "[0,0,0]"); } catch(e) {}

      if (type === 'position') {
          updateThreeJSModel(id, { position: model.content.position });
      } else if (type === 'rotation') {
          updateThreeJSModel(id, { rotation: parsedRotation });
      } else if (type === 'scale') {
          updateThreeJSModel(id, { scale: model.content.scale });
      }

      return next;
    });
  };

  const handleSettingChange = (key, value) => {
    setData((prev) => {
      const next = { ...prev };
      next.settings = prev.settings ? { ...prev.settings } : {};
      next.settings[key] = value;

      if (key === 'enableCustomBounds' && maxPanDistRef && defaultPanDistRef) {
          if (isCustomBoundsEnabledRef) isCustomBoundsEnabledRef.current = value;

          if (value) {
              if (!next.settings.customBounds) {
                  next.settings.customBounds = [
                      defaultPanDistRef.current[0] * 2,
                      defaultPanDistRef.current[1] * 2,
                      defaultPanDistRef.current[2] * 2
                  ];
              }
              if (!next.settings.customBoundsOffset) {
                  next.settings.customBoundsOffset = [0, 0, 0];
              }
              if (!next.settings.zoomLimits && defaultZoomLimitsRef?.current) {
                  next.settings.zoomLimits = [
                      defaultZoomLimitsRef.current.min || 0,
                      defaultZoomLimitsRef.current.max || 0
                  ];
              }

              maxPanDistRef.current = [
                  getVal(next.settings.customBounds[0], defaultPanDistRef.current[0] * 2) / 2,
                  getVal(next.settings.customBounds[1], defaultPanDistRef.current[1] * 2) / 2,
                  getVal(next.settings.customBounds[2], defaultPanDistRef.current[2] * 2) / 2
              ];
          } else {
               maxPanDistRef.current = defaultPanDistRef.current;
          }
      }
      return next;
    });
  };

  const handleSettingChangeArray = (key, index, value) => {
    setData((prev) => {
      const next = { ...prev };
      next.settings = prev.settings ? { ...prev.settings } : {};
      let defaultArr = [0, 0, 0];
      if (key === 'customBounds') {
          defaultArr = [
              defaultPanDistRef?.current ? (defaultPanDistRef.current[0] * 2) : 1,
              defaultPanDistRef?.current ? (defaultPanDistRef.current[1] * 2) : 1,
              defaultPanDistRef?.current ? (defaultPanDistRef.current[2] * 2) : 1
          ];
      } else if (key === 'zoomLimits') {
          defaultArr = [0, 100];
      }

      const arr = next.settings[key] ? [...next.settings[key]] : defaultArr;
      arr[index] = parseFloat(value) || 0;
      next.settings[key] = arr;

      if (key === 'customBounds' && maxPanDistRef && defaultPanDistRef) {
          const w = getVal(arr[0], defaultPanDistRef.current[0] * 2);
          const h = getVal(arr[1], defaultPanDistRef.current[1] * 2);
          const d = getVal(arr[2], defaultPanDistRef.current[2] * 2);
          maxPanDistRef.current = [w/2, h/2, d/2];
      }

      if (key === 'zoomLimits' && zoomLimitsRef) {
          zoomLimitsRef.current = {
              min: arr[0] || 0,
              max: arr[1] > 0 ? arr[1] : Infinity
          };
      }

      if (key === 'customBoundsOffset' && customBoundsOffsetRef) {
          customBoundsOffsetRef.current = [arr[0] || 0, arr[1] || 0, arr[2] || 0];
      }

      return next;
    });
  };

  const handleAnnotationChange = (id, type, axis, value) => {
      setData((prev) => {
          const next = { ...prev };
          next.annotations = [...prev.annotations];
          next.models = prev.models.map(m => ({
              ...m,
              children: m.children ? [...m.children] : undefined
          }));
          
          let ann = next.annotations.find(a => a.id === id);
          if (ann) {
             const idx = next.annotations.indexOf(ann);
             ann = { ...ann, content: { ...(ann.content || {}) } };
             next.annotations[idx] = ann;
          } else {
              for (const model of next.models) {
                  if (model.children) {
                      const idx = model.children.findIndex(c => c.id === id);
                      if (idx !== -1) {
                          ann = { ...model.children[idx], content: { ...(model.children[idx].content || {}) } };
                          model.children[idx] = ann;
                          break;
                      }
                  }
              }
          }

          if (!ann) return next;

          let numVal = value === '' || value === '-' || value.endsWith('.') 
                       ? value 
                       : (parseFloat(value) || 0);
          if (!ann.content.position) ann.content.position = [0, 0, 0];

          if (type === 'position') {
              const arr = Array.isArray(ann.content.position) 
                ? [...ann.content.position] 
                : [0, 0, 0];
                
              if(typeof ann.content.position === 'string') {
                  try {
                      const parsed = JSON.parse(ann.content.position);
                      if (Array.isArray(parsed)) arr.splice(0, 3, ...parsed);
                  } catch(e) {}
              }
              arr[axis] = numVal;
              ann.content.position = arr;
              ann.content.coordinate = `[${arr.join(', ')}]`;
          } else if (type === 'scale') {
              ann.content.scale = numVal;
              ann.content.annotationSize = numVal;
          } else if (type === 'annotationZoom') {
              const zoomVal = parseFloat(value) || 0;
              ann.content.annotationZoom = zoomVal;
              // Sync to AnnotationManager's internal data
              if (annotationManagerRef?.current) {
                  const managerAnn = annotationManagerRef.current.annotations.find(a => a.data?.id === id);
                  if (managerAnn && managerAnn.data?.content) {
                      managerAnn.data.content.annotationZoom = zoomVal;
                  }
              }
          } else if (type === 'label') {
              ann.content.label = value;
              ann.content.labelText = value;
          }

          updateThreeJSAnnotation(id, { position: ann.content.position, scale: ann.content.scale, label: ann.content.labelText });
          return next;
      });
  };

  const handleAnnotationParentChange = (id, newParentId) => {
      setData((prev) => {
          const next = { ...prev };
          next.annotations = [...prev.annotations];
          next.models = prev.models.map(m => ({
              ...m,
              children: m.children ? [...m.children] : undefined
          }));

          let targetAnn = null;

          // Check models array first
          for (let model of next.models) {
              if (model.children) {
                  const idx = model.children.findIndex(c => c.id === id);
                  if (idx !== -1) {
                      targetAnn = model.children.splice(idx, 1)[0];
                      break;
                  }
              }
          }

          // Fallback check root
          if (!targetAnn) {
              const idx = next.annotations.findIndex(a => a.id === id);
              if (idx !== -1) {
                  targetAnn = next.annotations.splice(idx, 1)[0];
              }
          }

          if (!targetAnn) return next;

          // Push to new destination
          if (newParentId === "") {
              next.annotations.push(targetAnn);
          } else {
              const model = next.models.find(m => m.id.toString() === newParentId);
              if (model) {
                  if (!model.children) model.children = [];
                  model.children.push(targetAnn);
              } else {
                  next.annotations.push(targetAnn);
              }
          }
          return next;
      });
  };

  const handleDeleteAnnotation = (id) => {
      setData((prev) => {
          const next = { ...prev };
          next.annotations = prev.annotations.filter(a => a.id !== id);
          next.models = prev.models.map(model => ({
              ...model,
              children: model.children ? model.children.filter(c => c.id !== id) : undefined
          }));
          return next;
      });

      if (annotationManagerRef && annotationManagerRef.current) {
          annotationManagerRef.current.removeAnnotation(id);
      }
  };

  const handleAddAnnotation = () => {
      const id = `annotation-${Date.now()}`;
      const newAnn = {
          id: id,
          type: "explorer_annotation",
          position: data.annotations.length + 1,
          content: {
              coordinate: "[0, 0, 0]",
              position: [0.0, 0.0, 0.0],
              scale: 1,
              annotationColor: "#4B9CA3",
              annotationSize: 0.5,
              showLabel: true,
              labelText: "New Annotation",
              sizeAttenuation: true
          }
      };

      setData((prev) => {
          const next = { ...prev };
          next.annotations = [...prev.annotations, newAnn];
          return next;
      });

      if (annotationManagerRef && annotationManagerRef.current) {
          annotationManagerRef.current.addAnnotation(newAnn);
      }
  };

  // --- Light management ---
  const has3DModels = data.models.some(m => (m.modelType || m.content?.modelType) !== '2d');

  const updateThreeJSLight = (index, newProps) => {
      if (!scene) return;
      // Lights are direct children of scene — collect them in order
      const sceneLights = [];
      scene.children.forEach(child => {
          if (child.isLight) sceneLights.push(child);
      });
      const light = sceneLights[index];
      if (!light) return;

      if (newProps.position && light.position) {
          light.position.set(newProps.position[0], newProps.position[1], newProps.position[2]);
      }
      if (newProps.intensity !== undefined) light.intensity = newProps.intensity;
      if (newProps.color !== undefined) light.color.set(newProps.color);
      if (newProps.castShadow !== undefined && light.shadow) light.castShadow = newProps.castShadow;
      if (newProps.angle !== undefined && light.angle !== undefined) light.angle = newProps.angle;
      if (newProps.penumbra !== undefined && light.penumbra !== undefined) light.penumbra = newProps.penumbra;
  };

  const handleLightChange = (index, key, value) => {
      setData((prev) => {
          const next = { ...prev };
          next.lights = [...prev.lights];
          const light = { ...next.lights[index], content: { ...(next.lights[index]?.content || {}) } };
          next.lights[index] = light;

          if (key === 'lightType') {
              light.content.lightType = value;
              // Swap light type in scene
              if (scene) {
                  const sceneLights = [];
                  scene.children.forEach(child => { if (child.isLight) sceneLights.push(child); });
                  const oldLight = sceneLights[index];
                  if (oldLight) {
                      const pos = oldLight.position.clone();
                      const color = '#' + oldLight.color.getHexString();
                      const intensity = oldLight.intensity;
                      scene.remove(oldLight);
                      if (oldLight.dispose) oldLight.dispose();

                      let newLight;
                      switch (value) {
                          case 'directional':
                              newLight = new THREE.DirectionalLight(color, intensity);
                              newLight.position.copy(pos);
                              break;
                          case 'point':
                              newLight = new THREE.PointLight(color, intensity);
                              newLight.position.copy(pos);
                              break;
                          case 'spot':
                              newLight = new THREE.SpotLight(color, intensity);
                              newLight.position.copy(pos);
                              newLight.angle = light.content.angle || Math.PI / 4;
                              newLight.penumbra = light.content.penumbra || 0.1;
                              break;
                          case 'ambient':
                          default:
                              newLight = new THREE.AmbientLight(color, intensity);
                              break;
                      }
                      scene.add(newLight);
                  }
              }
          } else if (key === 'intensity') {
              const numVal = parseFloat(value) || 0;
              light.content.intensity = numVal;
              updateThreeJSLight(index, { intensity: numVal });
          } else if (key === 'color') {
              light.content.color = value;
              updateThreeJSLight(index, { color: value });
          } else if (key === 'castShadow') {
              light.content.castShadow = value;
              updateThreeJSLight(index, { castShadow: value });
          } else if (key === 'angle') {
              const numVal = parseFloat(value) || 0;
              light.content.angle = numVal;
              updateThreeJSLight(index, { angle: numVal });
          } else if (key === 'penumbra') {
              const numVal = parseFloat(value) || 0;
              light.content.penumbra = numVal;
              updateThreeJSLight(index, { penumbra: numVal });
          }

          return next;
      });
  };

  const handleLightPositionChange = (index, axis, value) => {
      setData((prev) => {
          const next = { ...prev };
          next.lights = [...prev.lights];
          const light = { ...next.lights[index], content: { ...(next.lights[index]?.content || {}) } };
          next.lights[index] = light;

          if (!light.content.position) light.content.position = [0, 0, 0];
          const arr = Array.isArray(light.content.position) ? [...light.content.position] : [0, 0, 0];
          arr[axis] = parseFloat(value) || 0;
          light.content.position = arr;

          updateThreeJSLight(index, { position: arr });
          return next;
      });
  };

  const handleAddLight = () => {
      const newLight = {
          id: `light-${Date.now()}`,
          type: 'explorer_light',
          content: {
              lightType: 'point',
              position: [5, 5, 5],
              intensity: 1,
              color: '#ffffff'
          }
      };

      setData((prev) => {
          const next = { ...prev };
          next.lights = [...prev.lights, newLight];
          return next;
      });

      if (scene) {
          const light = new THREE.PointLight('#ffffff', 1);
          light.position.set(5, 5, 5);
          scene.add(light);
      }
  };

  const handleDeleteLight = (index) => {
      if (scene) {
          const sceneLights = [];
          scene.children.forEach(child => { if (child.isLight) sceneLights.push(child); });
          const target = sceneLights[index];
          if (target) {
              scene.remove(target);
              if (target.dispose) target.dispose();
          }
      }

      setData((prev) => {
          const next = { ...prev };
          next.lights = prev.lights.filter((_, i) => i !== index);
          return next;
      });
  };

  const handleSceneSettingChange = (key, value) => {
      setData((prev) => {
          const next = { ...prev };
          next.settings = { ...prev.settings };
          if (!next.settings.sceneSettings) next.settings.sceneSettings = {};
          next.settings.sceneSettings = { ...next.settings.sceneSettings, [key]: value };

          // Live updates to renderer
          if (renderer) {
              if (key === 'shadows') {
                  renderer.shadowMap.enabled = value;
                  renderer.shadowMap.needsUpdate = true;
              }
          }
          return next;
      });
  };

  const handleToneMappingChange = (key, value) => {
      setData((prev) => {
          const next = { ...prev };
          next.settings = { ...prev.settings, [key]: value };

          if (renderer) {
              if (key === 'toneMapping') {
                  const mappings = {
                      'NoToneMapping': THREE.NoToneMapping,
                      'LinearToneMapping': THREE.LinearToneMapping,
                      'ReinhardToneMapping': THREE.ReinhardToneMapping,
                      'CineonToneMapping': THREE.CineonToneMapping,
                      'ACESFilmicToneMapping': THREE.ACESFilmicToneMapping,
                      'AgXToneMapping': THREE.AgXToneMapping,
                      'NeutralToneMapping': THREE.NeutralToneMapping
                  };
                  renderer.toneMapping = mappings[value] || THREE.NoToneMapping;
              } else if (key === 'toneMappingExposure') {
                  renderer.toneMappingExposure = parseFloat(value) || 1;
              }
          }
          return next;
      });
  };

  const getArrayVal = (field, arrIndex) => {
      if (Array.isArray(field)) return field[arrIndex] !== undefined ? field[arrIndex] : 0;
      if (typeof field === 'string') {
          try {
              const p = JSON.parse(field);
              if (Array.isArray(p)) return p[arrIndex];
          } catch (e) {
             return 0;
          }
      }
      return 0;
  };

  const getArrayValWithFallback = (field, arrIndex, fallbackArr) => {
      let val = getArrayVal(field, arrIndex);
      if (val !== 0) return val; // Wait, 0 might be a valid override!

      // Let's specifically check if the field exists at all before falling back
      let isDefined = false;
      if (Array.isArray(field) && field[arrIndex] !== undefined && field[arrIndex] !== null) isDefined = true;
      else if (typeof field === 'string') {
          try {
              const p = JSON.parse(field);
              if (Array.isArray(p) && p[arrIndex] !== undefined && p[arrIndex] !== null) isDefined = true;
          } catch(e) {}
      }

      if (isDefined) return val;

      if (Array.isArray(fallbackArr) && fallbackArr[arrIndex] !== undefined) {
          // Prevent displaying infinite if it doesn't make sense in UI inputs
          return fallbackArr[arrIndex] === Infinity ? '' : fallbackArr[arrIndex];
      }
      return 0;
  };

  const allAnnotations = [];
  data.annotations.forEach(ann => allAnnotations.push({ ann, parentId: null }));
  data.models.forEach(model => {
      if (model.children) {
          model.children.forEach(child => {
              if (child.type === 'explorer_annotation') {
                  allAnnotations.push({ ann: child, parentId: model.id });
              }
          });
      }
  });

  return (
    <div className="builder-panel">
      <div className="builder-header">
        <h2>Builder</h2>
        <button className="builder-close" onClick={() => setIsOpen(false)} aria-label="Close Builder">×</button>
      </div>

      <div className="builder-content">
        <section className="builder-section">
          <div className="section-header">
            <h3>Settings</h3>
          </div>
          <div className="builder-item">
            <div className="builder-group">
                <label style={{display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', textTransform: 'none', color: '#fff', fontSize: '0.85rem' }}>
                    <input type="checkbox" checked={data.settings?.enableCustomBounds || false} onChange={(e) => handleSettingChange('enableCustomBounds', e.target.checked)} />
                    Enable Custom Bounds
                </label>
            </div>
            {data.settings?.enableCustomBounds && (
               <div className="builder-group" style={{marginTop: '10px'}}>
                 <label>Custom Bounds (W, H, D)</label>
                 <div className="builder-inputs">
                     <input type="number" step="0.1" value={getArrayValWithFallback(data.settings.customBounds, 0, defaultPanDistRef?.current ? [defaultPanDistRef.current[0]*2, defaultPanDistRef.current[1]*2, defaultPanDistRef.current[2]*2] : [])} onChange={(e) => handleSettingChangeArray('customBounds', 0, e.target.value)} />
                     <input type="number" step="0.1" value={getArrayValWithFallback(data.settings.customBounds, 1, defaultPanDistRef?.current ? [defaultPanDistRef.current[0]*2, defaultPanDistRef.current[1]*2, defaultPanDistRef.current[2]*2] : [])} onChange={(e) => handleSettingChangeArray('customBounds', 1, e.target.value)} />
                     <input type="number" step="0.1" value={getArrayValWithFallback(data.settings.customBounds, 2, defaultPanDistRef?.current ? [defaultPanDistRef.current[0]*2, defaultPanDistRef.current[1]*2, defaultPanDistRef.current[2]*2] : [])} onChange={(e) => handleSettingChangeArray('customBounds', 2, e.target.value)} />
                 </div>

                 <label style={{marginTop: '10px', display: 'block'}}>Origin Offset (X, Y, Z)</label>
                 <div className="builder-inputs">
                     <input type="number" step="0.1" value={getArrayVal(data.settings.customBoundsOffset, 0)} onChange={(e) => handleSettingChangeArray('customBoundsOffset', 0, e.target.value)} />
                     <input type="number" step="0.1" value={getArrayVal(data.settings.customBoundsOffset, 1)} onChange={(e) => handleSettingChangeArray('customBoundsOffset', 1, e.target.value)} />
                     <input type="number" step="0.1" value={getArrayVal(data.settings.customBoundsOffset, 2)} onChange={(e) => handleSettingChangeArray('customBoundsOffset', 2, e.target.value)} />
                 </div>

                 <label style={{marginTop: '10px', display: 'block'}}>Zoom Limits (Min, Max)</label>
                 <div className="builder-inputs">
                     <input type="number" step="0.1" value={getArrayValWithFallback(data.settings.zoomLimits, 0, [defaultZoomLimitsRef?.current?.min || 0, defaultZoomLimitsRef?.current?.max || 0])} onChange={(e) => handleSettingChangeArray('zoomLimits', 0, e.target.value)} />
                     <input type="number" step="0.1" value={getArrayValWithFallback(data.settings.zoomLimits, 1, [defaultZoomLimitsRef?.current?.min || 0, defaultZoomLimitsRef?.current?.max || 0])} onChange={(e) => handleSettingChangeArray('zoomLimits', 1, e.target.value)} />
                 </div>

                 <label style={{display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', textTransform: 'none', color: '#fff', fontSize: '0.85rem', marginTop: '12px' }}>
                    <input type="checkbox" checked={data.settings?.deactivateForcefield || false} onChange={(e) => handleSettingChange('deactivateForcefield', e.target.checked)} />
                    Deactivate Forcefield
                 </label>
               </div>
            )}
           </div>
        </section>

        <section className="builder-section">
          <div className="section-header">
            <h3>Models</h3>
          </div>
          {data.models.map(model => (
            <div key={model.id} className="builder-item">
              <h4>{model.id}</h4>
              <div className="builder-group">
                <label>Position</label>
                <div className="builder-inputs">
                  <input type="number" step="0.01" value={getArrayVal(model.content?.position, 0)} onChange={(e) => handleModelChange(model.id, 'position', 0, e.target.value)} />
                  <input type="number" step="0.01" value={getArrayVal(model.content?.position, 1)} onChange={(e) => handleModelChange(model.id, 'position', 1, e.target.value)} />
                  <input type="number" step="0.01" value={getArrayVal(model.content?.position, 2)} onChange={(e) => handleModelChange(model.id, 'position', 2, e.target.value)} />
                </div>
              </div>
              <div className="builder-group">
                <label>Rotation</label>
                <div className="builder-inputs">
                  <input type="number" step="0.05" value={getArrayVal(model.content?.rotation, 0)} onChange={(e) => handleModelChange(model.id, 'rotation', 0, e.target.value)} />
                  <input type="number" step="0.05" value={getArrayVal(model.content?.rotation, 1)} onChange={(e) => handleModelChange(model.id, 'rotation', 1, e.target.value)} />
                  <input type="number" step="0.05" value={getArrayVal(model.content?.rotation, 2)} onChange={(e) => handleModelChange(model.id, 'rotation', 2, e.target.value)} />
                </div>
              </div>
              <div className="builder-group">
                <label>Scale</label>
                <div className="builder-inputs">
                  <input type="number" step="0.01" value={model.content?.scale || 1} onChange={(e) => handleModelChange(model.id, 'scale', null, e.target.value)} />
                </div>
              </div>
            </div>
          ))}
        </section>

        {has3DModels && (
        <section className="builder-section">
          <div className="section-header">
              <h3>Lights</h3>
              <button className="builder-add-btn" onClick={handleAddLight}>+ Add</button>
          </div>
          {data.lights.map((light, index) => {
              const lc = light.content || {};
              const lightType = lc.lightType || 'ambient';
              const hasPosition = lightType !== 'ambient';
              const isSpot = lightType === 'spot';
              return (
                <div key={light.id || index} className="builder-item">
                  <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '10px'}}>
                    <h4 style={{margin: 0}}>{lc.lightType || 'ambient'} <span style={{opacity: 0.5, fontSize: '0.75rem'}}>#{index}</span></h4>
                    <button onClick={() => handleDeleteLight(index)} style={{background: 'none', border: 'none', color: '#ff6b6b', cursor: 'pointer', padding: 0, fontSize: '0.8rem'}}>Delete</button>
                  </div>
                  <div className="builder-group">
                    <label>Type</label>
                    <div className="builder-inputs">
                      <select value={lightType} onChange={(e) => handleLightChange(index, 'lightType', e.target.value)}>
                        <option value="ambient">Ambient</option>
                        <option value="directional">Directional</option>
                        <option value="point">Point</option>
                        <option value="spot">Spot</option>
                      </select>
                    </div>
                  </div>
                  {hasPosition && (
                    <div className="builder-group">
                      <label>Position</label>
                      <div className="builder-inputs">
                        <input type="number" step="0.5" value={getArrayVal(lc.position, 0)} onChange={(e) => handleLightPositionChange(index, 0, e.target.value)} />
                        <input type="number" step="0.5" value={getArrayVal(lc.position, 1)} onChange={(e) => handleLightPositionChange(index, 1, e.target.value)} />
                        <input type="number" step="0.5" value={getArrayVal(lc.position, 2)} onChange={(e) => handleLightPositionChange(index, 2, e.target.value)} />
                      </div>
                    </div>
                  )}
                  <div className="builder-group">
                    <label>Intensity</label>
                    <div className="builder-inputs">
                      <input type="number" step="0.1" min="0" value={lc.intensity ?? 1} onChange={(e) => handleLightChange(index, 'intensity', e.target.value)} />
                    </div>
                  </div>
                  <div className="builder-group">
                    <label>Color</label>
                    <div className="builder-inputs" style={{alignItems: 'center'}}>
                      <input type="color" value={lc.color || '#ffffff'} onChange={(e) => handleLightChange(index, 'color', e.target.value)} style={{flex: '0 0 36px', height: '30px', padding: '2px', cursor: 'pointer'}} />
                      <input type="text" value={lc.color || '#ffffff'} onChange={(e) => handleLightChange(index, 'color', e.target.value)} />
                    </div>
                  </div>
                  {isSpot && (
                    <>
                      <div className="builder-group">
                        <label>Angle (rad)</label>
                        <div className="builder-inputs">
                          <input type="number" step="0.05" min="0" max="1.57" value={lc.angle ?? (Math.PI / 4).toFixed(2)} onChange={(e) => handleLightChange(index, 'angle', e.target.value)} />
                        </div>
                      </div>
                      <div className="builder-group">
                        <label>Penumbra</label>
                        <div className="builder-inputs">
                          <input type="number" step="0.05" min="0" max="1" value={lc.penumbra ?? 0.1} onChange={(e) => handleLightChange(index, 'penumbra', e.target.value)} />
                        </div>
                      </div>
                    </>
                  )}
                  {lightType !== 'ambient' && (
                    <div className="builder-group">
                      <label style={{display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', textTransform: 'none', color: '#fff', fontSize: '0.85rem'}}>
                        <input type="checkbox" checked={lc.castShadow || false} onChange={(e) => handleLightChange(index, 'castShadow', e.target.checked)} />
                        Cast Shadow
                      </label>
                    </div>
                  )}
                </div>
              );
          })}

          <div className="builder-item" style={{borderColor: '#4ecdc4', borderStyle: 'dashed'}}>
            <h4 style={{color: '#4ecdc4', marginBottom: '10px'}}>Scene Rendering</h4>
            <div className="builder-group">
              <label style={{display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', textTransform: 'none', color: '#fff', fontSize: '0.85rem'}}>
                <input type="checkbox" checked={data.settings?.sceneSettings?.shadows || false} onChange={(e) => handleSceneSettingChange('shadows', e.target.checked)} />
                Enable Shadows
              </label>
            </div>
            <div className="builder-group">
              <label>Tone Mapping</label>
              <div className="builder-inputs">
                <select value={data.settings?.toneMapping || 'NoToneMapping'} onChange={(e) => handleToneMappingChange('toneMapping', e.target.value)}>
                  <option value="NoToneMapping">None</option>
                  <option value="LinearToneMapping">Linear</option>
                  <option value="ReinhardToneMapping">Reinhard</option>
                  <option value="CineonToneMapping">Cineon</option>
                  <option value="ACESFilmicToneMapping">ACES Filmic</option>
                  <option value="AgXToneMapping">AgX</option>
                  <option value="NeutralToneMapping">Neutral</option>
                </select>
              </div>
            </div>
            <div className="builder-group">
              <label>Exposure</label>
              <div className="builder-inputs">
                <input type="number" step="0.1" min="0" value={data.settings?.toneMappingExposure ?? 1} onChange={(e) => handleToneMappingChange('toneMappingExposure', parseFloat(e.target.value) || 1)} />
              </div>
            </div>
          </div>
        </section>
        )}

        <section className="builder-section">
          <div className="section-header">
              <h3>Annotations</h3>
              <button className="builder-add-btn" onClick={handleAddAnnotation}>+ Add</button>
          </div>
          {allAnnotations.map(({ann, parentId}) => (
            <div key={ann.id} className="builder-item">
              <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '10px'}}>
                <h4 style={{margin: 0}}>{ann.content?.labelText || ann.id} <span style={{opacity: 0.5, fontSize: '0.75rem'}}>{parentId ? `(in ${parentId})` : ''}</span></h4>
                <button onClick={() => handleDeleteAnnotation(ann.id)} style={{background: 'none', border: 'none', color: '#ff6b6b', cursor: 'pointer', padding: 0, fontSize: '0.8rem'}}>Delete</button>
              </div>
              <div className="builder-group">
                <label>Position</label>
                <div className="builder-inputs">
                  <span style={{display: 'flex', flexDirection: 'column-reverse', alignItems: 'center', gap: '6px'}}>X<input onFocus={() => updateThreeJSAnnotation(ann.id, { isFocused: true })} onBlur={() => updateThreeJSAnnotation(ann.id, { isFocused: false })} label="X" type="number" step="0.01" value={getArrayVal(ann.content?.position, 0)} onChange={(e) => handleAnnotationChange(ann.id, 'position', 0, e.target.value)} /></span>
                  <span style={{display: 'flex', flexDirection: 'column-reverse', alignItems: 'center', gap: '6px'}}>Y<input onFocus={() => updateThreeJSAnnotation(ann.id, { isFocused: true })} onBlur={() => updateThreeJSAnnotation(ann.id, { isFocused: false })} label="Y" type="number" step="0.01" value={getArrayVal(ann.content?.position, 1)} onChange={(e) => handleAnnotationChange(ann.id, 'position', 1, e.target.value)} /></span>
                  <span style={{display: 'flex', flexDirection: 'column-reverse', alignItems: 'center', gap: '6px'}}>Z<input onFocus={() => updateThreeJSAnnotation(ann.id, { isFocused: true })} onBlur={() => updateThreeJSAnnotation(ann.id, { isFocused: false })} label="Z" type="number" step="0.01" value={getArrayVal(ann.content?.position, 2)} onChange={(e) => handleAnnotationChange(ann.id, 'position', 2, e.target.value)} /></span>
                </div>
              </div>
              <div className="builder-group">
                <label>Scale</label>
                <div className="builder-inputs">
                  <input onFocus={() => updateThreeJSAnnotation(ann.id, { isFocused: true })} onBlur={() => updateThreeJSAnnotation(ann.id, { isFocused: false })} type="number" step="0.05" value={ann.content?.scale || 0.02} onChange={(e) => handleAnnotationChange(ann.id, 'scale', null, e.target.value)} />
                </div>
              </div>
              <div className="builder-group">
                <label>Zoom Distance</label>
                <div className="builder-inputs">
                  <input onFocus={() => updateThreeJSAnnotation(ann.id, { isFocused: true })} onBlur={() => updateThreeJSAnnotation(ann.id, { isFocused: false })} type="number" step="0.5" min="0" placeholder="auto" value={ann.content?.annotationZoom || ""} onChange={(e) => handleAnnotationChange(ann.id, 'annotationZoom', null, e.target.value)} />
                </div>
              </div>
              <div className="builder-group">
                <label>Label</label>
                <div className="builder-inputs">
                  <input onFocus={() => updateThreeJSAnnotation(ann.id, { isFocused: true })} onBlur={() => updateThreeJSAnnotation(ann.id, { isFocused: false })} type="text" value={ann.content?.labelText || ""} onChange={(e) => handleAnnotationChange(ann.id, 'label', null, e.target.value)} />
                </div>
              </div>
              <div className="builder-group">
                <label>Parent Model</label>
                <div className="builder-inputs">
                  <select value={parentId || ""} onChange={(e) => handleAnnotationParentChange(ann.id, e.target.value)}>
                      <option value="">None (Root Array)</option>
                      {data.models.map(m => (
                          <option key={m.id} value={m.id}>{m.id} - {m.type}</option>
                      ))}
                  </select>
                </div>
              </div>
            </div>
          ))}
        </section>
      </div>

      <div className="builder-footer">
        <button onClick={handleCopyJSON} className="builder-action-btn">Copy JSON</button>
      </div>
      {styleBlock}
    </div>
  );
}
