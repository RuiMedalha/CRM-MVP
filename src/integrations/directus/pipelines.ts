/**
 * Pipelines + Pipeline Stages — CRUD via Directus REST API.
 */

import { directusRequest } from "./client";
import { qs } from "./utils";

export const DIRECTUS_PIPELINES_COLLECTION =
  import.meta.env.VITE_DIRECTUS_PIPELINES_COLLECTION || "pipelines";
export const DIRECTUS_PIPELINE_STAGES_COLLECTION =
  import.meta.env.VITE_DIRECTUS_PIPELINE_STAGES_COLLECTION || "pipeline_stages";

export interface PipelineRow {
  id: string;
  name: string;
  description?: string | null;
  is_default?: boolean;
  order?: number;
  color?: string;
  date_created?: string;
  date_updated?: string;
}

export interface PipelineStageRow {
  id: string;
  pipeline_id: string;
  name: string;
  color?: string;
  order?: number;
  probability?: number;
  tasks_template?: Record<string, unknown> | null;
  sla_hours?: number | null;
  date_created?: string;
  date_updated?: string;
}

// ─── Pipelines ───

export async function listPipelines(): Promise<PipelineRow[]> {
  const res = await directusRequest<{ data: PipelineRow[] }>(
    `/items/${DIRECTUS_PIPELINES_COLLECTION}${qs({
      limit: 100,
      sort: "order",
      fields: "id,name,description,is_default,order,color,date_created,date_updated",
    })}`,
  );
  return res.data || [];
}

export async function getPipeline(id: string): Promise<PipelineRow | null> {
  const res = await directusRequest<{ data: PipelineRow }>(
    `/items/${DIRECTUS_PIPELINES_COLLECTION}/${encodeURIComponent(id)}${qs({ fields: "*" })}`,
  );
  return res.data || null;
}

export async function createPipeline(payload: Partial<PipelineRow>): Promise<PipelineRow> {
  const res = await directusRequest<{ data: PipelineRow }>(
    `/items/${DIRECTUS_PIPELINES_COLLECTION}`,
    { method: "POST", body: JSON.stringify(payload) },
  );
  return res.data;
}

export async function patchPipeline(id: string, patch: Partial<PipelineRow>): Promise<PipelineRow> {
  const res = await directusRequest<{ data: PipelineRow }>(
    `/items/${DIRECTUS_PIPELINES_COLLECTION}/${encodeURIComponent(id)}`,
    { method: "PATCH", body: JSON.stringify(patch) },
  );
  return res.data;
}

export async function deletePipeline(id: string): Promise<void> {
  await directusRequest(
    `/items/${DIRECTUS_PIPELINES_COLLECTION}/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
}

// ─── Pipeline Stages ───

export async function listStages(pipelineId: string): Promise<PipelineStageRow[]> {
  const res = await directusRequest<{ data: PipelineStageRow[] }>(
    `/items/${DIRECTUS_PIPELINE_STAGES_COLLECTION}${qs({
      limit: 100,
      sort: "order",
      fields: "*",
      "filter[pipeline_id][_eq]": pipelineId,
    })}`,
  );
  return res.data || [];
}

export async function createStage(payload: Partial<PipelineStageRow>): Promise<PipelineStageRow> {
  const res = await directusRequest<{ data: PipelineStageRow }>(
    `/items/${DIRECTUS_PIPELINE_STAGES_COLLECTION}`,
    { method: "POST", body: JSON.stringify(payload) },
  );
  return res.data;
}

export async function patchStage(id: string, patch: Partial<PipelineStageRow>): Promise<PipelineStageRow> {
  const res = await directusRequest<{ data: PipelineStageRow }>(
    `/items/${DIRECTUS_PIPELINE_STAGES_COLLECTION}/${encodeURIComponent(id)}`,
    { method: "PATCH", body: JSON.stringify(patch) },
  );
  return res.data;
}

export async function deleteStage(id: string): Promise<void> {
  await directusRequest(
    `/items/${DIRECTUS_PIPELINE_STAGES_COLLECTION}/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
}

export async function reorderStages(stages: { id: string; order: number }[]): Promise<void> {
  for (const s of stages) {
    await patchStage(s.id, { order: s.order });
  }
}
