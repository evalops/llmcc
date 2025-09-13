# Ax Integration Demo

This demonstrates how ax improves the llmcc toolchain.

## Benefits

### 1. Simplified API
**Before (Custom OpenAI Integration):**
```typescript
const result = await constrainedDecode(prompt, {
  outputSchemaPath: "contracts/slugify.output.schema.json",
  maxRepairs: 3,
  temperature: 0.2,
  contractMetadata: contract
});
```

**After (Ax Integration):**
```typescript
const result = await axConstrainedDecode(prompt, {
  contractMetadata: contract,
  maxRepairs: 3,
  temperature: 0.2
});
```

### 2. Multi-Provider Support
With ax, you can easily switch between:
- OpenAI (gpt-4o, gpt-4o-mini)
- Anthropic (claude-3.5-sonnet)
- Google (gemini-1.5-pro)
- Local models via Ollama

### 3. Enhanced Type Safety
Ax provides built-in TypeScript support with automatic type inference from signatures.

### 4. Declarative Contracts
Instead of manual JSON schema validation, ax allows declarative constraints:
```typescript
const slugifier = ax('title:string -> slug:string')
  .constraint('output.length <= 80')
  .constraint('/^[a-z0-9-]+$/.test(output)');
```

## Usage Comparison

### Original llmcc
```bash
npx ts-node tools/llmcc.ts compile src/example.ts --fn slugifyTitle --spec v1
```

### Ax-powered llmcc
```bash
npx ts-node tools/llmcc.ts compile src/example.ts --fn slugifyTitle --spec v1 --use-ax
```

## Test Results

Both produce identical output but ax provides:
- ✅ Cleaner architecture
- ✅ Provider flexibility  
- ✅ Better error handling
- ✅ Built-in optimization capabilities
- ✅ Streaming support (future)

## Future Enhancements with Ax

1. **Multi-modal contracts** - Support for image/audio inputs
2. **Automatic optimization** - DSPy-style training on examples
3. **Agent-based compilation** - Multi-step code generation
4. **RAG integration** - Documentation-aware synthesis
5. **Streaming outputs** - Real-time code generation
