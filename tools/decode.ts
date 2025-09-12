import { makeValidator, loadRepairConfig, validateInvariants, ContractMetadata, loadSchema } from "./validators";
import crypto from "crypto";
import OpenAI from "openai";

export type DecodeOpts = {
  outputSchemaPath: string;
  maxRepairs?: number;
  temperature?: number;
  model?: string;
  contractMetadata?: ContractMetadata;
};

export type DecodeResult = {
  output: any;
  valid: boolean;
  repairs_attempted: number;
  model_info: {
    model: string;
    temperature: number;
    decode_mode: string;
  };
  verification: {
    schema_pass: boolean;
    invariants_pass: boolean;
    violations?: string[];
  };
  spec_hash?: string;
  latency_ms: number;
};

export async function constrainedDecode(prompt: string, opts: DecodeOpts): Promise<DecodeResult> {
  const startTime = Date.now();
  const maxRepairs = opts.maxRepairs || 3;
  let repairsAttempted = 0;
  
  // Check if we have a real API key for model info
  const hasRealApiKey = process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY.startsWith('sk-fake');
  
  // Generate spec hash if metadata available
  let specHash: string | undefined;
  if (opts.contractMetadata) {
    const specContent = JSON.stringify({
      name: opts.contractMetadata.name,
      version: opts.contractMetadata.version,
      invariants: opts.contractMetadata.invariants,
      error_codes: opts.contractMetadata.error_codes
    });
    specHash = crypto.createHash('sha256').update(specContent).digest('hex').slice(0, 8);
  }

  const validate = makeValidator(opts.outputSchemaPath);
  
  for (let attempt = 0; attempt <= maxRepairs; attempt++) {
    try {
      // In production: call your LM with grammar/JSON mode + tool-calling
      // For now: use a sophisticated fake model that demonstrates the concept
      const candidate = await callModel(prompt, opts, attempt > 0);
      
      // Schema validation
      const schemaValid = validate(candidate);
      
      // Invariants validation
      let invariantsValid = true;
      let violations: string[] = [];
      
      if (opts.contractMetadata?.invariants) {
        const invariantResult = validateInvariants(candidate, opts.contractMetadata.invariants);
        invariantsValid = invariantResult.valid;
        violations = invariantResult.violations;
      }
      
      const allValid = schemaValid && invariantsValid;
      
      const result: DecodeResult = {
        output: candidate,
        valid: allValid,
        repairs_attempted: repairsAttempted,
        model_info: {
          model: opts.model || (hasRealApiKey ? "gpt-4o-mini" : "fake-model-v1"),
          temperature: opts.temperature || 0.2,
          decode_mode: hasRealApiKey ? "json_schema+strict" : "json+grammar"
        },
        verification: {
          schema_pass: schemaValid,
          invariants_pass: invariantsValid,
          violations: violations.length > 0 ? violations : undefined
        },
        spec_hash: specHash,
        latency_ms: Date.now() - startTime
      };
      
      if (allValid) {
        return result;
      }
      
      if (attempt < maxRepairs) {
        // Attempt repair
        const repairedCandidate = await attemptRepair(candidate, {
          schema_valid: schemaValid,
          invariants_valid: invariantsValid,
          violations,
          contract: opts.contractMetadata
        });
        
        if (repairedCandidate !== candidate) {
          repairsAttempted++;
          // Validate repaired candidate
          const repairedValid = validate(repairedCandidate);
          let repairedInvariantsValid = true;
          
          if (opts.contractMetadata?.invariants) {
            const repairedInvariantResult = validateInvariants(repairedCandidate, opts.contractMetadata.invariants);
            repairedInvariantsValid = repairedInvariantResult.valid;
          }
          
          if (repairedValid && repairedInvariantsValid) {
            return {
              output: repairedCandidate,
              valid: true,
              repairs_attempted: repairsAttempted,
              model_info: result.model_info,
              verification: {
                schema_pass: true,
                invariants_pass: true
              },
              spec_hash: specHash,
              latency_ms: Date.now() - startTime
            };
          }
        }
      }
      
      // If we can't repair or max repairs reached, return the last attempt
      if (attempt === maxRepairs) {
        result.repairs_attempted = repairsAttempted;
        return result;
      }
      
    } catch (error) {
      if (attempt === maxRepairs) {
        throw new Error(`Decode failed after ${maxRepairs} repair attempts: ${error}`);
      }
    }
  }
  
  throw new Error("Decode failed");
}

// Initialize OpenAI client (will use OPENAI_API_KEY environment variable)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'sk-fake-key-for-testing'
});

