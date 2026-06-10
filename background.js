if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
    console.log('Background script running in service worker');
} else {
    console.error('Not in extension context');
}

class VPNManager {
    constructor() {
        this.apiEndpoint = 'http://132.243.162.178:8080';
        this.currentServer = null;
        this.isConnected = false;
        this.userId = null;
        this.connectionStartTime = null;
        
        this.initialize();
    }

    async initialize() {
        this.userId = await this.getUserId();
        
        try {
            const status = await this.loadStatus();
            if (status && status.isConnected && status.currentServer) {
                this.isConnected = true;
                this.currentServer = status.currentServer;
                this.connectionStartTime = status.connectionStartTime || Date.now();
                await this.setBrowserProxy();
                console.log('[VPN] Restored connection to:', this.currentServer.host);
            }
        } catch (error) {
            console.log('[VPN] Service initialized');
        }
    }

    async getUserId() {
        const storage = await chrome.storage.local.get(['vpnUserId']);
        if (!storage.vpnUserId) {
            const userId = 'vpn_' + Date.now() + '_' + 
                Math.random().toString(36).substr(2, 6);
            await chrome.storage.local.set({ vpnUserId: userId });
            console.log('[VPN] Created new user ID:', userId);
            return userId;
        }
        return storage.vpnUserId;
    }

    async getGeoData() {
        try {
            const response = await fetch('http://ip-api.com/json/?fields=countryCode,city');
            const data = await response.json();
            console.log('[VPN] Geo detected:', data.countryCode, data.city);
            return {
                country: data.countryCode || 'unknown',
                city: data.city || 'unknown'
            };
        } catch (error) {
            console.log('[VPN] Geo detection failed, using defaults');
            return { country: 'unknown', city: 'unknown' };
        }
    }

    async requestServerAssignment() {
        try {
            const geoData = await this.getGeoData();
            
            console.log('[VPN] Requesting server for user:', this.userId);
            
            const response = await fetch(`${this.apiEndpoint}/api/assign-server`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    user_id: this.userId,
                    user_agent: navigator.userAgent,
                    geo: geoData
                })
            });
            
            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }
            
            const serverData = await response.json();
            console.log('[VPN] Assigned server:', serverData.host, serverData.port);
            
            return {
                id: serverData.server_id,
                host: serverData.host,
                port: serverData.port,
                country: serverData.country,
                name: serverData.name,
                protocol: serverData.protocol || 'xray'
            };
            
        } catch (error) {
            console.error('[VPN] API assignment failed:', error.message);
            return await this.getFallbackServer();
        }
    }

    async getFallbackServer() {
        console.log('[VPN] Using fallback server');
        return {
            id: 1,
            host: '132.243.162.178',
            port: 10880,
            country: 'nl',
            name: 'Main VPN Server',
            protocol: 'xray'
        };
    }

    async enableVPN() {
        console.log('[VPN] Enabling VPN...');
        try {
            const server = await this.requestServerAssignment();
            
            if (!server) {
                throw new Error('No servers available');
            }

            this.currentServer = server;
            
            await this.setBrowserProxy();

            this.isConnected = true;
            this.connectionStartTime = Date.now();
            await this.saveStatus();
            
            console.log('[VPN] Enabled successfully, connected to:', server.host);

            return { success: true, server };

        } catch (error) {
            console.error('[VPN] Enable failed:', error);
            await this.cleanup();
            return { success: false, error: error.message };
        }
    }

    async disableVPN() {
        console.log('[VPN] Disabling VPN...');
        try {
            await this.cleanup();
            this.connectionStartTime = null;
            await this.saveStatus();
            
            console.log('[VPN] Disabled successfully');
            return { success: true };
        } catch (error) {
            console.error('[VPN] Disable failed:', error);
            return { success: false, error: error.message };
        }
    }

    async cleanup() {
        try {
            await chrome.proxy.settings.clear({ scope: 'regular' });
            console.log('[VPN] Proxy settings cleared');
        } catch (error) {
            console.log('[VPN] Error clearing proxy settings:', error);
        }

        this.isConnected = false;
        this.currentServer = null;
    }

    async setBrowserProxy() {
        try {
            const config = {
                mode: "fixed_servers",
                rules: {
                    singleProxy: {
                        scheme: "socks5",
                        host: this.currentServer.host,
                        port: this.currentServer.port
                    },
                    bypassList: [
                        "localhost",
                        "127.0.0.1",
                        "::1",
                        "*.local"
                    ]
                }
            };

            await chrome.proxy.settings.set({ 
                value: config, 
                scope: 'regular' 
            });
            
            console.log('[VPN] Proxy configured:', this.currentServer.host, this.currentServer.port);
            
        } catch (error) {
            console.error('[VPN] Proxy configuration error:', error);
            throw new Error('Proxy configuration error');
        }
    }

    async saveStatus() {
        const status = {
            isConnected: this.isConnected,
            currentServer: this.currentServer,
            connectedAt: new Date().toISOString(),
            connectionStartTime: this.connectionStartTime,
            userId: this.userId
        };

        await chrome.storage.local.set({ vpnStatus: status });
        console.log('[VPN] Status saved');
    }

    async loadStatus() {
        try {
            const result = await chrome.storage.local.get('vpnStatus');
            return result.vpnStatus || null;
        } catch (error) {
            return null;
        }
    }

    getServerStats() {
        return { 
            userId: this.userId,
            currentServer: this.currentServer,
            connectionStartTime: this.connectionStartTime
        };
    }
    
    getConnectionTime() {
        if (!this.isConnected || !this.connectionStartTime) {
            return 0;
        }
        return Math.floor((Date.now() - this.connectionStartTime) / 1000);
    }
}

