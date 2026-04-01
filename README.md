# LaTeX Formula Editor

An accessible math formula editor that bridges visually impaired and sighted users through a shared editing experience.

## The Idea

Visually impaired people use Braille displays and screen readers to interact with computers. For math, LaTeX is the linear text notation they already know — `\frac{1}{2}` is perfectly readable on a Braille display, navigable character-by-character, and unambiguous.

Sighted people expect to see math rendered visually — fractions stacked, square roots with radical signs, superscripts raised.

This editor serves both at the same time:

- **LaTeX input** — a standard text field. Screen readers read it. Braille displays render it. Keyboard navigation just works.
- **MathML output** — the browser renders the same formula as native visual math, in real time.

Both views stay in sync. A visually impaired student types `\frac{a}{b}` and their sighted teacher sees a rendered fraction. A teacher provides an example formula and the student reads it back as LaTeX on their Braille display.

## Architecture

```
LaTeX string → Tokenizer → Parser (AST) → MathML renderer → Browser native math
```

- **Zero dependencies** — vanilla JS, no React, no build step
- **Native MathML** — the browser handles math layout, not JavaScript
- **~900 lines** across 7 modules
- **Dual-mode editing** — edit in LaTeX source or navigate the rendered MathML visually

## Modules

| File | Purpose |
|------|---------|
| `tokenizer.js` | Lexer: LaTeX source → token stream |
| `parser.js` | Recursive descent parser → AST |
| `renderer.js` | AST → MathML string with source position attributes |
| `cursor.js` | Cursor positioning, click-to-source mapping, navigable stops |
| `data.js` | Symbol tables (Greek, operators, functions, etc.) |
| `app.js` | Application logic, mode switching, toolbar, suggestions |
| `styles.css` | Layout and visual states |

## Running

```bash
cd latex-editor
python3 -m http.server 8090
# open http://localhost:8090
```

## Features

- LaTeX tokenizer handling commands, braces, scripts, brackets, operators
- Recursive descent parser supporting `\frac`, `\sqrt`, `\binom`, matrices, and more
- Real-time MathML preview with `data-s`/`data-e` source position mapping
- Dual-mode: switch between LaTeX editing and MathML visual navigation
- Command autocomplete suggestions when typing `\`
- Math toolbar for quick insertion of fractions, roots, powers, vectors
- Cursor synchronization between LaTeX source positions and MathML elements

## License

MIT
