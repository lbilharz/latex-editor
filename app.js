// app.js — Main editor wiring: state, rendering, events, mode switching

import { SYMBOLS, FUNCTIONS, LARGE_OPS } from './data.js';
import { tokenize } from './tokenizer.js';
import { Parser } from './parser.js';
import { toMathML } from './renderer.js';
import { updateCursor, clickToSourcePos, getNavigableStops } from './cursor.js';
import { collectErrors } from './errors.js';
import { validateAnswer } from './validate.js';


// ── DOM Elements ──

const input       = document.getElementById('latex-src');
const mathDisplay = document.getElementById('math-display');
const cursorEl    = document.getElementById('cursor');
const placeholder = document.getElementById('placeholder');
const debugOut    = document.getElementById('debug-out');
const announce    = document.getElementById('math-announce');
const upperSection = document.querySelector('.editor-upper');
const lowerSection = document.querySelector('.editor-lower');
const suggestions = document.getElementById('suggestions');
const errorStrip  = document.getElementById('error-strip');
const exerciseBar = document.getElementById('exercise-bar');
const exercisePrompt = document.getElementById('exercise-prompt');
const exerciseResult = document.getElementById('exercise-result');
const checkBtn    = document.getElementById('check-btn');
const exitExBtn   = document.getElementById('exit-exercise-btn');


// ── State ──

let lastValue = '';
let activeMode = 'latex';
let mathCursorPos = 0;
let currentAST = null;
let navigableStops = [];
let currentExercise = null; // { prompt, answer }


// ── Suggestions ──

const STRUCTURAL_CMDS = ['\\frac', '\\sqrt', '\\binom', '\\vec', '\\overline', '\\hat', '\\tilde',
    '\\dot', '\\ddot', '\\bar', '\\ol', '\\underbrace', '\\overbrace', '\\mat', '\\text'];

const ALL_COMMANDS = [
    ...Object.keys(SYMBOLS),
    ...Array.from(FUNCTIONS).map(f => '\\' + f),
    ...Object.keys(LARGE_OPS),
    ...STRUCTURAL_CMDS,
];

function updateSuggestions() {
    if (activeMode !== 'latex') {
        suggestions.innerHTML = '';
        return;
    }
    const val = input.value;
    const pos = input.selectionStart;
    const before = val.slice(0, pos);
    const match = before.match(/\\([a-zA-Z]+)$/);
    if (!match) {
        suggestions.innerHTML = '';
        return;
    }
    const prefix = '\\' + match[1];
    // Don't show suggestions if prefix already matches a complete command exactly
    const exactMatch = ALL_COMMANDS.includes(prefix);
    const hits = ALL_COMMANDS.filter(c => c.startsWith(prefix) && c !== prefix).slice(0, 8);
    if (hits.length === 0 || (exactMatch && hits.length === 0)) {
        suggestions.innerHTML = '';
        return;
    }
    suggestions.innerHTML = hits.map(c =>
        `<button class="suggestion-chip" data-cmd="${c}">${c}</button>`
    ).join('');
}

suggestions.addEventListener('click', (e) => {
    const chip = e.target.closest('.suggestion-chip');
    if (!chip) return;
    const cmd = chip.dataset.cmd;
    const val = input.value;
    const pos = input.selectionStart;
    const before = val.slice(0, pos);
    const match = before.match(/\\[a-zA-Z]*$/);
    if (!match) return;
    const replaceStart = pos - match[0].length;
    input.value = val.slice(0, replaceStart) + cmd + val.slice(pos);
    const newPos = replaceStart + cmd.length;
    input.focus();
    input.setSelectionRange(newPos, newPos);
    lastValue = '';
    render();
    suggestions.innerHTML = '';
});


// ── Structure-aware deletion ──

const STRUCTURAL_TYPES = new Set(['frac', 'sqrt', 'binom', 'over', 'under', 'textbox', 'matrix']);

