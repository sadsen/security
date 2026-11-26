const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

// Minimal DOM double: exercises the actual picker and event handlers without Maps/network.
class Element {
    constructor() {
        this.children = []; this.style = {}; this.dataset = {}; this.events = {};
        this.className = ''; this.value = ''; this.disabled = false;
        this.classList = {
            add: name => { this.className += ' ' + name; },
            remove: name => { this.className = this.className.split(' ').filter(x => x !== name).join(' '); }
        };
    }
    getContext() { return { measureText: () => ({ width: 24 }) }; }
    appendChild(child) { child.parent = this; this.children.push(child); }
    remove() { if (this.parent) this.parent.children = this.parent.children.filter(x => x !== this); this.parent = null; }
    addEventListener(event, callback) { this.events[event] = callback; }
    click() { if (!this.disabled) this.events.click?.(); }
    querySelector(selector) {
        const classes = selector.slice(1).split('.');
        for (const child of this.children) {
            if (classes.every(name => child.className.split(' ').includes(name))) return child;
            const match = child.querySelector(selector); if (match) return match;
        }
        return null;
    }
}
function setup() {
    const document = { createElement: () => new Element(), body: new Element(), head: new Element() };
    const context = vm.createContext({ document, window: {}, bus: { on() {} } });
    for (const lang of ['ar', 'en']) vm.runInContext(fs.readFileSync(path.join(root, 'public/js/i18n', lang + '.js'), 'utf8'), context);
    let language = 'ar';
    const translate = key => {
        for (const lang of ['ar', 'en']) assert.equal(typeof context.window.SeenLocales[lang][key], 'string', 'Missing ' + lang + ': ' + key);
        return context.window.SeenLocales[language][key];
    };
    context.I18n = {
        t: translate, msg: translate, mark: translate,
        text: (node, value) => { node.textContent = typeof value === 'function' ? value() : value; },
        attr() {}, render: (node, html) => { node.children = []; node.innerHTML = html; }
    };
    const source = fs.readFileSync(path.join(root, 'public/js/main.js'), 'utf8');
    const picker = source.slice(source.indexOf('class IconPickerModal {'), source.indexOf('class FreeLayerManager {'));
    vm.runInContext(picker + '\nthis.Picker = IconPickerModal;', context);
    const start = source.indexOf('class FreeLayerManager {');
    const end = source.indexOf('    addIcon(latLng) {', start);
    vm.runInContext(source.slice(start, end) + '\n}\nthis.Manager = FreeLayerManager;', context);
    const manager = new context.Manager();
    return { manager, picker: manager.iconPicker, document, language: value => { language = value; } };
}
const shown = picker => picker.modal.querySelector('.icon-picker-grid').children.map(item => item.children[0].textContent);

test('all categories render translated icons with no duplicates', () => {
    const { picker } = setup();
    picker.show(() => {});
    for (const category of ['all', ...Object.keys(picker.iconCategories)]) {
        picker.setCategory(category);
        const icons = shown(picker);
        assert.ok(icons.length > 0);
        assert.equal(new Set(icons).size, icons.length, category);
    }
    for (const category of ['patrol', 'gates', 'barriers', 'equipment', 'facilities', 'events']) assert.ok(picker.iconCategories[category].length);
});

test('Arabic and English search work in either UI language', () => {
    const { picker, language } = setup();
    for (const lang of ['ar', 'en']) {
        language(lang); picker.show(() => {});
        for (const [query, expected] of [
            ['بوابة', 'meeting_room'], ['GATES', 'sensor_door'],
            ['الدورية الامنية', 'local_police'], ['security patrol', 'local_police'],
            ['المرافق', 'wc'], ['equipment', 'handyman'],
            ['فعاليات', 'event'], ['barriers', 'construction'], ['local_police', 'local_police']
        ]) {
            picker.searchInput.value = query; picker.filterIcons();
            assert.ok(shown(picker).includes(expected), lang + ': ' + query);
        }
    }
});

test('selection closes picker before callback; cancel/reopen clears stale selection', () => {
    const { picker } = setup(); let calls = 0;
    picker.show(icon => { calls++; assert.ok(icon); assert.equal(picker.modal.style.display, 'none'); });
    picker.modal.querySelector('.icon-picker-grid').children[0].click();
    picker.modal.querySelector('.icon-picker-select').click();
    assert.equal(calls, 1);
    picker.show(() => { calls++; });
    assert.equal(picker.modal.querySelector('.icon-picker-select').disabled, true);
    picker.modal.querySelector('.icon-picker-grid').children[0].click();
    picker.modal.querySelector('.icon-picker-cancel').click();
    picker.show(() => { calls++; });
    picker.modal.querySelector('.icon-picker-select').click();
    assert.equal(calls, 1);
    assert.equal(picker.searchInput.value, '');
    assert.equal(picker.currentCategory, 'all');
    picker.modal.querySelector('.icon-picker-grid').children[0].click();
    picker.searchInput.value = 'no-such-icon'; picker.filterIcons();
    assert.equal(shown(picker).length, 0);
    assert.equal(picker.modal.querySelector('.icon-picker-select').disabled, true);
});

test('free draw removes options before opening icons or text; repeated opens do not stack', () => {
    const { manager, document, picker } = setup();
    const position = { lat: 1, lng: 2 };
    for (const [index, method] of [[0, 'addIcon'], [1, 'addText']]) {
        let called = false;
        manager[method] = value => {
            called = true; assert.equal(value, position);
            assert.equal(document.body.querySelector('.free-draw-options-dialog'), null);
            assert.equal(manager.optionsDialog, null);
        };
        manager.showAddOptions(position);
        const first = manager.optionsDialog;
        manager.showAddOptions(position);
        assert.equal(first.parent, null);
        manager.optionsDialog.children[0].children[index + 1].click();
        assert.equal(called, true);
    }
    picker.show(() => {});
    manager.showAddOptions(position);
    assert.equal(picker.modal.style.display, 'none');
    manager.optionsDialog.children[0].children[3].click();
    assert.equal(document.body.querySelector('.free-draw-options-dialog'), null);
    manager.showAddOptions(position);
    assert.ok(manager.optionsDialog.parent);
});
