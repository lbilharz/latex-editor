// i18n.js — Internationalization with i18next + browser language detection

import i18next from './node_modules/i18next/dist/esm/i18next.js';
import LanguageDetector from './node_modules/i18next-browser-languagedetector/dist/esm/i18nextBrowserLanguageDetector.js';

import en from './locales/en.json' with { type: 'json' };
import de from './locales/de.json' with { type: 'json' };
import fr from './locales/fr.json' with { type: 'json' };
import nl from './locales/nl.json' with { type: 'json' };
import tr from './locales/tr.json' with { type: 'json' };
import uk from './locales/uk.json' with { type: 'json' };
import ar from './locales/ar.json' with { type: 'json' };
import es from './locales/es.json' with { type: 'json' };

const SUPPORTED_LANGS = ['en', 'de', 'fr', 'nl', 'tr', 'uk', 'ar', 'es'];

await i18next
    .use(LanguageDetector)
    .init({
        fallbackLng: 'en',
        supportedLngs: SUPPORTED_LANGS,
        interpolation: { escapeValue: false },
        detection: {
            order: ['querystring', 'localStorage', 'navigator'],
            lookupQuerystring: 'lang',
            lookupLocalStorage: 'i18nextLng',
            caches: ['localStorage'],
        },
        resources: {
            en: { translation: en },
            de: { translation: de },
            fr: { translation: fr },
            nl: { translation: nl },
            tr: { translation: tr },
            uk: { translation: uk },
            ar: { translation: ar },
            es: { translation: es },
        },
    });

const t = i18next.t.bind(i18next);

/** Apply translations to all elements with data-i18n attribute */
function applyTranslations() {
    // Set document direction for RTL languages
    const dir = i18next.language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.dir = dir;
    document.documentElement.lang = i18next.language;

    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        const opts = {};
        // Support interpolation via data-i18n-opts
        const optsAttr = el.getAttribute('data-i18n-opts');
        if (optsAttr) Object.assign(opts, JSON.parse(optsAttr));

        el.innerHTML = t(key, opts);
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        el.placeholder = t(el.getAttribute('data-i18n-placeholder'));
    });

    document.querySelectorAll('[data-i18n-aria-label]').forEach(el => {
        el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria-label')));
    });

    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        el.title = t(el.getAttribute('data-i18n-title'));
    });
}

/** Build a language switcher and insert it */
function createLanguageSwitcher() {
    const switcher = document.createElement('select');
    switcher.className = 'lang-switcher';
    switcher.setAttribute('aria-label', 'Language');
    const names = { en: 'English', de: 'Deutsch', fr: 'Français', nl: 'Nederlands', tr: 'Türkçe', uk: 'Українська', ar: 'العربية', es: 'Español' };
    for (const lng of SUPPORTED_LANGS) {
        const opt = document.createElement('option');
        opt.value = lng;
        opt.textContent = names[lng];
        if (lng === i18next.language) opt.selected = true;
        switcher.appendChild(opt);
    }
    switcher.addEventListener('change', () => {
        i18next.changeLanguage(switcher.value).then(() => {
            applyTranslations();
        });
    });
    return switcher;
}

export { i18next, t, applyTranslations, createLanguageSwitcher, SUPPORTED_LANGS };
