// Shared mobile layout corrections from the Android integration.
const initSeenMobileLayout = () => {

(() => {
    if (window.__seenMobileReady || location.origin !== 'https://map.seensu.com') return;
    window.__seenMobileReady = true;
    const style = document.createElement('style');
    style.textContent = `
      @media (max-width: 768px), (max-height: 600px) {
        .share-dialog-content {width:calc(100% - 24px)!important;max-width:420px!important;max-height:84dvh!important;box-sizing:border-box}
        .share-dialog-header,.share-dialog-body {padding:12px!important;min-width:0}
        .share-dialog-body {overflow:auto!important;overscroll-behavior:contain}
        .share-dialog-content input,.share-dialog-content select,.share-dialog-content textarea {min-width:0;max-width:100%;box-sizing:border-box}
        .url-container {flex-wrap:wrap}.url-input {flex:1 1 180px!important}
        .gm-style-iw-c {max-width:calc(100vw - 24px)!important;max-height:72dvh!important;box-sizing:border-box}
        .gm-style-iw-d {width:min(320px,calc(100vw - 56px))!important;max-width:100%!important;max-height:58dvh!important;overflow:auto!important;overscroll-behavior:contain}
        .gm-style-iw-d > div,.glass-card-content {width:100%!important;min-width:0!important;max-width:100%!important;box-sizing:border-box}
        .glass-card-content {max-height:none!important;overflow:visible!important;font-size:14px!important}
        .glass-card-content > div {padding:10px 12px!important;box-sizing:border-box}
        .glass-card-content h3 {font-size:16px!important;overflow-wrap:anywhere}
        .glass-card-content input,.glass-card-content select,.glass-card-content textarea {min-width:0!important;max-width:100%!important;box-sizing:border-box}
        .glass-card-content div[style*="display:flex"],.glass-card-content div[style*="display: flex"] {flex-wrap:wrap;min-width:0}
        .glass-card-content button {min-height:40px;box-sizing:border-box;max-width:100%}
        #layers-panel {top:var(--seen-toolbar-bottom,160px)!important;bottom:auto!important;max-width:calc(100vw - 24px)!important;max-height:calc(100dvh - var(--seen-toolbar-bottom,160px) - 12px)!important;overflow-y:auto;box-sizing:border-box;overscroll-behavior:contain}
        #securitymap-project-control > div {box-sizing:border-box;max-width:calc(100vw - 24px);overflow-y:auto;overscroll-behavior:contain}
        #toast {box-sizing:border-box;min-width:0!important;max-width:calc(100vw - 24px)!important;width:max-content}
        #toast img {flex:0 0 22px;object-fit:contain}
      }`;
    document.head.appendChild(style);
    const toolbar = document.getElementById('toolbar');
    const fitLayers = () => {
        const top = Math.max(12, (toolbar?.getBoundingClientRect().bottom || 0) + 8);
        document.documentElement.style.setProperty('--seen-toolbar-bottom', top + 'px');
    };
    if (toolbar) new ResizeObserver(fitLayers).observe(toolbar);
    addEventListener('resize', fitLayers);
    window.visualViewport?.addEventListener('resize', fitLayers);
    fitLayers();
    const menu = document.querySelector('#securitymap-project-control > div');
    const fitMenu = () => {
        if (!menu || menu.hidden) return;
        menu.style.transform = '';
        const rect = menu.getBoundingClientRect();
        const shift = Math.max(12 - rect.left, Math.min(0, innerWidth - 12 - rect.right));
        menu.style.transform = `translateX(${shift}px)`;
        menu.style.maxHeight = Math.max(80, innerHeight - rect.top - 12) + 'px';
    };
    if (menu) new MutationObserver(fitMenu).observe(menu, {attributes:true,attributeFilter:['hidden']});
    addEventListener('resize', fitMenu);
    window.visualViewport?.addEventListener('resize', fitMenu);
    fitMenu();
    const toast = document.getElementById('toast');
    const fixLogo = () => toast?.querySelectorAll('img').forEach(img => {
        if (img.getAttribute('src') === '//img/seen-logo.png') img.src = '/img/seen-logo.png';
    });
    if (toast) new MutationObserver(fixLogo).observe(toast, {childList:true,subtree:true,attributes:true,attributeFilter:['src']});
    fixLogo();
})();

};
if (document.readyState === 'complete') initSeenMobileLayout();
else window.addEventListener('load', initSeenMobileLayout, {once:true});
