// API route: lista voucher filtrati per il tab.

import { NextResponse } from "next/server";
import { getSessionOrRedirect } from "@/lib/auth/session";
import { hasCapability } from "@/lib/auth/permissions";
import { listVouchers } from "@/modules/m06-loyalty/public";
import type { VoucherStatus } from "@/modules/m06-loyalty/public";

function isStatus(s: string | null): s is VoucherStatus {
  return s === "issued" || s === "redeemed" || s === "expired" || s === "cancelled";
}

export async function GET(req: Request) {
  const session = await getSessionOrRedirect();
  if (!hasCapability(session.role, "loyalty.read")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const q = url.searchParams.get("q");

  const input: Parameters<typeof listVouchers>[0] = {
    organizationId: session.organizationId,
    limit: 200,
  };
  if (isStatus(status)) input.status = status;
  if (q && q.trim().length > 0) input.query = q.trim();

  const { items } = await listVouchers(input);
  return NextResponse.json({ items });
}
