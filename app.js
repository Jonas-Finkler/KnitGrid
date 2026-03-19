// Knitting Pattern Tool - Application
// Organized into logical sections for maintainability

(function() {
  'use strict';

  // ============================================================
  // STATE
  // ============================================================

  const state = {
    grid: [],
    width: 20,
    height: 20,
    colors: ['#FFFFFF', '#000000'],
    selectedColor: 1,
    currentRow: 0,
    mode: 'edit',
    history: [],
    historyIndex: -1,
    parts: [],
    currentPart: 0
  };

  let isPainting = false;
  let cellSize = 20;
  let zoomMode = 'auto';
  let manualZoom = 1.0;
  let darkMode = localStorage.getItem('darkMode') === 'true';
  let readBottomToTop = localStorage.getItem('readBottomToTop') !== 'false'; // default true

  // Touch/pinch state
  let lastPinchDistance = 0;
  let isPinching = false;

  const MIN_CELL_SIZE = 4;
  const MAX_CELL_SIZE = 60;
  const ZOOM_STEP = 0.25;
  const WHEEL_ZOOM_STEP = 0.05;
  const MIN_ZOOM = 0.25;
  const MAX_ZOOM = 4.0;
  const MAX_HISTORY = 50;

  // ============================================================
  // DOM REFERENCES
  // ============================================================

  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  const palette = document.getElementById('palette');
  const selectedInfo = document.getElementById('selected-info');
  const modeIndicator = document.getElementById('mode-indicator');
  const statusRow = document.getElementById('status-row');
  const fileInput = document.getElementById('file-input');
  const partFileInput = document.getElementById('part-file-input');
  const importFileInput = document.getElementById('import-file-input');
  const colorPicker = document.getElementById('color-picker');

  // ============================================================
  // UTILITIES
  // ============================================================

  function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('').toUpperCase();
  }

  function getColorName(hex) {
    const names = {
      '#FFFFFF': 'White', '#000000': 'Black', '#FF0000': 'Red',
      '#00FF00': 'Green', '#0000FF': 'Blue', '#FFFF00': 'Yellow',
      '#FF00FF': 'Magenta', '#00FFFF': 'Cyan'
    };
    return names[hex.toUpperCase()] || hex;
  }

  function medianCut(imageData, numColors) {
    const pixels = [];
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      pixels.push([data[i], data[i + 1], data[i + 2]]);
    }
    if (pixels.length === 0) return [[0, 0, 0]];

    let boxes = [pixels];

    while (boxes.length < numColors) {
      // Find the box with the widest channel range
      let maxRange = -1;
      let maxBoxIndex = 0;
      let splitChannel = 0;

      for (let i = 0; i < boxes.length; i++) {
        const box = boxes[i];
        if (box.length < 2) continue;
        for (let ch = 0; ch < 3; ch++) {
          let min = 255, max = 0;
          for (const px of box) {
            if (px[ch] < min) min = px[ch];
            if (px[ch] > max) max = px[ch];
          }
          const range = max - min;
          if (range > maxRange) {
            maxRange = range;
            maxBoxIndex = i;
            splitChannel = ch;
          }
        }
      }

      if (maxRange <= 0) break;

      const box = boxes[maxBoxIndex];
      box.sort((a, b) => a[splitChannel] - b[splitChannel]);
      const mid = Math.floor(box.length / 2);
      boxes.splice(maxBoxIndex, 1, box.slice(0, mid), box.slice(mid));
    }

    return boxes.map(box => {
      const avg = [0, 0, 0];
      for (const px of box) {
        avg[0] += px[0];
        avg[1] += px[1];
        avg[2] += px[2];
      }
      return [
        Math.round(avg[0] / box.length),
        Math.round(avg[1] / box.length),
        Math.round(avg[2] / box.length)
      ];
    });
  }

  function nearestColorIndex(r, g, b, palette) {
    let bestDist = Infinity;
    let bestIndex = 0;
    for (let i = 0; i < palette.length; i++) {
      const [pr, pg, pb] = palette[i];
      const dist = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2;
      if (dist < bestDist) {
        bestDist = dist;
        bestIndex = i;
      }
    }
    return bestIndex;
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ============================================================
  // STATE HELPERS
  // ============================================================

  function getCurrentPart() {
    return state.parts.length > 0 ? state.parts[state.currentPart] : null;
  }

  function getDisplayGrid() {
    const part = getCurrentPart();
    if (part) {
      return { grid: part.grid, width: part.width, height: part.height, colors: part.colors };
    }
    return { grid: state.grid, width: state.width, height: state.height, colors: state.colors };
  }

  function getViewHeight() {
    if (state.parts.length === 0) return state.height;
    return Math.min(...state.parts.map(p => p.height));
  }

  function initGrid(width, height) {
    state.width = width;
    state.height = height;
    state.grid = [];
    for (let y = 0; y < height; y++) {
      state.grid[y] = new Array(width).fill(0);
    }
    state.currentRow = 0;
    state.history = [];
    state.historyIndex = -1;
    saveToHistory();
  }

  // ============================================================
  // HISTORY (UNDO/REDO)
  // ============================================================

  function saveToHistory() {
    if (state.historyIndex < state.history.length - 1) {
      state.history = state.history.slice(0, state.historyIndex + 1);
    }

    const part = getCurrentPart();
    const gridCopy = part
      ? part.grid.map(row => [...row])
      : state.grid.map(row => [...row]);

    state.history.push({
      grid: gridCopy,
      partIndex: part ? state.currentPart : -1
    });

    if (state.history.length > MAX_HISTORY) {
      state.history.shift();
    }
    state.historyIndex = state.history.length - 1;
  }

  function undo() {
    if (state.historyIndex > 0) {
      state.historyIndex--;
      const entry = state.history[state.historyIndex];
      if (entry.partIndex >= 0 && entry.partIndex < state.parts.length) {
        state.parts[entry.partIndex].grid = entry.grid.map(row => [...row]);
      } else {
        state.grid = entry.grid.map(row => [...row]);
      }
      render();
    }
  }

  function redo() {
    if (state.historyIndex < state.history.length - 1) {
      state.historyIndex++;
      const entry = state.history[state.historyIndex];
      if (entry.partIndex >= 0 && entry.partIndex < state.parts.length) {
        state.parts[entry.partIndex].grid = entry.grid.map(row => [...row]);
      } else {
        state.grid = entry.grid.map(row => [...row]);
      }
      render();
    }
  }

  // ============================================================
  // RENDERING
  // ============================================================

  function updateZoomLabel() {
    const currentZoom = Math.round((cellSize / 20) * 100);
    document.getElementById('zoom-label').textContent = `${currentZoom}%`;
  }

  function scrollToCurrentRow(displayRow) {
    const container = document.querySelector('.canvas-container');
    const containerHeight = container.clientHeight;
    const padding = 20;

    // Row center position within scrollable area
    const rowCenter = padding + displayRow * cellSize + cellSize / 2;

    // Scroll to center the row
    const targetScroll = rowCenter - containerHeight / 2;

    // Clamp to valid scroll range
    const maxScroll = container.scrollHeight - containerHeight;
    container.scrollTop = Math.max(0, Math.min(maxScroll, targetScroll));
  }

  function render(autoScroll = true) {
    const display = getDisplayGrid();
    const container = document.querySelector('.canvas-container');
    const maxWidth = container.clientWidth - 40;
    const maxHeight = container.clientHeight - 40;

    // Calculate cell size based on zoom mode
    if (zoomMode === 'fit') {
      cellSize = Math.max(MIN_CELL_SIZE, Math.min(MAX_CELL_SIZE, Math.floor(maxWidth / display.width)));
    } else if (zoomMode === 'manual') {
      cellSize = Math.max(MIN_CELL_SIZE, Math.min(MAX_CELL_SIZE, Math.round(20 * manualZoom)));
    } else {
      const cellW = Math.floor(maxWidth / display.width);
      const cellH = Math.floor(maxHeight / display.height);
      cellSize = Math.max(MIN_CELL_SIZE, Math.min(MAX_CELL_SIZE, Math.min(cellW, cellH)));
    }

    canvas.width = display.width * cellSize;
    canvas.height = display.height * cellSize;
    updateZoomLabel();

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Determine current row (logical row in knitting order)
    const part = getCurrentPart();
    let logicalRow = state.currentRow;
    if (part && state.mode === 'display') {
      logicalRow = Math.min(part.currentRow, part.height - 1);
      part.currentRow = logicalRow;
    } else {
      const viewHeight = getViewHeight();
      if (state.currentRow >= viewHeight) {
        state.currentRow = viewHeight - 1;
      }
      logicalRow = state.currentRow;
    }

    // Convert to visual row (bottom-to-top if enabled)
    const visualRow = readBottomToTop ? display.height - 1 - logicalRow : logicalRow;

    // Draw cells
    for (let y = 0; y < display.height; y++) {
      for (let x = 0; x < display.width; x++) {
        const colorIndex = display.grid[y]?.[x] ?? 0;
        const color = display.colors[colorIndex] || '#FFFFFF';

        ctx.fillStyle = color;
        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);

        if (state.mode === 'display' && y !== visualRow) {
          ctx.fillStyle = 'rgba(128, 128, 128, 0.6)';
          ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
        }

        ctx.strokeStyle = 'rgba(128, 128, 128, 0.5)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x * cellSize + 0.5, y * cellSize + 0.5, cellSize - 1, cellSize - 1);
      }
    }

    // Highlight current row in display mode
    if (state.mode === 'display') {
      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth = 3;
      ctx.strokeRect(1, visualRow * cellSize + 1, display.width * cellSize - 2, cellSize - 2);
      if (autoScroll) {
        scrollToCurrentRow(visualRow);
      }
    }

    updateUI();
  }

  // ============================================================
  // UI UPDATES
  // ============================================================

  function updateMobileNav() {
    const mobileNav = document.getElementById('mobile-nav');
    const hasParts = state.parts.length > 0;

    // Show mobile nav in display mode
    mobileNav.classList.toggle('visible', state.mode === 'display');
    mobileNav.classList.toggle('no-parts', !hasParts);

    // Toggle body class for CSS adjustments
    document.body.classList.toggle('display-mode', state.mode === 'display');
  }

  function updateUI() {
    // Mode indicator
    modeIndicator.textContent = `Mode: ${state.mode === 'edit' ? 'Edit' : 'Display'}`;
    modeIndicator.classList.toggle('display-mode', state.mode === 'display');

    // Update mobile navigation
    updateMobileNav();

    // Status row
    const part = getCurrentPart();
    if (part) {
      if (state.mode === 'display') {
        statusRow.textContent = `${part.name} (${state.currentPart + 1}/${state.parts.length}): Row ${part.currentRow + 1} of ${part.height}`;
      } else {
        statusRow.textContent = `Editing: ${part.name} (${state.currentPart + 1}/${state.parts.length}) - ${part.width}×${part.height}`;
      }
    } else {
      statusRow.textContent = `Row ${state.currentRow + 1} of ${state.height}`;
    }

    // Selected color
    const colors = part ? part.colors : state.colors;
    selectedInfo.textContent = `Selected: ${getColorName(colors[state.selectedColor])}`;

    // Palette
    renderPalette();

    // Buttons
    const btnDisplay = document.getElementById('btn-display');
    btnDisplay.textContent = state.mode === 'edit' ? 'Display' : 'Edit';
    btnDisplay.classList.toggle('active', state.mode === 'display');
    document.getElementById('btn-parts').classList.toggle('active', state.parts.length > 0);
  }

  function renderPalette() {
    palette.innerHTML = '';
    const part = getCurrentPart();
    const colors = part ? part.colors : state.colors;

    colors.forEach((color, index) => {
      const swatch = document.createElement('div');
      swatch.className = 'color-swatch' + (index === state.selectedColor ? ' selected' : '');
      swatch.style.backgroundColor = color;
      swatch.addEventListener('click', () => {
        state.selectedColor = index;
        updateUI();
      });
      palette.appendChild(swatch);
    });
  }

  function applyDarkMode() {
    document.body.classList.toggle('dark-mode', darkMode);
    document.getElementById('btn-dark-mode').textContent = darkMode ? 'Light' : 'Dark';
    localStorage.setItem('darkMode', darkMode);
  }

  // ============================================================
  // PAINTING
  // ============================================================

  function getCellFromEvent(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.floor((e.clientX - rect.left) / cellSize),
      y: Math.floor((e.clientY - rect.top) / cellSize)
    };
  }

  function paintCell(x, y) {
    const part = getCurrentPart();
    const target = part || { grid: state.grid, width: state.width, height: state.height };

    if (x >= 0 && x < target.width && y >= 0 && y < target.height) {
      if (target.grid[y][x] !== state.selectedColor) {
        target.grid[y][x] = state.selectedColor;
        render();
      }
    }
  }

  // ============================================================
  // FILE I/O
  // ============================================================

  function saveImage() {
    const saveCanvas = document.createElement('canvas');
    saveCanvas.width = state.width;
    saveCanvas.height = state.height;
    const saveCtx = saveCanvas.getContext('2d');

    for (let y = 0; y < state.height; y++) {
      for (let x = 0; x < state.width; x++) {
        saveCtx.fillStyle = state.colors[state.grid[y][x]] || '#FFFFFF';
        saveCtx.fillRect(x, y, 1, 1);
      }
    }

    saveCanvas.toBlob(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'pattern.png';
      a.click();
      URL.revokeObjectURL(url);
    }, 'image/png');
  }

  function loadImageFromFile(file, callback) {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = event => {
      img.onload = () => {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = img.width;
        tempCanvas.height = img.height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(img, 0, 0);

        const imageData = tempCtx.getImageData(0, 0, img.width, img.height);
        const pixels = imageData.data;
        const colorMap = new Map();
        const colors = [];
        const grid = [];

        for (let y = 0; y < img.height; y++) {
          grid[y] = [];
          for (let x = 0; x < img.width; x++) {
            const i = (y * img.width + x) * 4;
            const hex = rgbToHex(pixels[i], pixels[i + 1], pixels[i + 2]);
            if (!colorMap.has(hex)) {
              colorMap.set(hex, colors.length);
              colors.push(hex);
            }
            grid[y][x] = colorMap.get(hex);
          }
        }

        callback({ grid, colors, width: img.width, height: img.height });
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  }

  // ============================================================
  // IMAGE IMPORT
  // ============================================================

  let importImage = null;    // The loaded Image object
  let importScale = 1;       // Scale factor from image coords to canvas display coords
  let importOffsetX = 0;     // Offset to center image in canvas
  let importOffsetY = 0;
  let importCrop = null;     // {x, y, w, h} in image-space coordinates, null = full image
  let importCropping = false;
  let importCropStart = null;
  let importPreviewTimer = null;

  function drawImportOriginal() {
    const canvas = document.getElementById('import-original-preview');
    const ctx = canvas.getContext('2d');
    const img = importImage;
    if (!img) return;

    // Size canvas to fit container while maintaining aspect ratio
    const containerWidth = canvas.parentElement.clientWidth - 2; // border
    const maxH = 250;
    const imgAspect = img.width / img.height;
    let displayW = containerWidth;
    let displayH = displayW / imgAspect;
    if (displayH > maxH) {
      displayH = maxH;
      displayW = displayH * imgAspect;
    }

    canvas.width = displayW;
    canvas.height = displayH;
    importScale = displayW / img.width;
    importOffsetX = 0;
    importOffsetY = 0;

    ctx.drawImage(img, 0, 0, displayW, displayH);

    // Draw crop overlay
    const crop = importCrop || { x: 0, y: 0, w: img.width, h: img.height };
    const cx = crop.x * importScale;
    const cy = crop.y * importScale;
    const cw = crop.w * importScale;
    const ch = crop.h * importScale;

    // Dim outside crop
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    // Top
    ctx.fillRect(0, 0, displayW, cy);
    // Bottom
    ctx.fillRect(0, cy + ch, displayW, displayH - cy - ch);
    // Left
    ctx.fillRect(0, cy, cx, ch);
    // Right
    ctx.fillRect(cx + cw, cy, displayW - cx - cw, ch);

    // Crop border
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(cx, cy, cw, ch);
    ctx.setLineDash([]);
  }

  function updateImportPreview() {
    const img = importImage;
    if (!img) return;

    const targetW = Math.max(4, Math.min(1000, parseInt(document.getElementById('import-width').value) || 40));
    const targetH = Math.max(4, Math.min(1000, parseInt(document.getElementById('import-height').value) || 40));
    const numColors = Math.max(2, Math.min(20, parseInt(document.getElementById('import-colors').value) || 8));

    const crop = importCrop || { x: 0, y: 0, w: img.width, h: img.height };

    // Downscale cropped region to target size
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = targetW;
    tempCanvas.height = targetH;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(img, crop.x, crop.y, crop.w, crop.h, 0, 0, targetW, targetH);

    const imageData = tempCtx.getImageData(0, 0, targetW, targetH);

    // Quantize
    const palette = medianCut(imageData, numColors);

    // Map pixels to palette and build grid
    const data = imageData.data;
    const grid = [];
    for (let y = 0; y < targetH; y++) {
      grid[y] = [];
      for (let x = 0; x < targetW; x++) {
        const i = (y * targetW + x) * 4;
        grid[y][x] = nearestColorIndex(data[i], data[i + 1], data[i + 2], palette);
      }
    }

    const colors = palette.map(([r, g, b]) => rgbToHex(r, g, b));

    // Store for apply
    importResult = { grid, colors, width: targetW, height: targetH };

    // Render result preview
    const previewCanvas = document.getElementById('import-result-preview');
    const containerWidth = previewCanvas.parentElement.clientWidth - 2;
    const maxPH = 250;
    const aspect = targetW / targetH;
    let pw = containerWidth;
    let ph = pw / aspect;
    if (ph > maxPH) {
      ph = maxPH;
      pw = ph * aspect;
    }
    previewCanvas.width = pw;
    previewCanvas.height = ph;
    const pCtx = previewCanvas.getContext('2d');
    const cellW = pw / targetW;
    const cellH = ph / targetH;

    for (let y = 0; y < targetH; y++) {
      for (let x = 0; x < targetW; x++) {
        pCtx.fillStyle = colors[grid[y][x]];
        pCtx.fillRect(x * cellW, y * cellH, Math.ceil(cellW), Math.ceil(cellH));
      }
    }
  }

  let importResult = null;

  function scheduleImportPreview() {
    clearTimeout(importPreviewTimer);
    importPreviewTimer = setTimeout(() => {
      updateImportPreview();
    }, 150);
  }

  function applyImport() {
    if (!importResult) return;
    state.width = importResult.width;
    state.height = importResult.height;
    state.grid = importResult.grid;
    state.colors = importResult.colors;
    state.selectedColor = 0;
    state.currentRow = 0;
    state.mode = 'edit';
    state.history = [];
    state.historyIndex = -1;
    state.parts = [];
    state.currentPart = 0;
    saveToHistory();
    render();
    document.getElementById('modal-import').classList.remove('active');
    importImage = null;
    importResult = null;
    importCrop = null;
  }

  function updateImportHeightFromAspect() {
    if (!importImage) return;
    const lockAspect = document.getElementById('import-lock-aspect').checked;
    if (!lockAspect) return;
    const crop = importCrop || { x: 0, y: 0, w: importImage.width, h: importImage.height };
    const aspect = crop.w / crop.h;
    const width = parseInt(document.getElementById('import-width').value) || 40;
    const height = Math.max(4, Math.min(1000, Math.round(width / aspect)));
    document.getElementById('import-height').value = height;
  }

  // ============================================================
  // PARTS MANAGEMENT
  // ============================================================

  function advanceInDisplayMode() {
    if (state.parts.length > 0) {
      state.currentPart++;
      if (state.currentPart >= state.parts.length) {
        state.currentPart = 0;
        state.parts.forEach(part => {
          part.currentRow = (part.currentRow + 1) % part.height;
        });
      }
    } else {
      state.currentRow = (state.currentRow + 1) % state.height;
    }
    render();
  }

  function renderPartsList() {
    const list = document.getElementById('parts-list');
    if (state.parts.length === 0) {
      list.innerHTML = '<div class="parts-list-empty">No parts loaded. Add the current pattern or load from files.</div>';
      return;
    }

    list.innerHTML = state.parts.map((part, i) => `
      <div class="part-item">
        <span class="part-name">${escapeHtml(part.name)}</span>
        <span class="part-info">${part.width}x${part.height}</span>
        <button data-remove-part="${i}">Remove</button>
      </div>
    `).join('');

    list.querySelectorAll('[data-remove-part]').forEach(btn => {
      btn.addEventListener('click', () => {
        const index = parseInt(btn.dataset.removePart);
        state.parts.splice(index, 1);
        if (state.currentPart >= state.parts.length) {
          state.currentPart = Math.max(0, state.parts.length - 1);
        }
        renderPartsList();
        render();
      });
    });
  }

  // ============================================================
  // EVENT HANDLERS
  // ============================================================

  function initEvents() {
    // Canvas events
    canvas.addEventListener('mousedown', e => {
      if (state.mode !== 'edit') return;
      isPainting = true;
      saveToHistory();
      const { x, y } = getCellFromEvent(e);
      paintCell(x, y);
    });

    canvas.addEventListener('mousemove', e => {
      if (state.mode !== 'edit' || !isPainting) return;
      const { x, y } = getCellFromEvent(e);
      paintCell(x, y);
    });

    canvas.addEventListener('mouseup', () => isPainting = false);
    canvas.addEventListener('mouseleave', () => isPainting = false);

    // Touch events - use passive: false to allow preventDefault
    let touchStartTime = 0;

    canvas.addEventListener('touchstart', e => {
      e.preventDefault();
      touchStartTime = Date.now();

      // Handle pinch-to-zoom (two fingers)
      if (e.touches.length >= 2) {
        isPinching = true;
        isPainting = false;
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        lastPinchDistance = Math.hypot(dx, dy);
        return;
      }

      // Single touch in display mode - will handle tap-to-advance on touchend
      if (state.mode === 'display') {
        return;
      }

      // Single touch in edit mode - paint
      if (state.mode === 'edit') {
        isPainting = true;
        saveToHistory();
        const { x, y } = getCellFromEvent(e.touches[0]);
        paintCell(x, y);
      }
    }, { passive: false });

    canvas.addEventListener('touchmove', e => {
      e.preventDefault();

      // Handle pinch-to-zoom
      if (e.touches.length >= 2) {
        isPinching = true;
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const distance = Math.hypot(dx, dy);

        if (lastPinchDistance > 0) {
          const scale = distance / lastPinchDistance;
          // Capture current zoom before switching to manual mode
          if (zoomMode !== 'manual') {
            manualZoom = cellSize / 20;
            zoomMode = 'manual';
            document.getElementById('btn-zoom-fit').classList.remove('active');
          }
          manualZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, manualZoom * scale));
          render(false);
        }
        lastPinchDistance = distance;
        return;
      }

      // Single touch in edit mode - continue painting
      if (state.mode === 'edit' && isPainting && e.touches.length === 1) {
        const { x, y } = getCellFromEvent(e.touches[0]);
        paintCell(x, y);
      }
    }, { passive: false });

    canvas.addEventListener('touchend', e => {
      e.preventDefault();

      // Reset pinch state when all fingers lifted
      if (e.touches.length === 0) {
        if (isPinching) {
          isPinching = false;
          lastPinchDistance = 0;
          return;
        }

        // Tap-to-advance in display mode (quick tap, not a long press)
        const tapDuration = Date.now() - touchStartTime;
        if (state.mode === 'display' && tapDuration < 300) {
          advanceInDisplayMode();
          return;
        }
      }

      isPainting = false;
    }, { passive: false });

    // Toolbar buttons
    document.getElementById('btn-new').addEventListener('click', () => {
      document.getElementById('modal-new').classList.add('active');
      document.getElementById('new-width').focus();
    });

    document.getElementById('btn-new-cancel').addEventListener('click', () => {
      document.getElementById('modal-new').classList.remove('active');
    });

    document.getElementById('btn-new-confirm').addEventListener('click', () => {
      const width = Math.max(1, Math.min(200, parseInt(document.getElementById('new-width').value) || 20));
      const height = Math.max(1, Math.min(200, parseInt(document.getElementById('new-height').value) || 20));
      initGrid(width, height);
      state.colors = ['#FFFFFF', '#000000'];
      state.selectedColor = 1;
      state.mode = 'edit';
      state.parts = [];
      state.currentPart = 0;
      render();
      document.getElementById('modal-new').classList.remove('active');
    });

    document.getElementById('btn-load').addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', e => {
      const file = e.target.files[0];
      if (file) {
        loadImageFromFile(file, data => {
          state.width = data.width;
          state.height = data.height;
          state.grid = data.grid;
          state.colors = data.colors;
          state.selectedColor = 0;
          state.currentRow = 0;
          state.mode = 'edit';
          state.history = [];
          state.historyIndex = -1;
          state.parts = [];
          state.currentPart = 0;
          saveToHistory();
          render();
        });
      }
      fileInput.value = '';
    });

    document.getElementById('btn-save').addEventListener('click', saveImage);

    document.getElementById('btn-display').addEventListener('click', () => {
      state.mode = state.mode === 'edit' ? 'display' : 'edit';
      render();
    });

    document.getElementById('btn-add-color').addEventListener('click', () => colorPicker.click());

    colorPicker.addEventListener('change', e => {
      const newColor = e.target.value.toUpperCase();
      if (!state.colors.includes(newColor)) {
        state.colors.push(newColor);
        state.selectedColor = state.colors.length - 1;
        updateUI();
      }
    });

    // Zoom controls
    function captureCurrentZoom() {
      if (zoomMode !== 'manual') {
        manualZoom = cellSize / 20;
      }
    }

    function setManualZoom() {
      captureCurrentZoom();
      zoomMode = 'manual';
      document.getElementById('btn-zoom-fit').classList.remove('active');
    }

    document.getElementById('btn-zoom-in').addEventListener('click', () => {
      setManualZoom();
      manualZoom = Math.min(MAX_ZOOM, manualZoom + ZOOM_STEP);
      render();
    });

    document.getElementById('btn-zoom-out').addEventListener('click', () => {
      setManualZoom();
      manualZoom = Math.max(MIN_ZOOM, manualZoom - ZOOM_STEP);
      render();
    });

    // Ctrl+wheel zoom
    document.querySelector('.canvas-container').addEventListener('wheel', (e) => {
      if (e.ctrlKey) {
        e.preventDefault();
        setManualZoom();
        if (e.deltaY < 0) {
          manualZoom = Math.min(MAX_ZOOM, manualZoom + WHEEL_ZOOM_STEP);
        } else {
          manualZoom = Math.max(MIN_ZOOM, manualZoom - WHEEL_ZOOM_STEP);
        }
        render();
      }
    }, { passive: false });

    document.getElementById('btn-zoom-fit').addEventListener('click', () => {
      zoomMode = zoomMode === 'fit' ? 'auto' : 'fit';
      render();
      document.getElementById('btn-zoom-fit').classList.toggle('active', zoomMode === 'fit');
    });

    // Reading direction
    const btnReadDirection = document.getElementById('btn-read-direction');
    btnReadDirection.classList.toggle('active', readBottomToTop);
    btnReadDirection.textContent = readBottomToTop ? 'Bottom-Up' : 'Top-Down';
    btnReadDirection.addEventListener('click', () => {
      // Keep visual position the same, except first row moves to new start
      const part = getCurrentPart();
      if (part) {
        if (part.currentRow !== 0) {
          part.currentRow = part.height - 1 - part.currentRow;
        }
      } else {
        if (state.currentRow !== 0) {
          state.currentRow = state.height - 1 - state.currentRow;
        }
      }
      readBottomToTop = !readBottomToTop;
      localStorage.setItem('readBottomToTop', readBottomToTop);
      btnReadDirection.classList.toggle('active', readBottomToTop);
      btnReadDirection.textContent = readBottomToTop ? 'Bottom-Up' : 'Top-Down';
      render(false);
    });

    // Dark mode
    document.getElementById('btn-dark-mode').addEventListener('click', () => {
      darkMode = !darkMode;
      applyDarkMode();
      render();
    });

    // Parts modal
    document.getElementById('btn-parts').addEventListener('click', () => {
      renderPartsList();
      document.getElementById('modal-parts').classList.add('active');
      document.getElementById('part-name').focus();
    });

    document.getElementById('btn-parts-close').addEventListener('click', () => {
      document.getElementById('modal-parts').classList.remove('active');
    });

    document.getElementById('btn-parts-clear').addEventListener('click', () => {
      state.parts = [];
      state.currentPart = 0;
      renderPartsList();
      render();
    });

    document.getElementById('btn-part-add-current').addEventListener('click', () => {
      const name = document.getElementById('part-name').value.trim() || `Part ${state.parts.length + 1}`;
      state.parts.push({
        name,
        grid: state.grid.map(row => [...row]),
        width: state.width,
        height: state.height,
        colors: [...state.colors],
        currentRow: 0
      });
      state.currentPart = state.parts.length - 1;
      document.getElementById('part-name').value = '';
      renderPartsList();
      render();
    });

    document.getElementById('btn-part-load-file').addEventListener('click', () => partFileInput.click());

    partFileInput.addEventListener('change', e => {
      const file = e.target.files[0];
      if (file) {
        const partName = document.getElementById('part-name').value.trim() || file.name.replace(/\.[^.]+$/, '');
        loadImageFromFile(file, data => {
          state.parts.push({
            name: partName,
            grid: data.grid,
            width: data.width,
            height: data.height,
            colors: data.colors,
            currentRow: 0
          });
          state.currentPart = state.parts.length - 1;
          document.getElementById('part-name').value = '';
          renderPartsList();
          render();
        });
      }
      partFileInput.value = '';
    });

    // Import photo
    document.getElementById('btn-import').addEventListener('click', () => importFileInput.click());

    importFileInput.addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = event => {
        const img = new Image();
        img.onload = () => {
          importImage = img;
          importCrop = null;
          importResult = null;

          // Set initial width/height from aspect ratio
          const aspect = img.width / img.height;
          const initWidth = Math.min(60, img.width);
          document.getElementById('import-width').value = initWidth;
          document.getElementById('import-height').value = Math.max(4, Math.round(initWidth / aspect));
          document.getElementById('import-lock-aspect').checked = true;
          document.getElementById('import-colors').value = 8;

          document.getElementById('modal-import').classList.add('active');

          // Defer drawing to let modal render and get layout dimensions
          requestAnimationFrame(() => {
            drawImportOriginal();
            updateImportPreview();
          });
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
      importFileInput.value = '';
    });

    // Crop interaction on original preview canvas
    const importOrigCanvas = document.getElementById('import-original-preview');

    importOrigCanvas.addEventListener('mousedown', e => {
      if (!importImage) return;
      importCropping = true;
      const rect = importOrigCanvas.getBoundingClientRect();
      const scaleX = importOrigCanvas.width / rect.width;
      const scaleY = importOrigCanvas.height / rect.height;
      const canvasX = (e.clientX - rect.left) * scaleX;
      const canvasY = (e.clientY - rect.top) * scaleY;
      importCropStart = {
        x: canvasX / importScale,
        y: canvasY / importScale
      };
    });

    importOrigCanvas.addEventListener('mousemove', e => {
      if (!importCropping || !importImage) return;
      const rect = importOrigCanvas.getBoundingClientRect();
      const scaleX = importOrigCanvas.width / rect.width;
      const scaleY = importOrigCanvas.height / rect.height;
      const canvasX = (e.clientX - rect.left) * scaleX;
      const canvasY = (e.clientY - rect.top) * scaleY;
      const imgX = canvasX / importScale;
      const imgY = canvasY / importScale;

      const x1 = Math.max(0, Math.min(importCropStart.x, imgX));
      const y1 = Math.max(0, Math.min(importCropStart.y, imgY));
      const x2 = Math.min(importImage.width, Math.max(importCropStart.x, imgX));
      const y2 = Math.min(importImage.height, Math.max(importCropStart.y, imgY));

      if (x2 - x1 > 2 && y2 - y1 > 2) {
        importCrop = { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
        drawImportOriginal();
        updateImportHeightFromAspect();
        scheduleImportPreview();
      }
    });

    importOrigCanvas.addEventListener('mouseup', () => {
      importCropping = false;
    });

    importOrigCanvas.addEventListener('mouseleave', () => {
      importCropping = false;
    });

    // Touch support for crop
    importOrigCanvas.addEventListener('touchstart', e => {
      if (!importImage || e.touches.length !== 1) return;
      e.preventDefault();
      const touch = e.touches[0];
      const rect = importOrigCanvas.getBoundingClientRect();
      const scaleX = importOrigCanvas.width / rect.width;
      const scaleY = importOrigCanvas.height / rect.height;
      const canvasX = (touch.clientX - rect.left) * scaleX;
      const canvasY = (touch.clientY - rect.top) * scaleY;
      importCropping = true;
      importCropStart = {
        x: canvasX / importScale,
        y: canvasY / importScale
      };
    }, { passive: false });

    importOrigCanvas.addEventListener('touchmove', e => {
      if (!importCropping || !importImage || e.touches.length !== 1) return;
      e.preventDefault();
      const touch = e.touches[0];
      const rect = importOrigCanvas.getBoundingClientRect();
      const scaleX = importOrigCanvas.width / rect.width;
      const scaleY = importOrigCanvas.height / rect.height;
      const canvasX = (touch.clientX - rect.left) * scaleX;
      const canvasY = (touch.clientY - rect.top) * scaleY;
      const imgX = canvasX / importScale;
      const imgY = canvasY / importScale;

      const x1 = Math.max(0, Math.min(importCropStart.x, imgX));
      const y1 = Math.max(0, Math.min(importCropStart.y, imgY));
      const x2 = Math.min(importImage.width, Math.max(importCropStart.x, imgX));
      const y2 = Math.min(importImage.height, Math.max(importCropStart.y, imgY));

      if (x2 - x1 > 2 && y2 - y1 > 2) {
        importCrop = { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
        drawImportOriginal();
        updateImportHeightFromAspect();
        scheduleImportPreview();
      }
    }, { passive: false });

    importOrigCanvas.addEventListener('touchend', () => {
      importCropping = false;
    });

    // Import controls
    document.getElementById('import-width').addEventListener('input', () => {
      updateImportHeightFromAspect();
      scheduleImportPreview();
    });

    document.getElementById('import-height').addEventListener('input', () => {
      scheduleImportPreview();
    });

    document.getElementById('import-lock-aspect').addEventListener('change', () => {
      updateImportHeightFromAspect();
      scheduleImportPreview();
    });

    document.getElementById('import-colors').addEventListener('input', scheduleImportPreview);

    document.getElementById('btn-import-apply').addEventListener('click', applyImport);

    document.getElementById('btn-import-cancel').addEventListener('click', () => {
      document.getElementById('modal-import').classList.remove('active');
      importImage = null;
      importResult = null;
      importCrop = null;
    });

    // Mobile navigation buttons
    document.getElementById('btn-prev-row').addEventListener('click', () => {
      if (state.mode !== 'display') return;
      const part = getCurrentPart();
      const height = part ? part.height : state.height;
      if (part) {
        part.currentRow = (part.currentRow - 1 + height) % height;
      } else {
        state.currentRow = (state.currentRow - 1 + height) % height;
      }
      render();
    });

    document.getElementById('btn-next-row').addEventListener('click', () => {
      if (state.mode !== 'display') return;
      const part = getCurrentPart();
      const height = part ? part.height : state.height;
      if (part) {
        part.currentRow = (part.currentRow + 1) % height;
      } else {
        state.currentRow = (state.currentRow + 1) % height;
      }
      render();
    });

    document.getElementById('btn-prev-part').addEventListener('click', () => {
      if (state.mode !== 'display' || state.parts.length === 0) return;
      state.currentPart = (state.currentPart - 1 + state.parts.length) % state.parts.length;
      render();
    });

    document.getElementById('btn-next-part').addEventListener('click', () => {
      if (state.mode !== 'display' || state.parts.length === 0) return;
      state.currentPart = (state.currentPart + 1) % state.parts.length;
      render();
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', e => {
      // Modal handling
      if (document.getElementById('modal-new').classList.contains('active')) {
        if (e.key === 'Escape') {
          document.getElementById('modal-new').classList.remove('active');
        } else if (e.key === 'Enter' && document.activeElement.tagName !== 'INPUT') {
          document.getElementById('btn-new-confirm').click();
        }
        return;
      }

      if (document.getElementById('modal-parts').classList.contains('active')) {
        if (e.key === 'Escape') {
          document.getElementById('modal-parts').classList.remove('active');
        }
        return;
      }

      if (document.getElementById('modal-import').classList.contains('active')) {
        if (e.key === 'Escape') {
          document.getElementById('modal-import').classList.remove('active');
          importImage = null;
          importResult = null;
          importCrop = null;
        }
        return;
      }

      // Ctrl shortcuts
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' && !e.shiftKey) {
          e.preventDefault();
          undo();
        } else if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) {
          e.preventDefault();
          redo();
        } else if (e.key === 's') {
          e.preventDefault();
          saveImage();
        } else if (e.key === 'o') {
          e.preventDefault();
          fileInput.click();
        }
        return;
      }

      // Mode-specific keys
      if (state.mode === 'display') {
        if (e.key === ' ' || e.code === 'Space') {
          e.preventDefault();
          advanceInDisplayMode();
        } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          const part = getCurrentPart();
          const height = part ? part.height : state.height;
          // In bottom-to-top mode, visual down = previous row, visual up = next row
          const goingUp = readBottomToTop ? (e.key === 'ArrowDown') : (e.key === 'ArrowUp');
          const delta = goingUp ? -1 : 1;
          if (part) {
            part.currentRow = (part.currentRow + delta + height) % height;
          } else {
            state.currentRow = (state.currentRow + delta + height) % height;
          }
          render();
        } else if (e.key === 'ArrowLeft' && state.parts.length > 0) {
          e.preventDefault();
          state.currentPart = (state.currentPart - 1 + state.parts.length) % state.parts.length;
          render();
        } else if (e.key === 'ArrowRight' && state.parts.length > 0) {
          e.preventDefault();
          state.currentPart = (state.currentPart + 1) % state.parts.length;
          render();
        } else if (e.key === 'Escape') {
          state.mode = 'edit';
          render();
        }
      } else {
        if (e.key === 'Enter') {
          state.mode = 'display';
          state.currentPart = 0;
          render();
        } else if (e.key === 'ArrowLeft' && state.parts.length > 0) {
          e.preventDefault();
          state.currentPart = (state.currentPart - 1 + state.parts.length) % state.parts.length;
          render();
        } else if (e.key === 'ArrowRight' && state.parts.length > 0) {
          e.preventDefault();
          state.currentPart = (state.currentPart + 1) % state.parts.length;
          render();
        }
      }

      // Number keys for color selection
      if (e.key >= '1' && e.key <= '9') {
        const index = parseInt(e.key) - 1;
        if (index < state.colors.length) {
          state.selectedColor = index;
          updateUI();
        }
      }
    });

    // Window resize
    window.addEventListener('resize', render);
  }

  // ============================================================
  // INITIALIZATION
  // ============================================================

  function init() {
    applyDarkMode();
    initGrid(20, 20);
    initEvents();
    render();
  }

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
