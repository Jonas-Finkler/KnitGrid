# Knitting Pattern Tool - Development Notes

## Project Overview

A browser-based knitting pattern tool for displaying pixel-based patterns row by row while knitting. Designed for offline use with no build step required.

## Technology Stack

- **Single HTML file** (`index.html`) with embedded CSS and JavaScript
- **No dependencies** - works offline, just open in browser
- **HTML Canvas** for grid rendering
- **Nix Flake** for reproducible dev environment (`nix run .#serve` / `nix run .#open`)

## Key Design Decisions

### Single File Architecture
Everything is in `index.html` intentionally - makes it easy to copy, share, and use offline without any build process.

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
- **Display mode**: Shows one row highlighted, others greyed out (60% opacity), navigate with keyboard

### Zoom System
Three zoom modes:
- `auto`: Fits to container respecting min/max cell size
- `manual`: User controls with +/- buttons (25% steps)
- `fit`: Stretches pattern to full container width (useful for wide patterns)

### Dark Mode
- Uses CSS custom properties (variables) for theming
- Persists preference to localStorage
- Grid lines color changes with theme (`#ddd` light / `#444` dark)

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

## File Format

Patterns are saved as PNG images at 1:1 scale (one pixel per stitch). This allows:
- Easy sharing
- Editing in any image editor
- Small file sizes

When loading, unique colors are extracted to build the palette.

## Important Implementation Details

### Rendering with Parts
When parts are defined and in display mode:
- `getDisplayGrid()` returns the current part's grid/colors instead of main grid
- Canvas size adapts to current part's dimensions
- Each part maintains its own `currentRow` - rendering uses `part.currentRow` not `state.currentRow`
- Main grid is always used for editing (parts are read-only in display)
- When Space is pressed after cycling all parts, ALL parts' `currentRow` values increment together

### Canvas Sizing
Canvas dimensions are recalculated on every render based on:
- Current zoom mode
- Current display grid (main or part)
- Container size

### History/Undo
- History is saved before each paint stroke (on mousedown)
- Limited to 50 states to prevent memory issues
- History is cleared on new project or file load

## File Structure

```
knit-pattern-tool/
├── flake.nix       # Nix flake (dev shell, serve/open apps)
├── flake.lock      # Auto-generated lockfile
├── index.html      # Complete application
├── README.md       # User documentation
├── CLAUDE.md       # This file - dev notes
└── .gitignore      # Ignores: result, .direnv
```

## Potential Future Enhancements

- Touch gestures for mobile zoom
- Pattern mirroring/rotation
- Row repeat indicators
- Sound/vibration on row change
- Import from other knitting software formats
- Color suggestions based on yarn databases
