import { sql } from "drizzle-orm";
import { check, index, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

const createdAt = () => timestamp("created_at", { withTimezone: true }).defaultNow().notNull();

export const tenants = pgTable("tenants", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  createdAt: createdAt(),
});

export const sites = pgTable("sites", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  status: varchar("status", { length: 32 }).notNull().default("active"),
  createdAt: createdAt(),
}, (table) => [
  index("sites_tenant_id_idx").on(table.tenantId),
  check("sites_status_check", sql`${table.status} in ('active', 'inactive', 'archived')`),
]);

export const workers = pgTable("workers", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  siteId: uuid("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  status: varchar("status", { length: 32 }).notNull().default("active"),
  createdAt: createdAt(),
}, (table) => [
  index("workers_tenant_id_idx").on(table.tenantId),
  check("workers_status_check", sql`${table.status} in ('active', 'inactive', 'archived')`),
]);

export const participants = pgTable("participants", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  siteId: uuid("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  preferredFormat: varchar("preferred_format", { length: 32 }).notNull().default("plain-language"),
  status: varchar("status", { length: 32 }).notNull().default("active"),
  createdAt: createdAt(),
}, (table) => [
  index("participants_tenant_id_idx").on(table.tenantId),
  check("participants_preferred_format_check", sql`${table.preferredFormat} in ('plain-language', 'easy-read', 'audio')`),
  check("participants_status_check", sql`${table.status} in ('active', 'inactive', 'archived')`),
]);

export const auditEvents = pgTable("audit_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  actorReference: text("actor_reference").notNull(),
  action: varchar("action", { length: 64 }).notNull(),
  entityType: varchar("entity_type", { length: 64 }).notNull(),
  entityId: uuid("entity_id"),
  payload: text("payload").notNull(),
  payloadHash: varchar("payload_hash", { length: 64 }).notNull(),
  previousHash: varchar("previous_hash", { length: 64 }),
  eventHash: varchar("event_hash", { length: 64 }).notNull(),
  createdAt: createdAt(),
  retentionUntil: timestamp("retention_until", { withTimezone: true }).notNull(),
}, (table) => [index("audit_events_tenant_id_created_at_idx").on(table.tenantId, table.createdAt)]);
