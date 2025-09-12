import Ajv from "ajv";
import addFormats from "ajv-formats";
import fs from "node:fs";
import path from "node:path";
import * as yaml from "js-yaml";

// Use AJV with draft-07 support (default)
const ajv = new Ajv({ 
  allErrors: true, 
  strict: false,
  validateFormats: true
});

// Add format validation
addFormats(ajv);

export interface ContractMetadata {
  name: string;
  version: string;
  intent: string;
  input_schema?: string;
  output_schema?: string;
  invariants?: string[];
  counterexamples?: Array<{ input: string; fail_reason: string }>;
  error_codes?: string[];
  spec_hash?: string;
}

export interface RepairConfig {
  repairs: Array<{
    code: string;
    action: string;
    strategy: string;
    [key: string]: any;
  }>;
  error_codes: Record<string, string>;
}

export function loadSchema(schemaPath: string) {
  const fullPath = path.resolve(schemaPath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Schema file not found: ${fullPath}`);
  }
  return JSON.parse(fs.readFileSync(fullPath, "utf8"));
}

export function makeValidator(schemaPath: string) {
  const schema = loadSchema(schemaPath);
  return ajv.compile(schema);
}

export function loadRepairConfig(configPath: string): RepairConfig {
  const fullPath = path.resolve(configPath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Repair config file not found: ${fullPath}`);
  }
  const content = fs.readFileSync(fullPath, "utf8");
  return yaml.load(content) as RepairConfig;
}

export function parseContractBlock(source: string, functionName: string): ContractMetadata | null {
  // Simple regex to extract contract block - in production, use proper AST parsing
  const contractRegex = new RegExp(
    `/\\*\\*[\\s\\S]*?@llm\\.contract[\\s\\S]*?\\*/[\\s\\S]*?function\\s+${functionName}`,
    'g'
  );
  
  const match = contractRegex.exec(source);
  if (!match) return null;
  
  const blockContent = match[0];
  
  // Extract metadata from the comment block
  const nameMatch = blockContent.match(/name:\s*(\w+)/);
  const versionMatch = blockContent.match(/@llm\.contract\s+(\w+)/);
  const intentMatch = blockContent.match(/intent:\s*(.+)/);
  const inputSchemaMatch = blockContent.match(/input_schema:\s*(.+)/);
  const outputSchemaMatch = blockContent.match(/output_schema:\s*(.+)/);
  
  // Extract invariants - look for section starting with "invariants:" and ending at next section
  let invariants: string[] = [];
  const invariantsSection = blockContent.match(/invariants:\s*\n((?:\s*\*\s*-\s*[^\n]+\n)*)/);
  if (invariantsSection) {
    invariants = invariantsSection[1]
      .split('\n')
      .filter(line => line.includes('*') && line.includes('-'))
      .map(line => line.replace(/^\s*\*\s*-\s*/, '').trim())
      .filter(line => line.length > 0);
  }
  
  // Extract error codes - look for section starting with "error_codes:" and ending at comment end
  let error_codes: string[] = [];
  const errorCodesSection = blockContent.match(/error_codes:\s*\n((?:\s*\*\s*-\s*[^\n]+\n)*)/);
  if (errorCodesSection) {
    error_codes = errorCodesSection[1]
      .split('\n')
      .filter(line => line.includes('*') && line.includes('-'))
      .map(line => line.replace(/^\s*\*\s*-\s*/, '').trim())
      .filter(line => line.length > 0);
  }
  
  return {
    name: nameMatch?.[1] || functionName,
    version: versionMatch?.[1] || 'v1',
    intent: intentMatch?.[1]?.trim() || '',
    input_schema: inputSchemaMatch?.[1]?.trim(),
    output_schema: outputSchemaMatch?.[1]?.trim(),
    invariants,
    error_codes
  };
}

export function validateInvariants(output: any, invariants: string[]): { valid: boolean; violations: string[] } {
  const violations: string[] = [];
  
  for (const invariant of invariants) {
    try {
      // Create a safe evaluation context
      const safeEval = new Function('output', `return ${invariant}`);
      const result = safeEval(output);
      if (!result) {
        violations.push(invariant);
      }
    } catch (error) {
      violations.push(`${invariant} (evaluation error: ${error})`);
    }
  }
  
  return {
    valid: violations.length === 0,
    violations
  };
}

export function loadExamples(examplesPath: string): Array<{ ok: boolean; in: any; out?: any; reason?: string }> {
  const fullPath = path.resolve(examplesPath);
  if (!fs.existsSync(fullPath)) {
    return [];
  }
  
  const content = fs.readFileSync(fullPath, "utf8");
  return content
    .split('\n')
    .filter(line => line.trim())
    .map(line => JSON.parse(line));
}
