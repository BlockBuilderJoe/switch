#!/bin/bash
# FuseBoard — Build script for Chrome, Firefox, and Safari
# Usage: ./build.sh [chrome|firefox|safari|all]

set -e

TARGET=${1:-all}
ROOT="$(cd "$(dirname "$0")" && pwd)"
EXT="$ROOT/extension"
DIST="$ROOT/dist"

# Shared files to copy
copy_shared() {
  local dest=$1
  mkdir -p "$dest/background" "$dest/blocked" "$dest/content" "$dest/data" "$dest/icons" "$dest/options" "$dest/popup" "$dest/sync"

  cp "$EXT/data/blocklists.js" "$dest/data/"
  cp "$EXT/content/content.js" "$dest/content/"
  cp "$EXT/content/content.css" "$dest/content/"
  cp "$EXT/blocked/blocked.html" "$dest/blocked/"
  cp "$EXT/blocked/blocked.js" "$dest/blocked/"
  cp "$EXT/icons/"*.png "$dest/icons/"
  cp "$EXT/icons/"*.svg "$dest/icons/" 2>/dev/null || true
  cp "$EXT/options/options.html" "$dest/options/"
  cp "$EXT/options/options.js" "$dest/options/"
  cp "$EXT/popup/popup.css" "$dest/popup/"
  cp "$EXT/popup/popup.html" "$dest/popup/"
  cp "$EXT/popup/popup.js" "$dest/popup/"
  cp "$EXT/sync/sync.js" "$dest/sync/"
}

build_chrome() {
  echo "Building Chrome..."
  local dest="$DIST/chrome"
  rm -rf "$dest"
  copy_shared "$dest"

  # Chrome uses importScripts in service worker (classic)
  cp "$EXT/background/background.js" "$dest/background/"
  cp "$EXT/manifest.json" "$dest/manifest.json"

  echo "Chrome build: $dest"
}

build_firefox() {
  echo "Building Firefox..."
  local dest="$DIST/firefox"
  rm -rf "$dest"
  copy_shared "$dest"

  # Firefox MV3: background scripts (not service_worker), importScripts not available
  # Merge sync.js into background.js as a single file
  cat "$EXT/sync/sync.js" > "$dest/background/background.js"
  echo "" >> "$dest/background/background.js"
  # Append background.js without the importScripts line
  grep -v "^importScripts" "$EXT/background/background.js" >> "$dest/background/background.js"

  # Firefox manifest: use background.scripts instead of service_worker
  cat > "$dest/manifest.json" << 'MANIFEST'
{
  "manifest_version": 3,
  "name": "FuseBoard",
  "version": "1.5.0",
  "description": "Your digital fuseboard. Block distracting sites and features.",
  "browser_specific_settings": {
    "gecko": {
      "id": "fuseboard@josephpalmer.co.uk",
      "strict_min_version": "109.0"
    }
  },
  "permissions": [
    "storage",
    "declarativeNetRequest",
    "declarativeNetRequestFeedback",
    "activeTab"
  ],
  "host_permissions": ["<all_urls>"],
  "action": {
    "default_popup": "popup/popup.html",
    "default_icon": {
      "16": "icons/icon-16.png",
      "48": "icons/icon-48.png",
      "128": "icons/icon-128.png"
    }
  },
  "options_ui": {
    "page": "options/options.html",
    "open_in_tab": true
  },
  "background": {
    "scripts": ["background/background.js"]
  },
  "content_scripts": [{
    "matches": ["<all_urls>"],
    "js": ["data/blocklists.js", "content/content.js"],
    "css": ["content/content.css"],
    "run_at": "document_start"
  }],
  "icons": {
    "16": "icons/icon-16.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png"
  }
}
MANIFEST

  echo "Firefox build: $dest"
}

build_safari() {
  echo "Building Safari..."
  local dest="$DIST/safari-src"
  rm -rf "$dest"
  copy_shared "$dest"

  # Safari uses the same approach as Firefox for background
  cat "$EXT/sync/sync.js" > "$dest/background/background.js"
  echo "" >> "$dest/background/background.js"
  grep -v "^importScripts" "$EXT/background/background.js" >> "$dest/background/background.js"

  # Safari manifest (MV3, similar to Chrome but no declarativeNetRequestFeedback)
  cat > "$dest/manifest.json" << 'MANIFEST'
{
  "manifest_version": 3,
  "name": "FuseBoard",
  "version": "1.5.0",
  "description": "Your digital fuseboard. Block distracting sites and features.",
  "permissions": [
    "storage",
    "declarativeNetRequest",
    "activeTab"
  ],
  "host_permissions": ["<all_urls>"],
  "action": {
    "default_popup": "popup/popup.html",
    "default_icon": {
      "16": "icons/icon-16.png",
      "48": "icons/icon-48.png",
      "128": "icons/icon-128.png"
    }
  },
  "options_page": "options/options.html",
  "background": {
    "service_worker": "background/background.js"
  },
  "content_scripts": [{
    "matches": ["<all_urls>"],
    "js": ["content/content.js"],
    "css": ["content/content.css"],
    "run_at": "document_start"
  }],
  "icons": {
    "16": "icons/icon-16.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png"
  }
}
MANIFEST

  echo "Safari source build: $dest"
  echo ""
  echo "To create the Safari extension Xcode project, run:"
  echo "  xcrun safari-web-extension-converter $dest --project-location $DIST/safari-xcode --app-name FuseBoard --bundle-identifier co.uk.josephpalmer.FuseBoard"
}

case "$TARGET" in
  chrome)  build_chrome ;;
  firefox) build_firefox ;;
  safari)  build_safari ;;
  all)
    build_chrome
    echo ""
    build_firefox
    echo ""
    build_safari
    ;;
  *)
    echo "Usage: $0 [chrome|firefox|safari|all]"
    exit 1
    ;;
esac

echo ""
echo "Done! Builds are in $DIST/"
