export default (eventData, kioskOnly = false) => {
  if (!eventData) {
    console.warn('No event data sent');
    return false;
  }

  if (window.A17) {
    try {
      window.A17.env = /s-env-([a-z]*)/ig.exec(document.documentElement.className)[1];
    } catch (err) {
      window.A17.env = 'unknown';
    }
  }

  const AIC = window.A17 || {};
  const isKiosk = window.location.search.includes('kiosk') || false;

  if (kioskOnly) {
    if (isKiosk) {
      if (eventData && window.dataLayer) {
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({
          event: "dataLayerPush",
          data: eventData
        });
      }
    }
  } else {
    if (AIC.env !== 'production' && process.env.NODE_ENV !== 'production') {
      console.log('STAGING GA EVENT:', eventData);
    }

    if (eventData && window.dataLayer) {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({
        event: "dataLayerPush",
        data: eventData
      });
    }
  }
};
