import { describe, expect, it, vi } from "vitest";
import { buildProfilePhotoStoragePath } from "@/lib/storage/paths";
import type { ProfilePhotoUploadProgress } from "@/lib/storage/types";

describe("profile photo optimized storage path", () => {
  it("always stores optimized photos as profile.webp", () => {
    expect(buildProfilePhotoStoragePath("IS/13984")).toBe(
      "profile-photos/IS13984/profile.webp",
    );
  });
});

describe("profile photo upload progress messaging", () => {
  it("formats uploading progress messages from 0 to 100", () => {
    const messages: string[] = [];
    const onProgress = (progress: ProfilePhotoUploadProgress) => {
      messages.push(progress.message);
    };

    const percents = [0, 25, 50, 75, 100];
    for (const percent of percents) {
      onProgress({
        stage: "uploading",
        message: `Uploading... ${percent}%`,
        progress: percent,
      });
    }

    expect(messages).toEqual([
      "Uploading... 0%",
      "Uploading... 25%",
      "Uploading... 50%",
      "Uploading... 75%",
      "Uploading... 100%",
    ]);
  });

  it("emits the expected pipeline status sequence", () => {
    const stages: ProfilePhotoUploadProgress["stage"][] = [];
    const onProgress = vi.fn((progress: ProfilePhotoUploadProgress) => {
      stages.push(progress.stage);
    });

    const sequence: ProfilePhotoUploadProgress[] = [
      { stage: "preparing", message: "Preparing image..." },
      { stage: "optimizing", message: "Optimizing image..." },
      { stage: "uploading", message: "Uploading... 40%", progress: 40 },
      { stage: "saving", message: "Saving profile..." },
      { stage: "cleanup", message: "Cleaning up previous image..." },
      { stage: "complete", message: "Upload complete.", progress: 100 },
    ];

    for (const item of sequence) {
      onProgress(item);
    }

    expect(stages).toEqual([
      "preparing",
      "optimizing",
      "uploading",
      "saving",
      "cleanup",
      "complete",
    ]);
  });
});
