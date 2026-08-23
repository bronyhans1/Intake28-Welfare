import {
  WELFARE_SUPPORT_TYPE_LABELS,
  type WelfareSupportType,
} from "@/types/enums";
import type { SerializedWelfareSupportTypeConfig } from "@/types/welfare-support-type";

/**
 * Resolve a human-readable support type label for display/export.
 *
 * 1. Config display name (active or inactive)
 * 2. Legacy enum label map (pre-catalog records)
 * 3. Stored code (never blank)
 */
export function resolveWelfareSupportTypeDisplayName(
  code: string,
  configs?:
    | readonly SerializedWelfareSupportTypeConfig[]
    | ReadonlyMap<string, string>
    | Record<string, string>
    | null,
): string {
  const trimmed = code?.trim() ?? "";
  if (!trimmed) return "—";

  if (configs) {
    if (configs instanceof Map) {
      const fromMap = configs.get(trimmed);
      if (fromMap?.trim()) return fromMap.trim();
    } else if (Array.isArray(configs)) {
      const match = configs.find((type) => type.code === trimmed);
      if (match?.displayName?.trim()) return match.displayName.trim();
    } else {
      const fromRecord = (configs as Record<string, string>)[trimmed];
      if (fromRecord?.trim()) return fromRecord.trim();
    }
  }

  const legacy =
    WELFARE_SUPPORT_TYPE_LABELS[trimmed as WelfareSupportType];
  if (legacy) return legacy;

  return trimmed;
}

export function buildWelfareSupportTypeLabelMap(
  configs: readonly SerializedWelfareSupportTypeConfig[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const config of configs) {
    map.set(config.code, config.displayName);
  }
  return map;
}
