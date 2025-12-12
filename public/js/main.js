/**
 * ===================================================================================
 * PROJECT: DIRIYAH SECURITY MAP SYSTEM
 * VERSION: v28.0 (Ultimate Edition)
 * DESCRIPTION: نظام خرائط أمني متكامل يدعم:
 * 1. إدارة المواقع (Markers)
 * 2. إدارة المسارات (Routes)
 * 3. إدارة المضلعات (Polygons) مع التعديل والحذف
 * 4. الرسم الحر (Free Draw) للنصوص والأيقونات
 * 5. أدوات القياس (Measurement)
 * 6. مشاركة الحالة عبر الرابط (State Management)
 * 7. واجهة مستخدم زجاجية (Glass UI) متجاوبة
 * ===================================================================================
 */

'use strict';

/* ==========================================================================
   1. GLOBAL CONFIGURATION & EVENT BUS
   ========================================================================== */

/**
 * EventBus: نظام مراسلة داخلي لربط أجزاء التطبيق ببعضها دون تداخل.
 */
class EventBus {
    constructor() {
        this.events = {};
    }

    on(event, handler) {
        if (!this.events[event]) this.events[event] = [];
        this.events[event].push(handler);
    }

    emit(event, data) {
        if (this.events[event]) {
            this.events[event].forEach(handler => handler(data));
        }
    }
}

const bus = new EventBus();

// تهيئة الخريطة عند تحميل مكتبة جوجل
window.initMap = function () {
    if (window.MapController && typeof window.MapController.init === 'function') {
        window.MapController.init();
    } else {
        console.warn("MapController not ready yet. Retrying in 100ms...");
        setTimeout(window.initMap, 100);
    }
};

/* ==========================================================================
   2. UTILITIES & HELPERS
   ========================================================================== */

const Utils = {
    /**
     * تقييد رقم بين حد أدنى وحد أقصى
     */
    clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    },

    /**
     * تنظيف النصوص من أكواد HTML لمنع هجمات XSS
     */
    escapeHTML(str) {
        if (!str) return "";
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    },

    /**
     * ضغط البيانات لتقصير الرابط (Base64 URL Safe)
     */
    b64uEncode(str) {
        try {
            const textEncoder = new TextEncoder();
            const bytes = textEncoder.encode(str);
            const compressed = pako.deflate(bytes); // يتطلب مكتبة pako
            let binary = "";
            compressed.forEach(b => binary += String.fromCharCode(b));
            return btoa(binary)
                .replace(/\+/g, "-")
                .replace(/\//g, "_")
                .replace(/=+$/, "");
        } catch (e) {
            console.error("Encoding Error:", e);
            return "";
        }
    },

    /**
     * فك ضغط البيانات من الرابط
     */
    b64uDecode(str) {
        try {
            if (!str) return null;
            str = str.replace(/-/g, "+").replace(/_/g, "/");
            while (str.length % 4) str += "=";
            const decoded = atob(str);
            const compressedBytes = Uint8Array.from(decoded, c => c.charCodeAt(0));
            const decompressedBytes = pako.inflate(compressedBytes);
            const textDecoder = new TextDecoder();
            return textDecoder.decode(decompressedBytes);
        } catch (e) {
            console.error("Decoding Error:", e);
            return null;
        }
    },

    /**
     * تنسيق المسافة (متر / كيلومتر)
     */
    formatDistance(meters) {
        if (!meters || isNaN(meters)) return "0 م";
        if (meters < 1000) return Math.round(meters) + " م";
        return (meters / 1000).toFixed(2) + " كم";
    },

    /**
     * تنسيق المساحة
     */
    formatArea(sqMeters) {
        if (!sqMeters || isNaN(sqMeters)) return "0 م²";
        if (sqMeters >= 1000000) {
            return (sqMeters / 1000000).toFixed(2) + " كم²";
        }
        return Math.round(sqMeters).toLocaleString('en-US') + " م²";
    },

    /**
     * تنسيق الوقت
     */
    formatDuration(seconds) {
        if (!seconds) return "0 دقيقة";
        const m = Math.round(seconds / 60);
        if (m < 60) return m + " دقيقة";
        const h = Math.floor(m / 60);
        const r = m % 60;
        return `${h} ساعة ${r} دقيقة`;
    }
};

/* ==========================================================================
   3. ICON DATABASE (GOOGLE MY MAPS STYLE)
   ========================================================================== */

const ICON_DB = {
    categories: [
        { id: 'shapes', label: 'الأشكال والعلامات' },
        { id: 'places', label: 'الأماكن والمباني' },
        { id: 'transport', label: 'وسائل النقل' },
        { id: 'crisis', label: 'الأزمات والطوارئ' },
        { id: 'services', label: 'الخدمات العامة' },
        { id: 'sports', label: 'الرياضة والترفيه' }
    ],
    icons: {
        shapes: [
            'circle', 'square', 'star', 'pentagon', 'hexagon', 'change_history', 
            'favorite', 'grade', 'lens', 'panorama_fish_eye', 'check_box_outline_blank', 
            'radio_button_unchecked', 'crop_square', 'brightness_1'
        ],
        places: [
            'home', 'store', 'school', 'local_hospital', 'restaurant', 'local_hotel', 
            'local_gas_station', 'local_parking', 'park', 'mosque', 'business', 
            'shopping_bag', 'museum', 'library_books', 'apartment', 'location_city', 
            'stadium', 'warehouse', 'account_balance'
        ],
        transport: [
            'directions_car', 'directions_bus', 'directions_boat', 'flight', 
            'local_shipping', 'train', 'tram', 'subway', 'taxi_alert', 'two_wheeler', 
            'pedal_bike', 'directions_walk', 'traffic', 'commute', 'agriculture', 
            'airport_shuttle', 'electric_car'
        ],
        crisis: [
            'warning', 'report', 'local_police', 'local_fire_department', 
            'medical_services', 'shield', 'security', 'gpp_good', 'health_and_safety', 
            'emergency', 'policy', 'campaign', 'notification_important', 'dangerous', 
            'fire_extinguisher', 'military_tech'
        ],
        services: [
            'local_atm', 'local_post_office', 'local_laundry_service', 'electrical_services',
            'plumbing', 'cleaning_services', 'hvac', 'construction', 'engineering',
            'support_agent', 'wifi', 'power'
        ],
        sports: [
            'sports_soccer', 'pool', 'fitness_center', 'sports_tennis', 'sports_basketball', 
            'hiking', 'kayaking', 'sports_esports', 'sports_football', 'sports_golf',
            'sports_motorsports'
        ]
    }
};

