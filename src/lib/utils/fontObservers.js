export default function fontObservers(fonts) {
  if (typeof fonts !== 'object' || !fonts) return false;

  const total = fonts.variants.length;
  let counter = 0;

  const loaded = () => {
    counter++;
    if (counter >= total) {
      const klass = `s-${fonts.name}-loaded`;
      const dE = document.documentElement;
      if (!dE.classList.contains(klass)) {
        dE.classList.add(klass);
        dE.dispatchEvent(new CustomEvent('content:populated', { bubbles: true }));
      }
    }
  };

  if ('fonts' in document) {
    for (let i = 0; i < total; i++) {
      const variant = fonts.variants[i];
      const weight = variant.weight || 'normal';
      const style = variant.style || 'normal';
      const fontString = `${style} ${weight} 1em "${variant.name}"`;
      
      document.fonts.load(fontString).then(loaded).catch(loaded);
    }
  } else {
    // Fallback if document.fonts is not supported
    for (let i = 0; i < total; i++) {
      setTimeout(loaded, 500);
    }
  }
}
