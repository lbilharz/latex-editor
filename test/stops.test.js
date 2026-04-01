import { describe, it, expect } from 'vitest';
import { tokenize } from '../tokenizer.js';
import { Parser } from '../parser.js';
import { getNavigableStops } from '../cursor.js';

function stops(src) {
  const tokens = tokenize(src);
  const ast = new Parser(tokens, src.length).parse();
  return getNavigableStops(ast, src.length);
}

describe('getNavigableStops', () => {
  it('returns start and end for empty input', () => {
    expect(stops('')).toEqual([0]);
  });

  it('returns stops for a single variable', () => {
    expect(stops('x')).toEqual([0, 1]);
  });

  it('returns stops for multiple variables', () => {
    expect(stops('abc')).toEqual([0, 1, 2, 3]);
  });

  it('returns stops for a number', () => {
    expect(stops('42')).toEqual([0, 2]);
  });

  it('returns stops for expression with operators', () => {
    expect(stops('a+b')).toEqual([0, 1, 2, 3]);
  });

  describe('empty groups (the toolbar bug)', () => {
    it('has a stop inside empty superscript x^{}', () => {
      const s = stops('x^{}');
      // Position 3 is between { and } — must be a stop
      expect(s).toContain(3);
    });

    it('has a stop inside empty subscript x_{}', () => {
      const s = stops('x_{}');
      expect(s).toContain(3);
    });

    it('has stops inside both empty groups of \\frac{}{}', () => {
      const s = stops('\\frac{}{}');
      // \frac = 0-5, first {} = 5-7, second {} = 7-9
      // Inside first group: position 6
      // Inside second group: position 8
      expect(s).toContain(6);
      expect(s).toContain(8);
    });

    it('has a stop inside empty \\sqrt{}', () => {
      const s = stops('\\sqrt{}');
      // \sqrt = 0-5, {} = 5-7, inside = 6
      expect(s).toContain(6);
    });
  });

  describe('filled groups', () => {
    it('has stops inside x^{2}', () => {
      const s = stops('x^{2}');
      // x=0-1, ^=1, {=2, 2=3-4, }=4
      expect(s).toContain(0); // before x
      expect(s).toContain(1); // after x
      expect(s).toContain(3); // before 2
      expect(s).toContain(4); // after 2
    });

    it('skips structural tokens (^, {, })', () => {
      const s = stops('x^{2}');
      // Position 2 is at '{' — should not be a stop on its own
      // (unless it's the start of a child node)
      // The important thing: 3 and 4 ARE stops (inside the group)
      expect(s).toContain(3);
      expect(s).toContain(4);
    });
  });

  describe('delimiters', () => {
    it('includes open/close paren positions', () => {
      const s = stops('(a)');
      expect(s).toContain(0); // before (
      expect(s).toContain(1); // after (
      expect(s).toContain(2); // after a / before )
      expect(s).toContain(3); // after )
    });
  });

  describe('fractions', () => {
    it('has stops inside \\frac{a}{b}', () => {
      const s = stops('\\frac{a}{b}');
      expect(s).toContain(6);  // before a
      expect(s).toContain(7);  // after a
      expect(s).toContain(9);  // before b
      expect(s).toContain(10); // after b
    });

    it('has stops for inline fraction 1/2', () => {
      const s = stops('1/2');
      expect(s).toContain(0); // before 1
      expect(s).toContain(1); // after 1
      expect(s).toContain(2); // before 2
      expect(s).toContain(3); // after 2
    });
  });

  describe('nth root', () => {
    it('has a stop inside empty index of \\sqrt[]{}', () => {
      const s = stops('\\sqrt[]{x}');
      expect(s).toContain(6); // inside [] — where you type the index
    });

    it('has stops inside filled index of \\sqrt[3]{x}', () => {
      const s = stops('\\sqrt[3]{x}');
      expect(s).toContain(6); // before 3
      expect(s).toContain(7); // after 3
    });
  });
});
