# CRUSH.md

Build/lint/test
- No project config detected. Common commands:
  - Node: npm ci; npm run build; npm run lint; npm test; npm test -- -t "name"
  - Python: pip install -e .; ruff check .; pytest -q; pytest -k "name"
  - Go: go build ./...; golangci-lint run; go test ./...; go test -run name ./...
  - Rust: cargo build; cargo clippy --all-targets -- -D warnings; cargo test; cargo test name
  - Java: ./gradlew build; ./gradlew test --tests "*name*"

Style guidelines
- Imports: group std → third-party → local; keep sorted and minimal.
- Formatting: use project formatter if present (prettier/ruff/black/gofmt/rustfmt); 100 col limit.
- Types: prefer explicit types at boundaries; avoid any/unsafe; narrow types and use generics where idiomatic.
- Naming: functions camelCase, Types/Classes PascalCase, constants UPPER_SNAKE_CASE, files kebab/snake per ecosystem.
- Errors: never swallow; return/propagate with context; log at edges; no sensitive data in errors.
- Nullability: avoid null/undefined where possible; validate inputs; use Option/Result-like patterns where available.
- Immutability: default to const/immutable; avoid shared mutable state.
- Side effects: pure functions by default; isolate IO and time.
- Testing: fast unit tests; deterministic; one assertion focus; name tests clearly; use -k/-t filters for single test.
- Concurrency: avoid data races; prefer message passing; guard with mutex/atomic where needed.
- Security: never commit secrets; use env vars/secret stores; validate all external inputs.
- Performance: measure before optimizing; avoid n^2 in hot paths; watch allocations.

AI assistant rules
- If Cursor/Copilot rules exist, mirror them here. None found.
- Keep this file updated when project tooling is added.

Single-test quick refs
- Jest: npm test -- -t "My test"
- Vitest: npm run test -- -t "My test"
- Pytest: pytest -k "test_name"
- Go: go test -run TestName ./...
- Rust: cargo test test_name