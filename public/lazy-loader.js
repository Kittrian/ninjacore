// Lazy loading utility for deferring non-critical features
// Loads modules only when needed or after initial page interactivity

const lazyModules = new Map();

export const lazyLoad = async (modulePath, options = {}) => {
  const { timeout = 2000 } = options;

  if (lazyModules.has(modulePath)) {
    return lazyModules.get(modulePath);
  }

  try {
    const module = await import(modulePath);
    lazyModules.set(modulePath, module);
    return module;
  } catch (err) {
    console.error(`[lazyLoad] failed to load ${modulePath}:`, err.message);
    return null;
  }
};

export const lazyLoadAfterInteractive = (modulePath, callback) => {
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(async () => {
      const module = await lazyLoad(modulePath);
      if (module && callback) callback(module);
    }, { timeout: 3000 });
  } else {
    window.setTimeout(async () => {
      const module = await lazyLoad(modulePath);
      if (module && callback) callback(module);
    }, 0);
  }
};

export const lazyLoadOnEvent = (eventName, selector, modulePath) => {
  const element = document.querySelector(selector);
  if (!element) return;

  element.addEventListener(eventName, async (event) => {
    const module = await lazyLoad(modulePath);
    if (module?.handleEvent) {
      module.handleEvent(event);
    }
  }, { once: false });
};
