# KnitGrid

Browser-based knitting pattern viewer and editor. Display patterns row by row while you knit, edit with simple drawing tools, save as PNG.

**No build step. No dependencies. Works offline.**

## Features

- **Row-by-row display mode** - highlights current row, greys out the rest
- **Multi-part patterns** - work on front/back panels with independent row tracking
- **Simple editing** - click and drag to paint cells
- **Standard PNG format** - patterns are images, edit them anywhere
- **Undo/redo** - full history support
- **Dark mode** - easy on the eyes
- **Zoom controls** - auto-fit, manual zoom, or stretch to width

## Install

### Option 1: Just open it

Download `index.html`, `styles.css`, and `app.js`. Open `index.html` in your browser.

### Option 2: Nix

```bash
# Run directly
nix run github:joonazan/knitgrid

# Install to profile
nix profile install github:joonazan/knitgrid
knitgrid

# Development
nix develop
nix run .#serve-dev
```

### Option 3: Any HTTP server

```bash
python -m http.server 8080
```

## Usage

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Enter` | Enter display mode |
| `Esc` | Exit to edit mode |
| `Space` | Next part, then next row (display mode) |
| `Up` `Down` | Change row |
| `Left` `Right` | Switch parts |
| `1`-`9` | Select color |
| `Ctrl+Z` | Undo |
| `Ctrl+Y` | Redo |
| `Ctrl+S` | Save PNG |
| `Ctrl+O` | Load PNG |

### Multi-Part Patterns

Load multiple PNG files as separate parts (e.g., front and back of a sock). Each part tracks its own row position. In display mode:

- `Left` `Right` switches between parts
- `Space` cycles through all parts, then advances the row for all parts together
- `Up` `Down` changes only the current part's row

### File Format

Patterns are PNG images where each pixel is one stitch. Edit them in any image editor.

## License

GPL-3.0
