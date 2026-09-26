# Draft Design of a Scalable Multi-Tenant SaaS Architecture with Global Authentication and Tenant-Isolated Databases:

servicebay-private/
+-- accounts/
+-- acct_1A2B3C4D/ <-------- stored in website launcher/global DB table accounts: account_id,api_key,hostname,db_connection_id
+-- service-orders/
+-- 2025-01/ ? Auto-extracted from SO-20250129-0001
+-- SO-20250129-0001/
+-- photos/
¦ +-- before/
¦ +-- during/
¦ +-- after/

| Concept                                    | Where It Lives | Reason / Purpose                                                                       |
| ------------------------------------------ | -------------- | -------------------------------------------------------------------------------------- |
| \*Employee / Technician Users\*\*          | Tenant DB      | Belong to and operate within a single tenant (company) context                         |
| **Customer Users (Portal Access)**         | Tenant DB      | Isolated per tenant; no shared data between companies                                  |
| **Global Users (Cross-Tenant Identities)** | Global DB      | Enable a single email to authenticate across multiple tenants                          |
| **Tokens / JWT References**                | Global DB      | Used for secure authentication and tenant routing context                              |
| **Authorization & Roles**                  | Tenant DB      | Define access control and permissions specific to each tenant’s data and org structure |

| Data type        | Where it lives         | Purpose                               |
| ---------------- | ---------------------- | ------------------------------------- |
| `phone_numbers`  | Global DB              | Maps Twilio numbers → accountId       |
| `accounts`       | Global DB              | Tenant metadata, domain, region, etc. |
| `vehicles`       | Global DB (replicated) | VIN → accountId for discovery         |
| `service_orders` | Tenant DB              | Per-tenant repair/service history     |
| `customers`      | Tenant DB              | Per-tenant customer contact info      |

```sql
-- ===========================================
-- GLOBAL / MAIN DATABASE
-- ===========================================

CREATE TABLE phone_numbers (
  id SERIAL PRIMARY KEY,
  account_id UUID REFERENCES accounts(id),
  twilio_number VARCHAR(20) UNIQUE NOT NULL,
  active BOOLEAN DEFAULT true,
  assigned_at TIMESTAMP DEFAULT now()
);

CREATE TABLE vehicles (
  vin VARCHAR(20) PRIMARY KEY,
  account_id UUID REFERENCES accounts(id),
  tenant_ref VARCHAR(100), -- optional: tenant db/schema name
  last_service_date DATE,
  customer_phone VARCHAR(20)
);

-- Master table of all tenant accounts
CREATE TABLE accounts (
  id UUID PRIMARY KEY,                       -- account_id (tenant)
  name TEXT NOT NULL,                        -- tenant/company name
  plan TEXT,                                 -- free, pro, enterprise, etc.
  region TEXT NOT NULL,                      -- region label, e.g. ap-southeast-1
  shard_id TEXT NOT NULL,                    -- logical shard name or cluster id
  db_host TEXT NOT NULL,                     -- Aurora/Citus host
  db_name TEXT NOT NULL,                     -- tenant DB name
  db_user TEXT NOT NULL,
  db_password TEXT NOT NULL,                 -- encrypted at rest (KMS)
  status TEXT DEFAULT 'active',              -- active/suspended/deleted
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Mapping for region / shard metadata (optional normalization)
CREATE TABLE shards (
  id TEXT PRIMARY KEY,                       -- e.g., shard-ap1
  region TEXT NOT NULL,
  db_host TEXT NOT NULL,
  cluster_identifier TEXT,                   -- AWS Aurora cluster name
  read_replica_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Global: cross-tenant metadata only
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE accounts (
  id UUID PRIMARY KEY,
  name TEXT,
  plan TEXT,
  region TEXT,
  db_connection_id UUID,
  hostname TEXT,
  shard TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE user_accounts (
  user_id UUID REFERENCES users(id),
  account_id UUID REFERENCES accounts(id),
  role TEXT,
  PRIMARY KEY (user_id, account_id)
);

-- API keys (machine-to-machine access, per tenant)
CREATE TABLE api_keys (
  id UUID PRIMARY KEY,
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  key_hash TEXT NOT NULL,                    -- store hash of API key
  permissions JSONB,                         -- e.g., { "scopes": ["read:orders"] }
  created_by_user_account_id UUID REFERENCES user_accounts(id),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ
);

-- Hostname / custom domains for tenant routing
CREATE TABLE domains (
  id UUID PRIMARY KEY,
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  hostname TEXT UNIQUE NOT NULL,             -- tenant1.myapp.com or custom domain
  verified BOOLEAN DEFAULT false,
  ssl_cert_ref TEXT,                         -- certificate ARN / secret ref
  created_at TIMESTAMPTZ DEFAULT now()
);

-- JWT audit log / revocation list
CREATE TABLE jwt_audit (
  jti UUID PRIMARY KEY,                      -- JWT ID (unique per token)
  user_account_id UUID REFERENCES user_accounts(id) ON DELETE CASCADE,
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  issued_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked BOOLEAN DEFAULT false,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Refresh tokens (optional)
CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY,
  user_account_id UUID REFERENCES user_accounts(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  issued_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  revoked BOOLEAN DEFAULT false
);

-- System-wide configuration or feature flags
CREATE TABLE system_config (
  key TEXT PRIMARY KEY,
  value JSONB,
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

```sql
-- ===========================================
-- TENANT DATABASE (Enhanced for Customer Access)
-- ===========================================

