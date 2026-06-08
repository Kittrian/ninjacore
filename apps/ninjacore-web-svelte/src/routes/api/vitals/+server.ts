import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';

// In-memory store for vitals (use database in production)
const vitalsStore: Array<{
  name: string;
  value: number;
  rating: string;
  timestamp: string;
  url: string;
  userAgent: string;
}> = [];

export const POST: RequestHandler = async ({ request }) => {
  try {
    const vital = await request.json();

    vitalsStore.push({
      ...vital,
      timestamp: new Date().toISOString(),
      url: request.headers.get('referer') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    });

    // Keep only last 1000 metrics
    if (vitalsStore.length > 1000) {
      vitalsStore.shift();
    }

    return json({ success: true });
  } catch (error) {
    return json({ error: String(error) }, { status: 400 });
  }
};

export const GET: RequestHandler = async () => {
  // Return analytics dashboard data
  const stats = {
    totalMetrics: vitalsStore.length,
    lastHour: vitalsStore.filter((v) => {
      const time = new Date(v.timestamp).getTime();
      const oneHourAgo = Date.now() - 60 * 60 * 1000;
      return time > oneHourAgo;
    }).length,
    byRating: {
      good: vitalsStore.filter((v) => v.rating === 'good').length,
      needsImprovement: vitalsStore.filter((v) => v.rating === 'needs-improvement').length,
      poor: vitalsStore.filter((v) => v.rating === 'poor').length,
    },
    byMetric: {
      FCP: calculateAverage(vitalsStore.filter((v) => v.name === 'FCP')),
      LCP: calculateAverage(vitalsStore.filter((v) => v.name === 'LCP')),
      CLS: calculateAverage(vitalsStore.filter((v) => v.name === 'CLS')),
      INP: calculateAverage(vitalsStore.filter((v) => v.name === 'INP')),
      TTFB: calculateAverage(vitalsStore.filter((v) => v.name === 'TTFB')),
    },
    samples: vitalsStore.slice(-100),
  };

  return json(stats);
};

function calculateAverage(metrics: any[]): number | null {
  if (metrics.length === 0) return null;
  const sum = metrics.reduce((acc, m) => acc + m.value, 0);
  return Math.round(sum / metrics.length);
}
