# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-09-12

### Added
- **Ax Framework Integration** - Added support for @ax-llm/ax for enhanced LLM operations
- Multi-provider support (OpenAI, Anthropic, Google) via ax framework
- `--use-ax` CLI flag to choose between original and ax implementations
- Robust fallback to demo mode when API keys are unavailable
- Comprehensive documentation in `/docs` directory
- TypeScript-first development with full type safety
- Property-based testing with vitest
- Contract-based LLM programming with JSON schema validation
- Automatic repair system for failed LLM outputs
- Spec hashing for reproducible builds
- GitHub Actions CI/CD pipeline
- Security audit integration
- Contributing guidelines

### Features
- **Core Toolchain**: LLM-native compiler with spec-first artifacts
- **Constrained Decoding**: Tight output contracts with grammars and types
- **Example-Driven**: Positive/negative test cases for validation
- **Deterministic Verification**: Property tests and oracles
- **Metadata Tracking**: Complete audit trail of compilation attempts

### CLI Commands
- `compile` - Compile functions using LLM with constrained decoding
- `test` - Validate against example test cases
- `spec-hash` - Generate specification hashes for versioning

### Documentation
- Complete README with usage examples
- Demo guide with step-by-step examples
- Ax integration comparison and benefits
- Contributing guidelines for developers
- API documentation and architecture notes

### Infrastructure
- Automated testing on Node.js 18.x, 20.x, 22.x
- Security vulnerability scanning
- TypeScript compilation and linting
- Package publishing preparation

### Breaking Changes
- None (initial release)

### Deprecated
- None

### Security
- Updated all dependencies to latest secure versions
- Added npm audit checks in CI
- Proper environment variable handling for API keys

## [Unreleased]

### Planned
- Enhanced ax features (streaming, agents, RAG)
- AST-based contract parsing
- Grammar-constrained generation (EBNF → regex)
- Multi-turn repair conversations
- Formal verification integration
- Cross-language contract support
