// Core state
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
  // Parts: each part has {name, grid, width, height, colors, currentRow} - separate patterns with independent rows
  parts: [],
  currentPart: 0
};

// DOM elements
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const palette = document.getElementById('palette');
const selectedInfo = document.getElementById('selected-info');
const modeIndicator = document.getElementById('mode-indicator');
const statusRow = document.getElementById('status-row');
const fileInput = document.getElementById('file-input');
const colorPicker = document.getElementById('color-picker');

// Drawing state
let isPainting = false;
let cellSize = 20;
const MIN_CELL_SIZE = 4;
const MAX_CELL_SIZE = 60;

// Zoom state
let zoomMode = 'auto'; // 'auto', 'manual', 'fit'
let manualZoom = 1.0;  // 1.0 = 100%
const ZOOM_STEP = 0.25;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4.0;

// Dark mode
let darkMode = localStorage.getItem('darkMode') === 'true';

// Initialize grid
function initGrid(width, height) {
  state.width = width;
  state.height = height;
  state.grid = [];
  for (let y = 0; y < height; y++) {
    state.grid[y] = [];
    for (let x = 0; x < width; x++) {
      state.grid[y][x] = 0; // White (index 0)
    }
  }
  state.currentRow = 0;
  state.history = [];
  state.historyIndex = -1;
  saveToHistory();
}

function updateZoomLabel() {
  const baseSize = 20;
  const currentZoom = Math.round((cellSize / baseSize) * 100);
  document.getElementById('zoom-label').textContent = `${currentZoom}%`;
}

// Get current part (if parts are defined and in display mode)
function getCurrentPart() {
  if (state.parts.length === 0) {
    return null;
  }
  return state.parts[state.currentPart];
}

// Get the grid to render (current part's grid in display mode with parts, otherwise main grid)
function getDisplayGrid() {
  const part = getCurrentPart();
  if (part && state.mode === 'display') {
    return { grid: part.grid, width: part.width, height: part.height, colors: part.colors };
  }
  return { grid: state.grid, width: state.width, height: state.height, colors: state.colors };
}

// Get number of rows in current view (minimum across all parts, or main grid height)
function getViewHeight() {
  if (state.parts.length === 0) {
    return state.height;
  }
  // Use the minimum height across all parts so rows stay in sync
  return Math.min(...state.parts.map(p => p.height));
}

// Render the grid
function render() {
  const display = getDisplayGrid();

  // Recalculate canvas size for current display
  const container = document.querySelector('.canvas-container');
  const maxWidth = container.clientWidth - 40;
  const maxHeight = container.clientHeight - 40;

  if (zoomMode === 'fit') {
    cellSize = Math.floor(maxWidth / display.width);
    cellSize = Math.max(MIN_CELL_SIZE, cellSize);
  } else if (zoomMode === 'manual') {
    const baseSize = 20;
    cellSize = Math.round(baseSize * manualZoom);
    cellSize = Math.max(MIN_CELL_SIZE, Math.min(MAX_CELL_SIZE, cellSize));
  } else {
    const cellW = Math.floor(maxWidth / display.width);
    const cellH = Math.floor(maxHeight / display.height);
    cellSize = Math.min(cellW, cellH);
    cellSize = Math.max(MIN_CELL_SIZE, Math.min(MAX_CELL_SIZE, cellSize));
  }

  canvas.width = display.width * cellSize;
  canvas.height = display.height * cellSize;
  updateZoomLabel();

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Get the current row (from part or main state)
  const part = getCurrentPart();
  let displayRow = state.currentRow;
  if (part && state.mode === 'display') {
    displayRow = part.currentRow;
    // Clamp to valid range
    if (displayRow >= part.height) {
      part.currentRow = displayRow = part.height - 1;
    }
  } else {
    // Clamp currentRow to valid range
    const viewHeight = getViewHeight();
    if (state.currentRow >= viewHeight) {
      state.currentRow = viewHeight - 1;
    }
    displayRow = state.currentRow;
  }

  for (let y = 0; y < display.height; y++) {
    for (let x = 0; x < display.width; x++) {
      const colorIndex = display.grid[y] ? display.grid[y][x] : 0;
      const color = display.colors[colorIndex] || '#FFFFFF';

      // Draw cell
      ctx.fillStyle = color;
      ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);

      // Apply grey overlay in display mode for non-current rows
      if (state.mode === 'display' && y !== displayRow) {
        ctx.fillStyle = 'rgba(128, 128, 128, 0.6)';
        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
      }

      // Draw cell border
      ctx.strokeStyle = darkMode ? '#444' : '#ddd';
      ctx.lineWidth = 1;
      ctx.strokeRect(x * cellSize, y * cellSize, cellSize, cellSize);
    }
  }

  // Draw current row highlight in display mode
  if (state.mode === 'display') {
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 3;
    ctx.strokeRect(
      1,
      displayRow * cellSize + 1,
      display.width * cellSize - 2,
      cellSize - 2
    );
  }

  updateUI();
}

