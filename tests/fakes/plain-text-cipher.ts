import type { TokenCipher } from "@/server/crypto/token-cipher";

/** Reversible marker cipher so tests can assert what would be stored encrypted. */
export const plainTextCipher: TokenCipher = {
  encrypt: (plaintext) => `enc(${plaintext})`,
  decrypt: (payload) => payload.replace(/^enc\((.*)\)$/, "$1"),
};
