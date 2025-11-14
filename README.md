# PropStack MCP Server

Model Context Protocol (MCP) server for PropStack real estate API integration.

** Warning: there is absolutely no warranty for any damage to your propstack data or leak of GDPR / DSVGO relevant data! Choose your API-Key permissions VERY Carefully. It is NOT designed tested for write operations **


## Quick Start

### Installation

```bash
# Via npx (no installation required)
npx @sigloch/mcp-propstack

# Or install globally
npm install -g @sigloch/mcp-propstack
```

### Configuration

Add to your Claude Code or compatible MCP client configuration:

```json
{
  "mcpServers": {
    "propstack": {
      "command": "npx",
      "args": ["-y", "@sigloch/mcp-propstack"],
      "env": {
        "PROPSTACK_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

## Security Best Practices

### 1. Create a Restricted API Key

In PropStack dashboard:
- Enable only required permissions (e.g., read-only for queries)
- Add IP whitelist if using from static location
- Set expiration date for temporary use

### 2. Store Key Securely

- Use environment variables (never commit to git)
- Add `.env` to `.gitignore`
- Use `chmod 600` on config files
- Consider 1Password CLI for key injection
- Rotate keys periodically

### 3. Monitor Usage

- Review PropStack API logs regularly
- Set up alerts for unusual activity
- Revoke compromised keys immediately
- Use different keys for different projects

## Features

### Tools

- **propstack_search_properties**: Search with filters (price, area, type)
- **propstack_get_property**: Get property details by ID
- **propstack_list_statuses**: List available property statuses
- **propstack_create_property**: Create new property
- **propstack_update_property**: Update existing property

### Resources

- **propstack://properties/recent**: Recent properties

### Prompts

- **propstack-compare**: Compare two properties
- **propstack-market-report**: Generate market report

## Examples

### Search Properties

```typescript
// Search apartments in price range
propstack_search_properties({
  price_from: 300000,
  price_to: 500000,
  property_type: "APARTMENT",
  limit: 10
})
```

### Get Property Details

```typescript
propstack_get_property({
  property_id: "prop-abc123"
})
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Watch mode
npm run dev
```

## Requirements

- Node.js 18+
- PropStack API key

## License

MIT

## Author

andreas@siglochconsulting

## Links

- [Documentation](./docs/Side-001-propstack-mcp-server.md)
- [PropStack API](https://docs.propstack.de)
- [MCP Specification](https://modelcontextprotocol.io)
