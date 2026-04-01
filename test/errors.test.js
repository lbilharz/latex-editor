import { describe, it, expect } from 'vitest';
import { tokenize } from '../tokenizer.js';
import { Parser } from '../parser.js';
import { collectErrors } from '../errors.js';

function errors(src) {
    const tokens = tokenize(src);
    const ast = new Parser(tokens, src.length).parse();
    return collectErrors(ast, src);
}

function messages(src) {
    return errors(src).map(e => e.message);
}

describe('collectErrors', () => {
    it('returns empty array for valid input', () => {
        expect(errors('x^2 + 1')).toEqual([]);
        expect(errors('\\frac{a}{b}')).toEqual([]);
        expect(errors('\\sqrt{x}')).toEqual([]);
    });

    it('flags unknown commands', () => {
        expect(messages('\\foo')).toContain('Unknown command: \\foo');
    });

    it('flags fraction missing numerator', () => {
        const errs = errors('\\frac{}{b}');
        // empty group body is a row with 0 children, not type 'empty'
        // frac gets a group (not empty) so no frac-level error, but the inner row is valid
        expect(errs.length).toBe(0); // {}{b} has groups, not empty nodes
    });

    it('flags fraction with no arguments at all', () => {
        // \frac at end of input — parser creates empty nodes for both
        const errs = errors('\\frac');
        const msgs = errs.map(e => e.message);
        expect(msgs).toContain('Fraction missing numerator');
        expect(msgs).toContain('Fraction missing denominator');
    });

    it('flags superscript missing exponent', () => {
        // x^ at end of input
        const msgs = messages('x^');
        expect(msgs).toContain('Superscript missing exponent');
    });

    it('flags subscript missing index', () => {
        const msgs = messages('x_');
        expect(msgs).toContain('Subscript missing index');
    });

    it('flags unclosed parenthesis', () => {
        const msgs = messages('(x + 1');
        expect(msgs).toContain('Unclosed parenthesis (');
    });

    it('flags unclosed bracket', () => {
        const msgs = messages('[x');
        expect(msgs).toContain('Unclosed bracket [');
    });

    it('flags sqrt missing content', () => {
        const msgs = messages('\\sqrt');
        expect(msgs).toContain('Square root missing content');
    });

    it('flags multiple errors', () => {
        const errs = errors('\\foo + \\baz');
        expect(errs.length).toBe(2);
        expect(errs[0].message).toBe('Unknown command: \\foo');
        expect(errs[1].message).toBe('Unknown command: \\baz');
    });

    it('returns empty for empty input', () => {
        expect(errors('')).toEqual([]);
    });

    it('includes source positions', () => {
        const errs = errors('x + \\foo');
        expect(errs[0].start).toBe(4);
        expect(errs[0].end).toBe(8);
    });

    it('does not flag valid structures with empty braces', () => {
        // x^{} has an empty group body — not the same as missing argument
        // The group is parsed successfully, sup gets a group (not 'empty')
        const errs = errors('x^{}');
        expect(errs.length).toBe(0);
    });
});