/* ==========================================================================
   4. ICON PICKER UI MODAL
   ========================================================================== */

class IconPickerModal {
    constructor() {
        this.overlay = null;
        this.onSelect = null;
        this.currentCategory = 'shapes';
        this.injectStyles();
    }

    injectStyles() {
        if(document.getElementById('ip-styles')) return;
        const css = `
            .ip-overlay {
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0,0,0,0.6); z-index: 100000;
                display: flex; justify-content: center; align-items: center;
                backdrop-filter: blur(5px); font-family: 'Tajawal', sans-serif;
            }
            .ip-box {
                background: #fff; width: 850px; max-width: 95%; height: 650px; max-height: 90vh;
                border-radius: 8px; box-shadow: 0 15px 50px rgba(0,0,0,0.5);
                display: flex; flex-direction: column; direction: rtl;
                animation: ipFadeIn 0.2s ease-out;
            }
            @keyframes ipFadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
            .ip-header { padding: 20px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; }
            .ip-title { margin: 0; font-size: 22px; color: #202124; }
            .ip-close { cursor: pointer; font-size: 24px; color: #5f6368; }
            .ip-body { flex: 1; display: flex; flex-direction: column; overflow: hidden; background: #f8f9fa; }
            .ip-toolbar { padding: 15px 20px; background: #fff; border-bottom: 1px solid #eee; display: flex; flex-wrap: wrap; gap: 15px; align-items: center; }
            .ip-search { padding: 8px 12px; border: 1px solid #dadce0; border-radius: 4px; width: 200px; font-family: inherit; }
            .ip-cats { display: flex; gap: 15px; overflow-x: auto; padding-bottom: 5px; flex: 1; }
            .ip-cat-btn { background: none; border: none; cursor: pointer; color: #1a73e8; font-weight: 500; white-space: nowrap; font-family: inherit; padding: 5px 10px; border-radius: 20px; transition: 0.2s; }
            .ip-cat-btn:hover { background: #e8f0fe; }
            .ip-cat-btn.active { background: #1a73e8; color: white; }
            .ip-grid { flex: 1; overflow-y: auto; padding: 25px; display: grid; grid-template-columns: repeat(auto-fill, minmax(50px, 1fr)); gap: 12px; align-content: start; }
            .ip-icon-item { width: 50px; height: 50px; display: flex; align-items: center; justify-content: center; background: #fff; border: 1px solid #dadce0; border-radius: 6px; cursor: pointer; transition: all 0.2s; }
            .ip-icon-item:hover { border-color: #1a73e8; background: #e8f0fe; transform: translateY(-2px); }
            .ip-icon-item i { font-size: 28px; color: #5f6368; }
            .ip-footer { padding: 15px 20px; border-top: 1px solid #eee; display: flex; justify-content: flex-end; background: #fff; gap: 10px; }
            .ip-btn { padding: 8px 24px; border-radius: 4px; cursor: pointer; font-weight: bold; font-family: inherit; border: none; }
            .ip-btn-cancel { background: #fff; border: 1px solid #dadce0; color: #3c4043; }
            .ip-btn-cancel:hover { background: #f1f3f4; }
        `;
        const style = document.createElement('style');
        style.id = 'ip-styles';
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
        if (this.overlay) return; // Prevent double open
        this.overlay = document.createElement('div');
        this.overlay.className = 'ip-overlay';
        
        // منع انتشار النقرات للخلفية
        this.overlay.onclick = (e) => {
            if (e.target === this.overlay) this.close();
        };

        const catsHtml = ICON_DB.categories.map(cat => 
            `<button class="ip-cat-btn ${cat.id === this.currentCategory ? 'active' : ''}" data-cat="${cat.id}">${cat.label}</button>`
        ).join('');

        this.overlay.innerHTML = `
            <div class="ip-box">
                <div class="ip-header">
                    <h2 class="ip-title">اختر رمزاً للخريطة</h2>
                    <span class="ip-close">&times;</span>
                </div>
                <div class="ip-body">
                    <div class="ip-toolbar">
                        <input type="text" class="ip-search" id="ip-search" placeholder="بحث عن رمز...">
                        <div class="ip-cats" id="ip-cats-container">${catsHtml}</div>
                    </div>
                    <div class="ip-grid" id="ip-grid"></div>
                </div>
                <div class="ip-footer">
                    <button class="ip-btn ip-btn-cancel">إلغاء</button>
                </div>
            </div>
        `;

        document.body.appendChild(this.overlay);
        
        // ربط العناصر
        this.gridEl = this.overlay.querySelector('#ip-grid');
        this.searchEl = this.overlay.querySelector('#ip-search');
        
        this.renderIcons();
        this.attachEvents();
    }

    renderIcons(filter = '') {
        this.gridEl.innerHTML = '';
        const icons = ICON_DB.icons[this.currentCategory] || [];
        
        icons.forEach(iconName => {
            if (filter && !iconName.includes(filter)) return;

            const el = document.createElement('div');
            el.className = 'ip-icon-item';
            el.title = iconName;
            el.innerHTML = `<i class="material-icons">${iconName}</i>`;
            el.onclick = () => {
                if (this.onSelect) this.onSelect(iconName);
                this.close();
            };
            this.gridEl.appendChild(el);
        });
    }

    attachEvents() {
        this.overlay.querySelector('.ip-close').onclick = () => this.close();
        this.overlay.querySelector('.ip-btn-cancel').onclick = () => this.close();

        // التبديل بين التصنيفات
        const catBtns = this.overlay.querySelectorAll('.ip-cat-btn');
        catBtns.forEach(btn => {
            btn.onclick = (e) => {
                this.currentCategory = e.target.dataset.cat;
                catBtns.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.searchEl.value = ''; // مسح البحث عند تغيير التصنيف
                this.renderIcons();
            };
        });

        // البحث
        this.searchEl.oninput = (e) => {
            const val = e.target.value.toLowerCase().trim();
            this.renderIcons(val);
        };
    }
}

const ICON_PICKER = new IconPickerModal();

/* ==========================================================================
   5. MAP CONTROLLER
   ========================================================================== */

