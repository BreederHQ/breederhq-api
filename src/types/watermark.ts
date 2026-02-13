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
export type WatermarkPattern = "positions" | "tiled";

export type ImageWatermarkSettings = {
  type: WatermarkType;
  text?: string;
  logoStorageKey?: string;
  position: WatermarkPosition; // Legacy - kept for backwards compatibility
  positions?: WatermarkPosition[]; // Selected positions (1 or more)
  opacity: number; // 0.1 - 1.0
  size: WatermarkSize;
  pattern?: WatermarkPattern; // "positions" (default) or "tiled" (full coverage)
};

export type PdfWatermarkSettings = {
  type: WatermarkType;
  text?: string;
  logoStorageKey?: string;
  position: PdfWatermarkPosition;
  opacity: number;
};

// ─────────────────────────────────────────────────────────────
// Public Image Watermarking Types
// ─────────────────────────────────────────────────────────────

export type PublicImageSizeThreshold = "none" | "small" | "medium" | "large";

export type PublicImageType =
  | "animalProfile"
  | "breedingProgramCover"
  | "breedingProgramGallery"
  | "offspringGroupCover"
  | "serviceListingBanner"
  | "serviceGallery"
  | "breederBanner"
  | "breederLogo";

export type PublicImageTypes = {
  animalProfile: boolean;
  breedingProgramCover: boolean;
  breedingProgramGallery: boolean;
  offspringGroupCover: boolean;
  serviceListingBanner: boolean;
  serviceGallery: boolean;
  breederBanner: boolean;
  breederLogo: boolean;
};

export type PublicImageWatermarkSettings = {
  enabled: boolean;
  imageTypes: PublicImageTypes;
  minSizeToWatermark: PublicImageSizeThreshold;
  overrideSettings?: Partial<ImageWatermarkSettings>;
};

export const DEFAULT_PUBLIC_IMAGE_SETTINGS: PublicImageWatermarkSettings = {
  enabled: false,
  imageTypes: {
    animalProfile: true,
    breedingProgramCover: true,
    breedingProgramGallery: true,
    offspringGroupCover: true,
    serviceListingBanner: false,
    serviceGallery: false,
    breederBanner: false,
    breederLogo: false,
  },
  minSizeToWatermark: "medium",
};

export type WatermarkSettings = {
  enabled: boolean;
  imageWatermark: ImageWatermarkSettings;
  pdfWatermark: PdfWatermarkSettings;
  publicImages?: PublicImageWatermarkSettings;
};

export type MediaAccessType = "VIEW" | "DOWNLOAD" | "SHARE";
export type MediaAccessActor = "OWNER" | "BUYER" | "PUBLIC" | "PORTAL";

export type WatermarkOptions = {
  type: WatermarkType;
  text?: string;
  logoBuffer?: Buffer;
  position: WatermarkPosition | PdfWatermarkPosition;
  positions?: WatermarkPosition[]; // For "multi" pattern
  opacity: number;
  size?: WatermarkSize;
  pattern?: WatermarkPattern;
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
