/**
 * Unit tests for plot crypto module
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  encryptApiKey,
  decryptApiKey,
  isEncryptedApiKey,
} from "@/lib/plot/crypto";

describe("Plot Crypto Module", () => {
  const originalEnv = process.env;

  beforeAll(() => {
    // Ensure we have an encryption key set
    process.env = {
      ...originalEnv,
      PLOT_TOKEN_SECRET: "test-secret-key-for-encryption",
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe("encryptApiKey", () => {
    it("encrypts an API key to a different value", () => {
      const apiKey = "sk-test-api-key-12345";
      const encrypted = encryptApiKey(apiKey);

      expect(encrypted).not.toBe(apiKey);
      expect(encrypted).toContain(":"); // Format is iv:authTag:encrypted
    });

    it("produces different ciphertext for same input (random IV)", () => {
      const apiKey = "sk-test-api-key-12345";
      const encrypted1 = encryptApiKey(apiKey);
      const encrypted2 = encryptApiKey(apiKey);

      // Different IVs should produce different ciphertext
      expect(encrypted1).not.toBe(encrypted2);
    });

    it("produces correctly formatted output", () => {
      const apiKey = "my-secret-key";
      const encrypted = encryptApiKey(apiKey);
      const parts = encrypted.split(":");

      expect(parts.length).toBe(3);
      // IV should be 32 hex chars (16 bytes)
      expect(parts[0].length).toBe(32);
      // Auth tag should be 32 hex chars (16 bytes)
      expect(parts[1].length).toBe(32);
      // Encrypted data should be non-empty
      expect(parts[2].length).toBeGreaterThan(0);
    });
  });

  describe("decryptApiKey", () => {
    it("decrypts an encrypted key back to original", () => {
      const apiKey = "sk-test-api-key-12345";
      const encrypted = encryptApiKey(apiKey);
      const decrypted = decryptApiKey(encrypted);

      expect(decrypted).toBe(apiKey);
    });

    it("works with various key lengths", () => {
      const keys = [
        "short",
        "medium-length-api-key",
        "very-long-api-key-with-lots-of-characters-and-special-chars!@#$%",
      ];

      for (const key of keys) {
        const encrypted = encryptApiKey(key);
        const decrypted = decryptApiKey(encrypted);
        expect(decrypted).toBe(key);
      }
    });

    it("throws on invalid format (wrong number of parts)", () => {
      expect(() => decryptApiKey("invalid")).toThrow(
        "Invalid encrypted key format"
      );
      expect(() => decryptApiKey("only:two")).toThrow(
        "Invalid encrypted key format"
      );
      expect(() => decryptApiKey("too:many:parts:here")).toThrow();
    });

    it("throws on tampered ciphertext", () => {
      const apiKey = "sk-test-api-key";
      const encrypted = encryptApiKey(apiKey);
      const parts = encrypted.split(":");

      // Tamper with the encrypted data
      const tampered = `${parts[0]}:${parts[1]}:${parts[2].replace("a", "b")}`;

      expect(() => decryptApiKey(tampered)).toThrow();
    });
  });

  describe("isEncryptedApiKey", () => {
    it("returns true for properly encrypted keys", () => {
      const apiKey = "sk-test-api-key";
      const encrypted = encryptApiKey(apiKey);

      expect(isEncryptedApiKey(encrypted)).toBe(true);
    });

    it("returns false for plaintext keys", () => {
      expect(isEncryptedApiKey("sk-plaintext-key")).toBe(false);
      expect(isEncryptedApiKey("")).toBe(false);
      expect(isEncryptedApiKey("no:colons:here:but:not:right")).toBe(false);
    });

    it("returns false for malformed encrypted strings", () => {
      // Wrong lengths
      expect(isEncryptedApiKey("short:short:data")).toBe(false);
      // Not hex
      expect(
        isEncryptedApiKey(
          "gggggggggggggggggggggggggggggggg:hhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh:data"
        )
      ).toBe(false);
    });

    it("correctly identifies legacy plaintext keys", () => {
      const legacyKeys = [
        "pk_live_12345678901234567890",
        "Bearer sk-12345",
        "api-key-without-encryption",
      ];

      for (const key of legacyKeys) {
        expect(isEncryptedApiKey(key)).toBe(false);
      }
    });
  });

  describe("encryption key configuration", () => {
    it("uses PLOT_TOKEN_SECRET when available", () => {
      const apiKey = "test-key";
      // Should not throw with PLOT_TOKEN_SECRET set
      expect(() => encryptApiKey(apiKey)).not.toThrow();
    });
  });
});


