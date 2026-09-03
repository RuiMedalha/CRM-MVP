/**
 * Lead Capture - embedSnippets
 * Gera os snippets de embed (HTML inline + iframe) para colar no WordPress, Wix, etc.
 */
import type { LeadCaptureForm } from "./renderForm";
import { renderFormHtml } from "./renderForm";

export interface EmbedOptions {
  origin?: string;
  iframeWidth?: number;
  iframeHeight?: number;
  theme?: "light" | "dark" | "auto";
}

export function buildEmbedSnippets(form: LeadCaptureForm, opts: EmbedOptions = {}) {
  const origin = opts.origin ?? (typeof window !== "undefined" ? window.location.origin : "");
  const publicUrl = `${origin}/c/${encodeURIComponent(form.slug)}`;
  const actionUrl = `${origin}/api/public/lead-capture/${encodeURIComponent(form.slug)}`;
  const htmlSnippet = renderFormHtml(form, { actionUrl, theme: opts.theme ?? "auto", branding: form.name });
  const iframeWidth = opts.iframeWidth ?? 480;
  const iframeHeight = opts.iframeHeight ?? 640;
  const iframeSnippet = `<!-- ${form.name} (Web-to-Lead) -->
<iframe
  src="${publicUrl}"
  width="100%"
  height="${iframeHeight}"
  style="max-width:${iframeWidth}px;width:100%;border:0;border-radius:12px;overflow:hidden"
  loading="lazy"
  title="${form.name}"
></iframe>`;
  return { publicUrl, actionUrl, html: htmlSnippet, iframe: iframeSnippet };
}
