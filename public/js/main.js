'use strict';

/*
============================================================
   Diriyah Security Map – v26.0 (Free Draw & MyMaps Icons)
   • نظام اختيار أيقونات مطابق لـ Google My Maps
   • إضافة نصوص حرة (Text Labels)
   • وضع الرسم الحر (Free Draw Mode)
   • تصنيفات أيقونات (الأزمات، النقل، الأشكال...)
   ============================================================ */

/* --- 1. إعدادات النظام والأحداث --- */
window.initMap = function () {
    if (window.MapController && typeof window.MapController.init === 'function') {
        window.MapController.init();
    } else {
        console.error("MapController لم يتم تحميله.");
    }
};

class EventBus {
    constructor() { this.events = {}; }
    on(event, handler) {
        if (!this.events[event]) this.events[event] = [];
        this.events[event].push(handler);
    }
    emit(event, data) {
        if (this.events[event]) this.events[event].forEach(h => h(data));
    }
}
const bus = new EventBus();

/* --- 2. الأدوات المساعدة --- */
const Utils = {
    clamp(v, min, max) { return Math.min(max, Math.max(min, v)); },
    escapeHTML(str) {
        return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    },
    b64uEncode(str) { /* ... (نفس كود الضغط السابق) ... */ return btoa(encodeURIComponent(str)); }, // تبسيط للعرض
    b64uDecode(str) { try { return decodeURIComponent(atob(str)); } catch(e) { return null; } },
    formatDistance(m) { return m < 1000 ? m.toFixed(0) + " م" : (m / 1000).toFixed(2) + " كم"; },
    formatArea(m) { return m >= 1000000 ? (m / 1000000).toFixed(2) + " كم²" : Math.round(m).toLocaleString('ar-SA') + " م²"; }
};

/* --- 3. قاعدة بيانات الأيقونات (مطابقة للصورة) --- */
const ICON_DB = {
    categories: [
        { id: 'shapes', label: 'الأشكال' },
        { id: 'transport', label: 'وسائل النقل' },
        { id: 'places', label: 'الأماكن' },
        { id: 'crisis', label: 'الأزمات' },
        { id: 'sports', label: 'الرياضة والاستجمام' }
    ],
    icons: {
        shapes: ['circle', 'square', 'star', 'change_history', 'pentagon', 'hexagon', 'favorite', 'grade', 'lens', 'panorama_fish_eye'],
        transport: ['directions_car', 'directions_bus', 'directions_boat', 'flight', 'local_shipping', 'train', 'tram', 'subway', 'taxi_alert', 'two_wheeler', 'pedal_bike', 'directions_walk'],
        places: ['home', 'store', 'school', 'local_hospital', 'restaurant', 'local_hotel', 'local_gas_station', 'local_parking', 'park', 'mosque', 'business', 'shopping_bag'],
        crisis: ['warning', 'report', 'local_police', 'local_fire_department', 'medical_services', 'shield', 'security', 'gpp_good', 'health_and_safety', 'emergency', 'policy', 'campaign'],
        sports: ['sports_soccer', 'pool', 'fitness_center', 'sports_tennis', 'sports_basketball', 'hiking', 'kayaking', 'sports_esports']
    }
};

/*
============================================================
   IconPickerModal
— نافذة اختيار الأيقونات (ستايل خرائطي)
============================================================
*/
class IconPickerModal {
    constructor() {
        this.overlay = null;
        this.onSelect = null;
        this.currentCategory = 'transport';
        this.injectStyles();
    }

