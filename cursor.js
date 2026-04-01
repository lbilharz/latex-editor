// cursor.js — Cursor positioning, click mapping, and navigation stops

export function findBestElement(cursorPos, mathDisplay) {
    const mathTag = mathDisplay.querySelector('math');
    if (!mathTag) return null;

    const candidates = [];
    mathTag.querySelectorAll('[data-s][data-e]').forEach(el => {
        const childrenWithPos = el.querySelectorAll('[data-s]');
        candidates.push({ el, s: +el.dataset.s, e: +el.dataset.e, depth: childrenWithPos.length });
    });

    candidates.sort((a, b) => {
        const rangeA = a.e - a.s, rangeB = b.e - b.s;
        if (rangeA !== rangeB) return rangeA - rangeB;
        return a.depth - b.depth;
    });

    for (const c of candidates) {
        if (cursorPos >= c.s && cursorPos <= c.e) return c;
    }
    return null;
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
            const range = (+el.dataset.e) - (+el.dataset.s);
            if (range < bestRange) {
                bestRange = range;
                best = el;
            }
        }
    }

    if (!best) return null;

    const s = +best.dataset.s;
    const end = +best.dataset.e;
    const rect = best.getBoundingClientRect();
    const ratio = rect.width > 0 ? (e.clientX - rect.left) / rect.width : 0;
    return Math.round(s + ratio * (end - s));
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
