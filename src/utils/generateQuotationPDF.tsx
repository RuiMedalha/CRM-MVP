/**
 * PDF Generation — Proposta HotelEquip
 * Usa @react-pdf/renderer para gerar PDF profissional no browser.
 */

// ─── Helpers ──────────────────────────────────────────────────────────────────

const parseSpecs = (v: any): Array<{ label: string; value: string }> => {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  if (typeof v === 'string') {
    try { const p = JSON.parse(v); return Array.isArray(p) ? p : []; }
    catch { return []; }
  }
  return [];
};

const n = (v: any): number => {
  const num = parseFloat(String(v ?? 0));
  return isNaN(num) ? 0 : num;
};

const eur = (v: any): string =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(n(v));

async function imageToBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────

import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
  pdf,
} from "@react-pdf/renderer";
import { calculateProposalTotals } from "@/lib/money/proposalEngine";
import type { Quotation, QuotationItem } from "@/types/quotation";

export interface CompanyData {
  name?: string | null;
  logo_url?: string | null;
  address?: string | null;
  postal_code?: string | null;
  city?: string | null;
  phone?: string | null;
  email?: string | null;
  vat_number?: string | null;
  iban?: string | null;
  payment_instructions?: string | null;
}

export interface PDFCustomerData {
  name?: string;
  company?: string;
  email?: string;
  phone?: string;
  nif?: string;
  address?: string;
}

interface QuotationItemWithImage extends QuotationItem {
  image_base64?: string | null;
}

// ─── Design Tokens ────────────────────────────────────────────────────────────

const TEAL = "#1a6b7c";
const DARK = "#1a1a2e";
const TEXT = "#1a1a1a";
const MUTED = "#4a5568";
const BORDER = "#e2e8f0";
const ROW_ALT = "#f8f6f2";

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  page: {
    padding: 40,
    paddingBottom: 68,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: TEXT,
    backgroundColor: "#ffffff",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 22,
    paddingBottom: 14,
    borderBottomWidth: 2,
    borderBottomColor: TEAL,
  },
  logo: {
    width: 120,
    height: 40,
    objectFit: "contain",
  },
  companyInfoBlock: {
    textAlign: "right",
    maxWidth: 200,
  },
  companyName: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: DARK,
    marginBottom: 2,
  },
  companyDetail: {
    fontSize: 8,
    color: MUTED,
    lineHeight: 1.4,
  },
  proposalTitle: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    color: TEAL,
    marginBottom: 4,
  },
  proposalMeta: {
    fontSize: 9,
    color: MUTED,
    marginBottom: 18,
  },
  section: {
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: TEAL,
    marginBottom: 7,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: TEAL,
  },
  row: {
    flexDirection: "row",
    marginBottom: 3,
  },
  label: {
    width: 90,
    fontSize: 9,
    color: MUTED,
    fontFamily: "Helvetica-Bold",
  },
  value: {
    flex: 1,
    fontSize: 9,
    color: TEXT,
  },
  table: {
    marginTop: 2,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: TEAL,
    paddingVertical: 7,
    paddingHorizontal: 6,
  },
  tableRowEven: {
    flexDirection: "row",
    paddingVertical: 6,
    paddingHorizontal: 6,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  tableRowOdd: {
    flexDirection: "row",
    paddingVertical: 6,
    paddingHorizontal: 6,
    backgroundColor: ROW_ALT,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  colName: { flex: 3, fontSize: 9 },
  colQty: { width: 36, fontSize: 9, textAlign: "center" },
  colPrice: { width: 72, fontSize: 9, textAlign: "right" },
  colDiscount: { width: 46, fontSize: 9, textAlign: "center" },
  colTotal: { width: 72, fontSize: 9, textAlign: "right" },
  colHeaderText: { fontFamily: "Helvetica-Bold", color: "#ffffff", fontSize: 9 },
  totalsBlock: {
    marginTop: 12,
    alignItems: "flex-end",
  },
  totalLine: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 3,
  },
  totalLineLabel: {
    fontSize: 9,
    color: MUTED,
    width: 120,
    textAlign: "right",
    marginRight: 12,
  },
  totalLineValue: {
    fontSize: 9,
    color: TEXT,
    width: 80,
    textAlign: "right",
  },
  grandTotalLine: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 2,
    borderTopColor: TEAL,
  },
  grandTotalLabel: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: TEAL,
    width: 120,
    textAlign: "right",
    marginRight: 12,
  },
  grandTotalValue: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: TEAL,
    width: 80,
    textAlign: "right",
  },
  depositText: {
    fontSize: 9,
    color: MUTED,
    textAlign: "right",
    marginTop: 4,
  },
  compColLabel: { width: 100, fontSize: 9, color: MUTED },
  compColValue: { flex: 1, fontSize: 9, textAlign: "center" },
  recommended: { color: TEAL, fontFamily: "Helvetica-Bold" },
  bodyText: {
    fontSize: 9,
    color: MUTED,
    lineHeight: 1.5,
  },
  terms: {
    fontSize: 8,
    color: MUTED,
    lineHeight: 1.5,
  },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 40,
    right: 40,
    fontSize: 7,
    color: "#999999",
    textAlign: "center",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  productImg: {
    width: 120,
    height: 80,
    objectFit: "contain",
    marginBottom: 4,
  },
});

