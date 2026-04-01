// validate.js — Mock MathCore validation
// Evaluates simple arithmetic from AST, compares student vs expected.
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
 * Try to evaluate an AST node to a numeric value.
 * Returns a number or null if the expression contains variables/unknowns.
 */
export function evaluate(node) {
    if (!node) return null;

    switch (node.type) {
        case 'number':
            return parseFloat(node.value);

        case 'row': {
            // Evaluate as a sequence of terms with +/- operators
            // e.g. [3, +, 4, -, 1] → 6
            if (node.children.length === 0) return null;
            if (node.children.length === 1) return evaluate(node.children[0]);

            let result = null;
            let op = '+';
            for (const child of node.children) {
                if (child.type === 'operator') {
                    const v = child.value;
                    if (v === '+' || v === '-' || v === '−') {
                        op = (v === '+') ? '+' : '-';
                    } else if (v === '×' || v === '*' || v === '·') {
                        op = '*';
                    } else {
                        // Unknown operator — can't evaluate
                        return null;
                    }
                    continue;
                }
                const val = evaluate(child);
                if (val === null) return null;
                if (result === null) {
                    result = (op === '-') ? -val : val;
                } else {
                    if (op === '+') result += val;
                    else if (op === '-') result -= val;
                    else if (op === '*') result *= val;
                }
                op = '+'; // reset for implicit addition
            }
            return result;
        }

        case 'group':
            return evaluate(node.body);

        case 'delimited':
            return evaluate(node.body);

        case 'frac': {
            const num = evaluate(node.num);
            const den = evaluate(node.den);
            if (num === null || den === null || den === 0) return null;
            return num / den;
        }

        case 'sqrt': {
            if (node.index) {
                const idx = evaluate(node.index);
                const body = evaluate(node.body);
                if (idx === null || body === null) return null;
                return Math.pow(body, 1 / idx);
            }
            const body = evaluate(node.body);
            if (body === null || body < 0) return null;
            return Math.sqrt(body);
        }

        case 'sup': {
            const base = evaluate(node.base);
            const exp = evaluate(node.sup);
            if (base === null || exp === null) return null;
            return Math.pow(base, exp);
        }

        case 'sub':
            // Subscript doesn't change value (x_1 is still x)
            return evaluate(node.base);

        case 'subsup': {
            const base = evaluate(node.base);
            const exp = evaluate(node.sup);
            if (base === null || exp === null) return null;
            return Math.pow(base, exp);
        }

        case 'variable':
        case 'symbol-ident':
            return null; // can't evaluate variables

        case 'operator':
            return null; // operators handled by row

        default:
            return null;
    }
}

/**
 * Parse a LaTeX string into an AST.
 */
function parseLatex(src) {
    const tokens = tokenize(src);
    return new Parser(tokens, src.length).parse();
}

/**
 * Split an AST at '=' operators into segments.
 * Returns array of { node, start, end } for each side.
 */
function splitAtEquals(ast) {
    if (ast.type !== 'row') return [{ node: ast, start: ast.start, end: ast.end }];

    const segments = [];
    let current = [];
    let segStart = ast.start;

    for (const child of ast.children) {
        if (child.type === 'operator' && child.value === '=') {
            if (current.length > 0) {
                const segEnd = current[current.length - 1].end;
                const node = current.length === 1 ? current[0]
                    : { type: 'row', children: current, start: segStart, end: segEnd };
                segments.push({ node, start: segStart, end: segEnd });
            }
            current = [];
            segStart = child.end;
        } else {
            current.push(child);
        }
    }

    if (current.length > 0) {
        const segEnd = current[current.length - 1].end;
        const node = current.length === 1 ? current[0]
            : { type: 'row', children: current, start: segStart, end: segEnd };
        segments.push({ node, start: segStart, end: segEnd });
    }

    return segments;
}

/**
 * Compare two numbers with floating point tolerance.
 */
function approxEqual(a, b, eps = 1e-9) {
    return Math.abs(a - b) < eps;
}

/**
 * Compare student input against expected answer.
 * Uses evaluation where possible, falls back to leaf comparison.
 * Returns { correct, marks, message }
 */
export function validateAnswer(studentSrc, expectedSrc) {
    const studentAST = parseLatex(studentSrc);
    const expectedAST = parseLatex(expectedSrc);

    const studentSegments = splitAtEquals(studentAST);
    const expectedSegments = splitAtEquals(expectedAST);

    const marks = [];
    let allCorrect = true;

    // Compare segment by segment (sides of equation)
    const maxSegs = Math.max(studentSegments.length, expectedSegments.length);

    for (let i = 0; i < maxSegs; i++) {
        const sSeg = studentSegments[i];
        const eSeg = expectedSegments[i];

        if (!sSeg) {
            // Student has fewer segments — missing
            allCorrect = false;
            continue;
        }

        if (!eSeg) {
            // Student has extra segments
            allCorrect = false;
            markSegment(sSeg, 'extra', marks);
            continue;
        }

        // Try numeric evaluation first
        const sVal = evaluate(sSeg.node);
        const eVal = evaluate(eSeg.node);

        if (sVal !== null && eVal !== null) {
            // Both evaluate to numbers — compare values
            if (approxEqual(sVal, eVal)) {
                markSegment(sSeg, 'correct', marks);
            } else {
                markSegment(sSeg, 'incorrect', marks);
                allCorrect = false;
            }
        } else {
            // Fall back to leaf-by-leaf comparison
            const sLeaves = extractLeaves(sSeg.node).filter(l => l.value !== '/');
            const eLeaves = extractLeaves(eSeg.node).filter(l => l.value !== '/');

            for (let j = 0; j < sLeaves.length; j++) {
                const sl = sLeaves[j];
                if (j < eLeaves.length) {
                    if (sl.value === eLeaves[j].value) {
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

            if (eLeaves.length > sLeaves.length) {
                allCorrect = false;
            }
        }
    }

    const message = allCorrect ? 'Correct!' : 'Not quite — check the highlighted parts.';
    return { correct: allCorrect, marks, message };
}

/**
 * Mark all leaves in a segment with the given status.
 */
function markSegment(seg, status, marks) {
    const leaves = extractLeaves(seg.node).filter(l => l.value !== '/');
    for (const l of leaves) {
        marks.push({ start: l.start, end: l.end, status });
    }
}
