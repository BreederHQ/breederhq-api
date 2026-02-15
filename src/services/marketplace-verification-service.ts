// src/services/marketplace-verification-service.ts
/**
 * Marketplace Verification Service
 *
 * Handles verification operations for breeders and service providers:
 * - Phone verification (SMS OTP)
 * - Identity verification (Stripe Identity)
 * - Verification tier management
 * - Paid package processing
 */

import { createHash, randomBytes } from "node:crypto";
import Stripe from "stripe";
import prisma from "../prisma.js";
import type {
  MarketplaceUser,
  MarketplaceProvider,
  VerificationRequest,
  BreederVerificationTier,
  ServiceProviderVerificationTier,
  VerificationRequestStatus,
  TwoFactorMethod,
} from "@prisma/client";

// Initialize Stripe (only if API key is configured)
const stripeKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeKey ? new Stripe(stripeKey, { apiVersion: "2026-01-28.clover" }) : null;

// ---------- Token Utilities ----------

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function sha256b64url(input: string | Buffer): string {
  return b64url(createHash("sha256").update(input).digest());
}

function newRawToken(): string {
  return b64url(randomBytes(32));
}

// ---------- Types ----------

export type PhoneVerificationResult =
  | { success: true; code?: string; expiresAt: Date }
  | { success: false; error: string };

export type VerificationStatusResult = {
  tier: BreederVerificationTier | ServiceProviderVerificationTier | null;
  tierAchievedAt: Date | null;
  phoneVerified: boolean;
  phoneVerifiedAt: Date | null;
  identityVerified: boolean;
  identityVerifiedAt: Date | null;
  verifiedPackage: {
    active: boolean;
    purchasedAt: Date | null;
    approvedAt: Date | null;
    expiresAt: Date | null;
  };
  accreditedPackage: {
    active: boolean;
    purchasedAt: Date | null;
    approvedAt: Date | null;
    expiresAt: Date | null;
  };
  badges: {
    quickResponder: boolean;
    established: boolean;
    topRated: boolean;
    trusted: boolean;
    acceptsPayments?: boolean;
  };
};

// ---------- Phone Verification (for Breeders/Providers) ----------

/**
 * Send phone verification code to a provider
 * NOTE: SMS sending is not yet configured - returns error
 */
export async function sendProviderPhoneVerification(
  _providerId: number,
  _phoneNumber: string
): Promise<PhoneVerificationResult> {
  // SMS verification is not yet configured
  // When ready, integrate Twilio or AWS SNS here
  return {
    success: false,
    error: "sms_not_configured",
  };
}

/**
 * Verify phone code for a provider
 */
export async function verifyProviderPhoneCode(
  providerId: number,
  code: string
): Promise<{ success: boolean; error?: string }> {
  const hash = sha256b64url(code);

  const provider = await prisma.marketplaceProvider.findFirst({
    where: {
      id: providerId,
      phoneVerificationToken: hash,
      phoneVerificationTokenExpires: { gt: new Date() },
    },
  });

  if (!provider) {
    return { success: false, error: "invalid_or_expired_code" };
  }

  // Mark phone as verified and upgrade tier if needed
  const newTier = provider.verificationTier === "SUBSCRIBER"
    ? "MARKETPLACE_ENABLED" as BreederVerificationTier
    : provider.verificationTier;

  await prisma.marketplaceProvider.update({
    where: { id: providerId },
    data: {
      phoneVerifiedAt: new Date(),
      phoneVerificationToken: null,
      phoneVerificationTokenExpires: null,
      verificationTier: newTier,
      verificationTierAchievedAt: provider.verificationTier === "SUBSCRIBER" ? new Date() : provider.verificationTierAchievedAt,
    },
  });

  return { success: true };
}

// ---------- SMS Verification (for Marketplace Users / Service Providers) ----------

/**
 * Send SMS verification code to a marketplace user (for 2FA setup)
 * NOTE: SMS sending is not yet configured - returns error
 */