/**
 * Find a structural node to delete when backspace/delete is pressed in MathML mode.
 * Returns { start, end, keep } where keep is the inner content to preserve,
 * or null if no structural deletion applies (fall back to single char).
 */
function findStructuralDelete(ast, pos, direction) {
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
    const src = input.value;
    const n = best.node;
    let keep = '';

    switch (n.type) {
        case 'frac':
        case 'binom': {
            const num = n.num || n.top;
            const den = n.den || n.bot;
            const numText = src.slice(num.start, num.end);
            const denText = src.slice(den.start, den.end);
            // Keep as "num / den" or just content if one side is empty
            if (numText && denText) keep = numText + '/' + denText;
            else keep = numText || denText;
            break;
        }
        case 'sqrt':
            keep = src.slice(n.body.start, n.body.end);
            // Strip wrapping braces if present
            if (keep.startsWith('{') && keep.endsWith('}')) keep = keep.slice(1, -1);
            break;
        case 'sup':
        case 'sub':
        case 'subsup':
            // Keep just the base
            keep = src.slice(n.base.start, n.base.end);
            break;
        case 'over':
        case 'under':
            keep = src.slice(n.body.start, n.body.end);
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
function findNextEmptyGroup(ast, pos, forward) {
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


// ── Render ──

function render() {
    const src = input.value;
    if (src && src === lastValue && mathDisplay.querySelector('math')) {
        const cp = activeMode === 'latex' ? input.selectionStart : mathCursorPos;
        updateCursor(cp, mathDisplay, cursorEl);
        return;
    }
    lastValue = src;

    if (!src.trim()) {
        const existingMath = mathDisplay.querySelector('math');
        if (existingMath) existingMath.remove();
        placeholder.style.display = '';
        cursorEl.style.display = 'none';
        debugOut.textContent = '(empty)';
        announce.textContent = 'Empty formula';
        navigableStops = [0];
        displayErrors([]);
        return;
    }

    placeholder.style.display = 'none';

    const tokens = tokenize(src);
    const parser = new Parser(tokens, src.length);
    let ast;
    try {
        ast = parser.parse();
    } catch (err) {
        debugOut.textContent = 'Parse error: ' + err.message;
        return;
    }

    currentAST = ast;
    navigableStops = getNavigableStops(ast, src.length);

    // Collect and display errors
    const errors = collectErrors(ast, src);
    displayErrors(errors);

    const mathml = `<math display="block" xmlns="http://www.w3.org/1998/Math/MathML">${toMathML(ast)}</math>`;

    const existing = mathDisplay.querySelector('math');
    if (existing) existing.remove();

    const template = document.createElement('template');
    template.innerHTML = mathml;
    mathDisplay.insertBefore(template.content.firstChild, cursorEl);

    const cursorPos = activeMode === 'latex' ? input.selectionStart : mathCursorPos;
    updateCursor(cursorPos, mathDisplay, cursorEl);

    const mathEl = mathDisplay.querySelector('math');
    if (mathEl) {
        announce.textContent = 'Formula: ' + mathEl.textContent;
    }

    debugOut.textContent =
        'Source: ' + src + '\n' +
        'Cursor: ' + input.selectionStart + '\n' +
        'Tokens: ' + tokens.length + '\n' +
        'Stops: ' + JSON.stringify(navigableStops) + '\n' +
        'AST:\n' + JSON.stringify(ast, null, 2).slice(0, 2000);
}


// ── Error Display ──

function displayErrors(errors) {
    if (!errorStrip) return;

    if (errors.length === 0) {
        errorStrip.innerHTML = '';
        errorStrip.hidden = true;
        input.classList.remove('has-errors');
        return;
    }

    input.classList.add('has-errors');
    errorStrip.hidden = false;

    // Deduplicate by message (e.g. "Missing argument" can appear twice for \frac{}{})
    const unique = [];
    const seen = new Set();
    for (const e of errors) {
        const key = e.message + ':' + e.start;
        if (!seen.has(key)) { seen.add(key); unique.push(e); }
    }

    errorStrip.innerHTML = unique.map(e => {
        const posLabel = e.start === e.end ? `pos ${e.start}` : `pos ${e.start}–${e.end}`;
        return `<span class="error-item" data-start="${e.start}" data-end="${e.end}">`
             + `<span class="error-dot"></span>${esc(e.message)}`
             + `<span class="error-pos">${posLabel}</span></span>`;
    }).join('');

    // Click an error to jump cursor to that position
    errorStrip.querySelectorAll('.error-item').forEach(item => {
        item.addEventListener('click', () => {
            const pos = +item.dataset.start;
            if (activeMode === 'latex') {
                input.focus();
                input.setSelectionRange(pos, +item.dataset.end);
            } else {
                mathCursorPos = snapToNearestStop(pos);
            }
            syncVisual();
        });
    });

    // Announce first error to screen reader
    announce.textContent = `Error: ${unique[0].message}`;
}

function esc(s) {
    const el = document.createElement('span');
    el.textContent = s;
    return el.innerHTML;
}


// ── Selection Highlights ──

function clearSelectionOverlays() {
    mathDisplay.querySelectorAll('.sel-overlay').forEach(el => el.remove());
}

function updateSelectionHighlight() {
    clearSelectionOverlays();

    if (activeMode !== 'latex') return;
    if (document.activeElement !== input) return;
    const selStart = input.selectionStart;
    const selEnd = input.selectionEnd;
    if (selStart === selEnd) return;

    cursorEl.style.display = 'none';

    const mathTag = mathDisplay.querySelector('math');
    if (!mathTag) return;
    const containerRect = mathDisplay.getBoundingClientRect();

    mathTag.querySelectorAll('[data-s][data-e]').forEach(el => {
        const s = +el.dataset.s;
        const e = +el.dataset.e;
        if (s >= selEnd || e <= selStart) return;
        if (el.querySelector('[data-s]')) return;

        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;

        const range = e - s;
        const overlapStart = Math.max(s, selStart);
        const overlapEnd = Math.min(e, selEnd);

        let left, width;
        if (range === 0) {
            left = rect.left;
            width = rect.width;
        } else {
            const ratioStart = (overlapStart - s) / range;
            const ratioEnd = (overlapEnd - s) / range;
            left = rect.left + ratioStart * rect.width;
            width = (ratioEnd - ratioStart) * rect.width;
        }

        const overlay = document.createElement('div');
        overlay.className = 'sel-overlay';
        overlay.style.left = (left - containerRect.left) + 'px';
        overlay.style.top = (rect.top - containerRect.top) + 'px';
        overlay.style.width = width + 'px';
        overlay.style.height = rect.height + 'px';
        mathDisplay.appendChild(overlay);
    });
}


// ── Mode Switching ──

function snapToNearestStop(pos) {
    if (navigableStops.length === 0) return pos;
    let best = navigableStops[0];
    let bestDist = Math.abs(pos - best);
    for (const s of navigableStops) {
        const d = Math.abs(pos - s);
        if (d < bestDist) { bestDist = d; best = s; }
    }
    return best;
}

function updateModeVisuals() {
    if (activeMode === 'mathml') {
        upperSection.classList.add('mode-active');
        upperSection.classList.remove('mode-inactive');
        lowerSection.classList.add('mode-inactive');
        lowerSection.classList.remove('mode-active');
        input.classList.add('mode-inactive');
        input.classList.remove('mode-active');
    } else {
        upperSection.classList.remove('mode-active');
        upperSection.classList.add('mode-inactive');
        lowerSection.classList.remove('mode-inactive');
        lowerSection.classList.add('mode-active');
        input.classList.add('mode-active');
        input.classList.remove('mode-inactive');
    }
}

function setMode(newMode) {
    if (newMode === activeMode) return;

    if (newMode === 'mathml') {
        mathCursorPos = snapToNearestStop(input.selectionStart);
        activeMode = 'mathml';
        input.blur();
        mathDisplay.focus();
        suggestions.innerHTML = '';
    } else {
        activeMode = 'latex';
        input.focus();
        input.setSelectionRange(mathCursorPos, mathCursorPos);
    }

    updateModeVisuals();
    syncVisual();
}


// ── Visual Sync ──

function syncVisual() {
    if (activeMode === 'latex') {
        const selStart = input.selectionStart;
        const selEnd = input.selectionEnd;
        if (selStart === selEnd) {
            updateCursor(selStart, mathDisplay, cursorEl);
            clearSelectionOverlays();
        } else {
            updateSelectionHighlight();
        }
    } else {
        clearSelectionOverlays();
        updateCursor(mathCursorPos, mathDisplay, cursorEl);
        cursorEl.style.display = 'block';
    }
}


// ── Event Listeners: Input ──

input.addEventListener('input', () => {
    render();
    updateSuggestions();
});

input.addEventListener('keyup', syncVisual);
input.addEventListener('click', () => {
    syncVisual();
    updateSuggestions();
});
input.addEventListener('select', syncVisual);

input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        e.preventDefault();
        setMode('mathml');
    }
});

