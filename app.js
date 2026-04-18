'use strict';

const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.14/model/';

let originalImage  = null;
let faces          = [];
let modelsLoaded   = false;
let drawMode       = false;
let progressTimer  = null;

let dragStart       = null;
let dragStartClient = null;
let dragCurrent     = null;
let isDragging      = false;
const DRAG_MIN_CSS  = 8;

let touchStartPos    = null;
let touchStartClient = null;
let touchStartTime   = 0;
let touchDragCur     = null;
let touchDragging    = false;

const uploadZone    = document.getElementById('upload-zone');
const fileInput     = document.getElementById('file-input');
const statusBar     = document.getElementById('status-bar');
const statusText    = document.getElementById('status-text');
const statusSpinner = document.getElementById('status-spinner');
const progressTrack = document.getElementById('progress-track');
const progressFill  = document.getElementById('progress-fill');
const canvasWrap    = document.getElementById('canvas-wrap');
const canvas        = document.getElementById('canvas');
const ctx           = canvas.getContext('2d');
const actionBar     = document.getElementById('action-bar');
const faceCounter   = document.getElementById('face-counter');
const btnDrawMode   = document.getElementById('btn-draw-mode');

async function init() {
  setupEvents();
  setStatus('Loading face detection model…', true);
  setProgress(0);
  try {
    await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
    modelsLoaded = true;
    setProgress(null);
    setStatus('Ready — upload a photo to get started.', false);
  } catch (err) {
    setProgress(null);
    setStatus('Failed to load model. Check your connection and reload.', false);
    console.error(err);
  }
}

function setupEvents() {
  uploadZone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', e => {
    if (e.target.files[0]) loadImage(e.target.files[0]);
  });
  uploadZone.addEventListener('dragover', e => {
    e.preventDefault();
    uploadZone.classList.add('drag-over');
  });
  uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
  uploadZone.addEventListener('drop', e => {
    e.preventDefault();
    uploadZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) loadImage(file);
  });

  document.getElementById('btn-redetect').addEventListener('click', resetToUpload);
  document.getElementById('btn-blur-all').addEventListener('click', blurAll);
  document.getElementById('btn-download').addEventListener('click', downloadImage);
  btnDrawMode.addEventListener('click', toggleDrawMode);

  canvas.addEventListener('mousedown', onMouseDown);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mouseup',   onMouseUp);
  canvas.addEventListener('mouseleave', () => {
    if (!isDragging) { dragStart = null; dragCurrent = null; }
  });

  canvas.addEventListener('touchstart', onTouchStart, { passive: false });
  canvas.addEventListener('touchmove',  onTouchMove,  { passive: false });
  canvas.addEventListener('touchend',   onTouchEnd,   { passive: true  });
}

async function loadImage(file) {
  if (!modelsLoaded) {
    setStatus('Model still loading, please wait…', true);
    return;
  }

  setStatus('Reading image…', true);
  setProgress(10);

  const url = URL.createObjectURL(file);
  const img  = new Image();

  img.onload = async () => {
    originalImage = img;
    URL.revokeObjectURL(url);

    canvas.width  = img.naturalWidth;
    canvas.height = img.naturalHeight;
    ctx.drawImage(img, 0, 0);

    setProgress(30);
    showCanvas();
    setStatus('Detecting faces…', true);
    animateProgress(30, 88, 3500);

    try {
      const detections = await faceapi.detectAllFaces(
        canvas,
        new faceapi.SsdMobilenetv1Options({ minConfidence: 0.3, maxResults: 100 })
      );

      faces = detections.map(d => ({ box: d.box, blurred: true, manual: false }));

      setProgress(100);
      render();
      updateCounter();

      setTimeout(() => setProgress(null), 700);

      if (faces.length === 0) {
        setStatus('No faces detected. Use Draw to manually blur any area.', false);
      } else {
        setStatus(
          `${faces.length} face${faces.length > 1 ? 's' : ''} detected and blurred.`,
          false
        );
      }
    } catch (err) {
      setProgress(null);
      setStatus('Detection failed. Try another photo.', false);
      console.error(err);
    }
  };

  img.onerror = () => { setProgress(null); setStatus('Could not load image.', false); };
  img.src = url;
}

function setProgress(pct) {
  clearInterval(progressTimer);
  if (pct === null) {
    progressTrack.classList.add('hidden');
    return;
  }
  progressTrack.classList.remove('hidden');
  progressFill.style.width = pct + '%';
}

