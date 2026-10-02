// M05 - config canale (quiet hours + limiti pressione).
import { getAdminClient } from "@/lib/db/admin";
import type { Channel } from "./types";

export type ChannelConfigRow = {
  id: string;
  organizationId: string;
  channel: Channel;
  quietHoursStart: string;
  quietHoursEnd: string;
  allowPromotional: boolean;
  maxPerMonthPerContact: number;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToConfig(row: any): ChannelConfigRow {
  return {
    id: row.id,
    organizationId: row.organization_id,
    channel: row.channel,
    quietHoursStart: row.quiet_hours_start,
    quietHoursEnd: row.quiet_hours_end,
    allowPromotional: row.allow_promotional,
    maxPerMonthPerContact: row.max_per_month_per_contact,
  };
}

export async function getChannelConfig(
  organizationId: string,
  channel: Channel,
): Promise<ChannelConfigRow> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("m05_channel_config")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("channel", channel)
    .maybeSingle();
  if (error) throw new Error(`getChannelConfig: ${error.message}`);
  if (!data) {
    // fallback default (non dovrebbe capitare grazie al seed, ma safe)
    return {
      id: "",
      organizationId,
      channel,
      quietHoursStart: channel === "whatsapp" ? "09:00" : "00:00",
      quietHoursEnd: channel === "whatsapp" ? "21:00" : "23:59",
      allowPromotional: channel !== "whatsapp",
      maxPerMonthPerContact: channel === "whatsapp" ? 2 : 4,
    };
  }
  return rowToConfig(data);
}

export type UpdateChannelConfigInput = {
  organizationId: string;
  channel: Channel;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  allowPromotional?: boolean;
  maxPerMonthPerContact?: number;
};

export async function updateChannelConfig(
  input: UpdateChannelConfigInput,
): Promise<ChannelConfigRow> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.quietHoursStart !== undefined) patch["quiet_hours_start"] = input.quietHoursStart;
  if (input.quietHoursEnd !== undefined) patch["quiet_hours_end"] = input.quietHoursEnd;
  if (input.allowPromotional !== undefined) patch["allow_promotional"] = input.allowPromotional;
  if (input.maxPerMonthPerContact !== undefined)
    patch["max_per_month_per_contact"] = input.maxPerMonthPerContact;
  const { data, error } = await admin
    .from("m05_channel_config")
    .upsert(
      {
        organization_id: input.organizationId,
        channel: input.channel,
        ...patch,
      },
      { onConflict: "organization_id,channel" },
    )
    .select("*")
    .single();
  if (error) throw new Error(`updateChannelConfig: ${error.message}`);
  return rowToConfig(data);
}
