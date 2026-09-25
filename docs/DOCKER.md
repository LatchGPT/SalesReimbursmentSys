# Docker Runbook & Guide

This guide explains how to build, run, and manage the Sales Reimbursement System using Docker and Docker Compose.

---

## 1. Overview & Architecture

The project provides two Docker configurations:

| Mode | Compose File | Dockerfile | Purpose |
|---|---|---|---|
| **Development** | `docker-compose.dev.yml` | `Dockerfile.dev` | Hot reload enabled, source code mounted from host, fast iteration. |
| **Production / Staging** | `docker-compose.yml` | `Dockerfile` | Multi-stage production build, non-root `nextjs` user, compiled Next.js bundle. |

### Topology

```text
Host (Browser at http://localhost:3000)
       |
       v
+-------------------------------------------------------+
|  Docker Network: default                              |
|                                                       |
|  +-------------------------+                          |
|  | app (Next.js 16)        |                          |
|  | Container: sales-reim-* |                          |
|  | Port: 3000              |                          |
|  +------------+------------+                          |
|               |                                       |
|               | DATABASE_URL (host: "db", port 5432)  |
|               v                                       |
|  +-------------------------+                          |
|  | db (PostgreSQL 16)      | <--- Volume: pgdata      |
|  | Container: sales-reim-db|                          |
|  | Port: 5432 (mapped)     |                          |
|  +-------------------------+                          |
+-------------------------------------------------------+
```

---

## 2. Quick Start: Development Mode (Hot Reload)

Development mode mounts your local code into the container so any changes made on your editor reflect immediately in the browser.

### Start development:
```bash
npm run docker:dev
# or directly:
docker compose -f docker-compose.dev.yml up --build
```

### Stop development:
```bash
npm run docker:down
# or directly:
docker compose -f docker-compose.dev.yml down
```

---

## 3. Production / Staging Simulation

To test the exact production multi-stage build locally before deploying to Vercel/cloud:

### Build and run production containers:
```bash
npm run docker:prod
# or directly:
docker compose up --build -d
```

### View container logs:
```bash
docker compose logs -f app
```

### Stop production containers:
```bash
npm run docker:down
# or directly:
docker compose down
```

---

## 4. Database Setup & Migrations

When you launch Docker with a fresh PostgreSQL container, the system automatically checks the database connection:
- **Zero-config auto-migration:** When the container detects it is connected to the local `@db:` container, it automatically applies any pending Prisma migrations on startup.
- **Manual migration (if needed):**
  ```bash
  # In development:
  docker compose -f docker-compose.dev.yml exec app npm run db:migrate

  # In production:
  docker compose exec app npm run db:migrate
  ```

**From the host machine (with port 5432 exposed):**
```powershell
$env:DIRECT_URL="postgresql://postgres:postgres@localhost:5432/sales_reimbursement?sslmode=disable"
npm run db:migrate
```

### Checking Migration Status
```bash
docker compose exec app npm run db:status
```

### Opening Prisma Studio in Browser
```bash
# Opens Studio accessible at http://localhost:5555
docker compose exec app npm run db:studio
```

---

## 5. Essential Docker Commands Cheat Sheet

| Task | Command |
|---|---|
| Start Dev (hot-reload) | `npm run docker:dev` *(or `docker compose -f docker-compose.dev.yml up`)* |
| Start Dev in background | `docker compose -f docker-compose.dev.yml up -d` |
| Start Prod locally | `npm run docker:prod` *(or `docker compose up --build -d`)* |
| View active containers | `docker ps` |
| Stream live logs | `docker compose logs -f` *(or `docker compose -f docker-compose.dev.yml logs -f`)* |
| Stop all containers | `npm run docker:down` *(or `docker compose -f docker-compose.yml -f docker-compose.dev.yml down`)* |
| Reset database & wipe volumes | `npm run docker:clean` |
| Open shell inside Next.js app | `docker compose exec app sh` |
| Open PostgreSQL terminal | `docker compose exec db psql -U postgres -d sales_reimbursement` |


