// RN-robot T6: registry centrale dei tool del robottino.

import type { Session } from "@/lib/auth/session";
import type {
  RobotTool,
  RobotToolKind,
  RobotToolContext,
} from "./tool-types";

export type { RobotTool, RobotToolKind, RobotToolContext } from "./tool-types";

import { describePageTool } from "./describe-page";
import { explainFeatureTool } from "./explain-feature";
import { listContactsTool } from "./list-contacts";
import { getContactTool } from "./get-contact";
import { searchContactsTool } from "./search-contacts";
import { createContactTool } from "./create-contact";
import { updateContactTool } from "./update-contact";

export const ROBOT_TOOLS: Record<string, RobotTool> = {
  describePage: describePageTool,
  explainFeature: explainFeatureTool,
  listContacts: listContactsTool,
  getContact: getContactTool,
  searchContacts: searchContactsTool,
  createContact: createContactTool,
  updateContact: updateContactTool,
};

export function getToolsForRole(
  role: Session["role"],
  kinds: RobotToolKind[],
): RobotTool[] {
  // T6: la capability check avviene in execute (requireCapability lato tool).
  // Qui filtriamo solo per kind. Il role per ora non restringe la lista a
  // priori — ma la execute rifiuta se mancano le capability dominio.
  void role;
  return Object.values(ROBOT_TOOLS).filter((t) => kinds.includes(t.kind));
}

/**
 * Converte il registry in formato Anthropic tool definitions per la richiesta
 * streaming.
 */
export function toAnthropicTools(
  tools: RobotTool[],
): Array<{ name: string; description: string; input_schema: object }> {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema,
  }));
}
