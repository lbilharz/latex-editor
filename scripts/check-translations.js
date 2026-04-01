#!/usr/bin/env node
// check-translations.js — Verify all locale files have the same keys as en.json

import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const localesDir = join(__dirname, '..', 'locales');

const enPath = join(localesDir, 'en.json');
const en = JSON.parse(readFileSync(enPath, 'utf8'));
const enKeys = Object.keys(en).sort();

const files = readdirSync(localesDir).filter(f => f.endsWith('.json') && f !== 'en.json');
let hasErrors = false;

for (const file of files) {
    const lang = file.replace('.json', '');
    const data = JSON.parse(readFileSync(join(localesDir, file), 'utf8'));
    const langKeys = Object.keys(data).sort();

    const missing = enKeys.filter(k => !langKeys.includes(k));
    const extra = langKeys.filter(k => !enKeys.includes(k));

    if (missing.length > 0) {
        console.error(`❌ ${lang}: missing ${missing.length} key(s): ${missing.join(', ')}`);
        hasErrors = true;
    }
    if (extra.length > 0) {
        console.warn(`⚠️  ${lang}: ${extra.length} extra key(s): ${extra.join(', ')}`);
    }
    if (missing.length === 0 && extra.length === 0) {
        console.log(`✅ ${lang}: complete (${langKeys.length} keys)`);
    }
}

if (hasErrors) {
    console.error('\nTranslation check failed. Run: node scripts/check-translations.js');
    process.exit(1);
} else {
    console.log(`\nAll translations complete (${enKeys.length} keys × ${files.length + 1} languages)`);
}
