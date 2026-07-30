import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

/**
 * Token-issuing endpoint for direct-to-blob photo uploads (spec §2.7 photo
 * capture). The image itself never passes through this serverless
 * function — the client uploads straight to Blob storage with a
 * short-lived token from here, which sidesteps Vercel's ~4.5MB request
 * body limit that a full-res phone photo would otherwise hit.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"],
        addRandomSuffix: true,
        maximumSizeInBytes: 20 * 1024 * 1024,
      }),
      onUploadCompleted: async () => {
        // No-op — the client already awaits the upload and drives the
        // identify step itself once it resolves.
      },
    });
    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
