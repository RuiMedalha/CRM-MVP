/* Checklist + SLA - CRUD */
import { directusRequest } from "./client";
import { qs } from "./utils";
export const TASKS_COL = import.meta.env.VITE_TASKS_COL || "pipeline_stage_tasks";
export const BREACHES_COL = import.meta.env.VITE_BREACHES_COL || "sla_breaches";
export interface StageTaskRow { id: string; deal_id: string; stage_id: string; text: string; done: boolean; due_at?: string; assigned_to_employee_id?: any; order: number; date_created?: string; date_updated?: string; }
export interface SlaBreachRow { id: string; deal_id: string; stage_id: string; pipeline_id?: string; entered_stage_at: string; sla_hours: number; breached_at: string; escalated_to_employee_id?: any; notified: boolean; date_created?: string; date_updated?: string; }
const TASK_F = "id,deal_id,stage_id,text,done,due_at,assigned_to_employee_id.id,assigned_to_employee_id.full_name,order,date_created,date_updated";
const BREACH_F = "id,deal_id,stage_id,pipeline_id,entered_stage_at,sla_hours,breached_at,escalated_to_employee_id.id,escalated_to_employee_id.full_name,notified,date_created";
export async function listStageTasks(d) { const r = await directusRequest("/items/" + TASKS_COL + qs({limit:200,sort:"order",fields:TASK_F,"filter[deal_id][_eq]":d})); return r.data||[]; }
export async function createStageTask(p) { const r = await directusRequest("/items/"+TASKS_COL,{method:"POST",body:JSON.stringify(p)}); return r.data; }
export async function patchStageTask(i,p) { const r = await directusRequest("/items/"+TASKS_COL+"/"+encodeURIComponent(i),{method:"PATCH",body:JSON.stringify(p)}); return r.data; }
export async function deleteStageTask(i) { await directusRequest("/items/"+TASKS_COL+"/"+encodeURIComponent(i),{method:"DELETE"}); }
export async function listActiveSlaBreaches() { const r = await directusRequest("/items/"+BREACHES_COL+qs({limit:50,sort:"-breached_at",fields:BREACH_F,"filter[notified][_eq]":"false"})); return r.data||[]; }
export async function listAllSlaBreaches(l) { const r = await directusRequest("/items/"+BREACHES_COL+qs({limit:l||100,sort:"-breached_at",fields:BREACH_F})); return r.data||[]; }
export async function createSlaBreach(p) { const r = await directusRequest("/items/"+BREACHES_COL,{method:"POST",body:JSON.stringify(p)}); return r.data; }
export async function patchSlaBreach(i,p) { const r = await directusRequest("/items/"+BREACHES_COL+"/"+encodeURIComponent(i),{method:"PATCH",body:JSON.stringify(p)}); return r.data; }
export function getSlaBreachState(d,s) { if(!d.stage_id||!s.length)return null; const st=s.find(x=>x.id===d.stage_id); if(!st?.sla_hours)return null; const e=d.entered_stage_at||d.date_created; if(!e)return null; const el=(Date.now()-new Date(e).getTime())/36e5; return {isBreached:el>=st.sla_hours,hoursLeft:Math.max(0,st.sla_hours-el)}; }
