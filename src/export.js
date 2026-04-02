// export.js — MathML XML export for MathCore validation
// Reuses toMathML() but strips data-s/data-e, wraps in semantics envelope

import { toMathML } from './renderer.js';

export function toMathCoreXML(ast, latexSource) {
    const mathml = toMathML(ast).replace(/ data-[se]="[^"]*"/g, '');
    return [
        '<math xmlns="http://www.w3.org/1998/Math/MathML">',
        '<semantics>',
        mathml,
        `<annotation encoding="LaTeX">${escapeXml(latexSource)}</annotation>`,
        '<annotation-xml encoding="bettermarks"/>',
        '</semantics>',
        '</math>'
    ].join('');
}

function escapeXml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
