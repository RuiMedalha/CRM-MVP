/**
 * emailContactExtraction — Extrator híbrido inteligente (Heurística Regex + IA)
 * Analisa o corpo, assinatura e rodapé de emails para extrair dados fiscais e de contacto.
 */

export interface ExtractedContactResult {
  name?: string | null;
  company_name?: string | null;
  razao_social?: string | null;
  nif?: string | null;
  phone?: string | null;
  mobile_phone?: string | null;
  address?: string | null;
  city?: string | null;
  postal_code?: string | null;
  website?: string | null;
  iban?: string | null;
  request_type?: string | null;
  requested_items?: string | null;
  contact_role?: string | null;
  job_title?: string | null;
  fullBodyText?: string;
}

/**
 * Extrai dados estruturados usando heurística de texto e padrões portugueses
 * Funciona em 0ms mesmo sem ligação à IA.
 */
export function extractContactHeuristics(fullText: string, fromAddress: string, subject: string): ExtractedContactResult {
  const result: ExtractedContactResult = {
    fullBodyText: fullText,
  };

  if (!fullText) return result;

  // 1. Deteção de Telefones em Portugal: 9xx = Telemóvel (mobile_phone), 2xx/3xx = Fixo (phone)
  const allPhones = fullText.match(/(?:(?:\+|00)351[\s.-]*)?(?:9[1236]\d|2\d{2}|30\d)[\s.-]*\d{3}[\s.-]*\d{3}/g);
  if (allPhones) {
    for (const rawP of allPhones) {
      const p = rawP.trim();
      const cleanDigits = p.replace(/\D/g, "").replace(/^351/, "");
      if (cleanDigits.startsWith("9") && !result.mobile_phone) {
        result.mobile_phone = p;
      } else if ((cleanDigits.startsWith("2") || cleanDigits.startsWith("3")) && !result.phone) {
        result.phone = p;
      } else if (!result.phone) {
        result.phone = p;
      }
    }
  }

  // 2. NIF / NIPC / VAT (9 dígitos com ou sem PT)
  const nifMatch = fullText.match(/\b(?:NIF|NIPC|VAT|Contribuinte)[:\s]*(?:PT)?([12356789]\d{8})\b/i);
  if (nifMatch) {
    result.nif = nifMatch[1];
  }

  // 3. Código Postal e Cidade (ex: 1000-017 Lisboa, 4850‑527 Vieira do Minho — suporta hífens Unicode)
  const postalMatch = fullText.match(/\b(\d{4}[-‑]\d{3})\s+([A-Za-zÀ-ÿ\s]+?)(?:[\s,·•\-]*(?:Portugal|PT|\n|\r|$))/i);
  if (postalMatch) {
    result.postal_code = postalMatch[1].replace('‑', '-').trim();
    const rawCity = postalMatch[2].trim().replace(/[\s,·•\-]+$/, "");
    if (rawCity && rawCity.length < 35) {
      result.city = rawCity;
    }
  }

  // 4. Morada (linhas com Avenida, Praça, Rua, Largo, etc.)
  const addressMatch = fullText.match(/\b(?:Avenida|Av\.?|Praça|Praca|Pc\.?|Largo|Lg\.?|Rua|R\.?|Praceta|Alameda|Travessa|Tv\.?|Estrada|Edifício|Lote|Lt\.?|Zona Industrial)\s+[A-Za-zÀ-ÿ0-9\s,–\-\.\/ºª]+?(?=\n|\r|$)/i);
  if (addressMatch) {
    result.address = addressMatch[0].trim().replace(/[•·]+$/, "").trim();
  }

  // 5. Nome e Cargo na Assinatura (linhas a seguir a cumprimentos ou traços de assinatura '--')
  const lines = fullText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  let signIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].match(/^--+$|^__+$|(?:melhores cumprimentos|com os melhores cumprimentos|atenciosamente|cordialmente|cumprimentos|saudações)/i)) {
      signIndex = i;
      break;
    }
  }

  if (signIndex !== -1 && signIndex + 1 < lines.length) {
    const line1 = lines[signIndex + 1];
    if (line1 && line1.length > 2 && !line1.match(/\d|tel|@|http|www/i)) {
      result.name = line1.replace(/[,;:]$/, "").trim();
    }
    if (signIndex + 2 < lines.length) {
      const line2 = lines[signIndex + 2];
      if (line2 && line2.length > 2 && !line2.match(/\d|tel|@|http|www/i) && line2.length < 40) {
        result.job_title = line2.trim();
      }
    }
  }

  // 6. Empresa / Grupo
  const companyMatch = fullText.match(/(?:PART OF|GRUPO|GROUP|EMPRESA)\s+([A-ZÀ-ÿ0-9\s]{3,40})/i);
  if (companyMatch) {
    result.company_name = companyMatch[1].trim();
  } else {
    const domain = fromAddress.split("@")[1]?.toLowerCase();
    const genericDomains = ["gmail.com", "hotmail.com", "outlook.com", "yahoo.com", "sapo.pt", "live.com", "icloud.com"];
    if (domain && !genericDomains.includes(domain)) {
      const domainBase = domain.split(".")[0];
      if (domainBase && domainBase.length > 2) {
        result.company_name = domainBase.charAt(0).toUpperCase() + domainBase.slice(1);
      }
    }
  }

  // 7. Equipamentos / pedido identificado
  const equipmentKeywords = ["forno", "fogão", "fritadeira", "bancada", "abatedor", "máquina de lavar", "copos", "loiça", "vitrine", "arca", "frigorífico", "convector", "chapa", "grelhador", "fiambre", "tostadeira", "mesa", "exaustor", "lavandaria"];
  const foundEquip: string[] = [];
  for (const kw of equipmentKeywords) {
    if (fullText.toLowerCase().includes(kw) || subject.toLowerCase().includes(kw)) {
      foundEquip.push(kw);
    }
  }
  if (foundEquip.length > 0) {
    result.requested_items = foundEquip.join(", ");
    result.request_type = "orcamento";
  }

  return result;
}
