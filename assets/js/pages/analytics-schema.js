/**
 * Analytics Event Schema
 * Minimal map of events with required/optional params for GA4 validation.
 * Exposed on window.ANALYTICS_EVENT_MAP for the GA4 wrapper.
 */
(function (window) {
  const schema = {
    page_view: {
      required: ['page_name', 'page_path'],
      optional: [
        'page_type',
        'referrer',
        'utm_source',
        'utm_medium',
        'utm_campaign',
        'utm_term',
        'utm_content'
      ]
    },
    cta_click: {
      required: ['cta_name'],
      optional: ['page_name', 'location', 'plan_id']
    },
    button_click: {
      required: ['button_id'],
      optional: ['page_name', 'location']
    },
    content_engaged: {
      required: ['page_name'],
      optional: ['scroll_depth_bucket', 'time_on_page_bucket', 'engagement_type']
    },
    start_checkout: {
      required: ['plan_id', 'price', 'currency'],
      optional: ['coupon', 'utm_campaign']
    },
    purchase: {
      required: ['order_id', 'plan_id', 'revenue', 'currency'],
      optional: ['tax', 'coupon', 'utm_campaign']
    }
  };

  window.ANALYTICS_EVENT_MAP = schema;
})(window);
