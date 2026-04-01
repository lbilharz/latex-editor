import { describe, it, expect } from 'vitest';
import { validateAnswer, extractLeaves, evaluate } from '../validate.js';
import { tokenize } from '../tokenizer.js';
import { Parser } from '../parser.js';

function parse(src) {
    const tokens = tokenize(src);
    return new Parser(tokens, src.length).parse();
}

function leaves(src) {
    return extractLeaves(parse(src)).filter(l => l.value !== '/').map(l => l.value);
}

describe('extractLeaves', () => {
    it('extracts leaves from a simple expression', () => {
        expect(leaves('2 + 3')).toEqual(['2', '+', '3']);
    });

    it('extracts leaves from a fraction', () => {
        expect(leaves('\\frac{a}{b}')).toEqual(['a', 'b']);
    });

    it('extracts leaves from expression with superscript', () => {
        expect(leaves('x^2')).toEqual(['x', '2']);
    });

    it('extracts leaves from parenthesized expression', () => {
        expect(leaves('(a + b)')).toEqual(['(', 'a', '+', 'b', ')']);
    });

    it('extracts leaves from sqrt', () => {
        expect(leaves('\\sqrt{16}')).toEqual(['16']);
    });
});

describe('evaluate', () => {
    it('evaluates a number', () => {
        expect(evaluate(parse('42'))).toBe(42);
    });

    it('evaluates addition', () => {
        expect(evaluate(parse('2 + 3'))).toBe(5);
    });

    it('evaluates subtraction', () => {
        expect(evaluate(parse('7 - 4'))).toBe(3);
    });

    it('evaluates chained arithmetic', () => {
        expect(evaluate(parse('1 + 2 + 3'))).toBe(6);
    });

    it('evaluates a fraction', () => {
        expect(evaluate(parse('\\frac{6}{3}'))).toBe(2);
    });

    it('evaluates inline fraction', () => {
        expect(evaluate(parse('6/3'))).toBe(2);
    });

    it('evaluates a power', () => {
        expect(evaluate(parse('3^2'))).toBe(9);
    });

    it('evaluates a square root', () => {
        expect(evaluate(parse('\\sqrt{16}'))).toBe(4);
    });

    it('evaluates a cube root', () => {
        const val = evaluate(parse('\\sqrt[3]{8}'));
        expect(val).toBeCloseTo(2, 9);
    });

    it('returns null for variables', () => {
        expect(evaluate(parse('x'))).toBeNull();
    });

    it('returns null for mixed variable expressions', () => {
        expect(evaluate(parse('x + 1'))).toBeNull();
    });

    it('evaluates parenthesized expressions', () => {
        expect(evaluate(parse('(2 + 3)'))).toBe(5);
    });

    it('evaluates negative exponents', () => {
        expect(evaluate(parse('2^{-1}'))).toBe(0.5);
    });
});

describe('validateAnswer', () => {
    it('marks correct when answers match exactly', () => {
        const result = validateAnswer('5', '5');
        expect(result.correct).toBe(true);
    });

    it('marks incorrect when answers differ', () => {
        const result = validateAnswer('4', '5');
        expect(result.correct).toBe(false);
    });

    it('validates multi-token expressions', () => {
        const result = validateAnswer('2 + 3', '2 + 3');
        expect(result.correct).toBe(true);
    });

    it('accepts equivalent arithmetic: 7-4 == 3', () => {
        const result = validateAnswer('7 - 4', '3');
        expect(result.correct).toBe(true);
    });

    it('accepts equivalent arithmetic: 2+3 == 5', () => {
        const result = validateAnswer('2 + 3', '5');
        expect(result.correct).toBe(true);
    });

    it('accepts equivalent fractions: 2/4 == 1/2', () => {
        const result = validateAnswer('\\frac{2}{4}', '\\frac{1}{2}');
        expect(result.correct).toBe(true);
    });

    it('validates equations: x = 7-4 vs x = 3', () => {
        const result = validateAnswer('x = 7 - 4', 'x = 3');
        expect(result.correct).toBe(true);
    });

    it('rejects wrong equation side: x = 4 vs x = 3', () => {
        const result = validateAnswer('x = 4', 'x = 3');
        expect(result.correct).toBe(false);
    });

    it('highlights the wrong part in a partially correct answer', () => {
        // leaf-by-leaf fallback: variable expressions can't be evaluated
        const result = validateAnswer('x + 4', 'x + 3');
        expect(result.correct).toBe(false);
        const statuses = result.marks.map(m => m.status);
        expect(statuses).toContain('correct');     // x, +
        expect(statuses).toContain('incorrect');   // 4 vs 3
    });

    it('marks extra tokens', () => {
        const result = validateAnswer('2 + 3 + 1', '2 + 3');
        expect(result.correct).toBe(false);
    });

    it('detects missing tokens', () => {
        const result = validateAnswer('2', '2 + 3');
        expect(result.correct).toBe(false);
    });

    it('validates x = 3 against x = 3', () => {
        const result = validateAnswer('x = 3', 'x = 3');
        expect(result.correct).toBe(true);
    });

    it('validates fractions', () => {
        const result = validateAnswer('\\frac{1}{2}', '\\frac{1}{2}');
        expect(result.correct).toBe(true);
    });

    it('rejects wrong denominator', () => {
        const result = validateAnswer('\\frac{1}{3}', '\\frac{1}{2}');
        expect(result.correct).toBe(false);
    });

    it('validates compound expression a^2 + 2ab + b^2', () => {
        const result = validateAnswer('a^2 + 2ab + b^2', 'a^2 + 2ab + b^2');
        expect(result.correct).toBe(true);
    });

    it('accepts 3^2 == 9', () => {
        const result = validateAnswer('3^2', '9');
        expect(result.correct).toBe(true);
    });

    it('accepts sqrt(16) == 4', () => {
        const result = validateAnswer('\\sqrt{16}', '4');
        expect(result.correct).toBe(true);
    });

    it('provides a correct message', () => {
        expect(validateAnswer('5', '5').message).toBe('Correct!');
    });

    it('provides an incorrect message', () => {
        expect(validateAnswer('4', '5').message).toContain('Not quite');
    });
});
