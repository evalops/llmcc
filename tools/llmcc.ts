#!/usr/bin/env ts-node

import { config } from "dotenv";
import { program } from "commander";
import { constrainedDecode } from "./decode";
import { axConstrainedDecode } from "./ax-decoder";
import { parseContractBlock, loadExamples } from "./validators";
import path from "node:path";
import fs from "node:fs";

// Load environment variables from .env file
config();

interface CompileOptions {
  fn: string;
  spec: string;
  temperature?: number;
  model?: string;
  maxRepairs?: number;
  verbose?: boolean;
  useAx?: boolean;
}

interface TestOptions {
  examples?: string;
  verbose?: boolean;
}

program
  .name("llmcc")
  .description("LLM-native compiler toolchain")
  .version("1.0.0")
  .option("--api-key <key>", "OpenAI API key (or set OPENAI_API_KEY env var)")
  .hook("preAction", (thisCommand) => {
    const opts = thisCommand.opts();
    if (opts.apiKey) {
      process.env.OPENAI_API_KEY = opts.apiKey;
    }
  });

program
  .command("compile <file>")
  .description("Compile a function using LLM with constrained decoding")
  .requiredOption("--fn <name>", "function name to compile")
  .requiredOption("--spec <version>", "contract specification version")
  .option("--temperature <temp>", "model temperature", "0.2")
  .option("--model <model>", "model to use", "gpt-4o-mini")
  .option("--max-repairs <num>", "maximum repair attempts", "3")
  .option("--verbose", "verbose output")
  .option("--use-ax", "use ax framework instead of custom decoder")
  .action(async (file: string, opts: CompileOptions) => {
    try {
      console.log(`🔧 Compiling ${opts.fn} from ${file}...`);
      
      // Check API key status and decoder choice
      const hasApiKey = process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY.startsWith('sk-fake');
      if (opts.useAx) {
        console.log(`⚡ Using ax framework with model: ${opts.model}`);
        if (!hasApiKey) {
          console.log(`💡 Set OPENAI_API_KEY environment variable to use real models with ax`);
        }
      } else if (hasApiKey) {
        console.log(`🤖 Using OpenAI API with model: ${opts.model}`);
      } else {
        console.log(`🎭 No API key found - using demo mode with fake model`);
        console.log(`💡 Set OPENAI_API_KEY environment variable to use real OpenAI models`);
      }
      const src = fs.readFileSync(file, "utf8");
      const contract = parseContractBlock(src, opts.fn);
      
      if (!contract) {
        console.error(`❌ No contract block found for function ${opts.fn}`);
        process.exit(1);
      }
      
      if (opts.verbose) {
        console.log(`📋 Contract metadata:`, JSON.stringify(contract, null, 2));
      }
      
      // Build the synthesis prompt
      const prompt = buildSynthesisPrompt(src, opts.fn, contract);
      
      // Determine output schema path
      const outputSchemaPath = contract.output_schema?.startsWith('ref://')
        ? path.join(process.cwd(), contract.output_schema.replace('ref://', ''))
        : path.join(process.cwd(), "contracts", `${opts.fn}.output.schema.json`);
      
      console.log(`🔍 Using output schema: ${outputSchemaPath}`);
      
      // Perform constrained decoding with chosen decoder
      let result;
      if (opts.useAx) {
        result = await axConstrainedDecode(prompt, {
          contractMetadata: contract,
          maxRepairs: parseInt(String(opts.maxRepairs || "3")),
          temperature: parseFloat(String(opts.temperature || "0.2")),
          model: opts.model
        });
      } else {
        result = await constrainedDecode(prompt, {
          outputSchemaPath,
          maxRepairs: parseInt(String(opts.maxRepairs || "3")),
          temperature: parseFloat(String(opts.temperature || "0.2")),
          model: opts.model,
          contractMetadata: contract
        });
      }
      
      // Output results
      console.log(`✅ Compilation completed in ${result.latency_ms}ms`);
      console.log(`🔧 Model: ${result.model_info.model} (temp: ${result.model_info.temperature})`);
      if (opts.useAx && 'provider' in result.model_info) {
        console.log(`🌐 Provider: ${(result.model_info as any).provider} (${result.model_info.decode_mode})`);
      }
      console.log(`🛠️  Repairs attempted: ${result.repairs_attempted}`);
      console.log(`📊 Schema valid: ${result.verification.schema_pass ? '✅' : '❌'}`);
      console.log(`📊 Invariants valid: ${result.verification.invariants_pass ? '✅' : '❌'}`);
      
      if (result.spec_hash) {
        console.log(`🔑 Spec hash: ${result.spec_hash}`);
      }
      
      if (!result.valid) {
        console.log(`⚠️  Validation issues:`);
        if (result.verification.violations) {
          result.verification.violations.forEach(v => console.log(`   - ${v}`));
        }
      }
      
      console.log(`\n📝 Generated output:`);
      console.log(JSON.stringify(result.output, null, 2));
      
      // Save compilation metadata
      const metadata = {
        artifact: opts.fn,
        spec: opts.spec,
        spec_hash: result.spec_hash,
        model: result.model_info.model,
        decode: {
          mode: result.model_info.decode_mode,
          temperature: result.model_info.temperature
        },
        verify: {
          schema_pass: result.verification.schema_pass,
          tests_pass: result.verification.invariants_pass
        },
        repairs: result.repairs_attempted,
        latency_ms: result.latency_ms,
        timestamp: new Date().toISOString()
      };
      
      const metadataPath = path.join(process.cwd(), ".llmcc", "metadata.jsonl");
      fs.mkdirSync(path.dirname(metadataPath), { recursive: true });
      fs.appendFileSync(metadataPath, JSON.stringify(metadata) + '\n');
      
      console.log(`📊 Metadata saved to ${metadataPath}`);
      
    } catch (error) {
      console.error(`❌ Compilation failed:`, error);
      process.exit(1);
    }
  });