    injectStyles() {
        const css = `
            .icon-picker-overlay {
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0,0,0,0.5); z-index: 9999;
                display: flex; justify-content: center; align-items: center;
                backdrop-filter: blur(4px);
            }
            .icon-picker-box {
                background: white; width: 700px; max-width: 95%; height: 500px;
                border-radius: 4px; box-shadow: 0 4px 20px rgba(0,0,0,0.2);
                display: flex; flex-direction: column; font-family: 'Tajawal', sans-serif;
                direction: rtl;
            }
            .ip-header {
                padding: 15px 20px; border-bottom: 1px solid #eee;
                display: flex; justify-content: space-between; align-items: center;
            }
            .ip-close { cursor: pointer; color: #666; font-size: 24px; }
            .ip-body { flex: 1; padding: 20px; overflow: hidden; display: flex; flex-direction: column; }
            .ip-nav {
                display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;
            }
            .ip-search {
                padding: 8px; border: 1px solid #ccc; border-radius: 4px; width: 200px;
            }
            .ip-cats { display: flex; gap: 15px; font-size: 13px; }
            .ip-cat-link { color: #4285f4; cursor: pointer; text-decoration: none; }
            .ip-cat-link.active { color: #333; font-weight: bold; cursor: default; }
            .ip-grid {
                flex: 1; overflow-y: auto; display: grid;
                grid-template-columns: repeat(auto-fill, minmax(40px, 1fr));
                gap: 10px; align-content: start;
            }
            .ip-icon-item {
                width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;
                cursor: pointer; border-radius: 4px; transition: 0.2s;
            }
            .ip-icon-item:hover { background: #f0f0f0; }
            .ip-icon-item i { font-size: 24px; color: #555; }
            .ip-footer {
                padding: 15px 20px; border-top: 1px solid #eee;
                display: flex; justify-content: flex-end; gap: 10px;
            }
            .ip-btn { padding: 8px 20px; border-radius: 4px; cursor: pointer; font-weight: bold; border: none; }
            .ip-btn-cancel { background: #fff; border: 1px solid #ddd; color: #555; }
            .ip-btn-ok { background: #4285f4; color: white; }
        `;
        const style = document.createElement('style');
        style.innerHTML = css;
        document.head.appendChild(style);
    }

    open(callback) {
        this.onSelect = callback;
        this.render();
    }

    close() {
        if (this.overlay) {
            document.body.removeChild(this.overlay);
            this.overlay = null;
        }
    }

    render() {
        this.overlay = document.createElement('div');
        this.overlay.className = 'icon-picker-overlay';
        
        const catsHtml = ICON_DB.categories.map(cat => 
            `<span class="ip-cat-link ${cat.id === this.currentCategory ? 'active' : ''}" data-cat="${cat.id}">${cat.label}</span>`
        ).join('');

        this.overlay.innerHTML = `
            <div class="icon-picker-box">
                <div class="ip-header">
                    <h3 style="margin:0; font-size:18px;">اختيار رمز</h3>
                    <span class="ip-close">&times;</span>
                </div>
                <div class="ip-body">
                    <div class="ip-nav">
                        <input type="text" class="ip-search" placeholder="الفلتر">
                        <div class="ip-cats">${catsHtml}</div>
                    </div>
                    <div class="ip-grid" id="ip-grid-container"></div>
                </div>
                <div class="ip-footer">
                    <button class="ip-btn ip-btn-cancel">إلغاء</button>
                </div>
            </div>
        `;

        document.body.appendChild(this.overlay);
        this.renderIcons();
        this.attachEvents();
    }

    renderIcons() {
        const container = document.getElementById('ip-grid-container');
        container.innerHTML = '';
        const icons = ICON_DB.icons[this.currentCategory] || [];
        
        icons.forEach(icon => {
            const el = document.createElement('div');
            el.className = 'ip-icon-item';
            el.innerHTML = `<i class="material-icons">${icon}</i>`;
            el.addEventListener('click', () => {
                if (this.onSelect) this.onSelect(icon);
                this.close();
            });
            container.appendChild(el);
        });
    }

    attachEvents() {
        this.overlay.querySelector('.ip-close').onclick = () => this.close();
        this.overlay.querySelector('.ip-btn-cancel').onclick = () => this.close();
        
        const catLinks = this.overlay.querySelectorAll('.ip-cat-link');
        catLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                this.currentCategory = e.target.dataset.cat;
                // Update active state
                catLinks.forEach(l => l.classList.remove('active'));
                e.target.classList.add('active');
                this.renderIcons();
            });
        });
    }
}
const ICON_PICKER = new IconPickerModal();

/*
============================================================
   MapController
============================================================
*/
class MapController {
    constructor() {
        this.map = null;
        this.editMode = true;
        this.shareMode = false;
        this.modeFreeDraw = false; // الوضع الجديد
        this.modeAdd = false;
        this.modeRouteAdd = false;
        this.modePolygonAdd = false;
        window.MapController = this;
    }

    init() {
        console.log("Boot v26.0 - Free Draw & Icons");
        const params = new URLSearchParams(location.search);
        this.shareMode = params.has("x");
        this.editMode = !this.shareMode;

        this.map = new google.maps.Map(document.getElementById("map"), {
            center: { lat: 24.7399, lng: 46.5731 },
            zoom: 15,
            mapTypeId: "roadmap",
            mapId: "b76177e462344e3ee4d9178b", // تأكد من أن هذا الـ ID يدعم AdvancedMarkerElement
            streetViewControl: false,
            mapTypeControl: false,
            fullscreenControl: true,
            zoomControl: true,
            clickableIcons: false
        });

        // الأحداث
        this.map.addListener("click", (e) => {
            if (this.shareMode) return;
            bus.emit("map:click", e);
        });

        this.waitForGmpMarkersAndEmit();
    }