input.addEventListener('focus', () => {
    if (activeMode !== 'latex') {
        activeMode = 'latex';
    }
    updateModeVisuals();
});

input.addEventListener('blur', () => {
    setTimeout(() => {
        if (document.activeElement !== mathDisplay) {
            cursorEl.style.display = 'none';
            clearSelectionOverlays();
            upperSection.classList.remove('mode-active');
            lowerSection.classList.remove('mode-active');
            input.classList.remove('mode-active');
        }
    }, 0);
});


// ── Event Listeners: MathML Display ──

mathDisplay.addEventListener('keydown', (e) => {
    if (activeMode !== 'mathml') return;

    const src = input.value;

    if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const idx = navigableStops.indexOf(mathCursorPos);
        if (idx > 0) mathCursorPos = navigableStops[idx - 1];
        else if (idx === -1) mathCursorPos = snapToNearestStop(mathCursorPos);
        syncVisual();
        return;
    }

    if (e.key === 'ArrowRight') {
        e.preventDefault();
        const idx = navigableStops.indexOf(mathCursorPos);
        if (idx >= 0 && idx < navigableStops.length - 1) mathCursorPos = navigableStops[idx + 1];
        else if (idx === -1) mathCursorPos = snapToNearestStop(mathCursorPos);
        syncVisual();
        return;
    }

    if (e.key === 'Backspace') {
        e.preventDefault();
        clearValidationMarks();
        if (mathCursorPos > 0) {
            const del = findStructuralDelete(currentAST, mathCursorPos, 'backward');
            if (del) {
                input.value = src.slice(0, del.start) + del.keep + src.slice(del.end);
                mathCursorPos = del.start;
            } else {
                input.value = src.slice(0, mathCursorPos - 1) + src.slice(mathCursorPos);
                mathCursorPos--;
            }
            lastValue = '';
            render();
            mathCursorPos = snapToNearestStop(mathCursorPos);
            syncVisual();
        }
        return;
    }

    if (e.key === 'Delete') {
        e.preventDefault();
        clearValidationMarks();
        if (mathCursorPos < src.length) {
            const del = findStructuralDelete(currentAST, mathCursorPos, 'forward');
            if (del) {
                input.value = src.slice(0, del.start) + del.keep + src.slice(del.end);
            } else {
                input.value = src.slice(0, mathCursorPos) + src.slice(mathCursorPos + 1);
            }
            lastValue = '';
            render();
            mathCursorPos = snapToNearestStop(mathCursorPos);
            syncVisual();
        }
        return;
    }

    if (e.key === 'Escape') {
        e.preventDefault();
        setMode('latex');
        return;
    }

    if (e.key === 'Tab') {
        e.preventDefault();
        // Jump to the next empty placeholder (e.g. from [] to {} in \sqrt[3]{})
        const nextEmpty = findNextEmptyGroup(currentAST, mathCursorPos, !e.shiftKey);
        if (nextEmpty !== null) {
            mathCursorPos = nextEmpty;
            syncVisual();
        }
        return;
    }

    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        clearValidationMarks();
        input.value = src.slice(0, mathCursorPos) + e.key + src.slice(mathCursorPos);
        mathCursorPos++;
        lastValue = '';
        render();
        mathCursorPos = snapToNearestStop(mathCursorPos);
        syncVisual();
        return;
    }
});

