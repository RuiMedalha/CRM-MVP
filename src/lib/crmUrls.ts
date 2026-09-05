export function crmDashboard360Url(contactId?: string): string {
  if (contactId?.trim()) {
    return `/customer360-shell/${encodeURIComponent(contactId.trim())}`
  }
  return `/customer360-shell`
}

export function crmDashboard360UrlForCall(options: {
  contactId?: string
  phone?: string
}): string {
  if (options.contactId?.trim()) return crmDashboard360Url(options.contactId)
  const phone = options.phone?.trim()
  if (phone) {
    const params = new URLSearchParams({ phone })
    return `/customer360-shell?${params.toString()}`
  }
  return `/customer360-shell`
}

export function crmQuoteUrl(contactId?: string): string {
  if (contactId?.trim()) {
    const params = new URLSearchParams({ contactId: contactId.trim() })
    return `/propostas/nova?${params.toString()}`
  }
  return `/propostas/nova`
}
