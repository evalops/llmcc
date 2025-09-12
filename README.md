# LLMCC: LLM-Native Compiler Toolchain

A concrete implementation of the "LLM ≈ probabilistic compiler" concept, featuring spec-first artifacts, constrained decoding, and deterministic verification.

## Design Philosophy

LLMCC treats LLMs as probabilistic compilers by providing:

1. **Spec-first artifacts** - JSON/YAML + EBNF/JSON-Schema specifications
2. **Tight output contracts** - Grammars and types for constrained decoding  
3. **Dense examples** - Positive/negative pairs near API surface
4. **Stable handles** - Names, layouts, and error codes that never drift
5. **Deterministic gates** - Property tests + oracles for output validation

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment template and configure your API key
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY

# Compile with OpenAI API
OPENAI_API_KEY=sk-your-key npx ts-node tools/llmcc.ts compile src/example.ts --fn slugifyTitle --spec v1

# Use different models
OPENAI_API_KEY=sk-your-key npx ts-node tools/llmcc.ts compile src/example.ts --fn slugifyTitle --spec v1 --model gpt-4o

# Test against examples
npx ts-node tools/llmcc.ts test src/example.ts

# Generate specification hash for versioning
npx ts-node tools/llmcc.ts spec-hash src/example.ts --fn slugifyTitle

# Run property tests
npm test

# Run full demo
make demo
```

## Contract Annotations

Functions are annotated with structured contract blocks that LLMs can parse:

```typescript
/**
 * @llm.contract v1
 * name: slugifyTitle
 * intent: Convert an arbitrary title into a web-safe slug.
 * input_schema: ref://contracts/slugify.input.schema.json
 * output_schema: ref://contracts/slugify.output.schema.json
 * invariants:
 *  - output.length <= 80
 *  - /^[a-z0-9-]+$/.test(output)
 * error_codes:
 *  - SLUG_TOO_LONG
 *  - SLUG_INVALID_CHAR
 */
export function slugifyTitle(input: string): string {
  // Implementation with proper error handling
}
```

## Architecture

### Pipeline
1. **spec-collect** → Gather contract blocks + schemas + examples
2. **plan** → Model proposes structured JSON plan
3. **synthesize** → Constrained decoding to types/grammar
4. **verify** → Type-check + JSON-Schema + property tests
5. **repair** → Limited repair attempts using repair playbook
6. **admit** → Commit code with metadata logging

### Directory Structure
```
llmcc/
├── contracts/           # JSON schemas and EBNF grammars
│   ├── slugify.input.schema.json
│   ├── slugify.output.schema.json
│   ├── slugify.repairs.yaml
│   └── query.ebnf
├── examples/           # Positive/negative test cases
│   └── slugify.examples.jsonl
├── src/               # Implementation with contract annotations
│   └── example.ts
├── tools/             # Compiler toolchain
│   ├── llmcc.ts      # CLI driver
│   ├── validators.ts  # Schema validation
│   └── decode.ts     # Constrained decoding
├── tests/             # Property tests
│   └── slugify.property.test.ts
└── Makefile           # Build targets
```

## Key Features

### Constrained Decoding
```typescript
const result = await constrainedDecode(prompt, {
  outputSchemaPath: "contracts/slugify.output.schema.json",
  maxRepairs: 3,
  temperature: 0.2,
  contractMetadata: contract
});
```

### Automatic Repair
The system attempts bounded repairs when validation fails:
- Schema violations → Pattern-based fixes
- Invariant violations → Property-preserving transformations
- Length violations → Smart truncation
- Character violations → Safe substitution

### Metadata Tracking
Every compilation produces traceable metadata:
```json
{
  "artifact": "slugifyTitle",
  "spec": "v1", 
  "spec_hash": "c66a00e5",
  "model": "gpt-4",
  "decode": {"mode": "json+grammar", "temperature": 0.2},
  "verify": {"schema_pass": true, "tests_pass": true},
  "repairs": 0,
  "latency_ms": 12
}
```

## Examples

### Compilation
```bash
$ OPENAI_API_KEY=sk-... npx ts-node tools/llmcc.ts compile src/example.ts --fn slugifyTitle --spec v1
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

