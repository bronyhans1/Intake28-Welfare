"use client";

import { useState } from "react";
import { Eye } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { shouldTruncateText, truncateText } from "@/lib/utils/truncate-text";

const PREVIEW_LENGTH = 80;

interface AuditLogTextCellProps {
  value: string;
  label: string;
  className?: string;
}

export function AuditLogTextCell({ value, label, className }: AuditLogTextCellProps) {
  const [open, setOpen] = useState(false);
  const isLong = shouldTruncateText(value, PREVIEW_LENGTH);
  const preview = truncateText(value, PREVIEW_LENGTH);

  return (
    <>
      <div className={cn("flex min-w-[12rem] items-start gap-2", className)}>
        <span
          className="min-w-0 whitespace-nowrap"
          title={isLong ? value : undefined}
        >
          {preview}
        </span>
        {isLong ? (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="shrink-0 text-muted-foreground"
            onClick={() => setOpen(true)}
          >
            <Eye className="size-3.5" />
            View
          </Button>
        ) : null}
      </div>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{label}</AlertDialogTitle>
            <AlertDialogDescription className="whitespace-pre-wrap break-words text-foreground">
              {value}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction>Close</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
