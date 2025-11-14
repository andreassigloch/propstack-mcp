# PropStack MCP Server

Model Context Protocol (MCP) server for PropStack real estate API integration with DSGVO-compliant data handling.

**Read-Only Server:** This server only provides read access to PropStack data. No write/update operations.

**Privacy:** GPS coordinates are rounded to ~111m precision. Broker contact data is filtered from responses.

## Installation

### Option 1: MCPB Bundle (Recommended for Non-Technical Users)

1. Download `propstack-mcp-v0.1.0.mcpb` from [Releases](https://github.com/andreassigloch/propstack-mcp/releases)
2. Double-click the `.mcpb` file to install
3. Enter your PropStack API key when prompted
4. Restart Claude Desktop

**Updates:** Download new `.mcpb` file from Releases, uninstall old version, install new version

### Option 2: npm Package (Recommended for Technical Users)

```bash
# Global installation
npm install -g mcp-propstack

# Or use with npx (no installation)
npx mcp-propstack
```

**Updates:**
```bash
npm update -g mcp-propstack
# or
npm install -g mcp-propstack@latest
```

### Option 3: Claude Desktop Manual Config

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS):

```json
{
  "mcpServers": {
    "propstack": {
      "command": "npx",
      "args": ["-y", "mcp-propstack@latest"],
      "env": {
        "PROPSTACK_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

**Updates:** Automatic with `@latest`, or change version number

## Security & Privacy

### DSGVO Compliance

This server implements privacy-by-design:
- ✅ GPS coordinates rounded to 3 decimal places (~111m precision)
- ✅ Broker personal contact data removed from responses
- ✅ No persistent storage of user data
- ✅ Read-only API access (no write operations)

### API Key Security

**Create a restricted API key in PropStack:**
- Enable **read-only** permissions only
- Set expiration date for temporary use
- Add IP whitelist if possible
- Never commit keys to version control

**Secure storage:**
- Use environment variables
- Add `.env` to `.gitignore`
- Use `chmod 600` on config files
- Rotate keys periodically

## Features

### Tools

**propstack_search_properties**
- Search properties with filters (status, price, area, type)
- Returns: id, unit_id, name, city, street, status, price, living_space, rooms
- Context-optimized (75% less data vs full expand)
- BEST PRACTICE: Filter by status `"vermarktung,reserviert"` for active listings

**propstack_get_property**
- Get complete details by unit_id
- Returns ~275 fields including images, descriptions, features
- Privacy-filtered: GPS rounded, broker data removed

**propstack_list_statuses**
- List all available property statuses with IDs
- Use for filtering searches

### Resources

**propstack://properties/all**
- Overview of all properties (id, name, city, street, status)

**propstack://properties/active**
- Properties with status Vermarktung or Reserviert

**propstack://properties/single/{unit_id}**
- Single property WITHOUT media (context-efficient)

**propstack://properties/single_all/{unit_id}**
- Single property WITH media (images, documents)

### Prompts

**propstack-overview**
- Generate overview summary of all properties
- Optional: filter by status

## Usage Examples

### Search Active Apartments in Price Range

```typescript
propstack_search_properties({
  status: "vermarktung,reserviert",
  price_from: 300000,
  price_to: 500000,
  property_type: "APARTMENT",
  per: 50
})
```

### Get Property Details

```typescript
propstack_get_property({
  unit_id: "100"
})
```

### Use Status Semantic Names

```typescript
propstack_search_properties({
  status: "vermarktung,reserviert"  // or use IDs: "133880,133881"
})
```

## Development

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run tests
npm test

# Watch mode (development)
npm run dev

# Create MCPB bundle
npx @anthropic-ai/mcpb@latest pack
```

## Technical Details

**Technology Stack:**
- Node.js 18+
- TypeScript
- MCP SDK 1.0.4
- PropStack API v1

**Context Optimization:**
- Search uses minimal API response (no expand=1) → 75% bandwidth reduction
- Overview resources return only essential fields
- Full details only when explicitly requested

**Privacy Implementation:**
- GPS rounding: `Math.round(lat * 1000) / 1000`
- Broker data filtering: removes `broker`, `openimmo_*` fields
- Applied to all tools, resources, and prompts

## Requirements

- Node.js 18.0.0 or higher
- PropStack API key (read-only permissions)
- Claude Desktop 0.10.0+ (for MCPB installation)

## Troubleshooting

**Connection fails:**
- Check API key is correct
- Verify read permissions are enabled in PropStack
- Check network connectivity to api.propstack.de

**"Access to everything" warning:**
- Normal for local MCP servers
- Server runs with your user permissions
- Review source code if concerned

## Contributing

This is a personal project. Issues and PRs welcome but no guarantees on response time.

## License

MIT License - See [LICENSE](LICENSE)

## Author

Andreas Sigloch
andreas@siglochconsulting.de

## Links

- [PropStack API Documentation](https://docs.propstack.de)
- [MCP Specification](https://modelcontextprotocol.io)
- [GitHub Repository](https://github.com/andreassigloch/propstack-mcp)
- [npm Package](https://www.npmjs.com/package/mcp-propstack)
