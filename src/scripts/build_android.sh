#!/usr/bin/env bash
set -e

# ==============================================================================
# Script de Compilation de APK pro Android (Tauri v2)
# ==============================================================================
# NOTA: Iste script NON VERSIONA ni augmenta numeros de version.
# Ille solmente lege le version fixate per `src/scripts/build.sh` in `version.json`.
# ==============================================================================

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RELEASES_DIR="$ROOT_DIR/releases"
VERSION_FILE="$ROOT_DIR/version.json"

cd "$ROOT_DIR"

if [ ! -f "$VERSION_FILE" ]; then
  echo "❌ Error: $VERSION_FILE non existe. Executa primarimente build.sh pro generar le version."
  exit 1
fi

echo "📖 1. Legente version fixate de $VERSION_FILE (sin alteration)..."
CURRENT_VERSION=$(node -e '
const fs = require("fs");
const path = "'"$VERSION_FILE"'";
const data = JSON.parse(fs.readFileSync(path, "utf8"));
console.log(data.version || "1.0");
')

echo "   ℹ️ Compilante con version existente: v$CURRENT_VERSION"

echo "🧹 2. Preparante directorio releases/..."
mkdir -p "$RELEASES_DIR"

echo "🏗️ 3. Compilante APK con Tauri v2..."
npx tauri android build --apk

# Cercar primarimente le APK signate (app-universal-release.apk)
SOURCE_APK="$ROOT_DIR/src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release.apk"

if [ ! -f "$SOURCE_APK" ]; then
  # Fallback si Gradle non usa universal o si es unsigned
  SOURCE_APK=$(find "$ROOT_DIR/src-tauri/gen/android/app/build/outputs/apk" -type f -name "app-*-release.apk" ! -name "*-unsigned.apk" | head -n 1)
fi

if [ ! -f "$SOURCE_APK" ]; then
  # Ultime recurso fallback
  SOURCE_APK=$(find "$ROOT_DIR/src-tauri/gen/android/app/build/outputs/apk" -type f -name "*.apk" | head -n 1)
fi

if [ -f "$SOURCE_APK" ]; then
  TARGET_APK="$RELEASES_DIR/DictionarioIALA-v$CURRENT_VERSION.apk"
  echo "🚚 4. Movente APK ($SOURCE_APK) a $TARGET_APK..."
  mv -f "$SOURCE_APK" "$TARGET_APK"
  echo "✅ APK preste e signate in releases:"
  ls -lh "$TARGET_APK"
else
  echo "❌ Error: Le archivo APK generate non esseva trovate in outputs."
  exit 1
fi
