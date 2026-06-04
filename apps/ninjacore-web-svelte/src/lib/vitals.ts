// Web Vitals monitoring
// Measures real-user performance metrics

export interface Vital {
  name: 'FCP' | 'LCP' | 'CLS' | 'INP' | 'TTFB';
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta: number;
  id: string;
}

const thresholds = {
  FCP: { good: 1800, poor: 3000 },
  LCP: { good: 2500, poor: 4000 },
  CLS: { good: 0.1, poor: 0.25 },
  INP: { good: 200, poor: 500 },
  TTFB: { good: 800, poor: 1800 },
};

export function getRating(
  name: string,
  value: number
): 'good' | 'needs-improvement' | 'poor' {
  const threshold = thresholds[name as keyof typeof thresholds];
  if (!threshold) return 'good';

  if (value <= threshold.good) return 'good';
  if (value <= threshold.poor) return 'needs-improvement';
  return 'poor';
}

export function sendVital(vital: Vital) {
  // Send to analytics endpoint
  const analytics = {
    name: vital.name,
    value: vital.value,
    rating: vital.rating,
    timestamp: new Date().toISOString(),
    url: typeof window !== 'undefined' ? window.location.href : '',
  };

  // Log in development
  if (typeof window !== 'undefined') {
    console.log(`[${vital.name}] ${vital.value.toFixed(0)}ms (${vital.rating})`);
  }

  // Send to backend (optional)
  // fetch('/api/vitals', { method: 'POST', body: JSON.stringify(analytics) });
}

export function observeVitals() {
  if (typeof window === 'undefined') return;

  // Largest Contentful Paint
  if ('PerformanceObserver' in window) {
    try {
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];

        sendVital({
          name: 'LCP',
          value: lastEntry.renderTime || lastEntry.loadTime,
          rating: getRating('LCP', lastEntry.renderTime || lastEntry.loadTime),
          delta: 0,
          id: lastEntry.id || `lcp-${Date.now()}`,
        });
      });

      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
    } catch (e) {
      // Graceful failure
    }

    // Cumulative Layout Shift
    try {
      let clsValue = 0;
      const clsObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) {
            clsValue += (entry as any).value;
          }
        }

        sendVital({
          name: 'CLS',
          value: clsValue,
          rating: getRating('CLS', clsValue),
          delta: 0,
          id: `cls-${Date.now()}`,
        });
      });

      clsObserver.observe({ entryTypes: ['layout-shift'] });
    } catch (e) {
      // Graceful failure
    }

    // Interaction to Next Paint
    try {
      const inpObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          sendVital({
            name: 'INP',
            value: (entry as any).duration,
            rating: getRating('INP', (entry as any).duration),
            delta: 0,
            id: entry.name,
          });
        }
      });

      inpObserver.observe({ entryTypes: ['event'] });
    } catch (e) {
      // Graceful failure
    }
  }

  // Time to First Byte (via Navigation Timing)
  if ('performance' in window && performance.timing) {
    const ttfb =
      performance.timing.responseStart - performance.timing.navigationStart;

    sendVital({
      name: 'TTFB',
      value: ttfb,
      rating: getRating('TTFB', ttfb),
      delta: 0,
      id: `ttfb-${Date.now()}`,
    });
  }
}
