# Side Project: PropStack MCP Server

**Side-ID:** Side-001
**Project:** PropStack MCP Server
**Author:** andreas@siglochconsulting
**Date:** 2025-11-05
**Priority:** Low (Side Project)
**Status:** Planning

---

## Executive Summary

**Objective:** Standalone TypeScript MCP server for PropStack real estate API integration
**Distribution:** NPM public registry + Official MCP Registry
**Scope:** Separate project, not part of ImmoTechDemo codebase
**Estimated Effort:** 8-12 hours
**Reusability:** Community-wide tool for PropStack integrations

---

## Business Case

### Value Proposition
1. **Community Contribution**: First public MCP server for German real estate APIs
2. **Reusability**: Any Claude Code user with PropStack access can use it
3. **Portfolio Value**: Demonstrates MCP server development expertise
4. **Ecosystem Growth**: Expands MCP tooling for real estate domain

### Use Cases
- Real estate agents querying property inventory via Claude
- Automated property data analysis and reporting
- Cross-platform property synchronization
- CRM integration workflows

---

## Technical Architecture

### Technology Stack
- **Runtime:** Node.js 18+
- **Language:** TypeScript 5.7+
- **SDK:** `@modelcontextprotocol/sdk` (official)
- **Transport:** stdio (standard MCP)
- **API Client:** Axios or native fetch
- **Testing:** Vitest

### MCP Server Capabilities

#### 1. Tools (Actions)
```typescript
// Property search and filtering
propstack.searchProperties({
  price_from: number,
  price_to: number,
  plot_area: number,
  property_type: string
})

// Get property details
propstack.getProperty(id: string)

// List property statuses
propstack.listStatuses()

// Create/update property (write operations)
propstack.createProperty(data: object)
propstack.updateProperty(id: string, data: object)
```

#### 2. Resources (Data Sources)
```typescript
// Recent properties
propstack://properties/recent

// Property by ID
propstack://properties/{id}

// Property search results cache
propstack://search/{hash}
```

#### 3. Prompts (Templates)
```typescript
// Property comparison analysis
propstack-compare: Compare properties {id1} and {id2}

// Market analysis
propstack-market-report: Generate market report for {location}
```

### Configuration Schema
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

---

## Security Analysis

### Industry Research: CRM MCP Server Patterns

#### Analysis of Production CRM Servers (2025)
Research of established MCP servers handling sensitive customer data reveals consistent patterns:

**Official Implementations Reviewed:**
- **HubSpot MCP Server**: OAuth 2.0 with user permission scoping, preparing for OAuth 2.1 migration
- **Salesforce Agentforce**: Enterprise-grade registry with centralized policy enforcement
- **GitHub MCP Server**: Personal Access Tokens via environment variables, OAuth for remote mode
- **Notion MCP Server**: Integration tokens via `NOTION_TOKEN` env variable

**Universal Pattern Identified:**
All production CRM servers delegate credential management to users via environment variables. None implement additional credential storage or validation layers beyond what the upstream API provides.

**Key Findings:**
1. **Environment Variable Standard**: 100% of reviewed servers use env vars (`GITHUB_PERSONAL_ACCESS_TOKEN`, `NOTION_TOKEN`, `HUBSPOT_TOKEN`)
2. **Zero Credential Storage**: No server stores or caches credentials beyond process lifetime
3. **Upstream API Security**: Rely on platform's native authentication (OAuth, API keys, PATs)
4. **Documentation Focus**: Emphasize user education on token scoping, rotation, and secure storage