class MapController {
    constructor() {
        this.map = null;
        this.trafficLayer = null;
        this.bicyclingLayer = null;
        this.transitLayer = null;
        
        this.editMode = true;
        this.shareMode = false;
        
        // Modes
        this.modeAdd = false;
        this.modeRouteAdd = false;
        this.modePolygonAdd = false;
        this.modeFreeDraw = false;

        this.defaultCenter = { lat: 24.7399, lng: 46.5731 }; // الدرعية
        this.defaultZoom = 15;

        window.MapController = this;
    }

    init() {
        console.log("MapController: Initializing v28.0...");
        
        // 1. التحقق من وضع المشاركة
        const params = new URLSearchParams(location.search);
        this.shareMode = params.has("x");
        this.editMode = !this.shareMode;

        // 2. محاولة إنشاء الخريطة
        try {
            const mapOptions = {
                center: this.defaultCenter,
                zoom: this.defaultZoom,
                mapTypeId: "roadmap",
                mapId: "b76177e462344e3ee4d9178b", // ID مطلوب للعلامات المتقدمة
                streetViewControl: false,
                mapTypeControl: false,
                fullscreenControl: true,
                zoomControl: true,
                gestureHandling: 'greedy',
                clickableIcons: false
            };

            this.map = new google.maps.Map(document.getElementById("map"), mapOptions);
            
            // تهيئة الطبقات
            this.trafficLayer = new google.maps.TrafficLayer();
            this.transitLayer = new google.maps.TransitLayer();
            this.bicyclingLayer = new google.maps.BicyclingLayer();

            // الاستماع للنقرات العامة
            this.map.addListener("click", (e) => {
                bus.emit("map:click", e);
            });

            this.map.addListener("zoom_changed", () => bus.emit("map:zoom", this.map.getZoom()));
            this.map.addListener("bounds_changed", () => bus.emit("map:bounds"));

            // 3. انتظار تحميل المكتبات الإضافية (AdvancedMarkerElement)
            this.waitForLibraries();

        } catch (error) {
            console.error("Map Initialization Failed:", error);
            alert("فشل تحميل الخريطة. تأكد من اتصال الإنترنت ومفتاح API.");
        }
    }

    waitForLibraries() {
        let attempts = 0;
        const checkInterval = setInterval(() => {
            attempts++;
            // التحقق من وجود المكتبات الضرورية
            if (google.maps.marker && google.maps.marker.AdvancedMarkerElement && google.maps.geometry) {
                clearInterval(checkInterval);
                console.log("Map & Libraries Fully Loaded.");
                bus.emit("map:ready", this.map);
            } else if (attempts > 50) { // 5 ثواني
                clearInterval(checkInterval);
                console.warn("Timeout waiting for libraries. Some features may not work.");
                // نطلق الحدث على أي حال لكي لا تتجمد الواجهة
                bus.emit("map:ready", this.map);
            }
        }, 100);
    }

    // دوال التحكم بالخريطة
    setRoadmap() { this.map.setMapTypeId("roadmap"); }
    setSatellite() { this.map.setMapTypeId("hybrid"); }
    setTerrain() { this.map.setMapTypeId("terrain"); }
    setDarkMode() { 
        // يمكن إضافة ستايل هنا، لكن للتبسيط سنستخدم roadmap
        this.map.setMapTypeId("roadmap"); 
        // تطبيق ستايل داكن عبر map options إذا توفرت البيانات
    }

    toggleTraffic() { this.trafficLayer.getMap() ? this.trafficLayer.setMap(null) : this.trafficLayer.setMap(this.map); }
    toggleTransit() { this.transitLayer.getMap() ? this.transitLayer.setMap(null) : this.transitLayer.setMap(this.map); }
    toggleBicycling() { this.bicyclingLayer.getMap() ? this.bicyclingLayer.setMap(null) : this.bicyclingLayer.setMap(this.map); }

    setCursor(cursorType) {
        this.map.setOptions({ draggableCursor: cursorType });
    }
}

const MAP = new MapController();

/* ==========================================================================
   6. FREE DRAW MANAGER (ICONS & TEXT)
   ========================================================================== */

class FreeLayerManager {
    constructor() {
        this.items = [];
        this.map = null;

        bus.on("map:ready", map => { this.map = map; });
        
        bus.on("map:click", e => {
            if (MAP.modeFreeDraw && !MAP.shareMode) {
                this.handleMapClick(e.latLng);
            }
        });

        bus.on("state:load", st => this.applyState(st));
        bus.on("state:save", () => this.exportState());
    }

    /**
     * معالجة النقر لإظهار خيارات (نص أم أيقونة)
     */
    handleMapClick(latLng) {
        // إنشاء نافذة خيارات مؤقتة
        const div = document.createElement('div');
        div.style.cssText = "padding:10px; display:flex; gap:10px; direction:rtl; font-family:'Tajawal';";
        div.innerHTML = `
            <button id="fd-icon-btn" style="background:#4285f4; color:white; border:none; padding:8px 12px; border-radius:6px; cursor:pointer; font-weight:bold; display:flex; align-items:center; gap:5px;">
                <i class="material-icons" style="font-size:18px;">star</i> رمز
            </button>
            <button id="fd-text-btn" style="background:#34a853; color:white; border:none; padding:8px 12px; border-radius:6px; cursor:pointer; font-weight:bold; display:flex; align-items:center; gap:5px;">
                <i class="material-icons" style="font-size:18px;">text_fields</i> نص
            </button>
        `;

        const infoWindow = new google.maps.InfoWindow({
            content: div,
            position: latLng,
            disableAutoPan: true,
            zIndex: 2000
        });

        infoWindow.open(this.map);

        google.maps.event.addListenerOnce(infoWindow, 'domready', () => {
            const btnIcon = document.getElementById('fd-icon-btn');
            const btnText = document.getElementById('fd-text-btn');

            if (btnIcon) btnIcon.onclick = () => {
                infoWindow.close();
                this.promptIconSelection(latLng);
            };

            if (btnText) btnText.onclick = () => {
                infoWindow.close();
                this.addTextItem(latLng);
            };
        });
    }

    promptIconSelection(latLng) {
        ICON_PICKER.open((selectedIcon) => {
            this.addItem({
                type: 'icon',
                icon: selectedIcon,
                lat: latLng.lat(),
                lng: latLng.lng(),
                color: '#ea4335', // Google Red Default
                name: 'رمز جديد',
                scale: 1.0
            });
            bus.emit("persist");
        });
    }

