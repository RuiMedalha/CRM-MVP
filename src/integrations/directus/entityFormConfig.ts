import { directusRequest } from "@/integrations/directus/client";

/**
 * Configuração da Ficha de Cliente (guiada por dados).
 * Lê entity_form_config (matriz visibilidade por tipo) e field_options (dropdowns editáveis).
 * Se as coleções não existirem ou vierem vazias, o consumidor mostra TUDO (fallback seguro).
 */

export type EntityConfigType =
  | "company_client"
  | "person_client"
  | "supplier"
  | "both"
  | "lead";

export interface EntityFormConfigRow {
  id: number;
  block: string;
  field: string;
  entity_type: EntityConfigType;
  visible: boolean;
  required: boolean;
  sort: number;
}

export interface FieldOptionRow {
  id: number;
  field_key: string;
  value: string;
  label: string;
  parent_value: string | null;
  sort: number;
  active: boolean;
}

const CONFIG_COLLECTION = "entity_form_config";
const OPTIONS_COLLECTION = "field_options";

/** Lê a matriz de visibilidade. Nunca lança — em erro devolve []. */
export async function getEntityFormConfig(): Promise<EntityFormConfigRow[]> {
  try {
    const res = await directusRequest<{ data: EntityFormConfigRow[] }>(
      `/items/${CONFIG_COLLECTION}?limit=-1&sort=sort`,
    );
    return res?.data ?? [];
  } catch {
    return [];
  }
}

/** Lê os dropdowns editáveis. Nunca lança — em erro devolve []. */
export async function getFieldOptions(): Promise<FieldOptionRow[]> {
  try {
    const params = new URLSearchParams();
    params.set("limit", "-1");
    params.set("sort[]", "field_key");
    params.append("sort[]", "sort");
    params.set("filter[active][_eq]", "true");
    const res = await directusRequest<{ data: FieldOptionRow[] }>(
      `/items/${OPTIONS_COLLECTION}?${params.toString()}`,
    );
    return res?.data ?? [];
  } catch {
    return [];
  }
}

/**
 * Mapeia entity_type + roles do contacto para o tipo de configuração.
 * empresa+fornecedor => both; empresa/pessoa cliente; fornecedor; lead.
 */
export function resolveConfigType(
  entityType: string | null | undefined,
  roles: string[] | null | undefined,
): EntityConfigType {
  const r = (roles ?? []).map((x) => String(x).toLowerCase());
  const isSupplier = r.includes("fornecedor") || r.includes("supplier");
  const isClient = r.includes("cliente") || r.includes("client");
  const isLead = r.includes("lead");
  const isCompany = (entityType || "empresa").toLowerCase().startsWith("empr") ||
    (entityType || "").toLowerCase() === "company";

  if (isLead && !isClient && !isSupplier) return "lead";
  if (isSupplier && isClient) return "both";
  if (isSupplier) return "supplier";
  return isCompany ? "company_client" : "person_client";
}

/**
 * Constrói o mapa de visibilidade por bloco para um dado tipo.
 * Retorna { [block]: { visible, required } }. Blocos ausentes na config => visível (fallback).
 */
export function buildBlockVisibility(
  config: EntityFormConfigRow[],
  type: EntityConfigType,
): Record<string, { visible: boolean; required: boolean }> {
  const map: Record<string, { visible: boolean; required: boolean }> = {};
  for (const row of config) {
    if (row.entity_type !== type) continue;
    map[normalizeBlock(row.block)] = {
      visible: !!row.visible,
      required: !!row.required,
    };
  }
  return map;
}

