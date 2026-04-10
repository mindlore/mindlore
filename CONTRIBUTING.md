# Contributing to Mindlore

Thank you for your interest in contributing to Mindlore!

## Getting Started

```bash
git clone https://github.com/mindlore/mindlore.git
cd mindlore
npm install
npm test
```

## Development

- All scripts and hooks use `.cjs` extension (CommonJS)
- Node.js 20+ required
- `better-sqlite3` is a native dependency (requires build tools)

## Pull Request Process

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Make your changes
4. Run tests: `npm test`
5. Run lint: `npm run lint`
6. Commit with descriptive message
7. Push and open a PR

## Commit Format

```
type(scope): description

Examples:
feat(hooks): add mindlore-search hook
fix(fts5): handle empty content in indexer
test(init): add idempotency test
docs(schema): update frontmatter rules
```

Types: `feat`, `fix`, `test`, `docs`, `chore`, `refactor`

## Code Style

- ESLint enforced (see `.eslintrc.cjs`)
- 2-space indentation
- `prefer-const`, `no-var`, `eqeqeq`
- No unused variables (prefix with `_` if intentional)

## Testing

- Every script must have a corresponding test
- Use `jest.config.cjs` configuration
- Test files: `tests/*.test.cjs`
- Run specific suite: `npx jest tests/fts5.test.cjs`

## Architecture Decisions

See `SCHEMA.md` for the knowledge base specification.
Major decisions are documented in the project's planning artifacts.

## License

By contributing, you agree that your contributions will be licensed under MIT.
