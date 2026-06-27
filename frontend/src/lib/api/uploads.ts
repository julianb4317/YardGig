/** File upload API integration */

import Cookies from "js-cookie";
import { ApiError } from "@/lib/api-client";

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5209";

/**
 * Upload files via multipart form data.
 * Returns an array of URLs for the uploaded files.
 */
export async function uploadFiles(files: File[], purpose = "job_photo"): Promise<string[]> {
  const token = Cookies.get("yg_access");

  const formData = new FormData();
  formData.append("purpose", purpose);
  for (const file of files) {
    formData.append("files", file);
  }

  const res = await fetch(`${BASE_URL}/api/uploads/files`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    const errors: string[] = errorBody.errors ?? [errorBody.error ?? `Upload failed with ${res.status}`];
    throw new ApiError(res.status, errors, res);
  }

  const data = await res.json();
  return (data.urls as string[]).map((url) => `${BASE_URL}${url}`);
}