export async function sendUserSMSVerification(
  _userId: number,
  _phoneNumber: string
): Promise<PhoneVerificationResult> {
  // SMS verification is not yet configured
  // When ready, integrate Twilio or AWS SNS here
  return {
    success: false,
    error: "sms_not_configured",
  };
}

/**
 * Verify SMS code for a marketplace user
 */
export async function verifyUserSMSCode(
  userId: number,
  code: string
): Promise<{ success: boolean; error?: string }> {
  const hash = sha256b64url(code);

  const user = await prisma.marketplaceUser.findFirst({
    where: {
      id: userId,
      smsVerificationToken: hash,
      smsVerificationTokenExpires: { gt: new Date() },
    },
  });

  if (!user) {
    return { success: false, error: "invalid_or_expired_code" };
  }

  await prisma.marketplaceUser.update({
    where: { id: userId },
    data: {
      smsVerifiedAt: new Date(),
      smsVerificationToken: null,
      smsVerificationTokenExpires: null,
      twoFactorEnabled: true,
      twoFactorMethod: "SMS",
      twoFactorEnabledAt: new Date(),
    },
  });

  return { success: true };
}

// ---------- TOTP (Authenticator App) ----------

import { generateSecret, generateURI, verifySync as verifyTOTPSync } from "otplib";

/**
 * Generate TOTP secret for a user
 */
export async function generateTOTPSecret(userId: number): Promise<{
  secret: string;
  otpauthUrl: string;
}> {
  const secret = generateSecret();

  // Get user email for the TOTP URI
  const user = await prisma.marketplaceUser.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  if (!user) {
    throw new Error("User not found");
  }

  // Store secret (not yet verified)
  await prisma.marketplaceUser.update({
    where: { id: userId },
    data: { totpSecret: secret },
  });

  const otpauthUrl = generateURI({
    issuer: "BreederHQ",
    label: user.email,
    secret,
    algorithm: "sha1",
    digits: 6,
    period: 30,
  });

  return { secret, otpauthUrl };
}

/**
 * Verify TOTP code and enable 2FA
 */
export async function verifyAndEnableTOTP(
  userId: number,
  code: string
): Promise<{ success: boolean; error?: string }> {
  const user = await prisma.marketplaceUser.findUnique({
    where: { id: userId },
    select: { totpSecret: true },
  });

  if (!user?.totpSecret) {
    return { success: false, error: "totp_not_setup" };
  }

  const isValid = verifyTOTPSync({ token: code, secret: user.totpSecret }).valid;

  if (!isValid) {
    return { success: false, error: "invalid_code" };
  }

  await prisma.marketplaceUser.update({
    where: { id: userId },
    data: {
      totpVerifiedAt: new Date(),
      twoFactorEnabled: true,
      twoFactorMethod: "TOTP",
      twoFactorEnabledAt: new Date(),
    },
  });

  return { success: true };
}

/**
 * Verify TOTP code (for login challenge)
 */
export async function verifyTOTPCode(
  userId: number,
  code: string
): Promise<boolean> {
  const user = await prisma.marketplaceUser.findUnique({
    where: { id: userId },
    select: { totpSecret: true, twoFactorEnabled: true, twoFactorMethod: true },
  });

  if (!user?.totpSecret || !user.twoFactorEnabled || user.twoFactorMethod !== "TOTP") {
    return false;
  }

  return verifyTOTPSync({ token: code, secret: user.totpSecret }).valid;
}

// ---------- Provider Verification Status ----------

/**
 * Get verification status for a provider (breeder)
 */
