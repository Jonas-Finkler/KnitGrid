# KnitGrid - Development Notes

## Project Overview

A browser-based knitting pattern viewer and editor. Display patterns row by row while you knit, edit with simple drawing tools, save as PNG. Designed for offline use with no build step required.

## Technology Stack

- **Vanilla HTML/CSS/JavaScript** - no frameworks or build step
- **No dependencies** - works offline, just open in browser
- **HTML Canvas** for grid rendering
- **Nix Flake** for reproducible dev environment (`nix run` / `nix develop`)

## Key Design Decisions

### Simple File Structure
The application is contained in three files for easy sharing and offline use:
- `index.html` - HTML structure and markup
- `styles.css` - All CSS styling and theming
- `app.js` - All JavaScript logic

### Code Organization
The JavaScript is organized into clearly labeled sections:
- **STATE** - Core state object and mutable variables
- **DOM REFERENCES** - Cached element references
- **UTILITIES** - Helper functions (color conversion, escaping)
- **STATE HELPERS** - Functions to query/modify state
- **HISTORY** - Undo/redo system
- **RENDERING** - Canvas drawing and zoom calculations
- **UI UPDATES** - Status bar, palette, mode indicator
- **PAINTING** - Cell painting logic
- **FILE I/O** - PNG save/load
- **IMAGE IMPORT** - Photo-to-grid conversion with crop and color quantization
- **PARTS MANAGEMENT** - Multi-panel pattern handling
- **EVENT HANDLERS** - All input event setup
- **INITIALIZATION** - Startup code

### Parts System (Multi-Panel Patterns)
Parts allow working on multiple pattern sections (e.g., front/back of a sock) from **separate PNG files**:

- Each part stores: `{name, grid, width, height, colors, currentRow}`
- Parts are independent patterns, not row ranges of a single pattern
- **Each part tracks its own current row independently** - you might be on row 5 of the front but row 3 of the back
- In display mode, Space cycles through all parts, then **increments the row for ALL parts simultaneously**
- Arrow Up/Down changes only the current part's row
- Arrow Left/Right switches between parts without changing rows
- User wanted this specifically for socks where front and back are separate files at potentially different progress points

### Display Mode vs Edit Mode
- **Edit mode**: Click/drag to paint cells, manage colors, full pattern visible
  - Can switch between parts with Left/Right arrows
  - When editing a part, that part's grid and colors are used
  - Status bar shows which part is being edited
- **Display mode**: Shows one row highlighted, others greyed out (60% opacity), navigate with keyboard
  - Can switch between parts with Left/Right arrows
  - Each part shows its own current row

### Zoom System
Three zoom modes:
- `auto`: Fits to container respecting min/max cell size
- `manual`: User controls with +/- buttons (25% steps) or Ctrl+wheel (5% steps)
- `fit`: Stretches pattern to full container width (respects max cell size)

### Image Import (Photo to Grid)
The Import button lets users upload any image (JPEG, PNG, etc.) and convert it to a knitting grid:
- **Crop**: User can click-drag on the original image to select a region
- **Resize**: User chooses target width in stitches (4–1000), height auto-calculated or manually set
- **Color quantization**: Median cut algorithm reduces colors to 2–20 (user-selectable)
- **Preview**: Side-by-side view of original (with crop overlay) and quantized result
- **Lock aspect ratio**: Checkbox to keep width/height proportional to crop selection
- Pipeline: `drawImage` handles crop+downscale in one step, then median cut quantizes, then pixels mapped to nearest palette color
- Result replaces current grid/colors, clears parts and history

### Reading Direction
- Default is bottom-to-top (how real knitters read patterns)
- Row 1 is at the bottom, navigation moves highlight upward
- Toggle with "Bottom-Up" / "Top-Down" button in toolbar
- Persists preference to localStorage

### Dark Mode
- Uses CSS custom properties (variables) for theming
- Persists preference to localStorage

## State Structure

```javascript
state = {
  grid: [],           // 2D array of color indices (main editing grid)
  width, height,      // Main grid dimensions
  colors: [],         // Palette array of hex strings
  selectedColor: 1,   // Index into colors array
  currentRow: 0,      // Current row in display mode (when no parts)
  mode: 'edit',       // 'edit' or 'display'
  history: [],        // Undo stack (max 50 states)
  historyIndex: -1,   // Current position in history
  parts: [],          // Array of {name, grid, width, height, colors, currentRow}
  currentPart: 0      // Which part is currently shown
}
```

## Keyboard Shortcuts

| Key | Mode | Action |
|-----|------|--------|
| Space | Display | Cycle to next part; after last part, increment row for ALL parts |
| Arrow Up/Down | Display | Change current part's row only |
| Arrow Left/Right | Display | Switch between parts |
| Esc | Display | Return to edit mode |
| Enter | Edit | Enter display mode |
| 1-9 | Any | Quick select color |
| Ctrl+Z | Any | Undo |
| Ctrl+Y / Ctrl+Shift+Z | Any | Redo |
| Ctrl+S | Any | Save PNG |
| Ctrl+O | Any | Load PNG |
| Ctrl+Wheel | Any | Zoom in/out (smooth) |

## File Format

Patterns are saved as PNG images at 1:1 scale (one pixel per stitch). This allows:
- Easy sharing
- Editing in any image editor
- Small file sizes

When loading, unique colors are extracted to build the palette.

## Important Implementation Details

### Rendering with Parts
When parts are defined (in both edit and display mode):
- `getDisplayGrid()` returns the current part's grid/colors instead of main grid
- Canvas size adapts to current part's dimensions
- Each part maintains its own `currentRow` - rendering uses `part.currentRow` not `state.currentRow`
- **Parts are now fully editable** - painting modifies the current part's grid
- Part colors are shown in the palette when editing a part
- When Space is pressed after cycling all parts (display mode), ALL parts' `currentRow` values increment together

### Canvas Sizing
Canvas dimensions are recalculated on every render based on:
- Current zoom mode
- Current display grid (main or part)
- Container size

### Auto-Scroll in Display Mode
When navigating rows in display mode, the view automatically scrolls to keep the current row centered:
- `scrollToCurrentRow()` calculates the scroll position to center the highlighted row
- Respects container boundaries (won't scroll past top or bottom)
- Called after every render in display mode

### History/Undo
- History is saved before each paint stroke (on mousedown)
- Each history entry stores the grid and which part it belongs to (or -1 for main grid)
- Undo/redo restores to the appropriate grid (part or main)
- Limited to 50 states to prevent memory issues
- History is cleared on new project or file load

## File Structure

```
knitgrid/
├── index.html      # HTML structure and markup
├── styles.css      # CSS styling and theming
├── app.js          # JavaScript application logic
├── flake.nix       # Nix flake for packaging and dev
├── flake.lock      # Auto-generated lockfile
├── README.md       # User documentation
├── CLAUDE.md       # This file - dev notes
├── LICENSE         # GPL-3.0
└── .gitignore      # Ignores: result, .direnv
```

## Potential Future Enhancements

- Horizontal follow-along for very wide grids (>screen width) in display mode
- Touch gestures for mobile zoom
- Pattern mirroring/rotation
- Row repeat indicators
- Sound/vibration on row change
- Import from other knitting software formats
- Color suggestions based on yarn databases
