# PATATATAS — Full-Stack Local Setup & Testing Guide

This connects `patatatas_rbac_v8.html` to a real PHP + MySQL backend built
directly from `rootcrops.sql`, per the capstone's LAMP / MVC architecture
(pp. 36–46 of `Capstone_Retry_docx_2.pdf`).

## What's real vs. what's still demo

**Backed by the real database (rootcrops.sql), fully working CRUD:**
- Seed/variety catalog browsing (Admin, Producer, Farmer, Public) — pulled live from `producer_crop_stocks`, joined with `varieties`, `rootcrops`, `producers`, `rootcrop_units`.
- **Add Variety** / **Edit Variety** (Admin) → writes to `varieties` + `variety_generations`.
- **Update Stock** (Admin "📦 Update Stock" / Producer "📦 Update My Stock" buttons, shown only on DB-backed cards) → writes to `producer_crop_stocks` and automatically inserts the matching audit row into `producer_stock_logs` (Set/Add/Subtract → Exact/Added/Subtracted, exactly like the 3 log rows already in the dump).
- **Login** → validated against `users.password` (bcrypt) + `user_auth_level` + `user_producer_relation`.

**Still frontend-only demo data** (because `rootcrops.sql` has no tables for these — adding fake tables would have broken the "preserve the exact schema" requirement):
- Orders/cart/checkout, supplier accreditation & pending-approval workflow, User Management CRUD, Reports/analytics numbers, and the legacy static Admin Inventory / Producer "My Stock" tables (still hand-written HTML rows, not DB-bound — use the catalog cards' new "Update Stock" button for real writes instead).

The app **auto-detects** whether a backend is reachable. Opened directly as a
file (`file://...`), it silently falls back to the original offline demo data
— nothing breaks. Served through PHP (see below), it fetches and writes real
data and shows a green "Connected to live database" toast.

## 1. Import the database

Original schema/data is untouched. Import it, then run the additive seed file
for `variety_generations` (this table was empty in the dump; the task asked
for mock data to be added — it's schema-preserving, INSERT-only):

```bash
mysql -u root -p -e "CREATE DATABASE rootcrops CHARACTER SET utf8mb4;"
mysql -u root -p rootcrops < sql/rootcrops.sql
mysql -u root -p rootcrops < sql/variety_generations_seed.sql
```

*(Using phpMyAdmin instead: create a `rootcrops` database, then Import each
`.sql` file in that same order from the Import tab.)*

## 2. Configure the DB connection

`config/db.php` defaults to XAMPP's out-of-the-box MySQL (`127.0.0.1`, user
`root`, empty password) — works unmodified on a stock XAMPP install. To
override without editing the file, set environment variables instead:

```bash
export PATATATAS_DB_HOST=127.0.0.1
export PATATATAS_DB_USER=root
export PATATATAS_DB_PASS=yourpassword
export PATATATAS_DB_NAME=rootcrops
```

## 3. Run it locally

**Option A — XAMPP (matches the capstone's stack exactly):**
1. Copy this whole folder into `htdocs/patatatas/`.
2. Start Apache + MySQL in the XAMPP control panel.
3. Import the SQL as in step 1 (via phpMyAdmin, `http://localhost/phpmyadmin`).
4. Open `http://localhost/patatatas/patatatas_rbac_v8.html`.

**Option B — PHP's built-in server (fastest for a quick test):**
```bash
cd patatatas-fullstack
php -S 127.0.0.1:8000
```
Then open `http://127.0.0.1:8000/patatatas_rbac_v8.html`. (MySQL/MariaDB must
already be running separately — step 1/2 above.)

## 4. Test the live features

- Load the page → you should see a toast: *"🟢 Connected to live database — 1
  record(s) loaded from rootcrops.sql."* (Only Granola has a stock row in the
  original dump, so the catalog will show that 1 real item alongside the
  offline demo items — real items show `📦 Update Stock` / `📦 Update My
  Stock`.)
- **Add a variety** as Admin → Seed Catalog → *+ Add Variety*. Pick any crop
  type (even one not yet in the DB — it will be created for you), fill in the
  fields, save. Refresh: it now comes back from the database.
- **Update stock** on the Granola card → *📦 Update Stock* → choose
  Add/Subtract/Set, enter a quantity and a reason, submit. Check
  `producer_stock_logs` in phpMyAdmin — a new audit row appears with the
  exact old/new quantity, price, and status you'd expect.
- **Log in** with the one seeded account tied to a real producer:
  `rheinzmarcelo@gmail.com` — **you'll need the real plaintext password**,
  which isn't recoverable from the bcrypt hash in the dump. For a quick test
  login instead, run the included helper script to create a known-password
  test admin (does **not** modify `rootcrops.sql` — separate, optional, for
  grading/demo convenience only):

```bash
php sql/create_test_admin.php admin.test@bsu.edu.ph Test1234
```

  Then sign in on the Staff Sign In screen with those exact credentials.
  (Tested: this script and login were verified end-to-end while building
  this package — `user_id=4`, role `admin`, `auth_level=1`.)

## API reference

All endpoints live under `api/` and speak JSON. Every table's exact column
names/types/FKs from `rootcrops.sql` are preserved — see the doc-comment at
the top of each file for the full contract:

| Endpoint | Methods | Table(s) |
|---|---|---|
| `api/rootcrops.php` | GET, POST, PUT, DELETE | `rootcrops` |
| `api/rootcrop_units.php` | GET, POST, PUT, DELETE | `rootcrop_units` |
| `api/producers.php` | GET, POST, PUT, DELETE | `producers` |
| `api/varieties.php` | GET, POST, PUT, DELETE | `varieties` (+ `varieties_alt_names`) |
| `api/variety_generations.php` | GET, POST, PUT, DELETE | `variety_generations` |
| `api/producer_crop_stocks.php` | GET, POST, PUT, DELETE | `producer_crop_stocks` (joined view on GET; PUT also writes `producer_stock_logs`) |
| `api/producer_stock_logs.php` | GET only (append-only) | `producer_stock_logs` |
| `api/auth.php` | POST | `users`, `user_auth_level`, `user_producer_relation` |

## A schema note worth knowing for your defense

`producer_crop_stocks` tracks stock in **units** (e.g. "Mini Tubers - Pea
Size"), not kilograms, and its only status-like column is `is_public`
(Public/Private visibility) — there's no Available/Low/Unavailable enum in
the schema. The frontend's colored status badges for DB-backed items are
computed client-side from `stock_amount` purely for display; they aren't
stored anywhere. `variety_generations` also describes a variety's whole
breeding pipeline (all its G0/G1/G2 stages), not a single batch's lineage —
there's no parent-batch foreign key in the given schema, so DB-backed cards
show all of a variety's generation records rather than one "parent batch" per
row like the offline demo data does.

Role	Email	Password	Condition
Admin	admin.test@bsu.edu.ph	Test1234	Only if you ran php sql/create_test_admin.php admin.test@bsu.edu.ph Test1234
Producer (Renz / NPRCRTC)	rheinzmarcelo@gmail.com	Renz12345	Only if you ran the password-reset SQL I gave you last time