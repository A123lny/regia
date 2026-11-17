// RN-robot T10: gate server-side che legge robot_role_access.

import { getSessionOrRedirect } from "@/lib/auth/session";
import { getRobotAccess } from "./role-access-repo";
import { RobotWidgetClient } from "./widget-client";

export async function RobotWidget() {
  const session = await getSessionOrRedirect();
  const enabled = await getRobotAccess(session.organizationId, session.role);
  if (!enabled) return null;

  return <RobotWidgetClient userId={session.userId} role={session.role} />;
}
