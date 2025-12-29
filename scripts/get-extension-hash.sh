#!/bin/bash
#
# Get SHA256 hash of an extension release
#
# Usage:
#   ./scripts/get-extension-hash.sh <owner/repo> [version]
#
# Examples:
#   ./scripts/get-extension-hash.sh einord/stina-ext-ollama
#   ./scripts/get-extension-hash.sh einord/stina-ext-ollama v1.0.1
#
# If no version is specified, the latest release is used.
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check arguments
if [ -z "$1" ]; then
    echo -e "${RED}Error: Repository required${NC}"
    echo ""
    echo "Usage: $0 <owner/repo> [version]"
    echo ""
    echo "Examples:"
    echo "  $0 einord/stina-ext-ollama"
    echo "  $0 einord/stina-ext-ollama v1.0.1"
    exit 1
fi

REPO="$1"
VERSION="$2"

# Create temp directory
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

echo -e "${BLUE}Repository:${NC} $REPO"

# Get release info from GitHub API
if [ -z "$VERSION" ]; then
    echo -e "${BLUE}Fetching latest release...${NC}"
    RELEASE_URL="https://api.github.com/repos/$REPO/releases/latest"
else
    echo -e "${BLUE}Fetching release $VERSION...${NC}"
    RELEASE_URL="https://api.github.com/repos/$REPO/releases/tags/$VERSION"
fi

# Fetch release data
RELEASE_DATA=$(curl -s "$RELEASE_URL")

# Check if release exists
if echo "$RELEASE_DATA" | grep -q '"message": "Not Found"'; then
    echo -e "${RED}Error: Release not found${NC}"
    exit 1
fi

# Extract version tag
TAG_NAME=$(echo "$RELEASE_DATA" | grep -o '"tag_name": "[^"]*"' | head -1 | cut -d'"' -f4)
echo -e "${BLUE}Version:${NC} $TAG_NAME"

# Find the zip asset
# Look for .zip files in assets
ASSETS=$(echo "$RELEASE_DATA" | grep -o '"browser_download_url": "[^"]*\.zip"' | cut -d'"' -f4)

if [ -z "$ASSETS" ]; then
    echo -e "${RED}Error: No .zip assets found in release${NC}"
    exit 1
fi

# If multiple zips, show them and use first one
ASSET_COUNT=$(echo "$ASSETS" | wc -l | tr -d ' ')
if [ "$ASSET_COUNT" -gt 1 ]; then
    echo -e "${YELLOW}Warning: Multiple zip files found, using first one:${NC}"
    echo "$ASSETS" | head -5
fi

DOWNLOAD_URL=$(echo "$ASSETS" | head -1)
FILENAME=$(basename "$DOWNLOAD_URL")

echo -e "${BLUE}Asset:${NC} $FILENAME"
echo -e "${BLUE}Downloading...${NC}"

# Download the zip
curl -sL "$DOWNLOAD_URL" -o "$TEMP_DIR/$FILENAME"

# Calculate SHA256
echo -e "${BLUE}Calculating SHA256...${NC}"
if command -v sha256sum &> /dev/null; then
    SHA256=$(sha256sum "$TEMP_DIR/$FILENAME" | cut -d' ' -f1)
elif command -v shasum &> /dev/null; then
    SHA256=$(shasum -a 256 "$TEMP_DIR/$FILENAME" | cut -d' ' -f1)
else
    echo -e "${RED}Error: No sha256sum or shasum command found${NC}"
    exit 1
fi

# Extract and show manifest info
echo -e "${BLUE}Extracting manifest...${NC}"
unzip -q "$TEMP_DIR/$FILENAME" -d "$TEMP_DIR/extracted" 2>/dev/null || true

MANIFEST_FILE="$TEMP_DIR/extracted/manifest.json"
if [ -f "$MANIFEST_FILE" ]; then
    MANIFEST_ID=$(grep -o '"id": "[^"]*"' "$MANIFEST_FILE" | head -1 | cut -d'"' -f4)
    MANIFEST_VERSION=$(grep -o '"version": "[^"]*"' "$MANIFEST_FILE" | head -1 | cut -d'"' -f4)
    MANIFEST_NAME=$(grep -o '"name": "[^"]*"' "$MANIFEST_FILE" | head -1 | cut -d'"' -f4)

    echo ""
    echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}Extension Info (from manifest.json)${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
    echo -e "  ID:      ${MANIFEST_ID}"
    echo -e "  Name:    ${MANIFEST_NAME}"
    echo -e "  Version: ${MANIFEST_VERSION}"
fi

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}Hash Information${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
echo -e "  Tag:     ${TAG_NAME}"
echo -e "  SHA256:  ${SHA256}"
echo ""

# Output JSON snippet for registry
echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}Copy this to registry.json verifiedVersions:${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
echo ""
echo "{"
echo "  \"version\": \"${MANIFEST_VERSION:-${TAG_NAME#v}}\","
echo "  \"sha256\": \"$SHA256\","
echo "  \"verifiedAt\": \"$(date +%Y-%m-%d)\""
echo "}"
echo ""
