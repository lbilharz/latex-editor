import { describe, it, expect } from 'vitest';
import { tokenize } from '../tokenizer.js';

describe('tokenizer', () => {
  it('tokenizes a simple variable', () => {
    const tokens = tokenize('x');
    expect(tokens).toEqual([
      { type: 'LETTER', value: 'x', start: 0, end: 1 },
    ]);
  });

  it('tokenizes a number with decimals', () => {
    const tokens = tokenize('3.14');
    expect(tokens).toEqual([
      { type: 'NUMBER', value: '3.14', start: 0, end: 4 },
    ]);
  });

  it('tokenizes a command', () => {
    const tokens = tokenize('\\frac');
    expect(tokens).toEqual([
      { type: 'COMMAND', value: '\\frac', start: 0, end: 5 },
    ]);
  });

  it('tokenizes braces', () => {
    const tokens = tokenize('{a}');
    expect(tokens).toHaveLength(3);
    expect(tokens[0].type).toBe('LBRACE');
    expect(tokens[1]).toMatchObject({ type: 'LETTER', value: 'a' });
    expect(tokens[2].type).toBe('RBRACE');
  });

  it('tokenizes caret and underscore', () => {
    const tokens = tokenize('x^2_n');
    expect(tokens.map(t => t.type)).toEqual([
      'LETTER', 'CARET', 'NUMBER', 'UNDERSCORE', 'LETTER',
    ]);
  });

  it('tokenizes operators', () => {
    const tokens = tokenize('a+b-c');
    expect(tokens.map(t => t.type)).toEqual([
      'LETTER', 'OPERATOR', 'LETTER', 'OPERATOR', 'LETTER',
    ]);
  });

  it('tokenizes escaped characters', () => {
    const tokens = tokenize('\\{\\}');
    expect(tokens).toHaveLength(2);
    expect(tokens[0]).toMatchObject({ type: 'ESCAPED', value: '\\{' });
    expect(tokens[1]).toMatchObject({ type: 'ESCAPED', value: '\\}' });
  });

  it('tokenizes parentheses and brackets', () => {
    const tokens = tokenize('(a)[b]');
    expect(tokens.map(t => t.type)).toEqual([
      'LPAREN', 'LETTER', 'RPAREN', 'LBRACKET', 'LETTER', 'RBRACKET',
    ]);
  });

  it('tokenizes slash', () => {
    const tokens = tokenize('1/2');
    expect(tokens.map(t => t.type)).toEqual(['NUMBER', 'SLASH', 'NUMBER']);
  });

  it('skips whitespace', () => {
    const tokens = tokenize('a + b');
    expect(tokens).toHaveLength(3);
    expect(tokens.map(t => t.value)).toEqual(['a', '+', 'b']);
  });

  it('tracks source positions correctly', () => {
    const tokens = tokenize('\\frac{a}{b}');
    expect(tokens[0]).toMatchObject({ start: 0, end: 5 });  // \frac
    expect(tokens[1]).toMatchObject({ start: 5, end: 6 });   // {
    expect(tokens[2]).toMatchObject({ start: 6, end: 7 });   // a
    expect(tokens[3]).toMatchObject({ start: 7, end: 8 });   // }
    expect(tokens[4]).toMatchObject({ start: 8, end: 9 });   // {
    expect(tokens[5]).toMatchObject({ start: 9, end: 10 });  // b
    expect(tokens[6]).toMatchObject({ start: 10, end: 11 }); // }
  });

  it('handles trailing backslash', () => {
    const tokens = tokenize('a\\');
    expect(tokens).toHaveLength(2);
    expect(tokens[1]).toMatchObject({ type: 'COMMAND', value: '\\' });
  });
});
