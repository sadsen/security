(() => {
    const cap = window.Capacitor;
    if (!cap?.isNativePlatform()) return;
    const files = cap.Plugins?.SeenFiles || cap.registerPlugin('SeenFiles');
    const app = cap.Plugins?.App || cap.registerPlugin('App');
    const nativeErrors = {
        'عملية حفظ أخرى قيد التنفيذ': 'ui_eb2b0eed44',
        'بيانات الملف مفقودة': 'ui_d399b4afd9',
        'تعذر فتح نافذة الحفظ': 'ui_f2a5c85f80',
        'وجهة الحفظ غير متاحة': 'ui_0a0359f16d',
        'تعذر حفظ الملف': 'ui_0ad0fd149d'
    };
    const localizeError = error => {
        if (window.I18n) error.message = I18n.msg(nativeErrors[String(error.message)] || 'ui_0ad0fd149d');
        return error;
    };
    const reportError = error => alert(String(localizeError(error).message || 'تعذر حفظ الملف'));
    window.SeenAndroid = {
        shareBase: 'https://map.seensu.com/', reportError,
        async saveBlob(blob, name) {
            const data = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result.split(',')[1]);
                reader.onerror = () => reject(reader.error);
                reader.readAsDataURL(blob);
            });
            return files.save({ data, name, mime: blob.type.split(';')[0] }).catch(error => { throw localizeError(error); });
        }
    };
    const openLink = ({ url }) => {
        try {
            const link = new URL(url);
            if (link.origin === 'https://map.seensu.com' && link.pathname === '/' && link.searchParams.has('x')) {
                const target = location.origin + '/?' + link.searchParams.toString();
                if (location.href !== target) location.assign(target);
            }
        } catch (error) { console.warn('Invalid incoming link', error); }
    };
    app.addListener('appUrlOpen', openLink);
    app.getLaunchUrl().then(result => { if (result) openLink(result); });
    window.SeenAndroid.handleBack = () => {
        const menu = document.querySelector('#securitymap-project-control > div');
        if (menu && !menu.hidden) { menu.hidden = true; return; }
        const close = document.querySelector('.share-dialog-overlay .share-close-btn');
        if (close) { close.click(); return; }
        const cardClose = [...document.querySelectorAll('#poly-close,#poly-share-close,#route-close,#loc-close,#cancel-btn,.gm-style-iw-c .gm-ui-hover-effect')]
            .find(button => button.getClientRects().length && getComputedStyle(button).visibility !== 'hidden');
        if (cardClose) { cardClose.click(); return; }
        const layers = document.getElementById('layers-panel');
        if (layers?.classList.contains('show')) { document.getElementById('btn-close-layers').click(); return; }
        // Stay on the map at the root instead of finishing the Activity.
    };
    app.addListener('backButton', () => window.SeenAndroid.handleBack());
})();
