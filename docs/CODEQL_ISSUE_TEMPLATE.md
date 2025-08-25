# CodeQL Analysis Failing - Repository Configuration Required

## Issue Summary
CodeQL security analysis workflow is failing due to repository-level configuration issues. The workflow runs but fails at the "Perform CodeQL Analysis" step with permission/enablement warnings.

## Error Details
The CodeQL workflow logs show these key messages:
```
Code scanning is not enabled for this repository. Please enable code scanning in the repository settings.

This run of the CodeQL Action does not have permission to access Code Scanning API endpoints. 
Please ensure the Action has the 'security-events: write' permission.
```

## Current State
- ✅ Workflow syntax is valid (no YAML errors)
- ✅ CodeQL matrix configuration fixed (was causing duplicate language entries)
- ❌ Repository code scanning not enabled
- ❌ GitHub Actions lack security-events write permission

## Required Actions (Repository Admin)

### 1. Enable Code Scanning
Navigate to repository settings and enable code scanning:
1. Go to **Settings** → **Security** → **Code security and analysis**
2. Under "Code scanning", click **Set up** → **Advanced**
3. Enable CodeQL analysis

### 2. Configure GitHub Actions Permissions
Ensure Actions have permission to write security events:
1. Go to **Settings** → **Actions** → **General**
2. Under "Workflow permissions", ensure one of:
   - "Read and write permissions" is selected, OR
   - "Read repository contents and packages permissions" + manually add `security-events: write`

### 3. Verify Workflow Configuration
The current workflow file `.github/workflows/codeql.yml` should work once permissions are configured:
```yaml
permissions:
  actions: read
  contents: read
  security-events: write
```

## Expected Outcome
Once configured:
- CodeQL analysis will run on pushes and PRs
- Security findings will appear in the Security tab
- No more permission/enablement errors in workflow logs

## Technical Context
- **Languages**: JavaScript/TypeScript codebase
- **Workflow**: Uses GitHub's standard CodeQL action
- **Trigger**: Runs on push to main and PR events
- **Previous Issue**: Fixed duplicate language matrix (was causing double analysis)

## Priority
**Medium** - Security analysis is important for code quality but doesn't block development

## Related Files
- `.github/workflows/codeql.yml` - CodeQL workflow configuration
- All backend tests passing locally (issue is CI-only)

---
*This issue requires repository administrator privileges to resolve*
*Created: August 25, 2025*