    waitForGmpMarkersAndEmit() {
        if (typeof google.maps.marker !== 'undefined' && typeof google.maps.marker.AdvancedMarkerElement !== 'undefined') {
            bus.emit("map:ready", this.map);
        } else {
            setTimeout(() => this.waitForGmpMarkersAndEmit(), 100);
        }
    }

    setCursor(c) { this.map.setOptions({ draggableCursor: c }); }
}
const MAP = new MapController();

/*
============================================================
   FreeLayerManager
— إدارة الرسم الحر (أيقونات + نصوص)
============================================================
*/
class FreeLayerManager {
    constructor() {
        this.items = [];
        this.map = null;
        
        bus.on("map:ready", map => {
            this.map = map;
            this.onMapReady();
        });
        
        bus.on("map:click", e => {
            if (!MAP.modeFreeDraw) return;
            this.handleMapClick(e.latLng);
        });

        bus.on("state:load", st => this.applyState(st));
        bus.on("state:save", () => this.exportState());
    }

    onMapReady() { /* Placeholder */ }

    handleMapClick(latLng) {
        // إنشاء نافذة اختيار صغيرة (نص أم أيقونة) في مكان النقر
        const choiceDiv = document.createElement('div');
        choiceDiv.style.cssText = `padding: 10px; display: flex; gap: 10px; font-family: 'Tajawal';`;
        choiceDiv.innerHTML = `
            <button id="fd-btn-icon" style="background:#4285f4; color:white; border:none; padding:8px 12px; border-radius:6px; cursor:pointer;">أيقونة</button>
            <button id="fd-btn-text" style="background:#34a853; color:white; border:none; padding:8px 12px; border-radius:6px; cursor:pointer;">نص</button>
        `;

        const infoWindow = new google.maps.InfoWindow({
            content: choiceDiv,
            position: latLng,
            disableAutoPan: true
        });
        infoWindow.open(this.map);

        // التعامل مع الاختيار
        google.maps.event.addListenerOnce(infoWindow, 'domready', () => {
            document.getElementById('fd-btn-icon').onclick = () => {
                infoWindow.close();
                this.addIcon(latLng);
            };
            document.getElementById('fd-btn-text').onclick = () => {
                infoWindow.close();
                this.addText(latLng);
            };
        });
        
        // إيقاف الوضع بعد النقر لمرة واحدة (اختياري، يمكن إزالته لاستمرار الرسم)
        // MAP.modeFreeDraw = false; 
        // MAP.setCursor("grab");
        // UI.showDefaultUI();
    }

    addIcon(latLng) {
        // فتح نافذة اختيار الأيقونات
        ICON_PICKER.open((iconName) => {
            this.createItem({
                type: 'icon',
                icon: iconName,
                lat: latLng.lat(),
                lng: latLng.lng(),
                color: '#1a73e8',
                name: 'رمز جديد'
            });
            bus.emit("persist");
        });
    }

    addText(latLng) {
        this.createItem({
            type: 'text',
            text: 'نص جديد',
            lat: latLng.lat(),
            lng: latLng.lng(),
            color: '#000000',
            fontSize: 16
        });
        bus.emit("persist");
    }

    createItem(data) {
        const id = data.id || "f" + Date.now() + Math.random();
        let contentEl;

        if (data.type === 'icon') {
            contentEl = document.createElement("div");
            contentEl.style.cssText = `color: ${data.color}; font-size: 24px; cursor: pointer; filter: drop-shadow(0 2px 2px rgba(0,0,0,0.3));`;
            contentEl.innerHTML = `<i class="material-icons" style="font-size: 32px;">${data.icon}</i>`;
        } else {
            contentEl = document.createElement("div");
            contentEl.style.cssText = `color: ${data.color}; font-family: 'Cairo'; font-weight: bold; font-size: ${data.fontSize || 16}px; text-shadow: 0 0 3px white; cursor: pointer; white-space: nowrap;`;
            contentEl.innerText = data.text;
        }

        const marker = new google.maps.marker.AdvancedMarkerElement({
            position: { lat: data.lat, lng: data.lng },
            map: this.map,
            content: contentEl,
            gmpDraggable: !MAP.shareMode
        });

        const item = {
            id: id,
            ...data,
            marker: marker
        };

        marker.addListener("click", () => {
            if(!MAP.shareMode) this.openEditCard(item);
        });
        marker.addListener("dragend", () => {
            item.lat = marker.position.lat;
            item.lng = marker.position.lng;
            bus.emit("persist");
        });

        this.items.push(item);
    }

