// RN-robot T4: gate server-side + render client component.
// Il gate reale per ruolo (lettura di robot_role_access) arriva in T10.
// Fino ad allora, hardcoded: visibile solo a owner.

import { getSessionOrRedirect } from "@/lib/auth/session";
import { RobotWidgetClient } from "./widget-client";

export async function RobotWidget() {
  const session = await getSessionOrRedirect();

  // T4 gate: solo owner. T10 sostituira' con getRobotAccess(role).
  if (session.role !== "owner") return null;

  return <RobotWidgetClient userId={session.userId} role={session.role} />;
}
