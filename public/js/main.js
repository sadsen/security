'use strict';

/*
============================================================
   Diriyah Security Map – v25.8 (Fixed Route Deletion & Share Mode)
   • إصلاح مشكلة حذف المسار
   • إصلاح عرض دوائر الأرقام في وضع المشاركة
   • تحسين واجهة المشاركة
   • الحفاظ على جميع الميزات السابقة
   ============================================================ */

/*
------------------------------------------------------------
   Event Bus
— نظام أحداث
------------------------------------------------------------
*/
window.initMap = function () {
    if (window.MapController && typeof window.MapController.init === 'function') {
        window.MapController.init();
    } else {
        console.error("MapController لم يتم تحميله.");
    }
};

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
            this.events[event].forEach(h => h(data));
        }
    }
}

const bus = new EventBus();

/*
------------------------------------------------------------
   Utilities
— أدوات عامة (مع دعم للجوال)
------------------------------------------------------------
*/
const Utils = {

    clamp(v, min, max) {
        return Math.min(max, Math.max(min, v));
    },

    escapeHTML(str) {
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    },

    /* * Base64 URL-Safe encoding with compression
     */
    b64uEncode(str) {
        try {
            const textEncoder = new TextEncoder();
            const bytes = textEncoder.encode(str);
            const compressed = pako.deflate(bytes);
            let bin = "";
            compressed.forEach(b => bin += String.fromCharCode(b));
            const base64 = btoa(bin);
            return base64
                .replace(/\+/g, "-")
                .replace(/\//g, "_")
                .replace(/=+$/, "");
        } catch (e) {
            console.error("Compression/Encoding error", e);
            return "";
        }
    },

    /* * Base64 URL-safe decode with decompression
     */
    b64uDecode(str) {
        try {
            if (!str) return null;
            str = str.replace(/[^A-Za-z0-9\-_]/g, "");
            const pad = (4 - (str.length % 4)) % 4;
            str += "=".repeat(pad);
            const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
            const decoded = atob(base64);
            const compressedBytes = Uint8Array.from(decoded, c => c.charCodeAt(0));
            const decompressedBytes = pako.inflate(compressedBytes);
            const textDecoder = new TextDecoder();
            return textDecoder.decode(decompressedBytes);
        } catch (e) {
            console.error("Decompression/Decoding error", e);
            return null;
        }
    },

    formatDistance(m) {
        if (!m) return "0 م";
        if (m < 1000) return m.toFixed(0) + " م";
        return (m / 1000).toFixed(2) + " كم";
    },

    formatDuration(sec) {
        if (!sec) return "0 دقيقة";
        const m = Math.round(sec / 60);
        if (m < 60) return m + " دقيقة";
        const h = Math.floor(m / 60);
        const r = m % 60;
        return `${h} ساعة ${r} دقيقة`;
    },

    formatArea(meters) {
        if (!meters) return "0 م²";
        if (meters >= 1000000) {
            return (meters / 1000000).toFixed(2) + " كم²";
        }
        return Math.round(meters).toLocaleString('ar-SA') + " م²";
    },

    // دالة للتحقق مما إذا كان الرابط طويلاً جداً
    isLongUrl(url) {
        return url.length > 2000;
    },

    // دالة لإنشاء معرف فريد للرابط المختصر
    generateShortId() {
        return Math.random().toString(36).substring(2, 8) + Date.now().toString(36);
    },

    // دالة للتحقق من دعم المتصفح لواجهة النسخ الحديثة
    supportsModernClipboard() {
        return navigator.clipboard && navigator.clipboard.writeText;
    },

    // دالة للنسخ القديم (للمتصفحات القديمة)
    fallbackCopyToClipboard(text) {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
            const successful = document.execCommand('copy');
            document.body.removeChild(textArea);
            return successful;
        } catch (err) {
            document.body.removeChild(textArea);
            return false;
        }
    },
    
    // الاحتفاظ بالمسودة في التبويب الحالي عند إعادة التحميل فقط.
    // بعض المتصفحات تنسخ sessionStorage عند فتح تبويب من تبويب آخر؛
    // لذلك نمسح المسودة عند أي دخول جديد لا يُعد إعادة تحميل.
    prepareTabSession() {
        try {
            const nav = performance.getEntriesByType('navigation')[0];
            const isReload = nav ? nav.type === 'reload' :
                (performance.navigation && performance.navigation.type === 1);
            if (!isReload) {
                sessionStorage.removeItem('securitymap:draft:' + location.pathname);
                sessionStorage.removeItem('mapEditMode');
            }
        } catch (e) {
            console.warn('Unable to prepare tab session', e);
        }
    },

    // حفظ واسترجاع حالة التحرير
    saveEditMode(isEditMode) {
        try {
            sessionStorage.setItem('mapEditMode', isEditMode ? 'edit' : 'view');
        } catch (e) {
            console.error("Failed to save edit mode:", e);
        }
    },
    
    getEditMode() {
        try {
            return sessionStorage.getItem('mapEditMode') === 'edit';
        } catch (e) {
            console.error("Failed to get edit mode:", e);
            return true; // الافتراضي هو وضع التحرير
        }
    }
};

