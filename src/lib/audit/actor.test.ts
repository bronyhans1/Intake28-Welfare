import { describe, expect, it, vi } from "vitest";
import { UserRole } from "@/types/enums";
import {
  buildAuditActor,
  resolveAuditActorDisplayName,
  resolveAuditActorName,
} from "./actor";

vi.mock("@/lib/activation/repository", () => ({
  findUserById: vi.fn(),
}));

import { findUserById } from "@/lib/activation/repository";

const mockFindUserById = vi.mocked(findUserById);

describe("buildAuditActor", () => {
  it("stores actor identity snapshot fields", () => {
    const fields = buildAuditActor({
      uid: "admin-1",
      fullName: "Harrison Oduro",
      role: UserRole.ADMIN,
    });

    expect(fields).toEqual({
      performedBy: "admin-1",
      performedByRole: UserRole.ADMIN,
      actorId: "admin-1",
      actorName: "Harrison Oduro",
      role: UserRole.ADMIN,
    });
  });
});

describe("resolveAuditActorDisplayName", () => {
  it("prefers actorName when present", async () => {
    await expect(
      resolveAuditActorDisplayName({
        actorName: "Harrison Oduro",
        performedBy: "admin-harrison-13984",
      }),
    ).resolves.toBe("Harrison Oduro");
  });

  it("resolves full name from performedBy uid", async () => {
    mockFindUserById.mockResolvedValueOnce({
      id: "admin-harrison-13984",
      fullName: "Harrison Oduro",
    } as never);

    await expect(
      resolveAuditActorDisplayName({
        performedBy: "admin-harrison-13984",
      }),
    ).resolves.toBe("Harrison Oduro");
  });

  it("falls back to session user full name", async () => {
    mockFindUserById.mockResolvedValueOnce(null);

    await expect(
      resolveAuditActorDisplayName(
        { performedBy: "missing-user" },
        { sessionUserFullName: "Harrison Oduro" },
      ),
    ).resolves.toBe("Harrison Oduro");
  });

  it("never returns unknown user", async () => {
    mockFindUserById.mockResolvedValueOnce(null);

    await expect(
      resolveAuditActorDisplayName({ performedBy: "missing-user" }),
    ).resolves.toBe("System");
  });
});

describe("resolveAuditActorName", () => {
  it("falls back to System without uid resolution", () => {
    expect(
      resolveAuditActorName({
        performedBy: "admin-harrison-13984",
      }),
    ).toBe("System");
  });
});