async function callModel(prompt: string, opts: DecodeOpts, isRepairAttempt: boolean): Promise<string> {
  // Check if we have a real API key
  const hasRealApiKey = process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY.startsWith('sk-fake');
  
  if (!hasRealApiKey) {
    console.warn('⚠️  No OPENAI_API_KEY found, using fake model for demo');
    return callFakeModel(prompt, opts, isRepairAttempt);
  }

  try {
    // Load the output schema to use for structured output
    const schema = loadSchema(opts.outputSchemaPath);
    
    // Create a structured prompt for the LLM
    const systemPrompt = `You are a precise code synthesis assistant. Generate output that strictly adheres to the provided JSON schema and contract specifications. ${isRepairAttempt ? 'REPAIR MODE: Fix the previous output to meet all requirements.' : ''}`;
    
    const completion = await openai.chat.completions.create({
      model: opts.model || 'gpt-4o-mini',
      messages: [
        { 
          role: 'system', 
          content: systemPrompt
        },
        { 
          role: 'user', 
          content: prompt 
        }
      ],
      temperature: opts.temperature || 0.2,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'synthesized_output',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              result: schema
            },
            required: ['result'],
            additionalProperties: false
          }
        }
      }
    });

    const response = completion.choices[0].message.content;
    if (!response) {
      throw new Error('No response from OpenAI API');
    }

    const parsed = JSON.parse(response);
    return parsed.result;

  } catch (error) {
    console.warn(`⚠️  OpenAI API call failed: ${error}, falling back to fake model`);
    return callFakeModel(prompt, opts, isRepairAttempt);
  }
}

async function callFakeModel(prompt: string, opts: DecodeOpts, isRepairAttempt: boolean): Promise<string> {
  // Sophisticated fake model that demonstrates the concept
  // This preserves the original demo functionality when no API key is available
  
  if (prompt.includes("SYNTHESIZE:slugifyTitle")) {
    // Extract potential input from prompt context
    const inputMatch = prompt.match(/input:\s*['"](.*?)['"]/) || 
                      prompt.match(/slugifyTitle\(['"]([^'"]*)['"]\)/);
    
    if (inputMatch) {
      const input = inputMatch[1];
      return simulateSlugify(input, isRepairAttempt);
    }
  }
  
  // Default behavior for unknown functions
  const lines = prompt.split('\n');
  const potentialInput = lines.find(line => line.includes('Hello') || line.includes('World'));
  if (potentialInput) {
    return simulateSlugify(potentialInput, isRepairAttempt);
  }
  
  return simulateSlugify("example title", isRepairAttempt);
}

function simulateSlugify(input: string, isRepairAttempt: boolean): string {
  // Simulate different model behaviors, including errors that need repair
  if (!isRepairAttempt) {
    // Sometimes produce outputs that need repair to demonstrate the system
    if (Math.random() < 0.3) {
      // Simulate common model errors
      const errorTypes = [
        () => input.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '---', // trailing hyphens
        () => '---' + input.toLowerCase().replace(/[^a-z0-9]+/g, '-'), // leading hyphens
        () => input.toLowerCase().replace(/[^a-z0-9]+/g, '-').repeat(50), // too long
        () => input.toLowerCase().replace(/\s+/g, '_'), // wrong separator
      ];
      const errorFn = errorTypes[Math.floor(Math.random() * errorTypes.length)];
      return errorFn();
    }
  }
  
  // Correct implementation (most of the time)
  const ascii = input
    .normalize("NFKD")
    .replace(/[^\x00-\x7F]/g, "-")
    .toLowerCase();
  
  let slug = ascii.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  slug = slug.replace(/-+/g, "-");
  
  if (slug.length > 80) {
    slug = slug.slice(0, 80).replace(/-+$/g, "");
  }
  
  return slug || "untitled";
}

async function attemptRepair(
  candidate: any, 
  context: { 
    schema_valid: boolean; 
    invariants_valid: boolean; 
    violations: string[]; 
    contract?: ContractMetadata;
  }
): Promise<string> {
  if (typeof candidate !== 'string') return candidate;
  
  let repaired = candidate;
  
  // Apply common repairs based on violations
  for (const violation of context.violations) {
    if (violation.includes('length')) {
      // Handle length violations
      if (repaired.length > 80) {
        repaired = repaired.slice(0, 80).replace(/-+$/, '');
      }
    }
    
    if (violation.includes('pattern') || violation.includes('[a-z0-9-]')) {
      // Handle character pattern violations
      repaired = repaired.replace(/[^a-z0-9-]/g, '-');
      repaired = repaired.replace(/-+/g, '-');
      repaired = repaired.replace(/^-+|-+$/g, '');
    }
  }
  
  // Remove leading/trailing hyphens
  repaired = repaired.replace(/^-+|-+$/g, '');
  
  // Collapse multiple hyphens
  repaired = repaired.replace(/-+/g, '-');
  
  return repaired || 'untitled';
}
