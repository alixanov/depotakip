import { MoreHorizontal } from "lucide-react";
import type { ReactNode } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

interface RowActionsProps {
  children: ReactNode;
  label?: string;
}

/**
 * Standard "⋯" trigger + dropdown for table-row actions. Replaces
 * 2-3 inline icon-buttons that were cluttering rows. Click is stopped
 * so it doesn't trigger `onRowClick`.
 */
export function RowActions({ children, label = "İşlemler" }: RowActionsProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()} className="w-48">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