mathDisplay.addEventListener('blur', () => {
    setTimeout(() => {
        if (document.activeElement !== input) {
            cursorEl.style.display = 'none';
            clearSelectionOverlays();
            upperSection.classList.remove('mode-active');
            input.classList.remove('mode-active');
        }
    }, 0);
});

mathDisplay.addEventListener('mousedown', (e) => {
    e.preventDefault();

    if (activeMode !== 'mathml') {
        setMode('mathml');
    }

    const pos = clickToSourcePos(e, mathDisplay);

    if (pos !== null) {
        mathCursorPos = snapToNearestStop(Math.max(0, Math.min(pos, input.value.length)));
    } else {
        mathCursorPos = input.value.length;
    }

    syncVisual();
});


// ── Structure Buttons (generic via data attributes) ──

function insertStructure(template, cursorOffset) {
    const src = input.value;
    const pos = activeMode === 'latex' ? input.selectionStart : mathCursorPos;
    const selEnd = activeMode === 'latex' ? input.selectionEnd : mathCursorPos;

    input.value = src.slice(0, pos) + template + src.slice(selEnd);
    const newPos = pos + cursorOffset;

    lastValue = '';

    if (activeMode === 'latex') {
        input.focus();
        input.setSelectionRange(newPos, newPos);
    } else {
        mathCursorPos = newPos;
        mathDisplay.focus();
    }

    render();
    if (activeMode === 'mathml') {
        mathCursorPos = snapToNearestStop(mathCursorPos);
    }
    syncVisual();
}

