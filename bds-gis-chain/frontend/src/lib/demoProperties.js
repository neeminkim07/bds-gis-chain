import sampleGeoJson from '../../../data/properties.sample.geojson?raw';

export const DEMO_PROPERTIES_STORAGE_KEY = 'bds-gis-chain-properties-demo-v1';
export const DEMO_PROPERTIES_CHANGED = 'bds-demo-properties-changed';

export const initialDemoProperties = JSON.parse(sampleGeoJson).features.map((feature) => ({
  ...feature.properties,
  geometry: feature.geometry,
}));

export function loadDemoProperties() {
  try {
    const stored = window.localStorage.getItem(DEMO_PROPERTIES_STORAGE_KEY);
    if (stored === null) return initialDemoProperties;
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed)
      ? parsed.filter((property) => property && typeof property.code === 'string')
      : initialDemoProperties;
  } catch {
    return initialDemoProperties;
  }
}

export function saveDemoProperties(properties) {
  try {
    window.localStorage.setItem(DEMO_PROPERTIES_STORAGE_KEY, JSON.stringify(properties));
    window.dispatchEvent(new CustomEvent(DEMO_PROPERTIES_CHANGED, { detail: properties }));
    return true;
  } catch {
    return false;
  }
}
