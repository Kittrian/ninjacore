// Health check and business settings routes

export const handler = async (context) => {
  const { req, res, pathname, method } = context;
  const { send, readBody, readStore, writeStore, seedData, getCurrentOwnerKey } = context.utils;

  // GET /api/health
  if (pathname === '/api/health' && method === 'GET') {
    send(res, 200, { ok: true });
    return true;
  }

  // GET /api/business-settings
  if (pathname === '/api/business-settings' && method === 'GET') {
    const store = await readStore();
    send(res, 200, {
      ok: true,
      settings: {
        ...seedData.businessSettings,
        ...(store.businessSettings && typeof store.businessSettings === 'object' ? store.businessSettings : {}),
      },
    });
    return true;
  }

  // PUT /api/business-settings
  if (pathname === '/api/business-settings' && method === 'PUT') {
    try {
      const body = await readBody(req);
      const incoming = body?.settings && typeof body.settings === 'object' ? body.settings : {};
      const store = await readStore();
      store.businessSettings = {
        ...seedData.businessSettings,
        ...incoming,
      };
      await writeStore(store, getCurrentOwnerKey(), { syncClientIds: [] });
      send(res, 200, { ok: true, settings: store.businessSettings });
    } catch (error) {
      send(res, 400, { error: error.message || 'Unable to save business settings.' });
    }
    return true;
  }

  return false;
};