/*
============================================================
   MapController
— وحدة إدارة الخريطة (مع دعم الطبقات المتقدمة)
============================================================
*/
const EXTRA_BASE_MAPS = [
    { id: "minimal-ivory", name: "عاجي بلا تسميات", styles: [
        { elementType: "geometry", stylers: [{ color: "#faf6ed" }] },
        { elementType: "labels", stylers: [{ visibility: "off" }] },
        { featureType: "poi", stylers: [{ visibility: "off" }] },
        { featureType: "road", elementType: "geometry", stylers: [{ color: "#e6e0d5" }] },
        { featureType: "water", elementType: "geometry", stylers: [{ color: "#d5e4df" }] }
    ] },
    { id: "main-roads", name: "الطرق الرئيسية", styles: [
        { elementType: "geometry", stylers: [{ color: "#eef2f6" }] },
        { featureType: "poi", stylers: [{ visibility: "off" }] },
        { featureType: "road.local", stylers: [{ visibility: "off" }] },
        { featureType: "road.arterial", elementType: "geometry.fill", stylers: [{ color: "#9cb9d2" }] },
        { featureType: "road.highway", elementType: "geometry.fill", stylers: [{ color: "#6797be" }] },
        { featureType: "water", elementType: "geometry.fill", stylers: [{ color: "#ccdce8" }] }
    ] },
    { id: "detailed-landmarks", name: "المعالم والخدمات", styles: [
        { elementType: "geometry", stylers: [{ color: "#f7f3e9" }] },
        { featureType: "road", elementType: "geometry.fill", stylers: [{ color: "#ffffff" }] },
        { featureType: "poi", elementType: "labels", stylers: [{ visibility: "on" }] },
        { featureType: "poi.park", elementType: "geometry.fill", stylers: [{ color: "#b7dca8" }] },
        { featureType: "poi.attraction", elementType: "labels.text.fill", stylers: [{ color: "#754492" }] },
        { featureType: "water", elementType: "geometry.fill", stylers: [{ color: "#acd9e6" }] }
    ] },
    { id: "desert-sand", name: "رملي دافئ", styles: [
        { elementType: "geometry", stylers: [{ color: "#efdfc0" }] },
        { elementType: "labels.text.fill", stylers: [{ color: "#65482e" }] },
        { elementType: "labels.text.stroke", stylers: [{ color: "#fff5df" }] },
        { featureType: "poi.business", stylers: [{ visibility: "off" }] },
        { featureType: "road", elementType: "geometry", stylers: [{ color: "#fff7e7" }] },
        { featureType: "water", elementType: "geometry", stylers: [{ color: "#b9c4a1" }] }
    ] },
    // كرتوني ملون: تخصيص مرئي ثنائي الأبعاد. المباني ثلاثية الأبعاد الفعلية
    // تتطلب إعداد نمط Vector/3D منفصلًا عبر Google Cloud ولا تنتج من StyledMapType.
    // تُضاف هذه الطبقة تلقائيًا إلى القائمة عبر EXTRA_BASE_MAPS دون تغيير منطق بقية الأدوات.
    { id: "cartoon-color", name: "كرتوني ملون", styles: [
        { elementType: "geometry", stylers: [{ color: "#fff0d9" }] },
        { elementType: "labels.text.fill", stylers: [{ color: "#59466b" }] },
        { elementType: "labels.text.stroke", stylers: [{ color: "#fffdf3" }] },
        { elementType: "labels.icon", stylers: [{ saturation: -15 }] },
        { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#d6bbd5" }, { weight: 0.8 }] },
        { featureType: "administrative.land_parcel", stylers: [{ visibility: "off" }] },
        { featureType: "landscape.natural", elementType: "geometry", stylers: [{ color: "#f6e9ba" }] },
        { featureType: "landscape.man_made", elementType: "geometry", stylers: [{ color: "#f3d8cf" }] },
        { featureType: "poi", elementType: "geometry", stylers: [{ color: "#ffe6bd" }] },
        { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#a7dba1" }] },
        { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#377b51" }] },
        { featureType: "poi.business", stylers: [{ visibility: "off" }] },
        { featureType: "poi.school", elementType: "geometry", stylers: [{ color: "#ffe0a0" }] },
        { featureType: "poi.medical", elementType: "geometry", stylers: [{ color: "#f7c6cd" }] },
        { featureType: "road", elementType: "geometry.fill", stylers: [{ color: "#fffef7" }] },
        { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#d6b8a9" }, { weight: 1.2 }] },
        { featureType: "road.highway", elementType: "geometry.fill", stylers: [{ color: "#ffc985" }] },
        { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#d98f5b" }, { weight: 1.4 }] },
        { featureType: "road.arterial", elementType: "geometry.fill", stylers: [{ color: "#ffe6b8" }] },
        { featureType: "road.arterial", elementType: "geometry.stroke", stylers: [{ color: "#d8ae90" }, { weight: 1 }] },
        { featureType: "road.local", elementType: "geometry.fill", stylers: [{ color: "#fffef7" }] },
        { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#6f5a58" }] },
        { featureType: "road", elementType: "labels.text.stroke", stylers: [{ color: "#fffdf4" }] },
        { featureType: "transit.line", elementType: "geometry", stylers: [{ color: "#c7a3d8" }] },
        { featureType: "water", elementType: "geometry.fill", stylers: [{ color: "#8dd5eb" }] },
        { featureType: "water", elementType: "geometry.stroke", stylers: [{ color: "#60aecf" }, { weight: 1 }] },
        { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#277ba6" }] }
    ] }
];

class MapController {

    constructor() {
        this.map = null;
        this.trafficLayer = null;
        this.bicyclingLayer = null;
        this.transitLayer = null;

        this.editMode = true;
        this.shareMode = false;

        this.centerDefault = { lat: 24.7399, lng: 46.5731 };
        this.zoomDefault = 15;

        this.modeAdd = false;
        this.modeRouteAdd = false;
        this.modePolygonAdd = false;
        this.modeFreeDraw = false;

        window.MapController = this;
    }

    init() {
        console.log("Boot v25.8 - Fixed Route Deletion & Share Mode");

        /* --------------------------------------------------
           1) تحديد وضع المشاركة مبكراً (قبل أي UI أو state)
        -------------------------------------------------- */
        Utils.prepareTabSession();
        const params = new URLSearchParams(location.search);
        this.shareMode = params.has("x");

        /* --------------------------------------------------
           2) ضبط editMode بشكل صارم
        -------------------------------------------------- */
        if (this.shareMode) {
            this.editMode = false;
        } else {
            this.editMode = Utils.getEditMode();
        }

        /* --------------------------------------------------
           3) تفعيل حفظ حالة التحرير فقط خارج shareMode
        -------------------------------------------------- */
        if (!this.shareMode) {
            this.setupEditModePersistence();
        }

        /* --------------------------------------------------
           4) تهيئة الخريطة
        -------------------------------------------------- */
        const darkModeStyle = [
            { elementType: "geometry", stylers: [{ color: "#212121" }] },
            { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
            { elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
            { elementType: "labels.text.stroke", stylers: [{ color: "#212121" }] },
            { featureType: "administrative", elementType: "labels.text.fill", stylers: [{ color: "#bdbdbd" }] },
            { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
            { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#181818" }] },
            { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
            { featureType: "poi.park", elementType: "labels.text.stroke", stylers: [{ color: "#1b1b1b" }] },
            { featureType: "road", elementType: "geometry.fill", stylers: [{ color: "#2c2c2c" }] },
            { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#8a8a8a" }] },
            { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#373737" }] },
            { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#3c3c3c" }] },
            { featureType: "road.highway.controlled_access", elementType: "geometry", stylers: [{ color: "#4e4e4e" }] },
            { featureType: "road.local", elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
            { featureType: "transit", elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
            { featureType: "water", elementType: "geometry", stylers: [{ color: "#000000" }] },
            { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#3d3d3d" }] }
        ];

        const silverStyle = [
            { elementType: "geometry", stylers: [{ color: "#f5f5f5" }] },
            { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
            { elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
            { elementType: "labels.text.stroke", stylers: [{ color: "#f5f5f5" }] },
            { featureType: "administrative.land_parcel", elementType: "labels.text.fill", stylers: [{ color: "#bdbdbd" }] },
            { featureType: "poi", elementType: "geometry", stylers: [{ color: "#eeeeee" }] },
            { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
            { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#e5e5e5" }] },
            { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#9e9e9e" }] },
            { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
            { featureType: "road.arterial", elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
            { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#dadada" }] },
            { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
            { featureType: "road.local", elementType: "labels.text.fill", stylers: [{ color: "#9e9e9e" }] },
            { featureType: "transit.line", elementType: "geometry", stylers: [{ color: "#e5e5e5" }] },
            { featureType: "transit.station", elementType: "geometry", stylers: [{ color: "#eeeeee" }] },
            { featureType: "water", elementType: "geometry", stylers: [{ color: "#c9c9c9" }] },
            { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#9e9e9e" }] }
        ];

        this.map = new google.maps.Map(document.getElementById("map"), {
            center: this.centerDefault,
            zoom: this.zoomDefault,
            mapTypeId: "roadmap",
            mapId: "b76177e462344e3ee4d9178b",
            streetViewControl: false,
            mapTypeControl: false,
            fullscreenControl: true,
            zoomControl: true,
            gestureHandling: 'greedy',
            clickableIcons: false
        });

        this.trafficLayer = new google.maps.TrafficLayer();
        this.bicyclingLayer = new google.maps.BicyclingLayer();
        this.transitLayer = new google.maps.TransitLayer();

        this.map.mapTypes.set("dark", new google.maps.StyledMapType(darkModeStyle, { name: "الوضع الليلي" }));
        this.map.mapTypes.set("silver", new google.maps.StyledMapType(silverStyle, { name: "فضي" }));
        // Use Google's native satellite imagery. The previous Esri tile proxy
        // (/api/imagery/...) is not provided by this Cloudflare Pages deployment.
        // Google's required attribution is managed by the Maps API.

        for (const { id, name, styles } of EXTRA_BASE_MAPS) {
            this.map.mapTypes.set(id, new google.maps.StyledMapType(styles, { name }));
        }

        this.map.addListener("zoom_changed", () => {
            bus.emit("map:zoom", this.map.getZoom());
        });

        this.map.addListener("bounds_changed", () => {
            bus.emit("map:bounds");
        });

        this.waitForGmpMarkersAndEmit();
    }
    
    setupEditModePersistence() {
        bus.on("editMode:change", (isEditMode) => {
            Utils.saveEditMode(isEditMode);
        });

        this.emitEditModeChange = (isEditMode) => {
            bus.emit("editMode:change", isEditMode);
        };
    }

    waitForGmpMarkersAndEmit() {
        if (google.maps.marker?.AdvancedMarkerElement) {
            console.log("gmp-markers library is ready. Emitting 'map:ready' event.");
            bus.emit("map:ready", this.map);
        } else {
            setTimeout(() => this.waitForGmpMarkersAndEmit(), 100);
        }
    }

    setRoadmap() { this.map.setMapTypeId("roadmap"); }
    setSatellite() { this.map.setMapTypeId("satellite"); }
    setTerrain() { this.map.setMapTypeId("terrain"); }
    setDarkMode() { this.map.setMapTypeId("dark"); }
    setSilverMode() { this.map.setMapTypeId("silver"); }

    toggleTraffic() { this.trafficLayer.setMap(this.trafficLayer.getMap() ? null : this.map); }
    toggleBicycling() { this.bicyclingLayer.setMap(this.bicyclingLayer.getMap() ? null : this.map); }
    toggleTransit() { this.transitLayer.setMap(this.transitLayer.getMap() ? null : this.map); }

    setCursor(c) {
        this.map.setOptions({ draggableCursor: c });
    }

    setEditMode(isEditMode) {
        if (this.shareMode) return; // حماية إضافية
        this.editMode = isEditMode;
        this.emitEditModeChange(isEditMode);
    }
}

const MAP = new MapController();

/*
============================================================
   IconPickerModal
— واجهة اختيار الأيقونات (Google My Maps style)
============================================================
*/
class IconPickerModal {
    constructor() {
        this.modal = null;
        this.selectedIcon = null;
        this.onSelectCallback = null;
        this.searchInput = null;
        this.categoryButtons = [];
        this.currentCategory = 'all';
        
        // Icon categories with Material Icons - Enhanced with more traffic and safety icons
        this.iconCategories = {
            shapes: ['circle', 'square', 'change_history', 'pentagon', 'hexagon', 'star', 'triangle', 'diamond'],
            places: ['home', 'apartment', 'business', 'store', 'restaurant', 'local_cafe', 'local_hotel', 'local_parking'],
            transport: ['directions_car', 'directions_bus', 'directions_bike', 'local_shipping', 'local_taxi', 'flight', 'train', 'directions_boat', 'electric_car', 'scooter', 'motorcycle'],
            crisis: ['warning', 'report_problem', 'gpp_maybe', 'local_fire_department', 'local_hospital', 'health_and_safety', 'emergency', 'crisis_alert', 'siren', 'priority_high'],
            signs: ['add_location', 'location_on', 'push_pin', 'flag', 'bookmark', 'label', 'tag', 'sell', 'traffic', 'detour', 'fence', 'do_not_enter', 'stop', 'yield', 'no_parking', 'handicap'],
            security: ['security', 'local_police', 'gpp_good', 'gpp_bad', 'policy', 'verified_user', 'shield', 'lock', 'lock_open', 'vpn_key', 'privacy_tip', 'admin_panel_settings', 'military_tech', 'personal_injury', 'health_and_safety', 'coronavirus', 'local_police', 'local_fire_department', 'emergency'],
            traffic: ['traffic', 'traffic_jam', 'add_road', 'add_road_sharp', 'do_not_step', 'crossing', 'traffic_light', 'roundabout', 'merge', 'lane_change', 'turn_left', 'turn_right', 'u_turn', 'directions', 'directions_car', 'directions_bike', 'directions_walk', 'signpost', 'toll', 'not_listed_location', 'no_photography', 'no_stroller', 'no_cell', 'pedal_bike'],
            roads: ['add_road', 'fork_right', 'fork_left', 't_junction', 'roundabout', 'straight', 'curved_road', 'intersection', 'highway', 'expressway'],
            police: ['local_police', 'military_tech', 'security', 'gpp_good', 'gpp_bad', 'admin_panel_settings', 'verified_user', 'policy', 'shield', 'lock', 'lock_open', 'vpn_key', 'privacy_tip', 'emergency', 'health_and_safety', 'crisis_alert', 'warning', 'report_problem'],
            // فئة جديدة للدوريات الأمنية
            patrol: ['directions_car', 'local_shipping', 'local_taxi', 'security', 'local_police', 'military_tech', 'emergency', 'directions', 'directions_run', 'motorcycle', 'scooter', 'electric_car'],
            // فئة جديدة لإشارات المرور
            traffic_signs: ['add_road', 'do_not_step', 'crossing', 'traffic_light', 'roundabout', 'merge', 'lane_change', 'turn_left', 'turn_right', 'u_turn', 'signpost', 'toll', 'not_listed_location', 'no_photography', 'no_stroller', 'no_cell', 'pedal_bike', 'no_parking', 'do_not_enter', 'stop', 'yield'],
            // فئة جديدة لقمع المرور
            traffic_control: ['gavel', 'block', 'not_interested', 'do_not_disturb', 'do_not_disturb_on', 'do_not_disturb_alt', 'do_not_disturb_off', 'pan_tool', 'pan_tool_alt', 'back_hand', 'front_hand', 'waving_hand', 'raised_hand', 'thumb_up', 'thumb_down', 'thumb_up_off_alt', 'thumb_down_off_alt'],
            // فئة جديدة للمركبات الأمنية
            security_vehicles: ['directions_car', 'local_shipping', 'local_taxi', 'airport_shuttle', 'rv_hookup', 'car_rental', 'two_wheeler', 'motorcycle', 'electric_car', 'electric_moped', 'electric_scooter'],
            // فئة جديدة للمعدات الأمنية
            security_equipment: ['videocam', 'photo_camera', 'camera', 'camera_alt', 'camera_enhance', 'camera_indoor', 'camera_outdoor', 'camera_rear', 'switch_video', 'videocam_off', 'photo_camera_back', 'photo_camera_front', 'photo_size_select_actual', 'photo_size_select_large', 'photo_size_select_small', 'add_photo_alternate', 'add_a_photo', 'image', 'image_search', 'image_not_supported', 'broken_image', 'filter', 'filter_b_and_w', 'filter_center_focus', 'filter_drama', 'filter_frames', 'filter_hdr', 'filter_none', 'filter_tilt_shift', 'filter_vintage', 'blur_circular', 'blur_linear', 'blur_on', 'blur_off', 'flare', 'flash_on', 'flash_off', 'flash_auto', 'highlight', 'gradient', 'tonality', 'texture', 'grain', 'vignette', 'center_focus_strong', 'center_focus_weak', 'center_focus', 'panorama', 'panorama_fish_eye', 'panorama_horizontal', 'panorama_vertical', 'panorama_wide_angle', 'photo', 'photo_library', 'photo_size_select_actual', 'photo_size_select_large', 'photo_size_select_small', 'slideshow', 'switch_camera', 'switch_video', 'timelapse', 'timer', 'timer_10', 'timer_3', 'timer_off', 'camera', 'camera_alt', 'camera_enhance', 'camera_front', 'camera_rear', 'camera_roll', 'camera_indoor', 'camera_outdoor', 'add_a_photo', 'add_photo_alternate', 'image', 'image_search', 'image_not_supported', 'broken_image', 'filter', 'filter_b_and_w', 'filter_center_focus', 'filter_drama', 'filter_frames', 'filter_hdr', 'filter_none', 'filter_tilt_shift', 'filter_vintage', 'blur_circular', 'blur_linear', 'blur_on', 'blur_off', 'flare', 'flash_on', 'flash_off', 'flash_auto', 'highlight', 'gradient', 'tonality', 'texture', 'grain', 'vignette', 'center_focus_strong', 'center_focus_weak', 'center_focus', 'panorama', 'panorama_fish_eye', 'panorama_horizontal', 'panorama_vertical', 'panorama_wide_angle', 'photo', 'photo_library', 'photo_size_select_actual', 'photo_size_select_large', 'photo_size_select_small', 'slideshow', 'switch_camera', 'switch_video', 'timelapse', 'timer', 'timer_10', 'timer_3', 'timer_off', 'camera', 'camera_alt', 'camera_enhance', 'camera_front', 'camera_rear', 'camera_roll', 'camera_indoor', 'camera_outdoor', 'add_a_photo', 'add_photo_alternate', 'image', 'image_search', 'image_not_supported', 'broken_image', 'filter', 'filter_b_and_w', 'filter_center_focus', 'filter_drama', 'filter_frames', 'filter_hdr', 'filter_none', 'filter_tilt_shift', 'filter_vintage', 'blur_circular', 'blur_linear', 'blur_on', 'blur_off', 'flare', 'flash_on', 'flash_off', 'flash_auto', 'highlight', 'gradient', 'tonality', 'texture', 'grain', 'vignette', 'center_focus_strong', 'center_focus_weak', 'center_focus', 'panorama', 'panorama_fish_eye', 'panorama_horizontal', 'panorama_vertical', 'panorama_wide_angle', 'photo', 'photo_library', 'photo_size_select_actual', 'photo_size_select_large', 'photo_size_select_small', 'slideshow', 'switch_camera', 'switch_video', 'timelapse', 'timer', 'timer_10', 'timer_3', 'timer_off']
        };
        
        this.initModal();
    }
    
    initModal() {
        // Create modal container
        this.modal = document.createElement('div');
        this.modal.id = 'icon-picker-modal';
        this.modal.className = 'icon-picker-modal';
        this.modal.style.display = 'none';
        
        // Create modal content
        const modalContent = document.createElement('div');
        modalContent.className = 'icon-picker-content';
        
        // Create header with search
        const header = document.createElement('div');
        header.className = 'icon-picker-header';
        
        this.searchInput = document.createElement('input');
        this.searchInput.type = 'text';
        this.searchInput.placeholder = 'بحث عن أيقونة...';
        this.searchInput.className = 'icon-picker-search';
        
        const closeButton = document.createElement('button');
        closeButton.innerHTML = '<i class="material-icons">close</i>';
        closeButton.className = 'icon-picker-close';
        closeButton.addEventListener('click', () => this.hide());
        
        header.appendChild(this.searchInput);
        header.appendChild(closeButton);
        
        // Create category tabs
        const categories = document.createElement('div');
        categories.className = 'icon-picker-categories';
        
        // Add "All" category button
        const allButton = document.createElement('button');
        allButton.className = 'icon-picker-category active';
        allButton.textContent = 'الكل';
        allButton.dataset.category = 'all';
        allButton.addEventListener('click', () => this.setCategory('all'));
        categories.appendChild(allButton);
        this.categoryButtons.push(allButton);
        
        // Add category buttons
        Object.keys(this.iconCategories).forEach(category => {
            const button = document.createElement('button');
            button.className = 'icon-picker-category';
            button.dataset.category = category;
            
            // Set category label in Arabic
            const categoryLabels = {
                shapes: 'الأشكال',
                places: 'الأماكن',
                transport: 'النقل',
                crisis: 'الطوارئ',
                signs: 'اللافتات',
                security: 'الأمن',
                traffic: 'المرور',
                roads: 'الطرق',
                police: 'الشرطة',
                patrol: 'الدوريات',
                traffic_signs: 'إشارات المرور',
                traffic_control: 'قمع المرور',
                security_vehicles: 'المركبات الأمنية',
                security_equipment: 'المعدات الأمنية'
            };
            
            button.textContent = categoryLabels[category];
            button.addEventListener('click', () => this.setCategory(category));
            categories.appendChild(button);
            this.categoryButtons.push(button);
        });
        
        // Create icon grid
        const iconGrid = document.createElement('div');
        iconGrid.className = 'icon-picker-grid';
        
        // Create footer with action buttons
        const footer = document.createElement('div');
        footer.className = 'icon-picker-footer';
        
        const cancelButton = document.createElement('button');
        cancelButton.textContent = 'إلغاء';
        cancelButton.className = 'icon-picker-btn icon-picker-cancel';
        cancelButton.addEventListener('click', () => this.hide());
        
        const selectButton = document.createElement('button');
        selectButton.textContent = 'اختيار';
        selectButton.className = 'icon-picker-btn icon-picker-select';
        selectButton.disabled = true;
        selectButton.addEventListener('click', () => this.selectIcon());
        
        footer.appendChild(cancelButton);
        footer.appendChild(selectButton);
        
        // Assemble modal
        modalContent.appendChild(header);
        modalContent.appendChild(categories);
        modalContent.appendChild(iconGrid);
        modalContent.appendChild(footer);
        
        this.modal.appendChild(modalContent);
        document.body.appendChild(this.modal);
        
        // Add event listeners
        this.searchInput.addEventListener('input', () => this.filterIcons());
        
        // Add CSS styles
        this.addStyles();
    }
    
    addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .icon-picker-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0, 0, 0, 0.5);
                z-index: 10000;
                display: flex;
                align-items: center;
                justify-content: center;
                font-family: 'Tajawal', sans-serif;
                direction: rtl;
            }
            
            .icon-picker-content {
                background: white;
                border-radius: 12px;
                width: 90%;
                max-width: 700px;
                max-height: 80vh;
                overflow: hidden;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
                display: flex;
                flex-direction: column;
            }
            
            .icon-picker-header {
                display: flex;
                padding: 15px;
                border-bottom: 1px solid #eee;
            }
            
            .icon-picker-search {
                flex: 1;
                padding: 10px;
                border: 1px solid #ddd;
                border-radius: 4px;
                font-size: 16px;
                margin-left: 10px;
                font-family: 'Tajawal', sans-serif;
            }
            
            .icon-picker-close {
                background: none;
                border: none;
                cursor: pointer;
                padding: 5px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .icon-picker-categories {
                display: flex;
                padding: 10px 15px;
                border-bottom: 1px solid #eee;
                overflow-x: auto;
                flex-wrap: wrap;
                gap: 5px;
            }
            
            .icon-picker-category {
                background: none;
                border: none;
                padding: 8px 15px;
                border-radius: 20px;
                cursor: pointer;
                white-space: nowrap;
                font-size: 14px;
                font-family: 'Tajawal', sans-serif;
                transition: background-color 0.2s;
            }
            
            .icon-picker-category:hover {
                background-color: #f0f0f0;
            }
            
            .icon-picker-category.active {
                background-color: #e0e0e0;
            }
            
            .icon-picker-grid {
                flex: 1;
                overflow-y: auto;
                padding: 15px;
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(60px, 1fr));
                gap: 10px;
            }
            
            .icon-picker-item {
                display: flex;
                flex-direction: column;
                align-items: center;
                padding: 10px;
                border-radius: 8px;
                cursor: pointer;
                transition: background-color 0.2s;
            }
            
            .icon-picker-item:hover {
                background-color: #f5f5f5;
            }
            
            .icon-picker-item.selected {
                background-color: #e3f2fd;
            }
            
            .icon-picker-icon {
                font-size: 24px;
                margin-bottom: 5px;
                /* تحسين جودة عرض الأيقونات */
                -webkit-font-smoothing: antialiased;
                -moz-osx-font-smoothing: grayscale;
                text-rendering: optimizeLegibility;
                /* إصلاح مشكلة عدم عرض بعض الأيقونات */
                display: inline-block;
                width: 24px;
                height: 24px;
                line-height: 1;
            }
            
            .icon-picker-name {
                font-size: 12px;
                text-align: center;
                font-family: 'Tajawal', sans-serif;
            }
            
            .icon-picker-footer {
                display: flex;
                justify-content: flex-end;
                padding: 15px;
                border-top: 1px solid #eee;
            }
            
            .icon-picker-btn {
                padding: 8px 15px;
                border-radius: 4px;
                border: none;
                cursor: pointer;
                margin-right: 10px;
                font-size: 14px;
                font-family: 'Tajawal', sans-serif;
            }
            
            .icon-picker-cancel {
                background-color: #f5f5f5;
            }
            
            .icon-picker-select {
                background-color: #4285f4;
                color: white;
            }
            
            .icon-picker-select:disabled {
                background-color: #cccccc;
                cursor: not-allowed;
            }
        `;
        document.head.appendChild(style);
    }
    
    show(onSelectCallback) {
        this.onSelectCallback = onSelectCallback;
        this.modal.style.display = 'flex';
        this.selectedIcon = null;
        this.searchInput.value = '';
        this.setCategory('all');
        this.renderIcons();
    }
    
    hide() {
        this.modal.style.display = 'none';
    }
    
    setCategory(category) {
        this.currentCategory = category;
        
        // Update active button
        this.categoryButtons.forEach(button => {
            if (button.dataset.category === category) {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
        });
        
        this.renderIcons();
    }
    
    filterIcons() {
        this.renderIcons();
    }
    
    renderIcons() {
        const grid = this.modal.querySelector('.icon-picker-grid');
        grid.innerHTML = '';
        
        const searchTerm = this.searchInput.value.toLowerCase();
        
        // Get icons to display based on category
        let iconsToDisplay = [];
        
        if (this.currentCategory === 'all') {
            // Get all icons from all categories
            Object.values(this.iconCategories).forEach(categoryIcons => {
                iconsToDisplay = [...iconsToDisplay, ...categoryIcons];
            });
            // Remove duplicates
            iconsToDisplay = [...new Set(iconsToDisplay)];
        } else {
            iconsToDisplay = this.iconCategories[this.currentCategory] || [];
        }
        
        // Filter by search term
        if (searchTerm) {
            iconsToDisplay = iconsToDisplay.filter(icon => 
                icon.toLowerCase().includes(searchTerm)
            );
        }
        
        // Create icon items
        iconsToDisplay.forEach(icon => {
            const item = document.createElement('div');
            item.className = 'icon-picker-item';
            
            const iconElement = document.createElement('i');
            iconElement.className = 'material-icons icon-picker-icon';
            iconElement.textContent = icon;
            
            const nameElement = document.createElement('div');
            nameElement.className = 'icon-picker-name';
            nameElement.textContent = icon;
            
            item.appendChild(iconElement);
            item.appendChild(nameElement);
            
            item.addEventListener('click', () => {
                // Remove previous selection
                const prevSelected = grid.querySelector('.icon-picker-item.selected');
                if (prevSelected) {
                    prevSelected.classList.remove('selected');
                }
                
                // Select this item
                item.classList.add('selected');
                this.selectedIcon = icon;
                
                // Enable select button
                document.querySelector('.icon-picker-select').disabled = false;
            });
            
            grid.appendChild(item);
        });
    }
    
    selectIcon() {
        if (this.selectedIcon && this.onSelectCallback) {
            this.onSelectCallback(this.selectedIcon);
        }
        this.hide();
    }
}

/*
============================================================
   FreeLayerManager
— إدارة الطبقة الحرة (أيقونات ونصوص)
============================================================
*/
class FreeLayerManager {
    constructor() {
        this.items = [];
        this.map = null;
        this.shareMode = false;
        this.editMode = true;
        this.iconPicker = new IconPickerModal();
        this.activeItem = null;
        
        bus.on("map:ready", map => {
            this.map = map;
            this.shareMode = MAP.shareMode;
            this.editMode = MAP.editMode;
            this.onMapReady();
        });
        
        bus.on("state:load", st => this.applyState(st));
        bus.on("state:save", () => this.exportState());
    }
    
    onMapReady() {
        // The main map click listener is now only for adding new items.
        this.map.addListener("click", e => {
            if (!MAP.modeFreeDraw || this.shareMode) return;
            this.showAddOptions(e.latLng);
        });
    }
    
    showAddOptions(latLng) {
        const optionsDialog = document.createElement('div');
        optionsDialog.className = 'free-draw-options-dialog';
        
        const content = document.createElement('div');
        content.className = 'free-draw-options-content';
        
        const title = document.createElement('h3');
        title.textContent = 'اختر نوع العنصر';
        
        const iconButton = document.createElement('button');
        iconButton.className = 'free-draw-option-btn';
        iconButton.innerHTML = '<i class="material-icons">place</i> أيقونة';
        iconButton.addEventListener('click', () => {
            this.addIcon(latLng);
            document.body.removeChild(optionsDialog);
        });
        
        const textButton = document.createElement('button');
        textButton.className = 'free-draw-option-btn';
        textButton.innerHTML = '<i class="material-icons">text_fields</i> نص';
        textButton.addEventListener('click', () => {
            this.addText(latLng);
            document.body.removeChild(optionsDialog);
        });
        
        const cancelButton = document.createElement('button');
        cancelButton.className = 'free-draw-option-btn free-draw-cancel';
        cancelButton.textContent = 'إلغاء';
        cancelButton.addEventListener('click', () => {
            document.body.removeChild(optionsDialog);
        });
        
        content.appendChild(title);
        content.appendChild(iconButton);
        content.appendChild(textButton);
        content.appendChild(cancelButton);
        optionsDialog.appendChild(content);
        
        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            .free-draw-options-dialog {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0, 0, 0, 0.5);
                z-index: 10000;
                display: flex;
                align-items: center;
                justify-content: center;
                font-family: 'Tajawal', sans-serif;
                direction: rtl;
            }
            
            .free-draw-options-content {
                background: white;
                border-radius: 12px;
                padding: 20px;
                width: 90%;
                max-width: 300px;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
            }
            
            .free-draw-options-content h3 {
                margin-top: 0;
                margin-bottom: 20px;
                text-align: center;
                font-family: 'Tajawal', sans-serif;
            }
            
            .free-draw-option-btn {
                display: flex;
                align-items: center;
                justify-content: center;
                width: 100%;
                padding: 12px;
                margin-bottom: 10px;
                border: none;
                border-radius: 8px;
                background-color: #f5f5f5;
                cursor: pointer;
                font-size: 16px;
                transition: background-color 0.2s;
                font-family: 'Tajawal', sans-serif;
            }
            
            .free-draw-option-btn:hover {
                background-color: #e0e0e0;
            }
            
            .free-draw-option-btn i {
                margin-left: 8px;
            }
            
            .free-draw-cancel {
                background-color: #f5f5f5;
                color: #333;
            }
        `;
        document.head.appendChild(style);
        
        document.body.appendChild(optionsDialog);
    }
    
    addIcon(latLng) {
        this.iconPicker.show((iconName) => {
            const item = {
                id: "free" + Date.now(),
                type: 'icon',
                position: latLng,
                iconName: iconName,
                color: '#4285f4',
                scale: 1
            };
            
            this.createIconMarker(item);
            this.items.push(item);
            bus.emit("persist");
            bus.emit("toast", "تمت إضافة أيقونة");
            
            // إصلاح: تقفل وضع الرسم الحر بعد إضافة أيقونة
            MAP.modeFreeDraw = false;
            UI.setActiveMode('default');
        });
    }
    
    createIconMarker(item) {
        const iconElement = document.createElement('div');
        iconElement.className = 'free-draw-icon';
        // تحسين جودة عرض الأيقونة
        iconElement.innerHTML = `<i class="material-icons" style="color: ${item.color}; font-size: ${24 * item.scale}px; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; text-rendering: optimizeLegibility;">${item.iconName}</i>`;
        
        item.marker = new google.maps.marker.AdvancedMarkerElement({
            position: item.position,
            map: this.map,
            content: iconElement,
            gmpDraggable: this.editMode && !this.shareMode
        });
        
        // FIX: Add a direct click listener to marker content for reliable editing
        iconElement.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent map click
            if (!MAP.shareMode && MAP.editMode) this.openEditCard(item);
        });
        
        if (this.editMode && !this.shareMode) {
            item.marker.addListener("dragend", () => {
                const pos = item.marker.position;
                // Ensure item.position is always a LatLng object
                if (pos.lat && typeof pos.lat === 'function') {
                    // It's already a LatLng object
                    item.position = pos;
                } else {
                    // Convert to LatLng object
                    item.position = new google.maps.LatLng(pos.lat, pos.lng);
                }
                bus.emit("persist");
            });
        }
    }
    
    addText(latLng) {
        const item = {
            id: "free" + Date.now(),
            type: 'text',
            position: latLng,
            text: 'نص جديد',
            backgroundStyle: 'white',
            textColor: '#000000',
            fontSize: 16
        };
        
        this.createTextMarker(item);
        this.items.push(item);
        
        // Open edit dialog immediately for new text
        if (!MAP.shareMode && MAP.editMode) this.openEditCard(item);
        
        bus.emit("persist");
        bus.emit("toast", "تمت إضافة نص");
        
        // إصلاح: تقفل وضع الرسم الحر بعد إضافة نص
        MAP.modeFreeDraw = false;
        UI.setActiveMode('default');
    }
    
    createTextMarker(item) {
        const textElement = document.createElement('div');
        textElement.className = 'free-draw-text';
        
        // Apply background style
        this.applyTextBackgroundStyle(textElement, item);
        
        // تحسين عرض النص مع دعم الأسطر المتعددة
        textElement.innerHTML = this.formatTextDisplay(item.text);
        
        item.marker = new google.maps.marker.AdvancedMarkerElement({
            position: item.position,
            map: this.map,
            content: textElement,
            gmpDraggable: this.editMode && !this.shareMode
        });

        // FIX: Add a direct click listener to marker content for reliable editing
        textElement.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent map click
            if (!MAP.shareMode && MAP.editMode) this.openEditCard(item);
        });
        
        if (this.editMode && !this.shareMode) {
            item.marker.addListener("dragend", () => {
                const pos = item.marker.position;
                // Ensure item.position is always a LatLng object
                if (pos.lat && typeof pos.lat === 'function') {
                    // It's already a LatLng object
                    item.position = pos;
                } else {
                    // Convert to LatLng object
                    item.position = new google.maps.LatLng(pos.lat, pos.lng);
                }
                bus.emit("persist");
            });
        }
    }
    
    // دالة جديدة لتنسيق عرض النص مع الأسطر
    formatTextDisplay(text) {
        if (!text) return '';
        // تقسيم النص إلى أسطر وتنظيم العرض
        const lines = text.split('\n');
        return lines.map(line => Utils.escapeHTML(line)).join('<br>');
    }
    
    applyTextBackgroundStyle(element, item) {
        // Reset styles
        element.style.padding = '0';
        element.style.borderRadius = '0';
        element.style.backgroundColor = 'transparent';
        element.style.border = 'none';
        element.style.boxShadow = 'none';
        element.style.color = item.textColor;
        element.style.fontSize = `${item.fontSize}px`;
        element.style.fontFamily = "'Tajawal', 'Cairo', sans-serif";
        element.style.fontWeight = 'normal';
        element.style.textShadow = 'none';
        element.style.lineHeight = '1.4'; // تحسين تباعد الأسطر
        element.style.whiteSpace = 'pre-wrap'; // الحفاظ على المسافات والأسطر
        element.style.wordBreak = 'break-word'; // كسر الكلمات الطويلة
        element.style.maxWidth = '300px'; // تحديد أقصى عرض للنص
        
        // Apply specific background style
        switch (item.backgroundStyle) {
            case 'white':
                element.style.padding = '8px 12px';
                element.style.borderRadius = '8px';
                element.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
                element.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                break;
            case 'dark':
                element.style.padding = '8px 12px';
                element.style.borderRadius = '8px';
                element.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
                element.style.color = '#ffffff';
                element.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
                break;
            case 'outline':
                element.style.padding = '6px 10px';
                element.style.borderRadius = '6px';
                element.style.border = `2px solid ${item.textColor}`;
                element.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
                break;
            // 'none' is already applied by default
        }
    }
    
    openEditCard(item) {
        if (MAP.shareMode || !MAP.editMode) return;
        this.activeItem = item;
        
        const cardStyle = `
            font-family: 'Tajawal', 'Cairo', sans-serif;
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border-radius: 16px;
            border: none;
            box-shadow: 0 8px 32px rgba(31, 38, 135, 0.15);
            padding: 0;
            color: #333;
            direction: rtl;
            width: 380px;
            max-width: 95vw;
            max-height: 70vh;
            overflow-y: auto;
            overflow-x: hidden;
        `;
        
        const headerStyle = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 16px 20px;
            background: rgba(255, 255, 255, 0.7);
            border-bottom: 1px solid rgba(255, 255, 255, 0.2);
        `;
        
        const bodyStyle = `padding: 20px;`;
        const footerStyle = `
            padding: 16px 20px;
            background: rgba(255, 255, 255, 0.7);
            border-top: 1px solid rgba(255, 255, 255, 0.2);
            display: flex;
            justify-content: flex-end;
            gap: 10px;
        `;
        
        let bodyContent = '';
        
        if (item.type === 'icon') {
            bodyContent = `
                <div style="margin-bottom: 16px;">
                    <label style="font-size: 14px; display: block; margin-bottom: 8px; font-weight: bold;">الأيقونة:</label>
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <i class="material-icons" style="font-size: 28px; color: ${item.color}; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; text-rendering: optimizeLegibility;">${item.iconName}</i>
                        <button id="change-icon-btn" style="padding: 8px 16px; border: 1px solid #ddd; border-radius: 6px; background: white; cursor: pointer; font-family: 'Tajawal', sans-serif; font-size: 14px;">تغيير</button>
                    </div>
                </div>
                <div style="margin-bottom: 16px;">
                    <label style="font-size: 14px; display: block; margin-bottom: 8px; font-weight: bold;">اللون:</label>
                    <input id="icon-color" type="color" value="${item.color}" style="width: 100%; height: 40px; border: none; border-radius: 6px; cursor: pointer;">
                </div>
                <div style="margin-bottom: 16px;">
                    <label style="font-size: 14px; display: block; margin-bottom: 8px; font-weight: bold;">الحجم: <span id="icon-scale-value">${item.scale}x</span></label>
                    <input id="icon-scale" type="range" min="0.5" max="3" step="0.1" value="${item.scale}" style="width: 100%;">
                </div>
                <!-- إضافة خيار تغيير الموقع -->
                <div style="margin-bottom: 16px;">
                    <label style="font-size: 14px; display: block; margin-bottom: 8px; font-weight: bold;">تغيير الموقع:</label>
                    <button id="move-icon-btn" style="padding: 8px 16px; border: 1px solid #ddd; border-radius: 6px; background: white; cursor: pointer; font-family: 'Tajawal', sans-serif; font-size: 14px; width: 100%;">
                        <i class="material-icons" style="vertical-align: middle; margin-left: 8px;">open_with</i>
                        انقر هنا ثم انقر على الخريطة لتحديد الموقع الجديد
                    </button>
                </div>
            `;
        } else if (item.type === 'text') {
            bodyContent = `
                <div style="margin-bottom: 16px;">
                    <label style="font-size: 14px; display: block; margin-bottom: 8px; font-weight: bold;">النص:</label>
                    <textarea id="text-content" style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 8px; resize: vertical; min-height: 100px; font-family: 'Tajawal', sans-serif; font-size: 14px; line-height: 1.5;">${item.text}</textarea>
                    <div style="font-size: 12px; color: #666; margin-top: 4px;">ملاحظة: اضغط Enter للانتقال لسطر جديد</div>
                </div>
                <div style="margin-bottom: 16px;">
                    <label style="font-size: 14px; display: block; margin-bottom: 8px; font-weight: bold;">نمط الخلفية:</label>
                    <select id="text-background" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px; font-family: 'Tajawal', sans-serif; font-size: 14px;">
                        <option value="none" ${item.backgroundStyle === 'none' ? 'selected' : ''}>بدون خلفية</option>
                        <option value="white" ${item.backgroundStyle === 'white' ? 'selected' : ''}>مربع أبيض</option>
                        <option value="dark" ${item.backgroundStyle === 'dark' ? 'selected' : ''}>مربع داكن</option>
                        <option value="outline" ${item.backgroundStyle === 'outline' ? 'selected' : ''}>إطار</option>
                    </select>
                </div>
                <div style="margin-bottom: 16px;">
                    <label style="font-size: 14px; display: block; margin-bottom: 8px; font-weight: bold;">لون النص:</label>
                    <input id="text-color" type="color" value="${item.textColor}" style="width: 100%; height: 40px; border: none; border-radius: 6px; cursor: pointer;">
                </div>
                <div style="margin-bottom: 16px;">
                    <label style="font-size: 14px; display: block; margin-bottom: 8px; font-weight: bold;">حجم الخط: <span id="text-size-value">${item.fontSize}px</span></label>
                    <input id="text-size" type="range" min="12" max="36" step="1" value="${item.fontSize}" style="width: 100%;">
                </div>
                <!-- إضافة خيار تغيير الموقع -->
                <div style="margin-bottom: 16px;">
                    <label style="font-size: 14px; display: block; margin-bottom: 8px; font-weight: bold;">تغيير الموقع:</label>
                    <button id="move-text-btn" style="padding: 8px 16px; border: 1px solid #ddd; border-radius: 6px; background: white; cursor: pointer; font-family: 'Tajawal', sans-serif; font-size: 14px; width: 100%;">
                        <i class="material-icons" style="vertical-align: middle; margin-left: 8px;">open_with</i>
                        انقر هنا ثم انقر على الخريطة لتحديد الموقع الجديد
                    </button>
                </div>
            `;
        }
        
        const html = `
            <div style="${cardStyle}" class="free-draw-edit-card">
                <div style="${headerStyle}">
                    <h3 style="margin: 0; font-size: 18px; font-weight: 700;">${item.type === 'icon' ? 'تعديل الأيقونة' : 'تعديل النص'}</h3>
                </div>
                <div style="${bodyStyle}">
                    ${bodyContent}
                </div>
                <div style="${footerStyle}">
                    <button id="delete-btn" style="padding: 10px 20px; border: none; border-radius: 8px; background-color: #ea4335; color: white; cursor: pointer; font-family: 'Tajawal', sans-serif; font-size: 14px; font-weight: 600;">حذف</button>
                    <button id="cancel-btn" style="padding: 10px 20px; border: none; border-radius: 8px; background-color: #f5f5f5; color: #333; cursor: pointer; font-family: 'Tajawal', sans-serif; font-size: 14px; font-weight: 600;">إلغاء</button>
                    <button id="save-btn" style="padding: 10px 20px; border: none; border-radius: 8px; background-color: #4285f4; color: white; cursor: pointer; font-family: 'Tajawal', sans-serif; font-size: 14px; font-weight: 600;">حفظ</button>
                </div>
            </div>
        `;
        
        UI.openSharedInfoCard(html, item.position, true);
        
        google.maps.event.addListenerOnce(UI.sharedInfoWindow, "domready", () => {
            this.attachEditCardEvents(item);
        });
    }
    
    attachEditCardEvents(item) {
        const saveBtn = document.getElementById("save-btn");
        const cancelBtn = document.getElementById("cancel-btn");
        const deleteBtn = document.getElementById("delete-btn");
        
        if (cancelBtn) {
            cancelBtn.addEventListener("click", () => {
                UI.forceCloseSharedInfoCard();
            });
        }
        
        if (deleteBtn) {
            deleteBtn.addEventListener("click", () => {
                if (confirm("هل أنت متأكد من حذف هذا العنصر؟")) {
                    if (!MAP.shareMode && MAP.editMode) this.deleteItem(item);
                    UI.forceCloseSharedInfoCard();
                }
            });
        }
        
        if (item.type === 'icon') {
            const changeIconBtn = document.getElementById("change-icon-btn");
            const colorInput = document.getElementById("icon-color");
            const scaleInput = document.getElementById("icon-scale");
            const scaleValue = document.getElementById("icon-scale-value");
            const moveIconBtn = document.getElementById("move-icon-btn");
            
            if (changeIconBtn) {
                changeIconBtn.addEventListener("click", () => {
                    this.iconPicker.show((iconName) => {
                        item.iconName = iconName;
                        this.updateIconMarker(item);
                    });
                });
            }
            
            if (moveIconBtn) {
                moveIconBtn.addEventListener("click", () => {
                    UI.forceCloseSharedInfoCard();
                    MAP.setCursor("crosshair");
                    
                    // Create a one-time click listener to update position
                    const moveListener = this.map.addListener("click", (e) => {
                        // Remove listener after first click
                        google.maps.event.removeListener(moveListener);
                        
                        // Update item position
                        item.position = e.latLng;
                        item.marker.position = e.latLng;
                        
                        // Reset cursor
                        MAP.setCursor("grab");
                        
                        // Save changes
                        bus.emit("persist");
                        
                        // Show toast
                        bus.emit("toast", "تم تغيير موقع الأيقونة");
                        
                        // Reopen edit card
                        if (!MAP.shareMode && MAP.editMode) this.openEditCard(item);
                    });
                });
            }
            
            if (scaleInput) {
                scaleInput.addEventListener("input", () => {
                    const value = parseFloat(scaleInput.value);
                    scaleValue.textContent = `${value}x`;
                });
            }
            
            if (saveBtn) {
                saveBtn.addEventListener("click", () => {
                    item.color = colorInput.value;
                    item.scale = parseFloat(scaleInput.value);
                    
                    this.updateIconMarker(item);
                    UI.forceCloseSharedInfoCard();
                    bus.emit("persist");
                    bus.emit("toast", "تم حفظ التغييرات");
                });
            }
        } else if (item.type === 'text') {
            const textInput = document.getElementById("text-content");
            const backgroundSelect = document.getElementById("text-background");
            const colorInput = document.getElementById("text-color");
            const sizeInput = document.getElementById("text-size");
            const sizeValue = document.getElementById("text-size-value");
            const moveTextBtn = document.getElementById("move-text-btn");
            
            // إضافة دعم Enter للنص
            if (textInput) {
                textInput.addEventListener("keydown", (e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                        // السماح بإنشاء سطر جديد عند الضغط على Enter
                        e.preventDefault();
                        const start = textInput.selectionStart;
                        const end = textInput.selectionEnd;
                        const value = textInput.value;
                        textInput.value = value.substring(0, start) + "\n" + value.substring(end);
                        textInput.selectionStart = textInput.selectionEnd = start + 1;
                    }
                });
            }
            
            if (moveTextBtn) {
                moveTextBtn.addEventListener("click", () => {
                    UI.forceCloseSharedInfoCard();
                    MAP.setCursor("crosshair");
                    
                    // Create a one-time click listener to update position
                    const moveListener = this.map.addListener("click", (e) => {
                        // Remove listener after first click
                        google.maps.event.removeListener(moveListener);
                        
                        // Update item position
                        item.position = e.latLng;
                        item.marker.position = e.latLng;
                        
                        // Reset cursor
                        MAP.setCursor("grab");
                        
                        // Save changes
                        bus.emit("persist");
                        
                        // Show toast
                        bus.emit("toast", "تم تغيير موقع النص");
                        
                        // Reopen edit card
                        if (!MAP.shareMode && MAP.editMode) this.openEditCard(item);
                    });
                });
            }
            
            if (sizeInput) {
                sizeInput.addEventListener("input", () => {
                    sizeValue.textContent = `${sizeInput.value}px`;
                });
            }
            
            if (saveBtn) {
                saveBtn.addEventListener("click", () => {
                    item.text = textInput.value;
                    item.backgroundStyle = backgroundSelect.value;
                    item.textColor = colorInput.value;
                    item.fontSize = parseInt(sizeInput.value);
                    
                    this.updateTextMarker(item);
                    UI.forceCloseSharedInfoCard();
                    bus.emit("persist");
                    bus.emit("toast", "تم حفظ التغييرات");
                });
            }
        }
    }
    
    updateIconMarker(item) {
        const iconElement = item.marker.content;
        // تحسين جودة عرض الأيقونة عند التحديث
        iconElement.innerHTML = `<i class="material-icons" style="color: ${item.color}; font-size: ${24 * item.scale}px; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; text-rendering: optimizeLegibility;">${item.iconName}</i>`;
    }
    
    updateTextMarker(item) {
        const textElement = item.marker.content;
        this.applyTextBackgroundStyle(textElement, item);
        textElement.innerHTML = this.formatTextDisplay(item.text);
    }
    
    deleteItem(item) {
        if (MAP.shareMode || !MAP.editMode) return;
        item.marker.map = null;
        this.items = this.items.filter(i => i.id !== item.id);
        bus.emit("persist");
        bus.emit("toast", "تم حذف العنصر");
    }
    
    exportState() {
        return {
            freeDraw: this.items.map(item => {
                let lat, lng;
                const pos = item.position;
                
                // Handle both LatLng objects and plain objects
                if (pos.lat && typeof pos.lat === 'function') {
                    // It's a LatLng object
                    lat = pos.lat();
                    lng = pos.lng();
                } else {
                    // It's a plain object with lat/lng properties
                    lat = pos.lat;
                    lng = pos.lng;
                }
                
                const result = {
                    id: item.id,
                    type: item.type,
                    lat: lat,
                    lng: lng
                };
                
                if (item.type === 'icon') {
                    result.iconName = item.iconName;
                    result.color = item.color;
                    result.scale = item.scale;
                } else if (item.type === 'text') {
                    result.text = item.text;
                    result.backgroundStyle = item.backgroundStyle;
                    result.textColor = item.textColor;
                    result.fontSize = item.fontSize;
                }
                
                return result;
            })
        };
    }
    
    applyState(state) {
        if (!state || !state.freeDraw) return;
        
        // Clear existing items
        this.items.forEach(item => {
            item.marker.map = null;
        });
        this.items = [];
        
        // Add items from state
        state.freeDraw.forEach(itemData => {
            const item = {
                id: itemData.id,
                type: itemData.type,
                position: new google.maps.LatLng(itemData.lat, itemData.lng)
            };
            
            if (item.type === 'icon') {
                item.iconName = itemData.iconName;
                item.color = itemData.color || '#4285f4';
                item.scale = itemData.scale || 1;
                this.createIconMarker(item);
            } else if (item.type === 'text') {
                item.text = itemData.text;
                item.backgroundStyle = itemData.backgroundStyle || 'white';
                item.textColor = itemData.textColor || '#000000';
                item.fontSize = itemData.fontSize || 16;
                this.createTextMarker(item);
            }
            
            this.items.push(item);
        });
    }
}

const FREE_DRAW = new FreeLayerManager();

/*
============================================================
   LocationManager
— إدارة المواقع + بطاقات Glass
  ============================================================ */
class LocationManager {

    constructor() {
        this.items = [];
        this.map = null;
        this.shareMode = false;
        this.editMode = true;
        
        this.availableIcons = [
            { value: 'report_problem', label: '-' },
            { value: 'report_problem', label: 'نقطة فرز' },
            { value: 'report', label: 'تنظيم مروري' },
            { value: 'gpp_good', label: 'نقطة ثابتة' }
        ];

        bus.on("map:ready", map => {
            this.map = map;
            this.shareMode = MAP.shareMode;
            this.editMode = MAP.editMode;
            this.onMapReady();
        });
        bus.on("state:load", st => this.applyState(st));
        bus.on("state:save", () => this.exportState());
    }

    onMapReady() {
        this.map.addListener("click", e => {
            if (!MAP.modeAdd || this.shareMode) return;
            
            for (const item of this.items) {
                const distance = google.maps.geometry.spherical.computeDistanceBetween(e.latLng, item.marker.position);
                if (distance < 5) { 
                    this.openCard(item, false);
                    return; 
                }
            }

            this.addItem({
                id: "d" + Date.now() + Math.random(),
                lat: e.latLng.lat(), 
                lng: e.latLng.lng(), 
                radius: 22,
                color: "#ff0000", 
                fillOpacity: 0.3, 
                recipients: [], 
                name: "موقع جديد"
            });

            MAP.modeAdd = false;
            UI.showDefaultUI();
            bus.emit("persist"); 
            bus.emit("toast", "تمت إضافة موقع جديد");
        });
    }

    removeLegacyDefaultLocations(locations) {
        const formerDefaults = [
            { name: "مواقف نسما", lat: 24.738275101689318, lng: 46.57400430256134, iconType: 'local_police' },
            { name: "طريق الملك فيصل", lat: 24.736501294584695, lng: 46.576545241653285, iconType: 'local_police' },
            { name: "الحبيب", lat: 24.709422313107773, lng: 46.59397105888831, iconType: 'security' },
            { name: "راس النعامة", lat: 24.71033234430099, lng: 46.57294855439484, iconType: 'local_police' },
            { name: "دوار صفار", lat: 24.724914620418065, lng: 46.573466184564616, iconType: 'traffic' },
            { name: "بيت مبارك", lat: 24.73261214957373, lng: 46.57825334260031, iconType: 'apartment' },
            { name: "غصيبة", lat: 24.74573909383749, lng: 46.56052051492614, iconType: 'local_hospital' },
            { name: "دوار الروقية", lat: 24.742007409023923, lng: 46.56268048966995, iconType: 'local_police' },
            { name: "ميدان الملك سلمان", lat: 24.736130683456725, lng: 46.584028930317025, iconType: 'directions_car' },
            { name: "المسار الرياضي المديد", lat: 24.735384906613607, lng: 46.58133312296764, iconType: 'parking' },
            { name: "نقطة الشلهوب", lat: 24.73524079555137, lng: 46.57779729574876, iconType: 'local_fire_department' },
            { name: "مواقف الأمن", lat: 24.73785440668389, lng: 46.577909186352535, iconType: 'security' },
            { name: "كار بارك", lat: 24.73829475280005, lng: 46.577901024011375, iconType: 'parking' },
            { name: "م 9", lat: 24.73889215714233, lng: 46.580699315602104, iconType: 'business' },
            { name: "دوار البلدية", lat: 24.739271712116125, lng: 46.581809386523894, iconType: 'local_police' },
            { name: "دوار الضوء الخافت", lat: 24.739746153778835, lng: 46.58352836407099, iconType: 'report_problem' },
            { name: "مسار المشاة طريق الملك خالد الفرعي", lat: 24.74079938101476, lng: 46.586711589990585, iconType: 'report' },
            { name: "بوابة سمحان", lat: 24.742132, lng: 46.569503, iconType: 'local_police' },
            { name: "منطقة سمحان", lat: 24.740913, lng: 46.571891, iconType: 'gpp_good' },
            { name: "دوار البجيري", lat: 24.737521, lng: 46.574069, iconType: 'local_police' },
            { name: "إشارة البجيري", lat: 24.737662, lng: 46.575429, iconType: 'report_problem' }
        ];
        return locations.filter(location => !formerDefaults.some(point =>
            point.name === location.name && point.iconType === location.iconType &&
            Math.abs(point.lat - location.lat) < 1e-8 && Math.abs(point.lng - location.lng) < 1e-8 &&
            location.color === "#ff0000" && location.radius === 22 && !location.recipients?.length
        ));
    }

    addItem(data) {
        const marker = new google.maps.marker.AdvancedMarkerElement({
            position: { lat: data.lat, lng: data.lng },
            map: this.map,
            content: this.buildMarkerContent(data),
            gmpDraggable: this.editMode && !this.shareMode
        });

        const circle = new google.maps.Circle({
            center: { lat: data.lat, lng: data.lng },
            map: this.map,
            radius: data.radius || 22,
            strokeColor: data.color || "#ff0000",
            fillColor: data.color || "#ff0000",
            fillOpacity: data.fillOpacity || 0.3,
            strokeOpacity: 0.9,
            strokeWeight: 2,
            zIndex: 100
        });

        const item = {
            id: data.id,
            name: data.name || "نقطة",
            color: data.color,
            radius: data.radius,
            recipients: data.recipients,
            iconType: data.iconType || 'default',
            usePin: data.usePin || false,
            showCircle: data.showCircle || true,
            marker,
            circle
        };

        this.attachListeners(item);
        this.items.push(item);
        return item;
    }

    buildMarkerContent(data) {
        let markerContent;

        if (data.usePin) {
            const iconEl = document.createElement("i");
            iconEl.className = 'material-icons';
            iconEl.textContent = this.availableIcons.find(icon => icon.value === data.iconType)?.label.split(' ')[0] || 'place';
            // تحسين جودة عرض الأيقونة
            iconEl.style.color = 'white';
            iconEl.style.fontSize = '20px';
            iconEl.style.webkitFontSmoothing = 'antialiased';
            iconEl.style.mozOsxFontSmoothing = 'grayscale';
            iconEl.style.textRendering = 'optimizeLegibility';

            markerContent = document.createElement("div");
            markerContent.style.cssText = `
                background-color: ${data.color || "#ff0000"};
                width: 32px;
                height: 32px;
                border-radius: 50% 50% 50% 0;
                transform: rotate(-45deg) translate(-8px, 8px);
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 2px 6px rgba(0,0,0,0.3);
            `;
            markerContent.appendChild(iconEl);
        } else {
            markerContent = document.createElement("div");
            markerContent.style.cssText = `
                width:16px;
                height: 16px;
                background-color: transparent; 
                border: none;
                cursor: pointer;
            `;
        }

        return markerContent;
    }

    attachListeners(item) {
        item.marker.addListener("drag", () => item.circle.setCenter(item.marker.position));
        item.marker.addListener("dragend", () => bus.emit("persist"));
        item.circle.addListener("mouseover", () => { if (!UI.infoWindowPinned) this.openCard(item, true); });
        item.circle.addListener("mouseout", () => { UI.closeSharedInfoCard();});
        item.circle.addListener("click", () => this.openCard(item, false));
        
        item.circle.addListener("mousemove", (e) => {
            const distance = google.maps.geometry.spherical.computeDistanceBetween(
                e.latLng,
                item.circle.getCenter()
            );
            if (distance <= item.circle.getRadius()) {
                MAP.map.setOptions({ draggableCursor: "pointer" });
            } else {
                MAP.map.setOptions({ draggableCursor: "grab" });
            }
        });
    }

    openCard(item, hoverOnly = false) {
        const name = Utils.escapeHTML(item.name);
        const recipientsHtml = item.recipients.map(r => Utils.escapeHTML(r)).join('<br>');
        const isEditable = !hoverOnly && MAP.editMode;

        const cardStyle = `
            font-family: 'Tajawal', 'Cairo', sans-serif;
            background: rgba(255, 255, 255, 0.60);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border-radius: 20px;
            border: none;
            box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.15);
            padding: 0;
            color: #333;
            direction: rtl;
            width: 340px;
            max-width: 95vw;
            max-height: 70vh;
            overflow-y: auto;
            overflow-x: hidden;
            position: relative;
            -webkit-overflow-scrolling: touch;
            pointer-events: auto;
        `;

        const headerStyle = `
            display: flex;
            justify-content: space-between; 
            align-items: center;
            padding: 12px 16px;
            background: rgba(255, 255, 255, 0.2); 
            border-bottom: 1px solid rgba(255, 255, 255, 0.1); 
            position: sticky;
            top: 0;
            z-index: 10;
        `;

        const bodyStyle = `padding: 16px;`;
        
        const footerStyle = `
            padding: 12px 16px;
            background: rgba(255, 255, 255, 0.25); 
            border-top: 1px solid rgba(255, 255, 255, 0.1);
            position: sticky;
            bottom: 0;
        `;

        const inputStyle = `
            width: 100%;
            padding: 8px 12px;
            border-radius: 10px;
            border: 1px solid rgba(255, 255, 255, 0.5); 
            background: rgba(255, 255, 255, 0.4); 
            box-sizing: border-box; 
            font-family: 'Tajawal', 'Cairo', sans-serif; 
            font-size: 13px;
            outline: none;
            color: #222;
        `;

        const labelStyle = `font-size:11px; display:block; margin-bottom:4px; font-weight: 700; color: #444;`;

        const optionsHtml = this.availableIcons.map(icon => 
            `<option value="${icon.value}" ${item.iconType === icon.value ? 'selected' : ''}>${icon.label}</option>`
        ).join('');

        let bodyContent = '';
        if (isEditable) {
            bodyContent = `
                <div style="margin-bottom:12px;">
                    <label style="${labelStyle}">نوع الموقع:</label>
                    <select id="loc-icon-type" style="${inputStyle}">
                        ${optionsHtml}
                    </select>
                </div>
                <div style="margin-bottom:12px;">
                    <label style="${labelStyle}">الاسم:</label>
                    <input id="loc-name" type="text" value="${name}" style="${inputStyle}">
                </div>
                <div style="margin-bottom:12px;">
                    <label style="${labelStyle}">تفاصيل:</label>
                    <textarea id="loc-rec" style="${inputStyle} min-height:60px; resize:vertical;">${item.recipients.join('\n')}</textarea>
                </div>
            `;
        } else {
            const selectedLabel = this.availableIcons.find(icon => icon.value === item.iconType)?.label || 'مكان عام';
            bodyContent = `
                <div style="display: flex; gap: 10px; margin-bottom: 12px;">
                    <div style="flex:1;">
                           <label style="${labelStyle}">نوع الموقع:</label>
                           <div style="background: rgba(255,255,255,0.5); padding: 8px 12px; border-radius: 8px; font-size: 13px; font-weight:600;">
                           ${selectedLabel}
                           </div>
                    </div>
                </div>
                <div>
                    <label style="${labelStyle}">تفاصيل:</label>
                    <div style="background: rgba(255,255,255,0.3); padding: 12px; border-radius: 12px; font-size: 13px; line-height: 1.5; min-height: 40px; border: 1px solid rgba(255,255,255,0.2);">
                        ${recipientsHtml || '<span style="color: #666; font-style: italic;">لا توجد تفاصيل إضافية</span>'}
                    </div>
                </div>
            `;
        }

        let footerContent = '';
        if (isEditable) {
            footerContent = `
                <div style="${footerStyle}">
                    <div style="display:flex; gap:12px; align-items:center; margin-bottom:16px; flex-wrap: wrap;">
                        <div style="flex:1; min-width: 100px;">
                            <label style="${labelStyle}">اللون:</label>
                            <input id="loc-color" type="color" value="${item.color}" style="width:100%; height:36px; border:none; background:none; cursor:pointer;">
                        </div>
                        <div style="flex:1; min-width: 100px;">
                            <label style="${labelStyle}">الحجم (متر):</label>
                            <input id="loc-radius" type="number" value="${item.radius}" min="5" max="5000" step="5" style="${inputStyle}">
                        </div>
                    </div>
                    <div style="margin-bottom:20px;">
                        <label style="${labelStyle}">الشفافية: <span id="loc-opacity-val">${Math.round(item.fillOpacity * 100)}%</span></label>
                        <input id="loc-opacity" type="range" min="0" max="100" value="${Math.round(item.fillOpacity * 100)}" style="width:100%; accent-color: #4285f4;">
                    </div>
                    <div style="display:flex; gap:10px;">
                        <button id="loc-save" style="flex:2; background: linear-gradient(135deg, #4285f4, #3b71ca); color:white; border:none; border-radius: 12px; padding:12px; cursor:pointer; font-weight:bold; font-family: 'Tajawal', sans-serif; box-shadow: 0 4px 10px rgba(66, 133, 244, 0.3);">حفظ</button>
                        <button id="loc-delete" style="flex:1; background: rgba(233, 66, 53, 0.1); color:#d93025; border:1px solid rgba(233, 66, 53, 0.3); border-radius: 12px; padding:12px; cursor:pointer; font-weight:bold; font-family: 'Tajawal', sans-serif;">حذف</button>
                        <button id="loc-close" style="flex:1; background: rgba(0,0,0,0.05); color:#444; border:1px solid rgba(0,0,0,0.1); border-radius: 12px; padding:12px; cursor:pointer; font-weight:bold; font-family: 'Tajawal', sans-serif;">إغلاق</button>
                    </div>
                </div>
            `;
        }

        const html = `
        <div style="${cardStyle}" class="glass-card-content">
            <div style="${headerStyle}">
                <div style="display:flex; align-items:center; gap: 8px;">
                    <img src="img/logo.png" style="width: 32px; height: 32px; border-radius: 50%;">
                    <h3 style="margin:0; font-family: 'Tajawal', sans-serif; font-size: 16px; font-weight: 700;">${name}</h3>
                </div>
            </div>
            
            <div style="${bodyStyle}">
                ${bodyContent}
            </div>
            ${footerContent}
        </div>`;

        UI.openSharedInfoCard(html, item.marker.position, !hoverOnly);
        
        google.maps.event.addListenerOnce(UI.sharedInfoWindow, "domready", () => {
            this.attachCardEvents(item, hoverOnly);
        });
    }

    attachCardEvents(item, hoverOnly = false) {
        const closeBtn = document.getElementById("loc-close");
        if (closeBtn) closeBtn.addEventListener("click", () => { UI.forceCloseSharedInfoCard();});
        if (hoverOnly || !MAP.editMode) return;

        const saveBtn = document.getElementById("loc-save");
        const delBtn = document.getElementById("loc-delete");
        const nameEl = document.getElementById("loc-name");
        const recEl = document.getElementById("loc-rec");
        const colEl = document.getElementById("loc-color");
        const radEl = document.getElementById("loc-radius");
        const opEl = document.getElementById("loc-opacity");
        const opValEl = document.getElementById("loc-opacity-val");
        const iconTypeEl = document.getElementById("loc-icon-type");

        if (opEl) { opEl.addEventListener("input", () => { if(opValEl) opValEl.textContent = opEl.value + "%"; }); }

        if (saveBtn) {
            saveBtn.addEventListener("click", () => {
                item.recipients = recEl.value.split("\n").map(s => s.trim()).filter(Boolean);
                item.name = nameEl.value.trim();
                item.iconType = iconTypeEl.value;
                item.color = colEl.value;
                item.radius = Utils.clamp(+radEl.value, 5, 5000);
                item.fillOpacity = Utils.clamp(+opEl.value, 0, 100) / 100;

                item.circle.setOptions({
                    fillColor: item.color,
                    strokeColor: item.color,
                    radius: item.radius,
                    fillOpacity: item.fillOpacity
                });
                
                item.marker.content = this.buildMarkerContent(item);

                bus.emit("persist");
                UI.forceCloseSharedInfoCard();
                bus.emit("toast", "تم حفظ التعديلات");
            });
        }

        if (delBtn) {
            delBtn.addEventListener("click", () => {
                if (!confirm(`حذف "${item.name}"؟`))return;
                item.marker.map = null;
                item.circle.setMap(null);
                this.items = this.items.filter(x => x.id !== item.id);
                UI.forceCloseSharedInfoCard();
                bus.emit("persist");
                bus.emit("toast", "تم حذف الموقع");
            });
        }
    }

    exportState() {
        return this.items.map(it => ({
            id: it.id,
            name: it.name,
            lat: typeof it.marker.position.lat === 'function' ? it.marker.position.lat() : it.marker.position.lat,
            lng: typeof it.marker.position.lng === 'function' ? it.marker.position.lng() : it.marker.position.lng,
            color: it.color,
            radius: it.radius,
            fillOpacity: it.fillOpacity,
            iconType: it.iconType,
            usePin: it.usePin,
            showCircle: it.showCircle,
            recipients: it.recipients
        }));
    }

    applyState(state) {
        if (!state || !state.locations) return;
        this.items.forEach(it => {
            it.marker.map = null;
            it.circle.setMap(null);
        });
        this.items = [];
        state.locations.forEach(loc => this.addItem(loc));
    }
}

const LOCATIONS = new LocationManager();

/*
============================================================
   RouteManager
— إدارة المسارات + بطاقات Glass (مع إدارة الأرقام)
  ============================================================ */
class RouteManager {

    constructor() {
        this.routes = [];
        this.map = null;
        this.shareMode = false;
        this.editMode = true;
        this.directionsService = null;
        this.activeRouteIndex = -1;
        this.showNumbers = true; // التحكم في عرض أرقام المسارات
        this.drawingMode = "auto";
        this.routeRequestSerial = 0;
        this.allStopMarkers = new Set();

        bus.on("map:ready", map => {
            this.map = map;
            this.shareMode = MAP.shareMode;
            this.editMode = MAP.editMode;
            this.showNumbers = !this.shareMode; // إخفاء الأرقام في وضع المشاركة
            this.onMapReady();
        });

        bus.on("state:load", st => this.applyState(st));
        bus.on("state:save", () => this.exportState());
    }

    onMapReady() {
        this.map.addListener("click", e => {
            if (!MAP.modeRouteAdd || this.shareMode) return;
            if (this.activeRouteIndex === -1) this.createNewRoute();
            this.addPointToRoute(this.activeRouteIndex, e.latLng);
        });
    }

    startNewRouteSequence(mode = "auto") {
        this.activeRouteIndex = -1;
        this.drawingMode = mode === "manual" ? "manual" : "auto";
        MAP.modeRouteAdd = true;
    }

    chooseDrawingMode() {
        if (MAP.shareMode || !MAP.editMode) return;
        const existing = document.getElementById("route-mode-dialog");
        if (existing) existing.remove();
        const overlay = document.createElement("div");
        overlay.id = "route-mode-dialog";
        overlay.style.cssText = "position:fixed;inset:0;z-index:20000;background:rgba(0,0,0,.48);display:flex;align-items:center;justify-content:center;padding:16px;direction:rtl;font-family:Tajawal,Cairo,sans-serif";
        const card = document.createElement("div");
        card.style.cssText = "background:#fff;color:#222;border-radius:16px;padding:24px;width:min(420px,100%);box-shadow:0 12px 32px #0003";
        const heading = document.createElement("h3");
        heading.textContent = "اختر طريقة رسم المسار";
        heading.style.margin = "0 0 16px";
        card.appendChild(heading);
        for (const [mode, title, detail] of [
            ["auto", "مسار تلقائي عبر الطرق", "يتبع الشوارع باستخدام خدمة التوجيه؛ لا يرسم خطًا عشوائيًا عند الفشل."],
            ["manual", "مسار يدوي (رسم حر)", "يصل النقاط التي تحددها دون تغيير مسارها."]
        ]) {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.style.cssText = "display:block;width:100%;text-align:right;border:1px solid #d8dce4;background:#f8fafc;border-radius:10px;padding:12px;margin:10px 0;cursor:pointer;font:inherit";
            const strong = document.createElement("strong"); strong.textContent = title;
            const small = document.createElement("div"); small.textContent = detail; small.style.cssText = "font-size:13px;color:#555;margin-top:5px";
            btn.append(strong, small);
            btn.addEventListener("click", () => {
                overlay.remove();
                UI.setActiveMode("route");
                this.drawingMode = mode;
                bus.emit("toast", mode === "manual" ? "الرسم اليدوي: اضغط لتحديد نقاط المسار" : "المسار التلقائي: حدد نقطتين أو أكثر على الطرق");
            });
            card.appendChild(btn);
        }
        // إدارة المسارات داخل نافذة «مسار» فقط، وتظهر عند وجود مسار مرسوم.
        if (this.routes.length > 0) {
            const separator = document.createElement("hr");
            separator.style.cssText = "border:0;border-top:1px solid #e5e7eb;margin:18px 0";
            card.appendChild(separator);
            const manageTitle = document.createElement("h4");
            manageTitle.textContent = "إدارة المسارات المرسومة";
            manageTitle.style.cssText = "margin:0 0 10px;font-size:15px";
            card.appendChild(manageTitle);
            this.routes.forEach((route) => {
                const row = document.createElement("div");
                row.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:8px;margin:8px 0;flex-wrap:wrap";
                const label = document.createElement("span");
                label.textContent = `المسار ${route.routeNumber} (${route.points.length} نقاط)`;
                label.style.cssText = "font-size:13px;font-weight:bold";
                const actions = document.createElement("div");
                actions.style.cssText = "display:flex;gap:6px;flex-wrap:wrap";
                const pointsButton = document.createElement("button");
                pointsButton.type = "button";
                pointsButton.textContent = "حذف نقاط";
                pointsButton.disabled = route.points.length === 0;
                pointsButton.style.cssText = "border:1px solid #d1d5db;background:#fff;border-radius:8px;padding:7px 10px;cursor:pointer;font:inherit;font-size:12px";
                pointsButton.addEventListener("click", () => {
                    overlay.remove();
                    this.showDeletePointsDialog(route.id);
                });
                const deleteButton = document.createElement("button");
                deleteButton.type = "button";
                deleteButton.textContent = "حذف المسار كاملًا";
                deleteButton.style.cssText = "border:1px solid #fecaca;background:#fff1f2;color:#b91c1c;border-radius:8px;padding:7px 10px;cursor:pointer;font:inherit;font-size:12px";
                deleteButton.addEventListener("click", () => {
                    if (!confirm(`حذف المسار ${route.routeNumber} بالكامل؟`)) return;
                    const index = this.routes.findIndex(r => r.id === route.id);
                    if (index < 0) return;
                    this.removeRoute(index);
                    overlay.remove();
                    bus.emit("toast", "تم حذف المسار بالكامل");
                    if (this.routes.length) this.chooseDrawingMode();
                });
                actions.append(pointsButton, deleteButton);
                row.append(label, actions);
                card.appendChild(row);
            });
        }
        const cancel = document.createElement("button"); cancel.textContent = "إلغاء";
        cancel.style.cssText = "border:0;background:transparent;padding:10px;cursor:pointer;font:inherit";
        cancel.addEventListener("click", () => overlay.remove()); card.appendChild(cancel);
        overlay.appendChild(card);
        overlay.addEventListener("click", e => { if (e.target === overlay) overlay.remove(); });
        document.body.appendChild(overlay);
    }
    
    showDeletePointsDialog(routeId) {
        if (MAP.shareMode || !MAP.editMode) return;
        const route = this.routes.find(r => r.id === routeId);
        if (!route) return;
        const overlay = document.createElement("div");
        overlay.style.cssText = "position:fixed;inset:0;z-index:20001;background:rgba(0,0,0,.48);display:flex;align-items:center;justify-content:center;padding:16px;direction:rtl;font-family:Tajawal,Cairo,sans-serif";
        const card = document.createElement("div");
        card.style.cssText = "background:white;color:#222;border-radius:16px;padding:22px;width:min(420px,100%);max-height:80vh;overflow:auto;box-shadow:0 12px 32px #0003";
        const title = document.createElement("h3");
        title.textContent = `حذف نقاط المسار ${route.routeNumber}`;
        title.style.margin = "0 0 8px";
        const hint = document.createElement("p");
        hint.textContent = "اختر النقاط المراد حذفها حسب أرقامها، ثم اضغط حذف المحدد.";
        hint.style.cssText = "font-size:13px;color:#555";
        const options = document.createElement("div");
        options.style.cssText = "display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:16px 0";
        route.points.forEach((_, index) => {
            const label = document.createElement("label");
            label.style.cssText = "display:flex;align-items:center;gap:6px;border:1px solid #ddd;border-radius:8px;padding:9px;cursor:pointer";
            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.value = String(index);
            label.append(checkbox, document.createTextNode(`نقطة ${this.getStopLabel(route, index)}`));
            options.appendChild(label);
        });
        const actions = document.createElement("div");
        actions.style.cssText = "display:flex;gap:10px;justify-content:flex-end";
        const cancel = document.createElement("button");
        cancel.textContent = "إلغاء";
        const submit = document.createElement("button");
        submit.textContent = "حذف المحدد";
        submit.style.cssText = "background:#b91c1c;color:white;border:0;border-radius:8px;padding:10px 14px;cursor:pointer";
        cancel.style.cssText = "background:#f3f4f6;border:0;border-radius:8px;padding:10px 14px;cursor:pointer";
        cancel.addEventListener("click", () => { overlay.remove(); this.chooseDrawingMode(); });
        submit.addEventListener("click", () => {
            const indices = Array.from(options.querySelectorAll('input:checked')).map(input => Number(input.value)).sort((a,b) => b-a);
            if (!indices.length) { bus.emit("toast", "اختر نقطة واحدة على الأقل"); return; }
            if (indices.length === route.points.length && !confirm("سيؤدي هذا إلى حذف المسار بالكامل. متابعة؟")) return;
            const currentIndex = this.routes.findIndex(r => r.id === routeId);
            if (currentIndex < 0) { overlay.remove(); return; }
            indices.forEach(i => {
                const updatedIndex = this.routes.findIndex(r => r.id === routeId);
                if (updatedIndex >= 0) this.removePoint(updatedIndex, i);
            });
            overlay.remove();
            bus.emit("toast", "تم حذف النقاط المحددة وإعادة ترقيم الباقي");
            if (this.routes.length) this.chooseDrawingMode();
        });
        actions.append(cancel, submit);
        card.append(title, hint, options, actions);
        overlay.appendChild(card);
        overlay.addEventListener("click", e => { if (e.target === overlay) { overlay.remove(); this.chooseDrawingMode(); } });
        document.body.appendChild(overlay);
    }

    finishCurrentRoute() {
        if (this.activeRouteIndex === -1) return;
        const rt = this.routes[this.activeRouteIndex];
        rt.stops.forEach(s => s.map = null);
        if (rt.points.length >= 2) {
            if (rt.mode === "manual" || rt.overview) this.renderRoute(this.activeRouteIndex);
            else bus.emit("toast", "جاري انتظار حساب الطريق؛ إذا فشل الحساب لن يظهر خط مستقيم.");
            bus.emit("persist");
        } else {
            rt.stops.forEach(stop => this.disposeStopMarker(stop));
            this.routes.pop();
            this.refreshGlobalPointNumbers();
        }
        this.activeRouteIndex = -1;
        MAP.modeRouteAdd = false;
        MAP.setCursor("grab");
    }

    createNewRoute() {
        const route = { 
            id: "rt" + Date.now(), 
            points: [], 
            color: "#3344ff", 
            weight: 6, 
            opacity: 0.95, 
            distance: 0, 
            duration: 0, 
            overview: null, 
            poly: null, 
            stops: [], 
            notes: "",
            routeNumber: this.routes.length + 1, // إضافة رقم المسار
            mode: this.drawingMode,
            requestVersion: 0
        };
        this.routes.push(route);
        this.activeRouteIndex = this.routes.length - 1;
        return route;
    }

    addPointToRoute(routeIndex, latLng) {
        const rt = this.routes[routeIndex];
        rt.points.push(latLng);
        const stop = this.createStopMarker(latLng, routeIndex, rt.points.length - 1);
        rt.stops.push(stop);
        this.refreshGlobalPointNumbers();
        if (rt.points.length >= 2) this.requestRoute(routeIndex);
        else bus.emit("persist");
    }

    createStopMarker(pos, routeIndex, idx) {
        const rt = this.routes[routeIndex];
        const el = document.createElement("div");
        
        // نُبقي أرقام نقاط المسار في وضع التحرير؛ رابط المشاركة يحدد إظهارها أو إخفاءها.
        const displayNumber = this.getStopLabel(rt, idx);
        
        el.style.cssText = `
            width:26px; 
            height:26px; 
            background:white; 
            border-radius:50%; 
            border:3px solid ${rt.color}; 
            display:flex; 
            align-items:center; 
            justify-content:center; 
            font-size:11px; 
            font-weight:bold; 
            z-index:101;
            font-family: 'Tajawal', sans-serif;
            box-shadow: 0 2px 6px rgba(0,0,0,0.2);
        `;
        el.textContent = displayNumber;
        
        const marker = new google.maps.marker.AdvancedMarkerElement({ 
            position: pos, 
            map: this.showNumbers ? this.map : null, 
            content: el, 
            gmpDraggable: !this.shareMode 
        });
        this.allStopMarkers.add(marker);
        marker.addListener("dragend", () => {
            const currentIndex = this.routes.indexOf(rt);
            if (currentIndex < 0 || !rt.stops.includes(marker)) return;
            const currentPointIndex = rt.stops.indexOf(marker);
            rt.points[currentPointIndex] = marker.position;
            this.requestRoute(currentIndex); 
            bus.emit("persist"); 
        });
        marker.addListener("contextmenu", (event) => {
            if (MAP.shareMode || !MAP.editMode) return;
            const currentIndex = this.routes.indexOf(rt);
            if (currentIndex < 0 || !rt.stops.includes(marker)) return;
            this.showRouteContextMenu(currentIndex, rt.stops.indexOf(marker), event?.domEvent || event);
        });
        return marker;
    }

    removePoint(routeIndex, idx) {
        if (MAP.shareMode || !MAP.editMode) return;
        const rt = this.routes[routeIndex];
        if (!rt || idx < 0 || idx >= rt.points.length) return;
        // إزالة جميع علامات النقاط وإعادة إنشائها حتى تشير أحداث السحب والحذف
        // إلى الفهارس الصحيحة بعد تغيير ترقيم النقاط.
        rt.requestVersion = (rt.requestVersion || 0) + 1;
        rt.stops.forEach(stop => this.disposeStopMarker(stop));
        rt.stops = [];
        rt.points.splice(idx, 1);
        if (rt.points.length === 0) {
            this.removeRoute(routeIndex);
            return;
        }
        rt.stops = rt.points.map((point, i) => this.createStopMarker(point, routeIndex, i));
        this.refreshGlobalPointNumbers();
        if (rt.points.length >= 2) this.requestRoute(routeIndex);
        else this.clearRoute(routeIndex);
        bus.emit("persist");
    }

    // دالة جديدة لحذف مسار بالرقم
    deleteRouteByNumber(routeNumber) {
        const routeIndex = this.routes.findIndex(rt => rt.routeNumber === routeNumber);
        if (routeIndex !== -1) {
            this.removeRoute(routeIndex);
            bus.emit("toast", `تم حذف المسار رقم ${routeNumber}`);
            return true;
        }
        return false;
    }

    // الحصول على قائمة أرقام المسارات
    getRouteNumbers() {
        return this.routes.map(rt => rt.routeNumber);
    }

    removeRoute(routeIndex) {
        if (MAP.shareMode || !MAP.editMode) return;
        const rt = this.routes[routeIndex];
        if (!rt) return;
        rt.requestVersion = (rt.requestVersion || 0) + 1;
        if (rt.poly) rt.poly.setMap(null);
        rt.stops.forEach(s => this.disposeStopMarker(s));
        rt.stops = [];
        this.routes.splice(routeIndex, 1);
        
        // إعادة ترقيم المسارات المتبقية
        this.routes.forEach((route, index) => {
            route.routeNumber = index + 1;
            // تحديث أرقام النقاط
            route.stops.forEach((stop, stopIndex) => {
                stop.content.textContent = this.getStopLabel(route, stopIndex);
            });
        });
        
        this.activeRouteIndex = -1;
        this.cleanupOrphanStopMarkers();
        this.refreshGlobalPointNumbers();
        UI.forceCloseSharedInfoCard();
        bus.emit("persist");
    }

    clearRoute(routeIndex) {
        const rt = this.routes[routeIndex];
        if (rt.poly) rt.poly.setMap(null);
        rt.poly = null; rt.overview = null;
        rt.distance = 0; rt.duration = 0;
    }

    requestRoute(routeIndex) {
        const rt = this.routes[routeIndex];
        if (!rt || rt.points.length < 2) return;
        const version = rt.requestVersion = (rt.requestVersion || 0) + 1;
        // Manual paths must never be snapped to roads.
        if (rt.mode === "manual") {
            rt.overview = null;
            rt.duration = 0;
            rt.distance = 0;
            for (let i = 1; i < rt.points.length; i++) {
                rt.distance += google.maps.geometry.spherical.computeDistanceBetween(
                    new google.maps.LatLng(rt.points[i - 1]),
                    new google.maps.LatLng(rt.points[i])
                );
            }
            this.renderRoute(routeIndex);
            bus.emit("persist");
            return;
        }
        // Hide stale geometry while the directions service is working.
        rt.overview = null;
        rt.distance = 0;
        rt.duration = 0;
        if (rt.poly) { rt.poly.setMap(null); rt.poly = null; }
        if (!this.directionsService) this.directionsService = new google.maps.DirectionsService();
        const pts = rt.points;
        const req = {
            origin: pts[0], destination: pts[pts.length - 1],
            travelMode: google.maps.TravelMode.DRIVING,
            ...(pts.length > 2 ? { waypoints: pts.slice(1, -1).map(p => ({ location: p, stopover: true })) } : {})
        };
        this.directionsService.route(req, (res, status) => {
            if (!this.routes.includes(rt) || rt.requestVersion !== version) return;
            if (status !== "OK" || !res?.routes?.[0]) {
                bus.emit("toast", "تعذر حساب المسار عبر الطرق (" + status + "). تحقق من تفعيل Directions API أو استخدم الرسم اليدوي.");
                return;
            }
            const r = res.routes[0];
            // Save the actual returned road geometry, not a straight line between stops.
            const encoded = typeof r.overview_polyline === "string"
                ? r.overview_polyline : r.overview_polyline?.points;
            if (!encoded && !r.overview_path?.length) {
                bus.emit("toast", "لم تصل بيانات الطريق من خدمة التوجيه.");
                return;
            }
            rt.overview = encoded || google.maps.geometry.encoding.encodePath(r.overview_path);
            rt.distance = r.legs.reduce((sum, leg) => sum + (leg.distance?.value || 0), 0);
            rt.duration = r.legs.reduce((sum, leg) => sum + (leg.duration?.value || 0), 0);
            this.renderRoute(this.routes.indexOf(rt));
            bus.emit("persist");
        });
    }

    renderRoute(routeIndex) {
        const rt = this.routes[routeIndex];
        if (rt.poly) rt.poly.setMap(null);
        if (rt.mode !== "manual" && !rt.overview) return;
        const path = rt.mode === "manual" ? rt.points : google.maps.geometry.encoding.decodePath(rt.overview);
        rt.poly = new google.maps.Polyline({ 
            map: this.map, 
            path, 
            strokeColor: rt.color, 
            strokeWeight: rt.weight, 
            strokeOpacity: rt.opacity, 
            zIndex: 10 
        });
        
        rt.poly.addListener("mouseover", (e) => { 
            if (!UI.infoWindowPinned) this.openRouteCard(routeIndex, true, e.latLng);
        });
        rt.poly.addListener("mouseout", () => { UI.closeSharedInfoCard();});
        rt.poly.addListener("click", (e) => this.openRouteCard(this.routes.indexOf(rt), false, e.latLng));
        rt.poly.addListener("contextmenu", (e) => {
            if (MAP.shareMode || !MAP.editMode) return;
            const currentIndex = this.routes.indexOf(rt);
            if (currentIndex >= 0) this.showRouteContextMenu(currentIndex, null, e.domEvent || e);
        });
    }

    openRouteCard(routeIndex, hoverOnly = false, position = null) {
        const rt = this.routes[routeIndex];
        const dist = Utils.formatDistance(rt.distance);
        const dur = Utils.formatDuration(rt.duration);
        const notes = Utils.escapeHTML(rt.notes || "");
        const isEditable = !hoverOnly && MAP.editMode;

        const cardStyle = `
            font-family: 'Tajawal', 'Cairo', sans-serif;
            background: rgba(30, 30, 30, 0.5); 
            backdrop-filter: blur(12px) saturate(1.5);
            -webkit-backdrop-filter: blur(12px) saturate(1.5);
            border-radius: 16px;
            border: none;
            padding: 0;
            color: #f0f0f0;
            direction: rtl;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
            width: 400px;
            max-width: 95vw;
            max-height: 70vh;
            overflow-y: auto;
            overflow-x: hidden;
            -webkit-overflow-scrolling: touch;
        `;
        const headerStyle = `display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: rgba(255, 255, 255, 0.08); border-bottom: 1px solid rgba(255, 255, 255, 0.05); position: sticky; top: 0; z-index: 10;`;
        const bodyStyle = `padding: 16px;`;
        const footerStyle = `padding: 10px 16px; background: rgba(255, 255, 255, 0.08); border-top: 1px solid rgba(255, 255, 255, 0.05); position: sticky; bottom: 0;`;

        const html = `
        <div style="${cardStyle}" class="glass-card-content">
            <div style="${headerStyle}">
                <div style="display:flex;align-items:center;gap:8px;">
                    <img src="img/logo.png" style="width: 30px; height: 30px; border-radius: 6px;">
                    <h3 style="margin:0; font-family: 'Tajawal', sans-serif; font-size: 17px; font-weight: 700;">مسار رقم ${rt.routeNumber}</h3>
                </div>
            </div>
            <div style="${bodyStyle}">
                <div style="display: flex; justify-content: space-between; margin-bottom: 14px; font-size: 15px; font-family: 'Tajawal', sans-serif;">
                    <span><b>المسافة:</b> ${dist}</span>
                    <span><b>الوقت:</b> ${dur}</span>
                </div>
                ${isEditable ? `
                    <div style="display:flex; gap:10px; align-items:center; margin-bottom:14px; flex-wrap: wrap;">
                        <div style="flex:1; min-width: 120px;"><label style="font-size:12px; display:block; margin-bottom:4px; font-family: 'Tajawal', sans-serif;">اللون:</label><input id="route-color" type="color" value="${rt.color}" style="width:100%;height:30px;border:none;border-radius:6px;cursor:pointer;"></div>
                        <div style="flex:1; min-width: 120px;"><label style="font-size:12px; display:block; margin-bottom:4px; font-family: 'Tajawal', sans-serif;">الحجم:</label><input id="route-weight" type="number" value="${rt.weight}" min="1" max="20" style="width:100%;padding:7px;border-radius:6px;border:1px solid #ddd;box-sizing:border-box;color:#333;"></div>
                    </div>
                    <div style="margin-bottom:14px;">
                        <label style="font-size:12px; display:block; margin-bottom:4px; font-family: 'Tajawal', sans-serif;">شفافية الخط: <span id="route-opacity-val">${Math.round(rt.opacity * 100)}%</span></label>
                        <input id="route-opacity" type="range" min="0" max="100" value="${Math.round(rt.opacity * 100)}" style="width:100%;">
                    </div>
                    <div style="margin-bottom:14px;">
                        <label style="font-size:12px; display:block; margin-bottom:4px; font-family: 'Tajawal', sans-serif;">ملاحظات:</label>
                        <textarea id="route-notes" rows="2" style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid #ddd; resize: none; box-sizing: border-box; font-family: 'Tajawal', sans-serif; font-size: 14px; color: #333;">${notes}</textarea>
                    </div>
                    <div style="margin-bottom:14px; background: rgba(255,255,255,0.1); padding: 12px; border-radius: 8px;">
                        <label style="font-size:12px; display:block; margin-bottom:8px; font-family: 'Tajawal', sans-serif; font-weight: bold;">إدارة المسارات:</label>
                        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                            <button id="delete-route-btn" style="padding: 6px 12px; border: none; border-radius: 6px; background: #e94235; color: white; cursor: pointer; font-family: 'Tajawal', sans-serif; font-size: 13px;">
                                <i class="material-icons" style="font-size: 16px; vertical-align: middle; margin-left: 4px;">delete</i>
                                حذف هذا المسار
                            </button>
                        </div>
                    </div>
                ` : `
                    <p style="margin: 0 0 8px 0; font-size: 14px; color: #ccc; font-family: 'Tajawal', sans-serif;">ملاحظات:</p>
                    <div style="background: rgba(52, 168, 83, 0.1); padding: 10px; border-radius: 8px; min-height: 40px; font-size: 14px; line-height: 1.5; font-family: 'Tajawal', sans-serif;">
                        ${notes || '<span style="color: #888;">لا توجد ملاحظات</span>'}
                    </div>
                `}
            </div>
            ${isEditable ? `
                <div style="${footerStyle}">
                    <div style="display:flex;gap:8px; flex-wrap: wrap;">
                        <button id="route-save" style="flex:2;background:#4285f4;color:white;border:none;border-radius:10px;padding:10px;cursor:pointer;font-weight:600; font-family: 'Tajawal', sans-serif; min-width: 90px; font-size: 14px;">حفظ</button>
                        <button id="route-close" style="flex:1;background:rgba(255,255,255,0.1);color:#f0f0f0;border:1px solid rgba(255,255,255,0.2);border-radius:10px;padding:10px;cursor:pointer;font-weight:600; font-family: 'Tajawal', sans-serif; min-width: 70px; font-size: 14px;">إغلاق</button>
                    </div>
                </div>
            ` : ''}
        </div>`;

        const cardPosition = position || this.getRouteCenter(rt);
        UI.openSharedInfoCard(html, cardPosition, !hoverOnly);
        google.maps.event.addListenerOnce(UI.sharedInfoWindow, "domready", () => this.attachRouteCardEvents(routeIndex, hoverOnly));
    }

    getRouteCenter(rt) {
        const path = rt.poly.getPath();
        const bounds = new google.maps.LatLngBounds();
        for (let i = 0; i < path.getLength(); i++) { bounds.extend(path.getAt(i)); }
        return bounds.getCenter();
    }

    attachRouteCardEvents(routeIndex, hoverOnly) {
        if (hoverOnly || !MAP.editMode) return;
        const rt = this.routes[routeIndex];
        const saveBtn = document.getElementById("route-save"); 
        const closeBtn = document.getElementById("route-close");
        const deleteBtn = document.getElementById("delete-route-btn");
        const colEl = document.getElementById("route-color"); 
        const weightEl = document.getElementById("route-weight");
        const opEl = document.getElementById("route-opacity"); 
        const opValEl = document.getElementById("route-opacity-val"); 
        const notesEl = document.getElementById("route-notes");
        
        if (opEl) { opEl.addEventListener("input", () => { if (opValEl) opValEl.textContent = opEl.value + "%"; }); }
        
        if (deleteBtn) {
            deleteBtn.addEventListener("click", () => {
                // إصلاح: عكس الشرط لحذف المسار عند تأكيد المستخدم
                if (confirm(`هل أنت متأكد من حذف المسار رقم ${rt.routeNumber}؟`)) {
                    this.removeRoute(routeIndex);
                    bus.emit("toast", "تم حذف المسار");
                }
            });
        }
        
        if (saveBtn) {
            saveBtn.addEventListener("click", () => {
                rt.color = colEl.value; 
                rt.weight = Utils.clamp(+weightEl.value, 1, 20); 
                rt.opacity = Utils.clamp(+opEl.value, 0, 100) / 100; 
                rt.notes = notesEl.value.trim();
                rt.poly.setOptions({ 
                    strokeColor: rt.color, 
                    strokeWeight: rt.weight, 
                    strokeOpacity: rt.opacity 
                });
                bus.emit("persist"); 
                UI.forceCloseSharedInfoCard(); 
                bus.emit("toast", "تم حفظ تعديلات المسار");
            });
        }
        if (closeBtn) { 
            closeBtn.addEventListener("click", () => { 
                UI.forceCloseSharedInfoCard(); 
            }); 
        }
    }
   
    exportState() {
        return this.routes.map(rt => ({
            id: rt.id, 
            routeNumber: rt.routeNumber,
            color: rt.color, 
            weight: rt.weight, 
            opacity: rt.opacity, 
            distance: rt.distance, 
            duration: rt.duration, 
            overview: rt.overview,
            mode: rt.mode || "auto",
            notes: rt.notes,
            points: rt.points.map(p => ({ 
                lat: typeof p.lat === 'function' ? p.lat() : p.lat, 
                lng: typeof p.lng === 'function' ? p.lng() : p.lng 
            }))
        }));
    }

    applyState(state) {
        if (!state || !state.routes) return;
        this.routes.forEach(rt => { 
            if (rt.poly) rt.poly.setMap(null); 
            rt.stops.forEach(s => this.disposeStopMarker(s)); 
        });
        this.routes = [];
        this.cleanupOrphanStopMarkers();
        state.routes.forEach(rt => {
            const newRoute = { 
                id: rt.id, 
                routeNumber: rt.routeNumber || (this.routes.length + 1),
                color: rt.color, 
                weight: rt.weight, 
                opacity: rt.opacity, 
                distance: rt.distance, 
                duration: rt.duration, 
                overview: rt.overview,
                mode: rt.mode || "auto",
                requestVersion: 0,
                notes: rt.notes || "", 
                points: rt.points.map(p => new google.maps.LatLng(p.lat, p.lng)), 
                poly: null, 
                stops: [] 
            };
            this.routes.push(newRoute);
            newRoute.points.forEach((pt, i) => { 
                const stop = this.createStopMarker(pt, this.routes.length - 1, i); 
                newRoute.stops.push(stop); 
            });
            if (newRoute.mode === "manual" || newRoute.overview) this.renderRoute(this.routes.length - 1);
        });
        this.refreshGlobalPointNumbers();
    }

    // إزالة علامة النقطة من الخريطة ومن سجل العلامات مع تعطيل أحداثها.
    disposeStopMarker(marker) {
        if (!marker) return;
        try { google.maps.event.clearInstanceListeners(marker); } catch (_) {}
        marker.map = null;
        this.allStopMarkers.delete(marker);
    }

    // إزالة أي رقم متبقٍ لا يرتبط بنقطة موجودة فعليًا.
    cleanupOrphanStopMarkers() {
        const active = new Set(this.routes.flatMap(route => route.stops));
        for (const marker of this.allStopMarkers) {
            if (!active.has(marker)) this.disposeStopMarker(marker);
        }
    }

    // النص المستخدم عند عرض أرقام النقاط: المحافظة على طريقة الترقيم الحالية.
    getStopLabel(route, index) {
        let number = 1;
        for (const rt of this.routes) {
            if (rt === route) return String(number + index);
            number += rt.points.length;
        }
        return String(index + 1);
    }

    // أرقام موحّدة لجميع نقاط المسارات، سواء في التحرير أو رابط المشاركة.
    refreshGlobalPointNumbers() {
        let next = 1;
        this.routes.forEach(route => {
            route.stops.forEach(stop => {
                if (stop?.content) stop.content.textContent = String(next);
                next++;
            });
        });
    }

    // قائمة زر الماوس الأيمن للمسار أو لنقطة معينة.
    showRouteContextMenu(routeIndex, pointIndex = null, event = null) {
        if (MAP.shareMode || !MAP.editMode) return;
        const route = this.routes[routeIndex];
        if (!route) return;
        if (event?.preventDefault) event.preventDefault();
        document.getElementById('security-route-context-menu')?.remove();
        const menu = document.createElement('div');
        menu.id = 'security-route-context-menu';
        menu.style.cssText = 'position:fixed;z-index:999999;background:white;color:#222;border:1px solid #ddd;border-radius:12px;box-shadow:0 10px 30px #0003;padding:7px;min-width:210px;direction:rtl;font-family:Tajawal,Cairo,sans-serif';
        const add = (label, action, danger = false) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = label;
            button.style.cssText = `display:block;width:100%;padding:11px;text-align:right;background:transparent;border:0;border-radius:7px;cursor:pointer;font:inherit;color:${danger ? '#b91c1c' : '#222'}`;
            button.addEventListener('click', () => { menu.remove(); action(); });
            menu.appendChild(button);
        };
        const routeId = route.id;
        const current = () => this.routes.findIndex(r => r.id === routeId);
        if (pointIndex !== null && pointIndex >= 0 && pointIndex < route.points.length) {
            add(`حذف النقطة رقم ${this.getStopLabel(route, pointIndex)}`, () => {
                const i = current();
                if (i >= 0 && confirm('هل تريد حذف هذه النقطة؟')) this.removePoint(i, pointIndex);
            }, true);
        }
        add('اختيار نقاط محددة للحذف', () => this.showDeletePointsDialog(routeId));
        add('حذف المسار المحدد', () => {
            const i = current();
            if (i >= 0 && confirm('هل تريد حذف هذا المسار بالكامل؟')) this.removeRoute(i);
        }, true);
        add('حذف جميع المسارات', () => {
            if (!confirm('هل تريد حذف جميع المسارات المرسومة؟')) return;
            while (this.routes.length) this.removeRoute(this.routes.length - 1);
        }, true);
        document.body.appendChild(menu);
        const x = event?.clientX ?? event?.domEvent?.clientX ?? window.innerWidth / 2;
        const y = event?.clientY ?? event?.domEvent?.clientY ?? window.innerHeight / 2;
        menu.style.left = Math.max(8, Math.min(x, window.innerWidth - menu.offsetWidth - 8)) + 'px';
        menu.style.top = Math.max(8, Math.min(y, window.innerHeight - menu.offsetHeight - 8)) + 'px';
        const dismiss = e => {
            if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('pointerdown', dismiss, true); }
        };
        setTimeout(() => document.addEventListener('pointerdown', dismiss, true), 0);
    }

    // إخفاء/إظهار علامـات الترقيم في الرابط، دون حذف النقاط أو خطوط المسارات.
    setRouteNumberVisibility(visible) {
        this.showNumbers = this.shareMode ? Boolean(visible) : true;
        this.routes.forEach(route => {
            route.stops.forEach((stop, index) => {
                stop.content.textContent = this.getStopLabel(route, index);
                stop.map = this.showNumbers ? this.map : null;
            });
        });
    }

    updateNumbersVisibility() {
        this.setRouteNumberVisibility(this.showNumbers);
    }
}

const ROUTES = new RouteManager();

/*
============================================================
   PolygonManager
— إدارة المضلعات + بطاقات Glass
(مُحسنة للتمرير وبدون حدود + حذف النقاط + إصلاح منطق الإنهاء)
  ============================================================ */
class PolygonManager {
    constructor() {
        this.polygons = []; this.map = null; this.shareMode = false; this.editMode = true; this.activePolygonIndex = -1; this.isEditing = false; this.editingPolygonIndex = -1;
        bus.on("map:ready", map => { this.map = map; this.shareMode = MAP.shareMode; this.editMode = MAP.editMode; this.onMapReady();});
        bus.on("state:load", st => this.applyState(st)); bus.on("state:save", () => this.exportState()); 
    }
    
    onMapReady() {
        this.map.addListener("bounds_changed", () => this.outsideShade?.draw()); 
        this.map.addListener("click", e => { 
            if (this.isEditing) {
                if (this.addingVertices && !this.shareMode && MAP.editMode) {
                    const index = this.editingPolygonIndex;
                    this.insertVertex(this.polygons[index], index, e.latLng);
                }
                return;
            }
            // التحقق الصارم: لن يتم الرسم إلا إذا كانت أيقونة المضلع مفعلة (modePolygonAdd = true)
            if (!MAP.modePolygonAdd || this.shareMode) return; 
            
            if (this.activePolygonIndex === -1) this.createNewPolygon(); 
            this.addPointToPolygon(this.activePolygonIndex, e.latLng); 
        }); 
    }

    updateOutsideShade() {
        const selected = this.polygons.find(p => p.outsideShade && p.polygon);
        if (!selected) {
            this.outsideShade?.setMap(null);
            this.outsideShade = null;
            return;
        }
        if (!this.outsideShade) {
            const overlay = new google.maps.OverlayView();
            this.outsideShade = overlay;
            overlay.onAdd = () => {
                const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
                svg.id = "polygon-outside-shade";
                svg.setAttribute("aria-hidden", "true");
                svg.style.cssText = "position:absolute;pointer-events:none;overflow:hidden";
                const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
                path.setAttribute("fill-rule", "evenodd");
                svg.appendChild(path);
                overlay.shadeSvg = svg;
                overlay.shadePath = path;
                overlay.getPanes().overlayLayer.appendChild(svg);
            };
            overlay.draw = () => {
                const poly = this.polygons.find(p => p.outsideShade && p.polygon);
                const projection = overlay.getProjection();
                if (!poly || !projection || !overlay.shadeSvg || !this.map.getCenter()) return;
                const center = projection.fromLatLngToDivPixel(this.map.getCenter());
                if (!center) return;
                const width = Math.max(this.map.getDiv().clientWidth, 1) * 3;
                const height = Math.max(this.map.getDiv().clientHeight, 1) * 3;
                const left = center.x - width / 2, top = center.y - height / 2;
                const worldWidth = 256 * 2 ** this.map.getZoom();
                let previousX = center.x;
                const points = poly.points.map(point => {
                    const pixel = projection.fromLatLngToDivPixel(point);
                    const x = pixel.x + Math.round((previousX - pixel.x) / worldWidth) * worldWidth;
                    previousX = x;
                    return [x - left, pixel.y - top];
                });
                const hole = points.map((p, i) => (i ? "L" : "M") + p[0] + " " + p[1]).join(" ") + " Z";
                overlay.shadeSvg.style.left = left + "px";
                overlay.shadeSvg.style.top = top + "px";
                overlay.shadeSvg.setAttribute("width", width);
                overlay.shadeSvg.setAttribute("height", height);
                overlay.shadePath.setAttribute("d", "M0 0H" + width + "V" + height + "H0Z " + hole);
                overlay.shadePath.setAttribute("fill", poly.shadeColor || "#000000");
                overlay.shadePath.setAttribute("fill-opacity", poly.shadeOpacity ?? 0.6);
            };
            overlay.onRemove = () => { overlay.shadeSvg?.remove(); overlay.shadeSvg = null; };
            overlay.setMap(this.map);
        } else {
            this.outsideShade.draw();
        }
    }

    startPolygonSequence() { this.activePolygonIndex = -1; }
    
    finishCurrentPolygon() {
        if (this.activePolygonIndex === -1) return;
        const poly = this.polygons[this.activePolygonIndex];
        if (poly.activePolyline) poly.activePolyline.setMap(null);
        poly.markers.forEach(m => m.map = null);
        if (poly.points.length >= 3) {
            poly.polygon = new google.maps.Polygon({ paths: poly.points, map: this.map, strokeColor: poly.color, strokeOpacity: poly.strokeOpacity, strokeWeight: poly.strokeWeight, fillColor: poly.color, fillOpacity: poly.fillOpacity, zIndex: 5, clickable: true });
            this.addPolygonEditListeners(poly);
            this.openCard(this.activePolygonIndex);
            bus.emit("persist");
        } else { this.polygons.pop(); }
        this.activePolygonIndex = -1;
        
        // === الإصلاح: إيقاف وضع رسم المضلع وإعادة المؤشر ===
        MAP.modePolygonAdd = false; 
        MAP.setCursor("grab");
    }

    createNewPolygon() {
        const polygon = { id: "poly" + Date.now(), name: "مضلع جديد", notes: "", points: [], color: "#ff9800", strokeWeight: 2, strokeOpacity: 0.8, fillOpacity: 0.35, polygon: null, markers: [], activePolyline: null, vertexMarkers: [] };
        this.polygons.push(polygon);
        this.activePolygonIndex = this.polygons.length - 1;
        return polygon;
    }
    addPointToPolygon(polyIndex, latLng) {
        const poly = this.polygons[polyIndex];
        poly.points.push(latLng);
        const marker = new google.maps.marker.AdvancedMarkerElement({ position: latLng, map: this.map, content: this.buildVertexMarkerContent(poly.color) });
        poly.markers.push(marker);
        if (poly.activePolyline) poly.activePolyline.setMap(null);
        poly.activePolyline = new google.maps.Polyline({ path: poly.points, map: this.map, strokeColor: poly.color, strokeOpacity: 0.6, strokeWeight: 2, zIndex: 10 });
    }
    buildVertexMarkerContent(color) { const el = document.createElement("div"); el.style.width = "12px"; el.style.height = "12px"; el.style.borderRadius = "50%"; el.style.background = "white"; el.style.border = `2px solid ${color}`; el.style.cursor = 'pointer'; return el; }
    addPolygonEditListeners(poly) {
        poly.polygon.addListener("click", (e) => {
            const index = this.polygons.indexOf(poly);
            if (index === -1 || MAP.modePolygonAdd || this.isEditing && this.editingPolygonIndex !== index) return;
            if (this.editingPolygonIndex === index) { if (this.addingVertices && !this.shareMode && MAP.editMode) this.insertVertex(poly, index, e.latLng); }
            else { this.openCard(this.polygons.indexOf(poly), false, e.latLng); } 
        });
    }
    enterEditMode(index, addingVertices = false) {
        if (this.shareMode || !MAP.editMode || !this.polygons[index]?.polygon) return;
        this.exitEditMode();
        this.addingVertices = addingVertices;
        const poly = this.polygons[index];
        this.isEditing = true; this.editingPolygonIndex = index;
        
        poly.points.forEach((point, i) => {
            const marker = new google.maps.marker.AdvancedMarkerElement({ 
                position: point, 
                map: this.map, 
                gmpDraggable: true,
                gmpClickable: true,
                content: this.buildVertexMarkerContent(poly.color), 
                title: `نقطة ${i + 1}` 
            });
            poly.vertexMarkers.push(marker);
            
            // السحب لتغيير الموقع
            marker.addListener("drag", (e) => { poly.points[i] = e.latLng; poly.polygon.setPaths(poly.points); this.updateOutsideShade(); });
            marker.addListener("dragend", () => { bus.emit("persist"); });
            
            // Show explicit vertex actions on click, without disabling direct drag.
            const vertexContent = marker.content;
            vertexContent.style.cursor = "grab";
            vertexContent.style.touchAction = "none";
            vertexContent.setAttribute("role", "button");
            vertexContent.setAttribute("tabindex", "0");
            vertexContent.setAttribute("aria-label", `خيارات النقطة ${i + 1}`);
            const openVertexActions = (event) => {
                if (event) event.stopPropagation();
                if (MAP.shareMode || !MAP.editMode || !this.isEditing || this.editingPolygonIndex !== index) return;
                this.vertexInfo?.close();
                const wrapper = document.createElement("div");
                wrapper.dir = "rtl";
                wrapper.style.cssText = "display:flex;flex-direction:column;gap:8px;min-width:175px;font-family:inherit;padding:5px";
                const heading = document.createElement("strong");
                heading.textContent = `النقطة ${i + 1}`;
                const moveButton = document.createElement("button");
                moveButton.type = "button";
                moveButton.textContent = "تعديل موقع النقطة";
                moveButton.style.cssText = "padding:9px;border:0;border-radius:7px;background:#2563eb;color:white;cursor:pointer";
                moveButton.addEventListener("click", () => {
                    marker.gmpDraggable = true;
                    vertexContent.style.cursor = "grab";
                    vertexContent.style.width = "18px";
                    vertexContent.style.height = "18px";
                    this.vertexInfo?.close();
                    bus.emit("toast", "اسحب النقطة إلى الموقع الجديد لتوسيع المضلع أو تضييقه");
                });
                const deleteButton = document.createElement("button");
                deleteButton.type = "button";
                deleteButton.textContent = "حذف النقطة";
                deleteButton.style.cssText = "padding:9px;border:1px solid #ddd;border-radius:7px;background:white;color:#b91c1c;cursor:pointer";
                deleteButton.addEventListener("click", () => {
                    this.vertexInfo?.close();
                    this.deleteVertex(poly, index, i);
                });
                wrapper.append(heading, moveButton, deleteButton);
                this.vertexInfo = new google.maps.InfoWindow({ content: wrapper });
                this.vertexInfo.open({ map: this.map, anchor: marker });
            };
            vertexContent.addEventListener("click", openVertexActions);
            vertexContent.addEventListener("keydown", event => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openVertexActions(event);
                }
            });
        });
        
        UI.showPolygonEditingUI();
        const addButton = document.createElement("button");
        addButton.id = "poly-add-vertices";
        addButton.type = "button";
        addButton.className = UI.btnDrawFinish?.className || "btn";
        addButton.style.cssText = "display:inline-flex;align-items:center;padding:10px 14px;border-radius:12px;border:1px solid #fff;color:white;font-family:inherit;cursor:pointer";
        const updateButton = () => {
            addButton.textContent = this.addingVertices ? "إيقاف إضافة النقاط" : "إضافة نقاط جديدة";
            addButton.setAttribute("aria-pressed", String(this.addingVertices));
            addButton.style.background = this.addingVertices ? "#d97706" : "#2563eb";
            MAP.setCursor(this.addingVertices ? "crosshair" : "grab");
        };
        addButton.addEventListener("click", () => {
            this.addingVertices = !this.addingVertices;
            this.vertexInfo?.close();
            updateButton();
            bus.emit("toast", this.addingVertices ? "اضغط على الخريطة داخل المضلع أو خارجه لإضافة نقاط جديدة، ثم اضغط إنهاء." : "تم إيقاف الإضافة. يمكنك سحب النقاط لتعديل الحدود.");
        });
        UI.btnDrawFinish?.before(addButton);
        updateButton();
        bus.emit("toast", this.addingVertices ? "اضغط على الخريطة لإضافة النقطة التالية، ثم اضغط إنهاء." : "اسحب النقاط أو اضغط إضافة نقاط جديدة لتوسعة المضلع، ثم اضغط إنهاء.");
    }
    
    exitEditMode() {
        if (!this.isEditing) return;
        document.getElementById("poly-add-vertices")?.remove();
        this.addingVertices = false;
        MAP.setCursor("grab");
        this.vertexInfo?.close();
        this.vertexInfo = null;
        const poly = this.polygons[this.editingPolygonIndex];
        if (poly && poly.vertexMarkers) {
            poly.vertexMarkers.forEach(m => m.map = null);
            poly.vertexMarkers = [];
        }
        this.isEditing = false; this.editingPolygonIndex = -1;
        UI.showDefaultUI();
        bus.emit("toast", "تم الخروج من وضع تحرير المضلع");
    }

    insertVertex(poly, index, latLng) {
        // Find the closest segment to the clicked point
        let minDistance = Infinity;
        let insertIndex = -1;
        
        for (let i = 0; i < poly.points.length; i++) {
            const segStart = poly.points[i];
            const segEnd = poly.points[(i + 1) % poly.points.length];
            const distance = this.distanceToSegment(latLng, segStart, segEnd);
            
            if (distance < minDistance) {
                minDistance = distance;
                insertIndex = i + 1;
            }
        }
        
        if (insertIndex !== -1) {
            poly.points.splice(insertIndex, 0, latLng);
            poly.polygon.setPaths(poly.points); this.updateOutsideShade();
            
            // Update vertex markers
            this.enterEditMode(index, this.addingVertices);
            
            bus.emit("persist");
            bus.emit("toast", "تمت إضافة نقطة جديدة");
        }
    }

    deleteVertex(poly, index, vertexIndex) {
        if (poly.points.length <= 3) {
            bus.emit("toast", "لا يمكن حذف المزيد (الحد الأدنى 3 نقاط)");
            return;
        }
        
        // إزالة النقطة من المصفوفة
        poly.points.splice(vertexIndex, 1);
        
        // تحديث رسم المضلع
        poly.polygon.setPaths(poly.points); this.updateOutsideShade();
        
        // حفظ التغييرات
        bus.emit("persist");
        bus.emit("toast", "تم حذف النقطة");

        // إعادة تشغيل وضع التحرير لتحديث ترتيب النقاط ومواقعها
        this.enterEditMode(index, this.addingVertices);
    }

    distanceToSegment(point, segStart, segEnd) {
        const A = point.lat() - segStart.lat();
        const B = point.lng() - segStart.lng();
        const C = segEnd.lat() - segStart.lat();
        const D = segEnd.lng() - segStart.lng();

        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        let param = -1;
        
        if (lenSq !== 0) param = dot / lenSq;

        let xx, yy;

        if (param < 0) {
            xx = segStart.lat();
            yy = segStart.lng();
        } else if (param > 1) {
            xx = segEnd.lat();
            yy = segEnd.lng();
        } else {
            xx = segStart.lat() + param * C;
            yy = segStart.lng() + param * D;
        }

        const dx = point.lat() - xx;
        const dy = point.lng() - yy;
        
        return Math.sqrt(dx * dx + dy * dy);
    }

    openCard(polyIndex, hoverOnly = false, position = null) {
        const poly = this.polygons[polyIndex];
        const isEditingShape = this.editingPolygonIndex === polyIndex;
        const isEditable = !hoverOnly && MAP.editMode && !isEditingShape;
        const notes = Utils.escapeHTML(poly.notes || "");
        const area = google.maps.geometry.spherical.computeArea(poly.points);
        const areaText = Utils.formatArea(area);

        const cardStyle = `
            font-family: 'Tajawal', 'Cairo', sans-serif;
            background: rgba(255, 255, 255, 0.75); 
            backdrop-filter: blur(15px) saturate(1.8);
            -webkit-backdrop-filter: blur(15px) saturate(1.8);
            border-radius: 20px;
            border: none;
            padding: 0;
            color: #333;
            direction: rtl;
            box-shadow: 0 8px 32px rgba(31, 38, 135, 0.15);
            width: 380px;
            max-width: 95vw;
            max-height: 70vh;
            overflow-y: auto;
            overflow-x: hidden;
            -webkit-overflow-scrolling: touch;
        `;
        const headerStyle = `display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; background: rgba(255, 255, 255, 0.6); border-bottom: 1px solid rgba(255, 255, 255, 0.2); position: sticky; top: 0; z-index: 10;`;
        const bodyStyle = `padding: 20px;`;
        const footerStyle = `padding: 12px 20px; background: rgba(255, 255, 255, 0.6); border-top: 1px solid rgba(255, 255, 255, 0.2); position: sticky; bottom: 0;`;

        const html = `
        <div style="${cardStyle}" class="glass-card-content">
            <div style="${headerStyle}">
                <div style="display:flex;align-items:center;gap:8px;">
                     <img src="img/logo.png" style="width: 36px; height: 36px; border-radius: 8px;">
                     <h3 style="margin:0; font-family: 'Tajawal', sans-serif; font-size: 18px; font-weight: 700;">${Utils.escapeHTML(poly.name)}</h3>
                </div>
                ${this.shareMode && !hoverOnly ? `<button id="poly-share-close" type="button" aria-label="إغلاق بطاقة المضلع" title="إغلاق" style="width:40px;height:40px;border:1px solid #ddd;border-radius:10px;background:white;color:#333;font-size:26px;line-height:1;cursor:pointer;">×</button>` : ""}
            </div>
            <div style="${bodyStyle}">
                <div style="display: flex; justify-content: space-between; margin-bottom: 15px; font-size: 15px; font-family: 'Tajawal', sans-serif;">
                    <span><b>المساحة:</b> ${areaText}</span>
                </div>
                ${isEditingShape ? `<p style="margin: 0; color: #555; text-align:center; font-family: 'Tajawal', sans-serif;">اسحب النقاط لتعديل الشكل. فعّل إضافة نقاط جديدة ثم اضغط داخل المضلع أو خارجه لتوسعة الحدود. اضغط على نقطة لحذفها.</p>` : 
                (isEditable ? `
                    <div style="margin-bottom:14px;"><label style="font-size:12px; display:block; margin-bottom:4px; font-family: 'Tajawal', sans-serif;">الاسم:</label><input id="poly-name" type="text" value="${Utils.escapeHTML(poly.name)}" style="width:100%;padding:7px;border-radius:6px;border:1px solid #ddd;box-sizing:border-box;"></div>
                    <div style="display:flex; gap:10px; align-items:center; margin-bottom:14px; flex-wrap: wrap;">
                        <div style="flex:1; min-width: 120px;"><label style="font-size:12px; display:block; margin-bottom:4px; font-family: 'Tajawal', sans-serif;">اللون:</label><input id="poly-color" type="color" value="${poly.color}" style="width:100%;height:32px;border:none;border-radius:6px;cursor:pointer;"></div>
                        <div style="flex:1; min-width: 120px;"><label style="font-size:12px; display:block; margin-bottom:4px; font-family: 'Tajawal', sans-serif;">سماكة الخط:</label><input id="poly-stroke" type="number" value="${poly.strokeWeight}" min="1" max="10" style="width:100%;padding:7px;border-radius:6px;border:1px solid #ddd;box-sizing:border-box;"></div>
                    </div>
                    <div style="margin-bottom:14px;"><label style="font-size:12px; display:block; margin-bottom:4px; font-family: 'Tajawal', sans-serif;">شفافية الحدود: <span id="poly-stroke-opacity-val">${Math.round(poly.strokeOpacity * 100)}%</span></label><input id="poly-stroke-opacity" type="range" min="0" max="100" value="${Math.round(poly.strokeOpacity * 100)}" style="width:100%;"></div>
                    <div style="margin-bottom:14px;"><label style="font-size:12px; display:block; margin-bottom:4px; font-family: 'Tajawal', sans-serif;">شفافية التعبئة: <span id="poly-fill-opacity-val">${Math.round(poly.fillOpacity * 100)}%</span></label><input id="poly-fill-opacity" type="range" min="0" max="100" value="${Math.round(poly.fillOpacity * 100)}" style="width:100%;"></div>
                    <fieldset style="margin:0 0 14px;padding:12px;border:1px solid #ddd;border-radius:10px;">
<legend style="font-weight:600;">تظليل خارج المضلع</legend>
<label style="display:flex;align-items:center;gap:8px;margin-bottom:12px;"><input id="poly-outside-shade" type="checkbox" ${poly.outsideShade ? 'checked' : ''}> تفعيل التظليل خارج المضلع</label>
<label for="poly-shade-color" style="display:block;margin-bottom:5px;">لون التظليل</label>
<input id="poly-shade-color" type="color" value="${Utils.escapeHTML(poly.shadeColor || '#000000')}" style="width:100%;height:32px;border:0;cursor:pointer;">
<label for="poly-shade-opacity" style="display:block;margin-top:10px;">مستوى التظليل: <span id="poly-shade-opacity-val">${Math.round((poly.shadeOpacity ?? 0.6) * 100)}%</span></label>
<input id="poly-shade-opacity" type="range" min="0" max="100" value="${Math.round((poly.shadeOpacity ?? 0.6) * 100)}" style="width:100%;">
<small style="display:block;color:#666;line-height:1.6;">0% بدون تظليل، 100% تغطية كاملة خارج المضلع. تُحفظ تلقائيًا، ويُفعّل التظليل لمضلع واحد في كل مرة.</small>
</fieldset>
                    <div style="margin-bottom:14px;"><label style="font-size:12px; display:block; margin-bottom:4px; font-family: 'Tajawal', sans-serif;">ملاحظات:</label><textarea id="poly-notes" rows="3" style="width: 100%; padding: 10px; border-radius: 10px; border: 1px solid #ddd; resize: none; box-sizing: border-box; font-family: 'Tajawal', sans-serif; font-size: 14px;">${notes}</textarea></div>
                ` : `
                    <p style="margin: 0 0 8px 0; font-size: 14px; color: #555; font-family: 'Tajawal', sans-serif;">ملاحظات:</p>
                    <div style="background: rgba(52, 168, 83, 0.1); padding: 10px; border-radius: 10px; min-height: 40px; font-size: 14px; line-height: 1.6; font-family: 'Tajawal', sans-serif;">
                        ${notes || '<span style="color: #888;">لا توجد ملاحظات</span>'}
                    </div>
                `)}
            </div>
            ${isEditable ? `
                <div style="${footerStyle}">
                    <div style="display:flex;gap:8px; flex-wrap: wrap;">
                        <button id="poly-save-properties" style="flex:2;background:#ff9800;color:white;border:none;border-radius:12px;padding:10px;cursor:pointer;font-weight:600; font-family: 'Tajawal', sans-serif; min-width: 100px;">حفظ الخصائص</button>
                        <button id="poly-edit-shape" style="flex:2;background:#34a853;color:white;border:none;border-radius:12px;padding:10px;cursor:pointer;font-weight:600; font-family: 'Tajawal', sans-serif; min-width: 100px;">تعديل الشكل</button>
                        <button id="poly-shrink" type="button" class="btn">تصغير 10%</button>
                        <button id="poly-grow" type="button" class="btn">تكبير 10%</button>
                        <button id="poly-delete" style="flex:1;background:#e94235;color:white;border:none;border-radius:12px;padding:10px;cursor:pointer;font-weight:600; font-family: 'Tajawal', sans-serif; min-width: 80px;">حذف</button>
                        <button id="poly-close" style="flex:1;background:rgba(0,0,0,0.05);color:#333;border:1px solid #ddd;border-radius:12px;padding:10px;cursor:pointer;font-weight:600; font-family: 'Tajawal', sans-serif; min-width: 80px;">إغلاق</button>
                    </div>
                </div>
            ` : ''}
        </div>`;

        UI.openSharedInfoCard(html, position || this.getPolygonCenter(poly), !hoverOnly);
        google.maps.event.addListenerOnce(UI.sharedInfoWindow, "domready", () => this.attachCardEvents(polyIndex, hoverOnly));
    }

    getPolygonCenter(poly) { const bounds = new google.maps.LatLngBounds(); poly.points.forEach(pt => bounds.extend(pt)); return bounds.getCenter();}

    attachCardEvents(polyIndex, hoverOnly) {
        document.getElementById("poly-share-close")?.addEventListener("click", () => UI.forceCloseSharedInfoCard());
        const poly = this.polygons[polyIndex];
        const isEditingShape = this.editingPolygonIndex === polyIndex;
        if (isEditingShape) { const stopEditBtn = document.getElementById("poly-stop-edit"); if (stopEditBtn) stopEditBtn.addEventListener("click", () => { this.exitEditMode(); UI.forceCloseSharedInfoCard(); }); return; }
        if (hoverOnly || !MAP.editMode) return;
        const savePropsBtn = document.getElementById("poly-save-properties"); const editShapeBtn = document.getElementById("poly-edit-shape"); const delBtn = document.getElementById("poly-delete"); const closeBtn = document.getElementById("poly-close");
        const shadeToggle = document.getElementById("poly-outside-shade");
        const shadeColor = document.getElementById("poly-shade-color");
        const shadeOpacity = document.getElementById("poly-shade-opacity");
        const updateShade = () => {
            if (shadeToggle.checked) this.polygons.forEach(p => { p.outsideShade = p === poly; });
            else poly.outsideShade = false;
            poly.shadeColor = shadeColor.value;
            poly.shadeOpacity = Utils.clamp(Number(shadeOpacity.value), 0, 100) / 100;
            document.getElementById("poly-shade-opacity-val").textContent = Math.round(poly.shadeOpacity * 100) + "%";
            this.updateOutsideShade();
            bus.emit("persist");
        };
        shadeToggle?.addEventListener("change", updateShade);
        shadeColor?.addEventListener("input", updateShade);
        shadeOpacity?.addEventListener("input", updateShade);
        const nameEl = document.getElementById("poly-name"); const notesEl = document.getElementById("poly-notes");
        const colEl = document.getElementById("poly-color"); const strokeEl = document.getElementById("poly-stroke");
        const strokeOpEl = document.getElementById("poly-stroke-opacity"); const fillOpEl = document.getElementById("poly-fill-opacity");
        const strokeOpValEl = document.getElementById("poly-stroke-opacity-val"); const fillOpValEl = document.getElementById("poly-fill-opacity-val");
        if (strokeOpEl) { strokeOpEl.addEventListener("input", () => { if (strokeOpValEl) strokeOpValEl.textContent = strokeOpEl.value + "%"; }); }
        if (fillOpEl) { fillOpEl.addEventListener("input", () => { if (fillOpValEl) fillOpValEl.textContent = fillOpEl.value + "%"; }); }
        if (savePropsBtn) {
            savePropsBtn.addEventListener("click", () => {
                poly.name = nameEl.value.trim(); poly.notes = notesEl.value.trim(); poly.color = colEl.value;
                poly.strokeWeight = Utils.clamp(+strokeEl.value, 1, 10); poly.strokeOpacity = Utils.clamp(+strokeOpEl.value, 0, 100) / 100; poly.fillOpacity = Utils.clamp(+fillOpEl.value, 0, 100) / 100;
                poly.polygon.setOptions({ fillColor: poly.color, strokeColor: poly.color, strokeWeight: poly.strokeWeight, strokeOpacity: poly.strokeOpacity, fillOpacity: poly.fillOpacity });
                bus.emit("persist"); UI.forceCloseSharedInfoCard(); bus.emit("toast", "تم حفظ خصائص المضلع");
            });
        }
        for (const [id, factor] of [["poly-shrink", 0.9], ["poly-grow", 1.1]]) {
            document.getElementById(id)?.addEventListener("click", () => {
                const center = this.getPolygonCenter(poly);
                const { computeDistanceBetween, computeHeading, computeOffset } = google.maps.geometry.spherical;
                poly.points = poly.points.map(point => computeOffset(
                    center, computeDistanceBetween(center, point) * factor, computeHeading(center, point)
                ));
                poly.polygon.setPaths(poly.points); this.updateOutsideShade();
                bus.emit("persist");
                this.openCard(polyIndex);
            });
        }
        if (editShapeBtn) { editShapeBtn.addEventListener("click", () => { this.enterEditMode(polyIndex); UI.forceCloseSharedInfoCard(); }); }
        if (delBtn) { 
            delBtn.addEventListener("click", () => { 
                if (!confirm(`حذف المضلع "${poly.name}" كاملاً؟`)) return; 
                poly.polygon.setMap(null); 
                this.polygons = this.polygons.filter(p => p.id !== poly.id);
                this.updateOutsideShade(); 
                UI.forceCloseSharedInfoCard(); 
                bus.emit("persist"); 
                bus.emit("toast", "تم حذف المضلع"); 
            }); 
        }
        if (closeBtn) { closeBtn.addEventListener("click", () => { UI.forceCloseSharedInfoCard(); }); }
    }

    exportState() { 
        return this.polygons.filter(p => p.polygon).map(poly => ({ 
            id: poly.id, 
            name: poly.name, 
            notes: poly.notes, 
            color: poly.color, 
            strokeWeight: poly.strokeWeight, 
            strokeOpacity: poly.strokeOpacity, 
            fillOpacity: poly.fillOpacity,
            outsideShade: !!poly.outsideShade,
            shadeColor: poly.shadeColor || "#000000",
            shadeOpacity: poly.shadeOpacity ?? 0.6,
            points: poly.points.map(p => ({ 
                lat: typeof p.lat === 'function' ? p.lat() : p.lat, 
                lng: typeof p.lng === 'function' ? p.lng() : p.lng 
            })) 
        })); 
    }
    
    applyState(state) {
        if (!state || !state.polygons) return;
        this.polygons.forEach(p => { if (p.polygon) p.polygon.setMap(null); });
        this.polygons = [];
        state.polygons.forEach(polyData => {
            const newPoly = { 
                id: polyData.id, 
                name: polyData.name, 
                notes: polyData.notes || "", 
                color: polyData.color, 
                strokeWeight: polyData.strokeWeight, 
                strokeOpacity: polyData.strokeOpacity, 
                fillOpacity: polyData.fillOpacity,
                outsideShade: polyData.outsideShade === true,
                shadeColor: /^#[0-9a-f]{6}$/i.test(polyData.shadeColor || "") ? polyData.shadeColor : "#000000",
                shadeOpacity: Number.isFinite(polyData.shadeOpacity) ? Utils.clamp(polyData.shadeOpacity, 0, 1) : 0.6, 
                points: polyData.points.map(p => new google.maps.LatLng(p.lat, p.lng)), 
                polygon: null, 
                markers: [], 
                activePolyline: null, 
                vertexMarkers: [] 
            };
            newPoly.polygon = new google.maps.Polygon({ 
                paths: newPoly.points, 
                map: this.map, 
                strokeColor: newPoly.color, 
                strokeOpacity: newPoly.strokeOpacity, 
                strokeWeight: newPoly.strokeWeight, 
                fillColor: newPoly.color, 
                fillOpacity: newPoly.fillOpacity, 
                zIndex: 5, 
                clickable: true 
            });
            this.addPolygonEditListeners(newPoly);
            this.polygons.push(newPoly);
        });
        this.updateOutsideShade();
    }
}

const POLYGONS = new PolygonManager();

/*
============================================================
   StateManager
— إدارة حفظ واسترجاع الحالة (مُصلح)
============================================================
*/
class StateManager {

    constructor() {
        this.map = null;
        this.shareMode = false;
        this.draftKey = "securitymap:draft:" + location.pathname;

        bus.on("map:ready", map => {
            this.map = map;
            this.shareMode = MAP.shareMode;

            const state = this.shareMode ? this.readShare() : this.readDraft();
            if (state) this.applyState(state);

            if (!this.shareMode) {
                console.log("Enabling auto-persist for edit mode.");
                this.history = [];
                this.historyIndex = -1;
                this.restoringHistory = false;
                this.recordHistory(); // baseline (including a restored draft)
                bus.on("persist", () => {
                    if (this.restoringHistory) return;
                    const state = this.buildState();
                    this.saveDraft(state);
                    this.recordHistory(state);
                });
                this.installUndoRedo();
            }
        });
    }

    // Undo/redo snapshots are kept in memory for the current tab only.
    // Draft persistence continues to use sessionStorage as before.
    recordHistory(state = this.buildState()) {
        if (this.shareMode || this.restoringHistory || !state) return;
        // History tracks editable objects only, never viewport movement or map layers.
        // Draft/share state still retains the full map state.
        const snapshot = JSON.stringify({
            routes: state.routes,
            locations: state.locations,
            polygons: state.polygons,
            freeDraw: state.freeDraw
        });
        if (this.history[this.historyIndex] === snapshot) return;
        this.history.splice(this.historyIndex + 1);
        this.history.push(snapshot);
        if (this.history.length > 60) this.history.shift();
        this.historyIndex = this.history.length - 1;
        this.updateHistoryButtons();
    }

    travelHistory(direction) {
        if (this.shareMode || this.restoringHistory) return;
        const next = this.historyIndex + direction;
        if (next < 0 || next >= this.history.length) return;
        this.restoringHistory = true;
        try {
            // Preserve current camera, zoom and base layer while restoring edits.
            const edits = JSON.parse(this.history[next]);
            this.applyState(edits);
            this.historyIndex = next;
            this.saveDraft(this.buildState());
        } catch (error) {
            console.error('Undo/redo failed:', error);
            bus.emit('toast', 'تعذر استعادة الإجراء');
        } finally {
            this.restoringHistory = false;
            this.updateHistoryButtons();
        }
    }

    updateHistoryButtons() {
        if (this.undoButton) this.undoButton.disabled = this.historyIndex <= 0;
        if (this.redoButton) this.redoButton.disabled = this.historyIndex >= this.history.length - 1;
    }

    installUndoRedo() {
        const panel = document.createElement('div');
        panel.id = 'securitymap-history-controls';
        panel.setAttribute('dir', 'rtl');
        panel.setAttribute('role', 'group');
        panel.setAttribute('aria-label', 'التراجع والتقدم');
        const makeButton = (symbol, title, direction) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = symbol;
            button.title = title;
            button.setAttribute('aria-label', title);
            button.addEventListener('click', () => this.travelHistory(direction));
            return button;
        };
        this.undoButton = makeButton('↶', 'تراجع (Ctrl+Z)', -1);
        this.redoButton = makeButton('↷', 'تقدم (Ctrl+Y أو Ctrl+Shift+Z)', 1);
        panel.append(this.undoButton, this.redoButton);

        // Keep the controls within the existing top toolbar, not floating over the map.
        const toolbar = document.getElementById('toolbar');
        if (toolbar) {
            toolbar.appendChild(panel);
        } else {
            // Safe fallback if a different HTML layout omits the toolbar.
            panel.classList.add('securitymap-history-fallback');
            document.body.appendChild(panel);
        }
        const style = document.createElement('style');
        style.textContent = `
            #securitymap-history-controls {
                display:inline-flex;align-items:center;justify-content:center;gap:2px;
                flex:0 0 auto;width:auto;max-width:80px;margin-inline:4px;
                padding:2px;border-radius:8px;background:rgba(255,255,255,.10);
                vertical-align:middle;box-sizing:border-box;
            }
            #securitymap-history-controls button {
                display:inline-flex;align-items:center;justify-content:center;
                width:32px;height:32px;min-width:32px;padding:0;margin:0;
                border:0;border-radius:6px;background:transparent;color:inherit;
                font:600 24px/1 Arial,sans-serif;cursor:pointer;
            }
            #securitymap-history-controls button:hover:not(:disabled),
            #securitymap-history-controls button:focus-visible {
                background:rgba(128,128,128,.22);outline-offset:1px;
            }
            #securitymap-history-controls button:disabled {opacity:.35;cursor:not-allowed;}
            #securitymap-history-controls.securitymap-history-fallback {
                position:fixed;top:12px;left:12px;z-index:9000;
                background:#fff;color:#222;box-shadow:0 2px 8px #0002;
            }
        `;
        document.head.appendChild(style);
        this.updateHistoryButtons();
        // Capture shortcuts before Google Maps or toolbar handlers can consume them.
        // event.code supports Arabic keyboard layouts (KeyZ / KeyY).
        // Keep native undo inside actual text editors, not ordinary toolbar controls.
        const handleHistoryShortcut = (event) => {
            if (MAP.shareMode || !MAP.editMode || !(event.ctrlKey || event.metaKey) || event.altKey) return;
            const active = document.activeElement;
            const target = event.target;
            const editor = (target?.closest?.('input, textarea, [contenteditable="true"], [role="textbox"]') ||
                active?.closest?.('input, textarea, [contenteditable="true"], [role="textbox"]'));
            if (editor && (editor.matches('textarea, [contenteditable="true"], [role="textbox"]') ||
                (editor.matches('input') && !['button','submit','reset','checkbox','radio','range','color'].includes(editor.type)))) return;
            const key = (event.key || '').toLowerCase();
            const code = event.code || '';
            const isZ = key === 'z' || code === 'KeyZ';
            const isY = key === 'y' || code === 'KeyY';
            const undo = isZ && !event.shiftKey;
            const redo = isY || (isZ && event.shiftKey);
            if (!undo && !redo) return;
            event.preventDefault();
            event.stopImmediatePropagation();
            this.travelHistory(undo ? -1 : 1);
        };
        window.addEventListener('keydown', handleHistoryShortcut, true);

    }

    buildState() {
        if (!this.map) return null;

        const center = this.map.getCenter();
        return {
            v: 1,
            map: {
                c: [center.lat(), center.lng()],
                z: this.map.getZoom(),
                t: this.map.getMapTypeId(),
                traffic: MAP.trafficLayer?.getMap() ? 1 : 0
            },
            routes: ROUTES.exportState(),
            locations: LOCATIONS.exportState(),
            polygons: POLYGONS.exportState(),
            freeDraw: FREE_DRAW.exportState().freeDraw
        };
    }

    writeShare(st) {
        try {
            const json = JSON.stringify(st);
            const encoded = Utils.b64uEncode(json);
            const base = location.origin + location.pathname;
            const url = base + "?x=" + encoded;
            return url;
        } catch (e) {
            console.error("writeShare error", e);
            return location.href;
        }
    }

    saveDraft(state) {
        if (this.shareMode || !state) return;
        try {
            sessionStorage.setItem(this.draftKey, JSON.stringify(state));
        } catch (error) {
            console.warn("Unable to save the map draft", error);
        }
    }

    readDraft() {
        try {
            const draft = JSON.parse(sessionStorage.getItem(this.draftKey));
            if (Array.isArray(draft?.locations)) {
                const locations = LOCATIONS.removeLegacyDefaultLocations(draft.locations);
                if (locations.length !== draft.locations.length) {
                    draft.locations = locations;
                    this.saveDraft(draft);
                }
            }
            return draft;
        } catch (error) {
            console.warn("Unable to read the map draft", error);
            return null;
        }
    }

    readShare() {
        try {
            const p = new URLSearchParams(location.search);
            const x = p.get("x");
            if (!x) return null;

            const json = Utils.b64uDecode(x);
            if (!json) return null;

            return JSON.parse(json);
        } catch (e) {
            console.error("State read error", e);
            return null;
        }
    }

    applyState(state) {
        console.log("Applying state:", state);

        if (!state) return;

        if (state.map) {
            const mapState = state.map;
            if (mapState.c && mapState.z) {
                this.map.setCenter({ lat: mapState.c[0], lng: mapState.c[1]});
                this.map.setZoom(mapState.z);
            }
            if (mapState.t) {
                this.map.setMapTypeId(mapState.t === "arcgis-imagery" ? "satellite" : mapState.t);
            }
            if (mapState.traffic) {
                MAP.trafficLayer.setMap(this.map);
            } else {
                MAP.trafficLayer.setMap(null);
            }
        }

        if (state.locations) {
            LOCATIONS.applyState({ locations: state.locations });
        }

        if (state.routes) {
            // رابط قديم دون الإعداد: يبقى ترقيمه ظاهرًا كما كان سابقًا.
            // رابط جديد: يعتمد على الاختيار المحفوظ داخل بيانات رابط المشاركة.
            const showNumbersInShare = state.shareOptions?.showRouteNumbers !== false;
            ROUTES.setRouteNumberVisibility(this.shareMode ? showNumbersInShare : true);
            ROUTES.applyState({ routes: state.routes });
         }
         
         if (state.polygons) {
            POLYGONS.applyState({ polygons: state.polygons });
        }
        
        if (state.freeDraw) {
            FREE_DRAW.applyState({ freeDraw: state.freeDraw });
        }
    }
}

const STATE = new StateManager();

/*
============================================================
   ShareManager
— نسخ آمن مع ضغط البيانات (مُحسّن)
============================================================
*/
class MapExportManager {
    constructor() { this.busy = false; this.previewUrl = null; this.libraries = {}; }
    loadLibrary(name, url) {
        if (window[name]) return Promise.resolve(window[name]);
        if (!this.libraries[name]) this.libraries[name] = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            const timer = setTimeout(() => { script.remove(); reject(new Error('تعذر تحميل أداة الحفظ. تحقق من الاتصال ثم حاول مجددًا.')); }, 20000);
            script.src = url;
            script.onload = () => { clearTimeout(timer); window[name] ? resolve(window[name]) : reject(new Error('تعذر تحميل أداة الحفظ')); };
            script.onerror = () => { clearTimeout(timer); script.remove(); reject(new Error('تعذر تحميل أداة الحفظ. تحقق من الاتصال ثم حاول مجددًا.')); };
            document.head.appendChild(script);
        }).catch(error => { delete this.libraries[name]; throw error; });
        return this.libraries[name];
    }
    createPanel() {
        const panel = document.createElement('section');
        panel.className = 'share-section';
        panel.style.cssText = 'padding:16px;border:1px solid #d9e3ee;border-radius:12px;background:#f6f9fc;color:#243447';
        panel.innerHTML = '<h4 style="margin:0 0 10px">حفظ صورة الخريطة</h4>' +
            '<p style="font-size:13px;line-height:1.7;margin:0 0 12px">حفظ الجزء الظاهر مع المواقع والمسارات والمضلعات والتظليل، دون القوائم وأزرار التحكم. تبقى حقوق مزوّد الخريطة ظاهرة.</p>' +
            '<div style="display:flex;gap:10px;flex-wrap:wrap"><label style="flex:1">الصيغة<select id="map-export-format" style="display:block;width:100%;padding:9px;margin-top:5px"><option value="png">PNG — أعلى جودة</option><option value="jpg">JPG — حجم أصغر</option><option value="pdf">PDF — للطباعة</option><option value="webp">WebP — صورة مضغوطة</option></select></label>' +
            '<label style="flex:1">الدقة<select id="map-export-scale" style="display:block;width:100%;padding:9px;margin-top:5px"><option value="1">عادية 1×</option><option value="2" selected>مضاعفة 2×</option></select></label></div>' +
            '<p style="font-size:12px;color:#667;margin:8px 0">الدقة المضاعفة تكبّر أبعاد الملف؛ تفاصيل الخريطة تعتمد على مستوى التكبير الحالي.</p>' +
            '<button type="button" id="map-export-capture" style="width:100%;padding:11px;border:0;border-radius:8px;background:#2563eb;color:white;font:inherit;cursor:pointer">معاينة الصورة</button>' +
            '<p id="map-export-status" role="status" aria-live="polite" style="font-size:13px;line-height:1.6"></p>' +
            '<div id="map-export-preview" hidden><img alt="معاينة الخريطة قبل الحفظ" style="display:block;width:100%;border:1px solid #ddd;border-radius:8px"><button type="button" id="map-export-download" style="width:100%;padding:11px;margin-top:10px;border:0;border-radius:8px;background:#15803d;color:white;font:inherit;cursor:pointer">تجهيز الملف للحفظ</button></div>';
        const capture = panel.querySelector('#map-export-capture');
        const download = panel.querySelector('#map-export-download');
        const status = panel.querySelector('#map-export-status');
        const preview = panel.querySelector('#map-export-preview');
        let canvas = null;
        panel.querySelector('#map-export-format').addEventListener('change', () => panel.querySelector('#map-export-save-link')?.remove());
        panel.querySelector('#map-export-scale').addEventListener('change', () => { canvas = null; preview.hidden = true; status.textContent = 'اضغط معاينة الصورة لتطبيق الدقة الجديدة.'; });
        capture.addEventListener('click', async () => {
            if (this.busy) return;
            if (MAP.modePolygonAdd || MAP.modeRouteAdd || POLYGONS.isEditing) { status.textContent = 'أنهِ الرسم أو تعديل الشكل أولًا، ثم احفظ الصورة.'; return; }
            this.busy = true; capture.disabled = true; download.disabled = true; preview.hidden = true; canvas = null; panel.querySelector('#map-export-save-link')?.remove();
            status.textContent = 'جارٍ تجهيز الخريطة…';
            try {
                canvas = await this.capture(Number(panel.querySelector('#map-export-scale').value));
                if (!panel.isConnected) return;
                const blob = await this.toBlob(canvas, 'image/png');
                this.releasePreview(); this.previewUrl = URL.createObjectURL(blob);
                preview.querySelector('img').src = this.previewUrl;
                preview.hidden = false;
                status.textContent = 'المعاينة جاهزة — ' + canvas.width + ' × ' + canvas.height + ' بكسل. اختر الصيغة ثم نزّل الملف.';
            } catch (error) { status.textContent = error.message || 'تعذر إنشاء الصورة. أعد المحاولة بعد اكتمال تحميل الخريطة.'; }
            finally { this.busy = false; capture.disabled = false; download.disabled = false; }
        });
        download.addEventListener('click', async () => {
            if (!canvas || this.busy) return;
            this.busy = true; download.disabled = true; capture.disabled = true;
            const format = panel.querySelector('#map-export-format').value;
            status.textContent = 'جارٍ إعداد الملف…';
            try {
                let blob;
                if (format === 'pdf') {
                    const lib = await this.loadLibrary('PDFLib', 'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js');
                    const pdf = await lib.PDFDocument.create();
                    const png = await this.toBlob(canvas, 'image/png');
                    const image = await pdf.embedPng(await png.arrayBuffer());
                    const factor = 842 / Math.max(canvas.width, canvas.height);
                    const page = pdf.addPage([canvas.width * factor, canvas.height * factor]);
                    page.drawImage(image, { x: 0, y: 0, width: page.getWidth(), height: page.getHeight() });
                    blob = new Blob([await pdf.save()], { type: 'application/pdf' });
                } else {
                    blob = await this.toBlob(canvas, format === 'jpg' ? 'image/jpeg' : 'image/' + format, 0.95);
                    if (format === 'webp' && blob.type !== 'image/webp') throw new Error('متصفحك لا يدعم WebP. اختر PNG أو JPG.');
                }
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a'); link.href = url;
                link.download = 'securitymap-' + new Date().toISOString().replace(/[:.]/g, '-') + '.' + format;
                panel.querySelector('#map-export-save-link')?.remove();
                if (this.downloadUrl) URL.revokeObjectURL(this.downloadUrl);
                this.downloadUrl = url;
                link.id = 'map-export-save-link';
                link.textContent = 'حفظ الملف ' + format.toUpperCase();
                link.style.cssText = 'display:block;text-align:center;padding:12px;margin-top:10px;border-radius:8px;background:#166534;color:white;text-decoration:none;font-weight:700';
                preview.appendChild(link);
                status.textContent = 'الملف جاهز. اضغط حفظ الملف لإكمال التنزيل.';
            } catch (error) { status.textContent = error.message || 'تعذر حفظ الملف. جرّب PNG.'; }
            finally { this.busy = false; download.disabled = false; capture.disabled = false; }
        });
        return panel;
    }
    releasePreview() { if (this.previewUrl) URL.revokeObjectURL(this.previewUrl); if (this.downloadUrl) URL.revokeObjectURL(this.downloadUrl); this.previewUrl = null; this.downloadUrl = null; }
    toBlob(canvas, type, quality) {
        return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('تعذر إنشاء الملف. جرّب الدقة العادية.')), type, quality));
    }
    async capture(requestedScale) {
        const render = await this.loadLibrary('html2canvas', 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js');
        const map = MAP.map.getDiv();
        if (MAP.map.getRenderingType?.() === 'VECTOR') throw new Error('التصدير غير متاح لهذا العرض. اختر طبقة الطرق أو القمر الصناعي ثم أعد المحاولة.');
        await document.fonts.ready;
        const rect = map.getBoundingClientRect();
        const scale = Math.min(requestedScale, 8192 / Math.max(rect.width, rect.height), Math.sqrt(16000000 / (rect.width * rect.height)));
        const sources = [...new Set([...map.querySelectorAll('img')].filter(img => {
            const r = img.getBoundingClientRect();
            return img.src && r.width && r.height && r.right > rect.left && r.left < rect.right && r.bottom > rect.top && r.top < rect.bottom;
        }).map(img => img.src))];
        const backgrounds = [...map.querySelectorAll('[style*="background-image"]')].filter(el => {
            const r = el.getBoundingClientRect();
            return r.width && r.height && r.right > rect.left && r.left < rect.right && r.bottom > rect.top && r.top < rect.bottom;
        }).flatMap(el => [...el.style.backgroundImage.matchAll(/url\(["']?([^"')]+)["']?\)/g)].map(match => new URL(match[1], location.href).href));
        sources.push(...backgrounds.filter(src => !sources.includes(src)));
        await Promise.all(sources.map(src => new Promise((resolve, reject) => {
            const image = new Image();
            const timer = setTimeout(() => { image.src = ''; reject(new Error('لم يكتمل تحميل الخريطة. انتظر ثم أعد المحاولة.')); }, 15000);
            image.crossOrigin = 'anonymous';
            image.onload = () => { clearTimeout(timer); resolve(); };
            image.onerror = () => { clearTimeout(timer); reject(new Error('تعذر التقاط إحدى صور الخريطة. جرّب طبقة أخرى أو أعد المحاولة.')); };
            image.src = src;
        })));
        return render(map, {
            useCORS: true, allowTaint: false, backgroundColor: '#ffffff', scale,
            logging: false, imageTimeout: 20000,
            onclone: doc => {
                doc.querySelectorAll('#map img[src^="data:image/svg+xml"]').forEach(img => {
                    const bounds = img.getBoundingClientRect();
                    if (!bounds.width || !bounds.height) return;
                    const svgDoc = new DOMParser().parseFromString(decodeURIComponent(img.src.slice(img.src.indexOf(',') + 1)), 'image/svg+xml');
                    const root = svgDoc.documentElement;
                    root.setAttribute('width', String(bounds.width)); root.setAttribute('height', String(bounds.height));
                    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(root));
                });
                const shade = doc.getElementById('polygon-outside-shade');
                if (shade) {
                    const path = shade.querySelector('path');
                    const bitmap = doc.createElement('canvas');
                    bitmap.width = Number(shade.getAttribute('width')); bitmap.height = Number(shade.getAttribute('height'));
                    bitmap.style.cssText = shade.style.cssText;
                    const context = bitmap.getContext('2d');
                    context.fillStyle = path.getAttribute('fill'); context.globalAlpha = Number(path.getAttribute('fill-opacity'));
                    context.fill(new Path2D(path.getAttribute('d')), 'evenodd');
                    shade.replaceWith(bitmap);
                }
                doc.querySelectorAll('#toolbar,#mode-badge,#toast,.layers-panel,.share-dialog-overlay,.gm-bundled-control,.gm-fullscreen-control,.gm-style-mtc,.gm-svpc,.gm-style-iw-a,.gm-style-cc button').forEach(el => { el.style.visibility = 'hidden'; });
            }
        });
    }
}

class ShareManager {

    constructor() {
        this.exporter = new MapExportManager();
        this.btn = document.getElementById("btn-share");
        this.btnText = this.btn ? this.btn.textContent : 'مشاركة';
        this.btnIcon = this.btn ? this.btn.querySelector(".material-icons") : null;
        
        if (this.btn) {
            this.btn.addEventListener("click", () => this.generateShareLink());
        }
    }

    async generateShareLink() {
        const st = STATE.buildState();
        if (!st) {
            bus.emit("toast", "تعذر إنشاء رابط المشاركة");
            return;
        }

        // استخدام واجهة المشاركة المحسّنة
        this.showShareDialog(st);
    }

    showShareDialog(state) {
        // منع التكرار
        if (document.querySelector('.share-dialog-overlay')) return;

        STATE.saveDraft(state);
        // الافتراضي عند إنشاء رابط جديد: إخفاء الترقيم في المشاركة فقط.
        // لا نغيّر حالة التحرير أو نحذف علامات نقاط المسار من المشروع.
        const initialShareState = {
            ...state,
            shareOptions: { ...(state.shareOptions || {}), showRouteNumbers: false }
        };
        const longUrl = STATE.writeShare(initialShareState);

        // إنشاء واجهة المشاركة
        const dialog = document.createElement('div');
        dialog.className = 'share-dialog-overlay';
        
        const content = document.createElement('div');
        content.className = 'share-dialog-content';
        
        const header = document.createElement('div');
        header.className = 'share-dialog-header';
        header.innerHTML = `
            <h3>مشاركة الخريطة</h3>
            <button class="share-close-btn"><i class="material-icons">close</i></button>
        `;
        
        const body = document.createElement('div');
        body.className = 'share-dialog-body';
        
        // خيار مستقل لكل رابط مشاركة: إظهار أو إخفاء الأرقام دون تعديل الخريطة الأصلية.
        const numbersSection = document.createElement('section');
        numbersSection.className = 'share-section';
        numbersSection.style.cssText = 'padding:14px 16px;border:1px solid #d9e3ee;border-radius:12px;background:#f6f9fc;color:#243447';
        numbersSection.innerHTML = `
            <label for="share-route-numbers" style="display:flex;align-items:center;gap:10px;cursor:pointer;font-weight:700;font-size:14px">
                <input id="share-route-numbers" type="checkbox" style="width:18px;height:18px;accent-color:#2563eb;cursor:pointer">
                إظهار ترقيم نقاط المسارات في رابط المشاركة
            </label>
            <p style="font-size:12px;line-height:1.7;margin:8px 28px 0;color:#536273">
                عند إلغاء التحديد ستظهر خطوط المسارات دون دوائر الأرقام. لن تتغير الأرقام في وضع التحرير.
            </p>
        `;

        // قسم الرابط الطويل
        const longUrlSection = document.createElement('div');
        longUrlSection.className = 'share-section';
        longUrlSection.innerHTML = `
            <h4>الرابط الكامل:</h4>
            <div class="url-container">
                <input type="text" readonly value="${longUrl}" class="url-input" id="long-url">
                <button class="copy-btn" data-target="long-url">
                    <i class="material-icons">content_copy</i>
                    <span>نسخ</span>
                </button>
            </div>
        `;
        
        // قسم الروابط المختصرة
        const shortUrlSection = document.createElement('div');
        shortUrlSection.className = 'share-section';
        shortUrlSection.innerHTML = `
            <h4>تقصير الرابط:</h4>
            <div class="shortener-options">
                <button class="shortener-btn" data-service="tinyurl">
                    <i class="material-icons">link</i>
                    <span>TinyURL</span>
                </button>
                <button class="shortener-btn" data-service="isgd">
                    <i class="material-icons">link</i>
                    <span>is.gd</span>
                </button>
                <button class="shortener-btn" data-service="vgd">
                    <i class="material-icons">link</i>
                    <span>v.gd</span>
                </button>
                <button class="shortener-btn" data-service="auto">
                    <i class="material-icons">content_cut</i>
                    <span>تلقائي</span>
                </button>
            </div>
            <div class="short-url-result" id="short-url-result" style="display: none;">
                <input type="text" readonly class="url-input" id="short-url">
                <button class="copy-btn" data-target="short-url">
                    <i class="material-icons">content_copy</i>
                    <span>نسخ</span>
                </button>
            </div>
        `;
        
        // قسم المشاركة الاجتماعية
        const socialSection = document.createElement('div');
        socialSection.className = 'share-section';
        socialSection.innerHTML = `
            <h4>مشاركة على:</h4>
            <div class="social-buttons">
                <button class="social-btn" data-platform="whatsapp">
                    <i class="material-icons">whatsapp</i>
                    <span>WhatsApp</span>
                </button>
                <button class="social-btn" data-platform="twitter">
                    <i class="material-icons">alternate_email</i>
                    <span>Twitter</span>
                </button>
                <button class="social-btn" data-platform="facebook">
                    <i class="material-icons">facebook</i>
                    <span>Facebook</span>
                </button>
                <button class="social-btn" data-platform="telegram">
                    <i class="material-icons">send</i>
                    <span>Telegram</span>
                </button>
            </div>
        `;
        
        body.appendChild(this.exporter.createPanel());
        body.appendChild(numbersSection);
        body.appendChild(longUrlSection);
        body.appendChild(shortUrlSection);
        body.appendChild(socialSection);
        
        // إضافة CSS
        this.addShareStyles();
        
        // التجميع الصحيح
        content.appendChild(header);
        content.appendChild(body);
        dialog.appendChild(content);
        document.body.appendChild(dialog);
        
        // إضافة الأحداث
        this.attachShareEvents(dialog, state);
        
        // إغلاق الحوار عند النقر خارج المحتوى
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) {
                this.closeShareDialog();
            }
        });
        
        // منع الإغلاق عند النقر على الأزرار
        const closeBtn = dialog.querySelector('.share-close-btn');
        closeBtn.addEventListener('click', () => this.closeShareDialog());
    }

    addShareStyles() {
        if (document.getElementById("share-style")) return;

        const style = document.createElement('style');
        style.id = "share-style";
        style.textContent = `
            .share-dialog-overlay {
                position: fixed; inset: 0;
                background: rgba(0,0,0,.6);
                display: flex; align-items: center; justify-content: center;
                z-index: 1000000; font-family: 'Tajawal', sans-serif; direction: rtl;
                animation: fadeIn 0.3s ease-out;
            }
            .share-dialog-content {
                background: #fff; border-radius: 16px;
                width: 90%; max-width: 560px; max-height: 88vh; display:flex; flex-direction:column;
                overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,.3);
                animation: slideUp 0.3s ease-out;
            }
            .share-dialog-header {
                display: flex; justify-content: space-between;
                padding: 20px; border-bottom: 1px solid #eee;
            }
            .share-dialog-header h3 {
                margin: 0; font-size: 20px; color: #333;
            }
            .share-dialog-body { padding: 20px; overflow-y: auto; min-height:0; }
            .share-section { margin-bottom: 24px; }
            .url-container { display: flex; gap: 10px; }
            .url-input { 
                flex: 1; 
                padding: 10px; 
                border-radius: 8px; 
                border: 1px solid #ddd; 
                font-family: 'Tajawal', sans-serif;
                font-size: 14px;
            }
            .copy-btn {
                display: flex; gap: 5px; align-items: center;
                background: #4285f4; color: #fff;
                border: none; border-radius: 8px; 
                padding: 8px 12px;
                cursor: pointer; font-family: 'Tajawal', sans-serif;
                transition: background-color 0.2s;
            }
            .copy-btn:hover {
                background: #3367d6;
            }
            .shortener-options {
                display: flex; gap: 10px; flex-wrap: wrap;
                margin-bottom: 15px;
            }
            .shortener-btn {
                display: flex; align-items: center; gap: 8px;
                padding: 10px 15px; border: 1px solid #ddd;
                border-radius: 8px; background: white;
                cursor: pointer; font-family: 'Tajawal', sans-serif;
                font-size: 14px; transition: all 0.2s;
            }
            .shortener-btn:hover {
                background-color: #f5f5f5;
                transform: translateY(-2px);
            }
            .short-url-result {
                margin-top: 15px;
                animation: fadeIn 0.3s ease-out;
            }
            .social-buttons {
                display: flex; gap: 10px; flex-wrap: wrap;
            }
            .social-btn {
                display: flex; align-items: center; gap: 8px;
                padding: 10px 15px; border: none;
                border-radius: 8px; cursor: pointer;
                font-family: 'Tajawal', sans-serif;
                font-size: 14px; transition: all 0.2s;
            }
            .social-btn:hover {
                transform: translateY(-2px);
            }
            .social-btn.whatsapp { background: #25D366; color: white; }
            .social-btn.twitter { background: #1DA1F2; color: white; }
            .social-btn.facebook { background: #4267B2; color: white; }
            .social-btn.telegram { background: #0088cc; color: white; }
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            @keyframes slideUp {
                from { 
                    transform: translateY(20px);
                    opacity: 0;
                }
                to { 
                    transform: translateY(0);
                    opacity: 1;
                }
            }
        `;
        document.head.appendChild(style);
    }

    attachShareEvents(dialog, state) {
        const fullLinkInput = dialog.querySelector('#long-url');
        const showRouteNumbersInput = dialog.querySelector('#share-route-numbers');
        // عند تبديل الخيار نُنشئ رابطًا جديدًا يحفظ الإعداد بداخله.
        // تُلغى نتيجة التقصير القديمة حتى لا تُنسخ برابط بإعداد مختلف.
        showRouteNumbersInput.addEventListener('change', () => {
            const shareState = {
                ...state,
                shareOptions: {
                    ...(state.shareOptions || {}),
                    showRouteNumbers: showRouteNumbersInput.checked
                }
            };
            fullLinkInput.value = STATE.writeShare(shareState);
            const shortResult = dialog.querySelector('#short-url-result');
            const shortLinkInput = dialog.querySelector('#short-url');
            if (shortResult) shortResult.style.display = 'none';
            if (shortLinkInput) shortLinkInput.value = '';
        });

        // نسخ الروابط
        dialog.querySelectorAll('.copy-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const targetId = btn.dataset.target;
                const input = document.getElementById(targetId);
                const url = input.value;
                
                try {
                    await navigator.clipboard.writeText(url);
                    this.showCopySuccess(btn);
                } catch {
                    this.fallbackCopyToClipboard(url, btn);
                }
            });
        });
        
        // Shortener actions: keep button contents intact and prevent duplicate requests.
        dialog.querySelectorAll('.shortener-btn').forEach(btn => {
            const originalHTML = btn.innerHTML;
            btn.addEventListener('click', async () => {
                if (btn.disabled) return;
                const service = btn.dataset.service;
                const currentLongUrl = fullLinkInput.value.trim();
                if (!currentLongUrl) {
                    bus.emit('toast', 'لا يوجد رابط لتقصيره');
                    return;
                }
                btn.disabled = true;
                btn.innerHTML = '<i class="material-icons">hourglass_empty</i><span>جاري التقصير...</span>';
                try {
                    const shortUrl = await this.shortenUrl(currentLongUrl, service);
                    if (currentLongUrl === fullLinkInput.value.trim()) {
                        this.showShortUrl(shortUrl);
                        bus.emit('toast', 'تم تقصير الرابط بنجاح');
                    }
                } catch (error) {
                    console.error('URL shortening failed:', service, error);
                    bus.emit('toast', 'تعذر تقصير الرابط عبر هذه الخدمة؛ جرّب خدمة أخرى أو انسخ الرابط الكامل');
                } finally {
                    btn.disabled = false;
                    btn.innerHTML = originalHTML;
                }
            });
        });

        // المشاركة الاجتماعية
        dialog.querySelectorAll('.social-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const platform = btn.dataset.platform;
                const url = fullLinkInput.value;
                const text = "شاهد خريطة الدرعية الأمنية";
                
                let shareUrl = '';
                switch(platform) {
                    case 'whatsapp':
                        shareUrl = `https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}`;
                        break;
                    case 'twitter':
                        shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
                        break;
                    case 'facebook':
                        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(text)}`;
                        break;
                    case 'telegram':
                        shareUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
                        break;
                }
                
                if (shareUrl) {
                    window.open(shareUrl, '_blank', 'width=600,height=400');
                }
            });
        });
    }

    async shortenUrl(longUrl, service) {
        // These are third-party public APIs. Their browser CORS policies and
        // rate limits are outside this application's control.
        const endpoints = {
            tinyurl: `https://tinyurl.com/api-create.php?url=${encodeURIComponent(longUrl)}`,
            isgd: `https://is.gd/create.php?format=json&url=${encodeURIComponent(longUrl)}`,
            vgd: `https://v.gd/create.php?format=json&url=${encodeURIComponent(longUrl)}`
        };
        const choices = service === 'auto' ? ['isgd', 'vgd', 'tinyurl'] : [service];
        let lastError = new Error('خدمة غير معروفة');
        for (const choice of choices) {
            if (!endpoints[choice]) continue;
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 12000);
            try {
                const response = await fetch(endpoints[choice], {
                    method: 'GET',
                    mode: 'cors',
                    signal: controller.signal,
                    headers: { Accept: choice === 'tinyurl' ? 'text/plain' : 'application/json' }
                });
                if (!response.ok) throw new Error(`${choice}: HTTP ${response.status}`);
                const body = await response.text();
                let candidate;
                if (choice === 'tinyurl') {
                    candidate = body.trim();
                } else {
                    const parsed = JSON.parse(body);
                    if (parsed.errorcode || parsed.errormessage) {
                        throw new Error(parsed.errormessage || `Error ${parsed.errorcode}`);
                    }
                    candidate = parsed.shorturl;
                }
                const parsedUrl = new URL(candidate);
                if (parsedUrl.protocol !== 'https:' || !parsedUrl.hostname ||
                    !['tinyurl.com', 'is.gd', 'v.gd'].includes(parsedUrl.hostname.toLowerCase())) {
                    throw new Error(`${choice}: invalid short URL response`);
                }
                return parsedUrl.href;
            } catch (error) {
                lastError = error;
                console.warn('Shortening service unavailable:', choice, error);
            } finally {
                clearTimeout(timer);
            }
        }
        throw lastError;
    }

    showShortUrl(shortUrl) {
        const resultDiv = document.getElementById('short-url-result');
        const shortUrlInput = document.getElementById('short-url');
        
        resultDiv.style.display = 'block';
        shortUrlInput.value = shortUrl;
        
        // نسخ تلقائي الرابط المختصر
        setTimeout(() => {
            if (Utils.supportsModernClipboard()) {
                navigator.clipboard.writeText(shortUrl);
            } else {
                this.fallbackCopyToClipboard(shortUrl);
            }
        }, 100);
    }

    showCopySuccess(btn) {
        const originalContent = btn.innerHTML;
        btn.innerHTML = '<i class="material-icons">check</i><span>تم النسخ!</span>';
        btn.style.backgroundColor = '#4CAF50';
        
        setTimeout(() => {
            btn.innerHTML = originalContent;
            btn.style.backgroundColor = '#4285f4';
        }, 2000);
    }

    fallbackCopyToClipboard(text, buttonElement) {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
            const successful = document.execCommand('copy');
            document.body.removeChild(textArea);
            
            if (successful && buttonElement) {
                this.showCopySuccess(buttonElement);
            }
        } catch (err) {
            document.body.removeChild(textArea);
            console.error('Fallback copy failed:', err);
        }
    }

    closeShareDialog() {
        this.exporter.releasePreview();
        const dialog = document.querySelector('.share-dialog-overlay');
        if (dialog) {
            dialog.style.animation = 'fadeOut 0.3s ease-out';
            setTimeout(() => {
                document.body.removeChild(dialog);
            }, 300);
        }
    }
}

const SHARE = new ShareManager();

/*
============================================================
   MeasureManager
— أداة القياس
  ============================================================ */
class MeasureManager {
    constructor() {
        this.isActive = false;
        this.points = [];
        this.polyline = null;
        this.polygon = null;
        this.infoWindow = null;
        this.map = null;
        this.mapClickListener = null;
        this.mapRightClickListener = null;
        this.mapDblClickListener = null;

        bus.on("map:ready", map => {
            this.map = map;
        });
    }

    activate() {
        if (this.isActive) return;
        this.isActive = true;
        this.clearMeasurement();
        MAP.setCursor('crosshair');
        this.attachMapListeners();
        bus.emit("toast", "وضع القياس مفعل. انقر لإضافة نقاط، انقر بزر الماوس الأيمن للحذف، انقر نقرًا مزدوجًا للإنهاء.");
    }

    deactivate() {
        if (!this.isActive) return;
        this.isActive = false;
        this.clearMeasurement();
        MAP.setCursor('grab');
        this.detachMapListeners();
    }

    attachMapListeners() {
        this.mapClickListener = this.map.addListener('click', (e) => this.addPoint(e.latLng));
        this.mapRightClickListener = this.map.addListener('rightclick', () => this.removeLastPoint());
        this.mapDblClickListener = this.map.addListener('dblclick', () => this.finishMeasurement());
    }

    detachMapListeners() {
        if (this.mapClickListener) google.maps.event.removeListener(this.mapClickListener);
        if (this.mapRightClickListener) google.maps.event.removeListener(this.mapRightClickListener);
        if (this.mapDblClickListener) google.maps.event.removeListener(this.mapDblClickListener);
    }

    addPoint(latLng) {
        this.points.push(latLng);
        this.redrawMeasurement();
    }

    removeLastPoint() {
        if (this.points.length > 0) {
            this.points.pop();
            this.redrawMeasurement();
        }
    }

    redrawMeasurement() {
        // مسح الرسومات السابقة
        if (this.polyline) this.polyline.setMap(null);
        if (this.polygon) this.polygon.setMap(null);
        if (this.infoWindow) this.infoWindow.close();

        if (this.points.length === 0) return;

        // حساب المسافة
        let distance = 0;
        if (this.points.length > 1) {
            const path = new google.maps.MVCArray(this.points);
            distance = google.maps.geometry.spherical.computeLength(path);
        }

        // حساب المساحة
        let area = 0;
        if (this.points.length > 2) {
            area = google.maps.geometry.spherical.computeArea(this.points);
        }

        // رسم الخط
        this.polyline = new google.maps.Polyline({
            path: this.points,
            map: this.map,
            strokeColor: "#FF0000",
            strokeOpacity: 0.8,
            strokeWeight: 3,
            geodesic: true,
        });

        // رسم المضلع (إذا كانت هناك 3 نقاط أو أكثر)
        if (this.points.length > 2) {
            this.polygon = new google.maps.Polygon({
                paths: this.points,
                map: this.map,
                fillColor: "#FF0000",
                fillOpacity: 0.2,
                strokeOpacity: 0,
            });
        }

        // عرض النتيجة في نافذة معلومات
        const lastPoint = this.points[this.points.length - 1];
        let content = `<div style="direction: rtl; font-family: 'Tajawal', sans-serif;">`;
        content += `<b>المسافة الإجمالية:</b> ${Utils.formatDistance(distance)}<br>`;
        if (area > 0) {
            content += `<b>المساحة الإجمالية:</b> ${Utils.formatArea(area)}`;
        }
        content += `</div>`;

        if (!this.infoWindow) {
            this.infoWindow = new google.maps.InfoWindow({ disableAutoPan: false });
        }
        this.infoWindow.setContent(content);
        this.infoWindow.setPosition(lastPoint);
        this.infoWindow.open(this.map);
    }

    finishMeasurement() {
        this.deactivate();
        bus.emit("toast", "تم الانتهاء من القياس");
    }

    clearMeasurement() {
        if (this.polyline) {
            this.polyline.setMap(null);
            this.polyline = null;
        }
        if (this.polygon) {
            this.polygon.setMap(null);
            this.polygon = null;
        }
        if (this.infoWindow) {
            this.infoWindow.close();
        }
        this.points = [];
    }
}

const MEASURE = new MeasureManager();

/*
============================================================
   UIManager
— واجهة المستخدم (مع نافذة معلومات متجاوبة بالكامل)
  ============================================================ */
class UIManager {

    constructor() {
        this.logo = "/img/logo.png";
        this.sharedInfoWindow = null;
        this.infoWindowPinned = false;
        this._initialized = false;

        this.btnLayers = document.getElementById("btn-layers");
        this.btnAdd = document.getElementById("btn-add");
        this.btnRoute = document.getElementById("btn-route");
        this.btnPolygon = document.getElementById("btn-polygon");
        this.btnMeasure = document.getElementById("btn-measure");
        this.btnFreeDraw = document.getElementById("btn-free-draw");
        this.btnDrawFinish = document.getElementById("btn-draw-finish");
        this.btnRouteClear = document.getElementById("btn-route-clear");
        this.btnEdit = document.getElementById("btn-edit");

        this.layersPanel = document.getElementById("layers-panel");
        this.btnCloseLayers = document.getElementById("btn-close-layers");

        this.modeBadge = document.getElementById("mode-badge");
        this.toastElement = document.getElementById("toast");
        this.toastTimer = null;

        bus.on("map:ready", () => this.initializeUI());
        bus.on("toast", msg => this.showToast(msg));
    }

    initializeUI() {
        if (this._initialized) return;
        this._initialized = true;

        console.log("UI: initializeUI() called.");
        // حذف المسار أصبح ضمن نافذة «مسار»؛ لا نعرض الزر العام.
        if (this.btnRouteClear) this.btnRouteClear.style.setProperty("display", "none", "important");

        /* ---------- CSS Injection (مرة واحدة) ---------- */
        if (!document.getElementById("ui-infowindow-style")) {
            const style = document.createElement("style");
            style.id = "ui-infowindow-style";
            style.innerHTML = `
                .gm-style-iw-c {
                    background: transparent !important;
                    box-shadow: none !important;
                    padding: 0 !important;
                    border-radius: 0 !important;
                    overflow: visible !important;
                }
                .gm-style-iw-d {
                    overflow: visible !important;
                    max-height: none !important;
                    padding: 0 !important;
                    background: transparent !important;
                }
                .gm-style-iw-tc { display: none !important; }
                .gm-ui-hover-effect {
                    display: none !important;
                    opacity: 0 !important;
                    pointer-events: none !important;
                }
            `;
            document.head.appendChild(style);
        }

        /* ---------- Share Mode ---------- */
        if (MAP.shareMode) {
            this.applyShareMode();
        }

        /* ---------- InfoWindow ---------- */
        this.sharedInfoWindow = new google.maps.InfoWindow();

        MAP.map.addListener("click", () => {
            if (MAP.shareMode) this.forceCloseSharedInfoCard();
            else this.closeSharedInfoCard();
        });

        /* ---------- Layers Panel ---------- */
        if (this.btnLayers && !MAP.shareMode) {
            this.btnLayers.addEventListener("click", () => this.toggleLayersPanel());
        }
        if (this.btnCloseLayers && !MAP.shareMode) {
            this.btnCloseLayers.addEventListener("click", () => this.toggleLayersPanel());
        }

        /* ---------- Base Maps ---------- */
        if (!MAP.shareMode) {
            const baseMapGroup = this.layersPanel.querySelector('input[name="base-map"]').closest(".layer-group");
            for (const { id, name } of EXTRA_BASE_MAPS) {
                const label = document.createElement("label");
                const radio = document.createElement("input");
                radio.type = "radio";
                radio.name = "base-map";
                radio.value = id;
                label.append(radio, " " + name);
                baseMapGroup.append(label);
            }
            this.layersPanel.querySelector(".panel-content").style.maxHeight = "min(65vh, 34rem)";
            this.layersPanel.querySelector(".panel-content").style.overflowY = "auto";

            document.querySelectorAll('input[name="base-map"]').forEach(radio => {
                radio.addEventListener('change', () => {
                    this.setBaseMap(radio.value);
                });
            });

            document.querySelectorAll("#layer-traffic, #layer-bicycling, #layer-transit")
                .forEach(cb => {
                    cb.addEventListener('change', () => {
                        this.toggleLayer(cb.id, cb.checked);
                    });
                });
        }

        /* ---------- Edit Mode ---------- */
        if (this.btnEdit && !MAP.shareMode) {
            this.btnEdit.addEventListener("click", () => {
                MAP.setEditMode(!MAP.editMode);
                this.btnEdit.setAttribute(
                    "aria-pressed",
                    MAP.editMode ? "true" : "false"
                );
                this.updateModeBadge();
                if (!MAP.editMode) this.showDefaultUI();
            });
        }

        if (!MAP.shareMode) {
            this.bindEditButtons();
        }

        this.updateModeBadge();
    }

    bindEditButtons() {
        if (this.btnAdd) {
            this.btnAdd.addEventListener("click", () => {
                if (!MAP.editMode) return this.showToast("فعّل وضع التحرير");
                this.setActiveMode("add");
            });
        }

        if (this.btnRoute) {
            this.btnRoute.addEventListener("click", () => {
                if (!MAP.editMode) return this.showToast("فعّل وضع التحرير");
                ROUTES.chooseDrawingMode();
            });
        }

        if (this.btnPolygon) {
            this.btnPolygon.addEventListener("click", () => {
                if (!MAP.editMode) return this.showToast("فعّل وضع التحرير");
                this.setActiveMode("polygon");
            });
        }

        if (this.btnMeasure) {
            this.btnMeasure.addEventListener("click", () => {
                if (!MAP.editMode) return this.showToast("فعّل وضع التحرير");
                this.setActiveMode("measure");
            });
        }

        if (this.btnFreeDraw) {
            this.btnFreeDraw.addEventListener("click", () => {
                if (!MAP.editMode) return this.showToast("فعّل وضع التحرير");
                this.setActiveMode("freedraw");
            });
        }

        if (this.btnDrawFinish) {
            this.btnDrawFinish.addEventListener("click", () => {
                if (POLYGONS.isEditing) POLYGONS.exitEditMode();
                else if (MAP.modeRouteAdd) ROUTES.finishCurrentRoute();
                else if (MAP.modePolygonAdd) POLYGONS.finishCurrentPolygon();
                this.showDefaultUI();
            });
        }

        if (this.btnRouteClear) {
            this.btnRouteClear.addEventListener("click", () => {
                if (ROUTES.activeRouteIndex === -1)
                    return this.showToast("لا يوجد مسار نشط لحذفه");
                if (!confirm("حذف المسار الحالي؟")) return;
                ROUTES.removeRoute(ROUTES.activeRouteIndex);
                this.showDefaultUI();
                this.showToast("تم حذف المسار");
            });
        }
    }

    toggleLayersPanel() {
        if (!this.layersPanel) return;
        const currentType = MAP.map.getMapTypeId();
        this.layersPanel.querySelectorAll('input[name="base-map"]').forEach(input => { input.checked = input.value === currentType; });
        this.layersPanel.classList.toggle("show");
        const isOpen = this.layersPanel.classList.contains("show");
        if (this.btnLayers) {
            this.btnLayers.setAttribute("aria-pressed", isOpen ? "true" : "false");
        }
    }

    setBaseMap(mapTypeId) {
        switch (mapTypeId) {
            case "roadmap": MAP.setRoadmap(); break;
            case "satellite": MAP.setSatellite(); break;
            case "terrain": MAP.setTerrain(); break;
            case "dark": MAP.setDarkMode(); break;
            case "silver": MAP.setSilverMode(); break;
            default:
                if (EXTRA_BASE_MAPS.some(({ id }) => id === mapTypeId)) MAP.map.setMapTypeId(mapTypeId);
        }
    }

    toggleLayer(layerId) {
        switch (layerId) {
            case "layer-traffic": MAP.toggleTraffic(); break;
            case "layer-bicycling": MAP.toggleBicycling(); break;
            case "layer-transit": MAP.toggleTransit(); break;
        }
    }

    openSharedInfoCard(content, position, isPinned = false) {
        this.sharedInfoWindow.close();
        this.sharedInfoWindow.setContent(content);
        this.sharedInfoWindow.setPosition(position);
        this.sharedInfoWindow.setOptions({
            maxWidth: 450,
            pixelOffset: new google.maps.Size(0, -50),
            zIndex: 1000
        });
        this.sharedInfoWindow.open({ map: MAP.map });
        this.infoWindowPinned = isPinned;
    }

    closeSharedInfoCard() {
        if (this.sharedInfoWindow && !this.infoWindowPinned) {
            this.sharedInfoWindow.close();
        }
        this.infoWindowPinned = false;
    }

    forceCloseSharedInfoCard() {
        if (this.sharedInfoWindow) {
            this.sharedInfoWindow.close();
        }
        this.infoWindowPinned = false;
    }

    setActiveMode(mode) {
        if (POLYGONS.isEditing) {
            this.showToast("يرجى إنهاء تحرير المضلع الحالي أولاً");
            return;
        }

        MAP.modeAdd = false;
        MAP.modeRouteAdd = false;
        MAP.modePolygonAdd = false;
        MAP.modeFreeDraw = false;
        MEASURE.deactivate();

        if (this.btnAdd) this.btnAdd.setAttribute("aria-pressed", "false");
        if (this.btnRoute) this.btnRoute.setAttribute("aria-pressed", "false");
        if (this.btnPolygon) this.btnPolygon.setAttribute("aria-pressed", "false");
        if (this.btnMeasure) this.btnMeasure.setAttribute("aria-pressed", "false");
        if (this.btnFreeDraw) this.btnFreeDraw.setAttribute("aria-pressed", "false");

        MAP.setCursor("grab");

        switch (mode) {
            case "add":
                MAP.modeAdd = true;
                MAP.setCursor("crosshair");
                this.showDefaultUI();
                this.showToast("اضغط على الخريطة لإضافة موقع");
                break;

            case "route":
                ROUTES.startNewRouteSequence();
                MAP.modeRouteAdd = true;
                MAP.setCursor("crosshair");
                this.showDrawFinishUI();
                this.showToast("اضغط لإضافة نقاط المسار");
                break;

            case "polygon":
                POLYGONS.startPolygonSequence();
                MAP.modePolygonAdd = true;
                MAP.setCursor("crosshair");
                this.showDrawFinishUI();
                this.showToast("اضغط لإضافة رؤوس المضلع");
                break;

            case "measure":
                MEASURE.activate();
                this.showDefaultUI();
                break;

            case "freedraw":
                MAP.modeFreeDraw = true;
                MAP.setCursor("crosshair");
                this.showDefaultUI();
                this.showToast("اضغط على الخريطة لإضافة أيقونة أو نص");
                break;

            default:
                this.showDefaultUI();
        }
    }

    applyShareMode() {
        [
            this.btnAdd,
            this.btnRoute,
            this.btnPolygon,
            this.btnMeasure,
            this.btnFreeDraw,
            this.btnDrawFinish,
            this.btnRouteClear,
            this.btnEdit,
            this.btnLayers
        ].forEach(btn => {
            if (btn) btn.style.display = "none";
        });

        this.updateModeBadge("view");
    }

    showDrawFinishUI() {
        if (this.btnAdd) this.btnAdd.style.display = "none";
        if (this.btnRoute) this.btnRoute.style.display = "none";
        if (this.btnPolygon) this.btnPolygon.style.display = "none";
        if (this.btnMeasure) this.btnMeasure.style.display = "none";
        if (this.btnFreeDraw) this.btnFreeDraw.style.display = "none";
        if (this.btnDrawFinish) this.btnDrawFinish.style.display = "inline-block";
    }

    showDefaultUI() {
        if (this.btnRoute) this.btnRoute.style.display = "inline-block";
        if (this.btnPolygon) this.btnPolygon.style.display = "inline-block";
        if (this.btnMeasure) this.btnMeasure.style.display = "inline-block";
        if (this.btnFreeDraw) this.btnFreeDraw.style.display = "inline-block";
        if (this.btnDrawFinish) this.btnDrawFinish.style.display = "none";
    }

    showPolygonEditingUI() {
        [
            this.btnAdd,
            this.btnRoute,
            this.btnPolygon,
            this.btnMeasure,
            this.btnFreeDraw
        ].forEach(btn => {
            if (btn) btn.style.display = "none";
        });
        if (this.btnDrawFinish) this.btnDrawFinish.style.display = "inline-block";
    }

    updateModeBadge(forceMode = null) {
        if (!this.modeBadge) return;
        const mode = forceMode || (MAP.editMode ? "edit" : "view");
        this.modeBadge.style.display = "block";
        this.modeBadge.textContent =
            mode === "edit" ? "وضع التحرير" : "وضع العرض";
        this.modeBadge.className = "";
        this.modeBadge.classList.add("badge", mode);
    }

    showToast(message) {
        if (!this.toastElement) return;
        this.toastElement.innerHTML = `
            <div style="display:flex;align-items:center;gap:8px;">
                <img src="${this.logo}" style="width:22px;height:22px;border-radius:6px;">
                <span style="font-family:'Tajawal',sans-serif;">${message}</span>
            </div>
        `;
        this.toastElement.classList.add("show");
        clearTimeout(this.toastTimer);
        this.toastTimer = setTimeout(() => {
            this.toastElement.classList.remove("show");
        }, 2600);
    }
}

const UI = new UIManager();

/*
============================================================
   BootLoader
— التشغيل النهائي
============================================================
*/
class BootLoader {

    constructor() {

        this.booted = false;

        this.tryBoot();
        document.addEventListener("DOMContentLoaded", () => this.tryBoot());
        window.addEventListener("load", () => this.tryBoot());
    }

    tryBoot() {

        if (this.booted) return;

        if (window.google && google.maps && 
            document.readyState !== "loading") {

            this.booted = true;
            this.start();
        }
    }

    start() {

        console.log("Diriyah Security Map v25.8 - Fixed Route Deletion & Share Mode");

        bus.on("map:zoom", z => {
            bus.emit("markers:scale", z);
        });

        bus.on("map:bounds", () => {
            bus.emit("persist");
        });

        this.finish();
    }

    finish() {
        console.log("System initialization completed.");
        bus.emit("toast", "تم تحميل النظام بنجاح");
    }
}

const BOOT = new BootLoader();
