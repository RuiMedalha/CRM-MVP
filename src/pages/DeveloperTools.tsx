/**
 * Developer Tools — página de operações administrativas.
 * Apenas visual. Nenhuma operação está implementada.
 * Visível apenas para Admin.
 */

import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { SectionCard } from "@/components/customer360/ui/SectionCard";
import { StatusBadge } from "@/components/customer360/ui/StatusBadge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { RefreshCw, Database, Trash2, Wand2, Eraser, Search, Terminal, Shield } from "lucide-react";

const ENV_INFO = [
  { label: "CRM URL", value: window.location.origin },
  { label: "Directus URL", value: import.meta.env.VITE_DIRECTUS_URL || "—" },
  { label: "Branch", value: "—" },
  { label: "Build Version", value: "—" },
  { label: "Database", value: "PostgreSQL (Directus)" },
  { label: "Última sincronização", value: "—" },
];

const OPERATIONS = [
  { id: "backup", label: "Backup Produção", icon: Database, description: "Criar backup completo da base de dados de produção" },
  { id: "restore", label: "Restore Teste", icon: RefreshCw, description: "Restaurar último backup no ambiente de teste" },
  { id: "reset", label: "Reset Teste", icon: Trash2, description: "Limpar todos os dados do ambiente de teste" },
  { id: "seed", label: "Seed Demo Data", icon: Wand2, description: "Popular ambiente de teste com dados demo" },
  { id: "cache", label: "Limpar Cache", icon: Eraser, description: "Limpar cache do Directus e Meilisearch" },
  { id: "reindex", label: "Reindexar Pesquisa", icon: Search, description: "Reindexar produtos no Meilisearch" },
];

export default function DeveloperTools() {
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);

  return (
    <AppLayout>
      <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4">
        {/* Page header */}
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
            <Terminal className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold">Developer Tools</h1>
            <p className="text-xs text-muted-foreground">Operações administrativas e manutenção do sistema</p>
          </div>
          <StatusBadge label="Admin only" variant="warning" size="sm" />
        </div>

        {/* Section 1: Environment */}
        <SectionCard title="Environment">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
            {ENV_INFO.map(({ label, value }) => (
              <div key={label} className="contents">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="text-[12px] font-mono text-foreground truncate">{value}</dd>
              </div>
            ))}
          </dl>
        </SectionCard>

        {/* Section 2: Sync Production → Test */}
        <SectionCard title="Sincronização">
          <div className="flex flex-col items-center gap-3 py-4">
            <Button
              size="lg"
              className="gap-2 text-sm h-12 px-6"
              onClick={() => setSyncDialogOpen(true)}
            >
              <RefreshCw className="h-4 w-4" />
              🔄 Sincronizar Produção → Teste
            </Button>
            <p className="text-xs text-muted-foreground text-center max-w-sm">
              Copia a base de dados de produção para o ambiente de teste, limpa tokens e desactiva integrações.
            </p>
            <StatusBadge label="Não implementado" variant="muted" size="sm" />
          </div>
        </SectionCard>

        {/* Section 3: Operations (all disabled) */}
        <SectionCard title="Operations">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {OPERATIONS.map((op) => (
              <div key={op.id} className="rounded-lg border border-dashed border-border p-3 opacity-50">
                <div className="flex items-center gap-2 mb-1">
                  <op.icon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-[12px] font-medium text-muted-foreground">{op.label}</span>
                </div>
                <p className="text-xs text-muted-foreground/70">{op.description}</p>
                <Button size="sm" variant="outline" className="mt-2 h-6 text-xs" disabled>
                  Executar
                </Button>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Section 4: Logs */}
        <SectionCard title="Logs">
          <div className="rounded-md bg-muted/40 p-4 text-center">
            <p className="text-xs text-muted-foreground">Log de operações aparecerá aqui quando as operações forem implementadas.</p>
          </div>
        </SectionCard>

        {/* Security notice */}
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2">
          <Shield className="h-4 w-4 text-amber-600 shrink-0" />
          <p className="text-xs text-amber-700">
            Esta página é restrita a administradores. As operações são irreversíveis quando implementadas.
          </p>
        </div>
      </div>

      {/* Sync Dialog */}
      <Dialog open={syncDialogOpen} onOpenChange={setSyncDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sincronizar Produção para Ambiente de Teste</DialogTitle>
            <DialogDescription>
              Esta operação irá futuramente:
            </DialogDescription>
          </DialogHeader>
          <ul className="space-y-2 text-sm text-muted-foreground py-4">
            <li>• Criar backup de produção</li>
            <li>• Copiar base de dados</li>
            <li>• Copiar uploads</li>
            <li>• Limpar tokens</li>
            <li>• Desativar integrações</li>
            <li>• Atualizar staging</li>
          </ul>
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
            <p className="text-xs text-amber-700 font-medium">⚠️ Nesta sprint: operação NÃO executada. Apenas placeholder.</p>
          </div>
          <div className="flex justify-end pt-4">
            <Button variant="outline" onClick={() => setSyncDialogOpen(false)}>Fecha</Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
