import { describe, it, expect } from 'vitest';
import { tokenize } from '../src/tokenizer.js';
import { Parser } from '../src/parser.js';
import { toMathCoreXML } from '../src/export.js';

function exportXML(src) {
    const tokens = tokenize(src);
    const ast = new Parser(tokens, src.length).parse();
    return toMathCoreXML(ast, src);
}

describe('MathCore XML export', () => {
    it('wraps output in <math> with MathML namespace', () => {
        const xml = exportXML('x');
        expect(xml).toMatch(/^<math xmlns="http:\/\/www\.w3\.org\/1998\/Math\/MathML">/);
        expect(xml).toMatch(/<\/math>$/);
    });

    it('includes <semantics> wrapper', () => {
        const xml = exportXML('x');
        expect(xml).toContain('<semantics>');
        expect(xml).toContain('</semantics>');
    });

    it('includes LaTeX annotation', () => {
        const xml = exportXML('\\frac{1}{2}');
        expect(xml).toContain('<annotation encoding="LaTeX">\\frac{1}{2}</annotation>');
    });

    it('strips data-s and data-e attributes', () => {
        const xml = exportXML('x + y');
        expect(xml).not.toMatch(/data-s=/);
        expect(xml).not.toMatch(/data-e=/);
    });

    it('preserves MathML element structure', () => {
        const xml = exportXML('\\frac{a}{b}');
        expect(xml).toContain('<mfrac>');
        expect(xml).toContain('</mfrac>');
        expect(xml).toContain('>a</mi>');
        expect(xml).toContain('>b</mi>');
    });

    it('escapes special XML characters in LaTeX source', () => {
        const xml = exportXML('a < b');
        expect(xml).toContain('a &lt; b</annotation>');
    });

    it('handles complex expressions', () => {
        const src = '\\sqrt{x^2 + y^2}';
        const xml = exportXML(src);
        expect(xml).toContain('<msqrt>');
        expect(xml).toContain('<msup>');
        expect(xml).not.toMatch(/data-[se]/);
    });

    it('handles empty input', () => {
        const xml = exportXML('');
        expect(xml).toContain('<math');
        expect(xml).toContain('<semantics>');
    });

    it('renders fraction from inline slash', () => {
        const xml = exportXML('1/2');
        expect(xml).toContain('<mfrac>');
        expect(xml).not.toMatch(/data-[se]/);
    });
});
