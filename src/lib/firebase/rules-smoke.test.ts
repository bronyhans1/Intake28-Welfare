/**
 * Static smoke checks: production rules ↔ inspected client access paths.
 * Does not deploy or call live Storage/Auth flows.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildClaimAttachmentStoragePath } from "@/lib/claims/claim-attachment";
import {
  buildConstitutionStoragePath,
  buildProfilePhotoStoragePath,
} from "@/lib/storage/paths";

const root = resolve(__dirname, "../../..");
const firestoreRules = readFileSync(resolve(root, "firebase/firestore.rules"), "utf8");
const storageRules = readFileSync(resolve(root, "firebase/storage.rules"), "utf8");

describe("Firestore production rules smoke", () => {
  it("allows only authenticated get of users/{auth.uid}", () => {
    expect(firestoreRules).toMatch(
      /allow get:\s*if request\.auth != null && request\.auth\.uid == userId/,
    );
    expect(firestoreRules).toMatch(
      /allow list,\s*create,\s*update,\s*delete:\s*if false/,
    );
  });

  it("denies client access to Admin-SDK-only collections", () => {
    for (const collection of [
      "payments",
      "contributions",
      "claims",
      "receipts",
      "announcements",
      "audit_logs",
      "welfare_support",
      "progression",
      "notification_events",
      "membership_requests",
    ]) {
      expect(firestoreRules).toContain(`match /${collection}/{id}`);
      expect(firestoreRules).toMatch(
        new RegExp(
          `match /${collection}/\\{id\\}[\\s\\S]*?allow read, write: if false`,
        ),
      );
    }
  });

  it("has a default-deny catch-all", () => {
    expect(firestoreRules).toContain("match /{document=**}");
    expect(firestoreRules).toMatch(/allow read, write:\s*if false/);
  });
});

describe("Storage production rules smoke", () => {
  it("binds profile photos to Firestore serviceNumberSuffix, not metadata", () => {
    expect(storageRules).toContain("serviceNumberSuffix");
    expect(storageRules).toContain("expectedPhotoFolder");
    expect(storageRules).not.toContain("uploadedBy");
    expect(buildProfilePhotoStoragePath("IS/13984")).toBe(
      "profile-photos/IS13984/profile.webp",
    );
  });

  it("matches the three-segment claims path used by the app", () => {
    expect(storageRules).toContain(
      "match /claims/{memberId}/{claimId}/{fileName}",
    );
    const path = buildClaimAttachmentStoragePath("uid-abc", "claim-1", "scan.pdf");
    expect(path).toMatch(/^claims\/uid-abc\/claim-1\/\d+-scan\.pdf$/);
  });

  it("restricts claim write to owner and read to owner or admin/treasurer", () => {
    expect(storageRules).toContain("isClaimOwner(memberId)");
    expect(storageRules).toContain("isAdminOrTreasurer()");
    expect(storageRules).toMatch(
      /match \/claims\/\{memberId\}\/\{claimId\}\/\{fileName\}[\s\S]*allow delete:\s*if false/,
    );
  });

  it("allows admin-only constitution write/delete and signed-in read", () => {
    expect(storageRules).toContain("match /constitution/{fileName}");
    expect(storageRules).toMatch(
      /match \/constitution\/\{fileName\}[\s\S]*allow write:\s*if isAdmin\(\)/,
    );
    expect(storageRules).toMatch(
      /match \/constitution\/\{fileName\}[\s\S]*allow delete:\s*if isAdmin\(\)/,
    );
    expect(storageRules).toMatch(
      /match \/constitution\/\{fileName\}[\s\S]*allow read:\s*if isSignedIn\(\)/,
    );
    expect(buildConstitutionStoragePath("constitution_v1.pdf")).toBe(
      "constitution/constitution_v1.pdf",
    );
  });

  it("denies client writes to announcements and receipts", () => {
    expect(storageRules).toMatch(
      /match \/announcements\/\{fileName\}[\s\S]*allow write, delete:\s*if false/,
    );
    expect(storageRules).toMatch(
      /match \/receipts\/\{year\}\/\{fileName\}[\s\S]*allow write, delete:\s*if false/,
    );
  });

  it("denies unknown paths", () => {
    expect(storageRules).toContain("match /{allPaths=**}");
  });
});

describe("Workflow ↔ access matrix (static)", () => {
  it("documents client vs Admin SDK boundaries for smoke review", () => {
    const matrix = [
      {
        workflow: "Login / AuthProvider",
        client: "Firestore get users/{uid}",
        adminSdk: false,
      },
      {
        workflow: "Member dashboard",
        client: "none (server actions)",
        adminSdk: true,
      },
      {
        workflow: "Profile photo upload",
        client: "Storage profile-photos/{IS####}/profile.webp",
        adminSdk: "path assert + user update",
      },
      {
        workflow: "Claim attachment upload",
        client: "Storage claims/{uid}/{claimId}/{file}",
        adminSdk: "claim draft write",
      },
      {
        workflow: "Constitution upload",
        client: "Storage constitution/* (admin)",
        adminSdk: "constitutions collection",
      },
      {
        workflow: "Contributions / Payments / Receipts / Claims lists",
        client: "none",
        adminSdk: true,
      },
      {
        workflow: "Admin dashboard / Reports",
        client: "none",
        adminSdk: true,
      },
    ] as const;

    expect(matrix).toHaveLength(7);
    expect(matrix.every((row) => row.workflow.length > 0)).toBe(true);
  });
});
