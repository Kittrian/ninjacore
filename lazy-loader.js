// Lazy Loader - Load non-critical assets after first paint
(function() {
  // Load deferred CSS
  function loadDeferredCSS() {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/dist/deferred.css';
    link.media = 'print';
    link.onload = function() { this.media = 'all'; };
    document.head.appendChild(link);
  }

  // Load page-specific CSS on demand
  function loadPageCSS(pageName) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `/dist/${pageName}.css`;
    document.head.appendChild(link);
  }

  // Load page-specific JS bundle on demand
  function loadPageBundle(pageName) {
    const script = document.createElement('script');
    script.src = `/dist/${pageName}.bundle.js`;
    script.async = true;
    document.body.appendChild(script);
  }

  // Intersection Observer to lazy-load when element enters viewport
  function observeLazyLoad(selector, onVisible) {
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            onVisible(entry.target);
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.1 });

      document.querySelectorAll(selector).forEach(el => observer.observe(el));
    }
  }

  // Expose globally
  window.LazyLoad = {
    css: loadDeferredCSS,
    pageCSS: loadPageCSS,
    pageBundle: loadPageBundle,
    observeViewport: observeLazyLoad
  };

  // Auto-load deferred CSS when page is interactive
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadDeferredCSS);
  } else {
    loadDeferredCSS();
  }
})();
