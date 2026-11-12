(() => {
    'use strict';
    const dictionaries = window.SeenLocales;
    const storageKey = 'seen.ui.language';
    let language = 'ar';
    try { if (localStorage.getItem(storageKey) === 'en') language = 'en'; } catch (_) {}
    const slots = new Map(), bindings = new Set();
    const nativeBindings = new Set();
    let nextSlot = 0;
    const evaluate = value => typeof value === 'function' ? value() : value;
    const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    function t(key, params) {
        if (!Object.hasOwn(dictionaries.ar, key) || !Object.hasOwn(dictionaries.en, key)) throw new Error('Missing translation: ' + key);
        const values = evaluate(params) || {};
        return dictionaries[language][key].replace(/\{(\w+)\}/g, (match, name) => Object.hasOwn(values, name) ? String(values[name]) : match);
    }
    class Message {
        constructor(read) { this.read = read; }
        toString() { return String(this.read()); }
        [Symbol.toPrimitive]() { return this.toString(); }
        toJSON() { return this.toString(); }
        split(...args) { return this.toString().split(...args); }
        replace(...args) { return this.toString().replace(...args); }
        trim() { return this.toString().trim(); }
        toLowerCase() { return this.toString().toLowerCase(); }
        includes(...args) { return this.toString().includes(...args); }
    }
    const capture = callback => { const id = String(++nextSlot); slots.set(id, callback); return id; };
    function apply(root = document) {
        const all = selector => [...(root.matches?.(selector) ? [root] : []), ...root.querySelectorAll(selector)];
        for (const node of all('[data-i18n]')) node.textContent = t(node.dataset.i18n, slots.get(node.dataset.i18nArgs));
        for (const attr of ['title','placeholder','aria-label','alt','content']) {
            for (const node of all('[data-i18n-' + attr + ']')) node.setAttribute(attr, t(node.getAttribute('data-i18n-' + attr)));
        }
        for (const node of all('[data-i18n-fragment]')) {
            const callback = slots.get(node.dataset.i18nFragment);
            if (callback) { const value = String(callback() ?? ''); if (node.innerHTML !== value) node.innerHTML = value; }
        }
        for (const node of all('[data-i18n-dir]')) node.dir = language === 'ar' ? 'rtl' : 'ltr';
    }
    function bind(node, attribute, callback) {
        let record = [...bindings].find(entry => entry.node.deref() === node && entry.attribute === attribute);
        if (record) record.callback = callback;
        else { record = {node:typeof WeakRef === "function" ? new WeakRef(node) : {deref:()=>node},attribute,callback}; bindings.add(record); }
        const value = String(callback() ?? '');
        if (attribute === 'textContent') { if (node.textContent !== value) node.textContent = value; } else if (node.getAttribute(attribute) !== value) node.setAttribute(attribute, value);
        return value;
    }
    function setLanguage(value) {
        if (!['ar','en'].includes(value)) throw new Error('Unsupported language');
        language = value;
        try { localStorage.setItem(storageKey, value); } catch (_) {}
        document.documentElement.lang = language;
        document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
        for (const binding of bindings) {
            const node = binding.node.deref();
            if (!node) { bindings.delete(binding); continue; }
            if (node.isConnected) {
                const value = String(binding.callback() ?? '');
                if (binding.attribute === 'textContent') { if (node.textContent !== value) node.textContent = value; } else if (node.getAttribute(binding.attribute) !== value) node.setAttribute(binding.attribute, value);
            }
        }
        for (const entry of nativeBindings) {
            const target = entry.target.deref();
            if (!target) nativeBindings.delete(entry);
            else target[entry.property] = String(entry.callback());
        }
        apply();
        const button = document.getElementById('seen-language-toggle');
        if (button) { button.textContent = language === 'ar' ? t('ui_649df08a44') : t('ui_9970632f55'); button.title = t('ui_ddbeb4e082'); button.setAttribute('aria-label', button.title); }
        document.dispatchEvent(new CustomEvent('seen:languagechange', {detail:{language}}));
    }
    window.I18n = {
        get language() { return language; }, get dir() { return language === 'ar' ? 'rtl' : 'ltr'; },
        t, capture, apply, setLanguage,
        native: (target, property, callback) => {
            nativeBindings.add({target: typeof WeakRef === 'function' ? new WeakRef(target) : {deref:()=>target}, property, callback});
            target[property] = String(callback());
        },
        error: message => { const error = new Error(String(message)); error.message = message; return error; },
        msg: (key, params, before = '', after = '') => new Message(() => before + t(key, params) + after),
        live: callback => new Message(callback),
        mark: (key, params) => '<span data-i18n="' + key + '"' + (params ? ' data-i18n-args="' + capture(params) + '"' : '') + '>' + escape(t(key, params)) + '</span>',
        fragment: callback => {
            const value = String(callback() ?? '');
            if (/<[a-z!/]/i.test(value)) return value; // Already compiled markup; never rebuild its controls.
            return '<span data-i18n-fragment="' + capture(callback) + '">' + value + '</span>';
        },
        node: callback => { const node = document.createTextNode(''); bind(node, 'textContent', callback); return node; },
        text: (node, callback) => bind(node, 'textContent', callback),
        attr: (node, attribute, callback) => bind(node, attribute, callback),
        render: (node, html) => { node.innerHTML = String(html); apply(node); return html; }
    };
    document.documentElement.lang = language;
    document.documentElement.dir = I18n.dir;
    function init() {
        const toolbar = document.getElementById('toolbar');
        if (toolbar && !document.getElementById('seen-language-toggle')) {
            const button = document.createElement('button');
            button.id = 'seen-language-toggle'; button.type = 'button'; button.className = 'btn';
            button.addEventListener('click', () => setLanguage(language === 'ar' ? 'en' : 'ar'));
            if (new URLSearchParams(location.search).has('x')) {
                button.classList.add('seen-language-shared');
                document.body.appendChild(button);
            } else toolbar.appendChild(button);
        }
        setLanguage(language);
        const loader = document.querySelector('script[data-map-src]');
        if (loader) {
            const url = new URL(loader.getAttribute('data-map-src'));
            url.searchParams.set('language', language);
            const script = document.createElement('script'); script.async = true; script.src = url.href;
            document.head.appendChild(script);
        }
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true}); else init();
})();
