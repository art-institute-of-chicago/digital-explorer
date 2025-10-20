import { Canvas } from '@react-three/fiber'
import { TransformControls, OrbitControls, Environment,   } from '@react-three/drei'
import * as THREE from 'three'
import './App.css'

import Model from './components/model'
import AnnotationMesh from './components/annotation'

import data from '../data-example.json'

function App() {

  return (
    <div id="canvas-container">
      <Canvas

        shadows

        camera={{ position: [0, 5, -5], rotation: [0, 0, 0] }}

        gl={{
          antialias: true,           // Smooth edges
          toneMapping: THREE.ACESFilmicToneMapping,  // Better color
          toneMappingExposure: 1.2,  // Brightness
          outputColorSpace: THREE.SRGBColorSpace,    // Correct colors
          pixelRatio: Math.min(window.devicePixelRatio, 2)  // Retina support (capped at 2x)
        }}

        scene={{
          background: new THREE.Color('#151515'),
        }}

      >

      <Environment preset="night" />

      <ambientLight intensity={0.4} />

      {/* Key light */}
      <directionalLight
        position={[5, 10, 5]}
        intensity={1.5}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={-0.0001}
      />


      {/* Fill light */}
      <directionalLight
        position={[-3, 8, -3]}
        intensity={1}
      />

      {/* Rim light */}
      <directionalLight
        position={[0, 8, -5]}
        intensity={0.3}
      />

      <OrbitControls
        target={[0, 5, 0]}
        makeDefault
        {...(data.mode === '3d'
          ? { enablePan: false, enableRotate: true }
          : { enablePan: true, enableRotate: false }
        )}
      />

      <AnnotationMesh
        annotationColor = 'red'
        enableTransformControls={false}
        showLabel={true}
        isAnnotation={true}
        annotationSize={0.5}
        position={[1.12, 6, 0]}
      />

      <AnnotationMesh
        fixedScreenSize={false}
        enableTransformControls={false}
        showLabel={true}
        labelText='Marshmallow'
        isAnnotation={true}
        annotationSize={0.001}
        position={[-0.6, 6.3, 0]}
      />

      <Model
        castShadow={true}
        receiveShadow={true}
        scale={4}
        modelPath='/1964.88_armor_for_man_and_horse.glb'
        enableTransformControls={false}
        rotation={[0, -5, 0]}
        position={[-4, 3, 9]}
      />

      <Model
        castShadow={true}
        receiveShadow={true}
        scale={15}
        modelPath='/cup_of_cappuccino.glb'
        enableTransformControls={false}
        position={[0, 5, 0]}
      />

      <Model
        castShadow={true}
        receiveShadow={true}
        position={[-90, 0, 101]}
        scale={15}
        modelPath='7-eleven_2.glb'
        enableTransformControls={false}
      />
      </Canvas>
    </div>
  )
}

export default App