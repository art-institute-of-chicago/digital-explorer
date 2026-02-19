import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { toVector3Array } from '../lib/utils/helpers';

export class ModelLoader {
  constructor(scene, parentContainer = null) {
    this.scene = scene;
    this.parentContainer = parentContainer;
    this.gltfLoader = new GLTFLoader();
    this.textureLoader = new THREE.TextureLoader();
  }

  getTarget() {
    return this.parentContainer || this.scene;
  }

  loadModel(modelData, annotationManager) {
    const { modelType, modelUrl, content, children, position, rotation, scale } = modelData;

    const modelPosition = toVector3Array(content?.position || position, [0, 0, 0]);
    const modelRotation = toVector3Array(content?.rotation || rotation, [0, 0, 0]);

    const modelScale = toVector3Array(content?.scale || scale, [1, 1, 1]);

    if (modelType === '2d') {
      return this.load2DSprite(modelUrl, modelPosition, modelRotation, modelScale, children, annotationManager);
    } else {
      return this.load3DModel(modelUrl, modelPosition, modelRotation, modelScale, children, annotationManager);
    }
  }

  load2DSprite(imageUrl, position, rotation, scale, children, annotationManager) {
    return new Promise((resolve, reject) => {
      this.textureLoader.load(
        imageUrl,
        (texture) => {
          const imageWidth = texture.image.width;
          const imageHeight = texture.image.height;
          const aspectRatio = imageWidth / imageHeight;

          const material = new THREE.SpriteMaterial({
            map: texture,
            transparent: true
          });

          const sprite = new THREE.Sprite(material);
          sprite.position.set(position[0], position[1], position[2]);
          sprite.rotation.set(rotation[0], rotation[1], rotation[2]);

          // Apply scale while preserving aspect ratio
          // Assume scale[0] is the desired width
          const desiredWidth = scale[0];
          const calculatedHeight = desiredWidth / aspectRatio;

          sprite.scale.set(
            desiredWidth,
            calculatedHeight,
            scale[2] || 1  // Z-scale is typically 1 for sprites
          );

          this.getTarget().add(sprite);

          if (children) {
            children.forEach(child => {
              if (child.type === 'explorer_annotation') {
                annotationManager.addAnnotation(child, sprite);
              }
            });
          }

          const maxDim = Math.max(desiredWidth, calculatedHeight, scale[2] || 1);
          resolve({ model: sprite, maxDim, is2D: true });
        },
        undefined, // onProgress callback
        (error) => {
          console.error(`❌ Failed to load sprite ${imageUrl}:`, error);
          reject(error);
        }
      );
    });
  }

  load3DModel(modelUrl, position, rotation, scale, children, annotationManager) {
    return new Promise((resolve, reject) => {
      this.gltfLoader.load(
        modelUrl,
        (gltf) => {
          const model = gltf.scene;
          model.position.set(position[0], position[1], position[2]);
          model.rotation.set(rotation[0], rotation[1], rotation[2]);
          model.scale.set(scale[0], scale[1], scale[2]);

          this.getTarget().add(model);

          const box = new THREE.Box3().setFromObject(model);
          const size = box.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z);

          if (children) {
            children.forEach(child => {
              if (child.type === 'explorer_annotation') {
                annotationManager.addAnnotation(child, model);
              }
            });
          }

          resolve({ model, maxDim, is2D: false });
        },
      );
    });
  }

  loadFallbackCube(fallbackUrl, camera, controls, scene) {
    return new Promise((resolve, reject) => {
      this.gltfLoader.load(
        fallbackUrl,
        (gltf) => {
          const model = gltf.scene;

          model.position.set(0, 0, 0);
          this.getTarget().add(model);

          const box = new THREE.Box3().setFromObject(model);
          const size = box.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z);

          controls.minDistance = maxDim * 0.6;
          controls.maxDistance = maxDim * 10;

          const distance = maxDim * 2.5;
          camera.position.set(distance, distance * 0.5, distance);
          camera.lookAt(0, 0, 0);

          controls.target.set(0, 0, 0);
          controls.update();

          resolve({ model, maxDim, is2D: false });
        },
        (progress) => {
          console.log('Loading fallback cube...', (progress.loaded / progress.total * 100).toFixed(2) + '%');
        },
        (error) => {
          console.error('❌ Failed to load fallback cube:', error);
          reject(error);
        }
      );
    });
  }
}