// Update UI elements
function updateUI() {
  // Mode indicator
  modeIndicator.textContent = `Mode: ${state.mode === 'edit' ? 'Edit' : 'Display'}`;
  modeIndicator.classList.toggle('display-mode', state.mode === 'display');

  // Status row
  const part = getCurrentPart();
  if (part && state.mode === 'display') {
    statusRow.textContent = `${part.name} (${state.currentPart + 1}/${state.parts.length}): Row ${part.currentRow + 1} of ${part.height}`;
  } else {
    statusRow.textContent = `Row ${state.currentRow + 1} of ${state.height}`;
  }

  // Selected color info
  const colorName = getColorName(state.colors[state.selectedColor]);
  selectedInfo.textContent = `Selected: ${colorName}`;

  // Update palette
  renderPalette();

  // Update display button
  const btnDisplay = document.getElementById('btn-display');
  btnDisplay.textContent = state.mode === 'edit' ? 'Display' : 'Edit';
  btnDisplay.classList.toggle('active', state.mode === 'display');

  // Update parts button
  const btnParts = document.getElementById('btn-parts');
  btnParts.classList.toggle('active', state.parts.length > 0);
}

// Get a readable color name
function getColorName(hex) {
  const names = {
    '#FFFFFF': 'White',
    '#000000': 'Black',
    '#FF0000': 'Red',
    '#00FF00': 'Green',
    '#0000FF': 'Blue',
    '#FFFF00': 'Yellow',
    '#FF00FF': 'Magenta',
    '#00FFFF': 'Cyan'
  };
  return names[hex.toUpperCase()] || hex;
}

