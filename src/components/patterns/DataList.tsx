import * as React from "react";

import { cn } from "@/lib/utils";

/** Generic stacked list for mobile records, with caller-defined card content. */
export interface DataListProps<T> extends React.HTMLAttributes<HTMLDivElement> {
  data: readonly T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  getKey: (item: T, index: number) => React.Key;
  empty?: React.ReactNode;
}

export function DataList<T>({ data, renderItem, getKey, empty = null, className, ...props }: DataListProps<T>) {
  if (!data.length) return <>{empty}</>;
  return <div className={cn("space-y-3", className)} {...props}>{data.map((item, index) => <React.Fragment key={getKey(item, index)}>{renderItem(item, index)}</React.Fragment>)}</div>;
}
