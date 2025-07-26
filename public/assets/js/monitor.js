// Monitoramento e Analytics
(function() {
    // Performance Monitoring
    if ('performance' in window && 'PerformanceObserver' in window) {
        // Core Web Vitals
        const vitalsData = {};
        
        // LCP (Largest Contentful Paint)
        new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const lastEntry = entries[entries.length - 1];
            vitalsData.lcp = lastEntry.renderTime || lastEntry.loadTime;
            sendVitals();
        }).observe({ type: 'largest-contentful-paint', buffered: true });
        
        // FID (First Input Delay)
        new PerformanceObserver((list) => {
            const entries = list.getEntries();
            entries.forEach((entry) => {
                vitalsData.fid = entry.processingStart - entry.startTime;
                sendVitals();
            });
        }).observe({ type: 'first-input', buffered: true });
        
        // CLS (Cumulative Layout Shift)
        let clsValue = 0;
        new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
                if (!entry.hadRecentInput) {
                    clsValue += entry.value;
                    vitalsData.cls = clsValue;
                }
            }
        }).observe({ type: 'layout-shift', buffered: true });
        
        // Send vitals data
        function sendVitals() {
            if (vitalsData.lcp && vitalsData.fid && vitalsData.cls !== undefined) {
                // Send to analytics
                if (typeof gtag !== 'undefined') {
                    gtag('event', 'web_vitals', {
                        'event_category': 'Web Vitals',
                        'lcp': Math.round(vitalsData.lcp),
                        'fid': Math.round(vitalsData.fid),
                        'cls': vitalsData.cls.toFixed(3)
                    });
                }
            }
        }
    }
    
    // Error Tracking
    window.addEventListener('error', function(e) {
        const errorData = {
            message: e.message,
            source: e.filename,
            line: e.lineno,
            col: e.colno,
            error: e.error ? e.error.stack : '',
            userAgent: navigator.userAgent,
            timestamp: new Date().toISOString()
        };
        
        // Send to error tracking service
        fetch('https://api.dnxtai.com/errors', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(errorData)
        }).catch(() => {});
    });
    
    // User Engagement Tracking
    let engagementData = {
        sessionStart: Date.now(),
        pageViews: 1,
        clicks: 0,
        scrollDepth: 0,
        timeOnPage: 0
    };
    
    // Track clicks
    document.addEventListener('click', function(e) {
        engagementData.clicks++;
        
        // Track specific CTAs
        if (e.target.classList.contains('btn')) {
            if (typeof gtag !== 'undefined') {
                gtag('event', 'cta_click', {
                    'event_category': 'engagement',
                    'event_label': e.target.textContent.trim()
                });
            }
        }
    });
    
    // Track scroll depth
    let maxScroll = 0;
    window.addEventListener('scroll', function() {
        const scrollPercent = (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100;
        maxScroll = Math.max(maxScroll, scrollPercent);
        engagementData.scrollDepth = Math.round(maxScroll);
    });
    
    // Send engagement data before page unload
    window.addEventListener('beforeunload', function() {
        engagementData.timeOnPage = Math.round((Date.now() - engagementData.sessionStart) / 1000);
        
        // Send as beacon
        if (navigator.sendBeacon) {
            navigator.sendBeacon('https://api.dnxtai.com/analytics/engagement', 
                JSON.stringify(engagementData));
        }
    });
})();
