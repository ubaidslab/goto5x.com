# Running UZEYN on your own computer

This is a step-by-step guide to get the whole platform running on your own
laptop/desktop so you can click through it yourself — no coding knowledge
needed, just copying and pasting the commands exactly as written, in order.

Every command below goes into a **Terminal** window (Mac/Linux) or a
**PowerShell** window (Windows). If you've never opened one: on a Mac, press
`Cmd+Space`, type `Terminal`, press Enter. On Windows, press the Windows key,
type `PowerShell`, press Enter.

---

## Part 0 — Before you start, one decision

There are two ways to set this up. **Use Path A if you can** — it's far
fewer steps. Use Path B only if Path A doesn't work for you.

- **Path A (Docker) — recommended, simplest.** One program (Docker Desktop)
  runs everything else for you automatically.
- **Path B (no Docker) — more steps, but guaranteed to work.** You install
  a few things yourself. This is the path that was actually run and
  verified, end to end, while this platform was being built — if Path A
  gives you any trouble, switch to Path B and it will work.

If you're not sure, start with Path A. If anything about it feels stuck or
confusing, don't fight it — jump to Path B instead.

---

## Part 1 — Prerequisites

Install these first, regardless of which path you pick:

1. **Git** — lets you download the code.
   - Mac: open Terminal and run `git --version` — if it's not installed,
     macOS will offer to install it for you automatically. Click "Install."
   - Windows: download and install from https://git-scm.com/download/win
     (accept all the default options during install).
   - Linux: `sudo apt install git` (Ubuntu/Debian) or your distro's
     equivalent.

2. **Node.js version 20 or newer** — the programming language runtime
   this whole platform runs on.
   - Go to https://nodejs.org and download the **LTS** version (it will
     say something like "20.x.x LTS" — any 20 or higher is fine).
   - Run the installer, accept all the defaults.
   - Verify it worked: open a **new** Terminal/PowerShell window and run:
     ```sh
     node --version
     ```
     It should print `v20.x.x` or higher. If it prints "command not
     found," restart your computer and try again (this is the most common
     fix — the installer needs a fresh terminal session).

3. **pnpm** — the tool used to install this project's code libraries.
   Once Node.js is installed, run:
   ```sh
   corepack enable
   ```
   Then verify:
   ```sh
   pnpm --version
   ```
   It should print a version number (e.g. `9.x.x`). If this step fails,
   run `npm install -g pnpm` instead, then try `pnpm --version` again.

**If using Path A**, also install:

4. **Docker Desktop** — download from https://www.docker.com/products/docker-desktop/
   for your OS, install it, and **open the Docker Desktop application at
   least once** before continuing (it needs to finish its own first-time
   setup and show "Docker Desktop is running").

**If using Path B**, also install:

