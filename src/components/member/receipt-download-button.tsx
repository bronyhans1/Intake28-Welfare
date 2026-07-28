"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { LoadingButton } from "@/components/ui/loading-button";
import { useToast } from "@/components/providers/toast-provider";

interface ReceiptDownloadButtonProps {
  receiptId: string;
  receiptNumber: string;
}

export function ReceiptDownloadButton({
  receiptId,
  receiptNumber,
}: ReceiptDownloadButtonProps) {
  const [loading, setLoading] = useState(false);
  const { showError } = useToast();

  async function handleDownload() {
    if (loading) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/receipts/${receiptId}/download`, {
        credentials: "same-origin",
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Failed to download receipt.");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${receiptNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Failed to download receipt.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <LoadingButton
      type="button"
      variant="outline"
      size="sm"
      onClick={handleDownload}
      loading={loading}
      loadingText="Generating…"
    >
      <Download className="size-4" />
      PDF
    </LoadingButton>
  );
}