export async function getProviderVerificationStatus(
  providerId: number
): Promise<VerificationStatusResult | null> {
  const provider = await prisma.marketplaceProvider.findUnique({
    where: { id: providerId },
    select: {
      verificationTier: true,
      verificationTierAchievedAt: true,
      phoneVerifiedAt: true,
      identityVerifiedAt: true,
      verifiedPackagePurchasedAt: true,
      verifiedPackageApprovedAt: true,
      verifiedPackageExpiresAt: true,
      accreditedPackagePurchasedAt: true,
      accreditedPackageApprovedAt: true,
      accreditedPackageExpiresAt: true,
      quickResponder: true,
      establishedBadge: true,
      topRatedBadge: true,
      trustedBadge: true,
    },
  });

  if (!provider) return null;

  const now = new Date();

  return {
    tier: provider.verificationTier,
    tierAchievedAt: provider.verificationTierAchievedAt,
    phoneVerified: !!provider.phoneVerifiedAt,
    phoneVerifiedAt: provider.phoneVerifiedAt,
    identityVerified: !!provider.identityVerifiedAt,
    identityVerifiedAt: provider.identityVerifiedAt,
    verifiedPackage: {
      active: !!(provider.verifiedPackageApprovedAt &&
        (!provider.verifiedPackageExpiresAt || provider.verifiedPackageExpiresAt > now)),
      purchasedAt: provider.verifiedPackagePurchasedAt,
      approvedAt: provider.verifiedPackageApprovedAt,
      expiresAt: provider.verifiedPackageExpiresAt,
    },
    accreditedPackage: {
      active: !!(provider.accreditedPackageApprovedAt &&
        (!provider.accreditedPackageExpiresAt || provider.accreditedPackageExpiresAt > now)),
      purchasedAt: provider.accreditedPackagePurchasedAt,
      approvedAt: provider.accreditedPackageApprovedAt,
      expiresAt: provider.accreditedPackageExpiresAt,
    },
    badges: {
      quickResponder: provider.quickResponder,
      established: provider.establishedBadge,
      topRated: provider.topRatedBadge,
      trusted: provider.trustedBadge,
    },
  };
}

/**
 * Get verification status for a marketplace user (service provider)
 */
export async function getUserVerificationStatus(
  userId: number
): Promise<VerificationStatusResult | null> {
  const user = await prisma.marketplaceUser.findUnique({
    where: { id: userId },
    select: {
      serviceProviderTier: true,
      serviceProviderTierAchievedAt: true,
      smsVerifiedAt: true,
      totpVerifiedAt: true,
      passkeyCreatedAt: true,
      identityVerifiedAt: true,
      twoFactorEnabled: true,
      twoFactorMethod: true,
      verifiedProfessionalPurchasedAt: true,
      verifiedProfessionalApprovedAt: true,
      verifiedProfessionalExpiresAt: true,
      accreditedProviderPurchasedAt: true,
      accreditedProviderApprovedAt: true,
      accreditedProviderExpiresAt: true,
      quickResponderBadge: true,
      establishedProviderBadge: true,
      topRatedBadge: true,
      trustedProviderBadge: true,
      acceptsPaymentsBadge: true,
    },
  });

  if (!user) return null;

  const now = new Date();

  return {
    tier: user.serviceProviderTier,
    tierAchievedAt: user.serviceProviderTierAchievedAt,
    phoneVerified: !!user.smsVerifiedAt,
    phoneVerifiedAt: user.smsVerifiedAt,
    identityVerified: !!user.identityVerifiedAt,
    identityVerifiedAt: user.identityVerifiedAt,
    verifiedPackage: {
      active: !!(user.verifiedProfessionalApprovedAt &&
        (!user.verifiedProfessionalExpiresAt || user.verifiedProfessionalExpiresAt > now)),
      purchasedAt: user.verifiedProfessionalPurchasedAt,
      approvedAt: user.verifiedProfessionalApprovedAt,
      expiresAt: user.verifiedProfessionalExpiresAt,
    },
    accreditedPackage: {
      active: !!(user.accreditedProviderApprovedAt &&
        (!user.accreditedProviderExpiresAt || user.accreditedProviderExpiresAt > now)),
      purchasedAt: user.accreditedProviderPurchasedAt,
      approvedAt: user.accreditedProviderApprovedAt,
      expiresAt: user.accreditedProviderExpiresAt,
    },
    badges: {
      quickResponder: user.quickResponderBadge,
      established: user.establishedProviderBadge,
      topRated: user.topRatedBadge,
      trusted: user.trustedProviderBadge,
      acceptsPayments: user.acceptsPaymentsBadge,
    },
  };
}

