import { describe, it, expect } from 'vitest';
import { tokenize } from '../tokenizer.js';
import { Parser } from '../parser.js';

function parse(src) {
  const tokens = tokenize(src);
  return new Parser(tokens, src.length).parse();
}

function child(ast, ...indices) {
  let node = ast;
  for (const i of indices) {
    node = node.children[i];
  }
  return node;
}

describe('parser', () => {
  describe('atoms', () => {
    it('parses a variable', () => {
      const ast = parse('x');
      expect(child(ast, 0)).toMatchObject({ type: 'variable', value: 'x' });
    });

    it('parses a number', () => {
      const ast = parse('42');
      expect(child(ast, 0)).toMatchObject({ type: 'number', value: '42' });
    });

    it('parses an operator', () => {
      const ast = parse('+');
      expect(child(ast, 0)).toMatchObject({ type: 'operator', value: '+' });
    });
  });

  describe('groups', () => {
    it('parses a brace group', () => {
      const ast = parse('{ab}');
      const group = child(ast, 0);
      expect(group.type).toBe('group');
      expect(group.body.children).toHaveLength(2);
    });

    it('parses an empty group', () => {
      const ast = parse('{}');
      const group = child(ast, 0);
      expect(group.type).toBe('group');
      expect(group.body.children).toHaveLength(0);
    });
  });

  describe('superscript and subscript', () => {
    it('parses x^2', () => {
      const ast = parse('x^2');
      const sup = child(ast, 0);
      expect(sup.type).toBe('sup');
      expect(sup.base).toMatchObject({ type: 'variable', value: 'x' });
      expect(sup.sup).toMatchObject({ type: 'number', value: '2' });
    });

    it('parses x_{n}', () => {
      const ast = parse('x_{n}');
      const sub = child(ast, 0);
      expect(sub.type).toBe('sub');
      expect(sub.base).toMatchObject({ type: 'variable', value: 'x' });
      expect(sub.sub.type).toBe('group');
    });

    it('parses x^2_n (subsup)', () => {
      const ast = parse('x^2_n');
      const node = child(ast, 0);
      expect(node.type).toBe('subsup');
      expect(node.sup).toMatchObject({ type: 'number', value: '2' });
      expect(node.sub).toMatchObject({ type: 'variable', value: 'n' });
    });

    it('parses x^{} (empty superscript)', () => {
      const ast = parse('x^{}');
      const sup = child(ast, 0);
      expect(sup.type).toBe('sup');
      expect(sup.sup.type).toBe('group');
      expect(sup.sup.body.children).toHaveLength(0);
    });
  });

  describe('commands', () => {
    it('parses \\frac{a}{b}', () => {
      const ast = parse('\\frac{a}{b}');
      const frac = child(ast, 0);
      expect(frac.type).toBe('frac');
      expect(frac.num.type).toBe('group');
      expect(frac.den.type).toBe('group');
    });

    it('parses \\sqrt{x}', () => {
      const ast = parse('\\sqrt{x}');
      const sqrt = child(ast, 0);
      expect(sqrt.type).toBe('sqrt');
      expect(sqrt.index).toBeNull();
      expect(sqrt.body.type).toBe('group');
    });

    it('parses \\sqrt[3]{8}', () => {
      const ast = parse('\\sqrt[3]{8}');
      const sqrt = child(ast, 0);
      expect(sqrt.type).toBe('sqrt');
      expect(sqrt.index).not.toBeNull();
      expect(sqrt.index.children[0]).toMatchObject({ type: 'number', value: '3' });
    });

    it('parses \\binom{n}{k}', () => {
      const ast = parse('\\binom{n}{k}');
      const binom = child(ast, 0);
      expect(binom.type).toBe('binom');
    });

    it('parses \\vec{a}', () => {
      const ast = parse('\\vec{a}');
      const over = child(ast, 0);
      expect(over.type).toBe('over');
      expect(over.accent).toBe('\u20D7');
    });

    it('parses \\sin as function', () => {
      const ast = parse('\\sin');
      expect(child(ast, 0)).toMatchObject({ type: 'function', value: 'sin' });
    });

    it('parses \\alpha as symbol', () => {
      const ast = parse('\\alpha');
      expect(child(ast, 0)).toMatchObject({ type: 'symbol-ident', value: 'α' });
    });

    it('parses \\sum as large operator', () => {
      const ast = parse('\\sum');
      expect(child(ast, 0)).toMatchObject({ type: 'largeop', value: '∑' });
    });

    it('parses unknown commands gracefully', () => {
      const ast = parse('\\banana');
      expect(child(ast, 0)).toMatchObject({ type: 'unknown', value: '\\banana' });
    });
  });

  describe('inline fractions', () => {
    it('parses 1/2 as fraction', () => {
      const ast = parse('1/2');
      const frac = child(ast, 0);
      expect(frac.type).toBe('frac');
      expect(frac.num).toMatchObject({ type: 'number', value: '1' });
      expect(frac.den).toMatchObject({ type: 'number', value: '2' });
    });

    it('parses (a+b)/(c-d) as fraction of groups', () => {
      const ast = parse('(a+b)/(c-d)');
      const frac = child(ast, 0);
      expect(frac.type).toBe('frac');
      expect(frac.num.type).toBe('delimited');
      expect(frac.den.type).toBe('delimited');
    });
  });

  describe('source positions', () => {
    it('tracks positions for \\frac{a}{b}', () => {
      const ast = parse('\\frac{a}{b}');
      const frac = child(ast, 0);
      expect(frac.start).toBe(0);
      expect(frac.end).toBe(11);
    });

    it('tracks positions for x^{2}', () => {
      const ast = parse('x^{2}');
      const sup = child(ast, 0);
      expect(sup.start).toBe(0);
      expect(sup.end).toBe(5);
      expect(sup.base.start).toBe(0);
      expect(sup.base.end).toBe(1);
      expect(sup.sup.start).toBe(2);
      expect(sup.sup.end).toBe(5);
    });
  });

  describe('delimiters', () => {
    it('parses parenthesized expression', () => {
      const ast = parse('(a+b)');
      const del = child(ast, 0);
      expect(del.type).toBe('delimited');
      expect(del.open).toBe('(');
      expect(del.close).toBe(')');
      expect(del.body.children).toHaveLength(3);
    });

    it('parses unclosed parenthesis gracefully', () => {
      const ast = parse('(a+b');
      const del = child(ast, 0);
      expect(del.type).toBe('delimited');
      expect(del.close).toBe('');
    });
  });
});
