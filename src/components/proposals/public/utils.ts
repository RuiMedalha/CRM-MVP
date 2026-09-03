/** Coerce Directus string/null values to number safely */
export const n = (v: any): number => {
  const num = parseFloat(String(v ?? 0));
  return isNaN(num) ? 0 : num;
};

/** Format number as EUR currency string (pt-PT locale) */
export const eur = (v: any): string =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(n(v));

/** Format price with IVA included */
export const eurWithIva = (price: any, ivaPct: any): string => {
  const p = n(price);
  const iva = n(ivaPct);
  return eur(iva > 0 ? p * (1 + iva / 100) : p);
};

/** Strip HTML tags from a string */
export const stripHtml = (html: string): string => {
  if (!html) return "";
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.textContent || div.innerText || "";
};
