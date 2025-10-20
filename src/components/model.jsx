import { TransformControls } from '@react-three/drei'
import { useGLTF } from '@react-three/drei'
import { useState, useEffect } from 'react'
import * as THREE from 'three'

function Model({
  modelPath = '',
  scale = 1,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  enableTransformControls = true,
  initialMode = 'translate',
  onModeChange,
  castShadow = false,
  receiveShadow = false,
  enableAntialiasing = true,
  textureEncoding = true,
  maxAnisotropy = 16,
  ...props
}) {
  const { scene } = useGLTF(modelPath)
  const [mode, setMode] = useState(initialMode)

  useEffect(() => {
    scene.traverse((child) => {
      if (child.isMesh) {
        // Enable shadows
        child.castShadow = castShadow
        child.receiveShadow = receiveShadow

        // Enhance material quality
        if (child.material) {
          // Handle both single materials and material arrays
          const materials = Array.isArray(child.material)
            ? child.material
            : [child.material]

          materials.forEach((material) => {
            // Enable proper color encoding
            if (textureEncoding) {
              if (material.map) material.map.colorSpace = THREE.SRGBColorSpace
              if (material.emissiveMap) material.emissiveMap.colorSpace = THREE.SRGBColorSpace
            }

            // Apply anisotropic filtering for SHARP textures at angles
            if (material.map) {
              material.map.anisotropy = maxAnisotropy
              material.map.generateMipmaps = true
              material.map.minFilter = THREE.LinearMipmapLinearFilter
              material.map.magFilter = THREE.LinearFilter
            }

            // Apply to all texture types
            const textureTypes = [
              'normalMap', 'roughnessMap', 'metalnessMap',
              'aoMap', 'emissiveMap', 'bumpMap', 'displacementMap'
            ]

            textureTypes.forEach(texType => {
              if (material[texType]) {
                material[texType].anisotropy = maxAnisotropy
                material[texType].generateMipmaps = true
              }
            })

            // Force material update
            material.needsUpdate = true
          })
        }
      }
    })
  }, [scene, castShadow, receiveShadow, textureEncoding, maxAnisotropy])

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

  const modelElement = (
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
      {modelElement}
    </TransformControls>
  ) : (
    modelElement
  )
}

export default Model