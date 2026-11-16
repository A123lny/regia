// RN-robot: tipi dei tool, separati dal registry per spezzare la circolarita'
// (tool -> registry -> tool).

import type { Session } from "@/lib/auth/session";
import type { RobotPageContext } from "../types";

export type RobotToolKind = "read" | "write" | "destructive";

export type RobotToolContext = {
  session: Session;
  pageContext: RobotPageContext;
};

export type RobotTool = {
  name: string;
  description: string;
  input_schema: object;
  requiredCapability: string | null;
  kind: RobotToolKind;
  execute: (input: unknown, ctx: RobotToolContext) => Promise<unknown>;
};
