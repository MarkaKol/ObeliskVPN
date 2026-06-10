class PopupController {
    constructor() {
        this.servers = [];
        this.currentStatus = null;
        this.currentLanguage = 'en';
        this.timerInterval = null;
        this.speedInterval = null;
        this.languages = [
            { code: 'en', name: 'English', flag: '🇬🇧' },
            { code: 'zh', name: '中文', flag: '🇨🇳' },
            { code: 'hi', name: 'हिन्दी', flag: '🇮🇳' },
            { code: 'es', name: 'Español', flag: '🇪🇸' },
            { code: 'fr', name: 'Français', flag: '🇫🇷' },
            { code: 'ar', name: 'العربية', flag: '🇸🇦' },
            { code: 'ru', name: 'Русский', flag: '🇷🇺' },
            { code: 'pt', name: 'Português', flag: '🇧🇷' },
            { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
            { code: 'ja', name: '日本語', flag: '🇯🇵' },
            { code: 'ko', name: '한국어', flag: '🇰🇷' },
            { code: 'it', name: 'Italiano', flag: '🇮🇹' },
            { code: 'tr', name: 'Türkçe', flag: '🇹🇷' },
            { code: 'vi', name: 'Tiếng Việt', flag: '🇻🇳' }
        ];
        
        this.statusTranslations = {
            connected: {
                en: 'Connected',
                ru: 'Подключено',
                es: 'Conectado',
                zh: '已连接',
                hi: 'कनेक्टेड',
                ar: 'متصل',
                pt: 'Conectado',
                fr: 'Connecté',
                de: 'Verbunden',
                ja: '接続済み',
                ko: '연결됨',
                it: 'Connesso',
                tr: 'Bağlandı',
                vi: 'Đã kết nối'
            },
            disconnected: {
                en: 'Disconnected',
                ru: 'Отключено',
                es: 'Desconectado',
                zh: '已断开',
                hi: 'डिस्कनेक्टेड',
                ar: 'غير متصل',
                pt: 'Desconectado',
                fr: 'Déconnecté',
                de: 'Getrennt',
                ja: '切断済み',
                ko: '연결 끊김',
                it: 'Disconnesso',
                tr: 'Bağlantı kesildi',
                vi: 'Đã ngắt kết nối'
            },
            connecting: {
                en: 'Connecting...',
                ru: 'Подключение...',
                es: 'Conectando...',
                zh: '连接中...',
                hi: 'कनेक्ट हो रहा है...',
                ar: 'جاري الاتصال...',
                pt: 'Conectando...',
                fr: 'Connexion...',
                de: 'Verbinde...',
                ja: '接続中...',
                ko: '연결 중...',
                it: 'Connessione...',
                tr: 'Bağlanıyor...',
                vi: 'Đang kết nối...'
            },
            disconnecting: {
                en: 'Disconnecting...',
                ru: 'Отключение...',
                es: 'Desconectando...',
                zh: '断开中...',
                hi: 'डिस्कनेक्ट हो रहा है...',
                ar: 'جاري قطع الاتصال...',
                pt: 'Desconectando...',
                fr: 'Déconnexion...',
                de: 'Trenne...',
                ja: '切断中...',
                ko: '연결 끊는 중...',
                it: 'Disconnessione...',
                tr: 'Bağlantı kesiliyor...',
                vi: 'Đang ngắt kết nối...'
            }
        };

        this.headerTranslations = {
            connected: {
                en: 'Connected',
                ru: 'Подключено',
                es: 'Conectado',
                zh: '已连接',
                hi: 'कनेक्टेड',
                ar: 'متصل',
                pt: 'Conectado',
                fr: 'Connecté',
                de: 'Verbunden',
                ja: '接続済み',
                ko: '연결됨',
                it: 'Connesso',
                tr: 'Bağlandı',
                vi: 'Đã kết nối'
            },
            disconnected: {
                en: 'Connect',
                ru: 'Подключиться',
                es: 'Conectar',
                zh: '连接',
                hi: 'कनेक्ट करें',
                ar: 'اتصال',
                pt: 'Conectar',
                fr: 'Connecter',
                de: 'Verbinden',
                ja: '接続',
                ko: '연결',
                it: 'Connetti',
                tr: 'Bağlan',
                vi: 'Kết nối'
            },
            connecting: {
                en: 'Connecting...',
                ru: 'Подключение...',
                es: 'Conectando...',
                zh: '连接中...',
                hi: 'कनेक्ट हो रहा है...',
                ar: 'جاري الاتصال...',
                pt: 'Conectando...',
                fr: 'Connexion...',
                de: 'Verbinde...',
                ja: '接続中...',
                ko: '연결 중...',
                it: 'Connessione...',
                tr: 'Bağlanıyor...',
                vi: 'Đang kết nối...'
            },
            disconnecting: {
                en: 'Disconnecting...',
                ru: 'Отключение...',
                es: 'Desconectando...',
                zh: '断开中...',
                hi: 'डिस्कनेक्ट हो रहा है...',
                ar: 'جاري قطع الاتصال...',
                pt: 'Desconectando...',
                fr: 'Déconnexion...',
                de: 'Trenne...',
                ja: '切断中...',
                ko: '연결 끊는 중...',
                it: 'Disconnessione...',
                tr: 'Bağlantı kesiliyor...',
                vi: 'Đang ngắt kết nối...'
            }
        };
        
        this.init();
    }

    setupMouseMoveEffect() {
        const body = document.body;
        let rafId = null;
        let currentX = 0;
        let currentY = 0;
        let targetX = 0;
        let targetY = 0;
        
        const updatePosition = () => {
            currentX += (targetX - currentX) * 0.1;
            currentY += (targetY - currentY) * 0.1;
            
            body.style.setProperty('--mouse-x', `${currentX}px`);
            body.style.setProperty('--mouse-y', `${currentY}px`);
            
            rafId = requestAnimationFrame(updatePosition);
        };
        
        document.addEventListener('mousemove', (e) => {
            targetX = (e.clientX / window.innerWidth - 0.5) * 15;
            targetY = (e.clientY / window.innerHeight - 0.5) * 15;
            
            body.classList.add('moving');
            
            if (!rafId) {
                rafId = requestAnimationFrame(updatePosition);
            }
        });
        
        document.addEventListener('mouseleave', () => {
            targetX = 0;
            targetY = 0;
            body.classList.remove('moving');
        });
        
        window.addEventListener('beforeunload', () => {
            if (rafId) {
                cancelAnimationFrame(rafId);
            }
        });
    }

    async init() {
        setTimeout(() => {
            if (document.body) {
                document.body.classList.add('loaded');
                this.renderLanguageList();
                this.loadData();
            }
        }, 2500);

        this.bindEvents();
        this.loadLanguage();
        this.setupMouseMoveEffect();
    }

    toggleElementsVisibility(hide) {
        const elements = [
            document.querySelector('h1'),
            document.querySelector('.connect-button'),
            document.querySelector('.timer'),
            document.querySelector('.info-panel')
        ];
        
        elements.forEach(el => {
            if (el) {
                if (hide) {
                    el.setAttribute('hidden', 'true');
                } else {
                    el.removeAttribute('hidden');
                }
            }
        });
    }

    setVPNBackground(isConnected) {
        const body = document.body;
        
        if (isConnected) {
            body.classList.add('vpn-connected');
        } else {
            body.classList.remove('vpn-connected');
        }
        
        let gradientOverlay = document.querySelector('.vpn-gradient-overlay');
        
        if (isConnected) {
            if (!gradientOverlay) {
                gradientOverlay = document.createElement('div');
                gradientOverlay.className = 'vpn-gradient-overlay';
                body.appendChild(gradientOverlay);
            }
            
            gradientOverlay.classList.remove('hide');
            gradientOverlay.classList.add('show');
            body.style.background = '#0A051C';
            
        } else {
            if (gradientOverlay) {
                gradientOverlay.classList.remove('show');
                gradientOverlay.classList.add('hide');
                
                setTimeout(() => {
                    if (gradientOverlay && gradientOverlay.parentNode) {
                        gradientOverlay.remove();
                    }
                }, 500);
            }
            
            body.style.background = '#0A051C';
        }
    }

    renderLanguageList() {
        const listContainer = document.getElementById('language-list');
        if (!listContainer) return;
        
        listContainer.innerHTML = '';
        
        this.languages.forEach(lang => {
            const button = document.createElement('button');
            button.className = 'language-item';
            button.setAttribute('data-lang', lang.code);
            button.innerHTML = `
                <span class="flag">${lang.flag}</span>
                <span class="lang-name">${lang.name}</span>
            `;
            
            if (lang.code === this.currentLanguage) {
                button.classList.add('active');
            }
            
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                this.changeLanguage(lang.code);
                this.closeLanguageScreen();
            });
            
            listContainer.appendChild(button);
        });
    }

    bindEvents() {
        const langToggle = document.getElementById('lang-toggle');
        if (langToggle) {
            langToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                
                const languageScreen = document.getElementById('language-screen');
                if (languageScreen) {
                    if (languageScreen.classList.contains('open')) {
                        this.closeLanguageScreen();
                    } else {
                        this.openLanguageScreen();
                    }
                }
            });
        }

        const languageScreen = document.getElementById('language-screen');
        if (languageScreen) {
            languageScreen.addEventListener('click', (e) => {
                if (e.target === languageScreen) {
                    this.closeLanguageScreen();
                }
            });
        }

        const connectButton = document.querySelector('.connect-button');
        if (connectButton) {
            connectButton.addEventListener('click', (e) => {
                e.stopPropagation();
                this.handleConnect();
            });
        }
    }

    toggleLanguageScreen(show) {
        const languageScreen = document.getElementById('language-screen');
        const speedContainer = document.getElementById('speed-container');
        
        if (show) {
            languageScreen.classList.add('open');
            if (speedContainer) {
                speedContainer.style.display = 'none';
            }
        } else {
            languageScreen.classList.remove('open');
            if (speedContainer) {
                speedContainer.style.display = 'flex';
            }
        }
        this.toggleElementsVisibility(show);
    }

    openLanguageScreen() {
        this.toggleLanguageScreen(true);
        this.updateActiveLanguageInList();
    }

    closeLanguageScreen() {
        this.toggleLanguageScreen(false);
    }

    updateActiveLanguageInList() {
        document.querySelectorAll('.language-item').forEach(item => {
            const langCode = item.getAttribute('data-lang');
            if (langCode === this.currentLanguage) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    }

    async loadData() {
        await this.loadServers();
        await this.loadStatus();
        this.updateUI();
    }

    async loadServers() {
        try {
            const response = await this.sendMessage({ action: 'GET_SERVERS' });
            this.servers = response.servers || [];
            this.renderServerInfo();
        } catch (error) {
            console.log('Error loading server list');
        }
    }

    async loadStatus() {
        try {
            const response = await this.sendMessage({ action: 'GET_VPN_STATUS' });
            this.currentStatus = response;
            
            if (this.currentStatus?.isConnected) {
                this.setVPNBackground(true);
            } else {
                this.setVPNBackground(false);
            }
        } catch (error) {
            console.log('Error loading connection status');
        }
    }

    renderServerInfo() {
        const ipElement = document.getElementById('ip-address');
        if (!ipElement) return;
        
        if (this.currentStatus?.currentServer) {
            ipElement.textContent = this.currentStatus.currentServer.host || 'Unknown';
        } else if (this.servers.length > 0) {
            ipElement.textContent = `${this.servers.length} servers available`;
        } else {
            ipElement.textContent = 'Checking...';
        }
    }

    startTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }
        
        this.updateTimerFromBackground();
        this.timerInterval = setInterval(() => {
            this.updateTimerFromBackground();
        }, 1000);
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        
        const timerDisplay = document.getElementById('timer-display');
        if (timerDisplay) {
            timerDisplay.textContent = '00 : 00 : 00';
        }
    }

    async updateTimerFromBackground() {
        const timerDisplay = document.getElementById('timer-display');
        if (!timerDisplay) return;
        
        try {
            const response = await this.sendMessage({ action: 'GET_VPN_STATUS' });
            
            if (response?.isConnected) {
                const totalSeconds = response.connectionTime || 0;
                
                const hours = Math.floor(totalSeconds / 3600);
                const minutes = Math.floor((totalSeconds % 3600) / 60);
                const seconds = totalSeconds % 60;
                
                const timeString = `${hours.toString().padStart(2, '0')} : ${minutes.toString().padStart(2, '0')} : ${seconds.toString().padStart(2, '0')}`;
                timerDisplay.textContent = timeString;
            }
        } catch (error) {
            console.log('Timer error:', error);
        }
    }

    async testSpeed() {
        const downloadEl = document.getElementById('download-speed');
        const uploadEl = document.getElementById('upload-speed');
        const response = await this.sendMessage({ action: 'GET_VPN_STATUS' });
        
        if (!downloadEl || !uploadEl) return;
        
        if (!response?.isConnected) {
            if (downloadEl.textContent !== '0.0') downloadEl.textContent = '0.0';
            if (uploadEl.textContent !== '0.0') uploadEl.textContent = '0.0';
            return;
        }
        
        try {
            // Тест Download - загружаем файл через VPN
            const downloadUrl = 'https://speed.cloudflare.com/__down?bytes=500000';
            const downloadStart = performance.now();
            
            const downloadResponse = await fetch(downloadUrl, { 
                cache: 'no-store',
                mode: 'cors'
            });
            
            const downloadBlob = await downloadResponse.blob();
            const downloadEnd = performance.now();
            
            const downloadTimeSec = (downloadEnd - downloadStart) / 1000;
            const downloadBits = downloadBlob.size * 8;
            const downloadMbps = (downloadBits / 1024 / 1024 / downloadTimeSec).toFixed(1);
            
            downloadEl.textContent = downloadMbps;
            
            // Тест Upload - отправляем данные через VPN
            const uploadUrl = 'https://speed.cloudflare.com/__up';
            const uploadData = new ArrayBuffer(250000); // 250KB
            const uploadStart = performance.now();
            
            await fetch(uploadUrl, {
                method: 'POST',
                body: uploadData,
                mode: 'cors',
                cache: 'no-store'
            });
            
            const uploadEnd = performance.now();
            const uploadTimeSec = (uploadEnd - uploadStart) / 1000;
            const uploadBits = uploadData.byteLength * 8;
            const uploadMbps = (uploadBits / 1024 / 1024 / uploadTimeSec).toFixed(1);
            
            uploadEl.textContent = uploadMbps;
            
        } catch (error) {
            console.log('Speed test error:', error);
            // Если тест не удался, показываем заглушку
            if (downloadEl.textContent === '0.0') downloadEl.textContent = '?';
            if (uploadEl.textContent === '0.0') uploadEl.textContent = '?';
            
            // Повторим через 2 секунды
            setTimeout(() => this.testSpeed(), 2000);
        }
    }

    startSpeedTest() {
        this.stopSpeedTest();
        this.testSpeed();
        this.speedInterval = setInterval(() => this.testSpeed(), 10000);
    }

    stopSpeedTest() {
        if (this.speedInterval) {
            clearInterval(this.speedInterval);
            this.speedInterval = null;
        }
        const downloadEl = document.getElementById('download-speed');
        const uploadEl = document.getElementById('upload-speed');
        if (downloadEl) downloadEl.textContent = '0.0';
        if (uploadEl) uploadEl.textContent = '0.0';
    }

    updateAllTexts(statusType) {
        const connectionStatus = document.getElementById('connection-status');
        const headerTitle = document.querySelector('h1');
        
        if (!connectionStatus || !headerTitle) return;
        
        const statusText = this.statusTranslations[statusType]?.[this.currentLanguage] || 
                          this.statusTranslations[statusType]?.en || 
                          statusType;
        
        const headerText = this.headerTranslations[statusType]?.[this.currentLanguage] || 
                          this.headerTranslations[statusType]?.en || 
                          statusType;
        
        connectionStatus.textContent = statusText;
        headerTitle.textContent = headerText;
        
        if (statusType === 'connected') {
            connectionStatus.style.color = '#4CAF50';
        } else if (statusType === 'disconnected') {
            connectionStatus.style.color = '#ff6b6b';
        } else {
            connectionStatus.style.color = '#ff9800';
        }
    }

    async updateUI() {
        const connectButton = document.querySelector('.connect-button');
        const infoPanel = document.getElementById('info-panel');

        if (!connectButton) return;

        const response = await this.sendMessage({ action: 'GET_VPN_STATUS' });
        
        this.currentStatus = response;

        if (response?.isConnected && response.currentServer) {
            const server = response.currentServer;
            connectButton.classList.add('connected');
            
            if (!connectButton.querySelector('.hollow-square')) {
                const hollowSquare = document.createElement('div');
                hollowSquare.className = 'hollow-square';
                connectButton.appendChild(hollowSquare);
            }
            
            if (!connectButton.querySelector('.ripple-ring')) {
                const ring1 = document.createElement('div');
                ring1.className = 'ripple-ring';
                connectButton.appendChild(ring1);
                
                const ring2 = document.createElement('div');
                ring2.className = 'ripple-ring-2';
                connectButton.appendChild(ring2);
                
                const ring3 = document.createElement('div');
                ring3.className = 'ripple-ring-3';
                connectButton.appendChild(ring3);
            }
            
            this.setVPNBackground(true);
            
            this.updateAllTexts('connected');
            
            setTimeout(() => {
                if (infoPanel) infoPanel.classList.add('connected');
            }, 100);
            
            this.updateConnectedServerInfo(server);
            this.startTimer();
            
            if (!this.speedInterval) {
                this.startSpeedTest();
            }
            
        } else {
            connectButton.classList.remove('connected');
            
            const hollowSquare = connectButton.querySelector('.hollow-square');
            if (hollowSquare) hollowSquare.remove();
            
            const rings = connectButton.querySelectorAll('.ripple-ring, .ripple-ring-2, .ripple-ring-3');
            rings.forEach(ring => ring.remove());
            
            this.setVPNBackground(false);
            
            this.updateAllTexts('disconnected');
            
            if (infoPanel) infoPanel.classList.remove('connected');
            this.stopTimer();
            this.stopSpeedTest();
            
            const downloadEl = document.getElementById('download-speed');
            const uploadEl = document.getElementById('upload-speed');
            if (downloadEl) downloadEl.textContent = '0.0';
            if (uploadEl) uploadEl.textContent = '0.0';
        }
    }

    updateConnectedServerInfo(server) {
        const ipElement = document.getElementById('ip-address');
        const protocolElement = document.getElementById('protocol');
        
        if (ipElement) {
            ipElement.textContent = server.host || 'Unknown';
        }
        if (protocolElement) {
            protocolElement.textContent = 'Xray';
        }
    }

    async handleConnect() {
        const connectButton = document.querySelector('.connect-button');

        if (!connectButton) return;

        if (this.currentStatus?.isConnected) {
            connectButton.classList.add('connecting');
            
            this.updateAllTexts('disconnecting');

            const result = await this.sendMessage({ action: 'DISCONNECT_VPN' });
            
            connectButton.classList.remove('connecting');
            if (result.success) {
                await this.loadStatus();
                this.updateUI();
            }
            
        } else {
            connectButton.classList.add('connecting');
            
            this.updateAllTexts('connecting');

            const result = await this.sendMessage({ action: 'CONNECT_VPN' });
            
            connectButton.classList.remove('connecting');
            if (result.success) {
                await this.loadStatus();
                this.updateUI();
            }
        }
    }

    loadLanguage() {
        chrome.storage.local.get('vpnLanguage', (result) => {
            if (result.vpnLanguage) {
                this.currentLanguage = result.vpnLanguage;
                this.applyTranslations();
            } else {
                this.currentLanguage = 'en';
                chrome.storage.local.set({ vpnLanguage: 'en' });
            }
            this.updateActiveLanguageInList();
        });
    }

    changeLanguage(lang) {
        this.currentLanguage = lang;
        chrome.storage.local.set({ vpnLanguage: lang });
        this.applyTranslations();
        this.updateActiveLanguageInList();
    }

    async applyTranslations() {
        const response = await this.sendMessage({ action: 'GET_VPN_STATUS' });
        if (response?.isConnected) {
            this.updateAllTexts('connected');
        } else {
            this.updateAllTexts('disconnected');
        }
        
        document.querySelectorAll('.info-label').forEach(element => {
            const translation = element.getAttribute(`data-${this.currentLanguage}`);
            if (translation) {
                element.textContent = translation;
            }
        });
    }

    getTranslation(key) {
        return key;
    }

    sendMessage(message) {
        return new Promise((resolve) => {
            chrome.runtime.sendMessage(message, (response) => {
                resolve(response || {});
            });
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.popupController = new PopupController();
});