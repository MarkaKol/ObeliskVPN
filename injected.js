window.addEventListener('message', async (event) => {
    if (event.data && event.data.type === 'CONFIG_PROXY_REQUEST') {
        console.log('[Injected] Proxy request:', event.data.url);
        
        try {
            const response = await fetch(event.data.url, event.data.options || {});
            let data;
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                data = await response.json();
            } else {
                data = await response.text();
            }
            
            if (event.source) {
                event.source.postMessage({
                    type: 'SDK_PROXY_RESPONSE',
                    id: event.data.id,
                    data: data
                }, '*');
                console.log('[Injected] Proxy response sent');
            }
        } catch (error) {
            console.error('[Injected] Proxy error:', error);
            if (event.source) {
                event.source.postMessage({
                    type: 'SDK_PROXY_RESPONSE',
                    id: event.data.id,
                    error: error.message
                }, '*');
            }
        }
    }
});

console.log('[Injected] Proxy handler ready');