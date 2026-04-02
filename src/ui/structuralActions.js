export const STRUCTURAL_TYPES = new Set(['frac', 'sqrt', 'binom', 'over', 'under', 'textbox', 'matrix']);

/**
 * Find a structural node to delete when backspace/delete is pressed in MathML mode.
 * Returns { start, end, keep } where keep is the inner content to preserve,
 * or null if no structural deletion applies (fall back to single char).
 */
export function findStructuralDelete(ast, pos, direction, sourceText) {
    if (!ast) return null;

    let best = null;

    function walk(node) {
        if (!node) return;

        // Check if this structural node should be deleted
        if (STRUCTURAL_TYPES.has(node.type)) {
            const atEnd = direction === 'backward' && pos === node.end;
            const atStart = direction === 'forward' && pos === node.start;
            if (atEnd || atStart) {
                // Prefer innermost (smallest) match
                if (!best || (node.end - node.start) < (best.end - best.start)) {
                    best = { node, start: node.start, end: node.end };
                }
            }
        }

        // Also handle sup/sub: at the boundary, unwrap
        if (node.type === 'sup' || node.type === 'sub' || node.type === 'subsup') {
            const atEnd = direction === 'backward' && pos === node.end;
            const atStart = direction === 'forward' && pos === node.start;
            if (atEnd || atStart) {
                if (!best || (node.end - node.start) < (best.end - best.start)) {
                    best = { node, start: node.start, end: node.end };
                }
            }
        }

        // Walk children
        switch (node.type) {
            case 'row': node.children.forEach(walk); break;
            case 'group': walk(node.body); break;
            case 'frac': case 'binom': walk(node.num || node.top); walk(node.den || node.bot); break;
            case 'sqrt': if (node.index) walk(node.index); walk(node.body); break;
            case 'sup': case 'sub': walk(node.base); walk(node.sup || node.sub); break;
            case 'subsup': walk(node.base); walk(node.sub); walk(node.sup); break;
            case 'over': case 'under': walk(node.body); break;
            case 'delimited': walk(node.body); break;
        }
    }

    walk(ast);
    if (!best) return null;

    // Extract inner content to keep (the content inside the structure)
    const n = best.node;
    let keep = '';

    switch (n.type) {
        case 'frac':
        case 'binom': {
            const num = n.num || n.top;
            const den = n.den || n.bot;
            const numText = sourceText.slice(num.start, num.end);
            const denText = sourceText.slice(den.start, den.end);
            // Keep as "num / den" or just content if one side is empty
            if (numText && denText) keep = numText + '/' + denText;
            else keep = numText || denText;
            break;
        }
        case 'sqrt':
            keep = sourceText.slice(n.body.start, n.body.end);
            // Strip wrapping braces if present
            if (keep.startsWith('{') && keep.endsWith('}')) keep = keep.slice(1, -1);
            break;
        case 'sup':
        case 'sub':
        case 'subsup':
            // Keep just the base
            keep = sourceText.slice(n.base.start, n.base.end);
            break;
        case 'over':
        case 'under':
            keep = sourceText.slice(n.body.start, n.body.end);
            if (keep.startsWith('{') && keep.endsWith('}')) keep = keep.slice(1, -1);
            break;
        default:
            keep = '';
    }

    return { start: best.start, end: best.end, keep };
}

/**
 * Find the next empty group/placeholder position after (or before) the cursor.
 * Used for Tab navigation between fields in structures like \sqrt[]{} or \frac{}{}.
 */
export function findNextEmptyGroup(ast, pos, forward) {
    if (!ast) return null;
    const empties = [];

    function walk(node) {
        if (!node) return;
        switch (node.type) {
            case 'row':
                if (node.children.length === 0 && node.start !== undefined) {
                    empties.push(node.start);
                }
                node.children.forEach(walk);
                break;
            case 'group':
                if (!node.body || !node.body.children || node.body.children.length === 0) {
                    empties.push(node.start + 1); // inside the braces
                }
                walk(node.body);
                break;
            case 'frac': case 'binom':
                walk(node.num || node.top);
                walk(node.den || node.bot);
                break;
            case 'sqrt':
                if (node.index) walk(node.index);
                walk(node.body);
                break;
            case 'sup': case 'sub':
                walk(node.base);
                walk(node.sup || node.sub);
                break;
            case 'subsup':
                walk(node.base); walk(node.sub); walk(node.sup);
                break;
            case 'over': case 'under': case 'textbox':
                walk(node.body);
                break;
            case 'delimited':
                walk(node.body);
                break;
        }
    }

    walk(ast);
    empties.sort((a, b) => a - b);

    if (forward) {
        // Find first empty position after current cursor
        for (const p of empties) {
            if (p > pos) return p;
        }
        // Wrap around
        return empties[0] ?? null;
    } else {
        // Find last empty position before current cursor
        for (let i = empties.length - 1; i >= 0; i--) {
            if (empties[i] < pos) return empties[i];
        }
        return empties[empties.length - 1] ?? null;
    }
}
