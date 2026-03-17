// src/lib/hooks/useExplorerData.js
import { useState, useEffect } from 'react';
import { parseExplorerDataFromDOM } from '../utils/helpers';

/**
 * Custom hook to parse Digital Explorer data from DOM or props
 * Supports both server-side rendered data and direct prop passing
 */
export function useExplorerData(
  propModels,
  propLights,
  propAnnotations,
  propSettings,
  propTitleData,
  propInfoData
) {
  const [explorerData, setExplorerData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const data = parseExplorerDataFromDOM();
    if (data) {
      setExplorerData(data);
      console.log('✨ Explorer data successfully loaded:');
    } else {
      console.warn('No explorer data found, falling back to props');
    }
    setIsLoading(false);
  }, []);

  const models = explorerData?.models || propModels || [];
  const lights = explorerData?.lights || propLights || [];
  const annotations = explorerData?.annotations || propAnnotations || [];
  const settings = explorerData?.settings || propSettings || {};
  const title_data = explorerData?.title_data || propTitleData || null;
  const info_card_data = explorerData?.info_card_data || propInfoData || null;

  return {
    models,
    lights,
    annotations,
    settings,
    title_data,
    info_card_data,
    isLoading
  };
}