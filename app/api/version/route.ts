import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// Cache the version in memory to avoid file reads on every request
let cachedVersion: string | null = null;

function getBuildId(): string {
  // If we have a cached version, return it
  if (cachedVersion) {
    return cachedVersion;
  }

  try {
    // Try to read the BUILD_ID file that Next.js creates during build
    const buildIdPath = path.join(process.cwd(), ".next", "BUILD_ID");
    if (fs.existsSync(buildIdPath)) {
      cachedVersion = fs.readFileSync(buildIdPath, "utf-8").trim();
      return cachedVersion;
    }
  } catch {
    // Ignore errors
  }

  // Fallback: use environment variable or generate from timestamp
  // In production, this should come from the build process
  cachedVersion =
    process.env.BUILD_ID ||
    process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) ||
    `dev-${Date.now()}`;

  return cachedVersion;
}

export async function GET() {
  const version = getBuildId();

  return NextResponse.json(
    { version },
    {
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    }
  );
}
