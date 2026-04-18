'use strict';

const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.14/model/';

let originalImage = null;
let faces = [];
let modelsLoaded = false;

let dragStart    = null;
let dragCurrent  = null;
let isDragging   = false;
const DRAG_MIN   = 12;

const uploadZone    = document.getElementById('upload-zone');
const fileInput     = document.getElementById('file-input');
const statusBar     = document.getElementById('status-bar');
const statusText    = document.getElementById('status-text');
const statusSpinner = document.getElementById('status-spinner');
const canvasWrap    = document.getElementById('canvas-wrap');
const canvas        = document.getElementById('canvas');
const ctx           = canvas.getContext('2d');
const actionBar     = document.getElementById('action-bar');
const faceCounter   = document.getElementById('face-counter');

async function init() {
  setupUploadZone();
  setStatus('Loading face detection model…', true);
  try {
    await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
    modelsLoaded = true;
    setStatus('Ready — upload a photo to get started.', false);
  } catch (err) {
    setStatus('Failed to load model. Check your connection and reload.', false);
    console.error(err);
  }
}

function setupUploadZone() {
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

  canvas.addEventListener('mousedown', onMouseDown);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mouseup',   onMouseUp);
  canvas.addEventListener('mouseleave', () => {
    if (!isDragging) { dragStart = null; dragCurrent = null; }
  });

  canvas.addEventListener('touchstart',  e => onMouseDown(touchToMouse(e)), { passive: true });
  canvas.addEventListener('touchmove',   e => onMouseMove(touchToMouse(e)), { passive: true });
  canvas.addEventListener('touchend',    e => onMouseUp(touchToMouse(e)));
}

function touchToMouse(e) {
  const t = e.touches[0] || e.changedTouches[0];
  return { clientX: t.clientX, clientY: t.clientY, preventDefault: () => e.preventDefault() };
}

async function loadImage(file) {
  if (!modelsLoaded) {
    setStatus('Model still loading, please wait…', true);
    return;
  }

  const url = URL.createObjectURL(file);
  const img  = new Image();

  img.onload = async () => {
    originalImage = img;
    URL.revokeObjectURL(url);

    canvas.width  = img.naturalWidth;
    canvas.height = img.naturalHeight;
    ctx.drawImage(img, 0, 0);

    showCanvas();
    setStatus('Detecting faces…', true);

    try {
      const detections = await faceapi.detectAllFaces(
        canvas,
        new faceapi.SsdMobilenetv1Options({ minConfidence: 0.3, maxResults: 100 })
      );

      faces = detections.map(d => ({ box: d.box, blurred: true, manual: false }));

      render();
      updateCounter();

      if (faces.length === 0) {
        setStatus('No faces detected. Drag on the photo to manually blur any area.', false);
      } else {
        setStatus(
          `${faces.length} face${faces.length > 1 ? 's' : ''} detected and blurred. ` +
          `Drag to manually blur missed faces.`,
          false
        );
      }
    } catch (err) {
      setStatus('Detection failed. Try another photo.', false);
      console.error(err);
    }
  };

  img.onerror = () => setStatus('Could not load image.', false);
  img.src = url;
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

function renderWithDrag() {
  render();
  if (!isDragging || !dragStart || !dragCurrent) return;
  const x = Math.min(dragStart.x, dragCurrent.x);
  const y = Math.min(dragStart.y, dragCurrent.y);
  const w = Math.abs(dragCurrent.x - dragStart.x);
  const h = Math.abs(dragCurrent.y - dragStart.y);
  ctx.save();
  ctx.fillStyle   = 'rgba(124, 110, 245, 0.18)';
  ctx.strokeStyle = '#9d8fff';
  ctx.lineWidth   = Math.max(1.5, canvas.width / 600);
  ctx.setLineDash([6, 3]);
  ctx.fillRect(x, y, w, h);
  ctx.strokeRect(x, y, w, h);
  ctx.restore();
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
  const tctx = tmp.getContext('2d');

  tctx.drawImage(originalImage, x, y, width, height, 0, 0, sw, sh);

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

function canvasCoords(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (canvas.width  / rect.width),
    y: (e.clientY - rect.top)  * (canvas.height / rect.height),
  };
}

function hitFace(px, py) {
  for (let i = faces.length - 1; i >= 0; i--) {
    const b = expandBox(faces[i].box, 8);
    if (px >= b.x && px <= b.x + b.width && py >= b.y && py <= b.y + b.height) {
      return faces[i];
    }
  }
  return null;
}

function onMouseDown(e) {
  if (!originalImage) return;
  const pos = canvasCoords(e);
  dragStart   = pos;
  dragCurrent = pos;
  isDragging  = false;
}

function onMouseMove(e) {
  if (!originalImage) return;
  const pos = canvasCoords(e);

  if (dragStart) {
    const dx = pos.x - dragStart.x;
    const dy = pos.y - dragStart.y;
    if (Math.sqrt(dx * dx + dy * dy) > DRAG_MIN) {
      isDragging  = true;
      dragCurrent = pos;
      renderWithDrag();
      canvas.style.cursor = 'crosshair';
      return;
    }
  }

  canvas.style.cursor = hitFace(pos.x, pos.y) ? 'pointer' : 'crosshair';
}

function onMouseUp(e) {
  if (!originalImage) return;
  const pos = canvasCoords(e);

  if (isDragging && dragStart) {
    const x = Math.min(dragStart.x, pos.x);
    const y = Math.min(dragStart.y, pos.y);
    const w = Math.abs(pos.x - dragStart.x);
    const h = Math.abs(pos.y - dragStart.y);

    if (w > 10 && h > 10) {
      faces.push({ box: { x, y, width: w, height: h }, blurred: true, manual: true });
      render();
      updateCounter();
      setStatus('Manual blur zone added. Drag to add more, click to toggle.', false);
    }
  } else if (dragStart) {
    const face = hitFace(dragStart.x, dragStart.y);
    if (face) {
      face.blurred = !face.blurred;
      render();
      updateCounter();
    }
  }

  isDragging  = false;
  dragStart   = null;
  dragCurrent = null;
}

function blurAll() {
  faces.forEach(f => f.blurred = true);
  render();
  updateCounter();
}

function downloadImage() {
  const a      = document.createElement('a');
  a.href       = canvas.toDataURL('image/png');
  a.download   = 'safecety-photo.png';
  a.click();
}

function resetToUpload() {
  originalImage = null;
  faces         = [];
  fileInput.value = '';
  uploadZone.style.display = '';
  canvasWrap.classList.add('hidden');
  actionBar.classList.add('hidden');
  faceCounter.classList.add('hidden');
  document.getElementById('canvas-hints').classList.add('hidden');
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
