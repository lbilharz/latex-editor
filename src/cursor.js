// cursor.js — Cursor positioning, click mapping, and navigation stops

export function findBestElement(cursorPos, mathDisplay) {
    const mathTag = mathDisplay.querySelector('math');
    if (!mathTag) return null;

    const candidates = [];
    mathTag.querySelectorAll('[data-s][data-e]').forEach(el => {
        const childrenWithPos = el.querySelectorAll('[data-s]');
        candidates.push({ el, s: +el.getAttribute('data-s'), e: +el.getAttribute('data-e'), depth: childrenWithPos.length });
    });

    // Sort by smallest range first (leaf preference)
    candidates.sort((a, b) => {
        const rangeA = a.e - a.s, rangeB = b.e - b.s;
        if (rangeA !== rangeB) return rangeA - rangeB;
        return a.depth - b.depth;
    });

    // Find the smallest element containing cursorPos
    let best = null;
    for (const c of candidates) {
        if (cursorPos >= c.s && cursorPos <= c.e) { best = c; break; }
    }
    if (!best) return null;

    // At boundary: if a structural parent shares the SAME boundary,
    // prefer the parent so cursor appears before/after the whole structure.
    // Example: position 9 in "1/2 + 3/4" — mn(8-9) and mfrac(6-9) both end at 9,
    // so prefer mfrac. But position 7 — only mn(6-7) ends at 7, mfrac doesn't,
    // so keep mn.
    if (cursorPos === best.e || cursorPos === best.s) {
        for (const c of candidates) {
            if (c.e - c.s <= best.e - best.s) continue; // must be larger
            const shared = (cursorPos === best.e && cursorPos === c.e) ||
                           (cursorPos === best.s && cursorPos === c.s);
            if (shared) best = c; // keep going — largest ancestor with shared boundary wins
        }
    }

    return best;
}

export function computeCursorX(cursorPos, mathDisplay) {
    const best = findBestElement(cursorPos, mathDisplay);
    const mathTag = mathDisplay.querySelector('math');

    if (!best) {
        if (!mathTag) return null;
        return mathTag.getBoundingClientRect().right;
    }

    const rect = best.el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return null;

    if (best.e === best.s || cursorPos <= best.s) return rect.left;
    if (cursorPos >= best.e) return rect.right;
    const ratio = (cursorPos - best.s) / (best.e - best.s);
    return rect.left + ratio * rect.width;
}

export function updateCursor(cursorPos, mathDisplay, cursorEl) {
    const mathTag = mathDisplay.querySelector('math');
    if (!mathTag) { cursorEl.style.display = 'none'; return; }

    const best = findBestElement(cursorPos, mathDisplay);
    const containerRect = mathDisplay.getBoundingClientRect();

    if (!best) {
        const mathRect = mathTag.getBoundingClientRect();
        cursorEl.style.left = (mathRect.right - containerRect.left) + 'px';
        cursorEl.style.top  = (mathRect.top - containerRect.top) + 'px';
        cursorEl.style.height = mathRect.height + 'px';
        cursorEl.style.display = 'block';
        return;
    }

    const rect = best.el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
        cursorEl.style.display = 'none';
        return;
    }

    let x;
    if (best.e === best.s || cursorPos <= best.s) {
        x = rect.left;
    } else if (cursorPos >= best.e) {
        x = rect.right;
    } else {
        const ratio = (cursorPos - best.s) / (best.e - best.s);
        x = rect.left + ratio * rect.width;
    }

    cursorEl.style.left   = (x - containerRect.left) + 'px';
    cursorEl.style.top    = (rect.top - containerRect.top) + 'px';
    cursorEl.style.height = rect.height + 'px';
    cursorEl.style.display = 'block';
    // Restart blink animation
    cursorEl.style.animation = 'none';
    cursorEl.offsetHeight; // trigger reflow
    cursorEl.style.animation = '';
}

export function clickToSourcePos(e, mathDisplay) {
    const mathTag = mathDisplay.querySelector('math');
    if (!mathTag) return null;

    const allEls = mathTag.querySelectorAll('[data-s][data-e]');
    let best = null;
    let bestRange = Infinity;

    for (const el of allEls) {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;
        if (e.clientX >= rect.left - 2 && e.clientX <= rect.right + 2 &&
            e.clientY >= rect.top - 2 && e.clientY <= rect.bottom + 2) {
            const range = (+el.getAttribute('data-e')) - (+el.getAttribute('data-s'));
            if (range < bestRange) {
                bestRange = range;
                best = el;
            }
        }
    }

    if (!best) return null;

    const s = +best.getAttribute('data-s');
    const end = +best.getAttribute('data-e');
    const rect = best.getBoundingClientRect();
    const ratio = rect.width > 0 ? (e.clientX - rect.left) / rect.width : 0;
    return Math.round(s + ratio * (end - s));
}

// ── Structural Selection helpers ──

/**
 * Given a click event, find the smallest leaf element with data-s/data-e.
 * Returns { start, end, el } or null.
 */
