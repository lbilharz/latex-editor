// mathmlToLatex.js — Convert MathML DOM or string to LaTeX

import { SYMBOLS, FUNCTIONS, LARGE_OPS } from './data.js';

// Build reverse lookup tables: Unicode char → LaTeX command
const CHAR_TO_LATEX = {};
for (const [cmd, ch] of Object.entries(SYMBOLS)) {
    // Prefer shorter command names when duplicates exist
    if (!CHAR_TO_LATEX[ch] || cmd.length < CHAR_TO_LATEX[ch].length) {
        CHAR_TO_LATEX[ch] = cmd;
    }
}
for (const [cmd, ch] of Object.entries(LARGE_OPS)) {
    if (!CHAR_TO_LATEX[ch] || cmd.length < CHAR_TO_LATEX[ch].length) {
        CHAR_TO_LATEX[ch] = cmd;
    }
}

/**
 * Convert a MathML string or DOM element to LaTeX.
 * @param {string|Element} input — MathML markup string or a DOM <math> element
 * @returns {string} LaTeX string
 */
export function mathmlToLatex(input) {
    let root;
    if (typeof input === 'string') {
        const doc = new DOMParser().parseFromString(input, 'application/xml');
        root = doc.documentElement;
        // Check for parse errors
        if (root.tagName === 'parsererror' || root.querySelector('parsererror')) {
            throw new Error('Invalid MathML: ' + root.textContent);
        }
    } else {
        root = input;
    }

    return convertNode(root).trim();
}

function convertNode(node) {
    if (node.nodeType === 3) { // text node
        return node.textContent.trim();
    }
    if (node.nodeType !== 1) return ''; // skip non-element nodes

    const tag = localName(node);

    switch (tag) {
        case 'math':
            return convertChildren(node);

        case 'semantics': {
            // If there's a LaTeX annotation, prefer it
            const annotation = node.querySelector('annotation[encoding="LaTeX"], annotation[encoding="application/x-tex"]');
            if (annotation) return annotation.textContent;
            // Otherwise convert the presentation MathML (first child)
            return node.firstElementChild ? convertNode(node.firstElementChild) : '';
        }

        case 'mrow':
            return convertChildren(node);

        case 'mn':
            return node.textContent.trim();

        case 'mi': {
            const text = node.textContent.trim();
            const variant = node.getAttribute('mathvariant');
            // Function names rendered as upright
            if (variant === 'normal' && FUNCTIONS.has(text)) {
                return '\\' + text;
            }
            // Check for special symbols (Greek, etc.)
            if (text.length === 1 && CHAR_TO_LATEX[text]) {
                return CHAR_TO_LATEX[text];
            }
            return text;
        }

        case 'mo': {
            const text = node.textContent.trim();
            if (CHAR_TO_LATEX[text]) return CHAR_TO_LATEX[text];
            // Stretchy delimiters handled by parent (mrow with fences)
            return text;
        }

        case 'mtext':
            return '\\text{' + node.textContent + '}';

        case 'mspace':
            return '';

        case 'mfrac': {
            const children = elements(node);
            if (children.length < 2) return '\\frac{}{}';
            const num = convertNode(children[0]);
            const den = convertNode(children[1]);
            const linethickness = node.getAttribute('linethickness');
            if (linethickness === '0') {
                return '\\binom{' + num + '}{' + den + '}';
            }
            return '\\frac{' + num + '}{' + den + '}';
        }

        case 'msqrt': {
            const body = convertChildren(node);
            return '\\sqrt{' + body + '}';
        }

        case 'mroot': {
            const children = elements(node);
            if (children.length < 2) return '\\sqrt{}';
            const body = convertNode(children[0]);
            const index = convertNode(children[1]);
            return '\\sqrt[' + index + ']{' + body + '}';
        }

        case 'msup': {
            const children = elements(node);
            if (children.length < 2) return '';
            const base = convertNode(children[0]);
            const sup = convertNode(children[1]);
            return wrapBase(base) + '^{' + sup + '}';
        }

        case 'msub': {
            const children = elements(node);
            if (children.length < 2) return '';
            const base = convertNode(children[0]);
            const sub = convertNode(children[1]);
            return wrapBase(base) + '_{' + sub + '}';
        }

        case 'msubsup': {
            const children = elements(node);
            if (children.length < 3) return '';
            const base = convertNode(children[0]);
            const sub = convertNode(children[1]);
            const sup = convertNode(children[2]);
            return wrapBase(base) + '_{' + sub + '}^{' + sup + '}';
        }

        case 'mover': {
            const children = elements(node);
            if (children.length < 2) return '';
            const body = convertNode(children[0]);
            const accent = children[1].textContent.trim();
            const cmd = OVER_ACCENTS[accent];
            if (cmd) return cmd + '{' + body + '}';
            return '\\overset{' + accent + '}{' + body + '}';
        }

        case 'munder': {
            const children = elements(node);
            if (children.length < 2) return '';
            const body = convertNode(children[0]);
            const accent = children[1].textContent.trim();
            const cmd = UNDER_ACCENTS[accent];
            if (cmd) return cmd + '{' + body + '}';
            return '\\underset{' + accent + '}{' + body + '}';
        }

        case 'mtable':
            return convertTable(node);

        case 'mtr':
            return elements(node).map(convertNode).join(' & ');

        case 'mtd':
            return convertChildren(node);

        case 'mpadded':
        case 'mstyle':
        case 'merror':
            return convertChildren(node);

        case 'annotation':
        case 'annotation-xml':
            return ''; // skip annotations (handled in semantics)

        default:
            // Unknown element — just convert children
            return convertChildren(node);
    }
}

const OVER_ACCENTS = {
    '\u20D7': '\\vec',   // combining right arrow above
    '\u2192': '\\vec',   // rightwards arrow
    '\u0302': '\\hat',   // combining circumflex
    '\u005E': '\\hat',   // circumflex
    '^': '\\hat',
    '\u0303': '\\tilde', // combining tilde
    '~': '\\tilde',
    '\u0304': '\\bar',   // combining macron
    '\u00AF': '\\bar',   // macron
    '\u0305': '\\overline', // combining overline
    '\u0307': '\\dot',   // combining dot above
    '\u0308': '\\ddot',  // combining diaeresis
    '¯': '\\overline',
};

const UNDER_ACCENTS = {
    '\u0332': '\\underline',
    '_': '\\underline',
};

function convertTable(node) {
    const rows = elements(node).filter(el => localName(el) === 'mtr');
    const body = rows.map(row => {
        const cells = elements(row).filter(el => localName(el) === 'mtd');
        return cells.map(convertNode).join(' & ');
    }).join(' \\\\ ');
    return '\\begin{matrix} ' + body + ' \\end{matrix}';
}

/** Convert all child elements, concatenated */
function convertChildren(node) {
    let result = '';
    for (const child of node.childNodes) {
        result += convertNode(child);
    }
    return result;
}

/** Get element children only (skip text/comment nodes) */
function elements(node) {
    return Array.from(node.children || []);
}

/** Get local name without namespace prefix */
function localName(el) {
    return (el.localName || el.tagName || '').replace(/^.*:/, '').toLowerCase();
}

/** Wrap multi-char base in braces for sup/sub */
function wrapBase(base) {
    // Single char or single command doesn't need braces
    if (base.length <= 1) return base;
    if (base.startsWith('\\') && !base.includes('{')) return base;
    return base;
}
