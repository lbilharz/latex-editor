# LaTeX Formula Editor

**[Live Demo](https://latex-mathml-editor.vercel.app)**

An accessible math formula editor for visually impaired students — and everyone working alongside them.

## Why

Math on the web is visual. Fractions stack, exponents rise, roots get radical signs. Screen readers and Braille displays can't navigate that. The standard workaround — custom ARIA trees, invisible descriptions — bolts accessibility onto a visual model.

This editor takes the opposite approach: **LaTeX is the primary input.** It's linear text. Screen readers read it. Braille displays render it. Keyboard navigation works character by character. No special modes, no workarounds.

For sighted users, the same formula renders as native MathML in real time — fractions, roots, and all. Both views stay in sync. A visually impaired student types `\frac{a}{b}` and their teacher sees a rendered fraction. A teacher provides an example formula and the student reads it back on their Braille display.

## Editing Modes

### Linear LaTeX editing

Type formulas as text. Autocomplete suggests commands as you type `\`. Full keyboard control.

### Visual structural editing

Click the rendered formula to switch to visual mode. Instead of a text cursor, you **select whole elements** — a number, a variable, an operator, or an entire structure like a fraction or superscript.

| Key | Action |
|-----|--------|
| **Click** | Select the clicked element |
| `←` `→` | Move to previous/next sibling |
| `↑` | Select parent structure (e.g., from exponent `2` to whole `x²`) |
| `↓` | Enter a structure (e.g., from `x²` into its parts) |
| Type | Replace selected element |
| `Backspace` | Delete selected element |
| `^` | Add superscript after selection |
| `_` | Add subscript after selection |
| `Tab` | Jump to next empty placeholder |
| `Esc` | Switch to LaTeX mode (selected range highlighted in input) |
| Double-click | Switch to LaTeX mode at clicked position |

This structural approach is more reliable than a text cursor in 2D math layout — you always know exactly what's selected.

## Architecture

```
LaTeX string → Tokenizer → Parser (AST) → MathML renderer → Browser native math
```

- **Zero dependencies** — vanilla JS, no React, no build step
- **Native MathML** — the browser handles math layout, not JavaScript
- **~1200 lines** across 9 modules
- **Dual-mode editing** — LaTeX source or structural visual navigation

## Modules

| File | Purpose |
|------|---------|
| `tokenizer.js` | Lexer: LaTeX source → token stream |
| `parser.js` | Recursive descent parser → AST |
| `renderer.js` | AST → MathML with source position attributes (`data-s`, `data-e`) |
| `cursor.js` | Cursor positioning, structural node selection, click-to-node mapping |
| `data.js` | Symbol tables (Greek, operators, functions) |
| `errors.js` | Syntax error detection (unknown commands, missing args, unclosed delimiters) |
| `validate.js` | Mock answer validation with arithmetic evaluation and term comparison |
| `export.js` | MathML export for MathCore integration |
| `app.js` | Mode switching, toolbar, suggestions, exercises, event handling |

## npm package

```js
import { tokenize, Parser, toMathML, toMathCoreXML, collectErrors } from 'latex-editor';

const tokens = tokenize('\\frac{a}{b}');
const ast = new Parser(tokens).parse();
const mathml = toMathML(ast);
```

## Running locally

```bash
python3 -m http.server 8090
# open http://localhost:8090
```

## Tests

```bash
npm test
```

131 tests across 7 test files covering tokenizer, parser, renderer, navigation stops, error detection, validation, and MathML export.

## Context

This prototype is part of the bettermarks accessibility initiative ([BM-68839](https://bettermarks.atlassian.net/browse/BM-68839)), building an accessible alternative to the existing visual formula editor for visually impaired students.

## License

MIT
