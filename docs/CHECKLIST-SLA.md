# CHECKLIST + SLA - Card 12

## Schema

pipeline_stages: sla_hours, escalate_to_employee_id
pipeline_stage_tasks: deal_id, stage_id, text, done, due_at, assigned_to_employee_id, order
sla_breaches: deal_id, stage_id, pipeline_id, entered_stage_at, sla_hours, breached_at, notified

## Files
- Migration: directus/migrations/20260903_checklist_sla.sql
- Hook: directus/extensions/hooks/slaMonitor/index.js
- Integration: src/integrations/directus/checklistSla.ts
- Hooks: src/hooks/useChecklistSla.ts
- StageChecklist: src/components/pipeline/StageChecklist.tsx
- DealDetail: src/components/deals/DealDetail.tsx
- Pipeline badges: src/pages/Pipeline.tsx
- Dashboard widget: src/pages/Dashboard.tsx
