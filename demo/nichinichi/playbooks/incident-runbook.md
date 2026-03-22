---
title: API incident runbook
tags: [ops, incident, oncall, reliability]
forked_from: debugging-memory-leaks
org: acme
created: 2026-03-07
---

## Overview

Runbook for oncall engineers responding to API incidents at acme.
Written after the March 2026 latency incident. Adapt as needed.

## Severity classification

| Severity | Definition | Response time |
|---|---|---|
| P0 | Production down, all users affected | Immediate |
| P1 | Degraded performance, >10% error rate | Within 15min |
| P2 | Partial outage, <10% users affected | Within 1hr |
| P3 | Minor issue, workaround exists | Next business day |

## Initial response (first 5 minutes)

1. Acknowledge the alert in PagerDuty — stops the escalation timer
2. Open the Grafana latency dashboard
3. Identify the affected service and timeframe
4. Post in #incidents: "Investigating [alert name] — [your name] on it"

## Diagnosis

5. Check recent deploys — was anything shipped in the last hour?
   - `gh run list --limit 10` for recent CI runs
   - Check #deploys Slack channel

6. Check error logs in Datadog for spikes or new error messages

7. Check database: slow queries, connection pool exhaustion, lock waits
   - Run: `SELECT * FROM pg_stat_activity WHERE wait_event IS NOT NULL;`

8. Check for traffic anomalies: DDoS, unexpected spike, bot traffic

## Mitigation

9. If a bad deploy: roll back immediately, ask questions later
   - `gh workflow run rollback.yml`

10. If DB slow query: add an index or kill the query if it's runaway
    - Last resort: enable read replica and redirect reads

11. If rate limit / abuse: block the source IP at the load balancer

## Resolution

12. Confirm metrics are back to baseline in Grafana

13. Post resolution in #incidents with timeline and root cause (preliminary is fine)

14. Create postmortem ticket — due within 48 hours of P0/P1 incidents

15. Update this runbook if anything was missing or wrong
