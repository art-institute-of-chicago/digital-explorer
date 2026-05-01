import * as THREE from 'three';

/**
 * Convert position/rotation/scale to array format
 * Handles both array [x, y, z] and object {x, y, z} formats
 */
export function toVector3Array(value, defaultValue = [0, 0, 0]) {
  if (value === undefined || value === null) return defaultValue;
  if (typeof value === 'number') return [value, value, value];
  if (Array.isArray(value)) return value;
  if (typeof value === 'object' && 'x' in value) {
    return [value.x || 0, value.y || 0, value.z || 0];
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
      if (typeof parsed === 'number') return [parsed, parsed, parsed];
    } catch(e) {}
  }
  return defaultValue;
}

/**
 * Calculate appropriate min/max distances for orbit controls based on model size
 */
export function calculateControlsDistances(modelOrScene) {
  const box = new THREE.Box3().setFromObject(modelOrScene);
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);

  // minDistance should be at least the model's radius to prevent going inside
  const minDistance = maxDim * 0.6; // 60% of max dimension
  const maxDistance = maxDim * 10; // Allow zooming out 10x the size

  return { minDistance, maxDistance, maxDim, size };
}

/**
 * Parse explorer data from DOM script tag
 * UPDATED: Now explicitly ensures title_data is included
 */
export function parseExplorerDataFromDOM() {
  const scriptTag = document.querySelector('[data-digitalExplorer-contentBundle]');
  if (!scriptTag) {
    console.warn('⚠️ No digitalExplorer contentBundle found in DOM');
    return null;
  }

  try {
    const data = JSON.parse(scriptTag.textContent);
    console.log('📦 Parsed explorer data from DOM:');

    // Return data with explicit title_data field
    // (it's probably already in data, but making it explicit for clarity)
    return {
      ...data,
      title_data: data.title_data || null
    };
  } catch (error) {
    console.error('❌ Failed to parse digitalExplorer data:', error);
    return null;
  }
}