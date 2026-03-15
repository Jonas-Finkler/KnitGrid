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

  const MIN_CELL_SIZE = 4;
  const MAX_CELL_SIZE = 60;
  const ZOOM_STEP = 0.25;
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
    const rowTop = displayRow * cellSize;
    const rowCenter = rowTop + cellSize / 2;
    const containerHeight = container.clientHeight;

    // Calculate scroll position to center the row
    const targetScroll = rowCenter - containerHeight / 2;

    // Clamp to valid scroll range
    const maxScroll = canvas.height - containerHeight;
    const scrollTop = Math.max(0, Math.min(maxScroll, targetScroll));

    container.scrollTop = scrollTop;
  }

  function render() {
    const display = getDisplayGrid();
    const container = document.querySelector('.canvas-container');
    const maxWidth = container.clientWidth - 40;
    const maxHeight = container.clientHeight - 40;

    // Calculate cell size based on zoom mode
    if (zoomMode === 'fit') {
      cellSize = Math.max(MIN_CELL_SIZE, Math.floor(maxWidth / display.width));
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

    // Determine current row
    const part = getCurrentPart();
    let displayRow = state.currentRow;
    if (part && state.mode === 'display') {
      displayRow = Math.min(part.currentRow, part.height - 1);
      part.currentRow = displayRow;
    } else {
      const viewHeight = getViewHeight();
      if (state.currentRow >= viewHeight) {
        state.currentRow = viewHeight - 1;
      }
      displayRow = state.currentRow;
    }

    // Draw cells
    for (let y = 0; y < display.height; y++) {
      for (let x = 0; x < display.width; x++) {
        const colorIndex = display.grid[y]?.[x] ?? 0;
        const color = display.colors[colorIndex] || '#FFFFFF';

        ctx.fillStyle = color;
        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);

        if (state.mode === 'display' && y !== displayRow) {
          ctx.fillStyle = 'rgba(128, 128, 128, 0.6)';
          ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
        }

        ctx.strokeStyle = darkMode ? '#444' : '#ddd';
        ctx.lineWidth = 1;
        ctx.strokeRect(x * cellSize, y * cellSize, cellSize, cellSize);
      }
    }

    // Highlight current row in display mode
    if (state.mode === 'display') {
      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth = 3;
      ctx.strokeRect(1, displayRow * cellSize + 1, display.width * cellSize - 2, cellSize - 2);
      scrollToCurrentRow(displayRow);
    }

    updateUI();
  }

  // ============================================================
  // UI UPDATES
  // ============================================================

  function updateUI() {
    // Mode indicator
    modeIndicator.textContent = `Mode: ${state.mode === 'edit' ? 'Edit' : 'Display'}`;
    modeIndicator.classList.toggle('display-mode', state.mode === 'display');

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

    // Touch events
    canvas.addEventListener('touchstart', e => {
      if (state.mode !== 'edit') return;
      e.preventDefault();
      isPainting = true;
      saveToHistory();
      const { x, y } = getCellFromEvent(e.touches[0]);
      paintCell(x, y);
    });

    canvas.addEventListener('touchmove', e => {
      if (state.mode !== 'edit' || !isPainting) return;
      e.preventDefault();
      const { x, y } = getCellFromEvent(e.touches[0]);
      paintCell(x, y);
    });

    canvas.addEventListener('touchend', () => isPainting = false);

    // Toolbar buttons
    document.getElementById('btn-new').addEventListener('click', () => {
      document.getElementById('modal-new').classList.add('active');
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
      zoomMode = zoomMode === 'fit' ? 'auto' : 'fit';
      render();
      document.getElementById('btn-zoom-fit').classList.toggle('active', zoomMode === 'fit');
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
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          const part = getCurrentPart();
          if (part) {
            part.currentRow = (part.currentRow + 1) % part.height;
          } else {
            state.currentRow = (state.currentRow + 1) % state.height;
          }
          render();
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          const part = getCurrentPart();
          if (part) {
            part.currentRow = (part.currentRow - 1 + part.height) % part.height;
          } else {
            state.currentRow = (state.currentRow - 1 + state.height) % state.height;
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
