import React, { useState, useEffect } from 'react';

export default function BuilderPanel({
  modelsData,
  annotationsData,
  annotationManagerRef,
  scene,
  isOpen,
  setIsOpen
}) {
  const [data, setData] = useState({ models: [], annotations: [] }); // Local state mapping

  useEffect(() => {
    setData({
      models: JSON.parse(JSON.stringify(modelsData || [])),
      annotations: JSON.parse(JSON.stringify(annotationsData || []))
    });
  }, [modelsData, annotationsData]);

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

      .builder-section-header {
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
              // const activeScale = newProps.isFocused ? 1.5 : 1.0;
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
      const modelIndex = next.models.findIndex(m => m.id === id);
      if (modelIndex === -1) return next;

      const model = next.models[modelIndex];
      if (!model.content) model.content = {};

      let numVal = parseFloat(value) || 0;

      // Ensure properties exist
      if (!model.content.position) model.content.position = [0, 0, 0];
      if (!model.content.rotation) model.content.rotation = [0, 0, 0];

      if (type === 'position') {
        const arr = [...model.content.position];
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

  const handleAnnotationChange = (id, type, axis, value) => {
      setData((prev) => {
          const next = { ...prev };
          let ann = next.annotations.find(a => a.id === id);

          if (!ann) {
              for (const model of next.models) {
                  if (model.children) {
                      ann = model.children.find(c => c.id === id);
                      if (ann) break;
                  }
              }
          }

          if (!ann) return next;

          if (!ann.content) ann.content = {};

          let numVal = parseFloat(value) || 0;
          if (!ann.content.position) ann.content.position = [0, 0, 0];

          if (type === 'position') {
              const arr = [...ann.content.position];
              arr[axis] = numVal;
              ann.content.position = arr;
              ann.content.coordinate = `[${arr.join(', ')}]`;
          } else if (type === 'scale') {
              ann.content.scale = numVal;
              ann.content.annotationSize = numVal;
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
          next.annotations = next.annotations.filter(a => a.id !== id);
          next.models = next.models.map(model => {
              if (model.children) {
                  model.children = model.children.filter(c => c.id !== id);
              }
              return model;
          });
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
          next.annotations.push(newAnn);
          return next;
      });

      if (annotationManagerRef && annotationManagerRef.current) {
          annotationManagerRef.current.addAnnotation(newAnn);
      }
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
