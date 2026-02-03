// ─────────────────────────────────────────────────────────────
// WATERMARK TYPE DEFINITIONS
// ─────────────────────────────────────────────────────────────

export type WatermarkPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "middle-left"
  | "center"
  | "middle-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

export type PdfWatermarkPosition = "diagonal" | "header" | "footer";
export type WatermarkType = "text" | "logo" | "both";
export type WatermarkSize = "small" | "medium" | "large";

export type ImageWatermarkSettings = {
  type: WatermarkType;
  text?: string;
  logoStorageKey?: string;
  position: WatermarkPosition;
  opacity: number; // 0.1 - 1.0
  size: WatermarkSize;
};

export type PdfWatermarkSettings = {
  type: WatermarkType;
  text?: string;
  logoStorageKey?: string;
  position: PdfWatermarkPosition;
  opacity: number;
};

export type WatermarkSettings = {
  enabled: boolean;
  imageWatermark: ImageWatermarkSettings;
  pdfWatermark: PdfWatermarkSettings;
};

export type MediaAccessType = "VIEW" | "DOWNLOAD" | "SHARE";
export type MediaAccessActor = "OWNER" | "BUYER" | "PUBLIC" | "PORTAL";

export type WatermarkOptions = {
  type: WatermarkType;
  text?: string;
  logoBuffer?: Buffer;
  position: WatermarkPosition | PdfWatermarkPosition;
  opacity: number;
  size?: WatermarkSize;
};

export type TrackAccessParams = {
  tenantId: number;
  documentId?: number;
  storageKey: string;
  actorType: MediaAccessActor;
  userId?: string;
  marketplaceUserId?: number;
  partyId?: number;
  accessType: MediaAccessType;
  watermarked: boolean;
  watermarkHash?: string;
};

export type AccessLogFilters = {
  documentId?: number;
  storageKey?: string;
  startDate?: Date;
  endDate?: Date;
  actorType?: MediaAccessActor;
  accessType?: MediaAccessType;
  page?: number;
  limit?: number;
};
