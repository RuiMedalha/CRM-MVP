export const CRM_APP_URL = "https://crm.hotelequip.pt"

export function crmDashboard360Url(contactId?: string): string {
  if (contactId?.trim()) {
    return `${CRM_APP_URL}/customer360-shell/${encodeURIComponent(contactId.trim())}`
  }
  return `${CRM_APP_URL}/customer360-shell`
}

export function crmDashboard360UrlForCall(options: {
  contactId?: string
  phone?: string
}): string {
  if (options.contactId?.trim()) return crmDashboard360Url(options.contactId)
  const phone = options.phone?.trim()
  if (phone) {
    const params = new URLSearchParams({ phone })
    return `${CRM_APP_URL}/customer360-shell?${params.toString()}`
  }
  return `${CRM_APP_URL}/customer360-shell`
}

export function crmQuoteUrl(contactId?: string): string {
  if (contactId?.trim()) {
    const params = new URLSearchParams({ contact_id: contactId.trim() })
    return `${CRM_APP_URL}/orcamentos?${params.toString()}`
  }
  return `${CRM_APP_URL}/orcamentos`
}
