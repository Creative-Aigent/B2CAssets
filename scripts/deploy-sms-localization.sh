#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# deploy-sms-localization.sh
# 
# Downloads the current TrustFrameworkExtensions policy from Azure AD B2C,
# patches in the AIMAN SMS localization block, and uploads it back.
#
# Prerequisites:
#   - az cli logged in (`az login --tenant <b2c-tenant>.onmicrosoft.com`)
#   - App registration with Policy.ReadWrite.TrustFramework permission
#   - jq, xmllint (libxml2) installed
#
# Usage:
#   ./scripts/deploy-sms-localization.sh [--dry-run] [--policy-id POLICY_ID]
#
# Options:
#   --dry-run       Download and patch but don't upload
#   --policy-id     Policy to patch (default: B2C_1A_TrustFrameworkExtensions)
#   --tenant        B2C tenant name (e.g. creativeaigentdev)
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
LOCALIZATION_FILE="$REPO_DIR/policies/sms-localization.xml"
BACKUP_DIR="$REPO_DIR/policies/backups"

# Defaults
POLICY_ID="B2C_1A_TrustFrameworkExtensions"
DRY_RUN=false
TENANT=""

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --dry-run)    DRY_RUN=true; shift ;;
    --policy-id)  POLICY_ID="$2"; shift 2 ;;
    --tenant)     TENANT="$2"; shift 2 ;;
    -h|--help)
      echo "Usage: $0 [--dry-run] [--policy-id ID] [--tenant NAME]"
      echo ""
      echo "Options:"
      echo "  --dry-run       Download and patch but don't upload"
      echo "  --policy-id     Policy to patch (default: B2C_1A_TrustFrameworkExtensions)"
      echo "  --tenant        B2C tenant name (e.g. creativeaigentdev)"
      exit 0
      ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# Validate prerequisites
for cmd in az jq xmllint; do
  if ! command -v "$cmd" &>/dev/null; then
    echo "❌ Required tool '$cmd' not found. Install it first."
    [[ "$cmd" == "xmllint" ]] && echo "   brew install libxml2  (macOS)"
    exit 1
  fi
done

if [[ ! -f "$LOCALIZATION_FILE" ]]; then
  echo "❌ Localization template not found: $LOCALIZATION_FILE"
  exit 1
fi

# Get access token
echo "🔑 Getting access token..."
if [[ -n "$TENANT" ]]; then
  TOKEN=$(az account get-access-token \
    --resource-type ms-graph \
    --tenant "${TENANT}.onmicrosoft.com" \
    --query accessToken -o tsv 2>/dev/null) || {
    echo "❌ Failed to get token. Run: az login --tenant ${TENANT}.onmicrosoft.com"
    exit 1
  }
else
  TOKEN=$(az account get-access-token \
    --resource-type ms-graph \
    --query accessToken -o tsv 2>/dev/null) || {
    echo "❌ Failed to get token. Run: az login --tenant <your-b2c-tenant>.onmicrosoft.com"
    exit 1
  }
fi

GRAPH_BASE="https://graph.microsoft.com/beta/trustFramework/policies"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

# Download current policy
echo "📥 Downloading policy: $POLICY_ID ..."
CURRENT_POLICY=$(mktemp /tmp/b2c-policy-XXXXXX.xml)

HTTP_CODE=$(curl -s -w "%{http_code}" -o "$CURRENT_POLICY" \
  -H "Authorization: Bearer $TOKEN" \
  "${GRAPH_BASE}/${POLICY_ID}/\$value")

if [[ "$HTTP_CODE" != "200" ]]; then
  echo "❌ Failed to download policy (HTTP $HTTP_CODE)"
  cat "$CURRENT_POLICY"
  rm -f "$CURRENT_POLICY"
  exit 1
fi

echo "✅ Downloaded ($(wc -c < "$CURRENT_POLICY" | tr -d ' ') bytes)"

# Create backup
mkdir -p "$BACKUP_DIR"
BACKUP_FILE="$BACKUP_DIR/${POLICY_ID}_${TIMESTAMP}.xml"
cp "$CURRENT_POLICY" "$BACKUP_FILE"
echo "💾 Backup saved: $BACKUP_FILE"

# Check if Localization block already exists
PATCHED_POLICY=$(mktemp /tmp/b2c-policy-patched-XXXXXX.xml)

if grep -q 'ver_sms_body' "$CURRENT_POLICY"; then
  echo "⚠️  Policy already contains ver_sms_body localization."
  echo "   Replacing existing SMS localization block..."
  
  # Use Python for reliable XML manipulation
  python3 - "$CURRENT_POLICY" "$LOCALIZATION_FILE" "$PATCHED_POLICY" << 'PYTHON_SCRIPT'
import sys
import re

current_file, localization_file, output_file = sys.argv[1], sys.argv[2], sys.argv[3]

with open(current_file, 'r', encoding='utf-8') as f:
    policy_xml = f.read()

with open(localization_file, 'r', encoding='utf-8') as f:
    loc_content = f.read()

# Extract just the LocalizedResources blocks for phonefactor
loc_blocks = re.findall(
    r'<LocalizedResources Id="api\.phonefactor\.[^"]*">.*?</LocalizedResources>',
    loc_content, re.DOTALL
)

if not loc_blocks:
    print("❌ No phonefactor LocalizedResources found in template")
    sys.exit(1)

