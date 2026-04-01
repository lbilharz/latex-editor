// renderer.js — AST to MathML conversion

export function toMathML(node) {
    const a = ` data-s="${node.start}" data-e="${node.end}"`;

    switch (node.type) {
        case 'row': {
            const inner = node.children.map(toMathML).join('');
            if (node.children.length === 1) return inner;
            return `<mrow${a}>${inner}</mrow>`;
        }
        case 'number':
            return `<mn${a}>${esc(node.value)}</mn>`;
        case 'variable':
            return `<mi${a}>${esc(node.value)}</mi>`;
        case 'operator':
            return `<mo${a}>${esc(node.value)}</mo>`;
        case 'symbol-ident':
            return `<mi${a}>${esc(node.value)}</mi>`;
        case 'symbol-op':
            return `<mo${a}>${esc(node.value)}</mo>`;
        case 'function':
            return `<mi${a} mathvariant="normal">${esc(node.value)}</mi>`;
        case 'text':
            return `<mtext${a}>${esc(node.value)}</mtext>`;
        case 'textbox':
            return `<mtext${a}>${node.body.type === 'group' ? flatText(node.body.body) : flatText(node.body)}</mtext>`;
        case 'group': {
            const inner = node.body.children.map(toMathML).join('');
            return `<mrow${a}>${inner}</mrow>`;
        }
        case 'delimited':
            return `<mrow${a}><mo stretchy="true">${esc(node.open)}</mo>${toMathML(node.body)}<mo stretchy="true">${esc(node.close)}</mo></mrow>`;
        case 'frac':
            return `<mfrac${a}>${wrapRow(node.num)}${wrapRow(node.den)}</mfrac>`;
        case 'sqrt':
            return node.index
                ? `<mroot${a}>${wrapRow(node.body)}${wrapRow(node.index)}</mroot>`
                : `<msqrt${a}>${toMathML(node.body)}</msqrt>`;
        case 'sup':
            return `<msup${a}>${wrapRow(node.base)}${wrapRow(node.sup)}</msup>`;
        case 'sub':
            return `<msub${a}>${wrapRow(node.base)}${wrapRow(node.sub)}</msub>`;
        case 'subsup':
            return `<msubsup${a}>${wrapRow(node.base)}${wrapRow(node.sub)}${wrapRow(node.sup)}</msubsup>`;
        case 'over':
            return `<mover${a}>${wrapRow(node.body)}<mo>${esc(node.accent)}</mo></mover>`;
        case 'under':
            return `<munder${a}>${wrapRow(node.body)}<mo>${esc(node.accent)}</mo></munder>`;
        case 'binom':
            return `<mrow${a}><mo stretchy="true">(</mo><mfrac linethickness="0">${wrapRow(node.top)}${wrapRow(node.bot)}</mfrac><mo stretchy="true">)</mo></mrow>`;
        case 'largeop':
            return `<mo${a} largeop="true">${esc(node.value)}</mo>`;
        case 'matrix':
            return renderMatrix(node, a);
        case 'unknown':
            return `<mtext${a} mathcolor="red">${esc(node.value)}</mtext>`;
        case 'empty':
            return `<mspace${a} width="0.5em" style="background:rgba(67,97,238,0.1);border-radius:2px"/>`;
        default:
            return `<mtext${a}>?</mtext>`;
    }
}

function wrapRow(node) {
    const ml = toMathML(node);
    if (node.type !== 'row' || node.children.length <= 1) return ml;
    return ml;
}

function renderMatrix(node, a) {
    let ml = `<mrow${a}><mo stretchy="true">(</mo><mtable>`;
    for (const row of node.rows) {
        ml += '<mtr>';
        for (const cell of row) {
            ml += `<mtd>${toMathML(cell)}</mtd>`;
        }
        ml += '</mtr>';
    }
    ml += '</mtable><mo stretchy="true">)</mo></mrow>';
    return ml;
}

function flatText(node) {
    if (!node) return '';
    if (node.type === 'row') return node.children.map(flatText).join('');
    return esc(node.value || '');
}

function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