// ---------- Stripe Identity ----------

export type IdentitySessionResult =
  | { success: true; sessionId: string; clientSecret: string }
  | { success: false; error: string };

/**
 * Create Stripe Identity verification session for a provider
 */
export async function createProviderIdentitySession(
  providerId: number
): Promise<IdentitySessionResult> {
  if (!stripe) {
    return {
      success: false,
      error: "stripe_not_configured",
    };
  }

  try {
    // Fetch provider to verify it exists
    const provider = await prisma.marketplaceProvider.findUnique({
      where: { id: providerId },
      select: {
        id: true,
        verificationTier: true,
        stripeIdentitySessionId: true,
        user: {
          select: { id: true, email: true },
        },
      },
    });

    if (!provider) {
      return {
        success: false,
        error: "provider_not_found",
      };
    }

    // Check if already verified
    if (provider.verificationTier === "IDENTITY_VERIFIED") {
      return {
        success: false,
        error: "already_verified",
      };
    }

    // Create Stripe Identity verification session
    const verificationSession = await stripe.identity.verificationSessions.create({
      type: "document",
      metadata: {
        entityType: "provider",
        providerId: providerId.toString(),
        userId: provider.user.id,
      },
      options: {
        document: {
          allowed_types: ["driving_license", "passport", "id_card"],
          require_id_number: false,
          require_live_capture: true,
          require_matching_selfie: true,
        },
      },
    });

    // Store session ID in provider record
    await prisma.marketplaceProvider.update({
      where: { id: providerId },
      data: {
        stripeIdentitySessionId: verificationSession.id,
        stripeIdentityStatus: "pending",
      },
    });

    return {
      success: true,
      sessionId: verificationSession.id,
      clientSecret: verificationSession.client_secret!,
    };
  } catch (error: any) {
    console.error("[createProviderIdentitySession] Error:", error);
    return {
      success: false,
      error: error.message || "identity_session_failed",
    };
  }
}

/**
 * Handle Stripe Identity webhook result for a provider
 */
export async function handleProviderIdentityResult(
  sessionId: string,
  status: "verified" | "failed"
): Promise<boolean> {
  const provider = await prisma.marketplaceProvider.findFirst({
    where: { stripeIdentitySessionId: sessionId },
  });

  if (!provider) return false;

  if (status === "verified") {
    // Upgrade to IDENTITY_VERIFIED tier if currently at MARKETPLACE_ENABLED
    const newTier = provider.verificationTier === "MARKETPLACE_ENABLED"
      ? "IDENTITY_VERIFIED" as BreederVerificationTier
      : provider.verificationTier;

    await prisma.marketplaceProvider.update({
      where: { id: provider.id },
      data: {
        stripeIdentityStatus: "verified",
        identityVerifiedAt: new Date(),
        verificationTier: newTier,
        verificationTierAchievedAt: provider.verificationTier === "MARKETPLACE_ENABLED" ? new Date() : provider.verificationTierAchievedAt,
      },
    });
  } else {
    await prisma.marketplaceProvider.update({
      where: { id: provider.id },
      data: {
        stripeIdentityStatus: "failed",
      },
    });
  }

  return true;
}

/**
 * Create Stripe Identity verification session for a marketplace user
 */
