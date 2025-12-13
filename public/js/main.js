'use strict';

/*
============================================================
   Diriyah Security Map – v25.0 (Enhanced Free Draw Mode)
   • إصلاح خطأ استمرار الرسم بعد الضغط على "إنهاء الرسم"
   • إعادة المؤشر للوضع الطبيعي عند الانتهاء
   • منع إضافة نقاط جديدة بعد الحفظ
   • إضافة وضع الرسم الحر (Free Draw Mode)
   • تحسين خيارات التحرير للنصوص والأيقونات
   • إصلاح مشاكل المشاركة وتقصير الروابط
   • إصلاح مشكلة النقر على العناصر الحرة للتعديل
   • إضافة أيقونات إضافية للسلامة المرورية والأمن
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
    }
};

/*
============================================================
   MapController
— وحدة إدارة الخريطة (مع دعم الطبقات المتقدمة)
============================================================
*/
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
        console.log("Boot v25.0 - Final Polygon Fix + Free Draw Mode");

        const params = new URLSearchParams(location.search);
        this.shareMode = params.has("x");
        this.editMode = !this.shareMode;

        // تعريف الأنماط المخصصة للخريطة
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

        this.map.addListener("zoom_changed", () => {
            bus.emit("map:zoom", this.map.getZoom());
        });

        this.map.addListener("bounds_changed", () => {
            bus.emit("map:bounds");
        });

        this.waitForGmpMarkersAndEmit();
    }

    waitForGmpMarkersAndEmit() {
        if (typeof google.maps.marker !== 'undefined' && typeof google.maps.marker.AdvancedMarkerElement !== 'undefined') {
            console.log("gmp-markers library is ready. Emitting 'map:ready' event.");
            bus.emit("map:ready", this.map);
        } else {
            console.log("Waiting for gmp-markers library...");
            setTimeout(() => this.waitForGmpMarkersAndEmit(), 100);
        }
    }

    setRoadmap() { this.map.setMapTypeId("roadmap"); }
    setSatellite() { this.map.setMapTypeId("hybrid"); }
    setTerrain() { this.map.setMapTypeId("terrain"); }
    setDarkMode() { this.map.setMapTypeId("dark"); }
    setSilverMode() { this.map.setMapTypeId("silver"); }

    toggleTraffic() {
        if (this.trafficLayer.getMap()) {
            this.trafficLayer.setMap(null);
        } else {
            this.trafficLayer.setMap(this.map);
        }
    }

    toggleBicycling() {
        if (this.bicyclingLayer.getMap()) {
            this.bicyclingLayer.setMap(null);
        } else {
            this.bicyclingLayer.setMap(this.map);
        }
    }

    toggleTransit() {
        if (this.transitLayer.getMap()) {
            this.transitLayer.setMap(null);
        } else {
            this.transitLayer.setMap(this.map);
        }
    }

    setCursor(c) {
        this.map.setOptions({ draggableCursor: c });
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
            security: ['security', 'local_police', 'gpp_good', 'gpp_bad', 'policy', 'verified_user', 'shield', 'lock', 'lock_open', 'vpn_key', 'privacy_tip'],
            traffic: ['traffic', 'traffic_jam', 'add_road', 'add_road_sharp', 'do_not_step', 'crossing', 'traffic_light', 'roundabout', 'merge', 'lane_change', 'turn_left', 'turn_right', 'u_turn'],
            roads: ['add_road', 'fork_right', 'fork_left', 't_junction', 'roundabout', 'straight', 'curved_road', 'intersection', 'highway', 'expressway']
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
                roads: 'الطرق'
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
        });
    }
    
    createIconMarker(item) {
        const iconElement = document.createElement('div');
        iconElement.className = 'free-draw-icon';
        iconElement.innerHTML = `<i class="material-icons" style="color: ${item.color}; font-size: ${24 * item.scale}px;">${item.iconName}</i>`;
        
        item.marker = new google.maps.marker.AdvancedMarkerElement({
            position: item.position,
            map: this.map,
            content: iconElement,
            gmpDraggable: this.editMode && !this.shareMode
        });
        
        // FIX: Add a direct click listener to the marker content for reliable editing
        iconElement.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent map click
            this.openEditCard(item);
        });
        
        if (this.editMode && !this.shareMode) {
            item.marker.addListener("dragend", () => {
                item.position = item.marker.position;
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
        this.openEditCard(item);
        
        bus.emit("persist");
        bus.emit("toast", "تمت إضافة نص");
    }
    
    createTextMarker(item) {
        const textElement = document.createElement('div');
        textElement.className = 'free-draw-text';
        
        // Apply background style
        this.applyTextBackgroundStyle(textElement, item);
        
        textElement.innerHTML = item.text;
        
        item.marker = new google.maps.marker.AdvancedMarkerElement({
            position: item.position,
            map: this.map,
            content: textElement,
            gmpDraggable: this.editMode && !this.shareMode
        });

        // FIX: Add a direct click listener to the marker content for reliable editing
        textElement.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent map click
            this.openEditCard(item);
        });
        
        if (this.editMode && !this.shareMode) {
            item.marker.addListener("dragend", () => {
                item.position = item.marker.position;
                bus.emit("persist");
            });
        }
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
        
        // Apply specific background style
        switch (item.backgroundStyle) {
            case 'white':
                element.style.padding = '5px 10px';
                element.style.borderRadius = '4px';
                element.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
                element.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
                break;
            case 'dark':
                element.style.padding = '5px 10px';
                element.style.borderRadius = '4px';
                element.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
                element.style.color = '#ffffff';
                element.style.boxShadow = '0 2px 5px rgba(0,0,0,0.3)';
                break;
            case 'outline':
                element.style.padding = '3px 8px';
                element.style.borderRadius = '4px';
                element.style.border = `2px solid ${item.textColor}`;
                element.style.backgroundColor = 'rgba(255, 255, 255, 0.7)';
                break;
            // 'none' is already applied by default
        }
    }
    
    openEditCard(item) {
        this.activeItem = item;
        
        const cardStyle = `
            font-family: 'Tajawal', 'Cairo', sans-serif;
            background: rgba(255, 255, 255, 0.85);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border-radius: 16px;
            border: none;
            box-shadow: 0 8px 32px rgba(31, 38, 135, 0.15);
            padding: 0;
            color: #333;
            direction: rtl;
            width: 320px;
            max-width: 95vw;
            max-height: 70vh;
            overflow-y: auto;
            overflow-x: hidden;
        `;
        
        const headerStyle = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 16px;
            background: rgba(255, 255, 255, 0.7);
            border-bottom: 1px solid rgba(255, 255, 255, 0.2);
        `;
        
        const bodyStyle = `padding: 16px;`;
        const footerStyle = `
            padding: 12px 16px;
            background: rgba(255, 255, 255, 0.7);
            border-top: 1px solid rgba(255, 255, 255, 0.2);
            display: flex;
            justify-content: flex-end;
            gap: 8px;
        `;
        
        let bodyContent = '';
        
        if (item.type === 'icon') {
            bodyContent = `
                <div style="margin-bottom: 12px;">
                    <label style="font-size: 12px; display: block; margin-bottom: 4px; font-weight: bold;">الأيقونة:</label>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <i class="material-icons" style="font-size: 24px; color: ${item.color};">${item.iconName}</i>
                        <button id="change-icon-btn" style="padding: 6px 12px; border: 1px solid #ddd; border-radius: 4px; background: white; cursor: pointer; font-family: 'Tajawal', sans-serif;">تغيير</button>
                    </div>
                </div>
                <div style="margin-bottom: 12px;">
                    <label style="font-size: 12px; display: block; margin-bottom: 4px; font-weight: bold;">اللون:</label>
                    <input id="icon-color" type="color" value="${item.color}" style="width: 100%; height: 36px; border: none; border-radius: 4px; cursor: pointer;">
                </div>
                <div style="margin-bottom: 12px;">
                    <label style="font-size: 12px; display: block; margin-bottom: 4px; font-weight: bold;">الحجم: <span id="icon-scale-value">${item.scale}x</span></label>
                    <input id="icon-scale" type="range" min="0.5" max="3" step="0.1" value="${item.scale}" style="width: 100%;">
                </div>
            `;
        } else if (item.type === 'text') {
            bodyContent = `
                <div style="margin-bottom: 12px;">
                    <label style="font-size: 12px; display: block; margin-bottom: 4px; font-weight: bold;">النص:</label>
                    <textarea id="text-content" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; resize: vertical; min-height: 60px; font-family: 'Tajawal', sans-serif;">${item.text}</textarea>
                </div>
                <div style="margin-bottom: 12px;">
                    <label style="font-size: 12px; display: block; margin-bottom: 4px; font-weight: bold;">نمط الخلفية:</label>
                    <select id="text-background" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-family: 'Tajawal', sans-serif;">
                        <option value="none" ${item.backgroundStyle === 'none' ? 'selected' : ''}>بدون خلفية</option>
                        <option value="white" ${item.backgroundStyle === 'white' ? 'selected' : ''}>مربع أبيض</option>
                        <option value="dark" ${item.backgroundStyle === 'dark' ? 'selected' : ''}>مربع داكن</option>
                        <option value="outline" ${item.backgroundStyle === 'outline' ? 'selected' : ''}>إطار</option>
                    </select>
                </div>
                <div style="margin-bottom: 12px;">
                    <label style="font-size: 12px; display: block; margin-bottom: 4px; font-weight: bold;">لون النص:</label>
                    <input id="text-color" type="color" value="${item.textColor}" style="width: 100%; height: 36px; border: none; border-radius: 4px; cursor: pointer;">
                </div>
                <div style="margin-bottom: 12px;">
                    <label style="font-size: 12px; display: block; margin-bottom: 4px; font-weight: bold;">حجم الخط: <span id="text-size-value">${item.fontSize}px</span></label>
                    <input id="text-size" type="range" min="12" max="36" step="1" value="${item.fontSize}" style="width: 100%;">
                </div>
            `;
        }
        
        const html = `
            <div style="${cardStyle}" class="free-draw-edit-card">
                <div style="${headerStyle}">
                    <h3 style="margin: 0; font-size: 16px;">${item.type === 'icon' ? 'تعديل الأيقونة' : 'تعديل النص'}</h3>
                </div>
                <div style="${bodyStyle}">
                    ${bodyContent}
                </div>
                <div style="${footerStyle}">
                    <button id="delete-btn" style="padding: 8px 12px; border: none; border-radius: 4px; background-color: #ea4335; color: white; cursor: pointer; font-family: 'Tajawal', sans-serif;">حذف</button>
                    <button id="cancel-btn" style="padding: 8px 12px; border: none; border-radius: 4px; background-color: #f5f5f5; color: #333; cursor: pointer; font-family: 'Tajawal', sans-serif;">إلغاء</button>
                    <button id="save-btn" style="padding: 8px 12px; border: none; border-radius: 4px; background-color: #4285f4; color: white; cursor: pointer; font-family: 'Tajawal', sans-serif;">حفظ</button>
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
                    this.deleteItem(item);
                    UI.forceCloseSharedInfoCard();
                }
            });
        }
        
        if (item.type === 'icon') {
            const changeIconBtn = document.getElementById("change-icon-btn");
            const colorInput = document.getElementById("icon-color");
            const scaleInput = document.getElementById("icon-scale");
            const scaleValue = document.getElementById("icon-scale-value");
            
            if (changeIconBtn) {
                changeIconBtn.addEventListener("click", () => {
                    this.iconPicker.show((iconName) => {
                        item.iconName = iconName;
                        this.updateIconMarker(item);
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
        iconElement.innerHTML = `<i class="material-icons" style="color: ${item.color}; font-size: ${24 * item.scale}px;">${item.iconName}</i>`;
    }
    
    updateTextMarker(item) {
        const textElement = item.marker.content;
        this.applyTextBackgroundStyle(textElement, item);
        textElement.innerHTML = item.text;
    }
    
    deleteItem(item) {
        item.marker.map = null;
        this.items = this.items.filter(i => i.id !== item.id);
        bus.emit("persist");
        bus.emit("toast", "تم حذف العنصر");
    }
    
    exportState() {
        return {
            freeDraw: this.items.map(item => {
                const result = {
                    id: item.id,
                    type: item.type,
                    lat: item.position.lat(),
                    lng: item.position.lng()
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
        if (!this.shareMode && this.items.length === 0) {
            this.waitForGmpMarkersAndLoad();
        }

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

    waitForGmpMarkersAndLoad() {
        if (typeof google.maps.marker !== 'undefined' && typeof google.maps.marker.AdvancedMarkerElement !== 'undefined') {
            this.loadDefaultLocations();
        } else {
            setTimeout(() => this.waitForGmpMarkersAndLoad(), 100);
        }
    }

    loadDefaultLocations() { 
        const LOCS = [
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
        LOCS.forEach(loc => this.addItem({ 
            id: "d" + Date.now() + Math.random(),
            name: loc.name,
            lat: loc.lat,
            lng: loc.lng,
            radius: 22,
            color: "#ff0000", 
            fillOpacity: 0.3,
            recipients: [],
            iconType: loc.iconType 
        })); 
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
            iconEl.style.color = 'white';
            iconEl.style.fontSize = '20px';

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
            lng: it.marker.position.lng,
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
— إدارة المسارات + بطاقات Glass
  ============================================================ */
class RouteManager {

    constructor() {
        this.routes = [];
        this.map = null;
        this.shareMode = false;
        this.editMode = true;
        this.directionsService = null;
        this.activeRouteIndex = -1;

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
            if (!MAP.modeRouteAdd || this.shareMode) return;
            if (this.activeRouteIndex === -1) this.createNewRoute();
            this.addPointToRoute(this.activeRouteIndex, e.latLng);
        });
    }

    startNewRouteSequence() { this.activeRouteIndex = -1; }
    finishCurrentRoute() {
        if (this.activeRouteIndex === -1) return;
        const rt = this.routes[this.activeRouteIndex];
        if (rt.poly) rt.poly.setMap(null);
        rt.stops.forEach(s => s.map = null);
        if (rt.points.length >= 2) {
            this.renderRoute(this.activeRouteIndex);
            bus.emit("persist");
        } else {
            this.routes.pop();
        }
        this.activeRouteIndex = -1;
        MAP.modeRouteAdd = false;
        MAP.setCursor("grab");
    }

    createNewRoute() {
        const route = { id: "rt" + Date.now(), points: [], color: "#3344ff", weight: 6, opacity: 0.95, distance: 0, duration: 0, overview: null, poly: null, stops: [], notes: "" };
        this.routes.push(route);
        this.activeRouteIndex = this.routes.length - 1;
        return route;
    }

    addPointToRoute(routeIndex, latLng) {
        const rt = this.routes[routeIndex];
        rt.points.push(latLng);
        const stop = this.createStopMarker(latLng, routeIndex, rt.points.length - 1);
        rt.stops.push(stop);
        if (rt.points.length >= 2) this.requestRoute(routeIndex);
        else bus.emit("persist");
    }

    createStopMarker(pos, routeIndex, idx) {
        const rt = this.routes[routeIndex];
        const el = document.createElement("div");
        el.style.cssText = `width:22px; height:22px; background:white; border-radius:50%; border:2px solid ${rt.color}; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:bold; z-index:101;`;
        el.textContent = idx + 1;
        const marker = new google.maps.marker.AdvancedMarkerElement({ position: pos, map: this.map, content: el, gmpDraggable: !this.shareMode });
        marker.addListener("dragend", () => { rt.points[idx] = marker.position; this.requestRoute(routeIndex); bus.emit("persist"); });
        marker.addListener("contextmenu", () => { if (this.shareMode) return; this.removePoint(routeIndex, idx); });
        return marker;
    }

    removePoint(routeIndex, idx) {
        const rt = this.routes[routeIndex];
        if (rt.stops[idx]) rt.stops[idx].map = null;
        rt.points.splice(idx, 1); rt.stops.splice(idx, 1);
        rt.stops.forEach((m, i) => { m.content.textContent = i + 1; });
        if (rt.points.length >= 2) this.requestRoute(routeIndex);
        else this.clearRoute(routeIndex);
        bus.emit("persist");
    }

    removeRoute(routeIndex) {
        const rt = this.routes[routeIndex];
        if (rt.poly) rt.poly.setMap(null);
        rt.stops.forEach(s => s.map = null);
        this.routes.splice(routeIndex, 1);
        this.activeRouteIndex = -1;
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
        if (!this.directionsService) this.directionsService = new google.maps.DirectionsService();
        const rt = this.routes[routeIndex]; const pts = rt.points;
        if (pts.length < 2) return;
        const req = { origin: pts[0], destination: pts[pts.length - 1], travelMode: google.maps.TravelMode.DRIVING };
        if (pts.length > 2) req.waypoints = pts.slice(1, -1).map(p => ({ location: p, stopover: true }));
        this.directionsService.route(req, (res, status) => {
            if (status !== "OK") { bus.emit("toast", "تعذر حساب المسار"); return; }
            const r = res.routes[0]; rt.overview = r.overview_polyline;
            rt.distance = r.legs.reduce((s, l) => s + l.distance.value, 0);
            rt.duration = r.legs.reduce((s, l) => s + l.duration.value, 0);
            this.renderRoute(routeIndex);
            bus.emit("persist");
        });
    }

    renderRoute(routeIndex) {
        const rt = this.routes[routeIndex];
        if (rt.poly) rt.poly.setMap(null);
        const path = rt.overview ? google.maps.geometry.encoding.decodePath(rt.overview) : rt.points;
        rt.poly = new google.maps.Polyline({ map: this.map, path, strokeColor: rt.color, strokeWeight: rt.weight, strokeOpacity: rt.opacity, zIndex: 10 });
        
        rt.poly.addListener("mouseover", (e) => { 
            if (!UI.infoWindowPinned) this.openRouteCard(routeIndex, true, e.latLng);
        });
        rt.poly.addListener("mouseout", () => { UI.closeSharedInfoCard();});
        rt.poly.addListener("click", (e) => this.openRouteCard(routeIndex, false, e.latLng));
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
            width: 380px;
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
                    <h3 style="margin:0; font-family: 'Tajawal', sans-serif; font-size: 17px; font-weight: 700;">معلومات المسار ${routeIndex + 1}</h3>
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
                        <button id="route-delete" style="flex:1;background:#e94235;color:white;border:none;border-radius:10px;padding:10px;cursor:pointer;font-weight:600; font-family: 'Tajawal', sans-serif; min-width: 70px; font-size: 14px;">حذف</button>
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
        const saveBtn = document.getElementById("route-save"); const delBtn = document.getElementById("route-delete"); const closeBtn = document.getElementById("route-close");
        const colEl = document.getElementById("route-color"); const weightEl = document.getElementById("route-weight");
        const opEl = document.getElementById("route-opacity"); const opValEl = document.getElementById("route-opacity-val"); const notesEl = document.getElementById("route-notes");
        if (opEl) { opEl.addEventListener("input", () => { if (opValEl) opValEl.textContent = opEl.value + "%"; }); }
        if (saveBtn) {
            saveBtn.addEventListener("click", () => {
                rt.color = colEl.value; rt.weight = Utils.clamp(+weightEl.value, 1, 20); rt.opacity = Utils.clamp(+opEl.value, 0, 100) / 100; rt.notes = notesEl.value.trim();
                rt.poly.setOptions({ strokeColor: rt.color, strokeWeight: rt.weight, strokeOpacity: rt.opacity });
                bus.emit("persist"); UI.forceCloseSharedInfoCard(); bus.emit("toast", "تم حفظ تعديلات المسار");
            });
        }
        if (delBtn) { delBtn.addEventListener("click", () => { if (!confirm(`حذف المسار ${routeIndex + 1}؟`))return; this.removeRoute(routeIndex); bus.emit("toast", "تم حذف المسار"); }); }
        if (closeBtn) { closeBtn.addEventListener("click", () => { UI.forceCloseSharedInfoCard(); }); }
    }
   
    exportState() {
        return this.routes.map(rt => ({
            id: rt.id, color: rt.color, weight: rt.weight, opacity: rt.opacity, distance: rt.distance, duration: rt.duration, overview: rt.overview, notes: rt.notes,
            points: rt.points.map(p => ({ lat: typeof p.lat === 'function' ? p.lat() : p.lat, lng: typeof p.lng === 'function' ? p.lng() : p.lng }))
        }));
    }

    applyState(state) {
        if (!state || !state.routes) return;
        this.routes.forEach(rt => { if (rt.poly) rt.poly.setMap(null); rt.stops.forEach(s => s.map = null); });
        this.routes = [];
        state.routes.forEach(rt => {
            const newRoute = { id: rt.id, color: rt.color, weight: rt.weight, opacity: rt.opacity, distance: rt.distance, duration: rt.duration, overview: rt.overview, notes: rt.notes || "", points: rt.points.map(p => new google.maps.LatLng(p.lat, p.lng)), poly: null, stops: [] };
            this.routes.push(newRoute);
            newRoute.points.forEach((pt, i) => { const stop = this.createStopMarker(pt, this.routes.length - 1, i); newRoute.stops.push(stop); });
            this.renderRoute(this.routes.length - 1);
        });
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
        this.map.addListener("click", e => { 
            // التحقق الصارم: لن يتم الرسم إلا إذا كانت أيقونة المضلع مفعلة (modePolygonAdd = true)
            if (!MAP.modePolygonAdd || this.shareMode) return; 
            
            if (this.activePolygonIndex === -1) this.createNewPolygon(); 
            this.addPointToPolygon(this.activePolygonIndex, e.latLng); 
        }); 
    }

    startPolygonSequence() { this.activePolygonIndex = -1; }
    
    finishCurrentPolygon() {
        if (this.activePolygonIndex === -1) return;
        const poly = this.polygons[this.activePolygonIndex];
        if (poly.activePolyline) poly.activePolyline.setMap(null);
        poly.markers.forEach(m => m.map = null);
        if (poly.points.length >= 3) {
            poly.polygon = new google.maps.Polygon({ paths: poly.points, map: this.map, strokeColor: poly.color, strokeOpacity: poly.strokeOpacity, strokeWeight: poly.strokeWeight, fillColor: poly.color, fillOpacity: poly.fillOpacity, zIndex: 5, clickable: true });
            this.addPolygonEditListeners(poly, this.activePolygonIndex);
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
    addPolygonEditListeners(poly, index) {
        poly.polygon.addListener("click", (e) => {
            if (this.editingPolygonIndex === index) { this.insertVertex(poly, index, e.latLng); }
            else { this.openCard(this.polygons.indexOf(poly), false, e.latLng); } 
        });
    }
    enterEditMode(index) {
        this.exitEditMode();
        const poly = this.polygons[index];
        this.isEditing = true; this.editingPolygonIndex = index;
        
        poly.points.forEach((point, i) => {
            const marker = new google.maps.marker.AdvancedMarkerElement({ 
                position: point, 
                map: this.map, 
                gmpDraggable: true, 
                content: this.buildVertexMarkerContent(poly.color), 
                title: `نقطة ${i + 1}` 
            });
            poly.vertexMarkers.push(marker);
            
            // السحب لتغيير الموقع
            marker.addListener("drag", (e) => { poly.points[i] = e.latLng; poly.polygon.setPaths(poly.points); });
            marker.addListener("dragend", () => { bus.emit("persist"); });
            
            // خيار النقر للحذف
            marker.addListener("click", () => {
                const info = new google.maps.InfoWindow({
                    content: `<div style="font-family:'Tajawal'; padding:5px; text-align:center;">
                                <button id="btn-del-v-${i}" style="background:#e94235; color:white; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-size:12px;">حذف النقطة</button>
                              </div>`
                });
                info.open(this.map, marker);
                
                google.maps.event.addListenerOnce(info, 'domready', () => {
                    document.getElementById(`btn-del-v-${i}`).addEventListener('click', () => {
                        this.deleteVertex(poly, index, i);
                        info.close();
                    });
                });
            });

            // خيار الزر الأيمن
            marker.addListener("contextmenu", () => { if (confirm(`حذف هذه النقطة؟`)) { this.deleteVertex(poly, index, i); } });
        });
        
        UI.showPolygonEditingUI();
        bus.emit("toast", "وضع التحرير مفعل. اضغط على نقطة لحذفها.");
    }
    
    exitEditMode() {
        if (!this.isEditing) return;
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
            poly.polygon.setPaths(poly.points);
            
            // Update vertex markers
            this.exitEditMode();
            setTimeout(() => this.enterEditMode(index), 50);
            
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
        poly.polygon.setPaths(poly.points);
        
        // حفظ التغييرات
        bus.emit("persist");
        bus.emit("toast", "تم حذف النقطة");

        // إعادة تشغيل وضع التحرير لتحديث ترتيب النقاط ومواقعها
        this.exitEditMode();
        setTimeout(() => this.enterEditMode(index), 50);
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
            </div>
            <div style="${bodyStyle}">
                <div style="display: flex; justify-content: space-between; margin-bottom: 15px; font-size: 15px; font-family: 'Tajawal', sans-serif;">
                    <span><b>المساحة:</b> ${areaText}</span>
                </div>
                ${isEditingShape ? `<p style="margin: 0; color: #555; text-align:center; font-family: 'Tajawal', sans-serif;">اسحب النقاط لتعديل الشكل. انقر على الحدود لإضافة نقطة. انقر بزر الماوس الأيمن على نقطة لحذفها.</p>` : 
                (isEditable ? `
                    <div style="margin-bottom:14px;"><label style="font-size:12px; display:block; margin-bottom:4px; font-family: 'Tajawal', sans-serif;">الاسم:</label><input id="poly-name" type="text" value="${Utils.escapeHTML(poly.name)}" style="width:100%;padding:7px;border-radius:6px;border:1px solid #ddd;box-sizing:border-box;"></div>
                    <div style="display:flex; gap:10px; align-items:center; margin-bottom:14px; flex-wrap: wrap;">
                        <div style="flex:1; min-width: 120px;"><label style="font-size:12px; display:block; margin-bottom:4px; font-family: 'Tajawal', sans-serif;">اللون:</label><input id="poly-color" type="color" value="${poly.color}" style="width:100%;height:32px;border:none;border-radius:6px;cursor:pointer;"></div>
                        <div style="flex:1; min-width: 120px;"><label style="font-size:12px; display:block; margin-bottom:4px; font-family: 'Tajawal', sans-serif;">سماكة الخط:</label><input id="poly-stroke" type="number" value="${poly.strokeWeight}" min="1" max="10" style="width:100%;padding:7px;border-radius:6px;border:1px solid #ddd;box-sizing:border-box;"></div>
                    </div>
                    <div style="margin-bottom:14px;"><label style="font-size:12px; display:block; margin-bottom:4px; font-family: 'Tajawal', sans-serif;">شفافية الحدود: <span id="poly-stroke-opacity-val">${Math.round(poly.strokeOpacity * 100)}%</span></label><input id="poly-stroke-opacity" type="range" min="0" max="100" value="${Math.round(poly.strokeOpacity * 100)}" style="width:100%;"></div>
                    <div style="margin-bottom:14px;"><label style="font-size:12px; display:block; margin-bottom:4px; font-family: 'Tajawal', sans-serif;">شفافية التعبئة: <span id="poly-fill-opacity-val">${Math.round(poly.fillOpacity * 100)}%</span></label><input id="poly-fill-opacity" type="range" min="0" max="100" value="${Math.round(poly.fillOpacity * 100)}" style="width:100%;"></div>
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
        const poly = this.polygons[polyIndex];
        const isEditingShape = this.editingPolygonIndex === polyIndex;
        if (isEditingShape) { const stopEditBtn = document.getElementById("poly-stop-edit"); if (stopEditBtn) stopEditBtn.addEventListener("click", () => { this.exitEditMode(); UI.forceCloseSharedInfoCard();}); return; }
        if (hoverOnly || !MAP.editMode) return;
        const savePropsBtn = document.getElementById("poly-save-properties"); const editShapeBtn = document.getElementById("poly-edit-shape"); const delBtn = document.getElementById("poly-delete"); const closeBtn = document.getElementById("poly-close");
        const nameEl = document.getElementById("poly-name"); const notesEl = document.getElementById("poly-notes");
        const colEl = document.getElementById("poly-color"); const strokeEl = document.getElementById("poly-stroke");
        const strokeOpEl = document.getElementById("poly-stroke-opacity"); const fillOpEl = document.getElementById("poly-fill-opacity");
        const strokeOpValEl = document.getElementById("poly-stroke-opacity-val"); const fillOpValEl = document.getElementById("poly-fill-opacity-val");
        if (strokeOpEl) { strokeOpEl.addEventListener("input", () => { if (strokeOpValEl) strokeOpValEl.textContent = strokeOpEl.value + "%"; }); }
        if (fillOpEl) { fillOpEl.addEventListener("input", () => { if (fillOpValEl) fillOpValEl.textContent = fillOpEl.value + "%"; }); }
        if (savePropsBtn) {
            savePropsBtn.addEventListener("click", () => {
                poly.name = nameEl.value.trim(); poly.notes = notesEl.value.trim(); poly.color = colEl.value;
                poly.strokeWeight = Utils.clamp(+strokeEl.value, 1, 10); poly.strokeOpacity = Utils.clamp(+strokeOpEl.value, 0, 100) / 100;
                poly.fillOpacity = Utils.clamp(+fillOpEl.value, 0, 100) / 100;
                poly.polygon.setOptions({ fillColor: poly.color, strokeColor: poly.color, strokeWeight: poly.strokeWeight, strokeOpacity: poly.strokeOpacity, fillOpacity: poly.fillOpacity });
                bus.emit("persist"); UI.forceCloseSharedInfoCard(); bus.emit("toast", "تم حفظ خصائص المضلع");
            });
        }
        if (editShapeBtn) { editShapeBtn.addEventListener("click", () => { this.enterEditMode(polyIndex); UI.forceCloseSharedInfoCard(); }); }
        if (delBtn) { 
            delBtn.addEventListener("click", () => { 
                if (!confirm(`حذف المضلع "${poly.name}" كاملاً؟`)) return; 
                poly.polygon.setMap(null); 
                this.polygons = this.polygons.filter(p => p.id !== poly.id); 
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
            this.addPolygonEditListeners(newPoly, this.polygons.length);
            this.polygons.push(newPoly);
        });
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
        this.persistTimer = null;

        bus.on("map:ready", map => {
            this.map = map;
            this.shareMode = MAP.shareMode;

            const stateFromUrl = this.readShare();

            if (stateFromUrl) {
                console.log("State found in URL, applying...");
                this.applyState(stateFromUrl);
            } else {
                console.log("No state found in URL.");
            }

            if (!this.shareMode) {
                console.log("Enabling auto-persist for edit mode.");
                bus.on("persist", () => this.schedulePersist());
            }
        });
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
            history.replaceState(null, "", url);
            return url;
        } catch (e) {
            console.error("writeShare error", e);
            return location.href;
        }
    }

    schedulePersist() {
        if (this.shareMode) return;

        clearTimeout(this.persistTimer);
        this.persistTimer = setTimeout(() => {
            const st = this.buildState();
            if (st) this.writeShare(st);
        }, 300);
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
                this.map.setMapTypeId(mapState.t);
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
class ShareManager {

    constructor() {
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

        // FIX: Use the long URL directly without external shortening services
        const longUrl = STATE.writeShare(st);
        
        const originalText = this.btnText;
        
        this.btn.disabled = true;
        if (this.btnText) this.btn.textContent = "جاري النسخ...";
        
        try {
            await navigator.clipboard.writeText(longUrl);
            bus.emit("toast", "تم نسخ رابط المشاركة");
        } catch (err) {
            console.error("Clipboard copy failed, showing manual dialog.", err);
            this.showManualCopyDialog(longUrl);
        }

        this.btn.disabled = false;
        if (this.btnText) this.btn.textContent = originalText;
    }

    showManualCopyDialog(url) {
        const overlay = document.createElement('div');
        overlay.style.cssText = `position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0, 0, 0, 0.6); z-index: 10000; display: flex; justify-content: center; align-items: center; padding: 20px; box-sizing: border-box;`;
        const dialog = document.createElement('div');
        dialog.style.cssText = `background: white; border-radius: 12px; padding: 24px; max-width: 90%; width: 400px; box-shadow: 0 4px 20px rgba(0,0,0,0,0.3); text-align: center; direction: rtl; font-family: 'Tajawal', sans-serif;`;
        dialog.innerHTML = `<h3 style="margin-top: 0; margin-bottom: 16px; color: #333;">انسخ الرابط يدويًا</h3><p style="margin-bottom: 20px; color: #666; line-height: 1.5;">الرجاء الضغط مطولاً على الرابط واختيار "نسخ".</p><textarea readonly style="width: 100%; height: 80px; padding: 10px; border-radius: 8px; border: 1px solid #ccc; font-size: 14px; text-align: center; resize: none; direction: ltr; box-sizing: border-box; font-family: 'Tajawal', sans-serif;">${url}</textarea><button id="manual-copy-close" style="margin-top: 20px; width: 100%; padding: 12px; background-color: #4285f4; color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: bold; cursor: pointer; font-family: 'Tajawal', sans-serif;">إغلاق</button>`;
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);
        document.getElementById('manual-copy-close').addEventListener('click', () => { document.body.removeChild(overlay); });
        overlay.addEventListener('click', (e) => { if (e.target === overlay) { document.body.removeChild(overlay); } });
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
        console.log("UI: initializeUI() called.");

        // === إصلاح شامل: حقن CSS لحل مشاكل العرض والتمرير ===
        const style = document.createElement('style');
        style.innerHTML = `
            /* إزالة الخلفية البيضاء والظل الافتراضي */
            .gm-style-iw-c {
                background: transparent !important;
                box-shadow: none !important;
                padding: 0 !important;
                border-radius: 0 !important;
                /* السماح بالتمرير إذا لزم الأمر من الحاوية الأم */
                overflow: visible !important; 
            }
            /* السماح للمحتوى بالظهور والتمرير */
            .gm-style-iw-d {
                overflow: visible !important;
                max-height: none !important;
                padding: 0 !important;
                background: transparent !important;
            }
            /* إخفاء السهم الصغير أسفل النافذة */
            .gm-style-iw-tc {
                display: none !important;
            }
            /* إخفاء زر الإغلاق (X) الافتراضي من جوجل تماماً */
            .gm-ui-hover-effect {
                display: none !important;
                opacity: 0 !important;
                pointer-events: none !important;
            }
        `;
        document.head.appendChild(style);

        if (MAP.shareMode) {
            this.applyShareMode();
        }

        // إنشاء نافذة المعلومات
        this.sharedInfoWindow = new google.maps.InfoWindow();

        MAP.map.addListener("click", () => {
            this.closeSharedInfoCard();
        });

        if (this.btnLayers) {
            this.btnLayers.addEventListener("click", () => this.toggleLayersPanel());
        }
        if (this.btnCloseLayers) {
            this.btnCloseLayers.addEventListener("click", () => this.toggleLayersPanel());
        }

        const baseMapRadios = document.querySelectorAll('input[name="base-map"]');
        baseMapRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                this.setBaseMap(radio.value);
            });
        });

        const layerCheckboxes = document.querySelectorAll('#layer-traffic, #layer-bicycling, #layer-transit');
        layerCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                this.toggleLayer(checkbox.id, checkbox.checked);
            });
        });

        if (this.btnEdit && !MAP.shareMode) {
            this.btnEdit.addEventListener("click", () => {
                MAP.editMode = !MAP.editMode;
                this.btnEdit.setAttribute("aria-pressed", MAP.editMode ? "true" : "false");
                this.updateModeBadge();
                if (!MAP.editMode) {
                    this.showDefaultUI();
                }
            });
        }

        if (this.btnAdd && !MAP.shareMode) {
            this.btnAdd.addEventListener("click", () => {
                if (!MAP.editMode) return this.showToast("فعّل وضع التحرير");
                this.setActiveMode('add');
            });
        }

        if (this.btnRoute && !MAP.shareMode) {
            this.btnRoute.addEventListener("click", () => {
                if (!MAP.editMode) return this.showToast("فعّل وضع التحرير");
                this.setActiveMode('route');
            });
        }

        if (this.btnPolygon && !MAP.shareMode) {
            this.btnPolygon.addEventListener("click", () => {
                if (!MAP.editMode) return this.showToast("فعّل وضع التحرير");
                this.setActiveMode('polygon');
            });
        }

        if (this.btnMeasure && !MAP.shareMode) {
            this.btnMeasure.addEventListener("click", () => {
                if (!MAP.editMode) return this.showToast("فعّل وضع التحرير");
                this.setActiveMode('measure');
            });
        }

        if (this.btnFreeDraw && !MAP.shareMode) {
            this.btnFreeDraw.addEventListener("click", () => {
                if (!MAP.editMode) return this.showToast("فعّل وضع التحرير");
                this.setActiveMode('freedraw');
            });
        }

        if (this.btnDrawFinish && !MAP.shareMode) {
            this.btnDrawFinish.addEventListener("click", () => {
                if (MAP.modeRouteAdd) {
                    ROUTES.finishCurrentRoute();
                } else if (MAP.modePolygonAdd) {
                    POLYGONS.finishCurrentPolygon();
                }
                this.showDefaultUI();
            });
        }

        if (this.btnRouteClear && !MAP.shareMode) {
            this.btnRouteClear.addEventListener("click", () => {
                if (ROUTES.activeRouteIndex === -1) return this.showToast("لا يوجد مسار نشط لحذفه");
                if (!confirm("حذف المسار الحالي؟")) return;
                ROUTES.removeRoute(ROUTES.activeRouteIndex);
                this.showDefaultUI();
                this.showToast("تم حذف المسار");
            });
        }

        this.updateModeBadge();
    }

    toggleLayersPanel() {
        if (this.layersPanel) {
            this.layersPanel.classList.toggle("show");
            const isPressed = this.layersPanel.classList.contains("show");
            this.btnLayers.setAttribute("aria-is-pressed", isPressed ? "true" : "false");
        }
    }

    setBaseMap(mapTypeId) {
        switch (mapTypeId) {
            case 'roadmap': MAP.setRoadmap(); break;
            case 'satellite': MAP.setSatellite(); break;
            case 'terrain': MAP.setTerrain(); break;
            case 'dark': MAP.setDarkMode(); break;
            case 'silver': MAP.setSilverMode(); break;
        }
    }

    toggleLayer(layerId, isChecked) {
        switch (layerId) {
            case 'layer-traffic': MAP.toggleTraffic(); break;
            case 'layer-bicycling': MAP.toggleBicycling(); break;
            case 'layer-transit': MAP.toggleTransit(); break;
        }
    }

    openSharedInfoCard(content, position, isPinned = false) {
        this.sharedInfoWindow.close();
        
        this.sharedInfoWindow.setContent(content);
        this.sharedInfoWindow.setPosition(position);
        
        // === تحديث الخيارات لحل مشاكل العرض ===
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
            case 'add':
                MAP.modeAdd = true;
                if (this.btnAdd) this.btnAdd.setAttribute("aria-pressed", "true");
                MAP.setCursor("crosshair");
                this.showDefaultUI();
                this.showToast("اضغط على الخريطة لإضافة موقع");
                break;
            case 'route':
                ROUTES.startNewRouteSequence();
                MAP.modeRouteAdd = true;
                MAP.setCursor("crosshair");
                this.showDrawFinishUI();
                this.showToast("اضغط لإضافة نقاط المسار الأول");
                break;
            case 'polygon':
                POLYGONS.startPolygonSequence();
                MAP.modePolygonAdd = true;
                if (this.btnPolygon) this.btnPolygon.setAttribute("aria-pressed", "true");
                MAP.setCursor("crosshair");
                this.showDrawFinishUI();
                this.showToast("اضغط لإضافة رؤوس المضلع، ثم 'إنهاء الرسم'");
                break;
            case 'measure':
                MEASURE.activate();
                if (this.btnMeasure) this.btnMeasure.setAttribute("aria-pressed", "true");
                this.showDefaultUI();
                break;
            case 'freedraw':
                MAP.modeFreeDraw = true;
                if (this.btnFreeDraw) this.btnFreeDraw.setAttribute("aria-pressed", "true");
                MAP.setCursor("crosshair");
                this.showDefaultUI();
                this.showToast("اضغط على الخريطة لإضافة أيقونة أو نص");
                break;
        }
    }

    applyShareMode() {
        if (this.btnAdd) this.btnAdd.style.display = "none";
        if (this.btnRoute) this.btnRoute.style.display = "none";
        if (this.btnPolygon) this.btnPolygon.style.display = "none";
        if (this.btnMeasure) this.btnMeasure.style.display = "none";
        if (this.btnFreeDraw) this.btnFreeDraw.style.display = "none";
        if (this.btnDrawFinish) this.btnDrawFinish.style.display = "none";
        if (this.btnRouteClear) this.btnRouteClear.style.display = "none";
        if (this.btnEdit) this.btnEdit.style.display = "none";
        if (this.btnLayers) this.btnLayers.style.display = "none";
        this.updateModeBadge("view");
    }

    showDrawFinishUI() {
        if (this.btnAdd) this.btnAdd.setAttribute("aria-pressed", "false");
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
        if (this.btnAdd) this.btnAdd.style.display = "none";
        if (this.btnRoute) this.btnRoute.style.display = "none";
        if (this.btnPolygon) this.btnPolygon.style.display = "none";
        if (this.btnMeasure) this.btnMeasure.style.display = "none";
        if (this.btnFreeDraw) this.btnFreeDraw.style.display = "none";
        if (this.btnDrawFinish) this.btnDrawFinish.style.display = "none";
    }

    updateModeBadge(forceMode = null) {
        if (!this.modeBadge) return;
        const mode = forceMode || (MAP.editMode ? "edit" : "view");
        this.modeBadge.style.display = "block";
        this.modeBadge.textContent = (mode === "edit") ? "وضع التحرير" : "وضع العرض";
        this.modeBadge.className = "";
        this.modeBadge.classList.add("badge", mode);
    }

    showToast(message) {
        if (!this.toastElement) return;
        this.toastElement.innerHTML = `
            <div style="display:flex;align-items:center;gap:8px;">
                <img src="${this.logo}" style="width:22px;height:22px;border-radius:6px;opacity:0.9;">
                <span style="font-family: 'Tajawal', sans-serif;">${message}</span>
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

        console.log("Diriyah Security Map v25.0 — Ready");

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
