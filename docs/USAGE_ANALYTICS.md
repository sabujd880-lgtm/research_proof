# ResearchProof AI — Usage Analytics Engine

## 1. Overview
The Usage Analytics Engine tracks platform utilization, error rates, and operational health while strictly enforcing academic research privacy.

## 2. Privacy-Preserving Event Architecture
- **Data Minimization**: Analytics records capture only operational telemetry (feature name, event type, latency, success flag, and error category).
- **Zero Manuscript Retention**: Full user prompts, academic manuscripts, citation text, tokens, session cookies, and API keys are strictly excluded from all analytics events.
- **Bounded Retention**: Discrete `UsageEvent` documents are indexed with a 90-day MongoDB TTL index (`expireAfterSeconds: 7776000`), ensuring storage consumption remains bounded on MongoDB Atlas.
- **Pre-Aggregated Daily Rollups**: The `DailyUsageAggregate` collection maintains rolling daily totals (`date`, `feature`, `requestCount`, `successCount`, `failureCount`) enabling instant dashboard queries without performing full collection scans.

## 3. Metric Definitions
1. **Daily Active Users (DAU)**: Unique authenticated user accounts that performed an action within the last 24 hours (`lastActiveAt >= now - 24h`).
2. **Weekly Active Users (WAU)**: Unique accounts active within the trailing 7 days.
3. **Monthly Active Users (MAU)**: Unique accounts active within the trailing 30 days.
4. **Successful Request**: An API operation completed with HTTP status `< 400`.
5. **Failed Request**: An API operation resulting in an application error, rate-limit rejection, or provider failure (HTTP status `>= 400`).
6. **Error Rate**: Percentage of requests resulting in failures over total requests.

## 4. Admin Analytics API
- `GET /api/admin/analytics/overview`: High-level traffic, user counts, and success rates.
- `GET /api/admin/analytics/features`: Breakdown of requests across `rewrite`, `analysis`, `citations`, `docx`, and `integrity`.
- `GET /api/admin/analytics/errors`: Recent system failure diagnostics.
- `GET /api/admin/analytics/providers`: Distribution of LLM provider calls and error frequencies.
