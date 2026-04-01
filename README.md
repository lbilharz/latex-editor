# LaTeX Formula Editor

**[Live Demo](https://latex-mathml-editor.vercel.app)**

An accessible math formula editor for visually impaired students — and everyone working alongside them.

## Why

Math on the web is visual. Fractions stack, exponents rise, roots get radical signs. Screen readers and Braille displays can't navigate that. The standard workaround — custom ARIA trees, invisible descriptions — bolts accessibility onto a visual model.

This editor takes the opposite approach: **LaTeX is the primary input.** It's linear text. Screen readers read it. Braille displays render it. Keyboard navigation works character by character. No special modes, no workarounds.

For sighted users, the same formula renders as native MathML in real time — fractions, roots, and all. Both views stay in sync. A visually impaired student types `\frac{a}{b}` and their teacher sees a rendered fraction. A teacher provides an example formula and the student reads it back on their Braille display.

## Architecture

```
LaTeX string → Tokenizer → Parser (AST) → MathML renderer → Browser native math
```

- **Zero dependencies** — vanilla JS, no React, no build step
- **Native MathML** — the browser handles math layout, not JavaScript
- **~900 lines** across 7 modules
- **Dual-mode editing** — LaTeX source or MathML visual navigation

## Modules

| File | Purpose |
|------|---------|
| `tokenizer.js` | Lexer: LaTeX source → token stream |
| `parser.js` | Recursive descent parser → AST |
| `renderer.js` | AST → MathML with source position attributes |
| `cursor.js` | Cursor positioning, click-to-source mapping, navigable stops |
| `data.js` | Symbol tables (Greek, operators, functions) |
| `app.js` | Mode switching, toolbar, suggestions, event handling |
| `styles.css` | Layout and visual states |

## Running locally

```bash
python3 -m http.server 8090
# open http://localhost:8090
```

## Context

This prototype is part of the bettermarks accessibility initiative ([BM-68839](https://bettermarks.atlassian.net/browse/BM-68839)), building an accessible alternative to the existing visual formula editor for visually impaired students.

## License

MIT
