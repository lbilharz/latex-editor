import { tokenize } from './tokenizer.js';
import { Parser } from './parser.js';
import { toMathML } from './renderer.js';

/**
 * Headless rendering wrapper.
 * Processes a LaTeX string and returns the structural MathML string representation.
 */
export function renderMath(latexString) {
    if (!latexString || !latexString.trim()) {
        return '';
    }

    const tokens = tokenize(latexString);
    const parser = new Parser(tokens, latexString.length);
    const ast = parser.parse();
    
    // We could return a DOM element here instead, but string is safer for headless usage
    // until the consumer explicitly wants to parse it via DOMParser.
    return `<math display="block" xmlns="http://www.w3.org/1998/Math/MathML">${toMathML(ast)}</math>`;
}
