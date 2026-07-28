"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useToast } from "@/components/providers/toast-provider";

const TOAST_MESSAGES: Record<string, string> = {
  "profile-updated": "Profile updated successfully",
  "email-updated": "Email updated successfully",
  "phone-verified": "Phone number verified successfully",
  "photo-uploaded": "Profile photo uploaded successfully",
  "photo-updated": "Profile photo updated successfully",
  "photo-removed": "Profile photo removed successfully",
  "contribution-created": "Contribution recorded successfully",
  "contribution-updated": "Contribution updated successfully",
  "announcement-created": "Announcement created successfully",
  "announcement-updated": "Announcement updated successfully",
  "welfare-support-created": "Welfare support recorded successfully",
  "welfare-support-updated": "Welfare support updated successfully",
  "member-created": "Member created successfully",
  "member-updated": "Member updated successfully",
};

export function ToastFromSearchParams() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { showSuccess } = useToast();
  const handledRef = useRef<string | null>(null);

  useEffect(() => {
    const toastKey = searchParams.get("toast");
    if (!toastKey) return;

    const signature = `${window.location.pathname}?toast=${toastKey}`;
    if (handledRef.current === signature) return;
    handledRef.current = signature;

    const message = TOAST_MESSAGES[toastKey];
    if (message) {
      showSuccess(message);
    }

    const params = new URLSearchParams(searchParams.toString());
    params.delete("toast");
    const nextQuery = params.toString();
    router.replace(nextQuery ? `${window.location.pathname}?${nextQuery}` : window.location.pathname);
  }, [router, searchParams, showSuccess]);

  return null;
}
