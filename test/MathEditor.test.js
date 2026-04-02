// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createMathEditor } from '../src/ui/MathEditor.js';

describe('MathEditor UI Integration', () => {
    let container;
    let editorApi;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
        
        global.localStorage = {
            getItem: () => null,
            setItem: () => {}
        };
        
        editorApi = createMathEditor(container);
    });

    afterEach(() => {
        document.body.removeChild(container);
    });

    it('initializes correctly into an empty container', () => {
        expect(container.querySelector('.editor-upper')).toBeTruthy();
        expect(container.querySelector('.editor-lower')).toBeTruthy();
        expect(container.querySelector('#latex-src')).toBeTruthy();
        const placeholder = container.querySelector('#placeholder');
        expect(placeholder).toBeTruthy();
        expect(placeholder.style.display).not.toBe('none'); // visible on init
    });

    it('syncs typing in linear latex to visual MathML', () => {
        const input = container.querySelector('#latex-src');
        const mathDisplay = container.querySelector('#math-display');

        input.value = '\\sqrt{x}';
        input.dispatchEvent(new Event('input')); 

        expect(container.querySelector('#placeholder').style.display).toBe('none');
        const mathTag = mathDisplay.querySelector('math');
        expect(mathTag).toBeTruthy();
        expect(mathTag.querySelector('msqrt')).toBeTruthy();
    });

    it('redirects click on empty mathml display to latex input seamlessly', () => {
        const input = container.querySelector('#latex-src');
        const mathDisplay = container.querySelector('#math-display');
        
        expect(input.value).toBe('');
        
        // This is a test for the empty-state bug fix where the user is trapped
        // in an empty mathml placeholder visually.
        mathDisplay.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
        
        // In JSDOM we can assure focus logic was called directly
        expect(input.classList.contains('mode-active')).toBe(true);
    });

    it('handles structural toolbar commands cleanly', () => {
        const input = container.querySelector('#latex-src');
        const fracBtn = container.querySelector('button[aria-label="Insert fraction"]');
        
        input.focus();
        fracBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        fracBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        
        expect(input.value).toBe('\\frac{}{}');
        
        // We evaluate navigation stops generation as a proxy for visual mode safety
        const mathTag = container.querySelector('#math-display math');
        expect(mathTag).toBeTruthy(); // Math tree must be present
        expect(mathTag.querySelector('mfrac')).toBeTruthy();
    });
});
