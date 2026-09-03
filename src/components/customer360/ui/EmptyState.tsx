interface EmptyStateProps {
  icon?: string;
  message: string;
}

export function EmptyState({ icon = "📭", message }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-6 text-center">
      <span className="text-2xl mb-1 opacity-40">{icon}</span>
      <p className="text-xs text-muted-foreground">{message}</p>
    </div>
  );
}
