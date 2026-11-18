import { vi } from "vitest";

// Tests call pages and actions directly, outside a Next.js request, where connection()
// (used to mark session reads as per-request) would throw. Everything else stays real.
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  connection: async () => {},
}));