program
  .command("test <file>")
  .description("Test a function against its contract examples")
  .option("--examples <path>", "path to examples JSONL file")
  .option("--verbose", "verbose output")
  .action(async (file: string, opts: TestOptions) => {
    try {
      console.log(`🧪 Testing examples for ${file}...`);
      
      // Import and test the function using dynamic import
      const module = await import(path.resolve(file));
      
      // Find all functions with contract blocks
      const src = fs.readFileSync(file, "utf8");
      const functionNames = extractFunctionNames(src);
      
      let totalTests = 0;
      let passedTests = 0;
      
      for (const fnName of functionNames) {
        const contract = parseContractBlock(src, fnName);
        if (!contract) continue;
        
        console.log(`\n🔍 Testing ${fnName}...`);
        
        // Load examples
        const examplesPath = opts.examples || 
          path.join(process.cwd(), "examples", `${fnName.toLowerCase().replace('title', '')}.examples.jsonl`);
        
        const examples = loadExamples(examplesPath);
        if (examples.length === 0) {
          console.log(`⚠️  No examples found at ${examplesPath}`);
          continue;
        }
        
        const fn = module[fnName];
        if (typeof fn !== 'function') {
          console.log(`⚠️  Function ${fnName} not found in module`);
          continue;
        }
        
        for (const example of examples) {
          totalTests++;
          try {
            const result = fn(example.in);
            
            if (example.ok) {
              if (example.out !== undefined && result === example.out) {
                console.log(`  ✅ "${example.in}" → "${result}"`);
                passedTests++;
              } else if (example.out === undefined) {
                // Just check it doesn't throw
                console.log(`  ✅ "${example.in}" → "${result}" (no expected output)`);
                passedTests++;
              } else {
                console.log(`  ❌ "${example.in}" → expected "${example.out}", got "${result}"`);
              }
            } else {
              console.log(`  ❌ "${example.in}" should have failed but got "${result}"`);
            }
          } catch (error) {
            if (!example.ok) {
              console.log(`  ✅ "${example.in}" correctly failed: ${example.reason}`);
              passedTests++;
            } else {
              console.log(`  ❌ "${example.in}" unexpectedly failed: ${error}`);
            }
          }
        }
      }
      
      console.log(`\n📊 Test Results: ${passedTests}/${totalTests} passed`);
      
      if (passedTests === totalTests) {
        console.log(`🎉 All tests passed!`);
        process.exit(0);
      } else {
        console.log(`💥 Some tests failed`);
        process.exit(1);
      }
      
    } catch (error) {
      console.error(`❌ Testing failed:`, error);
      process.exit(1);
    }
  });

program
  .command("spec-hash <file>")
  .description("Generate content hash for contract specifications")
  .requiredOption("--fn <name>", "function name")
  .action((file: string, opts: { fn: string }) => {
    try {
      const src = fs.readFileSync(file, "utf8");
      const contract = parseContractBlock(src, opts.fn);
      
      if (!contract) {
        console.error(`❌ No contract found for ${opts.fn}`);
        process.exit(1);
      }
      
      const crypto = require('crypto');
      const content = JSON.stringify({
        name: contract.name,
        version: contract.version,
        invariants: contract.invariants,
        error_codes: contract.error_codes
      });
      
      const hash = crypto.createHash('sha256').update(content).digest('hex').slice(0, 8);
      console.log(`${opts.fn}@${contract.version}#${hash}`);
      
    } catch (error) {
      console.error(`❌ Hash generation failed:`, error);
      process.exit(1);
    }
  });

function buildSynthesisPrompt(source: string, functionName: string, contract: any): string {
  return `SYNTHESIZE:${functionName}

Contract: ${JSON.stringify(contract, null, 2)}

Source context:
${source}

Generate a valid output for the function that satisfies the contract schema and invariants.
`;
}

function extractFunctionNames(source: string): string[] {
  const functionRegex = /export\s+function\s+(\w+)/g;
  const names: string[] = [];
  let match;
  
  while ((match = functionRegex.exec(source)) !== null) {
    names.push(match[1]);
  }
  
  return names;
}

program.parse();