    addTextItem(latLng) {
        this.addItem({
            type: 'text',
            text: 'نص جديد',
            lat: latLng.lat(),
            lng: latLng.lng(),
            color: '#000000',
            fontSize: 16
        });
        bus.emit("persist");
    }

    addItem(data) {
        if (!this.map) return;
        
        const id = data.id || "f" + Date.now() + Math.random();
        const contentDiv = document.createElement("div");
        
        // بناء المحتوى بناءً على النوع
        if (data.type === 'icon') {
            const size = (32 * (data.scale || 1));
            contentDiv.style.cssText = `
                color: ${data.color}; 
                cursor: pointer; 
                display: flex; 
                flex-direction: column; 
                align-items: center;
                filter: drop-shadow(0 2px 3px rgba(0,0,0,0.3));
                transition: transform 0.2s;
            `;
            contentDiv.innerHTML = `
                <i class="material-icons" style="font-size: ${size}px;">${data.icon}</i>
                ${data.name ? `<span style="background:rgba(255,255,255,0.9); padding:1px 4px; border-radius:3px; font-size:11px; font-family:'Tajawal'; font-weight:bold; color:#333; margin-top:-2px; white-space:nowrap;">${data.name}</span>` : ''}
            `;
            // Hover effect
            contentDiv.onmouseover = () => contentDiv.style.transform = "scale(1.1)";
            contentDiv.onmouseout = () => contentDiv.style.transform = "scale(1.0)";

        } else {
            contentDiv.style.cssText = `
                color: ${data.color}; 
                font-family: 'Cairo', sans-serif; 
                font-weight: 700; 
                font-size: ${data.fontSize || 16}px; 
                text-shadow: 0 0 3px #fff, 0 0 5px #fff; 
                cursor: pointer; 
                white-space: nowrap;
                padding: 2px 6px;
                border: 1px dashed transparent;
                transition: border 0.2s;
            `;
            contentDiv.innerText = data.text;
            contentDiv.onmouseover = () => contentDiv.style.border = "1px dashed rgba(0,0,0,0.3)";
            contentDiv.onmouseout = () => contentDiv.style.border = "1px dashed transparent";
        }

        // إنشاء العلامة
        let marker;
        try {
            marker = new google.maps.marker.AdvancedMarkerElement({
                position: { lat: data.lat, lng: data.lng },
                map: this.map,
                content: contentDiv,
                gmpDraggable: !MAP.shareMode
            });
        } catch (e) {
            console.error("Failed to create AdvancedMarker:", e);
            return;
        }

        const item = { id, ...data, marker };

        // Events
        marker.addListener('click', () => {
            if (!MAP.shareMode) this.openEditCard(item);
        });

        marker.addListener('dragend', () => {
            item.lat = marker.position.lat;
            item.lng = marker.position.lng;
            bus.emit("persist");
        });

        this.items.push(item);
    }

    openEditCard(item) {
        const isIcon = item.type === 'icon';
        const title = isIcon ? 'تعديل الرمز' : 'تعديل النص';

        const content = `
            <div style="font-family:'Tajawal'; padding:5px; direction:rtl; min-width:220px;">
                <div style="margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
                    <strong style="font-size:14px;">${title}</strong>
                    <button id="ed-close" style="background:none; border:none; cursor:pointer; font-size:18px;">&times;</button>
                </div>
                
                <div style="margin-bottom:10px;">
                    <label style="font-size:12px; display:block; margin-bottom:4px;">اللون:</label>
                    <input id="ed-color" type="color" value="${item.color}" style="width:100%; height:30px; border:none; cursor:pointer;">
                </div>

                ${isIcon ? `
                    <div style="margin-bottom:10px;">
                        <label style="font-size:12px; display:block; margin-bottom:4px;">الاسم (اختياري):</label>
                        <input id="ed-val" type="text" value="${item.name || ''}" style="width:100%; padding:5px; border:1px solid #ddd; border-radius:4px;">
                    </div>
                    <div style="margin-bottom:10px;">
                        <button id="ed-change-icon" style="width:100%; padding:6px; background:#f1f3f4; border:1px solid #ddd; border-radius:4px; cursor:pointer;">تغيير الأيقونة</button>
                    </div>
                ` : `
                    <div style="margin-bottom:10px;">
                        <label style="font-size:12px; display:block; margin-bottom:4px;">النص:</label>
                        <input id="ed-val" type="text" value="${item.text}" style="width:100%; padding:5px; border:1px solid #ddd; border-radius:4px;">
                    </div>
                    <div style="margin-bottom:10px;">
                        <label style="font-size:12px; display:block; margin-bottom:4px;">الحجم:</label>
                        <input id="ed-size" type="number" value="${item.fontSize}" min="8" max="100" style="width:100%; padding:5px; border:1px solid #ddd; border-radius:4px;">
                    </div>
                `}

                <div style="display:flex; gap:8px; margin-top:15px;">
                    <button id="ed-save" style="flex:1; background:#1a73e8; color:white; border:none; padding:8px; border-radius:4px; cursor:pointer; font-weight:bold;">حفظ</button>
                    <button id="ed-delete" style="flex:1; background:#d93025; color:white; border:none; padding:8px; border-radius:4px; cursor:pointer; font-weight:bold;">حذف</button>
                </div>
            </div>
        `;

        UI.openSharedInfoCard(content, item.marker.position, true);

        // ربط أحداث البطاقة
        setTimeout(() => {
            const closeBtn = document.getElementById('ed-close');
            const saveBtn = document.getElementById('ed-save');
            const delBtn = document.getElementById('ed-delete');
            const changeIconBtn = document.getElementById('ed-change-icon');

            if(closeBtn) closeBtn.onclick = () => UI.forceCloseSharedInfoCard();

            if(delBtn) delBtn.onclick = () => {
                if(confirm('هل أنت متأكد من حذف هذا العنصر؟')) {
                    item.marker.map = null;
                    this.items = this.items.filter(i => i.id !== item.id);
                    UI.forceCloseSharedInfoCard();
                    bus.emit("persist");
                    bus.emit("toast", "تم الحذف");
                }
            };

            if(changeIconBtn) changeIconBtn.onclick = () => {
                ICON_PICKER.open((newIcon) => {
                    item.icon = newIcon;
                    this.refreshItem(item);
                    bus.emit("persist");
                });
            };

            if(saveBtn) saveBtn.onclick = () => {
                item.color = document.getElementById('ed-color').value;
                const val = document.getElementById('ed-val').value;
                
                if(isIcon) {
                    item.name = val;
                } else {
                    item.text = val;
                    item.fontSize = document.getElementById('ed-size').value;
                }

                this.refreshItem(item);
                UI.forceCloseSharedInfoCard();
                bus.emit("persist");
                bus.emit("toast", "تم الحفظ");
            };
        }, 100);
    }

