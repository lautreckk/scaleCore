import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getEvolutionClientByInstanceName } from "@/lib/evolution/config";

// GET - Get profile and privacy settings
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ instanceName: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { instanceName } = await params;

    const { data: tenantUser } = await supabase
      .from("tenant_users")
      .select("tenant_id")
      .eq("user_id", user.id)
      .single();

    if (!tenantUser) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const clientData = await getEvolutionClientByInstanceName(
      instanceName,
      tenantUser.tenant_id
    );

    if (!clientData) {
      return NextResponse.json(
        { error: "Instance not found or no Evolution server configured" },
        { status: 404 }
      );
    }

    const { client } = clientData;

    // Fetch profile and privacy settings in parallel
    const [profileResult, privacyResult] = await Promise.all([
      client.fetchProfile(instanceName),
      client.fetchPrivacySettings(instanceName),
    ]);

    return NextResponse.json({
      success: true,
      profile: profileResult.success ? profileResult.data : null,
      privacy: privacyResult.success ? privacyResult.data : null,
    });
  } catch (error) {
    console.error("Error getting profile settings:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST - Update profile settings
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ instanceName: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { instanceName } = await params;

    const { data: tenantUser } = await supabase
      .from("tenant_users")
      .select("tenant_id, role")
      .eq("user_id", user.id)
      .single();

    if (!tenantUser || !["owner", "admin"].includes(tenantUser.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const clientData = await getEvolutionClientByInstanceName(
      instanceName,
      tenantUser.tenant_id
    );

    if (!clientData) {
      return NextResponse.json(
        { error: "Instance not found or no Evolution server configured" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { action, ...data } = body;
    const { client } = clientData;

    let result;

    switch (action) {
      case "updateName":
        if (!data.name) {
          return NextResponse.json(
            { error: "Name is required" },
            { status: 400 }
          );
        }
        result = await client.updateProfileName(instanceName, data.name);
        break;

      case "updateStatus":
        if (typeof data.status !== "string") {
          return NextResponse.json(
            { error: "Status is required" },
            { status: 400 }
          );
        }
        result = await client.updateProfileStatus(instanceName, data.status);
        break;

      case "updatePicture":
        if (!data.picture) {
          return NextResponse.json(
            { error: "Picture URL is required" },
            { status: 400 }
          );
        }
        result = await client.updateProfilePicture(instanceName, data.picture);
        break;

      case "removePicture":
        result = await client.removeProfilePicture(instanceName);
        break;

      case "updatePrivacy":
        if (!data.privacy) {
          return NextResponse.json(
            { error: "Privacy settings are required" },
            { status: 400 }
          );
        }
        result = await client.updatePrivacySettings(instanceName, data.privacy);
        break;

      default:
        return NextResponse.json(
          { error: "Invalid action" },
          { status: 400 }
        );
    }

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to update profile" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Profile updated successfully",
    });
  } catch (error) {
    console.error("Error updating profile settings:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
