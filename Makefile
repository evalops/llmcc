.PHONY: install test compile build clean lint typecheck example demo spec-hash

# Installation and setup
install:
	pnpm install

# Testing
test:
	pnpm vitest run

test-watch:
	pnpm vitest

test-coverage:
	pnpm vitest run --coverage

# Development
build:
	pnpm tsc

typecheck:
	pnpm tsc --noEmit

lint:
	pnpm eslint src/ tools/ tests/ --ext .ts

# Core compilation examples
compile:
	npx ts-node tools/llmcc.ts compile src/example.ts --fn slugifyTitle --spec v1

compile-verbose:
	npx ts-node tools/llmcc.ts compile src/example.ts --fn slugifyTitle --spec v1 --verbose

# Example testing
test-examples:
	npx ts-node tools/llmcc.ts test src/example.ts

# Utility commands
spec-hash:
	npx ts-node tools/llmcc.ts spec-hash src/example.ts --fn slugifyTitle

# Demo workflow
demo: install build
	@echo "🚀 Running LLMCC Demo"
	@echo "1. Testing property tests..."
	make test
	@echo "\n2. Generating spec hash..."
	make spec-hash
	@echo "\n3. Running compilation..."
	make compile-verbose
	@echo "\n4. Testing examples..."
	make test-examples
	@echo "\n✅ Demo completed successfully!"

# Validation pipeline
validate: typecheck lint test
	@echo "✅ All validations passed"

# Example with different parameters
example-temp:
	npx ts-node tools/llmcc.ts compile src/example.ts --fn slugifyTitle --spec v1 --temperature 0.7

example-repairs:
	npx ts-node tools/llmcc.ts compile src/example.ts --fn slugifyTitle --spec v1 --max-repairs 5

# Clean build artifacts
clean:
	rm -rf dist/ node_modules/ .llmcc/ *.log

# Development helpers
dev-setup: install
	@echo "Setting up development environment..."
	mkdir -p .llmcc logs
	chmod +x tools/llmcc.ts

# Schema validation
validate-schemas:
	@echo "Validating JSON schemas..."
	@for schema in contracts/*.schema.json; do \
		echo "Validating $$schema"; \
		npx ajv-cli validate -s $$schema -d /dev/null || exit 1; \
	done

# Generate documentation
docs:
	@echo "# LLMCC Documentation" > README.md
	@echo "" >> README.md
	@echo "## Available Commands" >> README.md
	@echo "" >> README.md
	@echo "\`\`\`bash" >> README.md
	@make -s help >> README.md
	@echo "\`\`\`" >> README.md

# Help
help:
	@echo "Available targets:"
	@echo "  install       - Install dependencies"
	@echo "  test         - Run all tests"
	@echo "  compile      - Compile with default settings"
	@echo "  build        - Build TypeScript files"
	@echo "  demo         - Run full demo pipeline"
	@echo "  validate     - Run all validation checks"
	@echo "  clean        - Clean build artifacts"
	@echo "  spec-hash    - Generate specification hash"
	@echo "  test-examples- Test against example cases"

# Quick development cycle
dev: typecheck test compile

# Continuous Integration
ci: install validate demo
	@echo "🎉 CI pipeline completed successfully"
