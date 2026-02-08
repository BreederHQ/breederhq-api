// src/services/push.service.ts
// Firebase Cloud Messaging (FCM) push notification service
// Handles device registration and push notification delivery

import admin from "firebase-admin";
import prisma from "../prisma.js";

// Track initialization state
let firebaseInitialized = false;

/**
 * Initialize Firebase Admin SDK.
 * Call once at app startup. Safe to call multiple times.
 */
export function initFirebase(): boolean {
  if (firebaseInitialized) {
    return true;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  // Only initialize if all required credentials are present
  if (!projectId || !clientEmail || !privateKey) {
    console.log(
      "Firebase not configured - push notifications disabled. " +
        "Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY to enable."
    );
    return false;
  }

  try {
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          // Handle escaped newlines in environment variable
          privateKey: privateKey.replace(/\\n/g, "\n"),
        }),
      });
    }
    firebaseInitialized = true;
    console.log("Firebase Admin SDK initialized successfully");
    return true;
  } catch (error) {
    console.error("Failed to initialize Firebase Admin SDK:", error);
    return false;
  }
}

/**
 * Check if Firebase is initialized and ready.
 */
export function isFirebaseInitialized(): boolean {
  return firebaseInitialized;
}

/**
 * Register a device for push notifications.
 * Creates or updates the device record.
 */
export async function registerDevice(
  userId: string,
  fcmToken: string,
  platform: "ios" | "android"
): Promise<{ id: number }> {
  return prisma.device.upsert({
    where: {
      userId_fcmToken: { userId, fcmToken },
    },
    update: {
      platform,
      updatedAt: new Date(),
    },
    create: {
      userId,
      fcmToken,
      platform,
    },
    select: {
      id: true,
    },
  });
}

/**
 * Unregister a device (remove push token).
 */
export async function unregisterDevice(
  userId: string,
  fcmToken: string
): Promise<void> {
  await prisma.device.deleteMany({
    where: { userId, fcmToken },
  });
}

/**
 * Unregister all devices for a user.
 * Useful for logout from all devices.
 */
export async function unregisterAllDevices(userId: string): Promise<number> {
  const result = await prisma.device.deleteMany({
    where: { userId },
  });
  return result.count;
}

/**
 * Send a push notification to all devices for a user.
 * Silently handles errors and removes invalid tokens.
 */
export async function sendPushToUser(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<{
  successCount: number;
  failureCount: number;
}> {
  if (!firebaseInitialized) {
    return { successCount: 0, failureCount: 0 };
  }

  const devices = await prisma.device.findMany({
    where: { userId },
    select: { id: true, fcmToken: true },
  });

  if (devices.length === 0) {
    return { successCount: 0, failureCount: 0 };
  }

  const tokens = devices.map((d) => d.fcmToken);

  try {
    const response = await admin.messaging().sendEachForMulticast({
      tokens,
      notification: { title, body },
      data,
      // iOS-specific settings
      apns: {
        payload: {
          aps: {
            sound: "default",
            badge: 1,
          },
        },
      },
      // Android-specific settings
      android: {
        priority: "high",
        notification: {
          sound: "default",
          channelId: "default",
        },
      },
    });

    // Handle failed tokens (remove invalid ones)
    const failedTokenIds: number[] = [];
    response.responses.forEach((resp, idx) => {
      if (!resp.success) {
        const error = resp.error;
        // Remove tokens that are invalid or unregistered
        if (
          error?.code === "messaging/invalid-registration-token" ||
          error?.code === "messaging/registration-token-not-registered"
        ) {
          failedTokenIds.push(devices[idx].id);
        }
      }
    });

    // Clean up invalid tokens
    if (failedTokenIds.length > 0) {
      await prisma.device.deleteMany({
        where: { id: { in: failedTokenIds } },
      });
    }

    return {
      successCount: response.successCount,
      failureCount: response.failureCount,
    };
  } catch (error) {
    console.error("Push notification error:", error);
    return { successCount: 0, failureCount: devices.length };
  }
}

/**
 * Send a push notification to multiple users.
 * Useful for broadcasting to a group.
 */
export async function sendPushToUsers(
  userIds: string[],
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<{
  successCount: number;
  failureCount: number;
}> {
  if (!firebaseInitialized || userIds.length === 0) {
    return { successCount: 0, failureCount: 0 };
  }

  const devices = await prisma.device.findMany({
    where: { userId: { in: userIds } },
    select: { id: true, fcmToken: true },
  });

  if (devices.length === 0) {
    return { successCount: 0, failureCount: 0 };
  }

  // FCM has a limit of 500 tokens per batch
  const BATCH_SIZE = 500;
  let totalSuccess = 0;
  let totalFailure = 0;

  for (let i = 0; i < devices.length; i += BATCH_SIZE) {
    const batch = devices.slice(i, i + BATCH_SIZE);
    const tokens = batch.map((d) => d.fcmToken);

    try {
      const response = await admin.messaging().sendEachForMulticast({
        tokens,
        notification: { title, body },
        data,
        apns: {
          payload: {
            aps: {
              sound: "default",
              badge: 1,
            },
          },
        },
        android: {
          priority: "high",
          notification: {
            sound: "default",
            channelId: "default",
          },
        },
      });

      totalSuccess += response.successCount;
      totalFailure += response.failureCount;

      // Clean up invalid tokens
      const failedTokenIds: number[] = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const error = resp.error;
          if (
            error?.code === "messaging/invalid-registration-token" ||
            error?.code === "messaging/registration-token-not-registered"
          ) {
            failedTokenIds.push(batch[idx].id);
          }
        }
      });

      if (failedTokenIds.length > 0) {
        await prisma.device.deleteMany({
          where: { id: { in: failedTokenIds } },
        });
      }
    } catch (error) {
      console.error("Push notification batch error:", error);
      totalFailure += batch.length;
    }
  }

  return {
    successCount: totalSuccess,
    failureCount: totalFailure,
  };
}

/**
 * Send a silent data-only push to trigger background sync.
 * Useful for notifying the app of data changes.
 */
export async function sendDataPush(
  userId: string,
  data: Record<string, string>
): Promise<boolean> {
  if (!firebaseInitialized) {
    return false;
  }

  const devices = await prisma.device.findMany({
    where: { userId },
    select: { fcmToken: true },
  });

  if (devices.length === 0) {
    return false;
  }

  try {
    await admin.messaging().sendEachForMulticast({
      tokens: devices.map((d) => d.fcmToken),
      data,
      // Content-available for iOS background fetch
      apns: {
        payload: {
          aps: {
            "content-available": 1,
          },
        },
      },
      // High priority for Android to wake app
      android: {
        priority: "high",
      },
    });
    return true;
  } catch (error) {
    console.error("Data push error:", error);
    return false;
  }
}
