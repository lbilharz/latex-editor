// validate.js — Mock MathCore validation
// Compares student AST against expected AST leaf-by-leaf.
// Returns { correct: boolean, marks: [{ start, end, status }] }
// where status is 'correct' | 'incorrect' | 'missing' | 'extra'

import { tokenize } from './tokenizer.js';
import { Parser } from './parser.js';

/**
 * Extract ordered leaf values from an AST.
 * Each leaf: { value, start, end }
 */
export function extractLeaves(node) {
    if (!node) return [];
    const leaves = [];

    switch (node.type) {
        case 'row':
            for (const c of node.children) leaves.push(...extractLeaves(c));
            break;
        case 'group':
            leaves.push(...extractLeaves(node.body));
            break;
        case 'delimited':
            leaves.push({ value: node.open, start: node.start, end: node.start + 1 });
            leaves.push(...extractLeaves(node.body));
            if (node.close) {
                leaves.push({ value: node.close, start: node.end - 1, end: node.end });
            }
            break;
        case 'frac':
            leaves.push(...extractLeaves(node.num));
            leaves.push({ value: '/', start: node.start, end: node.start }); // virtual separator
            leaves.push(...extractLeaves(node.den));
            break;
        case 'sqrt':
            if (node.index) leaves.push(...extractLeaves(node.index));
            leaves.push(...extractLeaves(node.body));
            break;
        case 'sup':
        case 'sub':
        case 'subsup':
            leaves.push(...extractLeaves(node.base));
            if (node.sup) leaves.push(...extractLeaves(node.sup));
            if (node.sub) leaves.push(...extractLeaves(node.sub));
            break;
        case 'over':
        case 'under':
            leaves.push(...extractLeaves(node.body));
            break;
        case 'binom':
            leaves.push(...extractLeaves(node.top));
            leaves.push(...extractLeaves(node.bot));
            break;
        case 'textbox':
            leaves.push(...extractLeaves(node.body));
            break;
        case 'matrix':
            for (const row of node.rows) {
                for (const cell of row) leaves.push(...extractLeaves(cell));
            }
            break;
        case 'empty':
            break;
        // Leaf types
        default:
            leaves.push({
                value: normalizeValue(node.value),
                start: node.start,
                end: node.end,
            });
            break;
    }
    return leaves;
}

/**
 * Normalize values for comparison — strip whitespace, unify representations.
 */
function normalizeValue(v) {
    if (v == null) return '';
    return String(v).trim();
}

/**
 * Parse a LaTeX string into an AST.
 */
function parseLatex(src) {
    const tokens = tokenize(src);
    return new Parser(tokens, src.length).parse();
}

/**
 * Compare student input against expected answer.
 * Returns { correct, marks, message }
 *   marks: array of { start, end, status } for each student leaf
 *   status: 'correct' | 'incorrect' | 'extra'
 */
export function validateAnswer(studentSrc, expectedSrc) {
    const studentAST = parseLatex(studentSrc);
    const expectedAST = parseLatex(expectedSrc);

    const studentLeaves = extractLeaves(studentAST).filter(l => l.value !== '/');
    const expectedLeaves = extractLeaves(expectedAST).filter(l => l.value !== '/');

    const marks = [];
    let allCorrect = true;

    // Walk both leaf sequences in parallel
    const maxLen = Math.max(studentLeaves.length, expectedLeaves.length);

    for (let i = 0; i < studentLeaves.length; i++) {
        const sl = studentLeaves[i];
        if (i < expectedLeaves.length) {
            const el = expectedLeaves[i];
            if (sl.value === el.value) {
                marks.push({ start: sl.start, end: sl.end, status: 'correct' });
            } else {
                marks.push({ start: sl.start, end: sl.end, status: 'incorrect' });
                allCorrect = false;
            }
        } else {
            marks.push({ start: sl.start, end: sl.end, status: 'extra' });
            allCorrect = false;
        }
    }

    // If expected has more leaves than student
    if (expectedLeaves.length > studentLeaves.length) {
        allCorrect = false;
    }

    const message = allCorrect ? 'Correct!' : 'Not quite — check the highlighted parts.';

    return { correct: allCorrect, marks, message };
}
