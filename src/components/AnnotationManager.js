import * as THREE from 'three';
import { toVector3Array } from '../lib/utils/helpers';

/**
 * AnnotationManager - Handles Billboard-style annotations with icons/circles
 * Supports both 2D sprites and custom icons with HTML overlays
 */
export class AnnotationManager {
  constructor(scene, camera, domElement) {
    this.scene = scene;
    this.camera = camera;
    this.domElement = domElement;
    this.annotations = [];
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.isToggling = false;

    this.cameraAnimation = {
      active: false,
      startPosition: new THREE.Vector3(),
      startTarget: new THREE.Vector3(),
      endPosition: new THREE.Vector3(),
      endTarget: new THREE.Vector3(),
      progress: 0,
      duration: 1000,
      startTime: 0,
      controls: null
    };

    const parentContainer = domElement.parentElement || document.body;

    this.overlayContainer = document.createElement('div');
    this.overlayContainer.id = 'annotation-overlays';
    this.overlayContainer.className = 'o-article__body o-blocks';
    this.overlayContainer.style.position = 'absolute';
    this.overlayContainer.style.top = '0';
    this.overlayContainer.style.left = '0';
    this.overlayContainer.style.pointerEvents = 'none';
    this.overlayContainer.style.width = '100%';
    this.overlayContainer.style.height = '100%';
    parentContainer.appendChild(this.overlayContainer);

    this.iconContainer = document.createElement('div');
    this.iconContainer.id = 'annotation-icons';
    this.iconContainer.style.position = 'absolute';
    this.iconContainer.style.top = '0';
    this.iconContainer.style.left = '0';
    this.iconContainer.style.pointerEvents = 'none';
    this.iconContainer.style.width = '100%';
    this.iconContainer.style.height = '100%';
    parentContainer.appendChild(this.iconContainer);

    this.setupEventListeners();
  }

  setControls(controls) {
    this.cameraAnimation.controls = controls;
    console.log('✅ AnnotationManager: Controls reference set');
  }

  animateCamera() {
    if (!this.cameraAnimation.active) return;

    const elapsed = performance.now() - this.cameraAnimation.startTime;
    const progress = Math.min(elapsed / this.cameraAnimation.duration, 1);

    const eased = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;

    this.camera.position.lerpVectors(
        this.cameraAnimation.startPosition,
        this.cameraAnimation.endPosition,
        eased
    );

    if (this.cameraAnimation.controls) {
        this.cameraAnimation.controls.target.lerpVectors(
            this.cameraAnimation.startTarget,
            this.cameraAnimation.endTarget,
            eased
        );
        this.cameraAnimation.controls.update();
    }

    if (progress >= 1) {
        this.cameraAnimation.active = false;
        console.log('🎬 Camera animation complete');
    }
  }

  /**
   * Calculate camera position to move annotation to 15% from top-left
   * Uses inverse projection (unproject) for precise positioning
   */
  calculateAnnotationCameraPosition(annotation) {
    const annotationPos = new THREE.Vector3();
    annotation.group.getWorldPosition(annotationPos);

    const viewDirection = new THREE.Vector3();
    this.camera.getWorldDirection(viewDirection);
    const cameraToAnnotation = annotationPos.clone().sub(this.camera.position);
    const depth = cameraToAnnotation.dot(viewDirection);

    console.log('🎯 Annotation depth:', depth.toFixed(2));

    const targetNDC = new THREE.Vector3(
      -1 + (0.15 * 2),
      1 - (0.15 * 2),
      0
    );

    const annotationNDC = annotationPos.clone().project(this.camera);
    targetNDC.z = annotationNDC.z;

    console.log('📐 NDC Calculation:', {
      annotationNDC: [annotationNDC.x.toFixed(3), annotationNDC.y.toFixed(3), annotationNDC.z.toFixed(3)],
      targetNDC: [targetNDC.x.toFixed(3), targetNDC.y.toFixed(3), targetNDC.z.toFixed(3)]
    });

    const targetWorldPos = targetNDC.clone().unproject(this.camera);

    console.log('🌍 Target world position:', {
      annotation: annotationPos.toArray().map(v => v.toFixed(2)),
      target: targetWorldPos.toArray().map(v => v.toFixed(2))
    });

    const worldOffset = targetWorldPos.clone().sub(annotationPos);
    const newCameraPos = this.camera.position.clone().sub(worldOffset);

    const currentTarget = this.cameraAnimation.controls
      ? this.cameraAnimation.controls.target.clone()
      : annotationPos.clone();

    const newTarget = currentTarget.clone().sub(worldOffset);

    console.log('🎯 Camera Translation (view angle preserved):', {
      fromPos: this.camera.position.toArray().map(v => v.toFixed(2)),
      toPos: newCameraPos.toArray().map(v => v.toFixed(2)),
      fromTarget: currentTarget.toArray().map(v => v.toFixed(2)),
      toTarget: newTarget.toArray().map(v => v.toFixed(2)),
      worldOffset: worldOffset.toArray().map(v => v.toFixed(2))
    });

    return {
      position: newCameraPos,
      target: newTarget
    };
  }

