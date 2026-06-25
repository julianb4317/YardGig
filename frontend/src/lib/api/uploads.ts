/** File upload API integration */

import { apiClient } from "@/lib/api-client";

export interface PresignResponse {
  uploadUrl: string;
  fileUrl: string;
  key: string;
  expiresIn: number;
  maxSizeBytes: number;
}

export function getPresignedUrl(fileName: string, contentType: string, purpose: string) {
  return apiClient<PresignResponse>("/api/uploads/presign", {
    method: "POST",
    body: { fileName, contentType, purpose },
  });
}

/**
 * Upload a file to the presigned URL, then return the permanent CDN fileUrl.
 */
export async function uploadFile(file: File, purpose: string): Promise<string> {
  const presign = await getPresignedUrl(file.name, file.type, purpose);

  await fetch(presign.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });

  return presign.fileUrl;
}
