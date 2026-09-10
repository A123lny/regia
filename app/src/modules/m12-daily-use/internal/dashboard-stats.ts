// M12 daily use — dashboard stats aggregation (RF-12.1).
// Query aggregate per Home M12: contatori "cosa devi fare" + info "come sta andando".
// I contatori per tabelle non ancora esistenti (contents, reviews, restaurants, cost_alerts)
// ritornano 0 senza throw grazie al catch su Postgres error 42P01 (undefined_table).
// Quando F1.2+ aggiunge le tabelle, i valori si popolano automaticamente.

import { getAdminClient } from "@/lib/db/admin";
import fs from "node:fs/promises";
import path from "node:path";

export type Environment = "sviluppo-locale" | "staging" | "produzione";

export type DashboardStats = {
  organizationId: string;
  toDo: {
    contentsPending: number;
    reviewsPending: number;
    restaurantsCooling: number;
    costAlerts: number;
  };
  going: {
    brands: Array<{ slug: string; displayName: string }>;
    lastAuthEventAt: string | null;
    lastBackupAt: string | null;
    environment: Environment;
  };
};

const UNDEFINED_TABLE_CODE = "42P01";

async function safeCount(table: string, organizationId: string): Promise<number> {
  const admin = getAdminClient();
  const { count, error } = await admin
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq("organization_id", organizationId);
  if (error) {
    if (error.code === UNDEFINED_TABLE_CODE) return 0;
    // Anche errori di colonna mancante (42703) sono tollerati: tabelle future
    // potrebbero non avere ancora organization_id.
    if (error.code === "42703") return 0;
    throw error;
  }
  return count ?? 0;
}

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

  const [
    contentsPending,
    reviewsPending,
    restaurantsCooling,
    costAlerts,
    brandsResult,
    lastAuthEventAt,
    lastBackupAt,
  ] = await Promise.all([
    safeCount("contents", organizationId),
    safeCount("reviews", organizationId),
    safeCount("restaurants", organizationId),
    safeCount("cost_alerts", organizationId),
    admin
      .from("brands")
      .select("slug, display_name")
      .eq("organization_id", organizationId)
      .order("display_name"),
    getLastAuthEvent(organizationId),
    getLastBackupAt(),
  ]);

  const brands = (brandsResult.data ?? []).map((b: { slug: string; display_name: string }) => ({
    slug: b.slug,
    displayName: b.display_name,
  }));

  return {
    organizationId,
    toDo: {
      contentsPending,
      reviewsPending,
      restaurantsCooling,
      costAlerts,
    },
    going: {
      brands,
      lastAuthEventAt,
      lastBackupAt,
      environment: getEnvironment(),
    },
  };
}
