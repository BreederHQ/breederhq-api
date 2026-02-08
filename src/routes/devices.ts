// src/routes/devices.ts
// Device registration endpoints for push notifications
// All endpoints require Bearer token authentication
// Endpoints:
//   POST   /register   → Register device for push notifications
//   DELETE /:token     → Unregister a specific device
//   DELETE /all        → Unregister all devices for current user

import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { bearerAuth } from "../middleware/bearer-auth.js";
import {
  registerDevice,
  unregisterDevice,
  unregisterAllDevices,
  isFirebaseInitialized,
} from "../services/push.service.js";

export default async function devicesRoutes(
  app: FastifyInstance,
  _opts: FastifyPluginOptions
) {
  // All routes require Bearer token authentication
  app.addHook("preHandler", bearerAuth);

  /**
   * POST /register
   * Register a device for push notifications.
   *
   * Request body:
   *   - token: FCM device token (string)
   *   - platform: 'ios' | 'android'
   *
   * Response:
   *   - deviceId: Database ID of the registered device
   *   - message: Status message
   */
  app.post<{
    Body: { token?: string; platform?: string };
  }>("/register", async (req, reply) => {
    const { token, platform } = req.body || {};

    // Validate token
    if (!token || typeof token !== "string" || token.length < 10) {
      return reply.code(400).send({ error: "Valid FCM token required" });
    }

    // Validate platform
    if (!platform || !["ios", "android"].includes(platform)) {
      return reply.code(400).send({ error: "Platform must be 'ios' or 'android'" });
    }

    if (!req.userId) {
      return reply.code(401).send({ error: "Authentication required" });
    }

    try {
      const device = await registerDevice(
        req.userId,
        token,
        platform as "ios" | "android"
      );

      const pushEnabled = isFirebaseInitialized();

      return reply.send({
        deviceId: device.id,
        message: pushEnabled
          ? "Device registered for push notifications"
          : "Device registered (push notifications not configured on server)",
      });
    } catch (error) {
      req.log.error(error, "Device registration error");
      return reply.code(500).send({ error: "Registration failed" });
    }
  });

  /**
   * DELETE /:token
   * Unregister a specific device by FCM token.
   * Typically called when user logs out from a specific device.
   *
   * URL params:
   *   - token: FCM device token (URL encoded if contains special chars)
   *
   * Response:
   *   - success: true
   */
  app.delete<{
    Params: { token: string };
  }>("/:token", async (req, reply) => {
    const { token } = req.params;

    if (!req.userId) {
      return reply.code(401).send({ error: "Authentication required" });
    }

    if (!token) {
      return reply.code(400).send({ error: "Token parameter required" });
    }

    try {
      await unregisterDevice(req.userId, decodeURIComponent(token));
      return reply.send({ success: true });
    } catch (error) {
      req.log.error(error, "Device unregistration error");
      return reply.code(500).send({ error: "Unregistration failed" });
    }
  });

  /**
   * DELETE /all
   * Unregister all devices for the current user.
   * Typically called when user logs out from all devices.
   *
   * Response:
   *   - success: true
   *   - count: Number of devices removed
   */
  app.delete("/all", async (req, reply) => {
    if (!req.userId) {
      return reply.code(401).send({ error: "Authentication required" });
    }

    try {
      const count = await unregisterAllDevices(req.userId);
      return reply.send({ success: true, count });
    } catch (error) {
      req.log.error(error, "Device unregistration error");
      return reply.code(500).send({ error: "Unregistration failed" });
    }
  });
}