export async function createUserIdentitySession(
  userId: number
): Promise<IdentitySessionResult> {
  if (!stripe) {
    return {
      success: false,
      error: "stripe_not_configured",
    };
  }

  try {
    // Fetch user to verify it exists
    const user = await prisma.marketplaceUser.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        serviceProviderTier: true,
        stripeIdentitySessionId: true,
      },
    });

    if (!user) {
      return {
        success: false,
        error: "user_not_found",
      };
    }

    // Check if already verified at identity level
    if (user.serviceProviderTier === "IDENTITY_VERIFIED" ||
        user.serviceProviderTier === "VERIFIED_PROFESSIONAL" ||
        user.serviceProviderTier === "ACCREDITED_PROVIDER") {
      return {
        success: false,
        error: "already_verified",
      };
    }

    // Create Stripe Identity verification session
    const verificationSession = await stripe.identity.verificationSessions.create({
      type: "document",
      metadata: {
        entityType: "marketplace_user",
        marketplaceUserId: userId.toString(),
      },
      options: {
        document: {
          allowed_types: ["driving_license", "passport", "id_card"],
          require_id_number: false,
          require_live_capture: true,
          require_matching_selfie: true,
        },
      },
    });

    // Store session ID in user record
    await prisma.marketplaceUser.update({
      where: { id: userId },
      data: {
        stripeIdentitySessionId: verificationSession.id,
        stripeIdentityStatus: "pending",
      },
    });

    return {
      success: true,
      sessionId: verificationSession.id,
      clientSecret: verificationSession.client_secret!,
    };
  } catch (error: any) {
    console.error("[createUserIdentitySession] Error:", error);
    return {
      success: false,
      error: error.message || "identity_session_failed",
    };
  }
}

/**
 * Handle Stripe Identity webhook result for a marketplace user
 */
export async function handleUserIdentityResult(
  sessionId: string,
  status: "verified" | "failed"
): Promise<boolean> {
  const user = await prisma.marketplaceUser.findFirst({
    where: { stripeIdentitySessionId: sessionId },
  });

  if (!user) return false;

  if (status === "verified") {
    // Upgrade to IDENTITY_VERIFIED tier if currently at LISTED
    const currentTier = user.serviceProviderTier;
    const newTier = currentTier === "LISTED"
      ? "IDENTITY_VERIFIED" as ServiceProviderVerificationTier
      : currentTier;

    await prisma.marketplaceUser.update({
      where: { id: user.id },
      data: {
        stripeIdentityStatus: "verified",
        identityVerifiedAt: new Date(),
        serviceProviderTier: newTier,
        serviceProviderTierAchievedAt: currentTier === "LISTED" ? new Date() : user.serviceProviderTierAchievedAt,
      },
    });
  } else {
    await prisma.marketplaceUser.update({
      where: { id: user.id },
      data: {
        stripeIdentityStatus: "failed",
      },
    });
  }

  return true;
}

// ---------- Verification Requests (Admin Queue) ----------

export type CreateVerificationRequestInput = {
  userType: "BREEDER" | "SERVICE_PROVIDER";
  providerId?: number;
  marketplaceUserId?: number;
  packageType: "VERIFIED" | "ACCREDITED";
  submittedInfo: Record<string, unknown>;
  paymentIntentId?: string;
  amountPaidCents?: number;
};

/**
 * Create a verification request (after payment)
 */
export async function createVerificationRequest(
  input: CreateVerificationRequestInput
): Promise<VerificationRequest> {
  const requestedTier = input.userType === "BREEDER"
    ? (input.packageType === "VERIFIED" ? "VERIFIED" : "ACCREDITED")
    : (input.packageType === "VERIFIED" ? "VERIFIED_PROFESSIONAL" : "ACCREDITED_PROVIDER");

  const request = await prisma.verificationRequest.create({
    data: {
      userType: input.userType,
      providerId: input.providerId,
      marketplaceUserId: input.marketplaceUserId,
      packageType: input.packageType,
      requestedTier,
      status: "PENDING",
      submittedInfo: input.submittedInfo as Record<string, unknown> & object,
      paymentIntentId: input.paymentIntentId,
      amountPaidCents: input.amountPaidCents,
    },
  });

  // Update the provider/user to mark package as purchased
  if (input.userType === "BREEDER" && input.providerId) {
    const updateData = input.packageType === "VERIFIED"
      ? { verifiedPackagePurchasedAt: new Date() }
      : { accreditedPackagePurchasedAt: new Date() };

    await prisma.marketplaceProvider.update({
      where: { id: input.providerId },
      data: updateData,
    });
  } else if (input.userType === "SERVICE_PROVIDER" && input.marketplaceUserId) {
    const updateData = input.packageType === "VERIFIED"
      ? { verifiedProfessionalPurchasedAt: new Date() }
      : { accreditedProviderPurchasedAt: new Date() };

    await prisma.marketplaceUser.update({
      where: { id: input.marketplaceUserId },
      data: updateData,
    });
  }

  return request;
}

