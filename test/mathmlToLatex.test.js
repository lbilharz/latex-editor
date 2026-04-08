// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { mathmlToLatex } from '../src/mathmlToLatex.js';
import { renderMath } from '../src/core.js';

describe('mathmlToLatex', () => {
    it('converts a simple variable', () => {
        expect(mathmlToLatex('<math><mi>x</mi></math>')).toBe('x');
    });

    it('converts a number', () => {
        expect(mathmlToLatex('<math><mn>42</mn></math>')).toBe('42');
    });

    it('converts an operator', () => {
        expect(mathmlToLatex('<math><mo>+</mo></math>')).toBe('+');
    });

    it('converts a fraction', () => {
        expect(mathmlToLatex('<math><mfrac><mn>1</mn><mn>2</mn></mfrac></math>')).toBe('\\frac{1}{2}');
    });

    it('converts a square root', () => {
        expect(mathmlToLatex('<math><msqrt><mi>x</mi></msqrt></math>')).toBe('\\sqrt{x}');
    });

    it('converts an nth root', () => {
        expect(mathmlToLatex('<math><mroot><mn>8</mn><mn>3</mn></mroot></math>')).toBe('\\sqrt[3]{8}');
    });

    it('converts a superscript', () => {
        expect(mathmlToLatex('<math><msup><mi>x</mi><mn>2</mn></msup></math>')).toBe('x^{2}');
    });

    it('converts a subscript', () => {
        expect(mathmlToLatex('<math><msub><mi>x</mi><mn>1</mn></msub></math>')).toBe('x_{1}');
    });

    it('converts a subsup', () => {
        expect(mathmlToLatex('<math><msubsup><mi>x</mi><mn>1</mn><mn>2</mn></msubsup></math>')).toBe('x_{1}^{2}');
    });

    it('converts Greek letters', () => {
        expect(mathmlToLatex('<math><mi>α</mi></math>')).toBe('\\alpha');
        expect(mathmlToLatex('<math><mi>π</mi></math>')).toBe('\\pi');
    });

    it('converts special operators', () => {
        expect(mathmlToLatex('<math><mo>±</mo></math>')).toBe('\\pm');
        expect(mathmlToLatex('<math><mo>≤</mo></math>')).toBe('\\le');
    });

    it('converts function names', () => {
        expect(mathmlToLatex('<math><mi mathvariant="normal">sin</mi></math>')).toBe('\\sin');
    });

    it('converts mtext to \\text{}', () => {
        expect(mathmlToLatex('<math><mtext>hello</mtext></math>')).toBe('\\text{hello}');
    });

    it('converts a binom (linethickness=0 frac)', () => {
        expect(mathmlToLatex('<math><mfrac linethickness="0"><mi>n</mi><mi>k</mi></mfrac></math>'))
            .toBe('\\binom{n}{k}');
    });

    it('converts nested structures', () => {
        const mathml = '<math><msqrt><mfrac><mrow><mi>a</mi><mo>+</mo><mi>b</mi></mrow><mi>c</mi></mfrac></msqrt></math>';
        expect(mathmlToLatex(mathml)).toBe('\\sqrt{\\frac{a+b}{c}}');
    });

    it('converts large operators', () => {
        expect(mathmlToLatex('<math><mo>∑</mo></math>')).toBe('\\sum');
        expect(mathmlToLatex('<math><mo>∫</mo></math>')).toBe('\\int');
    });

    it('prefers LaTeX annotation in semantics', () => {
        const mathml = '<math><semantics><mi>x</mi><annotation encoding="LaTeX">y+z</annotation></semantics></math>';
        expect(mathmlToLatex(mathml)).toBe('y+z');
    });
});

describe('renderMath bidirectional', () => {
    it('converts LaTeX to MathML when input is LaTeX', () => {
        const result = renderMath('x^2');
        expect(result).toContain('<msup');
        expect(result).toContain('<math');
    });

    it('converts MathML to LaTeX when input starts with <', () => {
        const result = renderMath('<math><mfrac><mn>1</mn><mn>2</mn></mfrac></math>');
        expect(result).toBe('\\frac{1}{2}');
    });

    it('round-trips LaTeX → MathML → LaTeX for simple expressions', () => {
        const cases = ['\\frac{1}{2}', '\\sqrt{x}', 'x^{2}', 'a+b'];
        for (const latex of cases) {
            const mathml = renderMath(latex);
            const back = renderMath(mathml);
            // Strip data-s/data-e attrs before comparing since they won't survive round-trip
            expect(back).toBe(latex);
        }
    });

    it('returns empty string for empty input', () => {
        expect(renderMath('')).toBe('');
        expect(renderMath('  ')).toBe('');
    });
});
