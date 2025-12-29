# Stina Extensions Registry

Official extension registry for [Stina](https://github.com/einord/stina) AI assistant.

## Registry v2 Format

The registry uses a minimal format where extension details (name, description, versions) are fetched directly from GitHub at runtime. This ensures:

- **Security**: Extension info comes from the actual repository, not duplicated data
- **Freshness**: New releases are available immediately without registry updates
- **Simplicity**: Minimal maintenance needed for the registry

### Structure

```
stina-extensions-registry/
├── registry.json                    # Minimal registry (id, repo, categories, verification)
├── schemas/
│   └── registry.v2.schema.json      # JSON schema for validation
└── scripts/
    └── get-extension-hash.sh        # Hash generation for verification
```

### Registry Entry Format

```json
{
  "id": "ollama-provider",
  "repository": "https://github.com/einord/stina-ext-ollama",
  "categories": ["ai-provider"],
  "verified": true,
  "blocked": false,
  "featured": true,
  "verifiedVersions": [
    {
      "version": "1.0.1",
      "sha256": "542394e85b3b3e5eed04781986da89a851f8feb8043d7ee43e817ee730ec4b98",
      "verifiedAt": "2025-12-29"
    }
  ]
}
```

## For Extension Developers

### Publishing an Extension

1. Create your extension following the [Extension Development Guide](https://github.com/einord/stina/blob/main/docs/extension-development.md)
2. Create a `manifest.json` in your repository root with:
   - `id`, `name`, `description`, `author`, `version`, `main`, `permissions`
3. Build your extension and create a GitHub release with a `.zip` file
4. Submit a PR to this repository to add your extension to `registry.json`

### What You Need to Provide

Only minimal information is needed in the registry:

```json
{
  "id": "your-extension-id",
  "repository": "https://github.com/your-username/your-extension",
  "categories": ["ai-provider"],
  "verified": false,
  "blocked": false,
  "featured": false
}
```

All other information (name, description, versions, permissions) is automatically fetched from your GitHub repository.

## For Registry Maintainers

### Verifying an Extension

Before marking an extension as `verified: true`, you must:

1. **Review the source code** for security issues
2. **Check the manifest** for accurate permissions
3. **Test the extension** in a sandboxed environment
4. **Generate and record the hash** for the specific version

### Generating a Version Hash

Use the provided script to generate SHA256 hash for a release:

```bash
./scripts/get-extension-hash.sh <owner/repo> <tag>

# Example:
./scripts/get-extension-hash.sh einord/stina-ext-ollama v1.0.1
```

This will:
1. Download the release zip file
2. Calculate SHA256 hash
3. Extract and display manifest info
4. Output a JSON snippet for the registry

### Adding a Verified Version

1. Run the hash script for the specific version
2. Review the manifest permissions
3. Add to `verifiedVersions` in registry.json:

```json
{
  "version": "1.0.1",
  "sha256": "<hash-from-script>",
  "verifiedAt": "2025-12-29"
}
```

### Security Checklist

Before verifying, ensure:

- [ ] Source code reviewed for malicious behavior
- [ ] No obfuscated or minified source (should be readable)
- [ ] Permissions in manifest match actual functionality
- [ ] No excessive permissions requested
- [ ] Network access limited to documented endpoints
- [ ] No data exfiltration risks
- [ ] Extension tested and works as described

### Blocking an Extension

If an extension is found to be malicious or problematic:

```json
{
  "id": "problematic-extension",
  "blocked": true,
  "blockedReason": "Reason for blocking"
}
```

Blocked extensions are filtered out and cannot be installed.

## How Verification Works

When a user installs an extension:

1. Stina downloads the zip file from GitHub
2. Calculates SHA256 hash of the downloaded file
3. Compares against `verifiedVersions` in the registry
4. Shows warning if:
   - Hash doesn't match (possible tampering)
   - Version is not in `verifiedVersions` (unverified)

**Verified badge** = Version hash matches registry AND `verified: true`

## License

MIT
