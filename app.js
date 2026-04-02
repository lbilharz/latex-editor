// app.js — Example Consumer
import { createMathEditor } from './src/index.js';
import { i18next, t, applyTranslations, createLanguageSwitcher } from './src/i18n.js';
import { setLocale } from './src/renderer.js';

// Setup language switcher
setLocale(i18next.language);
applyTranslations();
const langSwitcher = createLanguageSwitcher();
document.getElementById('lang-switcher-container').appendChild(langSwitcher);

// Initialize MathEditor
const container = document.getElementById('editor-root');
const editor = createMathEditor(container);

// Translate the newly injected DOM
applyTranslations();

// Re-render on language change
i18next.on('languageChanged', (lng) => {
    setLocale(lng);
    applyTranslations();
    const currentVal = editor.value;
    editor.value = currentVal;
});

// ── Example Buttons ──

document.querySelectorAll('.example-grid button[data-latex]').forEach(btn => {
    btn.addEventListener('click', () => {
        editor.value = btn.dataset.latex;
        
    });
});

// ── Show More Examples ──

const showMoreBtn = document.getElementById('show-more-examples');
const moreExamples = document.getElementById('example-grid-more');
if (showMoreBtn && moreExamples) {
    showMoreBtn.addEventListener('click', () => {
        const isHidden = moreExamples.hidden;
        moreExamples.hidden = !isHidden;
        showMoreBtn.textContent = isHidden ? 'Show fewer examples' : 'Show all 17 examples';
        showMoreBtn.setAttribute('aria-expanded', String(isHidden));
    });
    showMoreBtn.setAttribute('aria-expanded', 'false');
    showMoreBtn.setAttribute('aria-controls', 'example-grid-more');
}



