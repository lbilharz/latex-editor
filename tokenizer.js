// tokenizer.js — Lexer for LaTeX math input

export function tokenize(input) {
    const tokens = [];
    let i = 0;

    while (i < input.length) {
        const start = i;
        const ch = input[i];

        if (ch === ' ' || ch === '\t') {
            i++;
            continue;
        }

        if (ch === '\\') {
            i++;
            let cmd = '\\';
            if (i < input.length && /[a-zA-Z]/.test(input[i])) {
                while (i < input.length && /[a-zA-Z]/.test(input[i])) {
                    cmd += input[i]; i++;
                }
                tokens.push({ type: 'COMMAND', value: cmd, start, end: i });
            } else if (i < input.length) {
                cmd += input[i]; i++;
                tokens.push({ type: 'ESCAPED', value: cmd, start, end: i });
            } else {
                tokens.push({ type: 'COMMAND', value: '\\', start, end: i });
            }
            continue;
        }

        if (ch === '{') { i++; tokens.push({ type: 'LBRACE', start, end: i }); continue; }
        if (ch === '}') { i++; tokens.push({ type: 'RBRACE', start, end: i }); continue; }
        if (ch === '^') { i++; tokens.push({ type: 'CARET', start, end: i }); continue; }
        if (ch === '_') { i++; tokens.push({ type: 'UNDERSCORE', start, end: i }); continue; }
        if (ch === '(') { i++; tokens.push({ type: 'LPAREN', start, end: i }); continue; }
        if (ch === ')') { i++; tokens.push({ type: 'RPAREN', start, end: i }); continue; }
        if (ch === '[') { i++; tokens.push({ type: 'LBRACKET', start, end: i }); continue; }
        if (ch === ']') { i++; tokens.push({ type: 'RBRACKET', start, end: i }); continue; }

        if (/[0-9]/.test(ch)) {
            while (i < input.length && /[0-9.,]/.test(input[i])) i++;
            tokens.push({ type: 'NUMBER', value: input.slice(start, i), start, end: i });
            continue;
        }

        if (/[a-zA-Z]/.test(ch)) {
            i++;
            tokens.push({ type: 'LETTER', value: ch, start, end: i });
            continue;
        }

        if (ch === '/') {
            i++;
            tokens.push({ type: 'SLASH', value: '/', start, end: i });
            continue;
        }

        if ("+-=<>|!':;".includes(ch) || ch === '*') {
            i++;
            tokens.push({ type: 'OPERATOR', value: ch, start, end: i });
            continue;
        }

        // Anything else (unicode, punctuation)
        i++;
        tokens.push({ type: 'TEXT', value: ch, start, end: i });
    }

    return tokens;
}
