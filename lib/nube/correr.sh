#!/bin/bash
# Mor (Rocket Jam): instala cada app en el móvil simulado y le pasa su prueba de Maestro
AAPT=$(ls -d "$ANDROID_HOME"/build-tools/*/aapt 2>/dev/null | tail -1)
for ID in "$@"; do
  D="pruebas/$ID"; S="$D/salida"; rm -rf "$S"; mkdir -p "$S"
  INI=$(date -u +%FT%TZ)
  PKG=$("$AAPT" dump badging "$D/app.apk" 2>/dev/null | sed -n "s/^package: name='\([^']*\)'.*/\1/p")
  adb install -r -g "$D/app.apk" > "$S/instalar.txt" 2>&1
  if [ -z "$PKG" ] || ! grep -q Success "$S/instalar.txt"; then
    echo "{\"ok\":false,\"app\":\"$PKG\",\"inicio\":\"$INI\",\"fin\":\"$(date -u +%FT%TZ)\",\"error\":\"No se ha podido instalar la app en el móvil simulado\"}" > "$S/resultado.json"; continue
  fi
  touch /tmp/marca
  ( cd "$S" && maestro test -e APP_ID="$PKG" ../flow.yaml --format junit --output resultado.xml > log.txt 2>&1 ); R=$?
  find "$S" ~/.maestro/tests -name '*.png' -newer /tmp/marca 2>/dev/null | head -20 | while read f; do [ "$(dirname "$f")" = "$S" ] || cp "$f" "$S/"; done
  adb exec-out screencap -p > "$S/final.png" 2>/dev/null || true
  tail -c 6000 "$S/log.txt" > "$S/log_fin.txt"
  echo "{\"ok\":$([ $R = 0 ] && echo true || echo false),\"app\":\"$PKG\",\"inicio\":\"$INI\",\"fin\":\"$(date -u +%FT%TZ)\"}" > "$S/resultado.json"
  adb uninstall "$PKG" > /dev/null 2>&1 || true
done