// ─── PDF Component ────────────────────────────────────────────────────────────

interface QuotationPDFProps {
  quotation: Quotation;
  items: QuotationItemWithImage[];
  company: CompanyData;
  customer?: PDFCustomerData;
  logoBase64: string | null;
}

function QuotationPDFDocument({ quotation, items, company, customer, logoBase64 }: QuotationPDFProps) {
  const mainItems = items.filter((i) => i.item_type !== "additional");
  const additionalItems = items.filter((i) => i.item_type === "additional");

  // Motor financeiro canónico — cálculo único para todos os canais
  const engineItems = items.map((i) => ({
    unit_price: n(i.unit_price),
    quantity: n(i.quantity) || 1,
    discount_percent: n(i.discount_percent),
    iva_percent: (i as any).iva_percent !== undefined && (i as any).iva_percent !== null && Number((i as any).iva_percent) > 0 ? n((i as any).iva_percent) : 23,
  }));
  const totals = calculateProposalTotals({
    items: engineItems,
    discount_percent: n(quotation.discount_percent),
    discount_amount: n(quotation.discount_amount),
    urgency_discount_pct: n((quotation as any).urgency_discount_pct),
    urgency_expires_at: (quotation as any).urgency_expires_at ?? null,
  });
  const subtotal = totals.subtotalSemIva;
  const discountAmount = totals.discountAmount;
  const total = totals.total;

  const logoSrc =
    logoBase64 || company.logo_url || "https://files.hotelequip.pt/public/logo.png";

  const dateCreated = quotation.date_created
    ? new Date(quotation.date_created).toLocaleDateString("pt-PT")
    : new Date().toLocaleDateString("pt-PT");

  // Comparison groups
  const compGroups: Record<string, QuotationItemWithImage[]> = {};
  items.forEach((item) => {
    if (item.comparison_group) {
      if (!compGroups[item.comparison_group]) compGroups[item.comparison_group] = [];
      compGroups[item.comparison_group].push(item);
    }
  });
  const compEntries = Object.entries(compGroups);

  const footerText = [
    company.name || "HotelEquip",
    company.vat_number ? `NIF ${company.vat_number}` : null,
    company.phone,
    company.email,
    company.address,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Fixed footer — repeats on every page */}
        <View style={styles.footer} fixed>
          <Text>{footerText}</Text>
        </View>

        {/* ── Header ── */}
        <View style={styles.header}>
          <Image
            src={logoSrc}
            style={styles.logo}
          />
          <View style={styles.companyInfoBlock}>
            <Text style={styles.companyName}>{company.name || "HotelEquip"}</Text>
            {company.address && (
              <Text style={styles.companyDetail}>{company.address}</Text>
            )}
            {(company.postal_code || company.city) && (
              <Text style={styles.companyDetail}>
                {[company.postal_code, company.city].filter(Boolean).join(" ")}
              </Text>
            )}
            {company.phone && (
              <Text style={styles.companyDetail}>Tel: {company.phone}</Text>
            )}
            {company.email && (
              <Text style={styles.companyDetail}>{company.email}</Text>
            )}
            {company.vat_number && (
              <Text style={styles.companyDetail}>NIF: {company.vat_number}</Text>
            )}
          </View>
        </View>

        {/* ── Proposal Title ── */}
        <Text style={styles.proposalTitle}>
          Proposta {quotation.quotation_number || ""}
        </Text>
        <Text style={styles.proposalMeta}>
          {`Data: ${dateCreated}${
            quotation.valid_until
              ? `  ·  Válida até: ${new Date(quotation.valid_until).toLocaleDateString("pt-PT")}`
              : ""
          }`}
        </Text>

        {/* ── Customer ── */}
        {customer && (customer.name || customer.company) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Cliente</Text>
            {customer.name && (
              <View style={styles.row}>
                <Text style={styles.label}>Nome:</Text>
                <Text style={styles.value}>{customer.name}</Text>
              </View>
            )}
            {customer.company && (
              <View style={styles.row}>
                <Text style={styles.label}>Empresa:</Text>
                <Text style={styles.value}>{customer.company}</Text>
              </View>
            )}
            {customer.email && (
              <View style={styles.row}>
                <Text style={styles.label}>Email:</Text>
                <Text style={styles.value}>{customer.email}</Text>
              </View>
            )}
            {customer.phone && (
              <View style={styles.row}>
                <Text style={styles.label}>Telefone:</Text>
                <Text style={styles.value}>{customer.phone}</Text>
              </View>
            )}
            {customer.nif && (
              <View style={styles.row}>
                <Text style={styles.label}>NIF:</Text>
                <Text style={styles.value}>{customer.nif}</Text>
              </View>
            )}
          </View>
        )}

        {/* ── Description ── */}
        {quotation.proposal_description && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Descrição</Text>
            <Text style={styles.bodyText}>{quotation.proposal_description}</Text>
          </View>
        )}

        {/* ── Products Table ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Produtos / Serviços</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.colName, styles.colHeaderText]}>Descrição</Text>
              <Text style={[styles.colQty, styles.colHeaderText]}>Qtd</Text>
              <Text style={[styles.colPrice, styles.colHeaderText]}>Preço Unit.</Text>
              <Text style={[styles.colDiscount, styles.colHeaderText]}>Desc.</Text>
              <Text style={[styles.colTotal, styles.colHeaderText]}>Total</Text>
            </View>
            {mainItems.map((item, i) => (
              <View
                key={i}
                style={i % 2 === 0 ? styles.tableRowEven : styles.tableRowOdd}
              >
                <View style={styles.colName}>
                  {item.image_base64 && (
                    <Image src={item.image_base64} style={styles.productImg} />
                  )}
                  <Text style={{ fontSize: 9 }}>
                    {item.product_name}
                    {item.sku ? ` (${item.sku})` : ""}
                  </Text>
                </View>
                <Text style={styles.colQty}>{n(item.quantity)}</Text>
                <Text style={styles.colPrice}>{eur(item.unit_price)}</Text>
                <Text style={styles.colDiscount}>
                  {n(item.discount_percent) ? `${n(item.discount_percent)}%` : "—"}
                </Text>
                <Text
                  style={[styles.colTotal, { fontFamily: "Helvetica-Bold" }]}
                >
                  {eur(item.line_total)}
                </Text>
              </View>
            ))}
          </View>

          {/* Additional items */}
          {additionalItems.length > 0 && (
            <>
              <Text style={[styles.sectionTitle, { marginTop: 14 }]}>
                Serviços adicionais
              </Text>
              <View style={styles.table}>
                <View style={styles.tableHeader}>
                  <Text style={[styles.colName, styles.colHeaderText]}>
                    Descrição
                  </Text>
                  <Text style={[styles.colQty, styles.colHeaderText]}>Qtd</Text>
                  <Text style={[styles.colPrice, styles.colHeaderText]}>
                    Preço Unit.
                  </Text>
                  <Text style={[styles.colDiscount, styles.colHeaderText]}>
                    Desc.
                  </Text>
                  <Text style={[styles.colTotal, styles.colHeaderText]}>
                    Total
                  </Text>
                </View>
                {additionalItems.map((item, i) => (
                  <View
                    key={i}
                    style={
                      i % 2 === 0 ? styles.tableRowEven : styles.tableRowOdd
                    }
                  >
                    <View style={styles.colName}>
                      {item.image_base64 && (
                        <Image src={item.image_base64} style={styles.productImg} />
                      )}
                      <Text style={{ fontSize: 9 }}>{item.product_name}</Text>
                    </View>
                    <Text style={styles.colQty}>{n(item.quantity)}</Text>
                    <Text style={styles.colPrice}>{eur(item.unit_price)}</Text>
                    <Text style={styles.colDiscount}>
                      {n(item.discount_percent)
                        ? `${n(item.discount_percent)}%`
                        : "—"}
                    </Text>
                    <Text
                      style={[
                        styles.colTotal,
                        { fontFamily: "Helvetica-Bold" },
                      ]}
                    >
                      {eur(item.line_total)}
                    </Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* Totals */}
          <View style={styles.totalsBlock}>
            {discountAmount > 0 && (
              <>
                <View style={styles.totalLine}>
                  <Text style={styles.totalLineLabel}>Subtotal:</Text>
                  <Text style={styles.totalLineValue}>{eur(subtotal)}</Text>
                </View>
                <View style={styles.totalLine}>
                  <Text style={styles.totalLineLabel}>Desconto:</Text>
                  <Text style={styles.totalLineValue}>
                    -{eur(discountAmount)}
                  </Text>
                </View>
              </>
            )}
            <View style={styles.grandTotalLine}>
              <Text style={styles.grandTotalLabel}>TOTAL:</Text>
              <Text style={styles.grandTotalValue}>{eur(total)}</Text>
            </View>
            {quotation.deposit_type === "partial" &&
              n(quotation.deposit_percent) > 0 && (
                <Text style={styles.depositText}>
                  {`Sinal (${n(quotation.deposit_percent)}%): ${eur(
                    (total * n(quotation.deposit_percent)) / 100
                  )}`}
                </Text>
              )}
          </View>
        </View>

        {/* ── Comparison Table ── */}
        {compEntries.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Comparação de Opções</Text>
            {compEntries.map(([group, groupItems]) => {
              const allLabels: string[] = [];
              groupItems.forEach((gi) => {
                parseSpecs(gi.comparison_specs).forEach((s) => {
                  if (!allLabels.includes(s.label)) allLabels.push(s.label);
                });
              });
              return (
                <View key={group} style={{ marginBottom: 14 }}>
                  {compEntries.length > 1 && (
                    <Text
                      style={{
                        fontSize: 9,
                        fontFamily: "Helvetica-Bold",
                        color: DARK,
                        marginBottom: 4,
                      }}
                    >
                      {group}
                    </Text>
                  )}
                  {/* Header */}
                  <View style={styles.tableHeader}>
                    <Text
                      style={[styles.compColLabel, styles.colHeaderText]}
                    />
                    {groupItems.map((gi, i) => (
                      <Text
                        key={i}
                        style={[styles.compColValue, styles.colHeaderText]}
                      >
                        {gi.product_name}
                        {gi.is_recommended ? " ★" : ""}
                      </Text>
                    ))}
                  </View>
                  {/* Price row */}
                  <View style={styles.tableRowEven}>
                    <Text
                      style={[
                        styles.compColLabel,
                        { fontFamily: "Helvetica-Bold" },
                      ]}
                    >
                      Preço
                    </Text>
                    {groupItems.map((gi, i) => (
                      <Text
                        key={i}
                        style={[
                          styles.compColValue,
                          gi.is_recommended ? styles.recommended : {},
                        ]}
                      >
                        {eur(gi.unit_price)}
                      </Text>
                    ))}
                  </View>
                  {/* Spec rows */}
                  {allLabels.map((label, li) => (
                    <View
                      key={label}
                      style={
                        li % 2 === 0 ? styles.tableRowOdd : styles.tableRowEven
                      }
                    >
                      <Text style={styles.compColLabel}>{label}</Text>
                      {groupItems.map((gi, i) => {
                        const spec = parseSpecs(gi.comparison_specs).find(
                          (s) => s.label === label
                        );
                        return (
                          <Text
                            key={i}
                            style={[
                              styles.compColValue,
                              gi.is_recommended ? styles.recommended : {},
                            ]}
                          >
                            {spec?.value || "—"}
                          </Text>
                        );
                      })}
                    </View>
                  ))}
                </View>
              );
            })}
            {quotation.comparison_recommendation_text && (
              <Text style={[styles.bodyText, { marginTop: 6 }]}>
                {`\u{1F4A1} ${quotation.comparison_recommendation_text}`}
              </Text>
            )}
          </View>
        )}

        {/* ── Payment ── */}
        {company.iban && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Dados para Pagamento</Text>
            <View style={styles.row}>
              <Text style={styles.label}>IBAN:</Text>
              <Text style={styles.value}>{company.iban}</Text>
            </View>
            {company.payment_instructions && (
              <Text style={[styles.bodyText, { marginTop: 4 }]}>
                {company.payment_instructions}
              </Text>
            )}
          </View>
        )}

        {/* ── Terms ── */}
        {quotation.terms_conditions && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Termos e Condições</Text>
            <Text style={styles.terms}>{quotation.terms_conditions}</Text>
          </View>
        )}
      </Page>
    </Document>
  );
}

/**
 * Generate PDF blob from quotation data
 */
export async function generateQuotationPDF(
  quotation: Quotation,
  items: QuotationItem[],
  company: CompanyData,
  customer?: PDFCustomerData
): Promise<Blob> {
  const logoBase64 = await imageToBase64(
    company?.logo_url || "https://files.hotelequip.pt/public/logo.png"
  );

  const itemsWithImages = await Promise.all(
    items.map(async (item) => ({
      ...item,
      image_base64: item.image_url ? await imageToBase64(item.image_url) : null,
    }))
  );

  const doc = (
    <QuotationPDFDocument
      quotation={quotation}
      items={itemsWithImages}
      company={company}
      customer={customer}
      logoBase64={logoBase64}
    />
  );
  return await pdf(doc).toBlob();
}