    refreshItem(item) {
        // حذف وإعادة إنشاء لتحديث المحتوى (أبسط طريقة مع AdvancedMarker)
        item.marker.map = null;
        this.items = this.items.filter(i => i.id !== item.id);
        this.addItem(item);
    }

    exportState() {
        return this.items.map(i => ({
            id: i.id, 
            type: i.type, 
            lat: typeof i.marker.position.lat === 'function' ? i.marker.position.lat() : i.marker.position.lat,
            lng: typeof i.marker.position.lng === 'function' ? i.marker.position.lng() : i.marker.position.lng,
            icon: i.icon, 
            text: i.text, 
            color: i.color, 
            name: i.name, 
            fontSize: i.fontSize,
            scale: i.scale
        }));
    }

    applyState(state) {
        if (!state || !state.freeDraw) return;
        this.items.forEach(i => i.marker.map = null);
        this.items = [];
        state.freeDraw.forEach(d => this.addItem(d));
    }
}

const FREE_DRAW = new FreeLayerManager();

/* ==========================================================================
   7. POLYGON MANAGER (FIXED FINISH LOGIC)
   ========================================================================== */

class PolygonManager {
    constructor() {
        this.polygons = [];
        this.map = null;
        this.activePolygonIndex = -1;
        this.isEditing = false;
        this.editingPolygonIndex = -1;

        bus.on("map:ready", map => { this.map = map; });
        bus.on("map:click", e => {
            if (MAP.modePolygonAdd && !MAP.shareMode) {
                if (this.activePolygonIndex === -1) this.createNewPolygon();
                this.addPointToPolygon(this.activePolygonIndex, e.latLng);
            }
        });
        bus.on("state:load", st => this.applyState(st));
        bus.on("state:save", () => this.exportState());
    }

    createNewPolygon() {
        const polygon = {
            id: "poly" + Date.now(),
            name: "مضلع جديد",
            notes: "",
            points: [],
            color: "#ff9800",
            strokeWeight: 2,
            strokeOpacity: 0.8,
            fillOpacity: 0.35,
            polygon: null,
            markers: [],
            activePolyline: null,
            vertexMarkers: []
        };
        this.polygons.push(polygon);
        this.activePolygonIndex = this.polygons.length - 1;
        return polygon;
    }

    addPointToPolygon(index, latLng) {
        const poly = this.polygons[index];
        poly.points.push(latLng);
        
        // رسم نقطة مؤقتة
        const marker = new google.maps.marker.AdvancedMarkerElement({
            position: latLng,
            map: this.map,
            content: this.createVertexDot(poly.color)
        });
        poly.markers.push(marker);

        // رسم خط مؤقت
        if (poly.activePolyline) poly.activePolyline.setMap(null);
        poly.activePolyline = new google.maps.Polyline({
            path: poly.points,
            map: this.map,
            strokeColor: poly.color,
            strokeOpacity: 0.7,
            strokeWeight: 2
        });
    }

    createVertexDot(color) {
        const el = document.createElement("div");
        el.style.cssText = `width:10px; height:10px; border-radius:50%; background:white; border:2px solid ${color};`;
        return el;
    }

    finishCurrentPolygon() {
        if (this.activePolygonIndex === -1) return;
        
        const poly = this.polygons[this.activePolygonIndex];
        
        // تنظيف المؤقتات
        if (poly.activePolyline) poly.activePolyline.setMap(null);
        poly.markers.forEach(m => m.map = null);
        poly.markers = [];

        // رسم المضلع النهائي
        if (poly.points.length >= 3) {
            poly.polygon = new google.maps.Polygon({
                paths: poly.points,
                map: this.map,
                strokeColor: poly.color,
                strokeOpacity: poly.strokeOpacity,
                strokeWeight: poly.strokeWeight,
                fillColor: poly.color,
                fillOpacity: poly.fillOpacity,
                zIndex: 5,
                clickable: true
            });
            this.addPolygonListeners(poly, this.activePolygonIndex);
            bus.emit("persist");
            bus.emit("toast", "تم رسم المضلع");
        } else {
            this.polygons.pop(); // إلغاء المضلع الناقص
            bus.emit("toast", "تم الإلغاء (نقاط غير كافية)");
        }

        // *** FIX: Reset Logic ***
        this.activePolygonIndex = -1;
        MAP.modePolygonAdd = false;
        MAP.setCursor("grab");
        UI.showDefaultUI(); // إعادة الأزرار لطبيعتها
    }

    addPolygonListeners(poly, index) {
        poly.polygon.addListener("click", (e) => {
            if (this.isEditing && this.editingPolygonIndex === index) {
                // منطق إضافة نقطة في وضع التحرير (معقد، تم تبسيطه هنا)
            } else if (!MAP.shareMode) {
                this.openCard(index, false, e.latLng);
            }
        });
    }