function animateProgress(from, to, duration) {
  clearInterval(progressTimer);
  progressFill.style.width = from + '%';
  const steps    = 30;
  const interval = duration / steps;
  const step     = (to - from) / steps;
  let current    = from;
  progressTimer  = setInterval(() => {
    current = Math.min(current + step, to);
    progressFill.style.width = current + '%';
    if (current >= to) clearInterval(progressTimer);
  }, interval);
}

function toggleDrawMode() {
  drawMode = !drawMode;
  btnDrawMode.classList.toggle('active', drawMode);
  canvasWrap.style.touchAction = drawMode ? 'none' : 'pan-x pan-y';
}

function render() {
  if (!originalImage) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.filter = 'none';
  ctx.drawImage(originalImage, 0, 0);

  for (const face of faces) {
    if (face.blurred) drawBlur(face.box);
  }

  for (const face of faces) {
    if (!face.blurred) {
      const b = expandBox(face.box, 4);
      ctx.save();
      ctx.strokeStyle = 'rgba(157, 143, 255, 0.75)';
      ctx.lineWidth   = Math.max(2, canvas.width / 500);
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(b.x, b.y, b.width, b.height);
      ctx.restore();
    }
  }
}

function renderWithSelection(sx, sy, ex, ey) {
  render();
  const x = Math.min(sx, ex);
  const y = Math.min(sy, ey);
  const w = Math.abs(ex - sx);
  const h = Math.abs(ey - sy);
  ctx.save();
  ctx.fillStyle   = 'rgba(124, 110, 245, 0.18)';
  ctx.strokeStyle = '#9d8fff';
  ctx.lineWidth   = Math.max(1.5, canvas.width / 600);
  ctx.setLineDash([6, 3]);
  ctx.fillRect(x, y, w, h);
  ctx.strokeRect(x, y, w, h);
  ctx.restore();
}

function commitDrag(sx, sy, ex, ey) {
  const x = Math.min(sx, ex);
  const y = Math.min(sy, ey);
  const w = Math.abs(ex - sx);
  const h = Math.abs(ey - sy);
  if (w > 10 && h > 10) {
    faces.push({ box: { x, y, width: w, height: h }, blurred: true, manual: true });
    render();
    updateCounter();
    setStatus('Blur zone added. Draw more or tap face to toggle.', false);
  }
}

function drawBlur(box) {
  const PAD = 8;
  const { x, y, width, height } = expandBox(box, PAD);

  const PIXEL_SIZE = Math.max(10, Math.round(height / 10));
  const sw = Math.max(1, Math.round(width  / PIXEL_SIZE));
  const sh = Math.max(1, Math.round(height / PIXEL_SIZE));

  const tmp  = document.createElement('canvas');
  tmp.width  = sw;
  tmp.height = sh;
  tmp.getContext('2d').drawImage(originalImage, x, y, width, height, 0, 0, sw, sh);

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(tmp, 0, 0, sw, sh, x, y, width, height);
  ctx.restore();
}

function expandBox(box, pad) {
  const x  = Math.max(0, box.x - pad);
  const y  = Math.max(0, box.y - pad);
  const x2 = Math.min(canvas.width,  box.x + box.width  + pad);
  const y2 = Math.min(canvas.height, box.y + box.height + pad);
  return { x, y, width: x2 - x, height: y2 - y };
}

function canvasCoords(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (clientX - rect.left) * (canvas.width  / rect.width),
    y: (clientY - rect.top)  * (canvas.height / rect.height),
  };
}

function hitFace(px, py) {
  const rect     = canvas.getBoundingClientRect();
  const scale    = canvas.width / rect.width;
  const canvasPad = 28 * scale;
  for (let i = faces.length - 1; i >= 0; i--) {
    const b = expandBox(faces[i].box, canvasPad);
    if (px >= b.x && px <= b.x + b.width && py >= b.y && py <= b.y + b.height) {
      return faces[i];
    }
  }
  return null;
}

function onMouseDown(e) {
  if (!originalImage) return;
  dragStart       = canvasCoords(e.clientX, e.clientY);
  dragStartClient = { x: e.clientX, y: e.clientY };
  dragCurrent     = dragStart;
  isDragging      = false;
}

