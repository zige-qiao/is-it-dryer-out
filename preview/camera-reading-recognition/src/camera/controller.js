import { boundedCrop, cameraErrorMessage, validateCameraReadings } from './readings.js';
import { createRecognitionService, cropCanvas } from './recognition.js';
import { createCropEditor } from './crop-editor.js';
import { createCaptureControls } from './capture.js';
import { createCameraHelp } from './help.js';
import { createZoomPresets } from './zoom-presets.js';
import { createDeviceSession } from './device-session.js';
import { createStillPhoto } from './still-photo.js';

export function createCameraController({ elements, beforeCamera, saveIndoorReadings, state, render,
  recogniseService, returnFocus, uiPreferences = { autoFlash: true }, openFlashSettings = () => {} } = {}, environment = globalThis) {
  const { document, navigator } = environment;
  const recognition = recogniseService || createRecognitionService(environment);
  let stream = null, track = null, active = false, session = 0, reading = false;
  let crops = { temperature: null, humidity: null, pending: null }, captured = false;
  let gesturing = false, previews = {}, corrections = {}, gestureState = null;
  let statusKind = 'ready';
  let originalPhoto = null;
  const stillPhoto = createStillPhoto(environment);
  const help = createCameraHelp({ button: elements.cameraHelpButton, content: elements.cameraCropHint, dialog: elements.indoorDialog }, document);
  const captureControls = createCaptureControls({ video: elements.cameraVideo, preview: elements.cameraPreview, feed: elements.cameraFeed,
    flash: elements.cameraFlash, zoomControl: elements.cameraZoomControl,
    status: elements.cameraCaptureStatus, capture: elements.cameraCaptureButton,
    onZoomSync: state => zoomPresets.sync(state),
    onError: error => { if (active && !captured) { releaseCamera(); showError(error, true); } },
  }, environment);
  const zoomPresets = createZoomPresets({ buttons: [1, 3, 5].map(value => [value, elements[`cameraZoom${value}`]]),
    onValue: value => devices.setZoom(value) });
  const devices = createDeviceSession({ video: elements.cameraVideo, controls: captureControls, preferences: uiPreferences,
    onStream: value => { stream = value; track = value.getVideoTracks()[0]; }, settingsOpen: () => Boolean(elements.settingsDialog?.open) }, environment);
  function setReviewStatus(kind, text) {
    statusKind = kind; elements.cameraReadStatus.dataset.state = kind;
    elements.cameraReadStatusText.textContent = text;
  }
  const fields = ['temperature', 'humidity'];
  const draft = field => field === 'temperature' ? elements.cameraTempDraft : elements.cameraRhDraft;
  const editor = createCropEditor({ surface: elements.cameraPhotoWrap,
    boxes: { temperature: elements.cameraTempBox, humidity: elements.cameraRhBox, pending: elements.cameraPendingBox },
    onChange: (field, crop) => {
      cancelReading(); elements.cameraReviewPanel.setAttribute('aria-busy', 'false');
      crops[field] = crop; if (field !== 'pending') delete previews[field]; drawCrops();
      elements.cameraAssignment.hidden = true;
      setReviewStatus('info', 'Release to read this box.'); validate();
    },
    onCommit: field => void readRegion(field),
    onGesture: (ongoing, field, cancelled) => {
      gesturing = ongoing;
      if (ongoing) gestureState = { previews: { ...previews }, assignment: elements.cameraAssignment.hidden,
        choices: elements.cameraAssignChoices.hidden, status: elements.cameraReadStatusText.textContent, kind: statusKind };
      else if (cancelled && gestureState) {
        previews = gestureState.previews; elements.cameraAssignment.hidden = gestureState.assignment;
        elements.cameraAssignChoices.hidden = gestureState.choices; setReviewStatus(gestureState.kind, gestureState.status); drawCrops();
      }
      validate();
    },
  }, environment);

  function releaseCamera() {
    stillPhoto.cancel();
    zoomPresets.reset();
    devices.stop();
    stream = null; track = null;
    elements.cameraVideo.srcObject = null;
    elements.cameraFlash.hidden = true;
    elements.cameraFlash.disabled = false;
    elements.cameraFlash.setAttribute('aria-pressed', 'false');
    elements.cameraFlash.setAttribute('aria-label', 'Turn flash on');
  }

  function cancelReading() { session++; recognition.cancel(); reading = false; }

  function clearPhoto() {
    if (originalPhoto) { originalPhoto.width = originalPhoto.height = 0; originalPhoto = null; }
    captured = false;
    crops = { temperature: null, humidity: null, pending: null }; previews = {}; corrections = {}; gestureState = null; gesturing = false; editor.reset();
    elements.cameraAssignment.hidden = true;
    for (const canvas of [elements.cameraPhoto, elements.cameraTempCrop, elements.cameraRhCrop]) {
      canvas.width = 0; canvas.height = 0;
    }
    elements.cameraTempDraft.value = ''; elements.cameraRhDraft.value = '';
  }

  function view(name) {
    help.close(); elements.cameraHelpButton.hidden = name === 'error';
    elements.cameraHelpButton.setAttribute('aria-label', name === 'capture' ? 'Camera help' : 'Reading box help');
    elements.cameraCaptureHint.hidden = name !== 'capture'; elements.cameraReviewHint.hidden = name !== 'review';
    elements.cameraZoomControl.hidden = name !== 'capture';
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
    elements.cameraCaptureStatus.hidden = false;
    if (environment.isSecureContext === false || !navigator?.mediaDevices?.getUserMedia) {
      showError({ name: 'NotFoundError' }, environment.isSecureContext !== false); return;
    }
    try {
      await devices.start();
    } catch (error) {
      if (!active || session !== request) return;
      releaseCamera(); showError(error, true);
    }
  }

  const toggleFlash = () => devices.toggleFlash().catch(() => {});

  function drawCrops() {
    for (const [field, output] of [
      ['temperature', elements.cameraTempCrop],
      ['humidity', elements.cameraRhCrop],
    ]) {
      if (!crops[field]) { output.width = 0; output.height = 0; output.hidden = true; continue; }
      crops[field] = boundedCrop(crops[field]); output.hidden = false;
      const crop = crops[field];
      const preview = previews[field];
      if (preview) {
        output.width = preview.width; output.height = preview.height;
        output.getContext('2d').putImageData(new environment.ImageData(preview.data, preview.width, preview.height), 0, 0);
      } else {
        const canvas = cropCanvas(elements.cameraPhoto, crop, document);
        output.width = canvas.width; output.height = canvas.height; output.getContext('2d').drawImage(canvas, 0, 0);
      }
    }
    editor.update(crops);
  }

  function validate(showErrors = false) {
    const result = validateCameraReadings(elements.cameraTempDraft.value, elements.cameraRhDraft.value);
    elements.cameraConfirmButton.disabled = reading || gesturing || Boolean(crops.pending) || !result.valid;
    for (const [field, input, hint] of [['temperature', elements.cameraTempDraft, elements.cameraTempError], ['humidity', elements.cameraRhDraft, elements.cameraRhError]]) {
      const message = showErrors || input.value ? result.errors[field] || '' : '';
      hint.textContent = message; input.setAttribute('aria-invalid', String(Boolean(message)));
    }
    return result;
  }

  function readStatus(edited = false) {
    const result = validateCameraReadings(elements.cameraTempDraft.value, elements.cameraRhDraft.value);
    const validFields = fields.filter(field => draft(field).value && !result.errors[field]);
    if (crops.pending) setReviewStatus('attention', 'Assign or discard the new box.');
    else if (result.valid) setReviewStatus('ready', edited ? 'Review your changes before confirming.' : 'Review both values.');
    else setReviewStatus('attention', validFields.length === 1 ? `${validFields[0] === 'temperature' ? 'Humidity' : 'Temperature'} needs attention.`
      : fields.some(field => draft(field).value) ? 'Check both values.' : 'No readings found.');
  }

  async function detect() {
    cancelReading(); const request = session; reading = true;
    elements.cameraReviewPanel.setAttribute('aria-busy', 'true');
    setReviewStatus('processing', 'Reading numbers…'); validate();
    try {
      const result = await recognition.locate(originalPhoto || elements.cameraPhoto);
      if (!active || request !== session) return;
      crops = { ...result?.regions, pending: null };
      for (const field of fields) { previews[field] = result?.readings?.[field]?.preview; corrections[field] = result?.readings?.[field]?.correction; }
      drawCrops();
      for (const field of fields) draft(field).value = result?.values?.[field] || '';
      readStatus();
      if (result?.rejectionReason === 'timeout' && !validateCameraReadings(elements.cameraTempDraft.value, elements.cameraRhDraft.value).valid)
        setReviewStatus(fields.some(field => draft(field).value) ? 'attention' : 'error', fields.some(field => draft(field).value)
          ? 'Reading timed out. Check the detected value and enter the missing value.' : 'Reading timed out. Enter values manually.');
    } catch (error) {
      if (active && request === session) setReviewStatus('error', error?.name === 'TimeoutError' ? 'Reading timed out. Enter values manually.' : 'Reading failed. Enter values manually.');
    } finally {
      if (active && request === session) { reading = false; elements.cameraReviewPanel.setAttribute('aria-busy', 'false'); validate(); }
    }
  }

  async function readRegion(field, assigned = null) {
    if (!active || !captured || !crops[field]) return;
    cancelReading(); const request = session; reading = true;
    const expected = field === 'pending' ? assigned : field;
    if (expected) draft(expected).value = '';
    elements.cameraAssignment.hidden = true;
    setReviewStatus('processing', 'Reading box…');
    elements.cameraReviewPanel.setAttribute('aria-busy', 'true'); validate();
    try {
      const result = await recognition.readRegion(originalPhoto || elements.cameraPhoto, crops[field], expected, corrections[expected]?.angle);
      if (!active || session !== request || !result) return;
      if (result.status === 'ambiguous') {
        setReviewStatus('attention', 'Both units found. Make the box smaller.');
        elements.cameraAssignment.hidden = field !== 'pending'; elements.cameraAssignChoices.hidden = true;
      } else if (result.status === 'unassigned') {
        setReviewStatus('attention', 'Which reading is this?');
        elements.cameraAssignment.hidden = false; elements.cameraAssignChoices.hidden = false;
      } else if (result.status === 'contradictory') {
        setReviewStatus('attention', 'Unit doesn’t match. Adjust the box.');
        if (field === 'pending') { elements.cameraAssignment.hidden = false; elements.cameraAssignChoices.hidden = false; }
      } else {
        const identified = expected || result.field;
        if (identified && result.readings?.[identified]) {
          const entry = result.readings[identified];
          crops[identified] = entry.region; previews[identified] = entry.preview; corrections[identified] = entry.correction;
          draft(identified).value = entry.value || '';
          if (field === 'pending') crops.pending = null;
          drawCrops(); readStatus();
          if (assigned) draft(identified).focus();
        }
      }
    } catch (error) {
      if (active && session === request) {
        setReviewStatus('error', error?.name === 'TimeoutError' ? 'Reading timed out. Enter values manually.' : 'Reading failed. Enter values manually.');
        if (field === 'pending') { elements.cameraAssignment.hidden = false; elements.cameraAssignChoices.hidden = false; }
      }
    } finally {
      if (active && session === request) { reading = false; elements.cameraReviewPanel.setAttribute('aria-busy', 'false'); validate(); }
    }
  }

  async function capturePhoto() {
    const video = elements.cameraVideo;
    if (!active || !stream || !video.videoWidth || !video.videoHeight || devices.busy() || !captureControls.isReady()) return;
    const request = session, owner = track, framing = { ...captureControls.snapshot(), fillLightMode: devices.captureMode() };
    captureControls.setCapturing(true);
    try {
      const photo = await stillPhoto.take(owner, framing, () => captureControls.setTorch(false));
      if (!active || request !== session || owner !== track) { photo.width = photo.height = 0; return; }
      originalPhoto = photo;
      const canvas = elements.cameraPhoto, scale = Math.min(1, 1600 / Math.max(photo.width, photo.height));
      canvas.width = Math.max(1, Math.round(photo.width * scale)); canvas.height = Math.max(1, Math.round(photo.height * scale));
      canvas.getContext('2d').drawImage(photo, 0, 0, canvas.width, canvas.height);
      releaseCamera(); captured = true; drawCrops(); view('review'); void detect();
    } catch (error) {
      if (!active || request !== session || owner !== track) return;
      if (error.name === 'TimeoutError' || owner.readyState === 'ended') {
        releaseCamera(); showError({ name: 'NotReadableError' }, true); return;
      }
      try { await stillPhoto.restore(async () => { await captureControls.setTorch(framing.flash); if (active && request === session && owner === track) await video.play(); }); }
      catch { if (active && request === session && owner === track) { releaseCamera(); showError({ name: 'NotReadableError' }, true); } return; }
      if (!active || request !== session || owner !== track) return;
      captureControls.setCapturing(false);
      elements.cameraCaptureStatus.textContent = error.message || 'Photo failed. Try again.';
      elements.cameraCaptureStatus.hidden = false;
    }
  }

  function cancel({ focus = true } = {}) {
    cancelReading(); releaseCamera(); clearPhoto(); active = false;
    elements.cameraPanel.hidden = true; elements.cameraBackButton.hidden = true;
    help.close(); elements.cameraHelpButton.hidden = true;
    elements.indoorDialog.classList.remove('camera-mode');
    elements.cameraTitle.textContent = 'Indoor readings';
    elements.cameraReviewPanel.setAttribute('aria-busy', 'false');
    if (focus && elements.indoorDialog.open) returnFocus();
  }

  function confirm() {
    const result = validate(true);
    if (!active || reading || gesturing || crops.pending || !captured || !result.valid) return;
    Object.assign(state, result.values); saveIndoorReadings('photo'); cancel(); render();
  }

  function initialize() {
    help.initialize();
    elements.cameraAutoFlashSettings?.addEventListener('click', event => { event.preventDefault(); help.close(); openFlashSettings(); });
    zoomPresets.initialize();
    editor.initialize();
    elements.cameraInputButton.addEventListener('click', () => void startCamera());
    elements.cameraBackButton.addEventListener('click', () => cancel());
    elements.cameraManualButton.addEventListener('click', () => cancel());
    elements.cameraRetryButton.addEventListener('click', () => void startCamera());
    elements.cameraCaptureButton.addEventListener('click', capturePhoto);
    elements.cameraFlash.addEventListener('click', () => void toggleFlash());
    elements.cameraRetakeButton.addEventListener('click', () => void startCamera());
    elements.cameraAssignTemp.addEventListener('click', () => void readRegion('pending', 'temperature'));
    elements.cameraAssignRh.addEventListener('click', () => void readRegion('pending', 'humidity'));
    elements.cameraDiscardBox.addEventListener('click', () => { cancelReading(); crops.pending = null; elements.cameraAssignment.hidden = true; elements.cameraReviewPanel.setAttribute('aria-busy', 'false'); drawCrops(); readStatus(); validate(); elements.cameraPhotoWrap.focus({ preventScroll: true }); });
    elements.cameraConfirmButton.addEventListener('click', confirm);
    elements.indoorDialog.addEventListener('close', () => cancel({ focus: false }));
    for (const input of [elements.cameraTempDraft, elements.cameraRhDraft]) {
      input.addEventListener('focus', () => { input.scrollIntoView?.({ block: 'center', behavior: 'smooth' }); });
      input.addEventListener('input', () => {
        if (reading) { cancelReading(); elements.cameraReviewPanel.setAttribute('aria-busy', 'false'); }
        readStatus(true); validate(true);
      });
    }
  }

  return { initialize, startCamera, capturePhoto, toggleFlash, confirm, cancel,
    handleHidden: () => { if (active) cancel({ focus: false }); } };
}
