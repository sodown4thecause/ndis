-- gen_random_uuid() is built into supported PostgreSQL/Neon versions.

CREATE TABLE tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  status varchar(32) NOT NULL DEFAULT 'active',
  CONSTRAINT sites_status_check CHECK (status IN ('active', 'inactive', 'archived')),
  CONSTRAINT sites_tenant_id_id_unique UNIQUE (tenant_id, id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE workers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  site_id uuid NOT NULL,
  name text NOT NULL,
  status varchar(32) NOT NULL DEFAULT 'active',
  CONSTRAINT workers_status_check CHECK (status IN ('active', 'inactive', 'archived')),
  CONSTRAINT workers_tenant_site_fk FOREIGN KEY (tenant_id, site_id) REFERENCES sites(tenant_id, id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  site_id uuid NOT NULL,
  name text NOT NULL,
  preferred_format varchar(32) NOT NULL DEFAULT 'plain-language',
  status varchar(32) NOT NULL DEFAULT 'active',
  CONSTRAINT participants_preferred_format_check CHECK (preferred_format IN ('plain-language', 'easy-read', 'audio')),
  CONSTRAINT participants_status_check CHECK (status IN ('active', 'inactive', 'archived')),
  CONSTRAINT participants_tenant_site_fk FOREIGN KEY (tenant_id, site_id) REFERENCES sites(tenant_id, id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_order bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  actor_reference text NOT NULL,
  action varchar(64) NOT NULL,
  entity_type varchar(64) NOT NULL,
  entity_id uuid,
  payload text NOT NULL,
  payload_hash varchar(64) NOT NULL,
  previous_hash varchar(64),
  event_hash varchar(64) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  retention_until timestamptz NOT NULL
);

CREATE INDEX sites_tenant_id_idx ON sites(tenant_id);
CREATE INDEX workers_tenant_id_idx ON workers(tenant_id);
CREATE INDEX participants_tenant_id_idx ON participants(tenant_id);
CREATE INDEX audit_events_tenant_id_created_at_idx ON audit_events(tenant_id, created_at);
CREATE INDEX audit_events_tenant_id_created_order_idx ON audit_events(tenant_id, created_order);

ALTER TABLE sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE sites FORCE ROW LEVEL SECURITY;
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants FORCE ROW LEVEL SECURITY;
ALTER TABLE workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE workers FORCE ROW LEVEL SECURITY;
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants FORCE ROW LEVEL SECURITY;
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events FORCE ROW LEVEL SECURITY;

CREATE POLICY sites_tenant_isolation ON sites
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
CREATE POLICY tenants_tenant_isolation ON tenants
  USING (id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
CREATE POLICY workers_tenant_isolation ON workers
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
CREATE POLICY participants_tenant_isolation ON participants
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
CREATE POLICY audit_events_tenant_isolation ON audit_events
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

CREATE OR REPLACE FUNCTION prevent_audit_event_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_events is append-only';
END;
$$;

REVOKE UPDATE, DELETE ON audit_events FROM PUBLIC;
CREATE TRIGGER audit_events_append_only
  BEFORE UPDATE OR DELETE ON audit_events
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_event_mutation();