/** Normaliza títulos de bloco para casar config ("Dados Gerais") com UI ("Dados Gerais"). */
export function normalizeBlock(block: string): string {
  return block
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

/** Opções de um dropdown, opcionalmente filtradas por parent (dropdowns dependentes). */
export function optionsFor(
  options: FieldOptionRow[],
  fieldKey: string,
  parentValue?: string | null,
): FieldOptionRow[] {
  return options
    .filter((o) => o.field_key === fieldKey)
    .filter((o) => (parentValue == null ? true : o.parent_value === parentValue))
    .sort((a, b) => a.sort - b.sort);
}

// ─── Campo-a-campo (posição + visibilidade dentro de um bloco) ───────────
// Reutiliza a MESMA coleção entity_form_config, mas com `field` = nome real
// do campo (ex: "company_name") em vez de sempre "_block". As linhas de
// bloco (field='_block') e de campo coexistem sem conflito — distinguem-se
// pelo valor de `field`.

/**
 * Mapa de visibilidade/ordem POR CAMPO REAL para um dado bloco+tipo.
 * Devolve { [fieldKey]: { visible, sort } }. Campo ausente na config =>
 * assume-se visível (fallback seguro) com sort = Infinity (vai para o fim,
 * mas nunca desaparece).
 */
export function buildFieldVisibility(
  config: EntityFormConfigRow[],
  block: string,
  type: EntityConfigType,
): Record<string, { visible: boolean; sort: number }> {
  const blockKey = normalizeBlock(block);
  const map: Record<string, { visible: boolean; sort: number }> = {};
  for (const row of config) {
    if (row.entity_type !== type) continue;
    if (row.field === "_block") continue; // linha de bloco, não de campo
    if (normalizeBlock(row.block) !== blockKey) continue;
    map[row.field] = { visible: !!row.visible, sort: row.sort };
  }
  return map;
}

/** Actualiza visible/sort de uma linha de CAMPO (cria se ainda não existir). */
export async function upsertFieldConfig(
  block: string,
  field: string,
  entityType: EntityConfigType,
  patch: { visible?: boolean; sort?: number },
  existingId?: number,
): Promise<void> {
  if (existingId) {
    await directusRequest(`/items/${CONFIG_COLLECTION}/${existingId}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    return;
  }
  await directusRequest(`/items/${CONFIG_COLLECTION}`, {
    method: "POST",
    body: JSON.stringify({
      block,
      field,
      entity_type: entityType,
      visible: patch.visible ?? true,
      required: false,
      sort: patch.sort ?? 0,
    }),
  });
}

/** Actualiza visible/required de uma linha da matriz (bloco × tipo). */
export async function updateFormConfigRow(
  id: number,
  patch: Partial<Pick<EntityFormConfigRow, "visible" | "required" | "sort">>,
): Promise<void> {
  await directusRequest(`/items/${CONFIG_COLLECTION}/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

/** Cria uma nova opção de dropdown (field_options). */
export async function createFieldOption(
  row: Omit<FieldOptionRow, "id">,
): Promise<FieldOptionRow> {
  const res = await directusRequest<{ data: FieldOptionRow }>(`/items/${OPTIONS_COLLECTION}`, {
    method: "POST",
    body: JSON.stringify(row),
  });
  return res.data;
}

/** Actualiza uma opção existente (label, sort, active...). */
export async function updateFieldOption(
  id: number,
  patch: Partial<Omit<FieldOptionRow, "id">>,
): Promise<void> {
  await directusRequest(`/items/${OPTIONS_COLLECTION}/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

/** Apaga uma opção de dropdown. */
export async function deleteFieldOption(id: number): Promise<void> {
  await directusRequest(`/items/${OPTIONS_COLLECTION}/${id}`, { method: "DELETE" });
}

/** Lista os field_key distintos existentes (para o selector de dropdowns no editor). */
export function distinctFieldKeys(options: FieldOptionRow[]): string[] {
  return Array.from(new Set(options.map((o) => o.field_key))).sort();
}

/** Lista os blocos distintos existentes na matriz (para as linhas da tabela do editor). */
export function distinctBlocks(config: EntityFormConfigRow[]): string[] {
  const seen = new Map<string, number>();
  for (const row of config) {
    const key = row.block;
    if (!seen.has(key) || row.sort < (seen.get(key) ?? Infinity)) seen.set(key, row.sort);
  }
  return Array.from(seen.entries()).sort((a, b) => a[1] - b[1]).map(([b]) => b);
}