// Render color palette
function renderPalette() {
  palette.innerHTML = '';
  state.colors.forEach((color, index) => {
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

// History management
function saveToHistory() {
  // Remove any future history if we're not at the end
  if (state.historyIndex < state.history.length - 1) {
    state.history = state.history.slice(0, state.historyIndex + 1);
  }

  // Clone the grid
  const gridCopy = state.grid.map(row => [...row]);
  state.history.push(gridCopy);

  // Limit history size
  if (state.history.length > 50) {
    state.history.shift();
  }

  state.historyIndex = state.history.length - 1;
}

function undo() {
  if (state.historyIndex > 0) {
    state.historyIndex--;
    state.grid = state.history[state.historyIndex].map(row => [...row]);
    render();
  }
}

function redo() {
  if (state.historyIndex < state.history.length - 1) {
    state.historyIndex++;
    state.grid = state.history[state.historyIndex].map(row => [...row]);
    render();
  }
}

// Get cell coordinates from mouse event
function getCellFromEvent(e) {
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor((e.clientX - rect.left) / cellSize);
  const y = Math.floor((e.clientY - rect.top) / cellSize);
  return { x, y };
}

// Paint a cell
function paintCell(x, y) {
  if (x >= 0 && x < state.width && y >= 0 && y < state.height) {
    if (state.grid[y][x] !== state.selectedColor) {
      state.grid[y][x] = state.selectedColor;
      render();
    }
  }
}

// Canvas mouse events
canvas.addEventListener('mousedown', (e) => {
  if (state.mode !== 'edit') return;
  isPainting = true;
  saveToHistory();
  const { x, y } = getCellFromEvent(e);
  paintCell(x, y);
});

canvas.addEventListener('mousemove', (e) => {
  if (state.mode !== 'edit' || !isPainting) return;
  const { x, y } = getCellFromEvent(e);
  paintCell(x, y);
});

canvas.addEventListener('mouseup', () => {
  isPainting = false;
});

canvas.addEventListener('mouseleave', () => {
  isPainting = false;
});

// Touch support
canvas.addEventListener('touchstart', (e) => {
  if (state.mode !== 'edit') return;
  e.preventDefault();
  isPainting = true;
  saveToHistory();
  const touch = e.touches[0];
  const { x, y } = getCellFromEvent(touch);
  paintCell(x, y);
});

canvas.addEventListener('touchmove', (e) => {
  if (state.mode !== 'edit' || !isPainting) return;
  e.preventDefault();
  const touch = e.touches[0];
  const { x, y } = getCellFromEvent(touch);
  paintCell(x, y);
});

canvas.addEventListener('touchend', () => {
  isPainting = false;
});

// Toolbar buttons
document.getElementById('btn-new').addEventListener('click', () => {
  document.getElementById('modal-new').classList.add('active');
});

document.getElementById('btn-new-cancel').addEventListener('click', () => {
  document.getElementById('modal-new').classList.remove('active');
});

document.getElementById('btn-new-confirm').addEventListener('click', () => {
  const width = parseInt(document.getElementById('new-width').value) || 20;
  const height = parseInt(document.getElementById('new-height').value) || 20;
  initGrid(
    Math.max(1, Math.min(200, width)),
    Math.max(1, Math.min(200, height))
  );
  state.colors = ['#FFFFFF', '#000000'];
  state.selectedColor = 1;
  state.mode = 'edit';
  state.parts = [];
  state.currentPart = 0;
  render();
  document.getElementById('modal-new').classList.remove('active');
});

document.getElementById('btn-load').addEventListener('click', () => {
  fileInput.click();
});

fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const img = new Image();
  const reader = new FileReader();

  reader.onload = (event) => {
    img.onload = () => {
      // Create temp canvas to read pixels
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = img.width;
      tempCanvas.height = img.height;
      const tempCtx = tempCanvas.getContext('2d');
      tempCtx.drawImage(img, 0, 0);

      const imageData = tempCtx.getImageData(0, 0, img.width, img.height);
      const pixels = imageData.data;

      // Extract unique colors and build grid
      const colorMap = new Map();
      const newColors = [];
      const newGrid = [];

      for (let y = 0; y < img.height; y++) {
        newGrid[y] = [];
        for (let x = 0; x < img.width; x++) {
          const i = (y * img.width + x) * 4;
          const r = pixels[i];
          const g = pixels[i + 1];
          const b = pixels[i + 2];
          const hex = rgbToHex(r, g, b);

          if (!colorMap.has(hex)) {
            colorMap.set(hex, newColors.length);
            newColors.push(hex);
          }
          newGrid[y][x] = colorMap.get(hex);
        }
      }

      // Update state
      state.width = img.width;
      state.height = img.height;
      state.grid = newGrid;
      state.colors = newColors;
      state.selectedColor = 0;
      state.currentRow = 0;
      state.mode = 'edit';
      state.history = [];
      state.historyIndex = -1;
      state.parts = [];
      state.currentPart = 0;
      saveToHistory();
      render();
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
  fileInput.value = '';
});

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('').toUpperCase();
}

document.getElementById('btn-save').addEventListener('click', saveImage);

function saveImage() {
  // Create 1:1 canvas
  const saveCanvas = document.createElement('canvas');
  saveCanvas.width = state.width;
  saveCanvas.height = state.height;
  const saveCtx = saveCanvas.getContext('2d');

  // Draw pixels
  for (let y = 0; y < state.height; y++) {
    for (let x = 0; x < state.width; x++) {
      const colorIndex = state.grid[y][x];
      saveCtx.fillStyle = state.colors[colorIndex] || '#FFFFFF';
      saveCtx.fillRect(x, y, 1, 1);
    }
  }

  // Download
  saveCanvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pattern.png';
    a.click();
    URL.revokeObjectURL(url);
  }, 'image/png');
}

document.getElementById('btn-display').addEventListener('click', toggleMode);

function toggleMode() {
  state.mode = state.mode === 'edit' ? 'display' : 'edit';
  render();
}

// Add color button
document.getElementById('btn-add-color').addEventListener('click', () => {
  colorPicker.click();
});

colorPicker.addEventListener('change', (e) => {
  const newColor = e.target.value.toUpperCase();
  if (!state.colors.includes(newColor)) {
    state.colors.push(newColor);
    state.selectedColor = state.colors.length - 1;
    updateUI();
  }
});

// Zoom controls
document.getElementById('btn-zoom-in').addEventListener('click', () => {
  zoomMode = 'manual';
  manualZoom = Math.min(MAX_ZOOM, manualZoom + ZOOM_STEP);
  render();
});

document.getElementById('btn-zoom-out').addEventListener('click', () => {
  zoomMode = 'manual';
  manualZoom = Math.max(MIN_ZOOM, manualZoom - ZOOM_STEP);
  render();
});

document.getElementById('btn-zoom-fit').addEventListener('click', () => {
  if (zoomMode === 'fit') {
    zoomMode = 'auto';
  } else {
    zoomMode = 'fit';
  }
  render();
  // Update button state
  document.getElementById('btn-zoom-fit').classList.toggle('active', zoomMode === 'fit');
});

// Dark mode toggle
function applyDarkMode() {
  document.body.classList.toggle('dark-mode', darkMode);
  document.getElementById('btn-dark-mode').textContent = darkMode ? 'Light' : 'Dark';
  localStorage.setItem('darkMode', darkMode);
}

document.getElementById('btn-dark-mode').addEventListener('click', () => {
  darkMode = !darkMode;
  applyDarkMode();
  render();
});

