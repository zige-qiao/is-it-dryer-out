import { boundedCrop, cameraErrorMessage, initialCrops, validateCameraReadings } from './readings.js';
import { createRecognitionService, cropCanvas } from './recognition.js';

export function createCameraController({ elements, beforeCamera, saveIndoorReadings, state, render,
  recogniseService, returnFocus } = {}, environment = globalThis) {
  const { document, navigator } = environment;
  const recognition = recogniseService || createRecognitionService(environment);
  let stream = null, track = null, active = false, session = 0, reading = false, torch = false;
  let crops = initialCrops(), captured = false, torchPending = false;

  function releaseCamera() {
    stream?.getTracks().forEach(track => track.stop());
    stream = null; track = null; torch = false; torchPending = false;
    elements.cameraVideo.srcObject = null;
    elements.cameraFlash.hidden = true;
    elements.cameraFlash.disabled = false;
    elements.cameraFlash.setAttribute('aria-pressed', 'false');
    elements.cameraFlash.setAttribute('aria-label', 'Turn flash on');
  }

  function cancelReading() { session++; recognition.cancel(); reading = false; }

  function clearPhoto() {
    captured = false;
    for (const canvas of [elements.cameraPhoto, elements.cameraTempCrop, elements.cameraRhCrop]) {
      canvas.width = 0; canvas.height = 0;
    }
    elements.cameraTempDraft.value = ''; elements.cameraRhDraft.value = '';
  }

  function view(name) {
    for (const key of ['Capture', 'Review', 'Error']) elements[`camera${key}Panel`].hidden = key.toLowerCase() !== name;
    elements.cameraBackButton.hidden = false;
    elements.cameraCropControls.open = false;
    elements.cameraTitle.textContent = name === 'capture' ? 'Take a photo' : name === 'review' ? 'Check readings' : 'Camera';
    elements.cameraTitle.focus({ preventScroll: true });
  }

  function showError(error, secure) {
    const details = cameraErrorMessage(error, secure);
    view('error'); elements.cameraTitle.textContent = details.title;
    elements.cameraErrorMessage.textContent = details.message;
    elements.cameraErrorHelp.textContent = details.help;
    elements.cameraErrorDetails.hidden = !details.help;
  }

  async function startCamera() {
    cancelReading(); releaseCamera(); clearPhoto(); crops = initialCrops();
    const request = session;
    if (!active) { beforeCamera(); active = true; }
    elements.indoorDialog.classList.add('camera-mode');
    elements.cameraPanel.hidden = false;
    view('capture');
    elements.cameraCaptureButton.disabled = true;
    elements.cameraCaptureStatus.textContent = 'Starting camera…';
    if (environment.isSecureContext === false || !navigator?.mediaDevices?.getUserMedia) {
      showError({ name: 'NotFoundError' }, environment.isSecureContext !== false); return;
    }
    let acquired = null;
    try {
      acquired = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } } });
      if (!active || session !== request) { acquired.getTracks().forEach(track => track.stop()); return; }
      stream = acquired; track = stream.getVideoTracks()[0];
      elements.cameraVideo.srcObject = stream;
      await elements.cameraVideo.play();
      if (!active || session !== request) return;
      elements.cameraFlash.hidden = !track?.getCapabilities?.().torch;
      elements.cameraCaptureStatus.textContent = 'Keep the digits sharp and avoid reflections.';
      // play() can resolve before a frame has dimensions on iOS.
      elements.cameraCaptureButton.disabled = !(elements.cameraVideo.videoWidth && elements.cameraVideo.videoHeight);
    } catch (error) {
      if (!active || session !== request) { acquired?.getTracks().forEach(track => track.stop()); return; }
      releaseCamera(); showError(error, true);
    }
  }

  async function toggleFlash() {
    if (!track || torchPending) return;
    const owner = track, request = session, desired = !torch;
    torchPending = true; elements.cameraFlash.disabled = true;
    try {
      await owner.applyConstraints({ advanced: [{ torch: desired }] });
      if (track !== owner || session !== request) return;
      torch = desired; elements.cameraFlash.setAttribute('aria-pressed', String(torch));
      elements.cameraFlash.setAttribute('aria-label', torch ? 'Turn flash off' : 'Turn flash on');
    } catch {
      if (track === owner && session === request) elements.cameraCaptureStatus.textContent = 'Flash couldn’t change. Try improving the lighting.';
    } finally {
      if (track === owner && session === request) { torchPending = false; elements.cameraFlash.disabled = false; }
    }
  }

  function drawCrops() {
    for (const [field, output, box] of [
      ['temperature', elements.cameraTempCrop, elements.cameraTempBox],
      ['humidity', elements.cameraRhCrop, elements.cameraRhBox],
    ]) {
      crops[field] = boundedCrop(crops[field]);
      const crop = crops[field];
      const canvas = cropCanvas(elements.cameraPhoto, crop, document);
      output.width = canvas.width; output.height = canvas.height;
      output.getContext('2d').drawImage(canvas, 0, 0);
      Object.assign(box.style, { left: `${crop.x * 100}%`, top: `${crop.y * 100}%`, width: `${crop.width * 100}%`, height: `${crop.height * 100}%` });
    }
  }

  function validate(showErrors = false) {
    const result = validateCameraReadings(elements.cameraTempDraft.value, elements.cameraRhDraft.value);
    elements.cameraConfirmButton.disabled = reading || !result.valid;
    for (const [field, input, hint] of [['temperature', elements.cameraTempDraft, elements.cameraTempError], ['humidity', elements.cameraRhDraft, elements.cameraRhError]]) {
      const message = showErrors || input.value ? result.errors[field] || '' : '';
      hint.textContent = message; input.setAttribute('aria-invalid', String(Boolean(message)));
    }
    return result;
  }

  async function recognise() {
    if (!active || !captured) return;
    cancelReading(); const request = session; reading = true;
    elements.cameraTempDraft.value = ''; elements.cameraRhDraft.value = '';
    elements.cameraReviewPanel.setAttribute('aria-busy', 'true');
    validate();
    try {
      const result = await recognition.recognise({ temperature: elements.cameraTempCrop, humidity: elements.cameraRhCrop }, status => {
        if (active && session === request) elements.cameraReadStatus.textContent = status;
      });
      if (!active || session !== request || !result) return;
      elements.cameraTempDraft.value = result.temperature; elements.cameraRhDraft.value = result.humidity;
      elements.cameraReadStatus.textContent = result.temperature && result.humidity
        ? 'Compare both values with the photo before confirming.'
        : result.temperature || result.humidity ? 'One reading couldn’t be read. Enter it below or retake the photo.'
          : 'Couldn’t read the numbers. Enter them below, adjust the crops, or retake the photo.';
    } catch {
      if (!active || session !== request) return;
      elements.cameraReadStatus.textContent = 'Recognition couldn’t finish. Connect once to prepare offline recognition, then try Read again, or enter the values below.';
    } finally {
      if (active && session === request) {
        reading = false; elements.cameraReviewPanel.setAttribute('aria-busy', 'false'); validate(true);
      }
    }
  }

  function capturePhoto() {
    const video = elements.cameraVideo;
    if (!active || !stream || !video.videoWidth || !video.videoHeight) return;
    const rect = video.getBoundingClientRect();
    // Match the visible guide, accounting for object-fit: cover and centred video.
    const scale = Math.max(rect.width / video.videoWidth, rect.height / video.videoHeight);
    const visibleWidth = rect.width / scale, visibleHeight = rect.height / scale;
    const x = (video.videoWidth - visibleWidth) / 2 + visibleWidth * .06;
    const y = (video.videoHeight - visibleHeight) / 2 + visibleHeight * .34;
    const width = visibleWidth * .88, height = visibleHeight * .32;
    const canvas = elements.cameraPhoto;
    const downscale = Math.min(1, 1600 / width);
    canvas.width = Math.round(width * downscale); canvas.height = Math.round(height * downscale);
    canvas.getContext('2d').drawImage(video, x, y, width, height, 0, 0, canvas.width, canvas.height);
    releaseCamera(); captured = true; crops = initialCrops(); drawCrops(); syncSliders();
    view('review'); void recognise();
  }

  function syncSliders() {
    document.querySelectorAll('[data-camera-crop]').forEach(input => {
      const crop = crops[input.dataset.cameraCrop];
      input.value = Math.round(crop[input.dataset.cropAxis] * 100);
    });
  }

  function cancel({ focus = true } = {}) {
    cancelReading(); releaseCamera(); clearPhoto(); active = false;
    elements.cameraPanel.hidden = true; elements.cameraBackButton.hidden = true;
    elements.indoorDialog.classList.remove('camera-mode');
    elements.cameraTitle.textContent = 'Indoor readings';
    elements.cameraReviewPanel.setAttribute('aria-busy', 'false');
    if (focus && elements.indoorDialog.open) returnFocus();
  }

  function confirm() {
    const result = validate(true);
    if (!active || reading || !captured || !result.valid) return;
    Object.assign(state, result.values); saveIndoorReadings('photo'); cancel(); render();
  }

  function initialize() {
    elements.cameraInputButton.addEventListener('click', () => void startCamera());
    elements.cameraBackButton.addEventListener('click', () => cancel());
    elements.cameraManualButton.addEventListener('click', () => cancel());
    elements.cameraRetryButton.addEventListener('click', () => void startCamera());
    elements.cameraCaptureButton.addEventListener('click', capturePhoto);
    elements.cameraFlash.addEventListener('click', () => void toggleFlash());
    elements.cameraRetakeButton.addEventListener('click', () => void startCamera());
    elements.cameraReadAgainButton.addEventListener('click', () => void recognise());
    elements.cameraConfirmButton.addEventListener('click', confirm);
    elements.cameraVideo.addEventListener('loadeddata', () => {
      if (active && stream) elements.cameraCaptureButton.disabled = false;
    });
    elements.indoorDialog.addEventListener('close', () => cancel({ focus: false }));
    for (const input of [elements.cameraTempDraft, elements.cameraRhDraft]) {
      input.addEventListener('input', () => {
        if (reading) { cancelReading(); elements.cameraReviewPanel.setAttribute('aria-busy', 'false'); elements.cameraReadStatus.textContent = 'Compare both values with the photo before confirming.'; }
        validate(true);
      });
    }
    document.querySelectorAll('[data-camera-crop]').forEach(input => input.addEventListener('input', () => {
      cancelReading(); elements.cameraReviewPanel.setAttribute('aria-busy', 'false');
      crops[input.dataset.cameraCrop][input.dataset.cropAxis] = Number(input.value) / 100;
      drawCrops(); syncSliders(); elements.cameraTempDraft.value = ''; elements.cameraRhDraft.value = '';
      elements.cameraReadStatus.textContent = 'Crops changed. Choose Read again or enter the values below.'; validate();
    }));
  }

  return { initialize, startCamera, capturePhoto, toggleFlash, confirm, cancel,
    handleHidden: () => { if (active) cancel({ focus: false }); } };
}