---

## 6. Environment & SSL Details

1. **Internal Connection String:**  
   Docker Compose uses `postgresql://postgres:postgres@db:5432/sales_reimbursement?sslmode=disable`.  
   The application (`src/lib/prisma.ts`) respects `sslmode=disable` so it connects to the local unencrypted Postgres container without enforcing TLS.
2. **Supabase vs Local Postgres:**  
   When connecting to Supabase in production/staging via `.env`, `sslmode=require` ensures encrypted TLS connections through the Supabase connection pooler.
3. **Persisted Volumes:**  
   - `pgdata` (or `pgdata_dev`): Stores database tables and records across restarts.
   - `uploads_data`: Stores local uploaded files and receipts.

---

## 7. Sharing a Single Database Across Multiple Developers

When multiple developers work on the system, there are two primary ways to share the exact same database:

### Option A: Shared Cloud Staging Database (Recommended)

The most reliable approach—developers can work from home, the office, or anywhere without complex network routing or keeping someone's laptop turned on:

1. Create a dedicated **Dev/Staging project** on Supabase, Neon, Railway, or AWS RDS.
2. In each developer's `.env` file, provide the shared connection strings:
   ```env
   DATABASE_URL=postgresql://postgres:[PASSWORD]@[HOST]:[PORT]/[DB]?sslmode=require
   DIRECT_URL=postgresql://postgres:[PASSWORD]@[HOST]:[PORT]/[DB]?sslmode=require
   ```
3. Docker Compose will automatically detect `DATABASE_URL` from `.env` and route requests to the shared cloud database instead of the local container.
4. Developers can start just the Next.js application without running a local database:
   ```bash
   docker compose -f docker-compose.dev.yml up app
   ```

> [!CAUTION]
> Never point developer environments to the live production database. Always use a dedicated development or staging project.

### Option B: Host Developer Shares Local PostgreSQL Over LAN / Tailscale

If you don't want cloud hosting and all developers are on the same local network (or using a mesh VPN like Tailscale):

1. **Host Developer** runs the database container and keeps it running:
   ```bash
   docker compose -f docker-compose.dev.yml up -d db
   ```
2. **Host Developer** finds their IP address:
   - On Windows: Run `ipconfig` (e.g. `192.168.1.100` or Tailscale IP `100.x.y.z`).
   - Ensure port `5432` is permitted through the Windows Defender Firewall.
3. **Other Developers** configure their `.env` to point to the host's IP:
   ```env
   DATABASE_URL=postgresql://postgres:postgres@192.168.1.100:5432/sales_reimbursement?sslmode=disable
   DIRECT_URL=postgresql://postgres:postgres@192.168.1.100:5432/sales_reimbursement?sslmode=disable
   ```
4. **Other Developers** start their local app container:
   ```bash
   docker compose -f docker-compose.dev.yml up app
   ```
   Both developers will now see and write the exact same data in real time.

---

## 8. Docker Overrides with `.env.docker`

If your main `.env` contains cloud database credentials (such as Supabase) for host-side development, but you want Docker containers to use local PostgreSQL without changing your `.env`:

1. Copy the example override file:
   ```bash
   cp .env.docker.example .env.docker
   # Or in PowerShell:
   copy .env.docker.example .env.docker
   ```
2. Docker Compose automatically merges `.env.docker` on top of `.env`.

---

## 9. Windows Host Setup Tips

- **Docker Desktop**: Ensure Docker Desktop is installed with the WSL 2 backend enabled.
- **Hot-Reloading**: `docker-compose.dev.yml` includes `WATCHPACK_POLLING=true` by default, ensuring Next.js detects changes across Windows NTFS volume mounts.
- **Line Endings**: `.gitattributes` enforces LF line endings across Dockerfiles, shell scripts, and compose YAML to prevent CRLF execution errors in Linux containers.

