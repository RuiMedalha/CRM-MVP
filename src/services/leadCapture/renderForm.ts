/**
 * Lead Capture - renderForm
 *
 * Converte um LeadCaptureForm (schema Directus lead_capture_forms) num
 * HTML de form standalone, mobile-first (375px), estilo shadcn limpo,
 * submissoes via POST /api/public/lead-capture/:slug.
 */

export type LeadFieldType = "text" | "email" | "tel" | "textarea" | "select" | "number" | "url";

export interface LeadField {
  name: string;
  label: string;
  type: LeadFieldType;
  required?: boolean;
  placeholder?: string;
  options?: string[];
}

export interface LeadCaptureForm {
  id: string;
  name: string;
  slug: string;
  source_label: string;
  success_message: string;
  redirect_url?: string | null;
  fields: LeadField[];
  is_active?: boolean;
}

export interface RenderOptions {
  actionUrl?: string;
  theme?: "light" | "dark" | "auto";
  branding?: string;
  className?: string;
}

const SHADCN_LIGHT = `
:root { --lc-bg:#ffffff; --lc-fg:#0f172a; --lc-muted:#64748b; --lc-border:#e2e8f0; --lc-input:#f8fafc; --lc-primary:#0f172a; --lc-primary-fg:#ffffff; --lc-radius:8px; --lc-error:#dc2626; }
`;
const SHADCN_DARK = `
:root { --lc-bg:#0b1220; --lc-fg:#e2e8f0; --lc-muted:#94a3b8; --lc-border:#1e293b; --lc-input:#111a2c; --lc-primary:#e2e8f0; --lc-primary-fg:#0b1220; --lc-radius:8px; --lc-error:#f87171; }
`;

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function renderField(f: LeadField): string {
  const name = escapeHtml(f.name);
  const label = escapeHtml(f.label || f.name);
  const placeholder = escapeHtml(f.placeholder ?? "");
  const required = f.required ? "required" : "";
  const ariaRequired = f.required ? "aria-required=\"true\"" : "";
  const baseLabelStyle = "display:block;font-size:0.875rem;font-weight:500;margin-bottom:0.375rem;color:var(--lc-fg);";
  const baseInputStyle = "width:100%;box-sizing:border-box;padding:0.5rem 0.75rem;font-size:1rem;line-height:1.5;color:var(--lc-fg);background:var(--lc-input);border:1px solid var(--lc-border);border-radius:var(--lc-radius);outline:none;transition:border-color 120ms;";
  const wrapStyle = "margin-bottom:0.875rem;";
  let input = "";
  switch (f.type) {
    case "textarea":
      input = `<textarea name="${name}" placeholder="${placeholder}" ${required} ${ariaRequired} rows="4" style="${baseInputStyle}resize:vertical;min-height:88px;"></textarea>`;
      break;
    case "select": {
      const opts = (f.options ?? []).map((o) => `<option value="${escapeHtml(o)}">${escapeHtml(o)}</option>`).join("");
      input = `<select name="${name}" ${required} ${ariaRequired} style="${baseInputStyle}appearance:none;background-image:linear-gradient(45deg,transparent 50%,var(--lc-muted) 50%),linear-gradient(135deg,var(--lc-muted) 50%,transparent 50%);background-position:calc(100% - 16px) 50%,calc(100% - 10px) 50%;background-size:6px 6px;background-repeat:no-repeat;padding-right:2rem;"><option value="">-</option>${opts}</select>`;
      break;
    }
    case "number":
      input = `<input type="number" name="${name}" placeholder="${placeholder}" ${required} ${ariaRequired} style="${baseInputStyle}" />`;
      break;
    case "email":
      input = `<input type="email" name="${name}" placeholder="${placeholder}" ${required} ${ariaRequired} autocomplete="email" style="${baseInputStyle}" />`;
      break;
    case "tel":
      input = `<input type="tel" name="${name}" placeholder="${placeholder}" ${required} ${ariaRequired} autocomplete="tel" style="${baseInputStyle}" />`;
      break;
    case "url":
      input = `<input type="url" name="${name}" placeholder="${placeholder}" ${required} ${ariaRequired} style="${baseInputStyle}" />`;
      break;
    default:
      input = `<input type="text" name="${name}" placeholder="${placeholder}" ${required} ${ariaRequired} style="${baseInputStyle}" />`;
  }
  return `<div class="lc-field" style="${wrapStyle}">
    <label for="lc-${name}" style="${baseLabelStyle}">${label}${f.required ? ` <span aria-hidden="true" style="color:var(--lc-error)">*</span>` : ""}</label>
    ${input}
  </div>`;
}

