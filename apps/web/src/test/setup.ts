import '@testing-library/jest-dom'

// Avoid Cesium/global errors in tests
if (typeof window !== 'undefined') {
  (window as unknown as { CESIUM_BASE_URL?: string }).CESIUM_BASE_URL = '/cesium/'
}
