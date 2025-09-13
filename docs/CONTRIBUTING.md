# Contributing to LLMCC

Thank you for your interest in contributing to LLMCC! This document provides guidelines for contributing to the project.

## Development Setup

1. **Prerequisites**
   - Node.js >= 18.0.0
   - npm >= 8.0.0

2. **Installation**
   ```bash
   git clone https://github.com/evalops/llmcc.git
   cd llmcc
   npm install
   ```

3. **Environment Setup**
   ```bash
   cp .env.example .env
   # Add your API keys to .env
   ```

## Testing

```bash
# Run all tests
npm test

# Run tests in watch mode  
npm run test:watch

# Run demo examples
npm run demo

# Lint and type check
npm run lint
```

## Development Workflow

1. **Create a Feature Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make Changes**
   - Follow existing code style and patterns
   - Add tests for new functionality
   - Update documentation as needed

3. **Test Your Changes**
   ```bash
   npm test
   npm run lint
   npm run build
   ```

4. **Commit and Push**
   ```bash
   git add .
   git commit -m "feat: your descriptive commit message"
   git push origin feature/your-feature-name
   ```

5. **Create Pull Request**
   - Provide clear description of changes
   - Include examples of usage
   - Link any relevant issues

## Code Style Guidelines

- Use TypeScript for all new code
- Follow existing naming conventions
- Add JSDoc comments for public APIs
- Prefer declarative programming patterns
- Use ax framework for new LLM integrations

## Adding New Contracts

1. Create contract annotation in source file:
   ```typescript
   /**
    * @llm.contract v1
    * name: yourFunction
    * intent: Clear description of what it does
    * input_schema: ref://contracts/your-function.input.schema.json
    * output_schema: ref://contracts/your-function.output.schema.json
    * invariants:
    *  - validation rules
    * error_codes:
    *  - ERROR_CODE_1
    */
   ```

2. Add JSON schemas in `contracts/` directory

3. Create examples in `examples/` directory

4. Add property tests in `tests/` directory

## Architecture Notes

- **Original Decoder**: `tools/decode.ts` - Legacy OpenAI integration
- **Ax Decoder**: `tools/ax-decoder.ts` - Modern ax framework integration
- **CLI**: `tools/llmcc.ts` - Command-line interface
- **Validation**: `tools/validators.ts` - Contract parsing and validation

## Release Process

1. Update version in package.json
2. Update CHANGELOG.md
3. Create GitHub release with notes
4. Publish to npm (if applicable)

## Getting Help

- Check existing issues on GitHub
- Review documentation in `/docs`
- Join discussions in GitHub Discussions

## Recognition

Contributors will be recognized in:
- README.md acknowledgments
- GitHub contributors list
- Release notes for significant contributions

Thank you for contributing to LLMCC!
