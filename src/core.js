import { tokenize } from './tokenizer.js';
import { Parser } from './parser.js';
import { toMathML } from './renderer.js';
import { mathmlToLatex } from './mathmlToLatex.js';

/**
 * Bidirectional rendering wrapper.
 * - LaTeX string in  → MathML string out
 * - MathML string in → LaTeX string out
 *
 * Auto-detects direction by checking if input starts with '<'.
 */
export function renderMath(input) {
    if (!input || !input.trim()) return '';

    const trimmed = input.trim();

    if (trimmed.startsWith('<')) {
        // MathML → LaTeX
        return mathmlToLatex(trimmed);
    }

    // LaTeX → MathML
    const tokens = tokenize(trimmed);
    const parser = new Parser(tokens, trimmed.length);
    const ast = parser.parse();
    return `<math display="block" xmlns="http://www.w3.org/1998/Math/MathML">${toMathML(ast)}</math>`;
}
