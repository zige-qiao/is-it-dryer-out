// Camera drafts are independent of saved app state. Never clamp an OCR result.
export function validateCameraReadings(temperature, humidity) {
  const tempText = String(temperature ?? '').trim();
  const rhText = String(humidity ?? '').trim();
  const indoorTemp = Number(tempText), indoorRh = Number(rhText);
  const errors = {};
  if (!/^\d+(?:\.\d)?$/.test(tempText) || !Number.isFinite(indoorTemp) || indoorTemp < 10 || indoorTemp > 32) {
    errors.temperature = 'Enter 10–32°C, with at most one decimal place.';
  }
  if (!/^\d+$/.test(rhText) || !Number.isInteger(indoorRh) || indoorRh < 20 || indoorRh > 90) {
    errors.humidity = 'Enter a whole number from 20–90%.';
  }
  return { values: { indoorTemp, indoorRh }, errors, valid: Object.keys(errors).length === 0 };
}

export function parseRecognisedDigits(text, confidence, maxDigits) {
  const cleaned = String(text ?? '').trim();
  return confidence >= 85 && new RegExp(`^\\d{1,${maxDigits}}$`).test(cleaned) ? cleaned : '';
}

export function boundedCrop(crop) {
  const x = Math.max(0, Math.min(.98, Number(crop.x) || 0));
  const y = Math.max(0, Math.min(.98, Number(crop.y) || 0));
  return { x, y, width: Math.max(.02, Math.min(1 - x, Number(crop.width) || .02)), height: Math.max(.02, Math.min(1 - y, Number(crop.height) || .02)) };
}

export function cameraErrorMessage(error, secure = true) {
  if (!secure) return { title: 'A secure connection is needed', message: 'Open this app over HTTPS to use the camera.', help: '' };
  if (error?.name === 'NotAllowedError' || error?.name === 'SecurityError') {
    return { title: 'Camera access is off', message: 'Allow camera access for this page, then try again.', help: 'Check Camera in your browser’s settings for this website. If it is still blocked, check camera permissions for your browser in your device settings.' };
  }
  if (error?.name === 'NotFoundError') return { title: 'Camera not available', message: 'We couldn’t find a camera on this device.', help: 'Check that a camera is connected and enabled, then try again.' };
  return { title: 'Couldn’t start the camera', message: 'The camera may be busy or temporarily unavailable.', help: 'Close other apps or tabs using the camera, then try again.' };
}