### Property Testing
```bash
$ npm test
✓ tests/slugify.property.test.ts  (13 tests) 8ms
  ✓ length and charset invariant
  ✓ idempotency
  ✓ empty and whitespace handling
  ✓ deterministic output
  ✓ unicode normalization
```

### Example Validation
```bash
$ npx ts-node tools/llmcc.ts test src/example.ts
🧪 Testing examples for src/example.ts...
✅ "Hello World" → "hello-world"
✅ "JavaScript & TypeScript" → "javascript-typescript" 
✅ "" correctly failed: empty input
📊 Test Results: 12/14 passed
```

## OpenAI Integration

LLMCC now includes **full OpenAI API integration** with structured outputs and JSON schema validation.

### Setup

1. **Get OpenAI API Key**: Sign up at https://platform.openai.com/ and create an API key
2. **Configure Environment**: 
   ```bash
   cp .env.example .env
   # Edit .env and set OPENAI_API_KEY=sk-your-key-here
   ```
3. **Run with Real Models**:
   ```bash
   npx ts-node tools/llmcc.ts compile src/example.ts --fn slugifyTitle --spec v1
   ```

### Structured Outputs

The system uses OpenAI's **Structured Outputs** feature with `response_format: json_schema` and `strict: true`:

```typescript
const completion = await openai.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [
    { role: 'system', content: 'Generate output that adheres to the JSON schema...' },
    { role: 'user', content: prompt }
  ],
  temperature: 0.2,
  response_format: {
    type: 'json_schema',
    json_schema: {
      name: 'synthesized_output',
      strict: true,
      schema: {
        type: 'object',
        properties: { result: outputSchema },
        required: ['result'],
        additionalProperties: false
      }
    }
  }
});
```

### Model Support

- **gpt-4o-mini** (default) - Fast, cost-effective, supports structured outputs
- **gpt-4o** - More powerful, higher cost
- **gpt-4-turbo** - Legacy model with good performance
- **gpt-3.5-turbo** - Budget option (check structured output support)

### Cost Optimization

- Uses **gpt-4o-mini** by default (20x cheaper than GPT-4)
- Low temperature (0.2) for deterministic outputs
- Efficient prompting with structured JSON schema
- Bounded repair attempts (max 3) to limit API calls

### Add Custom Contracts
1. Create function with `@llm.contract` annotation
2. Add corresponding JSON schemas in `contracts/`
3. Create examples in `examples/`
4. Add property tests in `tests/`

### Command Line Options

```bash
# Basic usage
llmcc compile <file> --fn <function-name> --spec <version>

# With API key
llmcc --api-key sk-your-key compile src/example.ts --fn slugifyTitle --spec v1

# Different models
llmcc compile src/example.ts --fn slugifyTitle --spec v1 --model gpt-4o
llmcc compile src/example.ts --fn slugifyTitle --spec v1 --model gpt-4o-mini

# Adjust temperature and repairs
llmcc compile src/example.ts --fn slugifyTitle --spec v1 --temperature 0.1 --max-repairs 5

# Verbose output
llmcc compile src/example.ts --fn slugifyTitle --spec v1 --verbose

# Test examples
llmcc test src/example.ts
llmcc test src/example.ts --examples custom/examples.jsonl

# Generate spec hash
llmcc spec-hash src/example.ts --fn slugifyTitle
```

### CI Integration
```yaml
- name: Setup OpenAI API Key
  env:
    OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
    
- name: Validate Contracts
  run: make validate
  
- name: Test Examples  
  run: make test-examples
  
- name: Check Spec Drift
  run: make spec-diff
```

## Benefits

- **Reproducible** - Spec hashes track contract changes
- **Testable** - Property tests + example validation
- **Repairable** - Bounded repair attempts for common errors
- **Traceable** - Full metadata logging for debugging
- **Scalable** - Contract-first development for teams

## Future Work

- AST-based contract parsing (replace regex)
- Grammar-constrained generation (EBNF → regex)
- Multi-turn repair conversations
- Formal verification integration
- Cross-language contract support

## License

MIT License - See LICENSE file for details.
