import { boundedCrop, cameraErrorMessage, validateCameraReadings } from './readings.js';
import { createRecognitionService, cropCanvas } from './recognition.js';
import { createCropEditor } from './crop-editor.js';

export function createCameraController({ elements, beforeCamera, saveIndoorReadings, state, render,
  recogniseService, returnFocus } = {}, environment = globalThis) {
  const { document, navigator } = environment;
  const recognition = recogniseService || createRecognitionService(environment);
  let stream = null, track = null, active = false, session = 0, reading = false, torch = false;
  let crops = { temperature: null, humidity: null }, captured = false, torchPending = false;
  const fields = ['temperature', 'humidity'];
  const draft = field => field === 'temperature' ? elements.cameraTempDraft : elements.cameraRhDraft;
  const editor = createCropEditor({ surface: elements.cameraPhotoWrap,
    boxes: { temperature: elements.cameraTempBox, humidity: elements.cameraRhBox },
    choices: { temperature: elements.cameraSelectTemp, humidity: elements.cameraSelectRh },
    onChange: (field, crop) => {
      cancelReading(); elements.cameraReviewPanel.setAttribute('aria-busy', 'false');
      crops[field] = crop; draft(field).value = ''; drawCrops();
      elements.cameraReadStatus.textContent = 'Release the box to read that region again.'; validate();
    },
    onCommit: field => void recognise([field]),
  });

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
    crops = { temperature: null, humidity: null }; editor.reset();
    for (const canvas of [elements.cameraPhoto, elements.cameraTempCrop, elements.cameraRhCrop]) {
      canvas.width = 0; canvas.height = 0;
    }
    elements.cameraTempDraft.value = ''; elements.cameraRhDraft.value = '';
  }

  function view(name) {
    for (const key of ['Capture', 'Review', 'Error']) elements[`camera${key}Panel`].hidden = key.toLowerCase() !== name;
    elements.cameraBackButton.hidden = false;
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
    cancelReading(); releaseCamera(); clearPhoto();
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
      if (!crops[field]) { output.width = 0; output.height = 0; output.hidden = true; continue; }
      crops[field] = boundedCrop(crops[field]); output.hidden = false;
      const crop = crops[field];
      const canvas = cropCanvas(elements.cameraPhoto, crop, document);
      output.width = canvas.width; output.height = canvas.height;
      output.getContext('2d').drawImage(canvas, 0, 0);
    }
    editor.update(crops);
    elements.cameraReadAgainButton.disabled = !fields.some(field => crops[field]);
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

  function readStatus() {
    const count = fields.filter(field => draft(field).value).length;
    return count === 2 ? 'Check both values against the photo.'
      : count === 1 ? 'One reading needs attention. Draw its box on the photo or enter the value.'
        : 'No readings found. Draw boxes around the numbers, enter the values, or retake the photo.';
  }

  async function detect() {
    cancelReading(); const request = session; reading = true;
    elements.cameraReviewPanel.setAttribute('aria-busy', 'true');
    elements.cameraReadStatus.textContent = 'Finding the current numbers…'; validate();
    try {
      const result = await recognition.locate(elements.cameraPhoto);
      if (!active || request !== session) return;
      crops = result?.regions || { temperature: null, humidity: null };
      drawCrops();
      for (const field of fields) draft(field).value = result?.values?.[field] || '';
      elements.cameraReadStatus.textContent = readStatus();
    } catch {
      if (active && request === session) elements.cameraReadStatus.textContent = 'Couldn’t find the numbers. Draw their boxes on the photo, or enter the values.';
    } finally {
      if (active && request === session) { reading = false; elements.cameraReviewPanel.setAttribute('aria-busy', 'false'); validate(); }
    }
  }

  async function recognise(requestedFields = fields) {
    if (!active || !captured) return;
    const selectedFields = requestedFields.filter(field => crops[field]);
    if (!selectedFields.length) return;
    cancelReading(); const request = session; reading = true;
    for (const field of selectedFields) draft(field).value = '';
    elements.cameraReviewPanel.setAttribute('aria-busy', 'true');
    validate();
    try {
      const result = await recognition.recognise({
        temperature: selectedFields.includes('temperature') ? elements.cameraTempCrop : null,
        humidity: selectedFields.includes('humidity') ? elements.cameraRhCrop : null,
      }, status => {
        if (active && session === request) elements.cameraReadStatus.textContent = status;
      });
      if (!active || session !== request || !result) return;
      for (const field of selectedFields) draft(field).value = result[field] || '';
      elements.cameraReadStatus.textContent = readStatus();
    } catch {
      if (!active || session !== request) return;
      elements.cameraReadStatus.textContent = 'Recognition couldn’t finish. Connect once to prepare offline recognition, then try Read again, or enter the values below.';
    } finally {
      if (active && session === request) {
        reading = false; elements.cameraReviewPanel.setAttribute('aria-busy', 'false'); validate();
      }
    }
  }

  function capturePhoto() {
    const video = elements.cameraVideo;
    if (!active || !stream || !video.videoWidth || !video.videoHeight) return;
    const rect = video.getBoundingClientRect();
    // Keep the complete visible frame so a missed reading can be selected later.
    const scale = Math.max(rect.width / video.videoWidth, rect.height / video.videoHeight);
    const visibleWidth = rect.width / scale, visibleHeight = rect.height / scale;
    const x = (video.videoWidth - visibleWidth) / 2;
    const y = (video.videoHeight - visibleHeight) / 2;
    const width = visibleWidth, height = visibleHeight;
    const canvas = elements.cameraPhoto;
    const downscale = Math.min(1, 1600 / width);
    canvas.width = Math.round(width * downscale); canvas.height = Math.round(height * downscale);
    canvas.getContext('2d').drawImage(video, x, y, width, height, 0, 0, canvas.width, canvas.height);
    releaseCamera(); captured = true; drawCrops();
    view('review'); void detect();
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
    editor.initialize();
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
  }

  return { initialize, startCamera, capturePhoto, toggleFlash, confirm, cancel,
    handleHidden: () => { if (active) cancel({ focus: false }); } };
}
