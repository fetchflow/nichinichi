---
title: new feature checklist
tags: [process, engineering, checklist]
forked_from: null
org: acme
created: 2026-01-15
---

## Overview

Use this before and during any feature development at acme. Helps avoid the most common
causes of rework, incidents, and slow reviews.

## Pre-development

- [ ] Confirm requirements with PM — write them down, don't rely on memory
- [ ] Check if this touches a shared service or schema — flag to the team
- [ ] Estimate complexity: can this ship in one PR or does it need to be split?
- [ ] Create the ticket and link it to the sprint board

## Design (for anything > 1 day of work)

- [ ] Write a one-page design doc: problem, approach, alternatives considered
- [ ] Share async with at least one senior before starting implementation
- [ ] Document any API contract changes — downstream teams need lead time

## Implementation

- [ ] Feature flag if there's any risk to existing behavior
- [ ] Update or add tests before marking the PR ready
- [ ] Check for N+1 queries — run EXPLAIN ANALYZE on any new SQL
- [ ] Ensure new config/env vars are documented in the repo README or .env.example

## PR checklist

- [ ] PR description explains the "why", not just the "what"
- [ ] Linked to the ticket
- [ ] Changelog entry if this affects external API consumers
- [ ] Schema migration is backwards-compatible (add, don't remove columns)
- [ ] At least one reviewer who knows the domain

## Post-ship

- [ ] Verify metrics in Grafana — latency, error rate, query counts
- [ ] Monitor first 24h if the feature is high-traffic
- [ ] Close the ticket and update any related documentation