**Security Model Validation:**
The "delegate to user" approach is the **de facto standard** for MCP servers handling sensitive data, not an exception. This pattern:
- Aligns with OAuth 2.1 Resource Server architecture (MCP servers validate tokens, don't issue them)
- Follows MCP specification: "Token passthrough is forbidden; servers validate audience-restricted tokens"
- Matches enterprise patterns: Salesforce's centralized governance operates at registry level, not individual server level

### API Key Security Model (PropStack-Specific)

#### PropStack API Key Capabilities
PropStack API keys are **restrictive** at creation time:
- Keys created in PropStack dashboard with specific scopes
- Read-only vs. read-write permissions configurable
- IP whitelist restrictions available (optional)
- No elevated privilege escalation possible from MCP

#### Security Decision: **Delegate to User** ✅ (Industry Standard)

**Rationale (Validated by CRM Industry Research):**
1. ✅ **Industry Consensus**: GitHub, Notion, HubSpot, Salesforce all use this pattern
2. ✅ **Least Privilege Principle**: Users create keys with minimal required permissions
3. ✅ **No Server-Side Storage**: MCP server never stores credentials (per MCP spec)
4. ✅ **Environment Variables**: Standard secure pattern (`PROPSTACK_API_KEY`)
5. ✅ **User Control**: Key rotation, revocation fully in user's control
6. ✅ **Audit Trail**: PropStack logs all API requests with key identifier
7. ✅ **MCP Spec Compliance**: Act as OAuth 2.1 Resource Server, not Authorization Server

**MCP Server Responsibilities:**
- ❌ **NOT responsible for**: Key validation, rotation, storage, issuance
- ✅ **Responsible for**: Clear documentation on key setup, HTTPS enforcement, error messages without key leakage, input validation

**Documentation Requirements (Following Industry Best Practices):**
```markdown
## Security Best Practices

### Token Management (Following GitHub/Notion/HubSpot Patterns)

1. **Create a restricted API key** in PropStack dashboard:
   - Enable only required permissions (e.g., read-only for queries)
   - Add IP whitelist if using from static location
   - Set expiration date for temporary use
   - **Principle**: Same as GitHub PAT scoping (repo vs. admin access)

2. **Store key securely** (Standard MCP Pattern):
   - Use environment variables (never commit to git)
   - Add `.env` to `.gitignore` (GitHub MCP recommendation)
   - Use `chmod 600` on config files (GitHub MCP practice)
   - Consider tools like 1Password CLI for key injection
   - Rotate keys periodically

3. **Monitor usage**:
   - Review PropStack API logs regularly (similar to GitHub audit logs)
   - Set up alerts for unusual activity
   - Revoke compromised keys immediately
   - Use different keys for different projects/environments (GitHub MCP best practice)

### MCP-Specific Security (Per Official Specification)

4. **Token Audience Validation**:
   - MCP server validates tokens are issued for PropStack API
   - No token passthrough to downstream services (forbidden by MCP spec)
   - Audience-restricted tokens prevent cross-service misuse

5. **Session Security**:
   - Cryptographically secure session IDs (UUIDs)
   - No sequential/guessable identifiers
   - Per-request verification of authorization
```

### Additional Security Measures (Implementation Level)

#### 1. Input Validation (Injection Prevention)
```typescript
// Similar to GitHub MCP parameter validation
function validatePropertyId(id: string): boolean {
  // PropStack IDs: alphanumeric, length constraints
  const PROPSTACK_ID_PATTERN = /^[a-zA-Z0-9-_]{8,64}$/;
  return PROPSTACK_ID_PATTERN.test(id);
}

function sanitizeSearchQuery(query: string): string {
  // Prevent SQL injection in search parameters
  return query.replace(/[;<>'"]/g, '');
}
```

**Validation Rules:**
- Sanitize all user inputs before API calls
- Validate property IDs (format, length)
- Prevent injection attacks in search queries
- Type-safe parameters via TypeScript
- Reject suspicious patterns (SQL keywords, script tags)

#### 2. Rate Limiting (Client-Side Protection)
```typescript
// Implement exponential backoff (GitHub MCP pattern)
const rateLimiter = new RateLimiter({
  maxRequests: 90, // Conservative (PropStack may have 100/min limit)
  perMilliseconds: 60000,
  strategy: 'exponential-backoff',
  retryAfter: true // Honor Retry-After headers
});
```

**Rate Limit Strategy:**
- Client-side limiting prevents API quota exhaustion
- Exponential backoff on 429 responses
- Honor `Retry-After` headers from PropStack
- Per-tool rate limit tracking

#### 3. Error Handling (Credential Protection)
```typescript
// Never leak credentials in errors (MCP spec requirement)
function sanitizeError(error: ApiError): SafeError {
  const message = error.message
    .replace(/key[=:]\s*\S+/gi, 'key=***')
    .replace(/token[=:]\s*\S+/gi, 'token=***')
    .replace(/ntn_\S+/g, 'ntn_***'); // Notion-style sanitization

  return { message, code: error.code };
}
```

**Error Security Rules:**
- Never expose API keys in error messages
- Sanitize error responses from PropStack API
- Log errors locally without sensitive data
- Redact credential patterns (key=, token=, ntn_, etc.)

#### 4. HTTPS Enforcement (MCP Transport Security)
```typescript
// Mandatory HTTPS (per MCP specification)
const PROPSTACK_API_BASE = 'https://api.propstack.de/v1';

// Reject any HTTP attempts
if (!PROPSTACK_API_BASE.startsWith('https://')) {
  throw new SecurityError('HTTPS required for PropStack API');
}
```

**Transport Security:**
- HTTPS mandatory (no HTTP fallback)
- TLS 1.2+ required
- Certificate validation enabled
- Fail fast if HTTPS unavailable

---

## Distribution Strategy

### 1. NPM Public Registry

#### Package Configuration
```json
{
  "name": "@sigloch/mcp-propstack",
  "version": "1.0.0",
  "description": "MCP server for PropStack real estate API",
  "author": "andreas@siglochconsulting",
  "license": "MIT",
  "mcpName": "io.github.sigloch/propstack",
  "main": "dist/index.js",
  "bin": {
    "mcp-propstack": "dist/index.js"
  },
  "keywords": [
    "mcp",
    "model-context-protocol",
    "propstack",
    "real-estate",
    "immobilien",
    "api"
  ],
  "repository": {
    "type": "git",
    "url": "https://github.com/sigloch/mcp-propstack"
  }
}
```

#### Publishing Workflow
```bash
# Build TypeScript to dist/
npm run build

# Run tests
npm test

# Publish to NPM (automated via GitHub Actions)
npm publish --access public
```

### 2. Official MCP Registry

#### Requirements
1. **Package on NPM**: Must be published to npm public registry
2. **mcpName field**: Add to package.json with format `io.github.username/server-name`
3. **server.json**: Create registry definition file
4. **Documentation**: README with clear setup instructions

#### server.json Template
```json
{
  "name": "PropStack",
  "description": "PropStack real estate API integration for German property management",
  "author": "andreas@siglochconsulting",
  "license": "MIT",
  "package": {
    "registryType": "npm",
    "identifier": "@sigloch/mcp-propstack",
    "version": "1.0.0"
  },
  "transport": {
    "type": "stdio"
  },
  "configuration": {
    "env": {
      "PROPSTACK_API_KEY": {
        "description": "PropStack API key (create at propstack.de)",
        "required": true,
        "secret": true
      }
    }
  }
}
```

#### Registry Submission
1. Fork `modelcontextprotocol/registry` on GitHub
2. Add server.json to `servers/` directory
3. Submit Pull Request with verification
4. Automated checks validate NPM package linkage
5. Merge → Appears in official registry + GitHub registry

### 3. GitHub Repository

#### Repository Structure
```
mcp-propstack/
├── src/
│   ├── index.ts              # MCP server entry point
│   ├── propstack-client.ts   # PropStack API client
│   ├── tools.ts              # MCP tool definitions
│   ├── resources.ts          # MCP resource handlers
│   └── prompts.ts            # MCP prompt templates
├── tests/
│   ├── integration.test.ts
│   └── unit.test.ts
├── docs/
│   ├── setup.md
│   └── api-reference.md
├── .github/
│   └── workflows/
│       └── publish.yml       # Automated NPM publishing
├── package.json
├── tsconfig.json
├── server.json               # MCP registry definition
├── README.md
└── LICENSE
```

#### GitHub Actions CI/CD
```yaml
# .github/workflows/publish.yml
name: Publish to NPM
on:
  release:
    types: [published]
jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          registry-url: 'https://registry.npmjs.org'
      - run: npm ci
      - run: npm test
      - run: npm run build
      - run: npm publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

---

## Implementation Phases

### Phase 1: Core MCP Server (4-6 hours)
- ✅ Project setup with TypeScript + MCP SDK
- ✅ PropStack API client implementation
- ✅ Basic tools: searchProperties, getProperty
- ✅ Resource handlers for property data
- ✅ Unit tests for API client

### Phase 2: Advanced Features (2-3 hours)
- ✅ Write operations (create/update properties)
- ✅ Prompt templates for common tasks
- ✅ Rate limiting and retry logic
- ✅ Integration tests with mock API

### Phase 3: Distribution (2-3 hours)
- ✅ NPM package configuration
- ✅ GitHub repository setup
- ✅ Documentation (README, setup guide)
- ✅ GitHub Actions for automated publishing
- ✅ Submit to MCP Registry

---

## Testing Strategy

### Unit Tests
- PropStack API client methods
- Input validation functions
- Error handling paths
- Rate limiter logic

### Integration Tests
- MCP tool invocation flow
- Resource retrieval with mock API
- Prompt template rendering
- Configuration loading

### Manual Testing
- Install via `npx @sigloch/mcp-propstack`
- Configure Claude Code with test API key
- Execute property search queries
- Verify error handling with invalid keys

---

## Documentation Requirements

### README.md Sections
1. **Quick Start**: 5-minute setup guide
2. **Installation**: NPM + Claude Code configuration
3. **Security**: API key best practices
4. **API Reference**: All tools, resources, prompts
5. **Examples**: Common use cases with code
6. **Troubleshooting**: Common errors and fixes
7. **Contributing**: Development setup

### Code Documentation
- JSDoc comments for all public APIs
- TypeScript types exported for consumers
- Inline comments for complex logic

---

## Success Metrics

### Technical Metrics
- ✅ Published to NPM registry
- ✅ Listed in official MCP registry
- ✅ 100% test coverage for critical paths
- ✅ TypeScript strict mode compliance

### Adoption Metrics (Post-Launch)
- GitHub stars/forks
- NPM weekly downloads
- Community feedback/issues
- Integration examples in other projects

---

## Future Enhancements (Post-v1.0)

### Potential Extensions
1. **Caching Layer**: Redis for frequently accessed properties
2. **Webhooks**: PropStack event notifications via MCP
3. **Batch Operations**: Bulk property updates
4. **Analytics**: Property market trend analysis
5. **Multi-Account**: Support multiple PropStack tenants
6. **OpenImmo Support**: German real estate XML standard

### Community Features
- Example workflows repository
- Video tutorial series
- Integration guides for popular tools

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| PropStack API changes | High | Version API client, monitor changelog |
| Rate limit exhaustion | Medium | Implement client-side rate limiting |
| API key leakage | High | Clear documentation, no default keys |
| NPM package squatting | Low | Publish early, claim namespace |
| MCP spec changes | Medium | Follow official SDK updates |

---

## Open Questions

1. **PropStack API Documentation Access**: Is full API documentation publicly available?
2. **Rate Limits**: What are exact rate limit values? (Not documented publicly)
3. **Webhooks**: Does PropStack support webhooks for real-time updates?
4. **OpenImmo**: Should v1.0 include OpenImmo XML parsing?

---

## Next Steps

1. ✅ Create GitHub repository: `sigloch/mcp-propstack`
2. ✅ Initialize TypeScript project with MCP SDK
3. ✅ Implement core PropStack API client
4. ✅ Build basic MCP tools (search, get)
5. ✅ Write unit tests
6. ✅ Publish beta to NPM
7. ✅ Test integration in Claude Code
8. ✅ Submit to MCP Registry

**Estimated Completion:** 2-3 weeks (part-time development)

---

## References

- [PropStack API Documentation](https://docs.propstack.de/reference/objekte)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [MCP Registry Publishing Guide](https://modelcontextprotocol.info/tools/registry/publishing/)
- [NPM Publishing Documentation](https://docs.npmjs.com/creating-and-publishing-scoped-public-packages)