document.querySelectorAll('.math-toolbar button[data-insert]').forEach(btn => {
    btn.addEventListener('mousedown', (e) => {
        e.preventDefault(); // don't steal focus
    });
    btn.addEventListener('click', () => {
        insertStructure(btn.dataset.insert, +(btn.dataset.offset || 0));
    });
});


// ── Example Buttons ──

document.querySelectorAll('.example-grid button[data-latex]').forEach(btn => {
    btn.addEventListener('click', () => {
        input.value = btn.dataset.latex;
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
        lastValue = '';
        render();
        suggestions.innerHTML = '';
    });
});

// ── Show More Examples ──

const showMoreBtn = document.getElementById('show-more-examples');
const moreExamples = document.getElementById('example-grid-more');
if (showMoreBtn && moreExamples) {
    showMoreBtn.addEventListener('click', () => {
        const isHidden = moreExamples.hidden;
        moreExamples.hidden = !isHidden;
        showMoreBtn.textContent = isHidden ? 'Show fewer examples' : 'Show all 17 examples';
        showMoreBtn.setAttribute('aria-expanded', String(isHidden));
    });
    showMoreBtn.setAttribute('aria-expanded', 'false');
    showMoreBtn.setAttribute('aria-controls', 'example-grid-more');
}


// ── Exercise Mode ──

function enterExercise(prompt, answer, prefill) {
    currentExercise = { prompt, answer, prefill: prefill || '' };
    exerciseBar.hidden = false;
    exercisePrompt.textContent = prompt;
    exerciseResult.innerHTML = '';
    exerciseResult.className = 'exercise-result';
    clearValidationMarks();

    // Prefill input and place cursor at end
    input.value = prefill || '';
    lastValue = '';
    render();
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
}

