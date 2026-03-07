#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# bust-template-cache.sh
#
# Prints the cache-busted URLs to paste into the Azure B2C Portal
# for the user flow page layout customization.
#
# Azure B2C caches custom page HTML. Appending a new ?v= parameter
# forces it to re-fetch the latest version from GitHub Pages.
#
# Portal path:
#   Azure AD B2C → User flows → B2C_1_signupsigninphone → Page layouts
#   → Toggle "Use custom page content" → Paste the URL for each page type
#
# Usage:
#   ./scripts/bust-template-cache.sh
# ============================================================================

BASE_URL="https://creative-aigent.github.io/B2CAssets"
VERSION=$(date +%Y%m%d%H%M)

echo "========================================"
echo "  B2C Template Cache-Bust URLs"
echo "  Version: $VERSION"
echo "========================================"
echo ""
echo "Paste these into Azure Portal → Azure AD B2C"
echo "→ User flows → B2C_1_signupsigninphone → Page layouts"
echo ""
echo "─────────────────────────────────────────"
echo "  Unified sign up or sign in page:"
echo "  ${BASE_URL}/unified-clean.html?v=${VERSION}"
echo ""
echo "  Multifactor authentication page:"
echo "  ${BASE_URL}/phone-otp-clean.html?v=${VERSION}"
echo ""
echo "  Phone signIn page:"
echo "  ${BASE_URL}/signin-phone-clean.html?v=${VERSION}"
echo ""
echo "  Phone signUp page:"
echo "  ${BASE_URL}/phone-signup-clean.html?v=${VERSION}"
echo ""
echo "  Phone signUp recovery email collection page:"
echo "  ${BASE_URL}/selfasserted-clean.html?v=${VERSION}"
echo "─────────────────────────────────────────"
echo ""
echo "After pasting, click 'Save' on each page layout."
echo "Changes take effect immediately for new sign-in sessions."