# Replace existing phonefactor LocalizedResources
for block in loc_blocks:
    lang_match = re.search(r'Id="api\.phonefactor\.([^"]*)"', block)
    if lang_match:
        lang = lang_match.group(1)
        pattern = rf'<LocalizedResources Id="api\.phonefactor\.{re.escape(lang)}">.*?</LocalizedResources>'
        if re.search(pattern, policy_xml, re.DOTALL):
            policy_xml = re.sub(pattern, block, policy_xml, flags=re.DOTALL)
            print(f"   Replaced: api.phonefactor.{lang}")
        else:
            # Insert before </Localization>
            policy_xml = policy_xml.replace(
                '</Localization>',
                f'\n  {block}\n</Localization>'
            )
            print(f"   Added: api.phonefactor.{lang}")

with open(output_file, 'w', encoding='utf-8') as f:
    f.write(policy_xml)

print("✅ Patch applied")
PYTHON_SCRIPT

else
  echo "📝 No existing SMS localization found. Inserting new block..."
  
  python3 - "$CURRENT_POLICY" "$LOCALIZATION_FILE" "$PATCHED_POLICY" << 'PYTHON_SCRIPT'
import sys
import re

current_file, localization_file, output_file = sys.argv[1], sys.argv[2], sys.argv[3]

with open(current_file, 'r', encoding='utf-8') as f:
    policy_xml = f.read()

with open(localization_file, 'r', encoding='utf-8') as f:
    loc_content = f.read()

# Extract the full Localization block content (between the XML comments)
loc_blocks = re.findall(
    r'<LocalizedResources Id="api\.phonefactor\.[^"]*">.*?</LocalizedResources>',
    loc_content, re.DOTALL
)

if not loc_blocks:
    print("❌ No phonefactor LocalizedResources found in template")
    sys.exit(1)

new_resources = '\n'.join(f'  {b}' for b in loc_blocks)

# Check if there's an existing <Localization> block to append to
if '<Localization' in policy_xml:
    # Insert before </Localization>
    policy_xml = policy_xml.replace(
        '</Localization>',
        f'\n{new_resources}\n</Localization>'
    )
    print("✅ Inserted into existing <Localization> block")
else:
    # Need to create a Localization block — insert before </BuildingBlocks> or </TrustFrameworkPolicy>
    loc_wrapper = f"""
  <Localization Enabled="true">
    <SupportedLanguages DefaultLanguage="en" MergeBehavior="ReplaceAll">
      <SupportedLanguage>en</SupportedLanguage>
      <SupportedLanguage>fr</SupportedLanguage>
      <SupportedLanguage>es</SupportedLanguage>
      <SupportedLanguage>ar</SupportedLanguage>
    </SupportedLanguages>

{new_resources}
  </Localization>"""

    if '</BuildingBlocks>' in policy_xml:
        policy_xml = policy_xml.replace(
            '</BuildingBlocks>',
            f'{loc_wrapper}\n  </BuildingBlocks>'
        )
        print("✅ Created <Localization> block inside <BuildingBlocks>")
    else:
        policy_xml = policy_xml.replace(
            '</TrustFrameworkPolicy>',
            f'  <BuildingBlocks>{loc_wrapper}\n  </BuildingBlocks>\n</TrustFrameworkPolicy>'
        )
        print("✅ Created <BuildingBlocks> + <Localization> block")

with open(output_file, 'w', encoding='utf-8') as f:
    f.write(policy_xml)
PYTHON_SCRIPT

fi

# Validate XML
if xmllint --noout "$PATCHED_POLICY" 2>/dev/null; then
  echo "✅ Patched XML is well-formed"
else
  echo "⚠️  XML validation warning (B2C policies may use custom namespaces)"
fi

# Show diff
echo ""
echo "📋 Changes:"
diff --unified=3 "$CURRENT_POLICY" "$PATCHED_POLICY" || true
echo ""

if $DRY_RUN; then
  echo "🔍 DRY RUN — patched file saved to: $PATCHED_POLICY"
  echo "   Review and upload manually if satisfied."
  rm -f "$CURRENT_POLICY"
  exit 0
fi

# Confirm upload
echo "⬆️  Ready to upload patched policy: $POLICY_ID"
read -rp "   Continue? [y/N] " confirm
if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
  echo "❌ Cancelled. Patched file: $PATCHED_POLICY"
  rm -f "$CURRENT_POLICY"
  exit 0
fi

# Upload
echo "⬆️  Uploading policy..."
HTTP_CODE=$(curl -s -w "%{http_code}" -o /dev/null \
  -X PUT \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/xml" \
  --data-binary @"$PATCHED_POLICY" \
  "${GRAPH_BASE}/${POLICY_ID}/\$value")

if [[ "$HTTP_CODE" == "200" || "$HTTP_CODE" == "201" ]]; then
  echo "✅ Policy uploaded successfully!"
else
  echo "❌ Upload failed (HTTP $HTTP_CODE)"
  echo "   Backup available: $BACKUP_FILE"
  echo "   Patched file: $PATCHED_POLICY"
  rm -f "$CURRENT_POLICY"
  exit 1
fi

# Cleanup
rm -f "$CURRENT_POLICY" "$PATCHED_POLICY"
echo ""
echo "Done. SMS messages will now show 'AIMAN' in all 4 languages."
echo "Backup: $BACKUP_FILE"
