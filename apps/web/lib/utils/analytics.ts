/**
 * Google Analytics utilities
 * Provides type-safe functions for tracking events
 */

declare global {
  interface Window {
    dataLayer: any[];
    gtag: (...args: any[]) => void;
  }
}

const GA_TRACKING_ID = 'G-RWBT69JCM7';

/**
 * Check if gtag is available
 */
function isGtagAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.gtag !== 'undefined';
}

/**
 * Track button clicks with detailed categorization
 */
export function trackButtonClick(
  buttonName: string,
  category?: string,
  source?: string,
  additionalData: Record<string, any> = {}
): void {
  if (isGtagAvailable()) {
    window.gtag('event', 'click', {
      event_category: category || 'Button Click',
      event_label: buttonName,
      event_source: source || 'unknown',
      ...additionalData,
    });
  }
}

/**
 * Track CTA (Call-to-Action) clicks
 */
export function trackCTA(ctaName: string, location: string): void {
  if (isGtagAvailable()) {
    window.gtag('event', 'cta_click', {
      event_category: 'CTA',
      event_label: ctaName,
      cta_location: location,
    });
  }
}

/**
 * Track navigation events
 */
export function trackNavigation(destination: string, source: string): void {
  if (isGtagAvailable()) {
    window.gtag('event', 'navigation', {
      event_category: 'Navigation',
      event_label: destination,
      navigation_source: source,
    });
  }
}

/**
 * Track tool usage
 */
export function trackToolUsage(toolName: string, action: string): void {
  if (isGtagAvailable()) {
    window.gtag('event', 'tool_usage', {
      event_category: 'Tools',
      event_label: toolName,
      tool_action: action,
    });
  }
}

/**
 * Track form submissions
 */
export function trackFormSubmit(formName: string, formType: string): void {
  if (isGtagAvailable()) {
    window.gtag('event', 'form_submit', {
      event_category: 'Form',
      event_label: formName,
      form_type: formType,
    });
  }
}

/**
 * Track user authentication events
 */
export function trackAuthEvent(action: string, method?: string): void {
  if (isGtagAvailable()) {
    window.gtag('event', action, {
      event_category: 'Authentication',
      event_label: action,
      auth_method: method || 'email',
    });
  }
}

/**
 * Track downloads
 */
export function trackDownload(fileName: string, fileType: string): void {
  if (isGtagAvailable()) {
    window.gtag('event', 'download', {
      event_category: 'Downloads',
      event_label: fileName,
      file_type: fileType,
    });
  }
}

/**
 * Track spec/result generations
 */
export function trackGeneration(type: string, mode: string): void {
  if (isGtagAvailable()) {
    window.gtag('event', 'generation_start', {
      event_category: 'Generation',
      event_label: type,
      generation_mode: mode,
    });
  }
}

/**
 * Track generation completion
 */
export function trackGenerationComplete(
  type: string,
  mode: string,
  success: boolean
): void {
  if (isGtagAvailable()) {
    window.gtag('event', 'generation_complete', {
      event_category: 'Generation',
      event_label: type,
      generation_mode: mode,
      success: success,
    });
  }
}

/**
 * Track external link clicks
 */
export function trackExternalLink(linkUrl: string, linkText?: string): void {
  if (isGtagAvailable()) {
    window.gtag('event', 'click', {
      event_category: 'External Link',
      event_label: linkText || linkUrl,
      link_url: linkUrl,
    });
  }
}

/**
 * Track modal interactions
 */
export function trackModal(modalName: string, action: string): void {
  if (isGtagAvailable()) {
    window.gtag('event', `modal_${action}`, {
      event_category: 'Modal',
      event_label: modalName,
      modal_action: action,
    });
  }
}

/**
 * Track FAQ interactions
 */
export function trackFAQ(question: string, action: string): void {
  if (isGtagAvailable()) {
    window.gtag('event', `faq_${action}`, {
      event_category: 'FAQ',
      event_label: question,
      faq_action: action,
    });
  }
}

/**
 * Track search actions
 */
export function trackSearch(searchTerm: string, searchType: string): void {
  if (isGtagAvailable()) {
    window.gtag('event', 'search', {
      event_category: 'Search',
      search_term: searchTerm,
      search_type: searchType,
    });
  }
}

/**
 * Track video/demo views
 */
export function trackDemoView(demoName: string, viewDuration?: number): void {
  if (isGtagAvailable()) {
    window.gtag('event', 'demo_view', {
      event_category: 'Demo',
      event_label: demoName,
      view_duration: viewDuration,
    });
  }
}

/**
 * Track user engagement time
 */
export function trackEngagement(pageName: string, timeSpent: number): void {
  if (isGtagAvailable()) {
    window.gtag('event', 'user_engagement', {
      event_category: 'Engagement',
      event_label: pageName,
      engagement_time_msec: timeSpent,
    });
  }
}

/**
 * Track errors
 */
export function trackError(
  errorType: string,
  errorMessage: string,
  errorLocation: string
): void {
  if (isGtagAvailable()) {
    window.gtag('event', 'exception', {
      description: errorMessage,
      fatal: false,
      error_type: errorType,
      error_location: errorLocation,
    });
  }
}

/**
 * Track user preferences
 */
export function trackPreference(preferenceName: string, preferenceValue: any): void {
  if (isGtagAvailable()) {
    window.gtag('event', 'preference_change', {
      event_category: 'Preferences',
      event_label: preferenceName,
      preference_value: String(preferenceValue),
    });
  }
}

/**
 * Track page view
 */
export function trackPageView(path: string, title?: string): void {
  if (isGtagAvailable()) {
    window.gtag('config', GA_TRACKING_ID, {
      page_path: path,
      page_title: title,
    });
  }
}

/**
 * Initialize scroll depth tracking
 */
let scrollDepthTracked: Record<number, boolean> = {
  25: false,
  50: false,
  75: false,
  100: false,
};

export function initScrollTracking(pageName: string): void {
  if (typeof window === 'undefined') return;

  const handleScroll = () => {
    const scrollPercent = Math.round(
      (window.scrollY /
        (document.documentElement.scrollHeight - window.innerHeight)) *
        100
    );

    const depths = [25, 50, 75, 100] as const;
    for (const depth of depths) {
      if (scrollPercent >= depth && !scrollDepthTracked[depth]) {
        scrollDepthTracked[depth] = true;
        if (isGtagAvailable()) {
          window.gtag('event', 'scroll', {
            event_category: 'Scroll Depth',
            event_label: pageName,
            scroll_depth: `${depth}%`,
          });
        }
      }
    }
  };

  window.addEventListener('scroll', handleScroll, { passive: true });
}

/**
 * Reset scroll tracking (useful for SPA navigation)
 */
export function resetScrollTracking(): void {
  scrollDepthTracked = {
    25: false,
    50: false,
    75: false,
    100: false,
  };
}