  setupEventListeners() {
    this.domElement.addEventListener('mousemove', (e) => this.onMouseMove(e));
    this.domElement.addEventListener('click', (e) => this.onClick(e));
  }

  onMouseMove(event) {
    const rect = this.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);

    const clickables = this.annotations
      .map(a => a.clickable)
      .filter(c => c !== null);

    const intersects = this.raycaster.intersectObjects(clickables);

    this.annotations.forEach(annotation => {
      if (annotation.circle && annotation.circle.userData.sprite) {
        annotation.circle.userData.targetScale = annotation.size;
      }
      if (annotation.iconElement) {
        annotation.iconElement.style.filter = `drop-shadow(0 0 4px ${annotation.colorString})`;
      }
    });

    if (intersects.length > 0) {
      const annotation = this.annotations.find(a => a.clickable === intersects[0].object);
      if (annotation) {
        if (annotation.circle && annotation.circle.userData.sprite) {
          annotation.circle.userData.targetScale = annotation.size * 1.1;
        }
        if (annotation.iconElement) {
          annotation.iconElement.style.filter = `drop-shadow(0 0 8px ${annotation.colorString})`;
        }
        this.domElement.style.cursor = 'pointer';
      }
    } else {
      this.domElement.style.cursor = 'default';
    }

    this.annotations.forEach(annotation => {
      if (annotation.circle && annotation.circle.userData.sprite) {
        const currentScale = annotation.circle.userData.sprite.scale.x;
        const targetScale = annotation.circle.userData.targetScale || annotation.size;
        const newScale = currentScale + (targetScale - currentScale) * 0.1;
        annotation.circle.userData.sprite.scale.set(newScale, newScale, 1);
      }
    });
  }

  onClick(event) {
    const rect = this.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const clickables = this.annotations
      .map(a => a.clickable)
      .filter(c => c !== null);

    const intersects = this.raycaster.intersectObjects(clickables);

    if (intersects.length > 0) {
      const annotation = this.annotations.find(a => a.clickable === intersects[0].object);
      if (annotation) {
        this.toggleAnnotation(annotation);
      }
    }
  }

  toggleAnnotation(annotation) {
    if (this.isToggling) return;
    this.isToggling = true;

    if (annotation.overlay.style.display === 'block') {
      const allClones = document.querySelectorAll('.annotation-css-clone');
      allClones.forEach(clone => clone.remove());

      annotation.cssClone = null;
      annotation.overlay.style.display = 'none';
      annotation.isActive = false;
      annotation.occlusionState = null;

      if (annotation._circleRemovedFromScene && annotation.circle) {
        annotation.group.add(annotation.circle);
        annotation._circleRemovedFromScene = false;
        console.log(`🟢 CLOSING: Re-added circle to scene`);

        annotation.circle.visible = false;
        if (annotation.circle.userData.sprite) {
          annotation.circle.userData.sprite.visible = false;
        }
      } else if (annotation.circle) {
        annotation.circle.visible = true;
        if (annotation.circle.userData.sprite) {
          annotation.circle.userData.sprite.visible = true;
        }
      }
      if (annotation.circle && annotation.circle.userData.sprite) {
        annotation.circle.userData.sprite.material.opacity = 1.0;
      }
      if (annotation.rippleSprites) {
        annotation.rippleSprites.forEach(ripple => ripple.visible = true);
      }

      if (this.cameraAnimation.controls) {
        this.cameraAnimation.active = true;
        this.cameraAnimation.startTime = performance.now();
        this.cameraAnimation.startPosition.copy(this.camera.position);
        this.cameraAnimation.startTarget.copy(this.cameraAnimation.controls.target);

        if (annotation.userData && annotation.userData.orbitPosition) {
          this.cameraAnimation.endPosition.copy(annotation.userData.orbitPosition);
          this.cameraAnimation.endTarget.copy(annotation.userData.orbitTarget);
        }

        setTimeout(() => {
          if (this.cameraAnimation.controls) {
            this.cameraAnimation.controls.enabled = true;
          }
          this.isToggling = false;
        }, 200);
      } else {
        this.isToggling = false;
      }

    } else {
      console.log(`📊 Total annotations: ${this.annotations.length}`);

      const existingClones = document.querySelectorAll('.annotation-css-clone');
      existingClones.forEach(clone => clone.remove());

      this.annotations.forEach(a => {
        a.cssClone = null;
        a.overlay.style.display = 'none';

        if (a === annotation) return;

        a.isActive = false;
        if (a.circle) {
          a.circle.visible = true;
          if (a.circle.userData.sprite) {
            a.circle.userData.sprite.visible = true;
          }
        }
        if (a.circle && a.circle.userData.sprite) {
          a.circle.userData.sprite.material.opacity = 1.0;
        }
        if (a.rippleSprites) {
          a.rippleSprites.forEach(ripple => ripple.visible = true);
        }
      });

      const annotationId = this.annotations.indexOf(annotation);
      annotation.isActive = true;
      console.log(`🟢 OPENING: Annotation #${annotationId}, Setting isActive = true`);

      if (annotation.circle && annotation.circle.parent) {
        annotation.circle.parent.remove(annotation.circle);
        annotation._circleRemovedFromScene = true;
        console.log(`🟢 OPENING: Annotation #${annotationId}, REMOVED circle from scene`);
      }

      if (annotation.rippleSprites) {
        annotation.rippleSprites.forEach(ripple => ripple.visible = false);
      }

      annotation.occlusionState = null;

      this.createCSSClone(annotation);

      // Initialize A17 behaviors BEFORE showing overlay
      if (annotation.overlay.contentContainer) {
        this.initializeA17Behaviors(annotation.overlay.contentContainer);
      }

      annotation.overlay.style.display = 'block';
      requestAnimationFrame(() => {
        annotation.overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        if (annotation.overlay.contentContainer) {
          annotation.overlay.contentContainer.style.opacity = '1';
        }
      });

      if (this.cameraAnimation.controls) {
        annotation.userData = annotation.userData || {};
        annotation.userData.orbitPosition = this.camera.position.clone();
        annotation.userData.orbitTarget = this.cameraAnimation.controls.target.clone();
      }

      const newCameraData = this.calculateAnnotationCameraPosition(annotation);

      if (this.cameraAnimation.controls) {
        this.cameraAnimation.active = true;
        this.cameraAnimation.startTime = performance.now();
        this.cameraAnimation.startPosition.copy(this.camera.position);
        this.cameraAnimation.startTarget.copy(this.cameraAnimation.controls.target);
        this.cameraAnimation.endPosition.copy(newCameraData.position);
        this.cameraAnimation.endTarget.copy(newCameraData.target);
        this.cameraAnimation.controls.enabled = false;

        setTimeout(() => {
          this.isToggling = false;
        }, 200);
      } else {
        this.isToggling = false;
      }
    }
  }

  createCSSClone(annotation) {
    if (annotation.cssClone && annotation.cssClone.parentNode) {
      annotation.cssClone.remove();
    }
    annotation.cssClone = null;

    const cssClone = document.createElement('div');
    cssClone.className = 'annotation-css-clone';
    cssClone.style.position = 'fixed';
    cssClone.style.top = '15%';
    cssClone.style.left = '15%';
    cssClone.style.width = '48px';
    cssClone.style.height = '48px';
    cssClone.style.transform = 'translate(-50%, -50%) rotate(45deg)';
    cssClone.style.borderRadius = '50%';
    cssClone.style.backgroundColor = annotation.colorString;
    cssClone.style.display = 'flex';
    cssClone.style.alignItems = 'center';
    cssClone.style.justifyContent = 'center';
    cssClone.style.color = 'white';
    cssClone.style.fontSize = '24px';
    cssClone.style.fontWeight = 'bold';
    cssClone.style.zIndex = '25000';
    cssClone.style.pointerEvents = 'auto';
    cssClone.style.cursor = 'pointer';
    cssClone.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.4)';
    cssClone.style.transition = 'transform 0.2s ease-in-out, background-color 0.2s ease-in-out';
    cssClone.innerHTML = '+';

    const colorInt = annotation.baseColor;
    const r = (colorInt >> 16) & 0xFF;
    const g = (colorInt >> 8) & 0xFF;
    const b = colorInt & 0xFF;
    const darkerColor = `rgb(${Math.max(0, r - 30)}, ${Math.max(0, g - 30)}, ${Math.max(0, b - 30)})`;

    cssClone.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleAnnotation(annotation);
    });

    cssClone.addEventListener('mouseenter', () => {
      cssClone.style.backgroundColor = darkerColor;
      cssClone.style.transform = 'translate(-50%, -50%) rotate(45deg) scale(1.1)';
    });
    cssClone.addEventListener('mouseleave', () => {
      cssClone.style.backgroundColor = annotation.colorString;
      cssClone.style.transform = 'translate(-50%, -50%) rotate(45deg) scale(1)';
    });

    document.body.appendChild(cssClone);
    annotation.cssClone = cssClone;
  }

  updateIconPosition(annotation) {
    if (!annotation.iconElement) return;

    const vector = new THREE.Vector3();
    annotation.group.getWorldPosition(vector);
    vector.project(this.camera);

    const x = (vector.x * 0.5 + 0.5) * this.domElement.clientWidth;
    const y = (vector.y * -0.5 + 0.5) * this.domElement.clientHeight;

    annotation.iconElement.style.left = `${x}px`;
    annotation.iconElement.style.top = `${y}px`;
    annotation.iconElement.style.transform = 'translate(-50%, -50%)';
  }

  updatePositions() {
    this.annotations.forEach(annotation => {
      if (annotation.iconElement) {
        this.updateIconPosition(annotation);
      }
    });
  }

  createAnnotationCircle(size, color, sizeAttenuation = true) {
    const container = new THREE.Group();

    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d', { alpha: true });

    ctx.clearRect(0, 0, 128, 128);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    ctx.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
    ctx.beginPath();
    ctx.arc(64, 64, 60, 0, Math.PI * 2);
    ctx.fill();
    const r = (color >> 16) & 0xFF;
    const g = (color >> 8) & 0xFF;
    const b = color & 0xFF;
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    const plusColor = luminance > 0.8 ? '#000000' : '#ffffff';

    ctx.fillStyle = plusColor;
    ctx.fillRect(60, 24, 8, 80);
    ctx.fillRect(24, 60, 80, 8);

    const texture = new THREE.CanvasTexture(canvas);
    texture.generateMipmaps = false;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;

    const spriteMaterial = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      opacity: 1.0,
      depthTest: false,
      depthWrite: false,
      sizeAttenuation: sizeAttenuation
    });

    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(size, size, 1);
    sprite.renderOrder = 1;
    sprite.visible = false;

    container.add(sprite);
    container.visible = false;

    container.userData.sprite = sprite;
    container.userData.baseColor = color;

    return container;
  }

  createRippleSprite(size, color, sizeAttenuation = true) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, 256, 256);

    const colorStr = `#${color.toString(16).padStart(6, '0')}`;
    ctx.strokeStyle = colorStr;
    ctx.lineWidth = 20;
    ctx.beginPath();
    ctx.arc(128, 128, 100, 0, Math.PI * 2);
    ctx.stroke();

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      opacity: 0.8,
      depthTest: false,
      depthWrite: false,
      sizeAttenuation: sizeAttenuation
    });

    const sprite = new THREE.Sprite(material);
    sprite.scale.set(size, size, 1);
    sprite.renderOrder = 0;
    sprite.visible = false;

    sprite.userData.baseScale = size;
    sprite.userData.baseMaterial = material;

    return sprite;
  }

  /**
   * Animate ripple sprites - configuration at top of method
   */
  animateRipples(deltaTime = 0.016) {
    const RIPPLE_CYCLE_DURATION = 3;
    const RIPPLE_MAX_SCALE = 1.75;
    const RIPPLE_SPACING = 0.25;
    const WAVE_GROUP_DELAY = 3;
    const ANNOTATION_CASCADE_DELAY = 0.3;

    const time = performance.now() * 0.001;
    const effectiveCycleDuration = RIPPLE_CYCLE_DURATION + WAVE_GROUP_DELAY;

    this.annotations.forEach((annotation, annotationIndex) => {
      if (!annotation.rippleSprites || annotation.isActive) return;

      if (annotation.occlusionState && annotation.occlusionState.isOccluded) {
        return;
      }

      annotation.rippleSprites.forEach((ripple) => {
        const baseScale = ripple.userData.baseScale;
        const rippleIndex = ripple.userData.rippleIndex;

        const baseTouchingDelay = RIPPLE_CYCLE_DURATION / (RIPPLE_MAX_SCALE - 1);
        const delayBetweenRipples = baseTouchingDelay * RIPPLE_SPACING;
        const rippleDelay = rippleIndex * delayBetweenRipples;

        const cascadeOffset = annotationIndex * ANNOTATION_CASCADE_DELAY;

        const totalTime = time + cascadeOffset + rippleDelay;
        const phase = totalTime % effectiveCycleDuration;

        if (phase < RIPPLE_CYCLE_DURATION) {
          const progress = phase / RIPPLE_CYCLE_DURATION;

          const scale = baseScale * (1 + progress * (RIPPLE_MAX_SCALE - 1));
          ripple.scale.set(scale, scale, 1);

          ripple.userData.baseMaterial.opacity = 0.8 * (1 - progress);

          ripple.visible = true;
        } else {
          ripple.visible = false;
        }
      });
    });
  }

  createIconElement(iconData, size, color) {
    const iconElement = document.createElement('div');
    iconElement.style.position = 'absolute';
    iconElement.style.pointerEvents = 'none';
    iconElement.style.userSelect = 'none';
    iconElement.style.width = `${size * 100}px`;
    iconElement.style.height = `${size * 100}px`;
    iconElement.style.display = 'flex';
    iconElement.style.alignItems = 'center';
    iconElement.style.justifyContent = 'center';
    iconElement.style.filter = `drop-shadow(0 0 4px ${color})`;

    if (typeof iconData === 'string' && iconData.includes('<svg')) {
      const svgContainer = document.createElement('div');
      svgContainer.innerHTML = iconData;
      svgContainer.style.width = '100%';
      svgContainer.style.height = '100%';
      iconElement.appendChild(svgContainer);
    } else if (typeof iconData === 'string') {
      const img = document.createElement('img');
      img.src = iconData;
      img.alt = 'annotation';
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.objectFit = 'contain';
      iconElement.appendChild(img);
    }

    return iconElement;
  }

  createClickablePlane(size) {
    const geometry = new THREE.PlaneGeometry(size * 2, size * 2);
    const material = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide
    });
    const plane = new THREE.Mesh(geometry, material);
    return plane;
  }

  renderAnnotationContent(items) {
    let html = '';
    items.forEach(item => {
      switch (item.type) {
        case 'link':
          html += `<a href="${item.content?.link?.en || '#'}" target="_blank" rel="noopener noreferrer"
            style="color: #4ecdc4; text-decoration: none; display: block; margin-bottom: 0.5rem;">
            ${item.content?.title?.en || 'Link'}
          </a>`;
          break;
        case 'text':
          html += `<p style="margin: 0.5rem 0;">${item.content?.text?.en || item.content?.text || ''}</p>`;
          break;
        case 'image':
          html += `<img src="${item.imageUrl}" alt="${item.content?.alt?.en || 'Annotation image'}"
            style="max-width: 100%; border-radius: 4px;" />`;
          break;
        default:
          if (item.children && item.children.length > 0) {
            html += this.renderAnnotationContent(item.children);
          }
      }
    });
    return html;
  }

  createAnnotationOverlay(annotation) {
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0)';
    overlay.style.transition = 'background-color 0.3s ease-in-out';
    overlay.style.pointerEvents = 'auto';
    overlay.style.display = 'none';
    overlay.style.zIndex = '20000';

    const contentContainer = document.createElement('div');
    contentContainer.style.position = 'absolute';
    contentContainer.style.top = '15%';
    contentContainer.style.left = '15%';
    contentContainer.style.right = '15%';
    contentContainer.style.bottom = '15%';
    contentContainer.style.width = 'auto';
    contentContainer.style.height = 'auto';
    contentContainer.style.maxWidth = 'none';
    contentContainer.style.maxHeight = 'none';
    contentContainer.style.background = 'rgba(0, 0, 0, 0.95)';
    contentContainer.style.color = 'white';
    contentContainer.style.padding = '2rem';
    contentContainer.style.borderRadius = '8px';
    contentContainer.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.5)';
    contentContainer.style.overflowY = 'auto';
    contentContainer.style.pointerEvents = 'auto';
    contentContainer.style.zIndex = '1';
    contentContainer.style.opacity = '0';
    contentContainer.style.transition = 'opacity 0.3s ease-in-out 0.5s';

    contentContainer.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    if (annotation.renderedHtml) {
      contentContainer.innerHTML = annotation.renderedHtml;
    } else if (annotation.children && annotation.children.length > 0) {
      contentContainer.innerHTML = this.renderAnnotationContent(annotation.children);
    }

    overlay.appendChild(contentContainer);

    overlay.contentContainer = contentContainer;

    overlay.backdropClickHandler = (e) => {
      if (e.target === overlay) {
        if (overlay.annotationRef) {
          this.toggleAnnotation(overlay.annotationRef);
        }
      }
    };
    overlay.addEventListener('click', overlay.backdropClickHandler);

    return overlay;
  }

  initializeA17Behaviors(container) {
    // A17 behaviors listen for a custom 'page:updated' event
    // Trigger it so behaviors in the container get initialized
    try {
      const event = new CustomEvent('page:updated', {
        bubbles: true,
        detail: { container: container }
      });
      document.dispatchEvent(event);
      console.log('✅ Triggered page:updated event for A17 behaviors');
    } catch (error) {
      console.warn('⚠️ Failed to trigger page:updated event:', error);
    }
  }

  addAnnotation(annotationData, parentGroup = null) {
    const position = toVector3Array(annotationData.content?.position, [0, 0, 0]);
    const color = annotationData.content?.annotationColor || '#4ecdc4';
    const size = annotationData.content?.annotationSize || 0.5;
    const icon = annotationData.content?.annotationIcon || null;
    const showLabel = annotationData.content?.showLabel || false;
    const labelText = annotationData.content?.labelText || '';
    const sizeAttenuation = annotationData.content?.sizeAttenuation !== false;

    console.log('📍 Adding annotation with sizeAttenuation:', sizeAttenuation);

    const colorInt = parseInt(color.replace('#', '0x'));
    const colorString = color;

    const group = new THREE.Group();
    group.position.set(position[0], position[1], position[2]);

    let circle = null;
    let iconElement = null;
    let rippleSprites = [];
    let clickable = null;

    if (icon) {
      iconElement = this.createIconElement(icon, size, colorString);
      this.iconContainer.appendChild(iconElement);

      clickable = this.createClickablePlane(size);
      group.add(clickable);
    } else {
      circle = this.createAnnotationCircle(size, colorInt, sizeAttenuation);
      group.add(circle);
      clickable = circle.userData.sprite;

      for (let i = 0; i < 3; i++) {
        const ripple = this.createRippleSprite(size, colorInt, sizeAttenuation);
        ripple.userData.rippleIndex = i;
        group.add(ripple);
        rippleSprites.push(ripple);
      }
    }

    let labelElement = null;
    if (showLabel && labelText) {
      labelElement = document.createElement('div');
      labelElement.style.position = 'absolute';
      labelElement.style.background = colorString;
      labelElement.style.color = 'white';
      labelElement.style.padding = '4px 8px';
      labelElement.style.borderRadius = '4px';
      labelElement.style.fontSize = '12px';
      labelElement.style.fontWeight = 'bold';
      labelElement.style.whiteSpace = 'nowrap';
      labelElement.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
      labelElement.style.pointerEvents = 'none';
      labelElement.style.userSelect = 'none';
      labelElement.textContent = labelText;
      this.iconContainer.appendChild(labelElement);
    }

    const overlay = this.createAnnotationOverlay(annotationData);
    this.overlayContainer.appendChild(overlay);

    const parentObject = parentGroup || this.scene;
    parentObject.add(group);

    const annotationObj = {
      group,
      circle,
      iconElement,
      rippleSprites,
      labelElement,
      overlay,
      clickable,
      data: annotationData,
      baseColor: colorInt,
      colorString: colorString,
      size: size,
      isActive: false
    };

    this.annotations.push(annotationObj);

    overlay.annotationRef = annotationObj;

    console.log('📍 Added annotation at:', position);

    if (annotationData.children) {
      annotationData.children.forEach(child => {
        if (child.type === 'explorer_annotation') {
          this.addAnnotation(child, parentObject);
        }
      });
    }
  }

  updateBillboards() {

    this.animateCamera();

    const occlusionRaycaster = new THREE.Raycaster();
    occlusionRaycaster.camera = this.camera;
    occlusionRaycaster.near = 0.01;
    occlusionRaycaster.params.Sprite = { threshold: 0 };

    const cameraPosition = new THREE.Vector3();
    this.camera.getWorldPosition(cameraPosition);

    const sceneObjects = [];
    this.scene.traverse((obj) => {
      if (obj.isMesh) {
        let isAnnotationPart = false;
        obj.traverseAncestors((ancestor) => {
          if (this.annotations.some(a => a.group === ancestor)) {
            isAnnotationPart = true;
          }
        });
        if (!isAnnotationPart) {
          sceneObjects.push(obj);
        }
      }
    });

    this.annotations.forEach(annotation => {
      const annotationId = this.annotations.indexOf(annotation);

      if (annotation.circle) {
        annotation.group.quaternion.copy(this.camera.quaternion);
      }

      if (annotation.isActive) {
        if (annotation._circleRemovedFromScene) {
        } else {
          if (annotation.circle) {
            annotation.circle.visible = false;
            if (annotation.circle.userData.sprite) {
              annotation.circle.userData.sprite.visible = false;
            }
          }
        }
        if (annotation.iconElement) {
          annotation.iconElement.style.display = 'none';
        }
        if (annotation.labelElement) {
          annotation.labelElement.style.display = 'none';
        }
        if (annotation.rippleSprites) {
          annotation.rippleSprites.forEach(ripple => {
            ripple.visible = false;
          });
        }
        return;
      }

      if (!annotation.occlusionState) {
        annotation.occlusionState = {
          isOccluded: false,
          occludedFrames: 0,
          visibleFrames: 0,
          hysteresisThreshold: 3
        };
      }

      const annotationPosition = new THREE.Vector3();
      annotation.group.getWorldPosition(annotationPosition);

      const direction = new THREE.Vector3().subVectors(annotationPosition, cameraPosition);
      const distance = direction.length();
      direction.normalize();

      occlusionRaycaster.set(cameraPosition, direction);
      occlusionRaycaster.far = distance - 0.01;

      const intersects = occlusionRaycaster.intersectObjects(sceneObjects, false);
      const currentlyOccluded = intersects.length > 0;

      if (currentlyOccluded) {
        annotation.occlusionState.occludedFrames++;
        annotation.occlusionState.visibleFrames = 0;
      } else {
        annotation.occlusionState.visibleFrames++;
        annotation.occlusionState.occludedFrames = 0;
      }

      if (annotation.occlusionState.occludedFrames >= annotation.occlusionState.hysteresisThreshold) {
        annotation.occlusionState.isOccluded = true;
      } else if (annotation.occlusionState.visibleFrames >= annotation.occlusionState.hysteresisThreshold) {
        annotation.occlusionState.isOccluded = false;
      }

      const isOccluded = annotation.occlusionState.isOccluded;

      if (annotation.circle) {
        annotation.circle.visible = !isOccluded;
        if (annotation.circle.userData.sprite) {
          annotation.circle.userData.sprite.visible = !isOccluded;
        }
      }
      if (annotation.rippleSprites) {
        annotation.rippleSprites.forEach(ripple => {
          ripple.visible = !isOccluded;
        });
      }

      if (annotation.iconElement) {
        annotation.iconElement.style.display = isOccluded ? 'none' : 'flex';
        if (!isOccluded) {
          this.updateIconPosition(annotation);
        }
      }
      if (annotation.labelElement) {
        annotation.labelElement.style.display = isOccluded ? 'none' : 'block';
        if (!isOccluded) {
          const vector = new THREE.Vector3();
          annotation.group.getWorldPosition(vector);
          vector.project(this.camera);

          const x = (vector.x * 0.5 + 0.5) * this.domElement.clientWidth;
          const y = (vector.y * -0.5 + 0.5) * this.domElement.clientHeight;

          annotation.labelElement.style.left = `${x}px`;
          annotation.labelElement.style.top = `${y - annotation.size * 100 - 20}px`;
          annotation.labelElement.style.transform = 'translate(-50%, 0)';
        }
      }
    });

    this.animateRipples();
  }

  reset() {
    const allClones = document.querySelectorAll('.annotation-css-clone');
    allClones.forEach(clone => clone.remove());

    this.annotations.forEach(annotation => {
      annotation.overlay.style.display = 'none';
      annotation.isActive = false;
      annotation.cssClone = null;

      if (annotation.circle) {
        annotation.circle.visible = true;
        if (annotation.circle.userData.sprite) {
          annotation.circle.userData.sprite.visible = true;
        }
      }
      if (annotation.circle && annotation.circle.userData.sprite) {
        annotation.circle.userData.sprite.material.opacity = 1.0;
      }
      if (annotation.rippleSprites) {
        annotation.rippleSprites.forEach(ripple => ripple.visible = true);
      }
    });
  }

  dispose() {
    this.annotations.forEach(annotation => {
      if (annotation.circle) {
        annotation.circle.traverse((child) => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) child.material.dispose();
        });
      }
      if (annotation.clickable && annotation.clickable !== annotation.circle) {
        if (annotation.clickable.geometry) annotation.clickable.geometry.dispose();
        if (annotation.clickable.material) annotation.clickable.material.dispose();
      }
      if (annotation.iconElement) {
        annotation.iconElement.remove();
      }
      if (annotation.rippleSprites) {
        annotation.rippleSprites.forEach(ripple => {
          if (ripple.material) ripple.material.dispose();
        });
      }
      if (annotation.labelElement) {
        annotation.labelElement.remove();
      }
      annotation.overlay.remove();
    });
    this.overlayContainer.remove();
    this.iconContainer.remove();
  }
}