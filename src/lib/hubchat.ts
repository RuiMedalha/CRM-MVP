const DEFAULT_HUBCHAT_URL = "https://hubchat.hotelequip.pt";

export const HUBCHAT_BASE_URL = String(
  import.meta.env.VITE_HUBCHAT_URL || DEFAULT_HUBCHAT_URL,
).replace(/\/+$/, "");

export function buildHubChatEmbedUrl(options?: { contactId?: string | null }): string {
  const url = new URL(HUBCHAT_BASE_URL);
  const contactId = String(options?.contactId ?? "").trim();
  if (contactId) {
    url.searchParams.set("contact_id", contactId);
  }
  return url.toString();
}
