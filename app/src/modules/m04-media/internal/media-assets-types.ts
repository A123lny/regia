// M04 — Types media asset (RF-4.1).

export type MediaAssetContentType = "image/png" | "image/jpeg" | "image/webp" | "image/svg+xml";

export type MediaAsset = {
  id: string;
  organizationId: string;
  brandId: string;
  storagePath: string;
  signedUrl: string;
  contentType: MediaAssetContentType;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  tags: string[];
  caption: string;
  uploadedAt: string;
  uploadedBy: string | null;
};

export type UploadMediaInput = {
  brandId: string;
  file: File;
  caption?: string;
  tags?: string[];
};
