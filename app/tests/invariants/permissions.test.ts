import { describe, expect, it } from "vitest";
import { hasCapability, listCapabilities, type Capability } from "@/lib/auth/permissions";

describe("permissions matrix (RU-1a)", () => {
  describe("owner", () => {
    it("puo tutto", () => {
      const all: Capability[] = [
        "content.generate",
        "content.approve",
        "content.reject",
        "content.schedule",
        "content.unschedule",
        "content.reschedule",
        "content.publish",
        "content.delete",
        "brand.crud",
        "brand.kit.edit",
        "team.read",
        "team.manage",
        "audit.read",
        "contacts.read",
        "contacts.crud",
        "contacts.consent.manage",
        "contacts.dedup.read",
        "contacts.dedup.merge",
        "supply.read",
        "supply.crud",
        "catalog.read",
        "catalog.crud",
        "pricing.manage",
        "orders.read",
        "loyalty.read",
        "loyalty.crud.counters",
        "loyalty.crud.offers",
        "voucher.issue",
        "voucher.redeem",
        "voucher.cancel",
        "segment.read",
        "segment.crud",
        "campaign.read",
        "campaign.crud",
        "campaign.mark_sent",
        "partner.read",
        "partner.crud",
        "partner.activity.log",
        "signup.landing.crud",
        "signup.events.read",
        "analytics.read",
        "governance.read",
        "governance.crud",
        "reminders.read",
        "reminders.crud",
        "reminders.refresh",
        "abandonment.read",
        "abandonment.resolve",
        "abandonment.detect",
        "publishing.credentials.manage",
        "publishing.send",
        "publishing.send_bulk",
        "publishing.retry_dead",
        "advertising.read",
        "advertising.budgets.manage",
        "advertising.toggle",
        "advertising.classify",
        "advertising.overrun.request",
        "advertising.overrun.decide",
        "rider_capacity.read",
        "rider_capacity.manage",
        "rider_shift.request",
        "rider_shift.fulfill",
        "contacts.data_request.read",
        "contacts.data_request.fulfill",
        "agent_memory.read",
      ];
      for (const cap of all) {
        expect(hasCapability("owner", cap), `owner deve poter ${cap}`).toBe(true);
      }
    });
  });

  describe("editor (marketing)", () => {
    it("PUO: generate, schedule, unschedule, reschedule, publish, brand.kit.edit, team.read, contacts.*, publishing.send", () => {
      expect(hasCapability("editor", "content.generate")).toBe(true);
      expect(hasCapability("editor", "content.schedule")).toBe(true);
      expect(hasCapability("editor", "content.unschedule")).toBe(true);
      expect(hasCapability("editor", "content.reschedule")).toBe(true);
      expect(hasCapability("editor", "content.publish")).toBe(true);
      expect(hasCapability("editor", "brand.kit.edit")).toBe(true);
      expect(hasCapability("editor", "team.read")).toBe(true);
      expect(hasCapability("editor", "contacts.read")).toBe(true);
      expect(hasCapability("editor", "contacts.crud")).toBe(true);
      expect(hasCapability("editor", "catalog.read")).toBe(true);
      expect(hasCapability("editor", "catalog.crud")).toBe(true);
      expect(hasCapability("editor", "orders.read")).toBe(true);
      // Loyalty operativi
      expect(hasCapability("editor", "loyalty.read")).toBe(true);
      expect(hasCapability("editor", "voucher.issue")).toBe(true);
      expect(hasCapability("editor", "voucher.redeem")).toBe(true);
      // Outreach CRUD ma non mark_sent
      expect(hasCapability("editor", "segment.read")).toBe(true);
      expect(hasCapability("editor", "segment.crud")).toBe(true);
      expect(hasCapability("editor", "campaign.read")).toBe(true);
      expect(hasCapability("editor", "campaign.crud")).toBe(true);
      // Partners: operatività piena
      expect(hasCapability("editor", "partner.read")).toBe(true);
      expect(hasCapability("editor", "partner.crud")).toBe(true);
      expect(hasCapability("editor", "partner.activity.log")).toBe(true);
      // Signup: operatività piena
      expect(hasCapability("editor", "signup.landing.crud")).toBe(true);
      expect(hasCapability("editor", "signup.events.read")).toBe(true);
      // Analytics: read
      expect(hasCapability("editor", "analytics.read")).toBe(true);
      // Governance: read ma non crud (strategica)
      expect(hasCapability("editor", "governance.read")).toBe(true);
      // Reminders: read + crud operativi
      expect(hasCapability("editor", "reminders.read")).toBe(true);
      expect(hasCapability("editor", "reminders.crud")).toBe(true);
      // Anti-abbandono (RN-40): read + resolve operativi
      expect(hasCapability("editor", "abandonment.read")).toBe(true);
      expect(hasCapability("editor", "abandonment.resolve")).toBe(true);
      // Publishing (RF-5.x): send operativo, il rest è Owner-only
      expect(hasCapability("editor", "publishing.send")).toBe(true);
      // M13 Advertising: read + classify + overrun.request operativi
      expect(hasCapability("editor", "advertising.read")).toBe(true);
      expect(hasCapability("editor", "advertising.classify")).toBe(true);
      expect(hasCapability("editor", "advertising.overrun.request")).toBe(true);
      // Capacita rider (RN-41..43): editor puo vedere e aprire/aggiornare richieste
      expect(hasCapability("editor", "rider_capacity.read")).toBe(true);
      expect(hasCapability("editor", "rider_shift.request")).toBe(true);
      expect(hasCapability("editor", "rider_shift.fulfill")).toBe(true);
    });

    it("NON puo: approve, reject, delete, brand.crud, team.manage, audit.read, contacts.consent.manage, pricing.manage, loyalty.crud.*, voucher.cancel", () => {
      expect(hasCapability("editor", "content.approve")).toBe(false);
      expect(hasCapability("editor", "content.reject")).toBe(false);
      expect(hasCapability("editor", "content.delete")).toBe(false);
      expect(hasCapability("editor", "brand.crud")).toBe(false);
      expect(hasCapability("editor", "team.manage")).toBe(false);
      expect(hasCapability("editor", "audit.read")).toBe(false);
      // RF-1.4: consenso e' materia legale, non delegabile all'Editor
      expect(hasCapability("editor", "contacts.consent.manage")).toBe(false);
      // RF-1.7: dedup read permesso all'Editor, merge distruttivo Owner-only
      expect(hasCapability("editor", "contacts.dedup.read")).toBe(true);
      expect(hasCapability("editor", "contacts.dedup.merge")).toBe(false);
      // RF-6.19: supply read permesso all'Editor, crud (assenso) Owner-only
      expect(hasCapability("editor", "supply.read")).toBe(true);
      expect(hasCapability("editor", "supply.crud")).toBe(false);
      // RF-6.11: prezzo/margine è decisione strategica, Owner-only
      expect(hasCapability("editor", "pricing.manage")).toBe(false);
      // Loyalty config: strategica, Owner-only
      expect(hasCapability("editor", "loyalty.crud.counters")).toBe(false);
      expect(hasCapability("editor", "loyalty.crud.offers")).toBe(false);
      // Annullamento voucher: sicurezza, Owner-only
      expect(hasCapability("editor", "voucher.cancel")).toBe(false);
      // Mark campaign sent: audit-critical, Owner-only
      expect(hasCapability("editor", "campaign.mark_sent")).toBe(false);
      // Governance crud: strategica, Owner-only
      expect(hasCapability("editor", "governance.crud")).toBe(false);
      // Reminders refresh: scan pesante, Owner-only
      expect(hasCapability("editor", "reminders.refresh")).toBe(false);
      // Anti-abbandono detect: scan pesante, Owner-only
      expect(hasCapability("editor", "abandonment.detect")).toBe(false);
      // Publishing (RF-5.x): credenziali, bulk, retry sono Owner-only
      expect(hasCapability("editor", "publishing.credentials.manage")).toBe(false);
      expect(hasCapability("editor", "publishing.send_bulk")).toBe(false);
      expect(hasCapability("editor", "publishing.retry_dead")).toBe(false);
      // M13 Advertising: strategico/decisional Owner-only
      expect(hasCapability("editor", "advertising.budgets.manage")).toBe(false);
      expect(hasCapability("editor", "advertising.toggle")).toBe(false);
      expect(hasCapability("editor", "advertising.overrun.decide")).toBe(false);
      // Capacita rider: config strategica Owner-only
      expect(hasCapability("editor", "rider_capacity.manage")).toBe(false);
      // Richieste dati personali: GDPR materia legale, Owner-only
      expect(hasCapability("editor", "contacts.data_request.read")).toBe(false);
      expect(hasCapability("editor", "contacts.data_request.fulfill")).toBe(false);
      // Memoria agente: vista strategica, Owner-only
      expect(hasCapability("editor", "agent_memory.read")).toBe(false);
    });
  });

  describe("delegate (dormiente)", () => {
    it("non ha alcuna capability attiva", () => {
      expect(listCapabilities("delegate")).toEqual([]);
    });
  });

  describe("agent (dormiente come login)", () => {
    // 'agent' esiste nell'enum users_profile.role per predisposizione futura,
    // ma nessun bot AI fa login umano in F1: nessuna capability associata.
    it("non ha alcuna capability attiva", () => {
      expect(listCapabilities("agent")).toEqual([]);
    });
  });

  describe("listCapabilities", () => {
    it("ritorna un array coerente con hasCapability", () => {
      const editorCaps = listCapabilities("editor");
      for (const cap of editorCaps) {
        expect(hasCapability("editor", cap)).toBe(true);
      }
      expect(editorCaps.length).toBeGreaterThan(0);
    });
  });
});