function exitExercise() {
    currentExercise = null;
    exerciseBar.hidden = true;
    exerciseResult.innerHTML = '';
    exerciseResult.className = 'exercise-result';
    clearValidationMarks();
}

function checkAnswer() {
    if (!currentExercise) return;
    const studentSrc = input.value.trim();
    if (!studentSrc || studentSrc === currentExercise.prefill.trim()) {
        exerciseResult.textContent = 'Type your answer first.';
        exerciseResult.className = 'exercise-result result-hint';
        return;
    }

    const result = validateAnswer(studentSrc, currentExercise.answer);
    applyValidationMarks(result.marks);

    if (result.correct) {
        exerciseResult.textContent = 'Correct!';
        exerciseResult.className = 'exercise-result result-correct';
        announce.textContent = 'Correct answer!';
    } else {
        exerciseResult.textContent = 'Not quite — check the highlighted parts.';
        exerciseResult.className = 'exercise-result result-incorrect';
        announce.textContent = 'Incorrect. Check the highlighted parts.';
    }
}

function applyValidationMarks(marks) {
    clearValidationMarks();
    const mathTag = mathDisplay.querySelector('math');
    if (!mathTag) return;

    const elements = mathTag.querySelectorAll('[data-s][data-e]');
    for (const m of marks) {
        if (m.status !== 'incorrect') continue;

        // Collect bounding rects of all elements within the mark range
        const matched = [];
        for (const el of elements) {
            if (el.querySelector('[data-s]')) continue; // leaves only
            const s = +el.dataset.s;
            const e = +el.dataset.e;
            if (s >= m.start && e <= m.end) {
                matched.push(el);
            }
        }
        if (matched.length === 0) continue;

        // Compute a single bounding box over all matched elements
        const containerRect = mathDisplay.getBoundingClientRect();
        let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
        for (const el of matched) {
            const r = el.getBoundingClientRect();
            if (r.width === 0 && r.height === 0) continue;
            left = Math.min(left, r.left);
            top = Math.min(top, r.top);
            right = Math.max(right, r.right);
            bottom = Math.max(bottom, r.bottom);
        }
        if (left === Infinity) continue;

        // Create overlay box
        const overlay = document.createElement('div');
        overlay.className = 'mark-incorrect-overlay';
        const pad = 3;
        overlay.style.left = (left - containerRect.left - pad) + 'px';
        overlay.style.top = (top - containerRect.top - pad) + 'px';
        overlay.style.width = (right - left + pad * 2) + 'px';
        overlay.style.height = (bottom - top + pad * 2) + 'px';
        mathDisplay.appendChild(overlay);
    }
}

function clearValidationMarks() {
    mathDisplay.querySelectorAll('.mark-incorrect-overlay').forEach(el => el.remove());
}

// Exercise buttons
document.querySelectorAll('.exercise-grid button[data-answer]').forEach(btn => {
    btn.addEventListener('click', () => {
        enterExercise(btn.dataset.prompt, btn.dataset.answer, btn.dataset.prefill);
    });
});

// Check / exit buttons
if (checkBtn) checkBtn.addEventListener('click', checkAnswer);
if (exitExBtn) exitExBtn.addEventListener('click', exitExercise);

// Auto-check on typing (debounced)
let checkTimeout = null;
input.addEventListener('input', () => {
    if (!currentExercise) return;
    clearValidationMarks();
    exerciseResult.innerHTML = '';
    exerciseResult.className = 'exercise-result';

    // Debounce: wait 600ms after last keystroke before checking
    // Don't auto-check if input is still just the prefill
    clearTimeout(checkTimeout);
    const val = input.value.trim();
    if (val && val !== currentExercise.prefill.trim()) {
        checkTimeout = setTimeout(checkAnswer, 600);
    }
});


// ── Document-level Events ──

document.addEventListener('selectionchange', () => {
    if (document.activeElement === input && activeMode === 'latex') {
        syncVisual();
        updateSuggestions();
    }
});


// ── Initialize ──

updateModeVisuals();
render();
input.focus();
