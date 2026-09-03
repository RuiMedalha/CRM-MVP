import { cn } from "@/lib/utils";
import { User, Package, Film, Wrench, Settings, Target, Eye, Send } from "lucide-react";

const steps = [
  { label: "Cliente", icon: User },
  { label: "Conteúdo", icon: Package },
  { label: "Média", icon: Film },
  { label: "Serviços", icon: Wrench },
  { label: "Configurações", icon: Settings },
  { label: "Persuasão", icon: Target },
  { label: "Pré-visualização", icon: Eye },
  { label: "Enviar", icon: Send },
];

interface ProposalStepperProps {
  currentStep: number;
  onStepClick?: (step: number) => void;
}

export function ProposalStepper({ currentStep, onStepClick }: ProposalStepperProps) {
  return (
    <div className="w-full">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isActive = index === currentStep;
          const isCompleted = index < currentStep;

          return (
            <div key={step.label} className="flex flex-1 items-center">
              <button
                type="button"
                onClick={() => onStepClick?.(index)}
                className={cn(
                  "flex flex-col items-center gap-1 w-full group transition-colors",
                  onStepClick && "cursor-pointer",
                  !onStepClick && "cursor-default"
                )}
              >
                <div
                  className={cn(
                    "flex items-center justify-center w-9 h-9 rounded-full border-2 transition-all",
                    isActive && "border-primary bg-primary text-primary-foreground",
                    isCompleted && "border-primary bg-primary/10 text-primary",
                    !isActive && !isCompleted && "border-muted-foreground/30 text-muted-foreground/50"
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <span
                  className={cn(
                    "text-xs font-medium hidden sm:block",
                    isActive && "text-primary",
                    isCompleted && "text-primary/80",
                    !isActive && !isCompleted && "text-muted-foreground/60"
                  )}
                >
                  {step.label}
                </span>
              </button>

              {/* Connector line */}
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    "h-0.5 flex-1 mx-1 mt-[-1rem] sm:mt-0",
                    index < currentStep ? "bg-primary" : "bg-muted-foreground/20"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
