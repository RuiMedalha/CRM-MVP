/**
 * Customer360Hub — página inicial do módulo Customer 360.
 * Pesquisa de contactos + botões de criação.
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useContacts } from "@/hooks/useContacts";
import { SectionCard } from "./ui/SectionCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, UserPlus, Building2, Loader2, Clock } from "lucide-react";

const RECENTS_KEY = "crm_recent_contacts";
const MAX_RECENTS = 5;

interface RecentContact {
  id: string;
  name: string;
  detail: string;
  visitedAt: number;
}

export function getRecentContacts(): RecentContact[] {
  try {
    return JSON.parse(localStorage.getItem(RECENTS_KEY) || "[]");
  } catch { return []; }
}

export function addRecentContact(c: { id: string; name: string; detail: string }) {
  const recents = getRecentContacts().filter((r) => r.id !== c.id);
  recents.unshift({ ...c, visitedAt: Date.now() });
  localStorage.setItem(RECENTS_KEY, JSON.stringify(recents.slice(0, MAX_RECENTS)));
}

export function Customer360Hub() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [recents, setRecents] = useState<RecentContact[]>([]);
  const { data: contacts, isLoading } = useContacts(query.length >= 2 ? query : "");
  const results = (contacts ?? []).slice(0, 10);

  useEffect(() => {
    setRecents(getRecentContacts());
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-[500px] p-6">
      <div className="w-full max-w-xl space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 mb-3">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Customer 360</h1>
          <p className="text-sm text-muted-foreground mt-1">Pesquisa um cliente ou cria um novo contacto</p>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Pesquisar por nome, telefone, email ou NIF..."
            className="pl-10 h-10"
            autoFocus
          />
        </div>

        {/* Recents */}
        {query.length < 2 && recents.length > 0 && (
          <div className="space-y-1">
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground px-1">
              <Clock className="h-3 w-3" /> Visitados recentemente
            </p>
            {recents.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => navigate(`/customer360-shell/${r.id}`)}
                className="flex items-center gap-3 w-full rounded-lg px-3 py-2 text-left hover:bg-accent/50 transition-colors"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {(r.name || "?").charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{r.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{r.detail}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Results */}
        {query.length >= 2 && (
          <SectionCard title={`Resultados${results.length > 0 ? ` (${results.length})` : ""}`}>
            {isLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : results.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground">Nenhum contacto encontrado.</p>
                <Button
                  variant="link"
                  size="sm"
                  className="mt-1 text-primary"
                  onClick={() => navigate(`/customer360-shell/novo?name=${encodeURIComponent(query)}`)}
                >
                  Criar "{query}" como novo contacto →
                </Button>
              </div>
            ) : (
              <div className="space-y-1">
                {results.map((c: any) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => navigate(`/customer360-shell/${c.id}`)}
                    className="flex items-center gap-3 w-full rounded-lg px-3 py-2 text-left hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      {(c.company_name || c.contact_name || "?").charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{c.company_name || c.contact_name || "—"}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {[c.phone, c.email, c.nif].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </SectionCard>
        )}

        {/* Action buttons */}
        <div className="flex items-center justify-center gap-3">
          <Button onClick={() => navigate("/customer360-shell/novo")} className="gap-2">
            <UserPlus className="h-4 w-4" />
            Criar novo contacto
          </Button>
          <Button variant="outline" onClick={() => navigate("/customer360-shell/novo?source=manual")} className="gap-2">
            <Building2 className="h-4 w-4" />
            Criar lead
          </Button>
        </div>
      </div>
    </div>
  );
}