export function renderFormHtml(form: LeadCaptureForm, opts: RenderOptions = {}): string {
  const action = opts.actionUrl ?? `/api/public/lead-capture/${encodeURIComponent(form.slug)}`;
  const theme = opts.theme ?? "auto";
  const branding = opts.branding ?? "Web-to-Lead";
  const themeCss = theme === "dark" ? SHADCN_DARK : SHADCN_LIGHT;
  const autoCss = theme === "auto" ? `@media (prefers-color-scheme: dark){${SHADCN_DARK}}` : "";
  const fieldsHtml = (form.fields ?? []).map(renderField).join("\n");
  return `<style>
${themeCss}
${autoCss}
.lc-root { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 1rem; background: var(--lc-bg); color: var(--lc-fg); border-radius: calc(var(--lc-radius) * 1.5); }
.lc-root * { box-sizing: border-box; }
.lc-title { font-size: 1.125rem; font-weight: 600; margin: 0 0 0.25rem; }
.lc-subtitle { font-size: 0.875rem; color: var(--lc-muted); margin: 0 0 1rem; }
.lc-field input:focus, .lc-field textarea:focus, .lc-field select:focus { border-color: var(--lc-primary); }
.lc-submit { display:inline-flex;align-items:center;justify-content:center;width:100%;padding:0.625rem 1rem;font-weight:600;font-size:1rem;color:var(--lc-primary-fg);background:var(--lc-primary);border:1px solid var(--lc-primary);border-radius:var(--lc-radius);cursor:pointer;transition:opacity 120ms; }
.lc-submit:hover { opacity: 0.9; }
.lc-submit:disabled { opacity: 0.5; cursor: not-allowed; }
.lc-error { color: var(--lc-error); font-size: 0.875rem; margin-top: 0.5rem; min-height: 1.25rem; }
.lc-branding { display:block;margin-top:1rem;text-align:center;font-size:0.75rem;color:var(--lc-muted); }
@media (max-width: 375px) { .lc-root { padding: 0.75rem; border-radius: var(--lc-radius); } }
</style>
<form class="lc-root ${escapeHtml(opts.className ?? "")}" method="POST" action="${escapeHtml(action)}" data-lc-slug="${escapeHtml(form.slug)}" novalidate>
  <h2 class="lc-title">${escapeHtml(form.name)}</h2>
  <p class="lc-subtitle">${escapeHtml(form.source_label)}</p>
  ${fieldsHtml}
  <button type="submit" class="lc-submit">Enviar</button>
  <div class="lc-error" role="alert" aria-live="polite"></div>
  <small class="lc-branding">Powered by ${escapeHtml(branding)}</small>
</form>
<script>
(function(){
  var slug = ${JSON.stringify(form.slug)};
  var form = document.querySelector("form.lc-root[data-lc-slug='" + slug + "']");
  if (!form) return;
  var errEl = form.querySelector(".lc-error");
  form.addEventListener("submit", async function(ev){
    ev.preventDefault();
    errEl.textContent = "";
    var btn = form.querySelector(".lc-submit");
    btn.disabled = true;
    btn.textContent = "A enviar...";
    var data = {};
    try { new FormData(form).forEach(function(v,k){ data[k]=v; }); } catch(e) {}
    try {
      var res = await fetch(form.action, { method: "POST", headers: { "Content-Type": "application/json", "Accept": "application/json" }, body: JSON.stringify(data) });
      var json = await res.json().catch(function(){ return {}; });
      if (!res.ok || json.ok === false) {
        errEl.textContent = (json && json.error) || "Ocorreu um erro. Tenta novamente.";
        btn.disabled = false; btn.textContent = "Enviar";
        return;
      }
      if (json.redirect_url) { window.location.href = json.redirect_url; return; }
      form.innerHTML = "<div style=\"padding:1.25rem;text-align:center\"><h2 style=\"margin:0 0 .5rem;font-size:1.125rem\">"+(json.success_message||"Obrigado!")+"</h2><p style=\"margin:0;color:var(--lc-muted);font-size:.875rem\">Entraremos em contacto em breve.</p></div>";
    } catch(e) {
      errEl.textContent = "Sem ligacao. Tenta novamente.";
      btn.disabled = false; btn.textContent = "Enviar";
    }
  });
})();
</script>`;
}