export function clickToNode(e, mathDisplay) {
    const mathTag = mathDisplay.querySelector('math');
    if (!mathTag) return null;

    const allEls = mathTag.querySelectorAll('[data-s][data-e]');
    let best = null;
    let bestRange = Infinity;

    let bestIsLeaf = false;

    for (const el of allEls) {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;
        if (e.clientX >= rect.left - 2 && e.clientX <= rect.right + 2 &&
            e.clientY >= rect.top - 2 && e.clientY <= rect.bottom + 2) {
            const isLeaf = !el.querySelector('[data-s]');
            const range = (+el.getAttribute('data-e')) - (+el.getAttribute('data-s'));
            // Leaves get priority; among same leaf-ness, prefer smallest range
            if (isLeaf && (!best || !bestIsLeaf || range < bestRange)) {
                bestRange = range;
                bestIsLeaf = true;
                best = el;
            } else if (!isLeaf && !best) {
                bestRange = range;
                best = el;
            }
        }
    }

    if (!best) return null;
    return { start: +best.getAttribute('data-s'), end: +best.getAttribute('data-e'), el: best };
}

/**
 * Find the next or previous sibling node at the same tree level.
 * direction: 'left' or 'right'
 */
export function findSiblingNode(currentSel, direction, mathDisplay) {
    if (!currentSel || !currentSel.el) return null;
    const parent = currentSel.el.parentElement;
    if (!parent) return null;

    // Collect direct children of parent that have data-s/data-e
    const siblings = Array.from(parent.children).filter(
        el => el.hasAttribute('data-s') && el.hasAttribute('data-e')
    );
    const idx = siblings.indexOf(currentSel.el);
    if (idx === -1) return null;

    const newIdx = direction === 'left' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= siblings.length) return null;

    const el = siblings[newIdx];
    return { start: +el.getAttribute('data-s'), end: +el.getAttribute('data-e'), el };
}

/**
 * Find the parent node (the nearest ancestor with data-s/data-e).
 */
export function findParentNode(currentSel, mathDisplay) {
    if (!currentSel || !currentSel.el) return null;
    let parent = currentSel.el.parentElement;
    while (parent) {
        if (parent.hasAttribute && parent.hasAttribute('data-s') && parent.hasAttribute('data-e')) {
            return { start: +parent.getAttribute('data-s'), end: +parent.getAttribute('data-e'), el: parent };
        }
        parent = parent.parentElement;
    }
    return null;
}

/**
 * Find the first child node (first child with data-s/data-e).
 */
export function findChildNode(currentSel, mathDisplay) {
    if (!currentSel || !currentSel.el) return null;
    const child = currentSel.el.querySelector('[data-s][data-e]');
    if (!child || child === currentSel.el) return null;
    return { start: +child.getAttribute('data-s'), end: +child.getAttribute('data-e'), el: child };
}

/**
 * Add node-selected class to the given element, removing from all others.
 */
export function highlightNode(sel, mathDisplay) {
    clearNodeSelection(mathDisplay);
    if (sel && sel.el) {
        sel.el.classList.add('node-selected');
    }
}

/**
 * Remove all node-selected classes from mathDisplay.
 */
export function clearNodeSelection(mathDisplay) {
    mathDisplay.querySelectorAll('.node-selected').forEach(el => {
        el.classList.remove('node-selected');
    });
}

/**
 * Find the nearest selectable node to a given source position.
 * Returns { start, end, el } or null.
 */
export function findNodeAtPos(pos, mathDisplay) {
    const best = findBestElement(pos, mathDisplay);
    if (!best) return null;
    return { start: best.s, end: best.e, el: best.el };
}

export function getNavigableStops(ast, srcLen) {
    const stops = new Set([0, srcLen]);

    function walk(node) {
        if (!node) return;
        switch (node.type) {
            case 'number': case 'variable': case 'operator':
            case 'symbol-ident': case 'symbol-op': case 'function':
            case 'text': case 'largeop': case 'unknown':
                stops.add(node.start);
                stops.add(node.end);
                break;
            case 'delimited':
                stops.add(node.start);
                stops.add(node.start + 1);
                if (node.close) {
                    stops.add(node.end - 1);
                    stops.add(node.end);
                }
                walk(node.body);
                break;
            case 'row':
                node.children.forEach(walk);
                break;
            case 'group':
                // Add a stop inside empty groups (e.g. ^{} or _{})
                // so cursor can land between the braces
                if (!node.body || !node.body.children || node.body.children.length === 0) {
                    stops.add(node.start + 1); // position after '{'
                }
                walk(node.body);
                break;
            case 'frac': case 'binom':
                walk(node.num || node.top);
                walk(node.den || node.bot);
                break;
            case 'sqrt':
                if (node.index) {
                    // Add stop inside empty index (e.g. \sqrt[]{})
                    if (!node.index.children || node.index.children.length === 0) {
                        stops.add(node.index.start);
                    }
                    walk(node.index);
                }
                walk(node.body);
                break;
            case 'sup': case 'sub':
                walk(node.base);
                walk(node.sup || node.sub);
                break;
            case 'subsup':
                walk(node.base);
                walk(node.sub);
                walk(node.sup);
                break;
            case 'over': case 'under':
                walk(node.body);
                break;
            case 'textbox':
                walk(node.body);
                break;
            case 'matrix':
                for (const row of node.rows)
                    for (const cell of row) walk(cell);
                break;
            case 'empty':
                stops.add(node.start);
                break;
        }
    }

    walk(ast);
    return [...stops].sort((a, b) => a - b);
}
