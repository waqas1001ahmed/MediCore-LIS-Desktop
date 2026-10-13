# MediCore-LIS — Windows Auto‑Update & Release Guide

This document explains how automatic updates work, how to configure the GitHub
repository, how to build and publish releases, and how to test updates safely.

The packaged Windows app loads the **online** frontend and backend
(`https://frontend-my-personal-8941.vercel.app/` and
`https://backend-mu-six-71.vercel.app/api`). Automatic updates only replace the
desktop shell — your patient data, uploads, reports and settings are never
touched.

---

## 1. How the updater works

- Updates use **electron‑updater** with the **GitHub Releases** provider.
- On startup of the **packaged** app only, `electron/updater.cjs` waits ~10s,
  then checks GitHub Releases for a newer version.
- If an update is found it is **downloaded automatically** and installed **when
  you quit the app** (`autoInstallOnAppQuit`). The app is never force‑closed and
  ongoing work (registration, billing, reports, printing) is never interrupted.
- In **development** (`npm start` / `electron .`) the updater is never started.
- All update activity is logged to `%APPDATA%\MediCore LIS\logs\main.log`
  (via `electron-log`). No patient data, tokens, or passwords are ever logged.

Configured behaviour (in `electron/updater.cjs`):

| Option | Value | Meaning |
|--------|-------|---------|
| `autoDownload` | `true` | Download as soon as an update is found |
| `autoInstallOnAppQuit` | `true` | Install the downloaded update on quit |
| `autoRunAppAfterInstall` | `true` | Relaunch after installing |
| `allowPrerelease` | `false` | Only stable releases |
| `allowDowngrade` | `false` | Never downgrade |

---

## 2. GitHub repository (already configured)

The publisher is configured for this repository:

- **Repository:** `https://github.com/waqas1001ahmed/MediCore-LIS-Desktop`
- **Owner:** `waqas1001ahmed`
- **Repo:** `MediCore-LIS-Desktop`

`package.json` → `build.publish`:

```json
"publish": {
  "provider": "github",
  "owner": "waqas1001ahmed",
  "repo": "MediCore-LIS-Desktop",
  "releaseType": "release"
}
```

This block is also what tells **installed clients** where to check for updates
(electron‑builder writes it into `resources/app-update.yml` inside the packaged
app). The repository must be **public** (or its releases publicly readable) for
installed apps with no credentials to download updates — see section 7.

---

## 3. Version management

The release version is `package.json` → `version` (currently `1.0.0`).

Increment it **before** each release using npm (this updates `package.json` and
`package-lock.json`):

```powershell
# Patch: 1.0.0 -> 1.0.1   (bug fixes)
npm version patch

# Minor: 1.0.1 -> 1.1.0   (new features)
npm version minor

# Major: 1.1.0 -> 2.0.0   (breaking changes)
npm version major
```

The Git tag you push must match, e.g. for `1.0.1` push tag `v1.0.1`.

---

## 4. Build the Windows installer (local, no publishing)

```powershell
npm run dist
```

This builds the frontend and produces, in `dist\`:

- `MediCore LIS Setup <version>.exe` — the NSIS installer
- `MediCore LIS Setup <version>.exe.blockmap` — for delta downloads
- `latest.yml` — update metadata read by installed clients

`npm run dist` does **not** publish anything.

---

## 5. Publish a release to GitHub

Publishing needs a GitHub token with `repo` scope. **Never commit the token.**
Provide it via the `GH_TOKEN` environment variable only for the publish command.

### Option A — local publish (quick)

```powershell
# 1) Set your version (see section 3)
npm version patch

# 2) Build + publish to GitHub Releases
$env:GH_TOKEN = "ghp_xxxYourPersonalAccessTokenxxx"
npm run release

# 3) Tag the release so it is discoverable
git tag v1.0.1
git push origin v1.0.1
```

### Option B — GitHub Actions (recommended, secure)

The workflow `.github/workflows/release.yml` runs **only** when a version tag is
pushed. It verifies the tag matches `package.json` version, installs root and
frontend dependencies, builds the frontend and the Windows installer, and
publishes to GitHub Releases using the built‑in `GITHUB_TOKEN` (**no secret is
committed**).

```powershell
npm version patch          # 1) bump version (updates package.json + lock)
git push                   # 2) push the version bump to main
git tag v1.0.1             # 3) create the matching tag
git push origin v1.0.1     # 4) triggers the workflow -> builds & publishes
```

Notes:
- The job is gated on `refs/tags/*`, so normal branch pushes never create a
  release, and a tag that does **not** match `package.json` version fails the
  build with a clear error (no partial/duplicate release).
- Workflow permissions use `contents: write` with the built‑in `GITHUB_TOKEN`.
  No Personal Access Token or other secret is required.
- To re-run a release, use the **Re‑run jobs** button on the original tag run
  (the job stays gated to the tag).

---

## 6. Test the updater safely

1. Build and publish a **test** version (e.g. `1.0.1`) to a GitHub Release.
2. Install the **previous** version (e.g. `1.0.0`) on a test machine.
3. Launch it and wait ~10s. Check the log
   `%APPDATA%\MediCore LIS\logs\main.log` for `[updater]` lines:
   - `Checking for update…`
   - `Update available: 1.0.1. Downloading…`
   - `Update downloaded (1.0.1). It will be installed when the app quits.`
4. Quit the app → the installer runs and updates to `1.0.1`.
5. Confirm patient data, uploads, reports and settings are unchanged.

> electron‑updater skips pre‑releases by default (`allowPrerelease: false`).
> For a pre‑release test, temporarily set `autoUpdater.allowPrerelease = true`
> in `electron/updater.cjs`, or publish the test as a normal (non‑pre) release.

---

## 7. Important notes / limitations

- **Public vs private repository.** For end‑user machines with no credentials,
  the repository/releases must be **publicly readable** for the default GitHub
  provider to download updates. If your repo is **private**, either make the
  releases public, or switch to a `generic` provider pointing at an
  authenticated download server. Private repos do **not** work with the default
  unauthenticated updater.
- **Do not** set `publish: "always"` for ordinary development builds — only
  `npm run release` (or the Actions workflow) publishes.
- The updater never disables TLS and never downloads over insecure channels.
- Patient data lives in the user‑data directory
  (`app.getPath('userData')`) and is never inside the install folder, so
  installing an update never overwrites it.

