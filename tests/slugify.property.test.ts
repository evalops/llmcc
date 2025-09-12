import { describe, test, expect } from "vitest";
import { slugifyTitle } from "../src/example";

describe("slugifyTitle property tests", () => {
  test("length and charset invariant", () => {
    const testCases = [
      "Hello World",
      "JavaScript & TypeScript",
      "The Quick Brown Fox Jumps Over The Lazy Dog",
      "Special chars: !@#$%^&*()",
      "Unicode: café français naïve résumé",
      "Numbers: 123-456-789",
      "Mixed: Hello123 World456!",
      "   Leading and trailing spaces   ",
      "Multiple---hyphens",
      "CamelCase and snake_case"
    ];

    testCases.forEach(input => {
      const output = slugifyTitle(input);
      
      // Test invariants
      expect(output).toMatch(/^[a-z0-9-]+$/);
      expect(output.length).toBeLessThanOrEqual(80);
      expect(output.length).toBeGreaterThan(0);
      
      // Additional properties
      expect(output).not.toMatch(/^-/); // doesn't start with hyphen
      expect(output).not.toMatch(/-$/); // doesn't end with hyphen
      expect(output).not.toMatch(/--/); // no consecutive hyphens
    });
  });

  test("idempotency", () => {
    const testCases = ["Hello World", "API v2.0", "café français"];
    
    testCases.forEach(input => {
      const first = slugifyTitle(input);
      const second = slugifyTitle(first);
      expect(first).toBe(second);
    });
  });

  test("empty and whitespace handling", () => {
    expect(() => slugifyTitle("")).toThrow();
    expect(() => slugifyTitle("   ")).toThrow();
    expect(() => slugifyTitle("\t\n")).toThrow();
  });

  test("deterministic output", () => {
    const input = "Test Input For Determinism";
    const results = Array.from({ length: 10 }, () => slugifyTitle(input));
    
    // All results should be identical
    const unique = new Set(results);
    expect(unique.size).toBe(1);
  });

  test("unicode normalization", () => {
    // These should produce similar results
    const inputs = [
      "café", // composed
      "cafe\u0301", // decomposed
      "naïve",
      "nai\u0308ve"
    ];
    
    inputs.forEach(input => {
      const result = slugifyTitle(input);
      expect(result).toMatch(/^[a-z0-9-]+$/);
      expect(result.length).toBeGreaterThan(0);
    });
  });

  test("length constraint with various inputs", () => {
    // Test very long input
    const longInput = "A".repeat(200) + " " + "B".repeat(200);
    const result = slugifyTitle(longInput);
    
    expect(result.length).toBeLessThanOrEqual(80);
    expect(result).toMatch(/^[a-z0-9-]+$/);
  });

  test("special character handling", () => {
    const specialChars = [
      "Hello@World",
      "Test#123",
      "Price$100",
      "Question?",
      "Exclamation!",
      "Parentheses(test)",
      "Brackets[test]",
      "Braces{test}"
    ];

    specialChars.forEach(input => {
      const result = slugifyTitle(input);
      expect(result).toMatch(/^[a-z0-9-]+$/);
      expect(result).not.toContain("@#$?!()[]{}");
    });
  });

  test("consecutive separator handling", () => {
    const inputs = [
      "Hello    World", // multiple spaces
      "Test---Case",     // multiple hyphens
      "Mixed . _ - Separators"
    ];

    inputs.forEach(input => {
      const result = slugifyTitle(input);
      expect(result).not.toMatch(/--+/); // no consecutive hyphens
    });
  });

  test("edge cases", () => {
    // Single character
    expect(slugifyTitle("a")).toBe("a");
    
    // Only numbers
    expect(slugifyTitle("123")).toBe("123");
    
    // Mixed with valid chars
    expect(slugifyTitle("a1b2c3")).toBe("a1b2c3");
  });

  test("error codes", () => {
    try {
      slugifyTitle("");
    } catch (error: any) {
      expect(error.code).toBe("SLUG_EMPTY");
    }

    try {
      slugifyTitle("   ");
    } catch (error: any) {
      expect(error.code).toBe("SLUG_EMPTY");
    }
  });
});

describe("slugifyTitle integration with examples", () => {
  test("matches expected outputs from examples", () => {
    const examples = [
      { in: "Hello World", out: "hello-world" },
      { in: "The Quick Brown Fox", out: "the-quick-brown-fox" },
      { in: "Hello—World!", out: "hello-world" },
      { in: "  $$$ Start  ", out: "start" },
      { in: "JavaScript & TypeScript", out: "javascript-typescript" },
      { in: "API v2.0 Release", out: "api-v2-0-release" }
    ];

    examples.forEach(({ in: input, out: expected }) => {
      expect(slugifyTitle(input)).toBe(expected);
    });
  });
});

// Performance and stress tests
describe("slugifyTitle performance", () => {
  test("handles large inputs efficiently", () => {
    const largeInput = "Test ".repeat(1000);
    const start = Date.now();
    const result = slugifyTitle(largeInput);
    const duration = Date.now() - start;
    
    expect(duration).toBeLessThan(100); // Should complete in <100ms
    expect(result.length).toBeLessThanOrEqual(80);
  });

  test("batch processing", () => {
    const inputs = Array.from({ length: 100 }, (_, i) => `Test Input ${i}`);
    const start = Date.now();
    
    const results = inputs.map(slugifyTitle);
    const duration = Date.now() - start;
    
    expect(duration).toBeLessThan(500); // Batch should complete in <500ms
    expect(results).toHaveLength(100);
    
    // All results should be valid
    results.forEach(result => {
      expect(result).toMatch(/^[a-z0-9-]+$/);
      expect(result.length).toBeLessThanOrEqual(80);
    });
  });
});
