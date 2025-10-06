#!/bin/bash

# JuridicAI API Documentation Preview Script
# This script starts a local development server to preview the API documentation

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Print colored message
print_info() {
    echo -e "${BLUE}ℹ ${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Banner
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ⚖️  JuridicAI API Documentation Preview"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Change to docs directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

print_info "Current directory: $SCRIPT_DIR"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js first."
    print_info "Visit: https://nodejs.org/"
    exit 1
fi

print_success "Node.js is installed ($(node --version))"

# Check if npm/pnpm is installed
if command -v pnpm &> /dev/null; then
    PKG_MANAGER="pnpm"
    print_success "Using pnpm as package manager"
elif command -v npm &> /dev/null; then
    PKG_MANAGER="npm"
    print_success "Using npm as package manager"
else
    print_error "No package manager found. Please install npm or pnpm."
    exit 1
fi

# Check if Redocly CLI is installed
if ! command -v redocly &> /dev/null; then
    print_warning "Redocly CLI is not installed globally."
    print_info "Installing Redocly CLI..."

    if [ "$PKG_MANAGER" = "pnpm" ]; then
        pnpm add -g @redocly/cli
    else
        npm install -g @redocly/cli
    fi

    print_success "Redocly CLI installed successfully"
else
    print_success "Redocly CLI is installed ($(redocly --version))"
fi

# Validate OpenAPI spec
print_info "Validating OpenAPI specification..."

if redocly lint openapi.yaml; then
    print_success "OpenAPI specification is valid ✨"
else
    print_error "OpenAPI specification has validation errors"
    print_warning "Continuing anyway... Fix the errors for production use."
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  🚀 Starting preview server..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Default port
PORT="${PORT:-8080}"

print_info "Documentation will be available at:"
echo ""
echo -e "  ${GREEN}➜${NC}  Local:   ${BLUE}http://localhost:$PORT${NC}"
echo -e "  ${GREEN}➜${NC}  Network: ${BLUE}http://$(ipconfig getifaddr en0 2>/dev/null || echo 'N/A'):$PORT${NC}"
echo ""
print_warning "Press Ctrl+C to stop the server"
echo ""

# Start preview server
redocly preview-docs openapi.yaml --port="$PORT" --config=redocly.yaml

# Cleanup on exit
trap 'echo "" && print_info "Shutting down preview server..." && print_success "Goodbye! 👋"' EXIT
