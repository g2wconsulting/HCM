-- Migration 005: Optional project budgets, for the budget-progress-bar
-- view on the Projects page. Safe to re-run.

alter table projects add column if not exists budget numeric;
