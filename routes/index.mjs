// Router factory: dynamically loads route modules and matches incoming requests.
// Each route module exports async handlers that return true if matched, false otherwise.

const routeModules = [
  './auth.mjs',
  './health.mjs',
  './business.mjs',
];

const loadedRoutes = new Map();

export const matchRoute = async (context) => {
  const { req, res, pathname, method } = context;

  for (const modulePath of routeModules) {
    if (!loadedRoutes.has(modulePath)) {
      try {
        const module = await import(modulePath);
        loadedRoutes.set(modulePath, module);
      } catch (err) {
        console.error(`[router] failed to load ${modulePath}:`, err.message);
      }
    }

    const module = loadedRoutes.get(modulePath);
    if (module?.handler) {
      try {
        const matched = await module.handler(context);
        if (matched) return true;
      } catch (err) {
        console.error(`[router] handler error in ${modulePath}:`, err.message);
      }
    }
  }

  return false;
};
