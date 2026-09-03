import { useEffect, useState } from "react";
import {
  getEntityFormConfig,
  getFieldOptions,
  buildBlockVisibility,
  buildFieldVisibility,
  resolveConfigType,
  optionsFor,
  type EntityFormConfigRow,
  type FieldOptionRow,
  type EntityConfigType,
} from "@/integrations/directus/entityFormConfig";

interface UseEntityFormConfigResult {
  loading: boolean;
  /** true => existe config carregada; false => fallback (mostrar tudo) */
  hasConfig: boolean;
  configType: EntityConfigType;
  /** É este bloco visível para o tipo actual? Sem config => sempre true. */
  isBlockVisible: (blockTitle: string) => boolean;
  isBlockRequired: (blockTitle: string) => boolean;
  /** Opções de um dropdown (com filtro opcional por parent). */
  options: (fieldKey: string, parentValue?: string | null) => FieldOptionRow[];
  /**
   * Dado um bloco e a lista natural de field keys (ordem por defeito no
   * código), devolve só as visíveis, na ordem configurada. Campos sem
   * configuração ficam visíveis, na posição original (fallback seguro —
   * nunca desaparecem por omissão).
   */
  orderedFields: (block: string, naturalKeys: string[]) => string[];
  raw: { config: EntityFormConfigRow[]; fieldOptions: FieldOptionRow[] };
}

/**
 * Carrega a configuração da Ficha de Cliente e expõe helpers de visibilidade/opções.
 * FALLBACK SEGURO: se a config estiver vazia (coleções novas, erro, ou ainda sem seed),
 * hasConfig=false e isBlockVisible devolve sempre true — a ficha comporta-se como antes.
 */
export function useEntityFormConfig(
  entityType: string | null | undefined,
  roles: string[] | null | undefined,
): UseEntityFormConfigResult {
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<EntityFormConfigRow[]>([]);
  const [fieldOptions, setFieldOptions] = useState<FieldOptionRow[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [c, o] = await Promise.all([getEntityFormConfig(), getFieldOptions()]);
      if (!alive) return;
      setConfig(c);
      setFieldOptions(o);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const configType = resolveConfigType(entityType, roles);
  const hasConfig = config.length > 0;
  const visibility = buildBlockVisibility(config, configType);

  const isBlockVisible = (blockTitle: string): boolean => {
    if (!hasConfig) return true; // fallback: mostra tudo
    const key = blockTitle
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase();
    const entry = visibility[key];
    // bloco não configurado => visível (não esconder por omissão)
    return entry ? entry.visible : true;
  };

  const isBlockRequired = (blockTitle: string): boolean => {
    if (!hasConfig) return false;
    const key = blockTitle
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase();
    return visibility[key]?.required ?? false;
  };

  const options = (fieldKey: string, parentValue?: string | null) =>
    optionsFor(fieldOptions, fieldKey, parentValue);

  const orderedFields = (block: string, naturalKeys: string[]): string[] => {
    if (!hasConfig) return naturalKeys; // fallback: ordem/visibilidade original
    const fieldVis = buildFieldVisibility(config, block, configType);
    return naturalKeys
      .map((key, naturalIndex) => ({
        key,
        // sem entrada configurada => visível, na posição natural (não invisível por omissão)
        visible: fieldVis[key]?.visible ?? true,
        sort: fieldVis[key]?.sort ?? 1000 + naturalIndex,
      }))
      .filter((f) => f.visible)
      .sort((a, b) => a.sort - b.sort)
      .map((f) => f.key);
  };

  return {
    loading,
    hasConfig,
    configType,
    isBlockVisible,
    isBlockRequired,
    options,
    orderedFields,
    raw: { config, fieldOptions },
  };
}
