function route(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(prefix + "/");
}
export function mobileSection(pathname: string): "today" | "attend" | "business" | "contacts" | "more" {
  if (pathname === "/") return "today";
  if (["/comunicacoes", "/inbox", "/email"].some((p) => route(pathname, p))) return "attend";
  if (["/pipeline", "/propostas", "/orcamentos"].some((p) => route(pathname, p))) return "business";
  if (["/contactos", "/customer360-shell", "/leads"].some((p) => route(pathname, p))) return "contacts";
  return "more";
}
