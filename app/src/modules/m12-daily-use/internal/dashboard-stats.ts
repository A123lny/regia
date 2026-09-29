// M12 daily use — dashboard stats aggregation (RF-12.1).
// Query aggregate per Home M12: contatori pipeline editoriale (F1.5a/b, dati vivi)
// + info "come sta andando".
// I contatori del pipeline editoriale vengono da m03-editorial via public.ts (RS-1).

import { getAdminClient } from "@/lib/db/admin";
import { getContentDraftsDashboardCounts } from "@/modules/m03-editorial/public";
import fs from "node:fs/promises";
import path from "node:path";

export type Environment = "sviluppo-locale" | "staging" | "produzione";

export type DashboardStats = {
  organizationId: string;
  toDo: {
    draftsPending: number;
    approvedNotScheduled: number;
    scheduledUpcoming: number;
    publishedThisWeek: number;
  };
  going: {
    brands: Array<{ slug: string; displayName: string; color: string; logoUrl: string | null }>;
    lastAuthEventAt: string | null;
    lastBackupAt: string | null;
    environment: Environment;
  };
};

async function getLastAuthEvent(organizationId: string): Promise<string | null> {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from("audit_events")
    .select("created_at")
    .eq("organization_id", organizationId)
    .like("action", "auth.%")
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) {
    if (error.code === "42P01" || error.code === "42703") return null;
    throw error;
  }
  const rows = data as Array<{ created_at: string }> | null;
  return rows?.[0]?.created_at ?? null;
}

async function getLastBackupAt(): Promise<string | null> {
  try {
    const backupsDir = path.resolve(process.cwd(), "backups");
    const entries = await fs.readdir(backupsDir);
    const sqlFiles = entries.filter((e) => e.endsWith(".sql"));
    if (sqlFiles.length === 0) return null;
    const stats = await Promise.all(
      sqlFiles.map(async (f) => {
        const st = await fs.stat(path.join(backupsDir, f));
        return { name: f, mtime: st.mtime };
      }),
    );
    stats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
    return stats[0]?.mtime.toISOString() ?? null;
  } catch {
    // backups dir non esiste o non leggibile
    return null;
  }
}

function getEnvironment(): Environment {
  const env = process.env["REGIA_ENVIRONMENT"];
  if (env === "produzione" || env === "staging") return env;
  return "sviluppo-locale";
}

export async function getDashboardStats(organizationId: string): Promise<DashboardStats> {
  const admin = getAdminClient();

  const [toDo, brandsResult, lastAuthEventAt, lastBackupAt] = await Promise.all([
    getContentDraftsDashboardCounts(organizationId),
    admin
      .from("brands")
      .select("slug, display_name, color, logo_url")
      .eq("organization_id", organizationId)
      .eq("is_archived", false)
      .order("display_name"),
    getLastAuthEvent(organizationId),
    getLastBackupAt(),
  ]);

  const brands = (brandsResult.data ?? []).map(
    (b: { slug: string; display_name: string; color: string; logo_url: string | null }) => ({
      slug: b.slug,
      displayName: b.display_name,
      color: b.color,
      logoUrl: b.logo_url ?? null,
    }),
  );

  return {
    organizationId,
    toDo,
    going: {
      brands,
      lastAuthEventAt,
      lastBackupAt,
      environment: getEnvironment(),
    },
  };
}
