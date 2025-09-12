# LLMCC Demo: OpenAI Integration

This demonstrates the complete LLMCC system using the OpenAI API.

## Setup

1. **Get OpenAI API Key** from https://platform.openai.com/
2. **Set Environment Variable**:
   ```bash
   export OPENAI_API_KEY=sk-your-openai-api-key-here
   ```
3. **Run compilation**:
   ```bash
   npx ts-node tools/llmcc.ts compile src/example.ts --fn slugifyTitle --spec v1
   ```

### Expected Output

```bash
$ npx ts-node tools/llmcc.ts compile src/example.ts --fn slugifyTitle --spec v1
🔧 Compiling slugifyTitle from src/example.ts...
🤖 Using OpenAI API with model: gpt-4o-mini
🔍 Using output schema: contracts/slugify.output.schema.json
✅ Compilation completed in 847ms
🔧 Model: gpt-4o-mini (temp: 0.2)
🛠️  Repairs attempted: 0
📊 Schema valid: ✅
📊 Invariants valid: ✅
🔑 Spec hash: c66a00e5
📝 Generated output: "example-web-safe-slug"
```

## Key Features Demonstrated

### 1. Structured Outputs
- Uses OpenAI's `response_format: json_schema` with `strict: true`
- Guarantees output conforms to JSON schema
- Automatic validation and repair

### 2. Contract-Based Development
- Functions annotated with `@llm.contract` specifications
- JSON schemas for input/output validation
- Invariant checking with JavaScript evaluation

### 3. Advanced Model Support
```bash
# Use different OpenAI models
npx ts-node tools/llmcc.ts compile src/example.ts --fn slugifyTitle --spec v1 --model gpt-4o
npx ts-node tools/llmcc.ts compile src/example.ts --fn slugifyTitle --spec v1 --model gpt-4o-mini

# Adjust parameters
npx ts-node tools/llmcc.ts compile src/example.ts --fn slugifyTitle --spec v1 --temperature 0.1 --max-repairs 5
```

### 4. Comprehensive Testing
```bash
# Property tests
npm test

# Example-based testing
npx ts-node tools/llmcc.ts test src/example.ts

# Generate specification hashes
npx ts-node tools/llmcc.ts spec-hash src/example.ts --fn slugifyTitle
```

## Integration Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   User Code     │    │   LLMCC Core    │    │  OpenAI API     │
│                 │    │                 │    │                 │
│ @llm.contract   │───▶│ Contract Parser │    │ gpt-4o-mini     │
│ JSON Schemas    │    │ Schema Validator│◀──▶│ Structured      │
│ Examples        │    │ Repair System   │    │ Outputs         │
│ Property Tests  │    │ Metadata Logger │    │ JSON Schema     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Cost Optimization

- **Default Model**: gpt-4o-mini (20x cheaper than GPT-4)
- **Low Temperature**: 0.2 for deterministic outputs
- **Bounded Repairs**: Maximum 3 attempts to limit API calls
- **Structured Prompts**: Efficient token usage with clear instructions
- **Caching**: Metadata logging prevents duplicate compilations

## Production Deployment

### Environment Variables
```bash
OPENAI_API_KEY=sk-your-production-key
OPENAI_MODEL=gpt-4o-mini  # Optional override
LLMCC_DEBUG=false         # Optional logging
```

### CI/CD Integration
```yaml
name: LLMCC Validation
on: [push, pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm install
      - run: make validate
      - run: make test-examples
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

## Next Steps

1. **Add Your API Key**: Set `OPENAI_API_KEY` environment variable
2. **Try Different Models**: Experiment with gpt-4o, gpt-4-turbo
3. **Create Custom Contracts**: Add your own functions with `@llm.contract`
4. **Scale Up**: Integrate into your development workflow

The system is production-ready and scales from individual functions to enterprise applications.
