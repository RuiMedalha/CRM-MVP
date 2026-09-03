/**
 * Builds a complete URLSearchParams for creating a new contact from a lead/conversation/contact record.
 * Handles fallbacks: contact_phone → lead_data.phone → phone, etc.
 * Centralizes the URL param construction so field mapping bugs don't replicate across 8 files.
 */

export interface ContactCreationSource {
  id?: string | number;
  contact_phone?: string | null;
  phone?: string | null;
  mobile_phone?: string | null;
  contact_name?: string | null;
  display_name?: string | null;
  company_name?: string | null;
  email?: string | null;
  city?: string | null;
  postal_code?: string | null;
  website?: string | null;
  source?: string | null;
  nif?: string | null;
  lead_data?: Record<string, unknown> | null;
}

export function buildContactCreationUrl(
  source: ContactCreationSource,
  options?: {
    includeLeadId?: boolean; // add leadId param if source.id exists
    includeNif?: boolean; // add nif param if present
  }
): URLSearchParams {
  const params = new URLSearchParams();

  const leadData = source.lead_data || {};

  // Phone: try contact_phone first, then lead_data.phone, then phone
  const phone = source.contact_phone || (leadData as any)?.phone || source.phone;
  if (phone) params.set("phone", String(phone));

  // Mobile phone: top-level mobile_phone, then lead_data.mobile_phone
  const mobilePhone = source.mobile_phone || (leadData as any)?.mobile_phone;
  if (mobilePhone) params.set("mobile_phone", String(mobilePhone));

  // Company/name: prefer company_name (top-level or lead_data) over person name
  const companyName = source.company_name || (leadData as any)?.company_name;
  const personName = source.contact_name || (leadData as any)?.contact_name;
  const name = companyName || source.display_name || personName;
  if (name) params.set("name", String(name));
  if (companyName) params.set("company_name", String(companyName));

  // Separate contact person only when company is different from the person name
  if (companyName && personName && String(companyName).trim() !== String(personName).trim()) {
    params.set("contact_person", String(personName));
  }

  // Email
  if (source.email) params.set("email", String(source.email));

  // Location
  if (source.city) params.set("city", String(source.city));
  if (source.postal_code) params.set("postal_code", String(source.postal_code));

  // Web
  if (source.website) params.set("website", String(source.website));

  // Source (e.g., "email_inbound", "telecof_call", "whatsapp")
  if (source.source) params.set("source", String(source.source));

  // NIF (if enabled in options)
  if (options?.includeNif && source.nif) {
    params.set("nif", String(source.nif));
  }

  // Lead ID (if enabled in options and present)
  if (options?.includeLeadId && source.id) {
    params.set("leadId", String(source.id));
  }

  return params;
}