/**
 * Get verification requests (for admin queue)
 */
export async function getVerificationRequests(options: {
  status?: VerificationRequestStatus;
  userType?: "BREEDER" | "SERVICE_PROVIDER";
  limit?: number;
  offset?: number;
}): Promise<{ requests: VerificationRequest[]; total: number }> {
  const where: Record<string, unknown> = {};

  if (options.status) {
    where.status = options.status;
  }
  if (options.userType) {
    where.userType = options.userType;
  }

  const [requests, total] = await Promise.all([
    prisma.verificationRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: options.limit || 50,
      skip: options.offset || 0,
      include: {
        provider: {
          select: {
            id: true,
            businessName: true,
            publicEmail: true,
            user: { select: { email: true, firstName: true, lastName: true } },
          },
        },
        marketplaceUser: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    }),
    prisma.verificationRequest.count({ where }),
  ]);

  return { requests, total };
}

/**
 * Get single verification request by ID
 */
export async function getVerificationRequestById(
  id: number
): Promise<VerificationRequest | null> {
  return prisma.verificationRequest.findUnique({
    where: { id },
    include: {
      provider: {
        select: {
          id: true,
          businessName: true,
          publicEmail: true,
          publicPhone: true,
          verificationTier: true,
          user: { select: { email: true, firstName: true, lastName: true } },
        },
      },
      marketplaceUser: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          serviceProviderTier: true,
        },
      },
    },
  });
}

/**
 * Update verification request status (admin action)
 */
export async function updateVerificationRequestStatus(
  id: number,
  status: VerificationRequestStatus,
  adminUserId: number,
  notes?: string
): Promise<VerificationRequest | null> {
  const request = await prisma.verificationRequest.findUnique({
    where: { id },
  });

  if (!request) return null;

  const updateData: Record<string, unknown> = {
    status,
    reviewedAt: new Date(),
    reviewedBy: adminUserId,
  };

  if (notes) {
    updateData.reviewNotes = notes;
  }

  const updated = await prisma.verificationRequest.update({
    where: { id },
    data: updateData,
  });

  // If approved, update the provider/user tier and package dates
  if (status === "APPROVED") {
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1); // 1 year expiration

    if (request.userType === "BREEDER" && request.providerId) {
      const tier = request.packageType === "VERIFIED" ? "VERIFIED" : "ACCREDITED";
      const packageData = request.packageType === "VERIFIED"
        ? {
            verifiedPackageApprovedAt: new Date(),
            verifiedPackageApprovedBy: adminUserId,
            verifiedPackageExpiresAt: expiresAt,
          }
        : {
            accreditedPackageApprovedAt: new Date(),
            accreditedPackageApprovedBy: adminUserId,
            accreditedPackageExpiresAt: expiresAt,
          };

      await prisma.marketplaceProvider.update({
        where: { id: request.providerId },
        data: {
          verificationTier: tier as BreederVerificationTier,
          verificationTierAchievedAt: new Date(),
          ...packageData,
        },
      });
    } else if (request.userType === "SERVICE_PROVIDER" && request.marketplaceUserId) {
      const tier = request.packageType === "VERIFIED" ? "VERIFIED_PROFESSIONAL" : "ACCREDITED_PROVIDER";
      const packageData = request.packageType === "VERIFIED"
        ? {
            verifiedProfessionalApprovedAt: new Date(),
            verifiedProfessionalApprovedBy: adminUserId,
            verifiedProfessionalExpiresAt: expiresAt,
          }
        : {
            accreditedProviderApprovedAt: new Date(),
            accreditedProviderApprovedBy: adminUserId,
            accreditedProviderExpiresAt: expiresAt,
          };

      await prisma.marketplaceUser.update({
        where: { id: request.marketplaceUserId },
        data: {
          serviceProviderTier: tier as ServiceProviderVerificationTier,
          serviceProviderTierAchievedAt: new Date(),
          ...packageData,
        },
      });
    }
  }

  return updated;
}

