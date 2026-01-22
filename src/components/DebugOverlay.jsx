// src/components/DigitalExplorer/DebugOverlay.jsx
import React, { useEffect, useState } from 'react';

/**
 * Debug Overlay - Interactive diagnostics and live parameter control
 * Remove this in production!
 */
export default function DebugOverlay({
  scene,
  renderer,
  camera,
  controls,
  showTitleScreen,
  isSceneReady,
  models = [],
  annotationManager = null,
  sceneContainer = null,
  onRippleConfigChange
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState('scene'); // 'scene', 'container', 'models', 'annotations', 'ripples'
  const [debugInfo, setDebugInfo] = useState({});
  const [modelDetails, setModelDetails] = useState([]);
  const [selectedModel, setSelectedModel] = useState(null);
  const [selectedAnnotation, setSelectedAnnotation] = useState(null);

  // Ripple configuration state
  const [rippleConfig, setRippleConfig] = useState({
    RIPPLE_COUNT: 3,
    RIPPLE_CYCLE_DURATION: 3,
    RIPPLE_MAX_SCALE: 2.0,
    RIPPLE_SPACING: 0.5,
    WAVE_GROUP_DELAY: 0,
    RIPPLE_BASE_OPACITY: 0.8
  });

  // Update debug info periodically
  useEffect(() => {
    const interval = setInterval(() => {
      const canvas = renderer?.domElement;
      const info = {
        // Renderer info
        rendererExists: !!renderer,
        canvasExists: !!canvas,
        canvasInDOM: canvas ? document.body.contains(canvas) : false,
        canvasDisplay: canvas?.style.display || 'unknown',
        canvasZIndex: canvas?.style.zIndex || 'unknown',
        canvasPosition: canvas?.style.position || 'unknown',
        canvasSize: canvas ? `${canvas.width}x${canvas.height}` : 'unknown',

        // Scene info
        sceneExists: !!scene,
        sceneChildren: scene?.children.length || 0,

        // Camera info
        cameraExists: !!camera,
        cameraPosition: camera ?
          `[${camera.position.x.toFixed(2)}, ${camera.position.y.toFixed(2)}, ${camera.position.z.toFixed(2)}]` :
          'unknown',
        cameraRotation: camera ?
          `[${camera.rotation.x.toFixed(2)}, ${camera.rotation.y.toFixed(2)}, ${camera.rotation.z.toFixed(2)}]` :
          'unknown',

        // Controls info
        controlsExists: !!controls,
        controlsTarget: controls ?
          `[${controls.target.x.toFixed(2)}, ${controls.target.y.toFixed(2)}, ${controls.target.z.toFixed(2)}]` :
          'unknown',
        controlsMinDist: controls?.minDistance.toFixed(2) || 'unknown',
        controlsMaxDist: controls?.maxDistance.toFixed(2) || 'unknown',

        // State info
        showTitleScreen,
        isSceneReady,

        // DOM info
        overlayContainers: document.querySelectorAll('#annotation-overlays, #annotation-icons').length,
        totalCanvases: document.querySelectorAll('canvas').length
      };

      setDebugInfo(info);

      // Update model details
      if (scene) {
        const details = [];
        scene.traverse((obj) => {
          if (obj.type === 'Mesh' || obj.type === 'Sprite' || obj.type === 'Group') {
            details.push({
              name: obj.name || 'Unnamed',
              type: obj.type,
              position: `[${obj.position.x.toFixed(2)}, ${obj.position.y.toFixed(2)}, ${obj.position.z.toFixed(2)}]`,
              visible: obj.visible,
              children: obj.children.length,
              object: obj  // Store reference for live editing
            });
          }
        });
        setModelDetails(details);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [scene, renderer, camera, controls, showTitleScreen, isSceneReady]);

  // Handle ripple config changes
  const handleRippleChange = (key, value) => {
    const newConfig = { ...rippleConfig, [key]: value };
    setRippleConfig(newConfig);

    if (onRippleConfigChange) {
      onRippleConfigChange(newConfig);
    }
  };

  // Handle model transform changes
  const handleModelTransform = (model, type, axis, value) => {
    if (!model) return;

    const numValue = parseFloat(value);
    if (type === 'position') {
      model.position[axis] = numValue;
    } else if (type === 'rotation') {
      model.rotation[axis] = numValue;
    } else if (type === 'scale') {
      model.scale[axis] = numValue;
    }
  };

  // Handle annotation position changes
  const handleAnnotationTransform = (annotation, axis, value) => {
    if (!annotation || !annotation.group) return;

    const numValue = parseFloat(value);
    annotation.group.position[axis] = numValue;
  };

  // Apply preset
  const applyPreset = (preset) => {
    const presets = {
      calm: {
        RIPPLE_COUNT: 2,
        RIPPLE_CYCLE_DURATION: 5,
        RIPPLE_MAX_SCALE: 2.5,
        RIPPLE_SPACING: 1.0,
        WAVE_GROUP_DELAY: 2,
        RIPPLE_BASE_OPACITY: 0.5
      },
      energetic: {
        RIPPLE_COUNT: 4,
        RIPPLE_CYCLE_DURATION: 1.5,
        RIPPLE_MAX_SCALE: 1.8,
        RIPPLE_SPACING: 0.3,
        WAVE_GROUP_DELAY: 0,
        RIPPLE_BASE_OPACITY: 0.9
      },
      elegant: {
        RIPPLE_COUNT: 2,
        RIPPLE_CYCLE_DURATION: 4,
        RIPPLE_MAX_SCALE: 2.0,
        RIPPLE_SPACING: 0.8,
        WAVE_GROUP_DELAY: 1,
        RIPPLE_BASE_OPACITY: 0.4
      },
      pulsing: {
        RIPPLE_COUNT: 3,
        RIPPLE_CYCLE_DURATION: 2,
        RIPPLE_MAX_SCALE: 3.0,
        RIPPLE_SPACING: 0.5,
        WAVE_GROUP_DELAY: 3,
        RIPPLE_BASE_OPACITY: 1.0
      }
    };

    const newConfig = presets[preset];
    setRippleConfig(newConfig);
    if (onRippleConfigChange) {
      onRippleConfigChange(newConfig);
    }
  };

  const styles = {
    container: {
      position: 'fixed',
      bottom: 10,
      left: 10,
      backgroundColor: 'rgba(0, 0, 0, 0.95)',
      color: '#00ff00',
      fontFamily: 'monospace',
      fontSize: '11px',
      zIndex: 99999,
      borderRadius: '4px',
      border: '1px solid #00ff00',
      maxHeight: '90vh',
      overflow: 'auto',
      minWidth: '300px',
      maxWidth: '500px'
    },
    header: {
      padding: '10px',
      borderBottom: '1px solid #00ff00',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: 'rgba(0, 255, 0, 0.1)',
      cursor: 'pointer',
      userSelect: 'none'
    },
    tabs: {
      display: 'flex',
      borderBottom: '1px solid #00ff00',
      backgroundColor: 'rgba(0, 0, 0, 0.5)'
    },
    tab: {
      flex: 1,
      padding: '8px',
      textAlign: 'center',
      cursor: 'pointer',
      borderRight: '1px solid #00ff00',
      transition: 'background 0.2s'
    },
    tabActive: {
      backgroundColor: 'rgba(0, 255, 0, 0.2)',
      fontWeight: 'bold'
    },
    content: {
      padding: '10px',
      maxHeight: '400px',
      overflowY: 'auto'
    },
    row: {
      marginBottom: '5px',
      display: 'flex',
      justifyContent: 'space-between'
    },
    label: {
      color: '#888',
      marginRight: '10px'
    },
    value: (isGood) => ({
      color: isGood ? '#00ff00' : '#ff6666'
    }),
    input: {
      backgroundColor: 'rgba(0, 255, 0, 0.1)',
      border: '1px solid #00ff00',
      color: '#00ff00',
      padding: '4px 8px',
      borderRadius: '3px',
      width: '80px',
      fontFamily: 'monospace',
      fontSize: '11px'
    },
    button: {
      backgroundColor: 'rgba(0, 255, 0, 0.2)',
      border: '1px solid #00ff00',
      color: '#00ff00',
      padding: '4px 8px',
      borderRadius: '3px',
      cursor: 'pointer',
      marginRight: '5px',
      marginTop: '5px',
      fontSize: '10px',
      fontFamily: 'monospace'
    },
    modelItem: {
      padding: '8px',
      marginBottom: '5px',
      backgroundColor: 'rgba(0, 255, 0, 0.05)',
      borderRadius: '3px',
      border: '1px solid rgba(0, 255, 0, 0.2)'
    }
  };

  if (!isExpanded) {
    return (
      <div style={{ ...styles.container, width: 'auto' }}>
        <div style={styles.header} onClick={() => setIsExpanded(true)}>
          <span style={{ fontWeight: 'bold', color: '#ffff00' }}>🐛 DEBUG</span>
          <span style={{ marginLeft: '10px' }}>▶</span>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header} onClick={() => setIsExpanded(false)}>
        <span style={{ fontWeight: 'bold', color: '#ffff00' }}>
          🐛 DEBUG OVERLAY (Remove in production!)
        </span>
        <span>▼</span>
      </div>

      {/* Tabs */}
      <div style={styles.tabs}>
        <div
          style={{ ...styles.tab, ...(activeTab === 'scene' && styles.tabActive) }}
          onClick={() => setActiveTab('scene')}
        >
          Scene
        </div>
        <div
          style={{ ...styles.tab, ...(activeTab === 'container' && styles.tabActive) }}
          onClick={() => setActiveTab('container')}
        >
          Container
        </div>
        <div
          style={{ ...styles.tab, ...(activeTab === 'models' && styles.tabActive) }}
          onClick={() => setActiveTab('models')}
        >
          Models ({modelDetails.length})
        </div>
        <div
          style={{ ...styles.tab, ...(activeTab === 'annotations' && styles.tabActive) }}
          onClick={() => setActiveTab('annotations')}
        >
          Annotations ({annotationManager?.annotations?.length || 0})
        </div>
        <div
          style={{ ...styles.tab, ...(activeTab === 'ripples' && styles.tabActive), borderRight: 'none' }}
          onClick={() => setActiveTab('ripples')}
        >
          Ripples
        </div>
      </div>

      {/* Content */}
      <div style={styles.content}>
        {/* Scene Tab */}
        {activeTab === 'scene' && (
          <div>
            <div style={{ marginBottom: '10px', fontWeight: 'bold', color: '#ffff00' }}>
              Renderer Status
            </div>
            {Object.entries(debugInfo).slice(0, 7).map(([key, value]) => (
              <div key={key} style={styles.row}>
                <span style={styles.label}>{key}:</span>
                <span style={styles.value(
                  value === true ||
                  value === 'block' ||
                  value === 'absolute' ||
                  (typeof value === 'number' && value > 0)
                )}>
                  {String(value)}
                </span>
              </div>
            ))}

            <div style={{ marginTop: '15px', marginBottom: '10px', fontWeight: 'bold', color: '#ffff00' }}>
              Scene Info
            </div>
            <div style={styles.row}>
              <span style={styles.label}>Scene exists:</span>
              <span style={styles.value(debugInfo.sceneExists)}>{String(debugInfo.sceneExists)}</span>
            </div>
            <div style={styles.row}>
              <span style={styles.label}>Scene children:</span>
              <span style={styles.value(debugInfo.sceneChildren > 0)}>{debugInfo.sceneChildren}</span>
            </div>

            <div style={{ marginTop: '15px', marginBottom: '10px', fontWeight: 'bold', color: '#ffff00' }}>
              Camera & Controls
            </div>
            <div style={styles.row}>
              <span style={styles.label}>Camera pos:</span>
              <span style={styles.value(true)}>{debugInfo.cameraPosition}</span>
            </div>
            <div style={styles.row}>
              <span style={styles.label}>Camera rot:</span>
              <span style={styles.value(true)}>{debugInfo.cameraRotation}</span>
            </div>
            <div style={styles.row}>
              <span style={styles.label}>Controls target:</span>
              <span style={styles.value(true)}>{debugInfo.controlsTarget}</span>
            </div>
            <div style={styles.row}>
              <span style={styles.label}>Min distance:</span>
              <span style={styles.value(true)}>{debugInfo.controlsMinDist}</span>
            </div>
            <div style={styles.row}>
              <span style={styles.label}>Max distance:</span>
              <span style={styles.value(true)}>{debugInfo.controlsMaxDist}</span>
            </div>

            <div style={{ marginTop: '15px', marginBottom: '10px', fontWeight: 'bold', color: '#ffff00' }}>
              State
            </div>
            <div style={styles.row}>
              <span style={styles.label}>Title screen:</span>
              <span style={styles.value(!debugInfo.showTitleScreen)}>{String(debugInfo.showTitleScreen)}</span>
            </div>
            <div style={styles.row}>
              <span style={styles.label}>Scene ready:</span>
              <span style={styles.value(debugInfo.isSceneReady)}>{String(debugInfo.isSceneReady)}</span>
            </div>
          </div>
        )}

        {/* Scene Container Tab */}
        {activeTab === 'container' && (
          <div>
            <div style={{ marginBottom: '10px', fontWeight: 'bold', color: '#ffff00' }}>
              Scene Container Transform
            </div>

            {!sceneContainer ? (
              <div style={{ color: '#ff6666', fontStyle: 'italic' }}>
                Scene container not initialized yet...
              </div>
            ) : (
              <div>
                <div style={{
                  padding: '8px',
                  backgroundColor: 'rgba(0, 255, 0, 0.1)',
                  borderRadius: '4px',
                  marginBottom: '10px',
                  border: '1px solid #00ff00'
                }}>
                  <div style={{ color: '#ffff00', fontSize: '10px', fontWeight: 'bold', marginBottom: '4px' }}>
                    ✓ ROOT SCENE CONTAINER
                  </div>
                  <div style={{ fontSize: '9px', color: '#ccc' }}>
                    This transforms the ENTIRE scene (all models + annotations).
                    Individual model positions are relative to this.
                  </div>
                </div>

                {/* Position */}
                <div style={{ marginBottom: '8px' }}>
                  <div style={{ color: '#888', marginBottom: '3px', fontSize: '10px' }}>Position</div>
                  {['x', 'y', 'z'].map(axis => (
                    <div key={axis} style={{ display: 'flex', alignItems: 'center', marginBottom: '3px' }}>
                      <span style={{ width: '15px', color: '#00ff00' }}>{axis}:</span>
                      <input
                        type="number"
                        step="0.1"
                        value={sceneContainer.position[axis].toFixed(2)}
                        onChange={(e) => handleModelTransform(sceneContainer, 'position', axis, e.target.value)}
                        style={styles.input}
                      />
                    </div>
                  ))}
                </div>

                {/* Rotation */}
                <div style={{ marginBottom: '8px' }}>
                  <div style={{ color: '#888', marginBottom: '3px', fontSize: '10px' }}>Rotation (radians)</div>
                  {['x', 'y', 'z'].map(axis => (
                    <div key={axis} style={{ display: 'flex', alignItems: 'center', marginBottom: '3px' }}>
                      <span style={{ width: '15px', color: '#00ff00' }}>{axis}:</span>
                      <input
                        type="number"
                        step="0.1"
                        value={sceneContainer.rotation[axis].toFixed(2)}
                        onChange={(e) => handleModelTransform(sceneContainer, 'rotation', axis, e.target.value)}
                        style={styles.input}
                      />
                    </div>
                  ))}
                </div>

                {/* Scale */}
                <div style={{ marginBottom: '8px' }}>
                  <div style={{ color: '#888', marginBottom: '3px', fontSize: '10px' }}>Scale</div>
                  {['x', 'y', 'z'].map(axis => (
                    <div key={axis} style={{ display: 'flex', alignItems: 'center', marginBottom: '3px' }}>
                      <span style={{ width: '15px', color: '#00ff00' }}>{axis}:</span>
                      <input
                        type="number"
                        step="0.1"
                        value={sceneContainer.scale[axis].toFixed(2)}
                        onChange={(e) => handleModelTransform(sceneContainer, 'scale', axis, e.target.value)}
                        style={styles.input}
                      />
                    </div>
                  ))}
                </div>

                <button
                  style={styles.button}
                  onClick={() => {
                    console.log('🎬 Scene Container Transform:', {
                      position: [sceneContainer.position.x, sceneContainer.position.y, sceneContainer.position.z],
                      rotation: [sceneContainer.rotation.x, sceneContainer.rotation.y, sceneContainer.rotation.z],
                      scale: [sceneContainer.scale.x, sceneContainer.scale.y, sceneContainer.scale.z]
                    });
                  }}
                >
                  Copy to Console
                </button>

                <div style={{ marginTop: '10px', padding: '8px', backgroundColor: 'rgba(255, 255, 0, 0.1)', borderRadius: '4px', fontSize: '9px', color: '#ccc' }}>
                  💡 <strong>Tip:</strong> Use this to offset the entire scene if your camera target is at origin [0,0,0] but models are centered elsewhere.
                </div>
              </div>
            )}
          </div>
        )}

        {/* Models Tab */}
        {activeTab === 'models' && (
          <div>
            <div style={{ marginBottom: '10px', fontWeight: 'bold', color: '#ffff00' }}>
              Scene Objects ({modelDetails.length})
            </div>
            {modelDetails.length === 0 ? (
              <div style={{ color: '#ff6666', fontStyle: 'italic' }}>
                No objects in scene yet...
              </div>
            ) : (
              <div>
                {/* Model List */}
                <div style={{ marginBottom: '10px', maxHeight: '150px', overflowY: 'auto' }}>
                  {modelDetails.map((modelInfo, idx) => (
                    <div
                      key={idx}
                      style={{
                        ...styles.modelItem,
                        cursor: 'pointer',
                        backgroundColor: selectedModel === modelInfo.object ? 'rgba(0, 255, 0, 0.2)' : 'rgba(0, 255, 0, 0.05)'
                      }}
                      onClick={() => setSelectedModel(modelInfo.object)}
                    >
                      <div style={{ fontWeight: 'bold', color: '#00ff00', marginBottom: '3px' }}>
                        {modelInfo.name} ({modelInfo.type})
                      </div>
                      <div style={{ fontSize: '10px' }}>
                        <div>Position: {modelInfo.position}</div>
                        <div>Visible: {String(modelInfo.visible)}</div>
                        <div>Children: {modelInfo.children}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Transform Controls */}
                {selectedModel && (
                  <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #00ff00' }}>
                    {/* Hierarchy Diagnostic */}
                    <div style={{
                      padding: '8px',
                      backgroundColor: selectedModel.parent?.type === 'Scene' ? 'rgba(0, 255, 0, 0.1)' : 'rgba(255, 165, 0, 0.2)',
                      borderRadius: '4px',
                      marginBottom: '10px',
                      border: `1px solid ${selectedModel.parent?.type === 'Scene' ? '#00ff00' : '#ffaa00'}`
                    }}>
                      <div style={{ color: '#ffff00', fontSize: '10px', fontWeight: 'bold', marginBottom: '4px' }}>
                        {selectedModel.parent?.type === 'Scene' ? '✓ ROOT OBJECT (saves to DB)' : '⚠️ CHILD OBJECT'}
                      </div>
                      <div style={{ fontSize: '9px', color: '#ccc' }}>
                        <div>Name: "{selectedModel.name || '(empty)'}"</div>
                        <div>Type: {selectedModel.type}</div>
                        <div>Parent: {selectedModel.parent?.type || 'Scene'}</div>
                      </div>
                      {selectedModel.parent?.type !== 'Scene' && (
                        <div style={{ color: '#ffaa00', fontSize: '9px', marginTop: '5px', fontStyle: 'italic' }}>
                          ⚠️ Child object! Look for parent Group in the list to edit root position.
                        </div>
                      )}
                    </div>

                    <div style={{ marginBottom: '10px', fontWeight: 'bold', color: '#ffff00' }}>
                      Transform: {selectedModel.name || 'Selected'}
                    </div>

                    {/* Position */}
                    <div style={{ marginBottom: '8px' }}>
                      <div style={{ color: '#888', marginBottom: '3px', fontSize: '10px' }}>Position</div>
                      {['x', 'y', 'z'].map(axis => (
                        <div key={axis} style={{ display: 'flex', alignItems: 'center', marginBottom: '3px' }}>
                          <span style={{ width: '15px', color: '#00ff00' }}>{axis}:</span>
                          <input
                            type="number"
                            step="0.1"
                            value={selectedModel.position[axis].toFixed(2)}
                            onChange={(e) => handleModelTransform(selectedModel, 'position', axis, e.target.value)}
                            style={styles.input}
                          />
                        </div>
                      ))}
                    </div>

                    {/* Rotation */}
                    <div style={{ marginBottom: '8px' }}>
                      <div style={{ color: '#888', marginBottom: '3px', fontSize: '10px' }}>Rotation (radians)</div>
                      {['x', 'y', 'z'].map(axis => (
                        <div key={axis} style={{ display: 'flex', alignItems: 'center', marginBottom: '3px' }}>
                          <span style={{ width: '15px', color: '#00ff00' }}>{axis}:</span>
                          <input
                            type="number"
                            step="0.1"
                            value={selectedModel.rotation[axis].toFixed(2)}
                            onChange={(e) => handleModelTransform(selectedModel, 'rotation', axis, e.target.value)}
                            style={styles.input}
                          />
                        </div>
                      ))}
                    </div>

                    {/* Scale */}
                    <div style={{ marginBottom: '8px' }}>
                      <div style={{ color: '#888', marginBottom: '3px', fontSize: '10px' }}>Scale</div>
                      {['x', 'y', 'z'].map(axis => (
                        <div key={axis} style={{ display: 'flex', alignItems: 'center', marginBottom: '3px' }}>
                          <span style={{ width: '15px', color: '#00ff00' }}>{axis}:</span>
                          <input
                            type="number"
                            step="0.1"
                            value={selectedModel.scale[axis].toFixed(2)}
                            onChange={(e) => handleModelTransform(selectedModel, 'scale', axis, e.target.value)}
                            style={styles.input}
                          />
                        </div>
                      ))}
                    </div>

                    <button
                      style={styles.button}
                      onClick={() => {
                        console.log('📋 Transform values:', {
                          position: [selectedModel.position.x, selectedModel.position.y, selectedModel.position.z],
                          rotation: [selectedModel.rotation.x, selectedModel.rotation.y, selectedModel.rotation.z],
                          scale: [selectedModel.scale.x, selectedModel.scale.y, selectedModel.scale.z]
                        });
                      }}
                    >
                      Copy to Console
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Annotations Tab */}
        {activeTab === 'annotations' && (
          <div>
            <div style={{ marginBottom: '10px', fontWeight: 'bold', color: '#ffff00' }}>
              Annotations ({annotationManager?.annotations?.length || 0})
            </div>

            {!annotationManager || annotationManager.annotations.length === 0 ? (
              <div style={{ color: '#ff6666', fontStyle: 'italic' }}>
                No annotations in scene yet...
              </div>
            ) : (
              <div>
                {/* Annotation List */}
                <div style={{ marginBottom: '10px', maxHeight: '150px', overflowY: 'auto' }}>
                  {annotationManager.annotations.map((annotation, idx) => (
                    <div
                      key={idx}
                      style={{
                        ...styles.modelItem,
                        cursor: 'pointer',
                        backgroundColor: selectedAnnotation === annotation ? 'rgba(0, 255, 0, 0.2)' : 'rgba(0, 255, 0, 0.05)'
                      }}
                      onClick={() => setSelectedAnnotation(annotation)}
                    >
                      <div style={{ fontWeight: 'bold', color: '#00ff00', marginBottom: '3px' }}>
                        Annotation {idx + 1}
                      </div>
                      <div style={{ fontSize: '10px' }}>
                        <div>Position: [{annotation.group.position.x.toFixed(2)}, {annotation.group.position.y.toFixed(2)}, {annotation.group.position.z.toFixed(2)}]</div>
                        <div>Color: {annotation.colorString}</div>
                        <div>Size: {annotation.size.toFixed(2)}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Position Controls */}
                {selectedAnnotation && (
                  <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #00ff00' }}>
                    <div style={{ marginBottom: '10px', fontWeight: 'bold', color: '#ffff00' }}>
                      Edit Annotation Position
                    </div>

                    {/* Position Sliders */}
                    <div style={{ marginBottom: '8px' }}>
                      {['x', 'y', 'z'].map(axis => (
                        <div key={axis} style={{ marginBottom: '8px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={styles.label}>{axis.toUpperCase()}:</span>
                            <span style={{ color: '#00ff00', fontSize: '10px' }}>
                              {selectedAnnotation.group.position[axis].toFixed(2)}
                            </span>
                          </div>
                          <input
                            type="range"
                            min="-10"
                            max="10"
                            step="0.1"
                            value={selectedAnnotation.group.position[axis]}
                            onChange={(e) => handleAnnotationTransform(selectedAnnotation, axis, e.target.value)}
                            style={{ width: '100%', marginTop: '3px' }}
                          />
                        </div>
                      ))}
                    </div>

                    {/* Fine-tune inputs */}
                    <div style={{ marginTop: '10px' }}>
                      <div style={{ color: '#888', marginBottom: '5px', fontSize: '10px' }}>Fine-tune</div>
                      {['x', 'y', 'z'].map(axis => (
                        <div key={axis} style={{ display: 'flex', alignItems: 'center', marginBottom: '3px' }}>
                          <span style={{ width: '15px', color: '#00ff00' }}>{axis}:</span>
                          <input
                            type="number"
                            step="0.01"
                            value={selectedAnnotation.group.position[axis].toFixed(2)}
                            onChange={(e) => handleAnnotationTransform(selectedAnnotation, axis, e.target.value)}
                            style={styles.input}
                          />
                        </div>
                      ))}
                    </div>

                    <button
                      style={styles.button}
                      onClick={() => {
                        console.log('📍 Annotation position:', [
                          selectedAnnotation.group.position.x,
                          selectedAnnotation.group.position.y,
                          selectedAnnotation.group.position.z
                        ]);
                      }}
                    >
                      Copy to Console
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Ripples Tab */}
        {activeTab === 'ripples' && (
          <div>
            <div style={{ marginBottom: '10px', fontWeight: 'bold', color: '#ffff00' }}>
              Live Ripple Configuration
            </div>
            <div style={{ fontSize: '10px', color: '#888', marginBottom: '10px' }}>
              Changes apply to TitleScreen in real-time!
            </div>

            {/* Ripple Count */}
            <div style={{ ...styles.row, marginBottom: '8px', flexDirection: 'column', alignItems: 'flex-start' }}>
              <span style={styles.label}>Ripple Count (1-5):</span>
              <input
                type="range"
                min="1"
                max="5"
                step="1"
                value={rippleConfig.RIPPLE_COUNT}
                onChange={(e) => handleRippleChange('RIPPLE_COUNT', parseInt(e.target.value))}
                style={{ width: '100%', marginTop: '5px' }}
              />
              <span style={{ color: '#00ff00' }}>{rippleConfig.RIPPLE_COUNT}</span>
            </div>

            {/* Cycle Duration */}
            <div style={{ ...styles.row, marginBottom: '8px', flexDirection: 'column', alignItems: 'flex-start' }}>
              <span style={styles.label}>Cycle Duration (0.5-10s):</span>
              <input
                type="range"
                min="0.5"
                max="10"
                step="0.5"
                value={rippleConfig.RIPPLE_CYCLE_DURATION}
                onChange={(e) => handleRippleChange('RIPPLE_CYCLE_DURATION', parseFloat(e.target.value))}
                style={{ width: '100%', marginTop: '5px' }}
              />
              <span style={{ color: '#00ff00' }}>{rippleConfig.RIPPLE_CYCLE_DURATION}s</span>
            </div>

            {/* Max Scale */}
            <div style={{ ...styles.row, marginBottom: '8px', flexDirection: 'column', alignItems: 'flex-start' }}>
              <span style={styles.label}>Max Scale (1.0-4.0):</span>
              <input
                type="range"
                min="1"
                max="4"
                step="0.1"
                value={rippleConfig.RIPPLE_MAX_SCALE}
                onChange={(e) => handleRippleChange('RIPPLE_MAX_SCALE', parseFloat(e.target.value))}
                style={{ width: '100%', marginTop: '5px' }}
              />
              <span style={{ color: '#00ff00' }}>{rippleConfig.RIPPLE_MAX_SCALE.toFixed(1)}x</span>
            </div>

            {/* Spacing */}
            <div style={{ ...styles.row, marginBottom: '8px', flexDirection: 'column', alignItems: 'flex-start' }}>
              <span style={styles.label}>Spacing (0.1-2.0):</span>
              <input
                type="range"
                min="0.1"
                max="2"
                step="0.1"
                value={rippleConfig.RIPPLE_SPACING}
                onChange={(e) => handleRippleChange('RIPPLE_SPACING', parseFloat(e.target.value))}
                style={{ width: '100%', marginTop: '5px' }}
              />
              <span style={{ color: '#00ff00' }}>{rippleConfig.RIPPLE_SPACING.toFixed(1)}</span>
            </div>

            {/* Wave Group Delay */}
            <div style={{ ...styles.row, marginBottom: '8px', flexDirection: 'column', alignItems: 'flex-start' }}>
              <span style={styles.label}>Wave Group Delay (0-5s):</span>
              <input
                type="range"
                min="0"
                max="5"
                step="0.5"
                value={rippleConfig.WAVE_GROUP_DELAY}
                onChange={(e) => handleRippleChange('WAVE_GROUP_DELAY', parseFloat(e.target.value))}
                style={{ width: '100%', marginTop: '5px' }}
              />
              <span style={{ color: '#00ff00' }}>{rippleConfig.WAVE_GROUP_DELAY}s</span>
            </div>

            {/* Opacity */}
            <div style={{ ...styles.row, marginBottom: '8px', flexDirection: 'column', alignItems: 'flex-start' }}>
              <span style={styles.label}>Base Opacity (0.1-1.0):</span>
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.1"
                value={rippleConfig.RIPPLE_BASE_OPACITY}
                onChange={(e) => handleRippleChange('RIPPLE_BASE_OPACITY', parseFloat(e.target.value))}
                style={{ width: '100%', marginTop: '5px' }}
              />
              <span style={{ color: '#00ff00' }}>{rippleConfig.RIPPLE_BASE_OPACITY.toFixed(1)}</span>
            </div>

            {/* Presets */}
            <div style={{ marginTop: '15px', paddingTop: '10px', borderTop: '1px solid #00ff00' }}>
              <div style={{ marginBottom: '5px', fontWeight: 'bold', color: '#ffff00' }}>
                Quick Presets:
              </div>
              <button style={styles.button} onClick={() => applyPreset('calm')}>
                Calm & Zen
              </button>
              <button style={styles.button} onClick={() => applyPreset('energetic')}>
                Energetic
              </button>
              <button style={styles.button} onClick={() => applyPreset('elegant')}>
                Elegant
              </button>
              <button style={styles.button} onClick={() => applyPreset('pulsing')}>
                Pulsing
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}