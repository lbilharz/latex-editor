import { describe, it, expect } from 'vitest';
import { validateAnswer, extractLeaves } from '../validate.js';
import { tokenize } from '../tokenizer.js';
import { Parser } from '../parser.js';

function leaves(src) {
    const tokens = tokenize(src);
    const ast = new Parser(tokens, src.length).parse();
    return extractLeaves(ast).filter(l => l.value !== '/').map(l => l.value);
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

describe('validateAnswer', () => {
    it('marks correct when answers match exactly', () => {
        const result = validateAnswer('5', '5');
        expect(result.correct).toBe(true);
        expect(result.marks.every(m => m.status === 'correct')).toBe(true);
    });

    it('marks incorrect when answers differ', () => {
        const result = validateAnswer('4', '5');
        expect(result.correct).toBe(false);
        expect(result.marks[0].status).toBe('incorrect');
    });

    it('validates multi-token expressions', () => {
        const result = validateAnswer('2 + 3', '2 + 3');
        expect(result.correct).toBe(true);
    });

    it('highlights the wrong part in a partially correct answer', () => {
        const result = validateAnswer('2 + 4', '2 + 3');
        expect(result.correct).toBe(false);
        // '2' correct, '+' correct, '4' incorrect
        expect(result.marks[0].status).toBe('correct');  // 2
        expect(result.marks[1].status).toBe('correct');  // +
        expect(result.marks[2].status).toBe('incorrect'); // 4 vs 3
    });

    it('marks extra tokens', () => {
        const result = validateAnswer('2 + 3 + 1', '2 + 3');
        expect(result.correct).toBe(false);
        const extras = result.marks.filter(m => m.status === 'extra');
        expect(extras.length).toBeGreaterThan(0);
    });

    it('detects missing tokens', () => {
        const result = validateAnswer('2', '2 + 3');
        expect(result.correct).toBe(false);
    });

    it('validates x = 3 against x = 3', () => {
        const result = validateAnswer('x = 3', 'x = 3');
        expect(result.correct).toBe(true);
    });

    it('rejects x = 4 against x = 3', () => {
        const result = validateAnswer('x = 4', 'x = 3');
        expect(result.correct).toBe(false);
        // x correct, = correct, 4 incorrect
        expect(result.marks[2].status).toBe('incorrect');
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

    it('provides a correct message', () => {
        expect(validateAnswer('5', '5').message).toBe('Correct!');
    });

    it('provides an incorrect message', () => {
        expect(validateAnswer('4', '5').message).toContain('Not quite');
    });
});
