CREATE TABLE mcp_clients (id text PRIMARY KEY NOT NULL, name text NOT NULL, redirect_uris text NOT NULL, created_at integer NOT NULL);
--> statement-breakpoint
CREATE TABLE mcp_requests (id text PRIMARY KEY NOT NULL, payload text NOT NULL, expires_at integer NOT NULL);
--> statement-breakpoint
CREATE TABLE mcp_grants (id text PRIMARY KEY NOT NULL, client_id text NOT NULL, user_id text NOT NULL REFERENCES users(id), organization_id text NOT NULL REFERENCES organizations(id), code_hash text, code_expires_at integer NOT NULL, challenge text NOT NULL, redirect_uri text NOT NULL, access_hash text, access_expires_at integer, refresh_hash text, expires_at integer NOT NULL, revoked_at integer, created_at integer NOT NULL);
