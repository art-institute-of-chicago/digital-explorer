import { TransformControls, Billboard, Html } from '@react-three/drei'
import { useGLTF } from '@react-three/drei'
import { useState, useEffect, useRef } from 'react'

function AnnotationMesh({
  modelPath = '/1964.88_armor_for_man_and_horse.glb',
  scale = 1,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  enableTransformControls = true,
  initialMode = 'translate',
  onModeChange,
  isAnnotation = false,
  annotationColor = '#ff6b6b',
  annotationSize = 0.5,
  annotationIcon = null,
  showLabel = false,
  labelText = '',
  ...props
}) {
  const { scene } = useGLTF(modelPath)
  const [mode, setMode] = useState(initialMode)
  const meshRef = useRef()

  const validSize = typeof annotationSize === 'number' && !isNaN(annotationSize)
    ? annotationSize
    : 0.5

  useEffect(() => {
    if (!enableTransformControls) return

    const handleKeyDown = (e) => {
      let newMode = mode

      switch (e.key) {
        case 'g':
          newMode = 'translate'
          console.log('MODE: Translate')
          break
        case 'r':
          newMode = 'rotate'
          console.log('MODE: Rotate')
          break
        case 's':
          newMode = 'scale'
          console.log('MODE: Scale')
          break
        default:
          return
      }

      setMode(newMode)

      if (onModeChange) {
        onModeChange(newMode)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [mode, enableTransformControls, onModeChange])

  // Render default circle annotation with VALIDATED size
  const renderDefaultAnnotation = () => {
    return (
      <mesh ref={meshRef}>
        <circleGeometry args={[validSize, 32]} />
        <meshBasicMaterial
          color={annotationColor}
          transparent
          opacity={0.9}
          depthTest={true}
          depthWrite={false}
        />
      </mesh>
    )
  }

  const modelElement = isAnnotation ? (
    <>
      <Billboard
        follow={true}
        lockX={false}
        lockY={false}
        lockZ={false}
      >
        {annotationIcon ? (
          <Html
            center
            distanceFactor={1}
            occlude
            zIndexRange={[0, 0]}
            style={{
              pointerEvents: 'none',
              userSelect: 'none'
            }}
          >
            <div style={{
              width: `${validSize * 100}px`,
              height: `${validSize * 100}px`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {typeof annotationIcon === 'string' && annotationIcon.includes('<svg') ? (
                <div
                  dangerouslySetInnerHTML={{ __html: annotationIcon }}
                  style={{
                    width: '100%',
                    height: '100%',
                    filter: `drop-shadow(0 0 4px ${annotationColor})`
                  }}
                />
              ) : (
                <img
                  src={annotationIcon}
                  alt="annotation"
                  style={{
                    width: '100%',
                    height: '100%',
                    filter: `drop-shadow(0 0 4px ${annotationColor})`,
                    objectFit: 'contain'
                  }}
                />
              )}
            </div>
          </Html>
        ) : (
          renderDefaultAnnotation()
        )}

        {showLabel && labelText && (
          <Html
            position={[0, validSize + 0.3, 0]}
            center
            distanceFactor={5}
            occlude
            style={{
              pointerEvents: 'none',
              userSelect: 'none'
            }}
          >
            <div style={{
              background: annotationColor,
              color: 'white',
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '12px',
              fontWeight: 'bold',
              whiteSpace: 'nowrap',
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
            }}>
              {labelText}
            </div>
          </Html>
        )}
      </Billboard>
    </>
  ) : (
    <primitive
      object={scene}
      scale={scale}
      position={position}
      rotation={rotation}
      {...props}
    />
  )

  return enableTransformControls ? (
    <TransformControls mode={mode}>
      <group position={position} rotation={rotation} scale={scale}>
        {modelElement}
      </group>
    </TransformControls>
  ) : (
    <group position={position} rotation={rotation} scale={scale}>
      {modelElement}
    </group>
  )
}

export default AnnotationMesh