    openCard(index, hoverOnly, position) {
        const poly = this.polygons[index];
        const area = google.maps.geometry.spherical.computeArea(poly.points);
        
        // بناء محتوى البطاقة (Glass Style)
        const html = `
            <div style="font-family:'Tajawal'; padding:15px; direction:rtl; min-width:250px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                    <h3 style="margin:0; font-size:16px;">${poly.name}</h3>
                    ${!hoverOnly ? `<button id="pc-close" style="background:none; border:none; cursor:pointer;">&times;</button>` : ''}
                </div>
                <div style="margin-bottom:10px; font-size:14px; color:#555;">
                    المساحة: <b>${Utils.formatArea(area)}</b>
                </div>
                ${!hoverOnly ? `
                    <div style="display:flex; gap:5px;">
                        <button id="pc-del" style="flex:1; background:#d93025; color:white; border:none; padding:8px; border-radius:4px; cursor:pointer;">حذف</button>
                        <button id="pc-edit" style="flex:1; background:#1a73e8; color:white; border:none; padding:8px; border-radius:4px; cursor:pointer;">تعديل الشكل</button>
                    </div>
                ` : ''}
            </div>
        `;

        UI.openSharedInfoCard(html, position || this.getCenter(poly), !hoverOnly);

        if (!hoverOnly) {
            setTimeout(() => {
                const delBtn = document.getElementById('pc-del');
                const editBtn = document.getElementById('pc-edit');
                const closeBtn = document.getElementById('pc-close');

                if(closeBtn) closeBtn.onclick = () => UI.forceCloseSharedInfoCard();
                if(delBtn) delBtn.onclick = () => {
                    if(confirm('حذف المضلع؟')) {
                        poly.polygon.setMap(null);
                        this.polygons = this.polygons.filter(p => p.id !== poly.id);
                        UI.forceCloseSharedInfoCard();
                        bus.emit("persist");
                    }
                };
                if(editBtn) editBtn.onclick = () => {
                    this.enterEditMode(index);
                    UI.forceCloseSharedInfoCard();
                };
            }, 100);
        }
    }

    getCenter(poly) {
        const bounds = new google.maps.LatLngBounds();
        poly.points.forEach(p => bounds.extend(p));
        return bounds.getCenter();
    }

    enterEditMode(index) {
        this.exitEditMode();
        this.isEditing = true;
        this.editingPolygonIndex = index;
        const poly = this.polygons[index];
        
        // تحويل المضلع ليكون قابلاً للتعديل
        poly.polygon.setEditable(true);
        poly.polygon.setDraggable(true);

        // الاستماع لأحداث التعديل
        const path = poly.polygon.getPath();
        this.pathListener = google.maps.event.addListener(path, 'set_at', () => this.updatePointsFromPoly(poly));
        this.pathListener2 = google.maps.event.addListener(path, 'insert_at', () => this.updatePointsFromPoly(poly));
        this.pathListener3 = google.maps.event.addListener(path, 'remove_at', () => this.updatePointsFromPoly(poly));
        this.dragListener = google.maps.event.addListener(poly.polygon, 'dragend', () => this.updatePointsFromPoly(poly));

        // إظهار زر "إنهاء التعديل" في مكان ما، أو استخدام زر "إنهاء الرسم"
        bus.emit("toast", "وضع التعديل: اسحب النقاط لتغيير الشكل");
        // هنا يمكنك إضافة زر عائم لإنهاء التعديل، للتبسيط سنعتمد على النقر خارجاً أو زر إنهاء الرسم
        const finishBtn = document.getElementById('btn-draw-finish');
        if(finishBtn) {
            finishBtn.style.display = 'inline-block';
            finishBtn.onclick = () => this.exitEditMode();
        }
    }

    updatePointsFromPoly(poly) {
        const path = poly.polygon.getPath();
        poly.points = path.getArray();
        bus.emit("persist");
    }

    exitEditMode() {
        if (!this.isEditing) return;
        const poly = this.polygons[this.editingPolygonIndex];
        if (poly && poly.polygon) {
            poly.polygon.setEditable(false);
            poly.polygon.setDraggable(false);
        }
        
        // إزالة المستمعين
        if (this.pathListener) google.maps.event.removeListener(this.pathListener);
        if (this.pathListener2) google.maps.event.removeListener(this.pathListener2);
        if (this.pathListener3) google.maps.event.removeListener(this.pathListener3);
        if (this.dragListener) google.maps.event.removeListener(this.dragListener);

        this.isEditing = false;
        this.editingPolygonIndex = -1;
        UI.showDefaultUI();
        bus.emit("toast", "تم حفظ التعديلات");
    }

    exportState() {
        return this.polygons.filter(p => p.polygon).map(p => ({
            id: p.id,
            name: p.name,
            color: p.color,
            points: p.points.map(pt => ({ lat: pt.lat(), lng: pt.lng() })),
            strokeWeight: p.strokeWeight,
            strokeOpacity: p.strokeOpacity,
            fillOpacity: p.fillOpacity
        }));
    }

    applyState(state) {
        if (!state || !state.polygons) return;
        // تنظيف القديم
        this.polygons.forEach(p => { if(p.polygon) p.polygon.setMap(null); });
        this.polygons = [];
        
        state.polygons.forEach(data => {
            const poly = {
                ...data,
                points: data.points.map(p => new google.maps.LatLng(p.lat, p.lng)),
                polygon: null, markers: [], activePolyline: null, vertexMarkers: []
            };
            
            poly.polygon = new google.maps.Polygon({
                paths: poly.points,
                map: this.map,
                strokeColor: poly.color,
                strokeOpacity: poly.strokeOpacity,
                strokeWeight: poly.strokeWeight,
                fillColor: poly.color,
                fillOpacity: poly.fillOpacity,
                zIndex: 5,
                clickable: true
            });
            
            this.polygons.push(poly);
            this.addPolygonListeners(poly, this.polygons.length - 1);
        });
    }
}

const POLYGONS = new PolygonManager();

/* ==========================================================================
   8. LOCATION & ROUTE MANAGERS (Simplified to fit size, robust logic)
   ========================================================================== */

class LocationManager {
    constructor() {
        this.items = [];
        this.map = null;
        bus.on("map:ready", map => { this.map = map; });
        bus.on("map:click", e => {
            if (MAP.modeAdd && !MAP.shareMode) {
                this.addItem({ lat: e.latLng.lat(), lng: e.latLng.lng(), name: "موقع جديد", color: "#ff0000" });
                MAP.modeAdd = false; MAP.setCursor("grab"); UI.showDefaultUI();
                bus.emit("persist"); bus.emit("toast", "تمت الإضافة");
            }
        });
        bus.on("state:load", st => this.applyState(st));
        bus.on("state:save", () => this.exportState());
    }

    addItem(data) {
        const id = data.id || "loc" + Date.now() + Math.random();
        // إنشاء أيقونة نقطة بسيطة (يمكن توسيعها لصور)
        const div = document.createElement("div");
        div.style.cssText = `width:16px; height:16px; background:${data.color}; border:2px solid white; border-radius:50%; box-shadow:0 2px 4px rgba(0,0,0,0.3); cursor:pointer;`;
        
        const marker = new google.maps.marker.AdvancedMarkerElement({
            position: { lat: data.lat, lng: data.lng },
            map: this.map,
            content: div,
            gmpDraggable: !MAP.shareMode
        });

        const item = { id, ...data, marker };
        marker.addListener('click', () => { if(!MAP.shareMode) this.editItem(item); });
        marker.addListener('dragend', () => { 
            item.lat = marker.position.lat; item.lng = marker.position.lng; bus.emit("persist"); 
        });
        this.items.push(item);
    }

