# GA4 Setup Checklist (Specifys)

## Custom Dimensions (event scope)
Create these in GA4 **Admin → Custom definitions → Custom dimensions** with the matching event parameters:
- `page_type` (event param: `page_type`)
- `plan_id` (event param: `plan_id`)
- `cta_name` (event param: `cta_name`)
- `location` (event param: `location`)
- `scroll_depth_bucket` (event param: `scroll_depth_bucket`)
- `time_on_page_bucket` (event param: `time_on_page_bucket`)

Optional (helpful for funnels and troubleshooting):
- `engagement_type` (event param: `engagement_type`)
- `page_name` (event param: `page_name`)

## Recommended Debug/QA
- Use GA4 DebugView to confirm `page_view`, `cta_click`, and `content_engaged` are arriving with the dimensions above.
- Verify single `page_view` per path (the wrapper dedupes via `page_path`).

## Explorations to Create

### 1) Buy Now Funnel (drop-offs)
1. Exploration → Funnel.
2. Steps:
   - Step 1: `cta_click` filtered where `cta_name = buy_now` (or by `plan_id`).
   - Step 2: `start_checkout` (optionally filter by `plan_id`).
   - Step 3: `purchase`.
3. Breakdowns: `plan_id`, `device`, `country`, `utm_campaign`.
4. Metrics: funnel completion rate, step drop-offs.

### 2) Content Engagement
1. Exploration → Free form.
2. Rows: `page_name` (or `page_path`).
3. Columns: `scroll_depth_bucket`, `time_on_page_bucket`.
4. Values: Event count of `content_engaged`.
5. Filters: `engagement_type` = `scroll` or `time` to isolate.

### 3) CTA Performance
1. Exploration → Free form.
2. Rows: `cta_name`, `location`.
3. Values: Event count of `cta_click`.
4. Breakdown: `plan_id` (where available), `device`, `utm_campaign`.

## Notes
- Wrapper automatically enriches events with `page_name`, `page_path`, `locale`, `device`, `session_id`, `anon_id`, and UTM params.
- CTA/button auto-binding uses `data-analytics-cta`, `data-analytics-button`, and also derives from `data-product-key` when present (pricing buttons). No code changes needed on those buttons.
- Content engagement is emitted via `content_engaged` for scroll buckets (25/50/75/100) and time buckets (15s/30s/60s).
