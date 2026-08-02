#!/usr/bin/env node
// Prints a fresh 32-byte base64 key for SECRETS_ENCRYPTION_KEY.
import { randomBytes } from "node:crypto";

const key = randomBytes(32).toString("base64");
console.log("\nAdd this to your environment as SECRETS_ENCRYPTION_KEY:\n");
console.log(`SECRETS_ENCRYPTION_KEY=${key}\n`);
console.log("Keep it secret. Rotating it makes every stored integration secret unreadable —");
console.log("re-enter each key in the admin panel after a rotation.\n");
