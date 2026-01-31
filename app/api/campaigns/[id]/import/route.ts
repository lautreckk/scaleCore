import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface CSVRow {
  phone: string;
  name?: string;
  email?: string;
  company?: string;
  [key: string]: string | undefined;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const { data: tenantUser } = await supabase
      .from("tenant_users")
      .select("tenant_id")
      .eq("user_id", user.id)
      .single();

    if (!tenantUser) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get campaign
    const { data: campaign, error } = await supabase
      .from("campaigns")
      .select("id, status")
      .eq("id", id)
      .eq("tenant_id", tenantUser.tenant_id)
      .single();

    if (error || !campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    if (campaign.status !== "draft") {
      return NextResponse.json(
        { error: "Can only import to draft campaigns" },
        { status: 400 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { rows, columnMapping, createLeads } = body as {
      rows: CSVRow[];
      columnMapping: Record<string, string>;
      createLeads?: boolean;
    };

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { error: "No data to import" },
        { status: 400 }
      );
    }

    // Validate phone column exists
    const phoneColumn = Object.keys(columnMapping).find(
      (key) => columnMapping[key] === "phone"
    );

    if (!phoneColumn) {
      return NextResponse.json(
        { error: "Phone column mapping is required" },
        { status: 400 }
      );
    }

    const results = {
      imported: 0,
      skipped: 0,
      errors: [] as string[],
    };

    const sendsToInsert: Array<{
      campaign_id: string;
      lead_id: string | null;
      phone: string;
      status: string;
    }> = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      // Map columns
      const mappedRow: Record<string, string | undefined> = {};
      for (const [csvColumn, fieldName] of Object.entries(columnMapping)) {
        mappedRow[fieldName] = row[csvColumn];
      }

      const phone = formatPhone(mappedRow.phone);

      if (!phone) {
        results.skipped++;
        results.errors.push(`Row ${i + 1}: Invalid phone number`);
        continue;
      }

      let leadId: string | null = null;

      if (createLeads) {
        // Create or find lead
        const { data: existingLead } = await supabase
          .from("leads")
          .select("id")
          .eq("tenant_id", tenantUser.tenant_id)
          .eq("phone", phone)
          .single();

        if (existingLead) {
          leadId = existingLead.id;
        } else {
          // Create new lead
          const customFields: Record<string, string> = {};
          for (const [field, value] of Object.entries(mappedRow)) {
            if (
              !["phone", "name", "email", "company"].includes(field) &&
              value
            ) {
              customFields[field] = value;
            }
          }

          const { data: newLead, error: leadError } = await supabase
            .from("leads")
            .insert({
              tenant_id: tenantUser.tenant_id,
              phone,
              name: mappedRow.name || null,
              email: mappedRow.email || null,
              company: mappedRow.company || null,
              source: "csv_import",
              status: "new",
              custom_fields:
                Object.keys(customFields).length > 0 ? customFields : null,
            })
            .select("id")
            .single();

          if (leadError) {
            results.skipped++;
            results.errors.push(`Row ${i + 1}: Failed to create lead`);
            continue;
          }

          leadId = newLead.id;
        }
      }

      sendsToInsert.push({
        campaign_id: id,
        lead_id: leadId,
        phone,
        status: "pending",
      });

      results.imported++;
    }

    // Batch insert sends
    if (sendsToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from("campaign_sends")
        .insert(sendsToInsert);

      if (insertError) {
        return NextResponse.json(
          { error: "Failed to create campaign sends" },
          { status: 500 }
        );
      }

      // Update campaign total recipients
      await supabase
        .from("campaigns")
        .update({
          total_recipients: sendsToInsert.length,
          estimated_cost: sendsToInsert.length * 0.12,
        })
        .eq("id", id);
    }

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error) {
    console.error("Error importing CSV:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

function formatPhone(phone: string | undefined): string | null {
  if (!phone) return null;

  // Remove all non-numeric characters
  const digits = phone.replace(/\D/g, "");

  // Validate length
  if (digits.length < 10 || digits.length > 15) {
    return null;
  }

  // Add Brazil country code if missing
  if (digits.length === 10 || digits.length === 11) {
    return "55" + digits;
  }

  return digits;
}
