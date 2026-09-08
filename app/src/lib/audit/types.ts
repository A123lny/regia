export type ActorKind = "user" | "agent" | "system";

export type AuditEventInput = {
  organizationId: string;
  actorUserId: string | null;
  actorKind: ActorKind;
  action: string;
  target?: string;
  details?: Record<string, unknown>;
};