    openEditCard(item) {
        const isIcon = item.type === 'icon';
        const title = isIcon ? 'تعديل الرمز' : 'تعديل النص';
        
        const bodyContent = isIcon ? `
            <div style="margin-bottom:10px;">
                <label style="display:block;font-size:12px;margin-bottom:5px;">الاسم:</label>
                <input id="fd-name" type="text" value="${item.name}" style="width:100%;padding:5px;border-radius:5px;border:1px solid #ddd;">
            </div>
            <div style="margin-bottom:10px;">
                <label style="display:block;font-size:12px;margin-bottom:5px;">اللون:</label>
                <input id="fd-color" type="color" value="${item.color}" style="width:100%;height:30px;">
            </div>
            <button id="fd-change-icon" style="width:100%;padding:8px;background:#eee;border:none;border-radius:5px;cursor:pointer;margin-bottom:10px;">تغيير الأيقونة</button>
        ` : `
            <div style="margin-bottom:10px;">
                <label style="display:block;font-size:12px;margin-bottom:5px;">النص:</label>
                <input id="fd-text" type="text" value="${item.text}" style="width:100%;padding:5px;border-radius:5px;border:1px solid #ddd;">
            </div>
            <div style="display:flex;gap:10px;margin-bottom:10px;">
                <div style="flex:1">
                    <label style="display:block;font-size:12px;margin-bottom:5px;">اللون:</label>
                    <input id="fd-color" type="color" value="${item.color}" style="width:100%;height:30px;">
                </div>
                <div style="flex:1">
                    <label style="display:block;font-size:12px;margin-bottom:5px;">الحجم:</label>
                    <input id="fd-size" type="number" value="${item.fontSize}" style="width:100%;padding:5px;border-radius:5px;border:1px solid #ddd;">
                </div>
            </div>
        `;

        const html = `
            <div style="font-family:'Cairo'; padding:15px; background:rgba(255,255,255,0.9); backdrop-filter:blur(10px); border-radius:15px; direction:rtl; width:280px; box-shadow:0 5px 20px rgba(0,0,0,0.2);">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;">
                    <h3 style="margin:0;font-size:16px;">${title}</h3>
                    <button id="fd-close" style="background:none;border:none;cursor:pointer;font-size:18px;">&times;</button>
                </div>
                ${bodyContent}
                <div style="display:flex;gap:10px;margin-top:15px;">
                    <button id="fd-save" style="flex:2;background:#4285f4;color:white;border:none;padding:8px;border-radius:5px;cursor:pointer;">حفظ</button>
                    <button id="fd-delete" style="flex:1;background:#e94235;color:white;border:none;padding:8px;border-radius:5px;cursor:pointer;">حذف</button>
                </div>
            </div>
        `;

        UI.openSharedInfoCard(html, item.marker.position, true);

        // Events
        google.maps.event.addListenerOnce(UI.sharedInfoWindow, 'domready', () => {
            document.getElementById('fd-close').onclick = () => UI.forceCloseSharedInfoCard();
            
            document.getElementById('fd-delete').onclick = () => {
                if(confirm('حذف هذا العنصر؟')) {
                    item.marker.map = null;
                    this.items = this.items.filter(i => i.id !== item.id);
                    UI.forceCloseSharedInfoCard();
                    bus.emit("persist");
                }
            };

            if(isIcon) {
                document.getElementById('fd-change-icon').onclick = () => {
                    ICON_PICKER.open((newIcon) => {
                        item.icon = newIcon;
                        this.updateMarkerVisuals(item);
                    });
                };
            }

            document.getElementById('fd-save').onclick = () => {
                item.color = document.getElementById('fd-color').value;
                if(isIcon) {
                    item.name = document.getElementById('fd-name').value;
                } else {
                    item.text = document.getElementById('fd-text').value;
                    item.fontSize = document.getElementById('fd-size').value;
                }
                this.updateMarkerVisuals(item);
                UI.forceCloseSharedInfoCard();
                bus.emit("persist");
            };
        });
    }

    updateMarkerVisuals(item) {
        if (item.type === 'icon') {
            item.marker.content.style.color = item.color;
            item.marker.content.innerHTML = `<i class="material-icons" style="font-size: 32px;">${item.icon}</i>`;
        } else {
            item.marker.content.style.color = item.color;
            item.marker.content.style.fontSize = item.fontSize + 'px';
            item.marker.content.innerText = item.text;
        }
    }

