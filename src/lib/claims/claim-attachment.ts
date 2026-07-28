import { CLAIM_ATTACHMENT, STORAGE_PATHS } from "@/lib/constants";
import { validateStorageFile } from "@/lib/storage/service";

export function buildClaimAttachmentStoragePath(
  memberId: string,
  claimId: string,
  fileName: string,
): string {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
  return `${STORAGE_PATHS.CLAIMS}/${memberId}/${claimId}/${Date.now()}-${safeName}`;
}

export function validateClaimAttachment(file: File): string | null {
  return validateStorageFile(file, {
    acceptedMimeTypes: [...CLAIM_ATTACHMENT.ACCEPTED_MIME_TYPES],
    maxSizeBytes: CLAIM_ATTACHMENT.MAX_SIZE_BYTES,
  });
}
