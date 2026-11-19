"use client";

import { ProviderBatchNavigation } from "@/components/admin/provider-batch-navigation";

interface PaystackBatchNavigationProps {
  batch: number;
  hasPrevious: boolean;
  hasNext: boolean;
  companionHubtelBatch?: number;
}

export function PaystackBatchNavigation({
  batch,
  hasPrevious,
  hasNext,
  companionHubtelBatch,
}: PaystackBatchNavigationProps) {
  return (
    <ProviderBatchNavigation
      provider="paystack"
      batch={batch}
      hasPrevious={hasPrevious}
      hasNext={hasNext}
      companionBatch={companionHubtelBatch}
    />
  );
}
