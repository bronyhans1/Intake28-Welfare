import { describe, expect, it } from "vitest";
import { ActivationStatus, UserRole, UserStatus } from "@/types/enums";
import type { User } from "@/types/user";
import { MemberAuditAction } from "@/lib/members/audit";
import { NEW_MEMBER_DEFAULTS, buildNewMemberDocument } from "@/lib/members/defaults";
import { createMemberSchema } from "@/lib/validators/member";
import {
  DUPLICATE_PHONE_NUMBER_ERROR,
  DUPLICATE_SERVICE_NUMBER_ERROR,
  findDuplicatePhoneNumber,
  findDuplicateServiceNumber,
  matchesMemberSearch,
} from "@/lib/members/duplicates";
import {
  canManageMembers,
  canViewMembers,
} from "@/lib/members/repository";
import { hasPermission, Permission } from "@/lib/auth/permissions";
import { formatServiceNumber } from "@/lib/utils/service-number";
import { validateUserForLogin } from "@/lib/auth/login";
import { evaluateActivationEligibility } from "@/lib/activation/eligibility";

const sampleUser = (overrides: Partial<User> = {}): User =>
  ({
    id: "user-1",
    serviceNumber: "IS/13984",
    serviceNumberSuffix: "13984",
    fullName: "John Doe",
    phoneNumber: "0241234567",
    rank: "Inspector",
    station: "HQ",
    profileCompleted: false,
    profileCompletionPercentage: 0,
    role: UserRole.MEMBER,
    status: UserStatus.ACTIVE,
    activationStatus: ActivationStatus.PENDING,
    lastOtpSentAt: null,
    otpAttempts: 0,
    otpLockedUntil: null,
    activationOtpSentCount: 0,
    isDefaulter: false,
    consecutiveUnpaidMonths: 0,
    createdAt: { seconds: 0, nanoseconds: 0 } as User["createdAt"],
    updatedAt: { seconds: 0, nanoseconds: 0 } as User["updatedAt"],
    ...overrides,
  }) as User;

describe("service number formatting", () => {
  it("formats suffix into IS/ prefix storage value", () => {
    expect(formatServiceNumber("13986")).toBe("IS/13986");
  });
});

describe("duplicate detection", () => {
  const users = [
    sampleUser(),
    sampleUser({
      id: "user-2",
      serviceNumber: "IS/14000",
      serviceNumberSuffix: "14000",
      phoneNumber: "0249999999",
    }),
  ];

  it("detects duplicate service numbers", () => {
    const duplicate = findDuplicateServiceNumber(users, "IS/13984", "13984");
    expect(duplicate?.id).toBe("user-1");
    expect(DUPLICATE_SERVICE_NUMBER_ERROR).toContain("service number");
  });

  it("detects duplicate phone numbers", () => {
    const duplicate = findDuplicatePhoneNumber(users, "0241234567");
    expect(duplicate?.id).toBe("user-1");
    expect(DUPLICATE_PHONE_NUMBER_ERROR).toContain("phone number");
  });

  it("excludes current user when checking phone duplicates on edit", () => {
    expect(findDuplicatePhoneNumber(users, "0241234567", "user-1")).toBeNull();
  });

  it("matches search across name, service number, and phone", () => {
    expect(matchesMemberSearch(sampleUser(), "john")).toBe(true);
    expect(matchesMemberSearch(sampleUser(), "13984")).toBe(true);
    expect(matchesMemberSearch(sampleUser(), "024123")).toBe(true);
    expect(matchesMemberSearch(sampleUser(), "missing")).toBe(false);
  });
});

describe("role permissions", () => {
  it("grants admin full member management permissions", () => {
    expect(hasPermission(UserRole.ADMIN, Permission.ADD_MEMBER)).toBe(true);
    expect(hasPermission(UserRole.ADMIN, Permission.EDIT_MEMBER)).toBe(true);
    expect(hasPermission(UserRole.ADMIN, Permission.VIEW_MEMBERS)).toBe(true);
    expect(canManageMembers(UserRole.ADMIN)).toBe(true);
    expect(canViewMembers(UserRole.ADMIN)).toBe(true);
  });

  it("limits treasurer to view-only member access", () => {
    expect(hasPermission(UserRole.TREASURER, Permission.VIEW_MEMBERS)).toBe(true);
    expect(hasPermission(UserRole.TREASURER, Permission.ADD_MEMBER)).toBe(false);
    expect(hasPermission(UserRole.TREASURER, Permission.EDIT_MEMBER)).toBe(false);
    expect(canManageMembers(UserRole.TREASURER)).toBe(false);
    expect(canViewMembers(UserRole.TREASURER)).toBe(true);
  });

  it("denies member access to admin member routes", () => {
    expect(canViewMembers(UserRole.MEMBER)).toBe(false);
    expect(canManageMembers(UserRole.MEMBER)).toBe(false);
  });
});

