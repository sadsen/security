const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function element() {
    return {
        style: { cssText: '' }, children: [], events: {},
        setAttribute() {},
        replaceChildren(...children) { this.children = children; },
        prepend(child) { this.children.unshift(child); },
        addEventListener(name, callback) { this.events[name] = callback; }
    };
}
function setup() {
    const controls = {};
    const context = vm.createContext({
        document: { createElement: element, getElementById: id => controls[id] || null },
        MAP: { shareMode: false, editMode: true, setCursor() {} },
        UI: { forceCloseSharedInfoCard() {} },
        bus: { emit() {} }, I18n: { live: cb => cb, text() {} },
        google: { maps: { LatLng: class { constructor(lat, lng) { this.lat = lat; this.lng = lng; } }, event: { removeListener() {} } } }
    });
    const source = fs.readFileSync(path.join(__dirname, '../public/js/main.js'), 'utf8');
    vm.runInContext(source.slice(source.indexOf('class FreeLayerManager {'), source.indexOf('const FREE_DRAW =')) + '\nthis.Manager = FreeLayerManager;', context);
    const manager = Object.create(context.Manager.prototype);
    manager.items = [];
    manager.createIconMarker = item => { item.marker = { content: element() }; manager.renderIconContent(item, item.marker.content); };
    return { manager, controls };
}

test('circle and icon share dimensions at every supported scale, zoom and map type', () => {
    const { manager } = setup();
    for (const scale of [0.5, 0.75, 1, 1.5, 2, 3]) {
        for (const zoom of [0, 5, 12, 18, 22]) {
            for (const type of ['roadmap', 'satellite', 'hybrid', 'terrain']) {
                manager.map = { getZoom: () => zoom, getMapTypeId: () => type };
                const node = element();
                manager.renderIconContent({ scale, iconName: 'local_police', iconBackgroundEnabled: true, iconBackgroundColor: '#123456', iconBackgroundOpacity: 0.35 }, node);
                const size = Math.max(5, Math.min(24 * scale, 24 * scale * Math.pow(2, (zoom - 18) * 0.65)));
                assert.equal(manager.iconPixelSize({ scale }), size);
                assert.ok(node.style.cssText.includes(`width:${size}px;height:${size}px`));
                assert.match(node.style.cssText, /align-items:center;justify-content:center/);
                assert.match(node.style.cssText, /padding:0;margin:0;border:0;outline:0;box-shadow:none/);
                const [circle, icon] = node.children;
                assert.match(circle.style.cssText, /inset:0;width:100%;height:100%;border-radius:50%/);
                assert.match(circle.style.cssText, /background-color:#123456;opacity:0.35/);
                assert.ok(icon.style.cssText.includes(`font-size:${size}px`));
                assert.doesNotMatch(icon.style.cssText, /opacity:/);
            }
        }
    }
});

test('old icons have no background; disable and transparent backgrounds work independently', () => {
    const { manager } = setup();
    const node = element();
    manager.renderIconContent({ scale: 1, iconName: 'place' }, node);
    assert.equal(node.children.length, 1);
    manager.renderIconContent({ iconBackgroundEnabled: true, iconBackgroundOpacity: 0 }, node);
    assert.equal(node.children.length, 2);
    assert.match(node.children[0].style.cssText, /opacity:0;/);
    manager.renderIconContent({ iconBackgroundEnabled: false }, node);
    assert.equal(node.children.length, 1);
    assert.equal(manager.iconBackground({ iconBackgroundColor: 'invalid', iconBackgroundOpacity: -1 }).iconBackgroundColor, '#ffffff');
    assert.equal(manager.iconBackground({ iconBackgroundOpacity: 4 }).iconBackgroundOpacity, 1);
});

test('zoom refresh restores pre-background overview sizes for old and new icons', () => {
    const { manager } = setup();
    let zoom = 18;
    manager.map = { getZoom: () => zoom };
    // Golden dimensions from the renderer before circular backgrounds (c01622a).
    const cases = [[18, 24, 72], [12, 5, 5], [5, 5, 5], [22, 24, 72], [18, 24, 72]];
    for (const background of [undefined, false, true]) {
        manager.items = [1, 3].map(scale => ({ type: 'icon', scale, iconName: 'local_police', iconBackgroundEnabled: background, marker: { content: element() } }));
        for (const [level, normal, large] of cases) {
            zoom = level;
            manager.refreshIconSizes();
            manager.items.forEach((item, index) => {
                const size = index === 0 ? normal : large;
                const content = item.marker.content;
                assert.ok(content.style.cssText.includes(`width:${size}px;height:${size}px`));
                assert.equal(content.children.length, background === true ? 2 : 1);
                assert.doesNotMatch(content.style.cssText, /transform:/);
                if (background) assert.match(content.children[0].style.cssText, /width:100%;height:100%/);
            });
        }
    }
});

test('background survives JSON save/share/load and renders identically', () => {
    const { manager } = setup();
    const item = { id: 'test', type: 'icon', position: { lat: 24, lng: 46 }, iconName: 'event', color: '#abcdef', scale: 2, iconBackgroundEnabled: true, iconBackgroundColor: '#123456', iconBackgroundOpacity: 0.42 };
    manager.createIconMarker(item); manager.items.push(item);
    const original = item.marker.content;
    const saved = JSON.parse(JSON.stringify(manager.exportState()));
    manager.applyState(saved);
    const loaded = manager.items[0];
    for (const key of ['iconBackgroundEnabled', 'iconBackgroundColor', 'iconBackgroundOpacity']) assert.equal(loaded[key], item[key]);
    assert.equal(loaded.marker.content.style.cssText, original.style.cssText);
    assert.equal(loaded.marker.content.children[0].style.cssText, original.children[0].style.cssText);
});

test('duplicate handler carries all background settings', () => {
    const { manager, controls } = setup();
    controls['duplicate-icon-btn'] = element();
    let mapClick;
    manager.map = { getZoom: () => 18, addListener: (_, cb) => { mapClick = cb; return {}; } };
    const item = { type: 'icon', iconName: 'event', scale: 1.5, color: '#abcdef', iconBackgroundEnabled: true, iconBackgroundColor: '#345678', iconBackgroundOpacity: 0.3 };
    manager.attachEditCardEvents(item);
    controls['duplicate-icon-btn'].events.click();
    mapClick({ latLng: { lat: 24, lng: 46 } });
    const copy = manager.items[0];
    for (const key of ['iconName', 'scale', 'color', 'iconBackgroundEnabled', 'iconBackgroundColor', 'iconBackgroundOpacity']) assert.equal(copy[key], item[key]);
});

test('edit save applies background; cancel does not change settings', () => {
    const { manager, controls } = setup();
    for (const id of ['save-btn', 'cancel-btn', 'icon-color', 'icon-scale', 'icon-background-enabled', 'icon-background-color', 'icon-background-opacity', 'icon-background-opacity-value']) controls[id] = element();
    controls['icon-color'].value = '#abcdef'; controls['icon-scale'].value = '2';
    controls['icon-background-enabled'].checked = true;
    controls['icon-background-color'].value = '#123456'; controls['icon-background-opacity'].value = '45';
    const item = { type: 'icon', scale: 1 };
    manager.createIconMarker(item);
    manager.attachEditCardEvents(item);
    controls['cancel-btn'].events.click();
    assert.equal(item.iconBackgroundEnabled, undefined);
    controls['save-btn'].events.click();
    assert.equal(item.iconBackgroundEnabled, true);
    assert.equal(item.iconBackgroundOpacity, 0.45);
    assert.equal(item.iconBackgroundColor, '#123456');
    assert.equal(item.scale, 2);
});
