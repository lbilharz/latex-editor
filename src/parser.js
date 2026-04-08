// parser.js — Recursive descent parser producing AST

import { SYMBOLS, FUNCTIONS, LARGE_OPS } from './data.js';

export class Parser {
    constructor(tokens, sourceLen) {
        this.tokens = tokens;
        this.pos = 0;
        this.sourceLen = sourceLen;
    }

    peek()    { return this.tokens[this.pos] || null; }
    advance() { return this.tokens[this.pos++]; }
    expect(type) {
        const t = this.peek();
        if (t && t.type === type) return this.advance();
        return null;
    }

    srcPos() {
        return this.peek()?.start ?? this.sourceLen;
    }

    parse() {
        const r = this.exprUntil();
        return r;
    }

    exprUntil(...stopTypes) {
        const children = [];
        const s = this.srcPos();

        while (this.peek()) {
            if (stopTypes.includes(this.peek().type)) break;
            const node = this.term();
            if (node) children.push(node);
        }

        const e = children.length ? children[children.length - 1].end : s;
        return { type: 'row', children, start: s, end: e };
    }

    term() {
        let node = this.atomWithScripts();
        if (!node) return null;

        // Handle / as inline fraction: a/b -> frac(a,b)
        if (this.peek()?.type === 'SLASH') {
            this.advance();
            let den = this.atomWithScripts();
            if (!den) den = this.emptyNode();
            node = { type: 'frac', num: node, den, start: node.start, end: den.end };
        }

        return node;
    }

    atomWithScripts() {
        let base = this.atom();
        if (!base) return null;

        let sup = null, sub = null;
        for (let i = 0; i < 2; i++) {
            const t = this.peek();
            if (!t) break;
            if (t.type === 'CARET' && !sup) {
                this.advance();
                sup = this.atom() || this.emptyNode();
            } else if (t.type === 'UNDERSCORE' && !sub) {
                this.advance();
                sub = this.atom() || this.emptyNode();
            } else {
                break;
            }
        }

        if (!sup && !sub) return base;
        const end = sup?.end ?? sub?.end ?? base.end;
        if (sup && sub) return { type: 'subsup', base, sub, sup, start: base.start, end };
        if (sup)        return { type: 'sup', base, sup, start: base.start, end };
                        return { type: 'sub', base, sub, start: base.start, end };
    }

    atom() {
        const t = this.peek();
        if (!t) return null;

        switch (t.type) {
            case 'NUMBER':   this.advance(); return { type: 'number',   value: t.value, start: t.start, end: t.end };
            case 'LETTER':   this.advance(); return { type: 'variable', value: t.value, start: t.start, end: t.end };
            case 'OPERATOR': this.advance(); return { type: 'operator', value: t.value, start: t.start, end: t.end };
            case 'TEXT':     this.advance(); return { type: 'text',     value: t.value, start: t.start, end: t.end };
            case 'ESCAPED':  this.advance(); return this.escaped(t);
            case 'LBRACE':   return this.group();
            case 'LPAREN':   return this.delimited('LPAREN', 'RPAREN', '(', ')');
            case 'LBRACKET': return this.delimited('LBRACKET', 'RBRACKET', '[', ']');
            case 'COMMAND':  return this.command();
            case 'SLASH':    this.advance(); return { type: 'operator', value: '/', start: t.start, end: t.end };
            case 'RBRACE':   this.advance(); return { type: 'text', value: '}', start: t.start, end: t.end };
            case 'RPAREN':   this.advance(); return { type: 'operator', value: ')', start: t.start, end: t.end };
            case 'RBRACKET': this.advance(); return { type: 'operator', value: ']', start: t.start, end: t.end };
            default:         this.advance(); return { type: 'text', value: t.value ?? '?', start: t.start, end: t.end };
        }
    }

    escaped(t) {
        const ch = t.value[1];
        if (ch === '{' || ch === '}') return { type: 'operator', value: ch, start: t.start, end: t.end };
        if (ch === '|') return { type: 'operator', value: '|', start: t.start, end: t.end };
        if (ch === '\\') return { type: 'operator', value: '\u00A0', start: t.start, end: t.end };
        return { type: 'text', value: ch, start: t.start, end: t.end };
    }

    group() {
        const open = this.expect('LBRACE');
        const inner = this.exprUntil('RBRACE');
        const close = this.expect('RBRACE');
        const end = close ? close.end : inner.end;
        return { type: 'group', body: inner, start: open.start, end };
    }

    delimited(openType, closeType, openCh, closeCh) {
        const open = this.advance();
        const inner = this.exprUntil(closeType);
        const close = this.expect(closeType);
        const end = close ? close.end : inner.end;
        return { type: 'delimited', open: openCh, close: close ? closeCh : '', body: inner, start: open.start, end };
    }