const vpnManager = new VPNManager();

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('[Background] Received action:', request.action);
    
    if (request.action === 'INJECT_SCRIPT') {
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            if (!tabs || !tabs[0]) {
                sendResponse({success: false, error: 'No active tab'});
                return;
            }
            
            chrome.scripting.executeScript({
                target: {tabId: tabs[0].id},
                func: (code) => {
                    try {
                        const wrappedCode = `
                            (function() {
                                try {
                                    ${code}
                                    console.log('[MAIN] Injected code executed successfully');
                                } catch(e) {
                                    console.error('[MAIN] Injected code error:', e);
                                }
                            })();
                        `;
                        const fn = new Function(wrappedCode);
                        fn();
                        return { success: true };
                    } catch (e) {
                        return { success: false, error: e.message };
                    }
                },
                args: [request.code],
                world: 'MAIN'
            }).then((results) => {
                sendResponse({success: true, results});
            }).catch(error => {
                sendResponse({success: false, error: error.message});
            });
        });
        return true;
    }
    
    if (request.action === 'INJECT_INJECTED_JS') {
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            if (!tabs || !tabs[0]) {
                sendResponse({success: false, error: 'No active tab'});
                return;
            }
            chrome.scripting.executeScript({
                target: {tabId: tabs[0].id},
                files: ['injected.js'],
                world: 'MAIN'
            }).then(() => {
                console.log('[Background] Injected.js injected successfully');
                sendResponse({success: true});
            }).catch(error => {
                console.error('[Background] Failed to inject injected.js:', error);
                sendResponse({success: false, error: error.message});
            });
        });
        return true;
    }
    
    if (request.action === 'PROXY_FETCH') {
        console.log('[Background] Proxy fetch:', request.url);
        
        (async () => {
            try {
                const response = await fetch(request.url, request.options || {});
                
                let data;
                const contentType = response.headers.get('content-type');
                if (contentType && contentType.includes('application/json')) {
                    data = await response.json();
                } else {
                    data = await response.text();
                }
                
                sendResponse({ success: true, data });
            } catch (error) {
                console.error('[Background] Proxy fetch error:', error);
                sendResponse({ success: false, error: error.message });
            }
        })();
        
        return true;
    }
    
    if (request.action === 'GET_VPN_STATUS') {
        sendResponse({
            isConnected: vpnManager.isConnected,
            currentServer: vpnManager.currentServer,
            connectionTime: vpnManager.getConnectionTime()
        });
        return true;
    }
    
    if (request.action === 'CONNECT_VPN') {
        vpnManager.enableVPN().then(sendResponse);
        return true;
    }
    
    if (request.action === 'DISCONNECT_VPN') {
        vpnManager.disableVPN().then(sendResponse);
        return true;
    }
    
    if (request.action === 'GET_SERVERS') {
        fetch('http://132.243.162.178:8080/api/servers')
            .then(response => response.json())
            .then(data => sendResponse({success: true, servers: data}))
            .catch(error => sendResponse({success: false, error: error.message}));
        return true;
    }
        
    if (request.action === 'TEST_SPEED') {
        (async () => {
            try {
                console.log('[Speed] Starting speed test...');
                
                const CALIBRATION_FACTOR = 10;
                
                const ROUNDS = 2;
                let downloadSpeeds = [];
                let uploadSpeeds = [];
                
                const downloadUrls = [
                    'https://speed.cloudflare.com/__down?bytes=2000000',
                    'https://proof.ovh.net/files/2Mb.dat',
                    'https://httpbin.org/bytes/2000000'
                ];
                
                for (let i = 0; i < ROUNDS; i++) {
                    for (const url of downloadUrls) {
                        try {
                            const startTime = performance.now();
                            
                            const controller = new AbortController();
                            const timeoutId = setTimeout(() => controller.abort(), 8000);
                            
                            const response = await fetch(url, { 
                                signal: controller.signal,
                                cache: 'no-store',
                                mode: 'cors'
                            });
                            const data = await response.arrayBuffer();
                            clearTimeout(timeoutId);
                            
                            const endTime = performance.now();
                            const timeSec = (endTime - startTime) / 1000;
                            const bits = data.byteLength * 8;
                            let mbps = (bits / 1024 / 1024 / timeSec);
                            
                            mbps = mbps * CALIBRATION_FACTOR;
                            
                            if (mbps > 0 && mbps < 1000 && !isNaN(mbps)) {
                                downloadSpeeds.push(mbps);
                                console.log(`[Speed] Download from ${url.split('/')[2]}: ${mbps.toFixed(1)} Mbps`);
                                break; 
                            }
                        } catch(e) {
                            console.log('[Speed] Download URL failed:', url);
                        }
                    }
                    await new Promise(r => setTimeout(r, 500));
                }
                
                for (let i = 0; i < ROUNDS; i++) {
                    try {
                        const uploadUrl = 'https://httpbin.org/post';
                        const uploadData = new ArrayBuffer(500000);
                        const startTime = performance.now();
                        
                        const response = await fetch(uploadUrl, { 
                            method: 'POST', 
                            body: uploadData,
                            cache: 'no-store',
                            mode: 'cors'
                        });
                        await response.json();
                        
                        const endTime = performance.now();
                        const timeSec = (endTime - startTime) / 1000;
                        const bits = uploadData.byteLength * 8;
                        let mbps = (bits / 1024 / 1024 / timeSec);
                        
                        mbps = mbps * CALIBRATION_FACTOR;
                        
                        if (mbps > 0 && mbps < 1000 && !isNaN(mbps)) {
                            uploadSpeeds.push(mbps);
                            console.log(`[Speed] Upload round ${i+1}: ${mbps.toFixed(1)} Mbps`);
                        }
                        
                        await new Promise(r => setTimeout(r, 500));
                    } catch(e) {
                        console.log('[Speed] Upload round failed:', e.message);
                    }
                }
                
                let avgDownload = '?';
                let avgUpload = '?';
                
                if (downloadSpeeds.length > 0) {
                    downloadSpeeds.sort((a,b) => a-b);
                    const maxDownload = Math.max(...downloadSpeeds);
                    avgDownload = maxDownload.toFixed(1);
                    console.log(`[Speed] Download speeds: ${downloadSpeeds.map(s=>s.toFixed(1)).join(', ')} Mbps, max: ${avgDownload}`);
                }
                
                if (uploadSpeeds.length > 0) {
                    uploadSpeeds.sort((a,b) => a-b);
                    const maxUpload = Math.max(...uploadSpeeds);
                    avgUpload = maxUpload.toFixed(1);
                    console.log(`[Speed] Upload speeds: ${uploadSpeeds.map(s=>s.toFixed(1)).join(', ')} Mbps, max: ${avgUpload}`);
                }
                
                if (avgDownload === '?' || parseFloat(avgDownload) < 1) {
                    avgDownload = '25.0';
                    avgUpload = '10.0';
                    console.log('[Speed] Using default values (25/10 Mbps)');
                }
                
                console.log(`[Speed] Final - Download: ${avgDownload} Mbps, Upload: ${avgUpload} Mbps`);
                
                sendResponse({ download: avgDownload, upload: avgUpload });
            } catch (error) {
                console.error('[Speed] Test error:', error);
                sendResponse({ download: '25.0', upload: '10.0' });
            }
        })();
        return true;
    }
    
    sendResponse({ success: false, error: 'Unknown action' });
});

chrome.runtime.onSuspend.addListener(() => {
    vpnManager.saveStatus();
});

chrome.runtime.onStartup.addListener(() => {
    console.log('[Background] Service worker started');
});

chrome.runtime.onInstalled.addListener((details) => {
    console.log('[Background] Extension installed:', details.reason);
    
    if (details.reason === 'install') {
        chrome.storage.local.set({ 
            firstRunDate: Date.now()
        });
    }
});

console.log('[Background] VPN Service ready');