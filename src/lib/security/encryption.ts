import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function key() {
  const source = process.env.APP_ENCRYPTION_KEY;
  if (!source || source.length < 24) throw new Error("APP_ENCRYPTION_KEY must contain at least 24 characters");
  return createHash("sha256").update(source).digest();
}

export function encryptSecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map((part) => part.toString("base64url")).join(".");
}

export function decryptSecret(value: string) {
  const [ivValue, tagValue, encryptedValue] = value.split(".");
  if (!ivValue || !tagValue || !encryptedValue) throw new Error("Invalid encrypted secret");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encryptedValue, "base64url")), decipher.final()]).toString("utf8");
}

export function maskSecret(value: string) {
  if (value.length <= 8) return "••••••••";
  return `${value.slice(0, 3)}••••••${value.slice(-4)}`;
}

