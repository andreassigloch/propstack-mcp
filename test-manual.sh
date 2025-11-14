#!/bin/bash
# Manual MCP Server Test Script
# @author andreas@siglochconsulting

set -e

echo "🧪 PropStack MCP Server - Manual Test"
echo "======================================"
echo ""

# Check environment
if [ -z "$PROPSTACK_API_KEY" ]; then
    echo "❌ Error: PROPSTACK_API_KEY not set"
    echo "   Set it with: export PROPSTACK_API_KEY='your-key'"
    exit 1
fi

echo "✅ API key found"
echo ""

# Build if needed
if [ ! -d "dist" ]; then
    echo "📦 Building project..."
    npm run build
    echo ""
fi

echo "🚀 Starting MCP server..."
echo "   (Server runs on stdio - it will wait for input)"
echo "   Use Ctrl+C to exit"
echo ""
echo "To test with Claude Code:"
echo "1. Add this to your .claude/settings.local.json:"
echo ""
echo '{
  "mcpServers": {
    "propstack": {
      "command": "node",
      "args": ["'$(pwd)'/dist/index.js"],
      "env": {
        "PROPSTACK_API_KEY": "'$PROPSTACK_API_KEY'"
      }
    }
  }
}'
echo ""
echo "2. Restart Claude Code"
echo "3. Test with: 'List available PropStack tools'"
echo ""
echo "Press Enter to start server (Ctrl+C to exit)..."
read

node dist/index.js
