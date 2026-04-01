// errors.js — Collect structural errors from a parsed AST

/**
 * Walk the AST and return an array of { start, end, message } error descriptors.
 * Designed to be non-throwing — always returns an array (possibly empty).
 */
export function collectErrors(ast, source) {
    const errors = [];

    function walk(node) {
        if (!node) return;

        switch (node.type) {
            case 'unknown':
                errors.push({
                    start: node.start,
                    end: node.end,
                    message: `Unknown command: ${node.value}`,
                });
                break;

            case 'empty':
                errors.push({
                    start: node.start,
                    end: node.end,
                    message: 'Missing argument',
                });
                break;

            case 'frac':
                if (node.num?.type === 'empty') {
                    errors.push({
                        start: node.start,
                        end: node.end,
                        message: 'Fraction missing numerator',
                    });
                }
                if (node.den?.type === 'empty') {
                    errors.push({
                        start: node.start,
                        end: node.end,
                        message: 'Fraction missing denominator',
                    });
                }
                walk(node.num);
                walk(node.den);
                break;

            case 'sqrt':
                if (node.body?.type === 'empty') {
                    errors.push({
                        start: node.start,
                        end: node.end,
                        message: 'Square root missing content',
                    });
                }
                walk(node.index);
                walk(node.body);
                break;

            case 'sup':
                if (node.sup?.type === 'empty') {
                    errors.push({
                        start: node.start,
                        end: node.end,
                        message: 'Superscript missing exponent',
                    });
                }
                walk(node.base);
                walk(node.sup);
                break;

            case 'sub':
                if (node.sub?.type === 'empty') {
                    errors.push({
                        start: node.start,
                        end: node.end,
                        message: 'Subscript missing index',
                    });
                }
                walk(node.base);
                walk(node.sub);
                break;

            case 'subsup':
                walk(node.base);
                walk(node.sub);
                walk(node.sup);
                break;

            case 'over':
            case 'under':
                walk(node.body);
                break;

            case 'binom':
                walk(node.top);
                walk(node.bot);
                break;

            case 'group':
                // Check for unclosed brace: if source has '{' at start but no '}' at end
                if (source && node.end <= source.length) {
                    const openCh = source[node.start];
                    const closeCh = source[node.end - 1];
                    if (openCh === '{' && closeCh !== '}') {
                        errors.push({
                            start: node.start,
                            end: node.end,
                            message: 'Unclosed brace {',
                        });
                    }
                }
                walk(node.body);
                break;

            case 'delimited':
                if (node.close === '') {
                    const name = node.open === '(' ? 'parenthesis' : 'bracket';
                    errors.push({
                        start: node.start,
                        end: node.end,
                        message: `Unclosed ${name} ${node.open}`,
                    });
                }
                walk(node.body);
                break;

            case 'row':
                for (const child of node.children) walk(child);
                break;

            case 'textbox':
                walk(node.body);
                break;

            case 'matrix':
                for (const row of node.rows) {
                    for (const cell of row) walk(cell);
                }
                break;

            // Leaf nodes with no possible structural error
            default:
                break;
        }
    }

    walk(ast);
    return errors;
}