    exportState() {
        return this.items.map(i => ({
            id: i.id, type: i.type, lat: i.marker.position.lat, lng: i.marker.position.lng,
            icon: i.icon, text: i.text, color: i.color, name: i.name, fontSize: i.fontSize
        }));
    }

    applyState(state) {
        if (!state || !state.freeDraw) return;
        this.items.forEach(i => i.marker.map = null);
        this.items = [];
        state.freeDraw.forEach(data => this.createItem(data));
    }
}
const FREE_DRAW = new FreeLayerManager();

/*
============================================================
   StateManager
============================================================
*/
class StateManager {
    constructor() {
        this.map = null;
        this.shareMode = false;
        this.persistTimer = null;
        bus.on("map:ready", map => {
            this.map = map;
            this.shareMode = MAP.shareMode;
            const st = this.readShare();
            if (st) this.applyState(st);
            if (!this.shareMode) bus.on("persist", () => this.schedulePersist());
        });
    }

    buildState() {
        if (!this.map) return null;
        const c = this.map.getCenter();
        return {
            v: 2,
            map: { c: [c.lat(), c.lng()], z: this.map.getZoom(), t: this.map.getMapTypeId() },
            // ... (Other managers: ROUTES, LOCATIONS, POLYGONS - Assuming they exist from previous code)
            freeDraw: FREE_DRAW.exportState() // Add Free Draw Layer
        };
    }
    
    // ... (rest of methods: writeShare, readShare same as before) ...

    applyState(state) {
        if (!state) return;
        if (state.map) {
            this.map.setCenter({ lat: state.map.c[0], lng: state.map.c[1] });
            this.map.setZoom(state.map.z);
            if(state.map.t) this.map.setMapTypeId(state.map.t);
        }
        if (state.freeDraw) FREE_DRAW.applyState({ freeDraw: state.freeDraw });
        // ... Apply other layers ...
    }
    
    // ... Helper Methods (schedulePersist, etc) ...
    schedulePersist() {
        if(this.shareMode) return;
        clearTimeout(this.persistTimer);
        this.persistTimer = setTimeout(() => {
            const st = this.buildState();
            // In a real app, save to localStorage or update URL
            console.log("State Saved", st); 
        }, 500);
    }
    readShare() { return null; } // Placeholder
}
const STATE = new StateManager();

/*
============================================================
   UIManager
============================================================
*/
class UIManager {
    constructor() {
        this.sharedInfoWindow = new google.maps.InfoWindow();
        this.infoWindowPinned = false;
        
        // Buttons
        this.btnFreeDraw = document.getElementById("btn-free-draw"); // الزر الجديد
        
        bus.on("map:ready", () => this.init());
    }

    init() {
        // حقن CSS للنوافذ
        const style = document.createElement('style');
        style.innerHTML = `.gm-style-iw-c { padding: 0 !important; overflow: visible !important; background: transparent !important; box-shadow: none !important; } .gm-style-iw-tc { display: none; } .gm-ui-hover-effect { display: none !important; }`;
        document.head.appendChild(style);

        if (this.btnFreeDraw) {
            this.btnFreeDraw.addEventListener("click", () => {
                MAP.modeFreeDraw = !MAP.modeFreeDraw;
                this.btnFreeDraw.setAttribute("aria-pressed", MAP.modeFreeDraw);
                MAP.setCursor(MAP.modeFreeDraw ? "crosshair" : "grab");
                bus.emit("toast", MAP.modeFreeDraw ? "وضع الرسم الحر: انقر لإضافة رمز أو نص" : "تم الخروج من وضع الرسم");
            });
        }
    }

    openSharedInfoCard(content, position, isPinned) {
        this.sharedInfoWindow.close();
        this.sharedInfoWindow.setContent(content);
        this.sharedInfoWindow.setPosition(position);
        this.sharedInfoWindow.open(MAP.map);
        this.infoWindowPinned = isPinned;
    }

    forceCloseSharedInfoCard() {
        this.sharedInfoWindow.close();
        this.infoWindowPinned = false;
    }
}
const UI = new UIManager();

// Boot
class BootLoader {
    constructor() { this.tryBoot(); }
    tryBoot() {
        if (window.google && google.maps) {
            console.log("Diriyah Map Ready");
            // Assuming HTML has elements like #map, #btn-free-draw
        } else { setTimeout(() => this.tryBoot(), 100); }
    }
}
const BOOT = new BootLoader();
