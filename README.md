# OpenNOW - Android

Unofficial GeForce NOW client for Android, built with Capacitor + React + WebRTC.

---

> **Warning**  
> OpenNOW is under active development. Bugs and performance issues are expected while features are finalized.

> **Trademark & Affiliation Notice**  
> OpenNOW is an independent community project and is **not affiliated with, endorsed by, or sponsored by NVIDIA Corporation**.  
> **NVIDIA** and **GeForce NOW** are trademarks of NVIDIA Corporation. You must use your own GeForce NOW account.

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | 18 or newer | https://nodejs.org |
| Android Studio | Hedgehog or newer | https://developer.android.com/studio |
| Android SDK | API 36 (compile), API 24 (min) | Install via SDK Manager in Android Studio |
| JDK | 21 | Required by Capacitor 8 (Android Studio Ladybug+ bundles it) |
| ADB | any | Part of Android SDK platform-tools |

After installing Android Studio, open it once and let it finish the initial SDK setup.

Add ADB to your PATH so it works from a terminal:

```powershell
# Add to your PowerShell profile or system environment variables
$env:PATH += ";$env:LOCALAPPDATA\Android\Sdk\platform-tools"
```

---

## First time setup

```powershell
cd opennow-stable
npm install
```

The `android/` folder is already checked in. You do not need to run `cap init` or `cap add android`.

---

## Build and install

### Step 1 - Build the web bundle

```powershell
npm run build
```

### Step 2 - Sync web assets into the Android project

```powershell
npx cap sync android
```

Copies `dist/` into the Android project and updates Capacitor plugins.
Run this every time after `npm run build`.

### Step 3 - Build the APK

```powershell
cd android
.\gradlew assembleDebug
```

Output: `android/app/build/outputs/apk/debug/app-debug.apk`

### Step 4 - Install on device

Make sure your device is connected with USB debugging enabled.

```powershell
# Check device is visible
adb devices

# Uninstall old version first (avoids signature mismatch errors)
adb uninstall com.zortos.opennow

# Install
adb install app\build\outputs\apk\debug\app-debug.apk
```

---

## Quick rebuild (after any code change)

Run all steps from the project root:

```powershell
cd opennow-stable
npm run build
npx cap sync android
cd android
.\gradlew assembleDebug
adb uninstall com.zortos.opennow
adb install app\build\outputs\apk\debug\app-debug.apk
```

---

## Open in Android Studio

```powershell
npx cap open android
```

Or open the `android/` folder directly in Android Studio.

---

## Logcat (debug output)

```powershell
# Live output filtered to app logs
adb logcat | Select-String "Capacitor|chromium|WebRTC|GfnPlugin"

# Last 200 lines then exit
adb logcat -d | Select-String "Capacitor|Console|error" | Select-Object -Last 200
```

---

## Android details

- App ID: `com.zortos.opennow`
- Min SDK: API 24 (Android 7.0)
- Target/Compile SDK: API 36

## How it works

| Feature | Implementation |
|---------|---------------|
| Auth (login) | Kotlin `GfnPlugin.kt` -- opens a WebView activity for NVIDIA OAuth PKCE. Tokens stored in `EncryptedSharedPreferences` |
| Games API | Browser `fetch` running directly in the WebView -- no Kotlin involved |
| Session management | Browser `fetch` running directly in the WebView -- no Kotlin involved |
| Signaling | `BrowserSignalingClient` -- native WebSocket in the WebView -- no Kotlin involved |
| WebRTC | Browser built-in WebRTC stack inside the WebView |
| Settings | Kotlin `GfnPlugin.kt` -- stored in `SharedPreferences` |


---

## Touch controls (on-screen controller)

Every stream on Android can be played with a fully customisable virtual
gamepad that is drawn over the video. Open **Settings → Touch controls** to
tune it; the panel contains a live preview so you can see the result before
you start a game.

### Layout presets

