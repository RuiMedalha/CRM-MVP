import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle2 } from "lucide-react";

interface ApprovalModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (signature: string) => Promise<void>;
}

export function ApprovalModal({ open, onClose, onConfirm }: ApprovalModalProps) {
  const [name, setName] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (!name.trim() || !confirmed) return;
    setLoading(true);
    await onConfirm(name.trim());
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            Aprovar proposta
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>Nome completo (assinatura digital)</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="O seu nome completo"
              autoFocus
            />
          </div>

          <div className="flex items-start gap-2">
            <Checkbox
              id="confirm-approval"
              checked={confirmed}
              onCheckedChange={(v) => setConfirmed(v === true)}
            />
            <label htmlFor="confirm-approval" className="text-sm text-muted-foreground leading-tight">
              Confirmo que li e aceito os termos desta proposta comercial.
            </label>
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              className="flex-1"
              disabled={!name.trim() || !confirmed || loading}
              onClick={handleConfirm}
            >
              {loading ? "A processar..." : "Aprovar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
