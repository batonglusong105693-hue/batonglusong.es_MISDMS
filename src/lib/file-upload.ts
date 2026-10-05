// File upload utilities and validation

import { extname } from "path";
import crypto from "crypto";

export type FileCategory = "document" | "image" | "audio" | "video" | "archive" | "spreadsheet" | "presentation";

export interface FileValidationConfig {
  maxSize: number; // bytes
  allowedExtensions: string[];
  allowedMimeTypes: string[];
  category: FileCategory;
}

export interface UploadedFile {
  id: string;
  originalName: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  category: FileCategory;
  uploadedAt: Date;
  uploadedById: string;
  isPublic: boolean;
  metadata?: Record<string, any>;
}

const FILE_CONFIGS: Record<FileCategory, FileValidationConfig> = {
  document: {
    maxSize: 50 * 1024 * 1024, // 50MB
    allowedExtensions: [".pdf", ".doc", ".docx", ".txt", ".rtf"],
    allowedMimeTypes: [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
      "application/rtf",
    ],
    category: "document",
  },
  image: {
    maxSize: 10 * 1024 * 1024, // 10MB
    allowedExtensions: [".jpg", ".jpeg", ".png", ".gif", ".webp"],
    allowedMimeTypes: ["image/jpeg", "image/png", "image/gif", "image/webp"],
    category: "image",
  },
  audio: {
    maxSize: 100 * 1024 * 1024, // 100MB
    allowedExtensions: [".mp3", ".wav", ".m4a", ".aac", ".ogg"],
    allowedMimeTypes: ["audio/mpeg", "audio/wav", "audio/mp4", "audio/aac", "audio/ogg"],
    category: "audio",
  },
  video: {
    maxSize: 500 * 1024 * 1024, // 500MB
    allowedExtensions: [".mp4", ".avi", ".mov", ".mkv", ".webm"],
    allowedMimeTypes: ["video/mp4", "video/x-msvideo", "video/quicktime", "video/x-matroska", "video/webm"],
    category: "video",
  },
  archive: {
    maxSize: 100 * 1024 * 1024, // 100MB
    allowedExtensions: [".zip", ".rar", ".7z", ".tar", ".gz"],
    allowedMimeTypes: ["application/zip", "application/x-rar-compressed", "application/x-7z-compressed", "application/x-tar", "application/gzip"],
    category: "archive",
  },
  spreadsheet: {
    maxSize: 50 * 1024 * 1024, // 50MB
    allowedExtensions: [".xls", ".xlsx", ".csv", ".ods"],
    allowedMimeTypes: [
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/csv",
      "application/vnd.oasis.opendocument.spreadsheet",
    ],
    category: "spreadsheet",
  },
  presentation: {
    maxSize: 100 * 1024 * 1024, // 100MB
    allowedExtensions: [".ppt", ".pptx", ".odp"],
    allowedMimeTypes: [
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/vnd.oasis.opendocument.presentation",
    ],
    category: "presentation",
  },
};

export function validateFileUpload(
  fileName: string,
  fileSize: number,
  mimeType: string,
  category: FileCategory
): { valid: boolean; error?: string } {
  const config = FILE_CONFIGS[category];
  if (!config) {
    return { valid: false, error: "Invalid file category" };
  }

  // Check file size
  if (fileSize > config.maxSize) {
    return {
      valid: false,
      error: `File size exceeds maximum (${Math.round(config.maxSize / 1024 / 1024)}MB)`,
    };
  }

  // Check file extension
  const ext = extname(fileName).toLowerCase();
  if (!config.allowedExtensions.includes(ext)) {
    return {
      valid: false,
      error: `File type not allowed. Allowed: ${config.allowedExtensions.join(", ")}`,
    };
  }

  // Check MIME type
  if (!config.allowedMimeTypes.includes(mimeType)) {
    return {
      valid: false,
      error: "Invalid file MIME type",
    };
  }

  return { valid: true };
}

export function generateFileName(originalName: string): string {
  const ext = extname(originalName);
  const timestamp = Date.now();
  const random = crypto.randomBytes(8).toString("hex");
  return `${timestamp}-${random}${ext}`;
}

export function detectCategory(mimeType: string): FileCategory | null {
  for (const [category, config] of Object.entries(FILE_CONFIGS)) {
    if (config.allowedMimeTypes.includes(mimeType)) {
      return category as FileCategory;
    }
  }
  return null;
}

export function getFileCategory(mimeType: string): FileCategory {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel") || mimeType.includes("csv"))
    return "spreadsheet";
  if (mimeType.includes("presentation") || mimeType.includes("powerpoint")) return "presentation";
  if (mimeType.includes("archive") || mimeType.includes("zip") || mimeType.includes("rar"))
    return "archive";
  return "document";
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

export function getFileIcon(category: FileCategory): string {
  const icons: Record<FileCategory, string> = {
    document: "📄",
    image: "🖼️",
    audio: "🎵",
    video: "🎬",
    archive: "📦",
    spreadsheet: "📊",
    presentation: "📽️",
  };
  return icons[category] || "📎";
}
