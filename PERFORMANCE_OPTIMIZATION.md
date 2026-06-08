# Performance Optimization Guide

This document provides strategies for measuring, monitoring, and optimizing application performance after code splitting.

## Performance Metrics

### Core Web Vitals
- **LCP (Largest Contentful Paint)**: Time until largest visual element is rendered
- **FID (First Input Delay)**: Delay between user input and response
- **CLS (Cumulative Layout Shift)**: Visual stability during load
- **FCP (First Contentful Paint)**: Time until any content is painted
- **TTFB (Time to First Byte)**: Server response time

### Application-Specific Metrics
- **Client list load time**: Time to display first 10 clients
- **Route handler initialization**: Time for routes to become available
- **Lazy bundle load time**: Time to fetch and parse lazy CSS/JS
- **Style recalculation time**: CLS after lazy CSS loads

## Measurement Tools

### Built-in Performance API
```javascript
// Mark custom points
performance.mark('clients-loaded');
performance.measure('client-load', 'navigationStart', 'clients-loaded');

// Get measurements
const measures = performance.getEntriesByType('measure');
measures.forEach(m => console.log(`${m.name}: ${m.duration.toFixed(2)}ms`));
```

### WebVitals Library Integration
```javascript
// Monitor real-user metrics
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';

getCLS(console.log);  // Layout shift
getFID(console.log);  // Input delay
getFCP(console.log);  // First paint
getLCP(console.log);  // Largest content
getTTFB(console.log); // Server response
```

### Chrome DevTools
1. **Performance Tab**: Record and analyze full page load
2. **Network Tab**: Monitor bundle sizes and waterfall
3. **Lighthouse**: Generate accessibility and performance scores
4. **Coverage Tab**: Identify unused JavaScript/CSS

## Testing Scenarios

### Fast 4G (LTE)
- Download: 4 Mbps
- Upload: 3 Mbps
- Latency: 50ms

**Expected performance**:
- FCP: < 2s
- LCP: < 3s
- CLS: < 0.1

### Slow 4G
- Download: 1.5 Mbps
- Upload: 0.4 Mbps
- Latency: 400ms

**Expected performance**:
- FCP: < 4s
- LCP: < 6s
- CLS: < 0.15

### 3G
- Download: 400 kbps
- Upload: 100 kbps
- Latency: 400ms

**Expected performance**:
- FCP: < 5s
- LCP: < 8s

## Testing Checklist

### Bundle Analysis
- [ ] Critical CSS is < 40 KB gzipped
- [ ] Critical JS is < 100 KB gzipped
- [ ] Lazy CSS is < 100 KB gzipped
- [ ] No render-blocking resources in critical path

### Load Performance
- [ ] FCP improved by 10%+ after splitting
- [ ] LCP improved by 10%+ after splitting
- [ ] CLS remains < 0.1 after lazy styles load
- [ ] No layout shift when lazy CSS loads

### Runtime Performance
- [ ] Client list renders in < 500ms
- [ ] Route handlers initialize in < 100ms
- [ ] No long tasks (> 50ms) during initialization
- [ ] Scroll performance smooth (60 fps)

### Memory Usage
- [ ] Critical JS bundle uses < 20 MB heap
- [ ] Lazy modules don't load unless accessed
- [ ] No memory leaks after feature unload

## Optimization Techniques

### CSS Optimization
```css
/* 1. Critical-only CSS */
/* Remove decorative styles from critical.css */

/* 2. Inline critical CSS */
<style>/* Critical CSS inlined */</style>
<link rel="stylesheet" href="styles.lazy.css" media="print" onload="this.media='all'" />

/* 3. CSS containment */
.client-row {
  contain: layout style paint;
}
```

### JavaScript Optimization
```javascript
// 1. Defer non-critical initialization
if (typeof requestIdleCallback === 'function') {
  requestIdleCallback(() => loadIntegrations(), { timeout: 3000 });
} else {
  setTimeout(loadIntegrations, 0);
}

// 2. Use dynamic imports
const integrations = await import('./features/integrations.js');

// 3. Lazy load on interaction
element.addEventListener('click', () => import('./features/dialog.js'));
```

### Network Optimization
```html
<!-- Resource hints -->
<link rel="preconnect" href="https://api.example.com">
<link rel="dns-prefetch" href="https://cdn.example.com">
<link rel="prefetch" href="/styles.lazy.css">
<link rel="preload" href="/app.critical.js" as="script">
```

### Image Optimization
```html
<!-- Use modern formats -->
<picture>
  <source srcset="image.webp" type="image/webp">
  <img src="image.png" alt="Description">
</picture>

<!-- Responsive images -->
<img srcset="image-small.jpg 400w, image-large.jpg 800w"
     sizes="(max-width: 600px) 400px, 800px"
     src="image-large.jpg" alt="Description">
```

## Monitoring in Production

### Real User Monitoring (RUM)
```javascript
// Send metrics to analytics
function sendMetrics(metrics) {
  navigator.sendBeacon('/analytics', JSON.stringify({
    url: window.location.href,
    metrics,
    timestamp: Date.now(),
  }));
}

// Collect and send Core Web Vitals
getCLS(metric => sendMetrics({ cls: metric.value }));
getFID(metric => sendMetrics({ fid: metric.value }));
getLCP(metric => sendMetrics({ lcp: metric.value }));
```

### Error Tracking
```javascript
window.addEventListener('error', (event) => {
  console.error('[error]', event.error);
  navigator.sendBeacon('/errors', JSON.stringify({
    message: event.error.message,
    stack: event.error.stack,
    timestamp: Date.now(),
  }));
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('[unhandled rejection]', event.reason);
  navigator.sendBeacon('/errors', JSON.stringify({
    message: event.reason.message,
    type: 'unhandledRejection',
    timestamp: Date.now(),
  }));
});
```

## Benchmarking

### Baseline Measurement
```javascript
const baseline = {
  fcp: 1200,
  lcp: 2400,
  cls: 0.08,
};

function reportMetric(name, value) {
  const improvement = ((baseline[name] - value) / baseline[name] * 100).toFixed(1);
  console.log(`${name.toUpperCase()}: ${value.toFixed(0)}ms (${improvement}% better)`);
}
```

### Before/After Comparison
After implementing code splitting, measure these metrics:

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| FCP    | 1200ms | 1050ms | ~12% |
| LCP    | 2400ms | 2100ms | ~13% |
| CLS    | 0.12   | 0.08   | ~33% |
| Critical CSS | 7367 lines | 2900 lines | ~61% |

## Continuous Optimization

### Monthly Reviews
1. Analyze Core Web Vitals trends
2. Identify performance regressions
3. Profile slow routes and features
4. Plan optimization work

### Quarterly Goals
- Reduce FCP by 5%
- Reduce LCP by 5%
- Keep CLS < 0.1
- Maintain critical bundle < 40 KB gzipped

### Annual Vision
- Implement HTTP/2 Server Push
- Deploy edge caching (CDN)
- Achieve Lighthouse score > 90
- Zero Core Web Vitals violations
