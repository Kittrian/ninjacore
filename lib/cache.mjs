import { createClient } from 'redis';
import { createHash } from 'node:crypto';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
let redisClient = null;
let isRedisConnected = false;

const createReportCacheKey = (clientId, agency, token) => {
  const hash = createHash('sha256')
    .update(`${clientId}:${agency}:${token}`)
    .digest('hex');
  return `mfsnreport:${hash.slice(0, 16)}`;
};

const getRedisClient = async () => {
  if (redisClient) {
    return redisClient;
  }

  try {
    redisClient = createClient({ url: redisUrl });

    redisClient.on('error', (err) => {
      console.error('Redis client error:', err);
      isRedisConnected = false;
    });

    await redisClient.connect();
    isRedisConnected = true;
    console.log('Redis connected:', redisUrl);
    return redisClient;
  } catch (error) {
    console.warn('Failed to connect to Redis:', error.message);
    isRedisConnected = false;
    return null;
  }
};

const closeRedisClient = async () => {
  if (redisClient && isRedisConnected) {
    try {
      await redisClient.disconnect();
    } catch (error) {
      console.warn('Error disconnecting Redis:', error);
    }
  }
};

const getCachedReport = async (reportKey) => {
  if (!isRedisConnected) {
    return null;
  }

  try {
    const client = await getRedisClient();
    if (!client) return null;

    const cached = await client.get(`report:${reportKey}`);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (error) {
    console.warn('Error getting cached report:', error.message);
  }

  return null;
};

const cacheReport = async (reportKey, data, ttlSeconds = 86400) => {
  if (!isRedisConnected) {
    return;
  }

  try {
    const client = await getRedisClient();
    if (!client) return;

    await client.setEx(`report:${reportKey}`, ttlSeconds, JSON.stringify(data));
  } catch (error) {
    console.warn('Error caching report:', error.message);
  }
};

const getCachedAiResult = async (promptHash) => {
  if (!isRedisConnected) {
    return null;
  }

  try {
    const client = await getRedisClient();
    if (!client) return null;

    const cached = await client.get(`ai:${promptHash}`);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (error) {
    console.warn('Error getting cached AI result:', error.message);
  }

  return null;
};

const cacheAiResult = async (promptHash, result, ttlSeconds = 604800) => {
  if (!isRedisConnected) {
    return;
  }

  try {
    const client = await getRedisClient();
    if (!client) return;

    await client.setEx(`ai:${promptHash}`, ttlSeconds, JSON.stringify(result));
  } catch (error) {
    console.warn('Error caching AI result:', error.message);
  }
};

const getCachedReportData = async (clientId, source) => {
  if (!isRedisConnected) {
    return null;
  }

  try {
    const client = await getRedisClient();
    if (!client) return null;

    const cacheKey = `report_data:${clientId}:${source}`;
    const cached = await client.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (error) {
    console.warn('Error getting cached report data:', error.message);
  }

  return null;
};

const cacheReportData = async (clientId, source, data, ttlSeconds = 3600) => {
  if (!isRedisConnected) {
    return;
  }

  try {
    const client = await getRedisClient();
    if (!client) return;

    const cacheKey = `report_data:${clientId}:${source}`;
    await client.setEx(cacheKey, ttlSeconds, JSON.stringify(data));
  } catch (error) {
    console.warn('Error caching report data:', error.message);
  }
};

const invalidateReportDataCache = async (clientId, source) => {
  if (!isRedisConnected) {
    return;
  }

  try {
    const client = await getRedisClient();
    if (!client) return;

    const cacheKey = `report_data:${clientId}:${source}`;
    await client.del(cacheKey);
  } catch (error) {
    console.warn('Error invalidating report data cache:', error.message);
  }
};

const memoizeReportFetch = async (clientId, agency, token, fetchFn, ttlSeconds = 1800) => {
  if (!isRedisConnected) {
    return fetchFn();
  }

  const cacheKey = createReportCacheKey(clientId, agency, token);

  try {
    const client = await getRedisClient();
    if (!client) return fetchFn();

    const cached = await client.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const result = await fetchFn();
    await client.setEx(cacheKey, ttlSeconds, JSON.stringify(result));
    return result;
  } catch (error) {
    console.warn('Error with report memoization:', error.message);
    return fetchFn();
  }
};

const invalidateReportCache = async (reportKey) => {
  if (!isRedisConnected) {
    return;
  }

  try {
    const client = await getRedisClient();
    if (!client) return;

    await client.del(`report:${reportKey}`);
  } catch (error) {
    console.warn('Error invalidating cache:', error.message);
  }
};

export {
  getRedisClient,
  closeRedisClient,
  getCachedReport,
  cacheReport,
  getCachedAiResult,
  cacheAiResult,
  invalidateReportCache,
  getCachedReportData,
  cacheReportData,
  invalidateReportDataCache,
  memoizeReportFetch,
};
