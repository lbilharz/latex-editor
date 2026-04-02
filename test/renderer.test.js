import { describe, it, expect } from 'vitest';
import { tokenize } from '../src/tokenizer.js';
import { Parser } from '../src/parser.js';
import { toMathML } from '../src/renderer.js';

function render(src) {
  const tokens = tokenize(src);
  const ast = new Parser(tokens, src.length).parse();
  return toMathML(ast);
}

describe('renderer', () => {
  it('renders a variable as <mi>', () => {
    expect(render('x')).toContain('<mi');
    expect(render('x')).toContain('>x</mi>');
  });

  it('renders a number as <mn>', () => {
    expect(render('42')).toContain('<mn');
    expect(render('42')).toContain('>42</mn>');
  });

  it('renders an operator as <mo>', () => {
    expect(render('+')).toContain('<mo');
    expect(render('+')).toContain('>+</mo>');
  });

  it('renders a fraction as <mfrac>', () => {
    const html = render('\\frac{a}{b}');
    expect(html).toContain('<mfrac');
    expect(html).toContain('</mfrac>');
  });

  it('renders a superscript as <msup>', () => {
    const html = render('x^2');
    expect(html).toContain('<msup');
    expect(html).toContain('</msup>');
  });

  it('renders a subscript as <msub>', () => {
    const html = render('x_n');
    expect(html).toContain('<msub');
    expect(html).toContain('</msub>');
  });

  it('renders a square root as <msqrt>', () => {
    const html = render('\\sqrt{x}');
    expect(html).toContain('<msqrt');
    expect(html).toContain('</msqrt>');
  });

  it('renders nth root as <mroot>', () => {
    const html = render('\\sqrt[3]{8}');
    expect(html).toContain('<mroot');
    expect(html).toContain('</mroot>');
  });

  it('renders a function name in upright font', () => {
    const html = render('\\sin');
    expect(html).toContain('<mi');
    expect(html).toContain('sin');
  });

  it('renders Greek letters as identifiers', () => {
    const html = render('\\alpha');
    expect(html).toContain('α');
  });

  it('renders large operators', () => {
    const html = render('\\sum');
    expect(html).toContain('∑');
  });

  it('includes data-s and data-e attributes', () => {
    const html = render('x');
    expect(html).toMatch(/data-s="0"/);
    expect(html).toMatch(/data-e="1"/);
  });

  it('renders inline fraction as <mfrac>', () => {
    const html = render('1/2');
    expect(html).toContain('<mfrac');
  });

  it('renders parenthesized expression', () => {
    const html = render('(a+b)');
    expect(html).toContain('(');
    expect(html).toContain(')');
  });
});