// Advance in display mode: cycle parts, then advance row for all parts together
function advanceInDisplayMode() {
  if (state.parts.length > 0) {
    // Cycle to next part
    state.currentPart++;
    if (state.currentPart >= state.parts.length) {
      // Wrapped around - advance row for ALL parts
      state.currentPart = 0;
      state.parts.forEach(part => {
        part.currentRow = (part.currentRow + 1) % part.height;
      });
    }
  } else {
    // No parts - just advance row
    state.currentRow = (state.currentRow + 1) % state.height;
  }
  render();
}

// Parts modal
document.getElementById('btn-parts').addEventListener('click', () => {
  renderPartsList();
  document.getElementById('modal-parts').classList.add('active');
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

// Add current pattern as a part
document.getElementById('btn-part-add-current').addEventListener('click', () => {
  const name = document.getElementById('part-name').value.trim() || `Part ${state.parts.length + 1}`;

  // Clone the current grid
  state.parts.push({
    name,
    grid: state.grid.map(row => [...row]),
    width: state.width,
    height: state.height,
    colors: [...state.colors],
    currentRow: 0
  });
  state.currentPart = 0;

  document.getElementById('part-name').value = '';
  renderPartsList();
  render();
});

// Load a PNG file as a part
const partFileInput = document.getElementById('part-file-input');

document.getElementById('btn-part-load-file').addEventListener('click', () => {
  partFileInput.click();
});

partFileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const partName = document.getElementById('part-name').value.trim() || file.name.replace(/\.[^.]+$/, '');
  const img = new Image();
  const reader = new FileReader();

  reader.onload = (event) => {
    img.onload = () => {
      // Create temp canvas to read pixels
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = img.width;
      tempCanvas.height = img.height;
      const tempCtx = tempCanvas.getContext('2d');
      tempCtx.drawImage(img, 0, 0);

      const imageData = tempCtx.getImageData(0, 0, img.width, img.height);
      const pixels = imageData.data;

      // Extract unique colors and build grid
      const colorMap = new Map();
      const newColors = [];
      const newGrid = [];

      for (let y = 0; y < img.height; y++) {
        newGrid[y] = [];
        for (let x = 0; x < img.width; x++) {
          const i = (y * img.width + x) * 4;
          const r = pixels[i];
          const g = pixels[i + 1];
          const b = pixels[i + 2];
          const hex = rgbToHex(r, g, b);

          if (!colorMap.has(hex)) {
            colorMap.set(hex, newColors.length);
            newColors.push(hex);
          }
          newGrid[y][x] = colorMap.get(hex);
        }
      }

      // Add as part
      state.parts.push({
        name: partName,
        grid: newGrid,
        width: img.width,
        height: img.height,
        colors: newColors,
        currentRow: 0
      });
      state.currentPart = 0;

      document.getElementById('part-name').value = '';
      renderPartsList();
      render();
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
  partFileInput.value = '';
});

function removePart(index) {
  state.parts.splice(index, 1);
  if (state.currentPart >= state.parts.length) {
    state.currentPart = Math.max(0, state.parts.length - 1);
  }
  renderPartsList();
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
      <button onclick="removePart(${i})">Remove</button>
    </div>
  `).join('');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Make removePart available globally for onclick handlers
window.removePart = removePart;

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  // Check for modals
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

  // Mode-specific shortcuts
  if (state.mode === 'display') {
    if (e.key === ' ' || e.code === 'Space') {
      e.preventDefault();
      advanceInDisplayMode();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      // Arrow down advances current part's row (or main row if no parts)
      const part = getCurrentPart();
      if (part) {
        part.currentRow = (part.currentRow + 1) % part.height;
      } else {
        state.currentRow = (state.currentRow + 1) % state.height;
      }
      render();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      // Arrow up decreases current part's row (or main row if no parts)
      const part = getCurrentPart();
      if (part) {
        part.currentRow = (part.currentRow - 1 + part.height) % part.height;
      } else {
        state.currentRow = (state.currentRow - 1 + state.height) % state.height;
      }
      render();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      // Switch to previous part
      if (state.parts.length > 0) {
        state.currentPart = (state.currentPart - 1 + state.parts.length) % state.parts.length;
        render();
      }
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      // Switch to next part (without advancing row)
      if (state.parts.length > 0) {
        state.currentPart = (state.currentPart + 1) % state.parts.length;
        render();
      }
    } else if (e.key === 'Escape') {
      state.mode = 'edit';
      render();
    }
  } else {
    if (e.key === 'Enter') {
      state.mode = 'display';
      state.currentPart = 0;
      render();
    }
  }


  // Number keys for quick color selection
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

// Initialize
applyDarkMode();
initGrid(20, 20);
render();