    command() {
        const t = this.advance();
        const cmd = t.value;

        if (cmd === '\\frac') {
            const num = this.atom() || this.emptyNode();
            const den = this.atom() || this.emptyNode();
            return { type: 'frac', num, den, start: t.start, end: den.end };
        }

        if (cmd === '\\sqrt') {
            let index = null;
            if (this.peek()?.type === 'LBRACKET') {
                this.advance();
                index = this.exprUntil('RBRACKET');
                this.expect('RBRACKET');
            }
            const body = this.atom() || this.emptyNode();
            return { type: 'sqrt', index, body, start: t.start, end: body.end };
        }

        if (cmd === '\\binom') {
            const top = this.atom() || this.emptyNode();
            const bot = this.atom() || this.emptyNode();
            return { type: 'binom', top, bot, start: t.start, end: bot.end };
        }

        if (cmd === '\\vec') {
            const body = this.atom() || this.emptyNode();
            return { type: 'over', accent: '\u20D7', body, start: t.start, end: body.end };
        }

        if (cmd === '\\ol' || cmd === '\\overline' || cmd === '\\bar') {
            const body = this.atom() || this.emptyNode();
            return { type: 'over', accent: '\u00AF', body, start: t.start, end: body.end };
        }

        if (cmd === '\\hat') {
            const body = this.atom() || this.emptyNode();
            return { type: 'over', accent: '\u005E', body, start: t.start, end: body.end };
        }

        if (cmd === '\\tilde') {
            const body = this.atom() || this.emptyNode();
            return { type: 'over', accent: '~', body, start: t.start, end: body.end };
        }

        if (cmd === '\\dot') {
            const body = this.atom() || this.emptyNode();
            return { type: 'over', accent: '\u02D9', body, start: t.start, end: body.end };
        }

        if (cmd === '\\ddot') {
            const body = this.atom() || this.emptyNode();
            return { type: 'over', accent: '\u00A8', body, start: t.start, end: body.end };
        }

        if (cmd === '\\underbrace' || cmd === '\\overbrace') {
            const body = this.atom() || this.emptyNode();
            const brace = cmd === '\\underbrace' ? '\u23DF' : '\u23DE';
            return { type: cmd === '\\underbrace' ? 'under' : 'over', accent: brace, body, start: t.start, end: body.end };
        }

        if (cmd === '\\mat') {
            return this.matrix(t);
        }

        if (cmd === '\\text' || cmd === '\\mathrm' || cmd === '\\textrm') {
            const body = this.atom() || this.emptyNode();
            return { type: 'textbox', body, start: t.start, end: body.end };
        }

        // \not prefix: combine with next operator to form negated symbol
        if (cmd === '\\not') {
            const next = this.peek();
            const NEGATIONS = { '|': '∤', '||': '∦', '=': '≠', '<': '≮', '>': '≯', '\\in': '∉', '\\subset': '⊄', '\\subseteq': '⊈' };
            if (next) {
                const nextVal = next.value;
                if (NEGATIONS[nextVal]) {
                    this.advance();
                    return { type: 'symbol-op', value: NEGATIONS[nextVal], start: t.start, end: next.end };
                }
            }
            return { type: 'symbol-op', value: '¬', start: t.start, end: t.end };
        }

        if (LARGE_OPS[cmd]) {
            return { type: 'largeop', value: LARGE_OPS[cmd], start: t.start, end: t.end };
        }

        const fname = cmd.slice(1);
        if (FUNCTIONS.has(fname)) {
            return { type: 'function', value: fname, start: t.start, end: t.end };
        }

        if (SYMBOLS[cmd]) {
            const val = SYMBOLS[cmd];
            const isIdent = /[\u0391-\u03C9\u2115\u2124\u211A\u211D\u2102]/.test(val);
            return { type: isIdent ? 'symbol-ident' : 'symbol-op', value: val, start: t.start, end: t.end };
        }

        return { type: 'unknown', value: cmd, start: t.start, end: t.end };
    }

    matrix(cmdToken) {
        const open = this.expect('LBRACE');
        if (!open) return { type: 'text', value: '\\mat', start: cmdToken.start, end: cmdToken.end };

        const rows = [[]];
        let current = [];

        while (this.peek() && this.peek().type !== 'RBRACE') {
            const t = this.peek();
            if (t.type === 'OPERATOR' && t.value === '&') {
                this.advance();
                rows[rows.length - 1].push({ type: 'row', children: current, start: current[0]?.start ?? t.start, end: t.start });
                current = [];
            } else if (t.type === 'ESCAPED' && t.value === '\\\\') {
                this.advance();
                rows[rows.length - 1].push({ type: 'row', children: current, start: current[0]?.start ?? t.start, end: t.start });
                current = [];
                rows.push([]);
            } else {
                const node = this.term();
                if (node) current.push(node);
            }
        }

        if (current.length > 0 || rows[rows.length - 1].length > 0) {
            const s = current[0]?.start ?? this.srcPos();
            rows[rows.length - 1].push({ type: 'row', children: current, start: s, end: this.srcPos() });
        }

        const close = this.expect('RBRACE');
        const end = close ? close.end : this.srcPos();
        return { type: 'matrix', rows, start: cmdToken.start, end };
    }

    emptyNode() {
        const p = this.srcPos();
        return { type: 'empty', start: p, end: p };
    }
}
