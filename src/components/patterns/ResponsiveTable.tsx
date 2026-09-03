import * as React from "react";

import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DataList } from "./DataList";

export interface ResponsiveTableColumn<T> {
  id: string;
  header: React.ReactNode;
  cell: (row: T, index: number) => React.ReactNode;
  className?: string;
  headerClassName?: string;
}

/** Renders semantic tables from md up and caller-designed cards below md. */
export interface ResponsiveTableProps<T> {
  data: readonly T[];
  columns: readonly ResponsiveTableColumn<T>[];
  getRowKey: (row: T, index: number) => React.Key;
  renderMobileCard: (row: T, index: number) => React.ReactNode;
  empty?: React.ReactNode;
  className?: string;
  tableClassName?: string;
  mobileClassName?: string;
  onRowClick?: (row: T, index: number) => void;
}

export function ResponsiveTable<T>({ data, columns, getRowKey, renderMobileCard, empty, className, tableClassName, mobileClassName, onRowClick }: ResponsiveTableProps<T>) {
  if (!data.length) return <>{empty ?? null}</>;
  return (
    <div className={className}>
      <div className="hidden md:block">
        <Table className={tableClassName}>
          <TableHeader><TableRow>{columns.map((column) => <TableHead key={column.id} className={column.headerClassName}>{column.header}</TableHead>)}</TableRow></TableHeader>
          <TableBody>{data.map((row, index) => <TableRow key={getRowKey(row, index)} onClick={onRowClick ? () => onRowClick(row, index) : undefined} className={cn(onRowClick && "cursor-pointer")}>{columns.map((column) => <TableCell key={column.id} className={column.className}>{column.cell(row, index)}</TableCell>)}</TableRow>)}</TableBody>
        </Table>
      </div>
      <DataList data={data} getKey={getRowKey} renderItem={(row, index) => <div onClick={onRowClick ? () => onRowClick(row, index) : undefined} className={cn(onRowClick && "cursor-pointer")}>{renderMobileCard(row, index)}</div>} className={cn("md:hidden", mobileClassName)} />
    </div>
  );
}