describe("member creation defaults", () => {
  it("applies pending activation and zero profile completion defaults", () => {
    const document = buildNewMemberDocument("member-1", {
      serviceNumber: "IS/13986",
      serviceNumberSuffix: "13986",
      fullName: "Jane Doe",
      phoneNumber: "0241111111",
      dateOfBirth: new Date("1990-01-01"),
      rank: "Constable",
      station: "Tema",
      role: UserRole.MEMBER,
      createdBy: "admin-1",
    });

    expect(document.status).toBe(UserStatus.ACTIVE);
    expect(document.activationStatus).toBe(ActivationStatus.PENDING);
    expect(document.profileCompleted).toBe(NEW_MEMBER_DEFAULTS.profileCompleted);
    expect(document.profileCompletionPercentage).toBe(
      NEW_MEMBER_DEFAULTS.profileCompletionPercentage,
    );
    expect(document.otpAttempts).toBe(0);
    expect(document.activationOtpSentCount).toBe(0);
    expect(document.serviceNumber).toBe("IS/13986");
  });

  it("stores optional contact fields as null when omitted", () => {
    const document = buildNewMemberDocument("member-1", {
      serviceNumber: "IS/13986",
      serviceNumberSuffix: "13986",
      fullName: "Jane Doe",
      phoneNumber: "0241111111",
      dateOfBirth: null,
      role: UserRole.MEMBER,
      createdBy: "admin-1",
    });

    expect(document.nextOfKin).toBeNull();
    expect(document.emergencyContact).toBeNull();
    expect(document.rank).toBeNull();
    expect(document.station).toBeNull();
    expect(document.gender).toBeNull();
    expect(document.dateOfBirth).toBeNull();
    expect(document.profileCompletionPercentage).toBe(0);
  });

  it("stores gender when provided on create", () => {
    const document = buildNewMemberDocument("member-1", {
      serviceNumber: "IS/13986",
      serviceNumberSuffix: "13986",
      fullName: "Jane Doe",
      phoneNumber: "0241111111",
      dateOfBirth: null,
      gender: "female",
      role: UserRole.MEMBER,
      createdBy: "admin-1",
    });

    expect(document.gender).toBe("female");
  });
});

describe("create member validation", () => {
  it("requires only full name, service number suffix, and phone number", () => {
    const result = createMemberSchema.safeParse({
      serviceNumberSuffix: "13986",
      fullName: "Jane Doe",
      phoneNumber: "0241111111",
      role: UserRole.MEMBER,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.dateOfBirth).toBeUndefined();
      expect(result.data.rank).toBeUndefined();
      expect(result.data.station).toBeUndefined();
    }
  });

  it("rejects invalid optional date of birth", () => {
    const result = createMemberSchema.safeParse({
      serviceNumberSuffix: "13986",
      fullName: "Jane Doe",
      phoneNumber: "0241111111",
      dateOfBirth: "not-a-date",
    });

    expect(result.success).toBe(false);
  });
});

describe("status and activation enforcement", () => {
  it("blocks login for inactive members", () => {
    const result = validateUserForLogin(
      sampleUser({
        activationStatus: ActivationStatus.ACTIVATED,
        status: UserStatus.INACTIVE,
      }),
    );
    expect(result.valid).toBe(false);
    expect(result.code).toBe("INACTIVE");
  });

  it("blocks login for suspended members", () => {
    const result = validateUserForLogin(
      sampleUser({
        activationStatus: ActivationStatus.ACTIVATED,
        status: UserStatus.SUSPENDED,
      }),
    );
    expect(result.valid).toBe(false);
    expect(result.code).toBe("INACTIVE");
  });

  it("blocks activation for suspended members", () => {
    const result = evaluateActivationEligibility(
      sampleUser({ status: UserStatus.SUSPENDED }),
    );
    expect(result.eligible).toBe(false);
  });
});

describe("audit actions", () => {
  it("defines member management audit event names", () => {
    expect(MemberAuditAction.MEMBER_CREATED).toBe("member_created");
    expect(MemberAuditAction.MEMBER_UPDATED).toBe("member_updated");
    expect(MemberAuditAction.ACTIVATION_RESET).toBe("activation_reset");
    expect(MemberAuditAction.STATUS_CHANGED).toBe("status_changed");
    expect(MemberAuditAction.ROLE_CHANGED).toBe("role_changed");
  });
});

describe("activation reset expectations", () => {
  it("documents reset profile completion baseline", () => {
    expect(NEW_MEMBER_DEFAULTS.profileCompleted).toBe(false);
    expect(NEW_MEMBER_DEFAULTS.profileCompletionPercentage).toBe(0);
    expect(NEW_MEMBER_DEFAULTS.activationStatus).toBe(ActivationStatus.PENDING);
  });
});
