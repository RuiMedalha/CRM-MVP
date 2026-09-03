/**
 * PDF Generation via HTML template + jsPDF + html2canvas.
 * Loads public/proposal-pdf-template.html, replaces placeholders,
 * renders in hidden iframe, captures with html2canvas, saves as PDF.
 */

import jsPDF from "jspdf";
import html2canvas from "html2canvas";

/** Convert an external image URL to base64 data URI (handles CORS). */
async function imageToBase64(url: string): Promise<string> {
  if (!url) return "";
  try {
    const r = await fetch(url, { mode: "cors" });
    if (!r.ok) return "";
    const blob = await r.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve("");
      reader.readAsDataURL(blob);
    });
  } catch {
    return "";
  }
}

function parseSpecs(specs: any): Array<{ label: string; value: string }> {
  if (!specs) return [];
  try {
    const p = typeof specs === "string" ? JSON.parse(specs) : specs;
    if (Array.isArray(p)) return p.map((s: any) => ({ label: s.label || s.key || "", value: String(s.value || "") }));
    if (typeof p === "object") return Object.entries(p).map(([k, v]) => ({ label: k, value: String(v) }));
  } catch { /* ignore */ }
  return [];
}

function eur(v: any): string {
  const num = parseFloat(String(v || 0));
  return isNaN(num) ? "0,00 €" : num.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

interface CompanyData {
  name?: string | null;
  logo_url?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  vat_number?: string | null;
  iban?: string | null;
  multibanco_entity?: string | null;
  multibanco_reference?: string | null;
}

async function buildHtml(html: string, quotation: any, company: CompanyData): Promise<string> {
  const today = new Date().toLocaleDateString("pt-PT", { day: "numeric", month: "long", year: "numeric" });
  const validUntil = quotation.valid_until
    ? new Date(quotation.valid_until).toLocaleDateString("pt-PT", { day: "numeric", month: "long", year: "numeric" })
    : "—";

  const subtotal = parseFloat(String(quotation.subtotal || quotation.total_amount || 0));
  const total = parseFloat(String(quotation.total_amount || 0));
  const ivaAmt = total - subtotal;
  const ivaPct = subtotal > 0 ? Math.round((ivaAmt / subtotal) * 100) : 23;
  const depositPct = parseFloat(String(quotation.deposit_percent || 0));
  const depositAmt = depositPct > 0 ? (total * depositPct) / 100 : 0;
  const remaining = total - depositAmt;

  // Convert company logo to base64 for PDF rendering
  const logoUrl = (company as any).logo_url || "";
  const logoBase64 = logoUrl ? await imageToBase64(logoUrl) : "";

  // Replace the hardcoded hex logo with actual company logo image (if available)
  if (logoBase64) {
    html = html.replace(
      /<div class="hex">[\s\S]*?<\/div>\s*<\/div>/,
      `<img src="${logoBase64}" alt="Logo" style="height:48px;width:auto;object-fit:contain;" />`
    );
  }

  const replacements: Record<string, string> = {
    "{{COMPANY_NAME}}": company.name || "HotelEquip",
    "{{COMPANY_ADDRESS}}": company.address || "Rua Empresarial n8 A, 2510-752 Gaeiras",
    "{{COMPANY_PHONE}}": company.phone || "916542271",
    "{{COMPANY_EMAIL}}": company.email || "geral@hotelequip.pt",
    "{{COMPANY_NIF}}": company.vat_number || "PT515208566",
    "{{COMPANY_IBAN}}": company.iban || "PT50 0036 0548 99106007139 73",
    "{{COMPANY_BANK_HOLDER}}": company.name || "HotelEquip Unipessoal Lda",
    "{{MULTIBANCO_ENTITY}}": company.multibanco_entity || "—",
    "{{MULTIBANCO_REF}}": company.multibanco_reference || "—",
    "{{CLIENT_NAME}}": quotation.customer_name || "Cliente",
    "{{CLIENT_COMPANY}}": quotation.customer_company || quotation.customer_name || "Cliente",
    "{{QUOTATION_NUMBER}}": quotation.quotation_number || "",
    "{{QUOTATION_TOKEN}}": quotation.public_token || "",
    "{{DATE}}": today,
    "{{VALID_UNTIL}}": validUntil,
    "{{SUBTOTAL}}": eur(subtotal),
    "{{TOTAL}}": eur(total),
    "{{IVA_PCT}}": `${ivaPct}%`,
    "{{IVA_AMOUNT}}": eur(ivaAmt),
    "{{DEPOSIT_PCT}}": `${depositPct}%`,
    "{{DEPOSIT_AMOUNT}}": eur(depositAmt),
    "{{REMAINING_AMOUNT}}": eur(remaining),
  };

  for (const [key, value] of Object.entries(replacements)) {
    html = html.replaceAll(key, value || "—");
  }

  // Product loop — convert images to base64 to avoid CORS issues with html2canvas
  const items = quotation.items || [];
  const imageCache = new Map<string, string>();
  for (const item of items) {
    if (item.image_url && !imageCache.has(item.image_url)) {
      imageCache.set(item.image_url, await imageToBase64(item.image_url));
    }
  }

  html = html.replace(/<!-- PRODUCT_START -->([\s\S]*?)<!-- PRODUCT_END -->/g, (_match: string, template: string) => {
    return items.map((item: any) => {
      const specs = parseSpecs(item.comparison_specs);
      let itemHtml = template;

      itemHtml = itemHtml.replace(/<!-- SPEC_START -->([\s\S]*?)<!-- SPEC_END -->/g, (_m: string, specTpl: string) => {
        if (specs.length === 0) return "";
        return specs.map((s) =>
          specTpl.replaceAll("{{SPEC_LABEL}}", s.label).replaceAll("{{SPEC_VALUE}}", s.value)
        ).join("");
      });

      const unitPrice = parseFloat(String(item.unit_price || 0));
      const lineTotal = parseFloat(String(item.line_total || 0));
      const discountPct = parseFloat(String(item.discount_percent || 0));
      const imgSrc = imageCache.get(item.image_url) || item.image_url || "";

      return itemHtml
        .replaceAll("{{PRODUCT_NAME}}", item.product_name || "")
        .replaceAll("{{PRODUCT_SKU}}", item.sku || "")
        .replaceAll("{{PRODUCT_DESC}}", item.ai_description || item.notes || "")
        .replaceAll("{{PRODUCT_IMAGE}}", imgSrc)
        .replaceAll("{{PRODUCT_DATASHEET_URL}}", item.datasheet_url || "#")
        .replaceAll("{{PRODUCT_URL}}", item.product_url || "#")
        .replaceAll("{{PRODUCT_PRICE}}", eur(unitPrice))
        .replaceAll("{{PRODUCT_QTY}}", String(item.quantity || 1))
        .replaceAll("{{PRODUCT_UNIT_PRICE}}", eur(unitPrice))
        .replaceAll("{{PRODUCT_DISCOUNT}}", discountPct > 0 ? `-${discountPct}%` : "—")
        .replaceAll("{{PRODUCT_TOTAL}}", eur(lineTotal));
    }).join("\n");
  });

  // Deposit section
  if (quotation.deposit_type !== "partial" || depositPct === 0) {
    html = html.replace(/<!-- DEPOSIT_START -->[\s\S]*?<!-- DEPOSIT_END -->/g, "");
  } else {
    html = html.replaceAll("<!-- DEPOSIT_START -->", "").replaceAll("<!-- DEPOSIT_END -->", "");
  }

  // QR codes
  const proposalUrl = `https://proposta.hotelequip.pt/p/${quotation.public_token || ""}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(proposalUrl)}`;
  html = html.replaceAll("{{QR_APPROVAL_URL}}", qrUrl);
  html = html.replaceAll("{{PROPOSAL_URL}}", proposalUrl);

  return html;
}

export async function generateProposalPDF(
  quotation: any,
  company: CompanyData
): Promise<void> {
  // 1. Load template
  const res = await fetch("/proposal-pdf-template.html");
  if (!res.ok) {
    throw new Error("Template PDF não encontrado. Contacte o administrador.");
  }
  let html = await res.text();

  // Fetch items if not present in quotation object
  if ((!quotation.items || quotation.items.length === 0) && quotation.id) {
    try {
      const directusUrl = (import.meta.env.VITE_DIRECTUS_URL || "https://api.hotelequip.pt").replace(/\/$/, "");
      const itemsRes = await fetch(
        `${directusUrl}/items/quotation_items?filter[quotation_id][_eq]=${quotation.id}&limit=100&sort=sort_order`
      );
      if (itemsRes.ok) {
        const itemsJson = await itemsRes.json();
        quotation = { ...quotation, items: itemsJson.data || [] };
      }
    } catch { /* continue without items */ }
  }

  // Debug: log placeholder data
  console.log('[PDF] placeholders:', {
    CLIENT_NAME: quotation.customer_name,
    TOTAL: quotation.total_amount,
    ITEMS_COUNT: (quotation.items || []).length,
    COMPANY_NAME: company.name,
  });

  // 2. Replace placeholders (async — converts images to base64)
  html = await buildHtml(html, quotation, company);

  // 3. Create hidden iframe for rendering
  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:794px;height:1123px;border:none;visibility:hidden;";
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!iframeDoc) {
    document.body.removeChild(iframe);
    throw new Error("Não foi possível criar iframe para PDF");
  }

  iframeDoc.open();
  iframeDoc.write(html);
  iframeDoc.close();

  // 4. Wait for render (fonts + images)
  await new Promise((r) => setTimeout(r, 2500));

  // 5. Capture pages with html2canvas
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pages = iframeDoc.querySelectorAll(".page");

  // If no .page elements, capture the entire body
  const targets = pages.length > 0 ? Array.from(pages) : [iframeDoc.body];

  for (let i = 0; i < targets.length; i++) {
    const canvas = await html2canvas(targets[i] as HTMLElement, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
      width: 794,
      windowWidth: 794,
    });
    if (i > 0) pdf.addPage();
    pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, 210, 297);
  }

  // 6. Download
  const filename = `Proposta-${quotation.quotation_number || quotation.id || "HotelEquip"}.pdf`;
  pdf.save(filename);

  // Cleanup
  document.body.removeChild(iframe);
}
