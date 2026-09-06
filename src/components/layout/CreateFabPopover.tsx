import { useNavigate } from "react-router-dom";
import { Popover, PopoverContent } from "@/components/ui/popover";
import {
  SendHorizontal,
  Calculator,
  UserPlus,
  IdCard,
  CheckSquare,
  type LucideIcon,
} from "lucide-react";

interface QuickAction {
  label: string;
  description: string;
  path: string;
  icon: LucideIcon;
}

const quickActions: QuickAction[] = [
  {
    label: "Nova Proposta",
    description: "Criar uma proposta comercial",
    path: "/propostas/nova",
    icon: SendHorizontal,
  },
  {
    label: "Novo Orçamento",
    description: "Criar orçamento rápido",
    path: "/orcamentos",
    icon: Calculator,
  },
  {
    label: "Novo Lead",
    description: "Adicionar lead ao funil",
    path: "/leads?new=1",
    icon: UserPlus,
  },
  {
    label: "Novo Cliente",
    description: "Criar ficha de cliente",
    path: "/contactos?new=1",
    icon: IdCard,
  },
  {
    label: "Nova Tarefa",
    description: "Agendar follow-up",
    path: "/agenda?new=task",
    icon: CheckSquare,
  },
];

interface CreateFabPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * CreateFabPopover — picker de 4 quick-actions para o FAB mobile.
 * Deep-link apenas — sem handlers de submit (rotas tratam).
 */
export function CreateFabPopover({ open, onOpenChange }: CreateFabPopoverProps) {
  const navigate = useNavigate();

  const handleAction = (path: string) => {
    onOpenChange(false);
    navigate(path);
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverContent
        side="top"
        align="center"
        sideOffset={16}
        className="w-64 p-2"
      >
        <p className="px-3 pt-2 pb-1 text-xs text-muted-foreground font-medium uppercase tracking-wider">
          Acção rápida
        </p>
        <ul className="grid gap-1">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <li key={action.path}>
                <button
                  type="button"
                  onClick={() => handleAction(action.path)}
                  className="flex items-center gap-3 w-full p-3 rounded-md hover:bg-muted transition-colors text-left"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary shrink-0">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{action.label}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {action.description}
                    </p>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
