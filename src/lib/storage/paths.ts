import { STORAGE_PATHS } from "@/lib/constants";
import { parseServiceNumberSuffix } from "@/lib/utils/service-number";

/**
 * Storage folder keys cannot contain `/`, so service numbers like `IS/13984`
 * are normalized to `IS13984`.
 */
export function sanitizeStorageServiceNumber(serviceNumber: string): string {
  const suffix = parseServiceNumberSuffix(serviceNumber);
  return `IS${suffix}`;
}

export function buildProfilePhotoStoragePath(serviceNumber: string): string {
  const folder = sanitizeStorageServiceNumber(serviceNumber);
  return `${STORAGE_PATHS.PROFILE_PHOTOS}/${folder}/profile.webp`;
}

export function buildReceiptStoragePath(
  year: number | string,
  fileName: string,
): string {
  return `${STORAGE_PATHS.RECEIPTS}/${year}/${fileName}`;
}

export function buildClaimStoragePath(
  serviceNumber: string,
  fileName: string,
): string {
  const folder = sanitizeStorageServiceNumber(serviceNumber);
  return `${STORAGE_PATHS.CLAIMS}/${folder}/${fileName}`;
}

export function buildAnnouncementStoragePath(fileName: string): string {
  return `${STORAGE_PATHS.ANNOUNCEMENTS}/${fileName}`;
}

export function buildConstitutionStoragePath(fileName: string): string {
  return `${STORAGE_PATHS.CONSTITUTION}/${fileName}`;
}

export function isProfilePhotoPathForServiceNumber(
  storagePath: string,
  serviceNumber: string,
): boolean {
  const expectedPrefix = `${STORAGE_PATHS.PROFILE_PHOTOS}/${sanitizeStorageServiceNumber(serviceNumber)}/`;
  return (
    storagePath.startsWith(expectedPrefix) &&
    /^profile\.(jpe?g|png|webp)$/i.test(storagePath.slice(expectedPrefix.length))
  );
}