4. **PostgreSQL 16**:
   - Mac: install [Homebrew](https://brew.sh) first if you don't have it,
     then run `brew install postgresql@16` followed by
     `brew services start postgresql@16`.
   - Windows: download the installer from
     https://www.postgresql.org/download/windows/ (pick version 16), run
     it, and **remember the password you set for the `postgres` user** —
     you'll need it below. Accept the default port (5432).
   - Linux: `sudo apt install postgresql-16` (Ubuntu/Debian), then
     `sudo systemctl start postgresql`.
5. **Redis**:
   - Mac: `brew install redis` then `brew services start redis`.
   - Windows: Redis doesn't officially support Windows directly — install
     [WSL2](https://learn.microsoft.com/en-us/windows/wsl/install) first
     (one command: `wsl --install`, then restart your computer), then
     follow the Linux instructions below **inside** the WSL terminal.
   - Linux (or Windows via WSL2): `sudo apt install redis-server` then
     `sudo service redis-server start`.

---

## Part 2 — Get the code

In your Terminal/PowerShell, pick a folder to put the project in (this
example uses your home folder) and run:

```sh
cd ~
git clone <YOUR_REPOSITORY_URL_HERE> goto5x.com
cd goto5x.com
```

(Replace `<YOUR_REPOSITORY_URL_HERE>` with the actual GitHub URL — ask
whoever set up your repository access for this if you don't have it.)

Every command from here on assumes you're inside this `goto5x.com` folder,
unless a step explicitly says to change folders.

---

## Path A — Docker setup

**Note before you start:** this exact path has not been personally
smoke-tested end-to-end in the sandboxed environment this platform was
built in (that environment has no Docker available at all — see
`README.md`'s own disclosure on this). It's built to the right shape, but
if any step below doesn't work exactly as described, switch to Path B,
which **has** been fully run and verified.

1. Create your settings file:
   ```sh
   cp .env.example .env
   ```
2. Open the new `.env` file in any text editor (Notepad, TextEdit, VS
   Code — whatever you have) and change every line that says
   `change-me...` to a real value. For local testing on your own
   computer, simple values are fine, e.g.:
   ```
   POSTGRES_SUPERUSER_PASSWORD=localtest123
   POSTGRES_RUNTIME_PASSWORD=localtest456
   POSTGRES_ADMIN_PASSWORD=localtest789
   JWT_ACCESS_SECRET=some-random-long-string-at-least-32-characters
   MINIO_ROOT_PASSWORD=localtest000
   ACME_EMAIL=your-real-email@example.com
   ```
   Leave everything else in the file as-is for now.
3. Start everything with one command:
   ```sh
   docker compose up --build
   ```
   This will take several minutes the first time (it's downloading and
   building several programs). Leave this window open — it's showing you
   the live logs of every service. When it settles down and stops
   printing new lines rapidly, it's ready.
4. **One-time database setup** — open a **second** Terminal/PowerShell
   window (leave the first one running) and, from the same
   `goto5x.com` folder, run:
   ```sh
   docker compose exec -T postgres psql -U postgres -d uzeyn \
     -v runtime_password="localtest456" \
     -v admin_password="localtest789" \
     -v dbname="uzeyn" \
     -f - < apps/api/scripts/bootstrap-db.sql
   ```
   (Use the same passwords you actually put in `.env` above, if you
   changed them from the example values. On Windows PowerShell, if this
   exact line gives you a redirection error, use Path B instead — this
   specific step is easiest on Mac/Linux.)
5. Apply the database structure:
   ```sh
   docker compose exec api npx prisma migrate deploy
   ```
6. Seed the baseline data every fresh install needs:
   ```sh
   docker compose exec api npx ts-node scripts/dev-seed.ts
   ```
7. Create your admin login:
   ```sh
   docker compose exec api npx ts-node scripts/create-local-admin.ts admin@local.test ChangeMe123!
   ```
8. Skip to **Part 3 — Logging in** below. Your app is running at
   `http://app.localhost` (no port number needed with Docker).

---

## Path B — No-Docker setup (verified, guaranteed to work)

1. **Create the database.** Run:
   ```sh
   createdb uzeyn
   ```
   If that fails with a password/authentication error, use this instead
   (Mac/Linux):
   ```sh
   sudo -u postgres createdb uzeyn
   ```
   On Windows, open "SQL Shell (psql)" from your Start Menu instead, log
   in with the password you set during install, and run `CREATE DATABASE
   uzeyn;` there.

2. **Create the two application database accounts.** From the
   `goto5x.com` folder:
   ```sh
   cd apps/api
   psql -h localhost -U postgres -d uzeyn \
     -v runtime_password="localtest456" \
     -v admin_password="localtest789" \
     -v dbname="uzeyn" \
     -f scripts/bootstrap-db.sql
   ```
   It will ask for the `postgres` superuser password you set when you
   installed PostgreSQL. Type it and press Enter (it won't show on
   screen — that's normal, just type it and hit Enter).
   **Do not** put your own quote marks around the password values above —
   copy the command exactly as shown, only the two example passwords
   (`localtest456`, `localtest789`) are yours to change if you want.

3. **Create your settings files.** You need two — one for the backend,
   one for the website. From the `goto5x.com` folder (not `apps/api`):
   ```sh
   cp .env.example apps/api/.env
   cp apps/web/.env.example apps/web/.env.local
   ```
4. **Edit `apps/api/.env`** in any text editor. Change these lines to
   match what you actually used in step 2 above, and fill in the rest:
   ```
   POSTGRES_SUPERUSER_PASSWORD=<your postgres superuser password from install>
   POSTGRES_RUNTIME_PASSWORD=localtest456
   POSTGRES_ADMIN_PASSWORD=localtest789
   DATABASE_URL=postgresql://app_runtime:localtest456@localhost:5432/uzeyn?schema=public
   DATABASE_ADMIN_URL=postgresql://app_admin:localtest789@localhost:5432/uzeyn?schema=public
   JWT_ACCESS_SECRET=some-random-long-string-at-least-32-characters
   ```
   Then find these two lines near the bottom of the file and change
   `3000` to `3001` in each (the website runs on port 3001 on this path —
   explained in the troubleshooting section below):
   ```
   PLATFORM_HOSTNAMES=localhost:3000,app.localhost:3000,app.localhost
   CORS_ALLOWED_ORIGINS=http://localhost:3000,http://app.localhost:3000,http://support.localhost:3000
   ```
   become:
   ```
   PLATFORM_HOSTNAMES=localhost:3001,app.localhost:3001,app.localhost
   CORS_ALLOWED_ORIGINS=http://localhost:3001,http://app.localhost:3001,http://support.localhost:3001
   ```
   Everything else in the file (MinIO, Google Drive, Printify, Traefik)
   can stay as the placeholder `change-me` values — none of it is needed
   just to run the app and click around.

5. **Edit `apps/web/.env.local`** the same way — change every `3000` to
   `3001`:
   ```
   API_BASE_URL=http://localhost:3000
   PLATFORM_HOSTNAMES=localhost:3001,app.localhost:3001,app.localhost
   ```
   (Leave `API_BASE_URL` as `3000` — that one's correct, it's pointing at
   the backend, not the website.)

6. **Install the code libraries and set up the database structure.**
   From the `goto5x.com` root folder:
   ```sh
   cd ~/goto5x.com
   pnpm install
   cd apps/api
   DATABASE_URL="postgresql://postgres:<your postgres superuser password>@localhost:5432/uzeyn" npx prisma migrate deploy
   ```
7. **Seed the baseline data** every fresh install needs (plans, themes,
   settings — safe to run more than once):
   ```sh
   npx ts-node scripts/dev-seed.ts
   ```
8. **Create your admin login:**
   ```sh
   npx ts-node scripts/create-local-admin.ts admin@local.test ChangeMe123!
   ```

### Starting the app (do this every time you want to test it)

You need **two** Terminal/PowerShell windows open at the same time, and
**the order matters** — start the backend first and wait for it to say
it's ready before starting the website. (Starting them at the same time,
or the website first, causes the two to fight over the same network port
and the backend will fail to start — this was found and fixed while
building this exact guide.)

**Window 1 — the backend:**
```sh
cd ~/goto5x.com/apps/api
pnpm start:dev
```
Wait until you see a line that says `Nest application successfully
started`. That's your signal to move to Window 2.

**Window 2 — the website:**
```sh
cd ~/goto5x.com/apps/web
pnpm dev
```
Wait until you see `- Local: http://localhost:3001`. If it instead says
`http://localhost:3000`, the backend from Window 1 isn't running yet —
stop this (`Ctrl+C`), confirm Window 1 shows "successfully started," then
try Window 2 again.

Both windows need to **stay open** the whole time you're testing. Closing
either one stops that half of the app.

---

## Part 3 — Logging in

Once both the backend and website are running (either path), open your
web browser to these addresses. (Docker path: use the addresses without
`:3001`. No-Docker path: keep the `:3001`.)

| Who | Address | Notes |
|---|---|---|
| **Admin** (you) | `http://app.localhost:3001/admin/login` | Log in with `admin@local.test` / `ChangeMe123!` (or whatever you used in the create-admin step). **First login only:** you'll see a QR code — scan it with any authenticator app on your phone (Google Authenticator, Authy, or your phone's built-in one) to finish setup. Every admin login after that needs a fresh 6-digit code from that app. |
| **Seller** (a store owner) | `http://app.localhost:3001/signup` | This is the real seller sign-up form — fill it out as if you were a new merchant joining the platform. After signing up you land on your own seller dashboard. |
| **Buyer** (a shopper) | `http://<your-store-slug>.localhost:3001/` | Replace `<your-store-slug>` with the store address you picked during seller sign-up above. This is the public storefront anyone could visit — no login needed to browse, only to check out. A "Sign in" link in the top-right lets a buyer optionally create an account too (saved addresses, order history at `/account/orders`) — this is always optional; checking out as a guest still works exactly the same. |

**Want a store that's already got products, orders, and customers in it,
instead of starting from a totally empty one?** There's a built-in tool
that fills the database with realistic fake sellers/stores/products/
orders so you have something to click through immediately:

```sh
cd apps/api
pnpm run simulate seed --count 5
```

When it finishes, it prints a line like `Run ID: run-1234567890123` — copy
that number. Every fake seller it created uses that same run ID in its
email, numbered 1 through 5 (since `--count 5` above made 5 of them), all
sharing one fixed password:

- **Email:** `sim+<the run ID>-1@simulation.local` (or `-2`, `-3`, up to
  the count you asked for — pick any one)
- **Password:** `sim-run-password-not-for-real-use`

Log in as one of them at `http://app.localhost:3001/login` to see a real
seller dashboard with real products and orders already in it, or visit
that seller's storefront the same way as the Buyer row above (its store
address is `sim-<the run ID>-store-1.localhost:3001`, swapping `-1` for
whichever seller number you picked). When you're done and want to remove
all this fake data, see "Reset to a clean slate" below.

---

## Part 4 — Stopping everything safely

When you're done testing:

1. Click into each Terminal/PowerShell window that's running the app
   (Window 1 and Window 2 from Path B's "Starting the app" section, or
   the `docker compose up` window from Path A) and press `Ctrl+C` in each
   one. Wait for it to actually stop (it may take a few seconds) before
   closing the window.
2. **Docker path only:** your data (accounts, stores, orders) is
   automatically saved and will still be there next time — you don't
   need to do anything else. Just run `docker compose up` again next time
   to pick up where you left off.
3. **No-Docker path:** Postgres and Redis keep running in the background
   even after you close the two app windows — that's fine and expected,
   they use almost no resources sitting idle. Your data is safe. You
   don't need to stop them between test sessions; just re-run the two
   "Starting the app" commands next time.

---

## Part 5 — Reset to a clean slate

If you want to wipe everything and start over from scratch (e.g. you
made a mess testing and just want a fresh empty platform again):

**If you only used the "instant demo data" simulation tool** (Part 3) and
want to remove just that fake data, keeping your own real accounts:
```sh
cd apps/api
pnpm run simulate teardown --run <the run ID it printed when you seeded it>
```

**For a truly total reset** (deletes every account, store, order —
everything, including your own admin account):

*Docker path:*
```sh
docker compose down -v
```
Then repeat Path A's steps 3 onward (the `-v` also deletes the saved
database, so you're starting completely fresh).

*No-Docker path:*
```sh
cd apps/api
DATABASE_URL="postgresql://postgres:<your postgres superuser password>@localhost:5432/uzeyn" npx prisma migrate reset
```
It will ask you to confirm — type `y` and press Enter. **Important:**
right after this finishes, you must re-run the database-accounts step
(Path B, step 2 above) again — resetting wipes those accounts' permissions
too. Then re-run steps 7 and 8 (seed baseline data, create your admin
login) to get back to a working, empty platform.

---

## Troubleshooting

- **"Nest application successfully started" never appears / an error
  about a port already being used:** something else on your computer is
  already using port 3000 or 3001. Restart your computer and try again —
  this clears almost all port conflicts.
- **The website shows `http://localhost:3000` instead of `3001` when it
  starts (No-Docker path):** you started Window 2 before Window 1 was
  fully ready. Stop both (`Ctrl+C` in each), start Window 1 again, wait
  for "successfully started," then start Window 2.
- **Postgres/Redis "connection refused" errors:** they've stopped
  running. Mac: `brew services restart postgresql@16` and
  `brew services restart redis`. Linux/WSL2: `sudo service postgresql
  restart` and `sudo service redis-server restart`.
- **Uploading a product photo doesn't work:** this needs a real object
  storage server (MinIO) connected, which isn't required for anything
  else in this guide. Everything except photo uploads works without it.
- **A `...localhost:3001` address (a store address, or
  `app.localhost:3001`) won't load / says it can't find the site:** most
  browsers and operating systems automatically treat any address ending
  in `.localhost` as your own computer, no setup needed — but a few older
  setups don't. If it won't load, add this one line to your hosts file
  and try again: Mac/Linux, run `echo "127.0.0.1 app.localhost" | sudo
  tee -a /etc/hosts` (repeat for each store address you need, e.g.
  `sim-<run ID>-store-1.localhost`); Windows, open Notepad **as
  Administrator**, open
  `C:\Windows\System32\drivers\etc\hosts`, and add a line `127.0.0.1
  app.localhost` (again, one line per address you need).
- **Anything else:** stop everything (Part 4), restart your computer, and
  start again from "Starting the app." This resolves the large majority
  of local environment hiccups.
