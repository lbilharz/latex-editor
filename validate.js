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
 * Returns { segments: [{ node, start, end }], equals: [{ start, end }] }
 */
function splitAtEquals(ast) {
    if (ast.type !== 'row') return { segments: [{ node: ast, start: ast.start, end: ast.end }], equals: [] };

    const segments = [];
    const equals = [];
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
            equals.push({ start: child.start, end: child.end });
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

    return { segments, equals };
}

/**
 * Compare two numbers with floating point tolerance.
 */
function approxEqual(a, b, eps = 1e-9) {
    return Math.abs(a - b) < eps;
}

/**
 * Split a row node into additive terms (at + and - operators).
 * Returns array of { sign, nodes } or null if not a simple additive expression.
 */
function splitTerms(node) {
    if (node.type !== 'row') return [node];

    const terms = [];
    let current = [];
    let sign = '+';

    for (const child of node.children) {
        if (child.type === 'operator' && (child.value === '+' || child.value === '-' || child.value === '−')) {
            if (current.length > 0) {
                terms.push({ sign, nodes: current });
            }
            sign = (child.value === '+') ? '+' : '-';
            current = [];
        } else {
            current.push(child);
        }
    }
    if (current.length > 0) {
        terms.push({ sign, nodes: current });
    }

    return terms.length > 0 ? terms : null;
}

/**
 * Create a canonical string signature for a term (sign + leaf values).
 * Used for unordered comparison of additive terms.
 */
function termSignature(term) {
    const node = term.nodes.length === 1 ? term.nodes[0]
        : { type: 'row', children: term.nodes, start: 0, end: 0 };
    const leaves = extractLeaves(node).filter(l => l.value !== '/').map(l => l.value);
    return term.sign + ':' + leaves.join(',');
}

/**
 * Compare student input against expected answer.
 * Uses evaluation where possible, falls back to leaf comparison.
 * Returns { correct, marks, message }
 */
export function validateAnswer(studentSrc, expectedSrc) {
    const studentAST = parseLatex(studentSrc);
    const expectedAST = parseLatex(expectedSrc);

    const { segments: studentSegments, equals: studentEquals } = splitAtEquals(studentAST);
    const { segments: expectedSegments } = splitAtEquals(expectedAST);

    const marks = [];
    let allCorrect = true;

    // Only validate the LAST segment (the student's answer).
    // Earlier segments are the prompt/given — marking them is pointless.
    // For bare expressions without '=', validate the whole thing.
    const hasEquals = studentEquals.length > 0;
    const lastStudentIdx = studentSegments.length - 1;
    const lastExpectedIdx = expectedSegments.length - 1;

    if (lastStudentIdx < 0 || lastExpectedIdx < 0) {
        // Empty input
        return { correct: false, marks: [], message: 'Not quite — check the highlighted parts.' };
    }

    if (hasEquals) {
        // Equation mode: only validate the last (answer) segment
        const sSeg = studentSegments[lastStudentIdx];
        const eSeg = expectedSegments[lastExpectedIdx];
        allCorrect = compareSegment(sSeg, eSeg, marks);
    } else {
        // No '=' — validate the entire expression
        const sSeg = studentSegments[0];
        const eSeg = expectedSegments[0];
        allCorrect = compareSegment(sSeg, eSeg, marks);
    }

    // '=' signs are part of the prompt structure — don't mark them.

    const message = allCorrect ? 'Correct!' : 'Not quite — check the highlighted parts.';
    return { correct: allCorrect, marks, message };
}

/**
 * Compare a student segment against an expected segment.
 * Only marks incorrect answers — correct answers get no marks.
 * When wrong, produces ONE mark spanning the entire answer segment.
 */
function compareSegment(sSeg, eSeg, marks) {
    if (!sSeg) return false;
    if (!eSeg) {
        marks.push({ start: sSeg.start, end: sSeg.end, status: 'incorrect' });
        return false;
    }

    // Try numeric evaluation first
    const sVal = evaluate(sSeg.node);
    const eVal = evaluate(eSeg.node);

    if (sVal !== null && eVal !== null) {
        if (approxEqual(sVal, eVal)) {
            return true;
        } else {
            marks.push({ start: sSeg.start, end: sSeg.end, status: 'incorrect' });
            return false;
        }
    }

    // Try unordered term comparison (addition is commutative)
    const sTerms = splitTerms(sSeg.node);
    const eTerms = splitTerms(eSeg.node);

    if (sTerms && eTerms && sTerms.length === eTerms.length) {
        // Normalize each term to a leaf string and compare as sets
        const sNorm = sTerms.map(termSignature).sort();
        const eNorm = eTerms.map(termSignature).sort();
        if (sNorm.every((t, i) => t === eNorm[i])) {
            return true;
        }
    }

    // Fall back to strict ordered leaf-by-leaf comparison
    const sLeaves = extractLeaves(sSeg.node).filter(l => l.value !== '/');
    const eLeaves = extractLeaves(eSeg.node).filter(l => l.value !== '/');

    if (sLeaves.length !== eLeaves.length) {
        marks.push({ start: sSeg.start, end: sSeg.end, status: 'incorrect' });
        return false;
    }

    for (let j = 0; j < sLeaves.length; j++) {
        if (sLeaves[j].value !== eLeaves[j].value) {
            marks.push({ start: sSeg.start, end: sSeg.end, status: 'incorrect' });
            return false;
        }
    }

    return true;
}
