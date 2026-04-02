# Accessible Math Editor

**[Live Demo](https://latex-mathml-editor.vercel.app)**

An accessible math formula editor for visually impaired students — and everyone working alongside them. This repository provides a standalone, framework-agnostic NPM package (`@lbilharz/accessible-math-editor`) to drop an accessible math editor into any web project.

## Why

Math on the web is visual. Fractions stack, exponents rise, roots get radical signs. Screen readers and Braille displays can't navigate that. The standard workaround — custom ARIA trees, invisible descriptions — bolts accessibility onto a visual model.

This editor takes the opposite approach: **LaTeX is the primary input.** It's linear text. Screen readers read it. Braille displays render it. Keyboard navigation works character by character. No special modes, no workarounds.

For sighted users, the same formula renders as native MathML in real time — fractions, roots, and all. Both views stay in sync. A visually impaired student types `\frac{a}{b}` and their teacher sees a rendered fraction. A teacher provides an example formula and the student reads it back on their Braille display.

## Installation

Install the package via npm:

```bash
npm install @lbilharz/accessible-math-editor
```

## Usage

### 1. Drop-In Interactive UI Context

You can instantly inject the fully accessible interactive editor—complete with toolbars, visual MathML rendering, and LaTeX text sync—into any empty `<div>`:

```html
<div id="editor-root"></div>
```

```javascript
import { createMathEditor } from '@lbilharz/accessible-math-editor';
// Import the styles
import '@lbilharz/accessible-math-editor/style.css';

// Initialize
const container = document.getElementById('editor-root');
const editor = createMathEditor(container);

// Set or retrieve LaTeX values
editor.value = "\\frac{1}{2}";
```

### 2. Headless API

If you just want to render LaTeX strings directly to valid MathML without the UI overhead:

```javascript
import { renderMath } from '@lbilharz/accessible-math-editor/core';

// Returns valid <math>...</math> XML string
const xml = renderMath("\\sqrt{x}");
```

### 3. Engine API
For raw AST or token manipulation:

```js
import { tokenize, Parser, toMathML, toMathCoreXML, collectErrors } from '@lbilharz/accessible-math-editor';

const tokens = tokenize('\\frac{a}{b}');
const ast = new Parser(tokens).parse();
const mathml = toMathML(ast);
```

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
| `Esc` | Switch to LaTeX mode |
| Double-click | Switch to LaTeX mode at clicked position |

This structural approach is more reliable than a text cursor in 2D math layout — you always know exactly what's selected.

## Architecture

```
LaTeX string → Tokenizer → Parser (AST) → MathML renderer → Browser native math
```

- **Framework-Agnostic** — Pure vanilla JS (`src/` compiles entirely decoupled)
- **Native MathML** — The browser handles math layout natively, avoiding bulky JS shim injections.
- **Built with Vite** — Emits fast, tree-shakable `.es.js` and `.umd.cjs` bundles.

## Local Development & Tests

```bash
npm install
npm run dev
npm test
```

131 tests across 7 test files covering tokenizer, parser, renderer, navigation stops, error detection, validation, and MathML export.



## License

MIT
