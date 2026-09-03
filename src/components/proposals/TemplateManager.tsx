import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listTemplates, saveAsTemplate } from "@/integrations/directus/quotations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileStack, Trash2 } from "lucide-react";

export function TemplateManager() {
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["quotation-templates"],
    queryFn: listTemplates,
  });

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">A carregar modelos...</div>;
  }

  if (templates.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <FileStack className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">Nenhum modelo guardado.</p>
        <p className="text-xs mt-1">Crie uma proposta e guarde-a como modelo para reutilizar.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {templates.map((template: any) => (
        <Card key={template.id} className="hover:bg-accent/50 transition-colors">
          <CardContent className="py-3 px-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{template.name}</p>
              {template.description && (
                <p className="text-xs text-muted-foreground">{template.description}</p>
              )}
              {template.date_created && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {new Date(template.date_created).toLocaleDateString("pt-PT")}
                </p>
              )}
            </div>
            <Badge variant="secondary" className="text-xs">Modelo</Badge>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
