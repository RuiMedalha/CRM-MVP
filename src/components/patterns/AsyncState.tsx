import * as React from "react";

import { AlertCircle, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "./EmptyState";

/** Standard loading, error and empty-state boundary for asynchronous content. */
export interface AsyncStateProps {
  loading?: boolean;
  error?: React.ReactNode;
  empty?: boolean | React.ReactNode;
  onRetry?: () => void;
  children: React.ReactNode;
  loadingFallback?: React.ReactNode;
  emptyFallback?: React.ReactNode;
}

export function AsyncState({ loading, error, empty, onRetry, children, loadingFallback, emptyFallback }: AsyncStateProps) {
  if (loading) return <>{loadingFallback ?? <AsyncStateSkeleton />}</>;
  if (error) {
    return (
      <EmptyState
        icon={<AlertCircle className="size-8" aria-hidden="true" />}
        title="Não foi possível carregar os dados"
        description={error}
        action={onRetry ? <Button variant="outline" onClick={onRetry}><RefreshCw className="size-4" />Tentar novamente</Button> : undefined}
        role="alert"
      />
    );
  }
  if (empty) return <>{emptyFallback ?? (typeof empty === "boolean" ? <EmptyState title="Ainda não existem dados" description="Quando houver informação disponível, ela aparecerá aqui." /> : empty)}</>;
  return <>{children}</>;
}

function AsyncStateSkeleton() {
  return <div className="space-y-3" aria-busy="true" aria-label="A carregar"><Skeleton className="h-10 w-2/5" /><Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" /></div>;
}
