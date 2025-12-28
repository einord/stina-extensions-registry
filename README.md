# Stina Extensions Registry

Official extension registry for [Stina](https://github.com/einord/stina) AI assistant.

## Structure

```
stina-extensions-registry/
├── registry.json              # Main registry file with all extensions
├── extensions/                # Detailed info per extension
│   └── ollama-provider.json
├── schemas/                   # JSON schemas for validation
│   ├── registry.schema.json
│   └── extension-entry.schema.json
└── README.md
```

## For Extension Developers

### Publishing an Extension

1. Create your extension following the [Extension Development Guide](https://github.com/einord/stina/blob/main/docs/extension-development.md)
2. Test locally with `stina ext dev`
3. Build your release: `pnpm build && pnpm pack-extension`
4. Create a GitHub release with the `.zip` bundle
5. Submit a PR to this repository:
   - Add `extensions/<your-extension-id>.json`
   - Update `registry.json` with your extension entry

### Extension Entry Format

See `extensions/ollama-provider.json` for an example. Required fields:

- `id`: Unique lowercase identifier (e.g., `my-extension`)
- `name`: Display name
- `description`: What the extension does
- `author`: `{ name, url }`
- `repository`: GitHub repository URL
- `license`: License identifier (MIT, Apache-2.0, etc.)
- `categories`: Array of `ai-provider`, `tool`, `theme`, or `utility`
- `versions`: Array of version entries with download URLs

## For Stina

The registry is consumed by `@stina/extension-installer`:

```typescript
const registry = await fetch('https://raw.githubusercontent.com/einord/stina-extensions-registry/main/registry.json')
```

## License

MIT