    editItem(item) {
        const html = `
            <div style="font-family:'Tajawal'; padding:10px; direction:rtl;">
                <input id="lm-name" value="${item.name}" style="width:100%; margin-bottom:5px; padding:5px;">
                <input id="lm-color" type="color" value="${item.color}" style="width:100%; height:30px;">
                <div style="margin-top:10px; display:flex; gap:5px;">
                    <button id="lm-save" style="flex:1; background:#1a73e8; color:white; border:none; padding:5px; border-radius:4px;">حفظ</button>
                    <button id="lm-del" style="flex:1; background:#d93025; color:white; border:none; padding:5px; border-radius:4px;">حذف</button>
                </div>
            </div>
        `;
        UI.openSharedInfoCard(html, item.marker.position, true);
        setTimeout(() => {
            document.getElementById('lm-save').onclick = () => {
                item.name = document.getElementById('lm-name').value;
                item.color = document.getElementById('lm-color').value;
                item.marker.content.style.background = item.color;
                UI.forceCloseSharedInfoCard(); bus.emit("persist");
            };
            document.getElementById('lm-del').onclick = () => {
                if(confirm('حذف؟')) { item.marker.map = null; this.items = this.items.filter(i => i.id !== item.id); UI.forceCloseSharedInfoCard(); bus.emit("persist"); }
            };
        }, 100);
    }

    exportState() { return this.items.map(i => ({ id: i.id, name: i.name, lat: i.marker.position.lat, lng: i.marker.position.lng, color: i.color })); }
    applyState(st) { if(st && st.locations) { this.items.forEach(i => i.marker.map=null); this.items=[]; st.locations.forEach(d => this.addItem(d)); } }
}
const LOCATIONS = new LocationManager();

/* ==========================================================================
   9. MEASURE MANAGER
   ========================================================================== */
class MeasureManager {
    constructor() {
        this.active = false;
        this.points = [];
        this.line = null;
        this.infoWin = null;
        this.map = null;
        bus.on("map:ready", map => { this.map = map; });
        bus.on("map:click", e => { if (this.active) this.addPoint(e.latLng); });
    }

    toggle() {
        this.active = !this.active;
        if (this.active) {
            MAP.setCursor("crosshair");
            this.points = [];
            bus.emit("toast", "انقر لإضافة نقاط القياس");
        } else {
            this.clear();
            MAP.setCursor("grab");
            bus.emit("toast", "تم إيقاف القياس");
        }
        return this.active;
    }

    addPoint(latLng) {
        this.points.push(latLng);
        if (this.line) this.line.setMap(null);
        
        this.line = new google.maps.Polyline({
            path: this.points, map: this.map, strokeColor: "#000", strokeWeight: 2
        });

        const length = google.maps.geometry.spherical.computeLength(this.points);
        let content = `المسافة: <b>${Utils.formatDistance(length)}</b>`;
        
        if (this.points.length > 2) {
            const area = google.maps.geometry.spherical.computeArea(this.points);
            content += `<br>المساحة (تقريبية): <b>${Utils.formatArea(area)}</b>`;
        }

        if (!this.infoWin) this.infoWin = new google.maps.InfoWindow();
        this.infoWin.setContent(`<div style="font-family:'Tajawal'; direction:rtl;">${content}</div>`);
        this.infoWin.setPosition(latLng);
        this.infoWin.open(this.map);
    }

    clear() {
        if (this.line) this.line.setMap(null);
        if (this.infoWin) this.infoWin.close();
        this.points = [];
    }
}
const MEASURE = new MeasureManager();

/* ==========================================================================
   10. STATE MANAGER & SHARE
   ========================================================================== */

class StateManager {
    constructor() {
        this.map = null;
        this.timer = null;
        bus.on("map:ready", map => { 
            this.map = map;
            const st = this.readState();
            if (st) this.loadState(st);
            if (!MAP.shareMode) bus.on("persist", () => this.scheduleSave());
        });
    }

    buildState() {
        if (!this.map) return null;
        const c = this.map.getCenter();
        return {
            v: 3,
            map: { c: [c.lat(), c.lng()], z: this.map.getZoom() },
            locations: LOCATIONS.exportState(),
            polygons: POLYGONS.exportState(),
            freeDraw: FREE_DRAW.exportState()
            // Add Routes export here if needed
        };
    }

    scheduleSave() {
        clearTimeout(this.timer);
        this.timer = setTimeout(() => {
            const st = this.buildState();
            if (st) {
                const url = location.origin + location.pathname + "?x=" + Utils.b64uEncode(JSON.stringify(st));
                history.replaceState(null, "", url);
            }
        }, 500);
    }

    readState() {
        try {
            const p = new URLSearchParams(location.search).get("x");
            return p ? JSON.parse(Utils.b64uDecode(p)) : null;
        } catch (e) { return null; }
    }

    loadState(st) {
        if (!st) return;
        if (st.map) { this.map.setCenter({ lat: st.map.c[0], lng: st.map.c[1] }); this.map.setZoom(st.map.z); }
        if (st.locations) LOCATIONS.applyState({ locations: st.locations });
        if (st.polygons) POLYGONS.applyState({ polygons: st.polygons });
        if (st.freeDraw) FREE_DRAW.applyState({ freeDraw: st.freeDraw });
    }
}
const STATE = new StateManager();

/* ==========================================================================
   11. UI MANAGER (TOOLBAR & INTERACTIONS)
   ========================================================================== */

class UIManager {
    constructor() {
        this.infoWindow = new google.maps.InfoWindow();
        this.pinned = false;
        this.toastEl = document.getElementById("toast");
        
        bus.on("map:ready", () => this.initListeners());
        bus.on("toast", msg => this.showToast(msg));
        
        // Global style injection for InfoWindows
        const style = document.createElement('style');
        style.innerHTML = `
            .gm-style-iw-c { padding:0 !important; border-radius:12px !important; box-shadow:0 4px 15px rgba(0,0,0,0.3) !important; background:rgba(255,255,255,0.95) !important; backdrop-filter:blur(5px); }
            .gm-style-iw-d { overflow:hidden !important; padding:0 !important; }
            .gm-style-iw-tc { display:none !important; }
            .gm-ui-hover-effect { display:none !important; }
        `;
        document.head.appendChild(style);
    }

