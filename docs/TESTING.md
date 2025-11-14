# PropStack MCP Server - Testing Guide

## Manual Integration Testing

### Prerequisites

1. PropStack API key (create at [propstack.de](https://propstack.de))
2. Node.js 18+
3. Claude Code or compatible MCP client

### Test Setup

#### 1. Create Test Environment

```bash
cd /Users/andreas/Documents/Projekte/dev/immo/propstack-mcp
cp .env.example .env
# Edit .env and add your PropStack API key
```

#### 2. Configure Claude Code

Add to `.claude/settings.local.json` in your project:

```json
{
  "mcpServers": {
    "propstack": {
      "command": "node",
      "args": ["/Users/andreas/Documents/Projekte/dev/immo/propstack-mcp/dist/index.js"],
      "env": {
        "PROPSTACK_API_KEY": "your-test-api-key-here"
      }
    }
  }
}
```

Or test via npx (once published):

```json
{
  "mcpServers": {
    "propstack": {
      "command": "npx",
      "args": ["-y", "@sigloch/mcp-propstack"],
      "env": {
        "PROPSTACK_API_KEY": "your-test-api-key-here"
      }
    }
  }
}
```

### Test Cases

#### Test 1: List Tools

**Expected Result:** Should list all 5 tools:
- propstack_search_properties
- propstack_get_property
- propstack_list_statuses
- propstack_create_property
- propstack_update_property

#### Test 2: Search Properties

**Test Query:**
```
Use propstack to search for apartments between 300k and 500k EUR
```

**Expected Behavior:**
- Tool call: `propstack_search_properties`
- Parameters: `{ price_from: 300000, price_to: 500000, property_type: "APARTMENT" }`
- Returns JSON array of properties

#### Test 3: Get Property Details

**Test Query:**
```
Get details for property with ID [use real ID from search results]
```

**Expected Behavior:**
- Tool call: `propstack_get_property`
- Validates property ID format
- Returns detailed property object

#### Test 4: Security Validation

**Test Query (Injection Attempt):**
```
Search for properties with type "APARTMENT'; DROP TABLE--"
```

**Expected Behavior:**
- Query is sanitized (removes `;` and `'`)
- No SQL injection possible
- Returns safe results or error

#### Test 5: Error Handling

**Test Query:**
```
Get property with invalid ID: "bad@id"
```

**Expected Behavior:**
- Error: "Invalid property ID format"
- No API call made (validation fails first)

### Integration Test Results

| Test Case | Status | Notes |
|-----------|--------|-------|
| List Tools | ⏳ Pending | |
| Search Properties | ⏳ Pending | |
| Get Property | ⏳ Pending | |
| Security Validation | ⏳ Pending | |
| Error Handling | ⏳ Pending | |

### Performance Benchmarks

- **Tool Invocation**: Target < 100ms
- **API Response**: Depends on PropStack (typically 200-500ms)
- **Rate Limiting**: 90 req/min max

### Security Checklist

- [x] API key via environment variable
- [x] HTTPS enforcement
- [x] Input validation (property IDs)
- [x] Query sanitization (SQL injection prevention)
- [x] Error message sanitization (credential redaction)
- [x] No credential storage
- [ ] Manual test: Verify no keys in error output
- [ ] Manual test: Verify rate limiting behavior

### Debugging

**Enable MCP Server Logs:**

```bash
# Run server directly with debugging
cd /Users/andreas/Documents/Projekte/dev/immo/propstack-mcp
PROPSTACK_API_KEY="your-key" node dist/index.js
```

**Check Claude Code MCP Logs:**

Check IDE/editor logs for MCP server stderr output.

### Known Issues

1. **PropStack API Rate Limits**: Unknown (not documented publicly)
   - Mitigation: Client-side limiting at 90 req/min

2. **API Documentation Incomplete**: Some endpoints may not match documentation
   - Mitigation: Test with real API to validate

### Next Steps for Production

1. ✅ Unit tests passing (15/15)
2. ⏳ Manual integration testing
3. ⏳ Performance testing with real API
4. ⏳ Security audit
5. ⏳ Publish to NPM
6. ⏳ Submit to MCP Registry