-- Tenant-local users: employees, technicians, admins, etc.
CREATE TABLE tenant_users (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT CHECK (role IN ('admin', 'technician', 'customer_portal')),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (email)
);

-- Customers of this tenant (vehicle owners or fleet contacts)
CREATE TABLE customers (
  id UUID PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT,
  phone_number TEXT,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (phone_number)
);

-- Vehicles serviced or owned by customers
CREATE TABLE vehicles (
  id UUID PRIMARY KEY,
  vin TEXT UNIQUE NOT NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  make TEXT,
  model TEXT,
  year INT,
  last_service_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Service orders (per tenant, tied to vehicles and technicians)
CREATE TABLE service_orders (
  id UUID PRIMARY KEY,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE,
  technician_id UUID REFERENCES tenant_users(id) ON DELETE SET NULL,
  status TEXT CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  description TEXT,
  total_cost NUMERIC(10,2),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ===========================================
-- NEW: Phone Numbers assigned to this tenant
-- ===========================================
CREATE TABLE tenant_phone_numbers (
  id UUID PRIMARY KEY,
  phone_number VARCHAR(20) UNIQUE NOT NULL,  -- E.164 format (+15551234567)
  label TEXT,                                -- optional: e.g. "Main line", "SMS only", etc.
  is_primary BOOLEAN DEFAULT false,
  assigned_at TIMESTAMPTZ DEFAULT now(),
  active BOOLEAN DEFAULT true,
  -- Helps sync with global database mapping
  last_synced_at TIMESTAMPTZ,
  CONSTRAINT only_one_primary CHECK (
    (is_primary = true) <= 1
  )
);

-- Optional: Trigger to enforce single primary number
CREATE OR REPLACE FUNCTION enforce_single_primary_phone()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_primary THEN
    UPDATE tenant_phone_numbers
    SET is_primary = false
    WHERE id <> NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_single_primary_phone
BEFORE INSERT OR UPDATE ON tenant_phone_numbers
FOR EACH ROW
EXECUTE FUNCTION enforce_single_primary_phone();
```

## Applying It to Your Case

## You described this scenario:

- When the tenant customer logs into tenant1 website using shared-email@gmail.com + password123,they get access to tenant1 records.
- When the same user logs into tenant2 website using shared-email@gmail.com + password456,they get access to tenant2 records.
- Resetting tenant1 password doesn’t affect tenant2.

That means:

## You’re using Model B — Tenant-Isolated Authentication.

So the password_hash should only exist in the tenant DB (tenant_users), not in the global user_accounts table.

| Model                                                         | Description                                                                                                               | Where `password_hash` lives | Typical Use Case                                                                              |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | --------------------------- | --------------------------------------------------------------------------------------------- |
| **A. Global Authentication Model (centralized auth)**         | The user authenticates **once globally** (e.g. `shared-email@gmail.com`), and then chooses which tenant/account to enter. | ? **Global DB only**        | SaaS where a single user account can access multiple organizations (e.g. Slack, Notion, Jira) |
| **B. Tenant-Isolated Authentication Model (per-tenant auth)** | Each tenant has its **own isolated login system**, even if the same email exists in multiple tenants.                     | ? **Tenant DB only**        | SaaS where tenants are fully isolated businesses (e.g. white-labeled B2B apps)                |

## When to Add Back password_hash in Global DB

- You would only add password_hash to the global DB if you later evolve toward:
- Unified Login Portal (one email, one password across tenants)
- SSO Integration (OAuth2, SAML, Cognito, Auth0, etc.)
- Central Account Switching (like “Switch Workspace” in Slack or Notion)

In that case, password_hash moves up to the global users table, and tenant DBs only store role/permission mappings.

## What the App Needs to Run for an Authenticated User

### Once a user logs in and gets a JWT, the app must have access to:

- Who ? user identity (userId, role)
- Where ? tenant metadata (accountId, db_host, region, hostname)
- What ? authorization scope (role, plan, permissions)
- How ? runtime connections (tenant DB, cache, logs)
- Services ? background processing & integration context (api_keys, queues, storage)

Only with those five dimensions does a tenant app “run fully” for that authenticated user — from API gateway to database, all scoped by tenant.

## The Core Issue: Account Discovery Without JWT

### When Twilio sends a webhook (incoming call → /voice/incoming), your API:

- Has no JWT or user session yet.
- Only receives: From, To, maybe CallSid, and user speech (via AI or webhook).
- Must figure out which tenant (account) this call belongs to.

That’s what we call Account Discovery.

| Need                     | Recommended Approach                             |
| ------------------------ | ------------------------------------------------ |
| Identify tenant (no JWT) | Phone number routing (Twilio → accountId lookup) |
| Secondary verification   | VIN ownership lookup in global DB                |
| Data sync                | Tenant → Global DB push for VINs/customers       |
| Long-term scalability    | Use Redis caching + Aurora for routing DB        |
| Security                 | Validate Twilio webhook signatures               |