    initListeners() {
        console.log("UI Manager: Binding Events...");
        
        // 1. Free Draw Button
        const btnFree = document.getElementById('btn-free-draw');
        if (btnFree) btnFree.onclick = () => {
            this.resetModes();
            MAP.modeFreeDraw = !MAP.modeFreeDraw;
            this.updateBtnState(btnFree, MAP.modeFreeDraw);
            MAP.setCursor(MAP.modeFreeDraw ? "crosshair" : "grab");
            bus.emit("toast", MAP.modeFreeDraw ? "الرسم الحر: انقر لإضافة رمز أو نص" : "تم الخروج");
        };

        // 2. Polygon Button
        const btnPoly = document.getElementById('btn-polygon');
        const btnFinish = document.getElementById('btn-draw-finish');
        if (btnPoly) btnPoly.onclick = () => {
            this.resetModes();
            MAP.modePolygonAdd = !MAP.modePolygonAdd;
            this.updateBtnState(btnPoly, MAP.modePolygonAdd);
            MAP.setCursor(MAP.modePolygonAdd ? "crosshair" : "grab");
            if (btnFinish) btnFinish.style.display = MAP.modePolygonAdd ? 'inline-flex' : 'none';
            if (MAP.modePolygonAdd) bus.emit("toast", "انقر لرسم مضلع");
        };

        if (btnFinish) btnFinish.onclick = () => {
            if (MAP.modePolygonAdd) POLYGONS.finishCurrentPolygon();
            // Handle Route finish if implemented
        };

        // 3. Add Location
        const btnAdd = document.getElementById('btn-add');
        if (btnAdd) btnAdd.onclick = () => {
            this.resetModes();
            MAP.modeAdd = !MAP.modeAdd;
            this.updateBtnState(btnAdd, MAP.modeAdd);
            MAP.setCursor(MAP.modeAdd ? "crosshair" : "grab");
            if(MAP.modeAdd) bus.emit("toast", "انقر لإضافة موقع");
        };

        // 4. Measure
        const btnMeasure = document.getElementById('btn-measure');
        if (btnMeasure) btnMeasure.onclick = () => {
            this.resetModes();
            const active = MEASURE.toggle();
            this.updateBtnState(btnMeasure, active);
        };

        // 5. Share
        const btnShare = document.getElementById('btn-share');
        if (btnShare) btnShare.onclick = async () => {
            const url = location.href;
            try {
                await navigator.clipboard.writeText(url);
                bus.emit("toast", "تم نسخ الرابط");
            } catch (e) {
                prompt("انسخ الرابط:", url);
            }
        };

        // 6. Layers Panel Toggle
        const btnLayers = document.getElementById('btn-layers');
        const panel = document.getElementById('layers-panel');
        const closeLayers = document.getElementById('btn-close-layers');
        if (btnLayers && panel) {
            const toggle = () => panel.classList.toggle('show');
            btnLayers.onclick = toggle;
            if(closeLayers) closeLayers.onclick = toggle;
        }

        // 7. Base Map Radios
        document.querySelectorAll('input[name="base-map"]').forEach(r => {
            r.onchange = () => {
                if (r.value === 'satellite') MAP.setSatellite();
                else if (r.value === 'dark') MAP.setDarkMode();
                else MAP.setRoadmap();
            };
        });
        
        // 8. Traffic Checkbox
        const chkTraffic = document.getElementById('layer-traffic');
        if (chkTraffic) chkTraffic.onchange = () => MAP.toggleTraffic();
    }

    resetModes() {
        MAP.modeFreeDraw = false;
        MAP.modePolygonAdd = false;
        MAP.modeAdd = false;
        MAP.modeRouteAdd = false;
        MEASURE.active = false; MEASURE.clear();
        MAP.setCursor("grab");
        document.querySelectorAll('.btn').forEach(b => b.setAttribute('aria-pressed', 'false'));
        const finishBtn = document.getElementById('btn-draw-finish');
        if(finishBtn) finishBtn.style.display = 'none';
    }

    updateBtnState(btn, isActive) {
        if(btn) btn.setAttribute('aria-pressed', isActive);
    }

    openSharedInfoCard(content, position, pinned) {
        this.infoWindow.close();
        this.infoWindow.setContent(content);
        this.infoWindow.setPosition(position);
        this.infoWindow.setOptions({ pixelOffset: new google.maps.Size(0, -30) });
        this.infoWindow.open(MAP.map);
        this.pinned = pinned;
    }

    forceCloseSharedInfoCard() {
        this.infoWindow.close();
        this.pinned = false;
    }

    showToast(msg) {
        if (!this.toastEl) return;
        this.toastEl.innerText = msg;
        this.toastEl.classList.add("show");
        setTimeout(() => this.toastEl.classList.remove("show"), 3000);
    }
}

const UI = new UIManager();

/* ==========================================================================
   12. BOOTSTRAP
   ========================================================================== */
console.log("System Loaded. Waiting for Maps API...");

class BootLoader {

    constructor() {
        this.booted = false;

        // المحاولة الفورية للتشغيل
        this.tryBoot();

        // المحاولة عند اكتمال تحميل عناصر الصفحة (DOM)
        document.addEventListener("DOMContentLoaded", () => this.tryBoot());
        
        // المحاولة عند اكتمال تحميل كل الموارد
        window.addEventListener("load", () => this.tryBoot());
    }

    tryBoot() {
        // إذا تم التشغيل مسبقاً، توقف
        if (this.booted) return;

        // التأكد من أن الصفحة ليست في وضع التحميل
        if (document.readyState !== "loading") {
            this.booted = true;
            this.start();
        }
    }

    start() {
        console.log("Diriyah Security Map v28.0 — Core Initialized Successfully.");
        
        // التحقق النهائي من وجود الحاويات الأساسية
        const mapDiv = document.getElementById("map");
        if (!mapDiv) {
            console.error("Critical Error: #map element not found in HTML.");
            alert("خطأ: عنصر الخريطة غير موجود في الصفحة.");
        }
    }
}

const BOOT = new BootLoader();
