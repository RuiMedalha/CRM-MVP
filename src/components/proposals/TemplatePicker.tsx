import { useQuery } from "@tanstack/react-query";
import { listTemplates, loadFromTemplate } from "@/integrations/directus/quotations";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FileStack } from "lucide-react";

interface TemplatePickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (templateData: any) => void;
}

export function TemplatePicker({ open, onClose, onSelect }: TemplatePickerProps) {
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["quotation-templates"],
    queryFn: listTemplates,
    enabled: open,
  });

  const handleSelect = async (templateId: number) => {
    const data = await loadFromTemplate(templateId);
    if (data) {
      onSelect(data);
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileStack className="h-5 w-5" />
            Começar a partir de modelo
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-2 max-h-80 overflow-y-auto">
          {isLoading && (
            <p className="text-sm text-muted-foreground text-center py-4">A carregar...</p>
          )}
          {!isLoading && templates.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum modelo disponível.
            </p>
          )}
          {templates.map((template: any) => (
            <Card
              key={template.id}
              className="cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => handleSelect(template.id)}
            >
              <CardContent className="py-3 px-4">
                <p className="text-sm font-medium">{template.name}</p>
                {template.description && (
                  <p className="text-xs text-muted-foreground mt-0.5">{template.description}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
