# Deploy Command

Execute a full deployment workflow for PropStack MCP Server:

## Deployment Steps

1. **Version Check**
   - Ask user for new version number (semantic versioning: major.minor.patch)
   - Validate version format
   - Check if version already exists as git tag

2. **Pre-deployment Checks**
   - Run `npm run build` to compile TypeScript
   - Run `npm test` to ensure all tests pass
   - Run `npx tsx scripts/dsgvo-check.ts` for DSGVO compliance
   - Run `npx tsx scripts/secrets-check.ts` for secrets scanning
   - STOP if any check fails

3. **Update Version**
   - Update version in `package.json`
   - Update version in `manifest.json`
   - Update version in `src/index.ts` (server version)

4. **Build Artifacts**
   - Run `npm run build` again with new version
   - Run `npx @anthropic-ai/mcpb@latest pack` to create MCPB bundle
   - Rename bundle to `propstack-mcp-v{version}.mcpb`

5. **Git Operations**
   - Commit changes with message: `chore: release v{version}`
   - Create git tag: `v{version}`
   - Push to remote: `git push && git push --tags`
   - Pre-push hook will run automatically (DSGVO + Secrets checks)

6. **npm Publish**
   - Ask user to confirm npm publish
   - Run `npm publish` (requires npm authentication)
   - Verify package is available: `npm view mcp-propstack@{version}`

7. **GitHub Release**
   - Ask user to create GitHub release manually OR
   - Use `gh release create v{version}` with:
     - Title: "v{version}"
     - Body: Changelog entry (generate from git log)
     - Attach: `propstack-mcp-v{version}.mcpb` bundle

8. **Post-deployment**
   - Update README if needed
   - Announce release (optional)
   - Test installation from npm: `npx mcp-propstack@{version}`

## Important Notes

- ALWAYS run compliance checks before deployment
- Use semantic versioning (breaking.feature.bugfix)
- Create GitHub Release for discoverability
- MCPB bundle must be attached to GitHub Release
- npm publish is permanent (cannot unpublish after 24h)

## Rollback Procedure

If deployment fails:
1. Delete git tag: `git tag -d v{version} && git push origin :refs/tags/v{version}`
2. Unpublish npm (within 24h): `npm unpublish mcp-propstack@{version}`
3. Delete GitHub Release
4. Fix issues and try again

## Example Workflow

```bash
# 1. User triggers /deploy
/deploy

# 2. User provides version
New version: 0.2.0

# 3. Automated checks and builds
✅ Build passed
✅ Tests passed
✅ DSGVO compliance passed
✅ No secrets found
✅ MCPB bundle created

# 4. Git operations
✅ Committed and tagged
✅ Pushed to remote

# 5. npm publish
✅ Published to npm

# 6. GitHub Release
✅ Release created with MCPB bundle

# Done!
```

Execute this workflow step by step, asking for user confirmation at critical points (version number, npm publish, etc.).
