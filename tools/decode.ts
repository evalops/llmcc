import { makeValidator, validateInvariants, ContractMetadata, loadSchema } from "./validators";
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
      // Call the language model with grammar/JSON mode + tool-calling
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
          model: opts.model || "gpt-4o-mini",
          temperature: opts.temperature || 0.2,
          decode_mode: "json_schema+strict"
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

async function callModel(prompt: string, opts: DecodeOpts, isRepairAttempt: boolean): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is required to call the model');
  }

  const openai = new OpenAI({ apiKey });

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
    throw new Error(`OpenAI API call failed: ${error}`);
  }
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
