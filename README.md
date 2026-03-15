# Knitting Pattern Tool

A browser-based knitting pattern tool that displays pixel-based knitting patterns row by row, supports editing with mouse, and can save/load PNG images.

## Quick Start

### Using Nix (recommended)

```bash
# Enter development shell
nix develop

# Start local server
nix run .#serve

# Open in browser (in another terminal)
nix run .#open
```

Then visit http://localhost:8080

### Without Nix

Simply open `index.html` in your browser, or serve it with any HTTP server:

```bash
python -m http.server 8080
```

## Features

### Edit Mode
- Click or drag to paint cells with the selected color
- Color palette with add/select functionality
- Switch between parts with Left/Right arrow keys
- Undo/Redo support (Ctrl+Z / Ctrl+Y)

### Display Mode
- Full pattern visible with current row highlighted
- Other rows greyed out for easy reading
- Navigate rows with Space key (cycles through parts, then advances)
- Switch between parts with Left/Right arrow keys

### Parts (Multi-Panel Patterns)
- Work on multiple pattern sections (e.g., front/back of a sock)
- Load separate PNG files as different parts
- Each part maintains independent row position
- Switch between parts in both edit and display mode
- Parts advance together when cycling through with Space

### File Operations
- Save patterns as PNG images
- Load PNG images as patterns
- Create new projects with custom dimensions

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Space | Next part, then next row (display mode) |
| Arrow Up/Down | Change current row (display mode) |
| Arrow Left/Right | Switch between parts (edit & display mode) |
| Esc | Exit display mode |
| Enter | Enter display mode |
| Ctrl+Z | Undo |
| Ctrl+Y / Ctrl+Shift+Z | Redo |
| Ctrl+S | Save PNG |
| Ctrl+O | Load PNG |
| 1-9 | Quick select color 1-9 |

## File Format

Patterns are saved as PNG images where each pixel represents one stitch. This allows easy sharing and editing with any image editor.