function onMouseMove(e) {
  if (!originalImage) return;
  const pos = canvasCoords(e.clientX, e.clientY);

  if (dragStartClient) {
    const dx = e.clientX - dragStartClient.x;
    const dy = e.clientY - dragStartClient.y;
    if (Math.sqrt(dx * dx + dy * dy) > DRAG_MIN_CSS) {
      isDragging  = true;
      dragCurrent = pos;
      renderWithSelection(dragStart.x, dragStart.y, pos.x, pos.y);
      canvas.style.cursor = 'crosshair';
      return;
    }
  }
  canvas.style.cursor = hitFace(pos.x, pos.y) ? 'pointer' : 'crosshair';
}

function onMouseUp(e) {
  if (!originalImage) return;
  const pos = canvasCoords(e.clientX, e.clientY);

  if (isDragging && dragStart) {
    commitDrag(dragStart.x, dragStart.y, pos.x, pos.y);
  } else if (dragStart) {
    const face = hitFace(dragStart.x, dragStart.y);
    if (face) {
      face.blurred = !face.blurred;
      render();
      updateCounter();
    }
  }

  isDragging      = false;
  dragStart       = dragCurrent = dragStartClient = null;
}

function onTouchStart(e) {
  if (!originalImage) return;
  if (drawMode) e.preventDefault();
  const t          = e.touches[0];
  touchStartPos    = canvasCoords(t.clientX, t.clientY);
  touchStartClient = { x: t.clientX, y: t.clientY };
  touchDragCur     = { ...touchStartPos };
  touchStartTime   = Date.now();
  touchDragging    = false;
}

function onTouchMove(e) {
  if (!originalImage || !touchStartPos || !drawMode) return;
  e.preventDefault();
  const t      = e.touches[0];
  touchDragCur = canvasCoords(t.clientX, t.clientY);
  const distCSS = Math.hypot(t.clientX - touchStartClient.x, t.clientY - touchStartClient.y);
  if (distCSS > DRAG_MIN_CSS) {
    touchDragging = true;
    renderWithSelection(touchStartPos.x, touchStartPos.y, touchDragCur.x, touchDragCur.y);
  }
}

function onTouchEnd(e) {
  if (!originalImage || !touchStartPos) return;
  const t       = e.changedTouches[0];
  const distCSS = Math.hypot(t.clientX - touchStartClient.x, t.clientY - touchStartClient.y);

  if (drawMode && touchDragging) {
    commitDrag(touchStartPos.x, touchStartPos.y, touchDragCur.x, touchDragCur.y);
  } else if (distCSS < 20 && Date.now() - touchStartTime < 500) {
    const face = hitFace(touchStartPos.x, touchStartPos.y);
    if (face) {
      face.blurred = !face.blurred;
      render();
      updateCounter();
    }
  }

  touchStartPos = touchStartClient = touchDragCur = null;
  touchDragging = false;
}

function blurAll() {
  faces.forEach(f => f.blurred = true);
  render();
  updateCounter();
}

function downloadImage() {
  const a    = document.createElement('a');
  a.href     = canvas.toDataURL('image/png');
  a.download = 'safecety-photo.png';
  a.click();
}

function resetToUpload() {
  originalImage = null;
  faces         = [];
  drawMode      = false;
  fileInput.value = '';
  uploadZone.style.display = '';
  canvasWrap.style.touchAction = 'pan-x pan-y';
  btnDrawMode.classList.remove('active');
  canvasWrap.classList.add('hidden');
  actionBar.classList.add('hidden');
  faceCounter.classList.add('hidden');
  document.getElementById('canvas-hints').classList.add('hidden');
  setProgress(null);
  setStatus('Ready — upload a photo to get started.', false);
}

function showCanvas() {
  uploadZone.style.display = 'none';
  canvasWrap.classList.remove('hidden');
  actionBar.classList.remove('hidden');
  document.getElementById('canvas-hints').classList.remove('hidden');
}

function setStatus(msg, spinning) {
  statusBar.classList.remove('hidden');
  statusText.textContent = msg;
  statusSpinner.classList.toggle('hidden', !spinning);
}

function updateCounter() {
  const total    = faces.length;
  const blurred  = faces.filter(f => f.blurred).length;
  const revealed = total - blurred;

  if (total === 0) { faceCounter.classList.add('hidden'); return; }

  faceCounter.classList.remove('hidden');
  faceCounter.innerHTML =
    `<strong>${blurred}</strong> zone${blurred !== 1 ? 's' : ''} blurred` +
    (revealed > 0 ? ` · <strong>${revealed}</strong> revealed` : '') +
    ` (${total} total)`;
}

init();