| Preset | What it is good for |
|--------|---------------------|
| Classic | D-pad + left stick left, face buttons + right stick right |
| Compact | Everything tucked into the bottom corners (small phones) |
| Split | Sticks in the bottom corners, face/D-pad higher up, bumpers on top |
| Shooter | Single movement stick, big face cluster, triggers under the index fingers |
| Twin sticks | Both sticks low, buttons above them -- twin-stick games |
| Arcade | Large D-pad and buttons, no sticks -- fighters and retro titles |
| Clean | Only sticks + face buttons, for HUD-heavy games |
| Thumb pads | Face buttons and D-pad close to the thumbs |
| Custom | Your own dragged-out arrangement |

### Themes

Ten colour themes ship out of the box: Obsidian, Aurora, Ember, Neon, Ice,
Xbox, PlayStation, Matrix, Sakura and Gold. A theme recolours the whole
overlay (buttons, sticks, D-pad, glow) and the face-button glyph colours.

### Per-control options

- Overall size and opacity of the overlay
- Independent button and thumbstick scale
- Stick deadzone and sensitivity (per-device drift fix)
- Invert Y per stick, swap stick roles, left-handed mirror
- Show/hide each cluster: D-pad, face buttons, bumpers + triggers,
  Start/Back/Guide, left stick, right stick
- Face button glyph set: Xbox, PlayStation, Nintendo or plain letters
- Triggers: digital tap or analog drag (real 0-255 trigger values)
- Haptics: off / light / medium / strong (uses `VIBRATE`)

### Drag-to-reposition while playing

While streaming, tap the floating **Tune** button on the right edge:

1. **Edit layout** -- every cluster becomes draggable
2. Move the controls where your thumbs want them
3. **Done** -- the layout switches to **Custom** automatically and is saved

**Reset** in the settings section (or the Tune panel) returns everything to
the defaults. All values are stored in Android `SharedPreferences`
(`opennow_settings`), so they survive app restarts.

---

## Automated builds (GitHub Actions)

| Workflow | File | What it produces |
|----------|------|------------------|
| `auto-build` | `.github/workflows/auto-build.yml` | Desktop installers (Windows, macOS, Linux) |
| `android-build` | `.github/workflows/android-build.yml` | Android APKs (debug + release) |

The Android workflow runs on every push/PR that touches `opennow-stable/`
and can also be started manually (**Actions → android-build → Run workflow**).
It performs the exact steps from the manual build section:

```
npm ci   ->   npm run build   ->   npx cap sync android   ->   ./gradlew assembleDebug / assembleRelease
```

CI uses **JDK 21** on `ubuntu-24.04` because Capacitor 8 compiles Android modules with
`--release 21` (JDK 17 fails with `invalid source release: 21`).

Artifacts are attached to the run as `opennow-android-apk`
(`OpenNOW-<version>-debug.apk` and `OpenNOW-<version>-release.apk`).

### Versioning

`versionName` / `versionCode` are injected at build time
(`-PopenNowVersionName=... -PopenNowVersionCode=...`):

- branch builds use `0.0.0-nightly.<run number>`
- tag builds use the tag name (e.g. `v0.4.0`), and the APKs are then
  published on a GitHub release

### Signing the release APK

The release build looks for signing material in `android/keystore.properties`
(never committed, listed in `.gitignore`):

```properties
RELEASE_STORE_FILE=/absolute/path/to/release.keystore
RELEASE_STORE_PASSWORD=...
RELEASE_KEY_ALIAS=...
RELEASE_KEY_PASSWORD=...
```

In CI the same values are read from environment variables, so add these
repository secrets to get a signed release APK:

| Secret | Content |
|--------|---------|
| `ANDROID_KEYSTORE_BASE64` | `base64 -w0 release.keystore` |
| `ANDROID_KEYSTORE_PASSWORD` | store password |
| `ANDROID_KEY_ALIAS` | key alias |
| `ANDROID_KEY_PASSWORD` | key password |

Without them the release APK is built unsigned instead of failing.

> **Tip:** `npm ci` downloads the Electron binary by default. For
> Android-only work set `ELECTRON_SKIP_BINARY_DOWNLOAD=1` (the workflow does
> this for you) to save time and bandwidth.