/**
 * Request more info from user
 */
export async function requestMoreInfo(
  id: number,
  adminUserId: number,
  note: string
): Promise<VerificationRequest | null> {
  return prisma.verificationRequest.update({
    where: { id },
    data: {
      status: "NEEDS_INFO",
      infoRequestedAt: new Date(),
      infoRequestNote: note,
      reviewedBy: adminUserId,
    },
  });
}

/**
 * User provides requested info
 */
export async function provideRequestedInfo(
  id: number,
  additionalInfo: Record<string, unknown>
): Promise<VerificationRequest | null> {
  const request = await prisma.verificationRequest.findUnique({
    where: { id },
  });

  if (!request) return null;

  const existingInfo = (request.submittedInfo as Record<string, unknown>) || {};
  const mergedInfo = { ...existingInfo, ...additionalInfo, infoProvidedAt: new Date().toISOString() };

  return prisma.verificationRequest.update({
    where: { id },
    data: {
      status: "PENDING",
      submittedInfo: mergedInfo,
      infoProvidedAt: new Date(),
    },
  });
}

// ---------- 2FA Status Check ----------

/**
 * Check if user has 2FA enabled and what method
 */
export async function getUserTwoFactorStatus(userId: number): Promise<{
  enabled: boolean;
  method: TwoFactorMethod | null;
  enabledAt: Date | null;
  availableMethods: {
    passkey: boolean;
    totp: boolean;
    sms: boolean;
  };
} | null> {
  const user = await prisma.marketplaceUser.findUnique({
    where: { id: userId },
    select: {
      twoFactorEnabled: true,
      twoFactorMethod: true,
      twoFactorEnabledAt: true,
      passkeyCredentialId: true,
      totpSecret: true,
      smsVerifiedAt: true,
    },
  });

  if (!user) return null;

  return {
    enabled: user.twoFactorEnabled,
    method: user.twoFactorMethod,
    enabledAt: user.twoFactorEnabledAt,
    availableMethods: {
      passkey: !!user.passkeyCredentialId,
      totp: !!user.totpSecret,
      sms: !!user.smsVerifiedAt,
    },
  };
}

/**
 * Disable 2FA for a user
 */
export async function disableUserTwoFactor(userId: number): Promise<boolean> {
  await prisma.marketplaceUser.update({
    where: { id: userId },
    data: {
      twoFactorEnabled: false,
      twoFactorMethod: null,
      twoFactorEnabledAt: null,
      // Keep the secrets/credentials in case they want to re-enable
    },
  });

  return true;
}

// ---------- Service Provider Tier Management ----------

/**
 * Check if user has 2FA enabled and set their tier to LISTED
 */
export async function checkAndSetServiceProviderTier(userId: number): Promise<boolean> {
  const user = await prisma.marketplaceUser.findUnique({
    where: { id: userId },
    select: {
      twoFactorEnabled: true,
      serviceProviderTier: true,
    },
  });

  if (!user) return false;

  // If 2FA is enabled and no tier set, set to LISTED
  if (user.twoFactorEnabled && !user.serviceProviderTier) {
    await prisma.marketplaceUser.update({
      where: { id: userId },
      data: {
        serviceProviderTier: "LISTED",
        serviceProviderTierAchievedAt: new Date(),
      },
    });
    return true;
  }

  return false;
}
