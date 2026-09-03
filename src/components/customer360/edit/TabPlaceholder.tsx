/**
 * TabPlaceholder — mensagem para tabs não implementados.
 */

import { EntitySection } from "./EntitySection";

interface TabPlaceholderProps {
  title: string;
  message?: string;
}

export function TabPlaceholder({ title, message }: TabPlaceholderProps) {
  return (
    <EntitySection title={title}>
      <div className="py-8 text-center">
        <p className="text-sm text-muted-foreground">
          {message || "Esta funcionalidade será ativada nas próximas fases do projeto."}
        </p>
      </div>
    </EntitySection>
  );
}
