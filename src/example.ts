/**
 * @llm.contract v1
 * name: slugifyTitle
 * intent: Convert an arbitrary title into a web-safe slug.
 * input_schema: ref://contracts/slugify.input.schema.json
 * output_schema: ref://contracts/slugify.output.schema.json
 * invariants:
 *  - output.length <= 80
 *  - /^[a-z0-9-]+$/.test(output)
 * counterexamples:
 *  - input: "Hello—World!"  fail_reason: "em dash"
 *  - input: "  $$$ Start  "  fail_reason: "symbols/whitespace"
 * error_codes:
 *  - SLUG_TOO_LONG
 *  - SLUG_INVALID_CHAR
 */
export function slugifyTitle(input: string): string {
  if (!input || input.trim().length === 0) {
    throw Object.assign(new Error("empty input"), { code: "SLUG_EMPTY" });
  }

  // Normalize Unicode and convert to ASCII
  const ascii = input
    .normalize("NFKD")
    .replace(/[^\x00-\x7F]/g, "-")
    .toLowerCase();

  // Replace non-alphanumeric characters with hyphens
  let slug = ascii.replace(/[^a-z0-9]+/g, "-");
  
  // Remove leading and trailing hyphens
  slug = slug.replace(/^-+|-+$/g, "");
  
  // Collapse multiple consecutive hyphens
  slug = slug.replace(/-+/g, "-");
  
  // Handle empty result after processing
  if (slug.length === 0) {
    throw Object.assign(new Error("no valid characters"), { code: "SLUG_EMPTY" });
  }
  
  // Truncate if too long
  if (slug.length > 80) {
    slug = slug.slice(0, 80).replace(/-+$/g, "");
  }
  
  // Final validation
  if (!/^[a-z0-9-]*$/.test(slug)) {
    throw Object.assign(new Error("invalid characters remain"), { code: "SLUG_INVALID_CHAR" });
  }
  
  if (slug.length > 80) {
    throw Object.assign(new Error("slug too long"), { code: "SLUG_TOO_LONG" });
  }
  
  return slug;
}

/**
 * @llm.contract v1
 * name: hashSpec
 * intent: Generate a content hash for contract specifications
 */
export function hashSpec(contract: string, examples: string, invariants: string): string {
  const crypto = require('crypto');
  const content = `${contract}|${examples}|${invariants}`;
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, 8);
}

/**
 * @llm.contract v1
 * name: generateApiResponse
 * intent: Generate a structured API response with user data and metadata
 * input_schema: ref://contracts/api-request.input.schema.json
 * output_schema: ref://contracts/api-response.output.schema.json
 * invariants:
 *  - output.success === true
 *  - output.data.user.id > 0
 *  - output.metadata.timestamp !== null
 * error_codes:
 *  - INVALID_USER_ID
 *  - MISSING_METADATA
 */
export function generateApiResponse(request: any): any {
  // This would be implemented by the LLM based on the contract
  return {
    success: true,
    data: {
      user: {
        id: request.userId || 1,
        name: request.userName || "John Doe",
        email: request.userEmail || "john@example.com"
      }
    },
    metadata: {
      timestamp: new Date().toISOString(),
      requestId: Math.random().toString(36).substring(7),
      version: "v1"
    }
  };
}
