// RS-3 §4.4: RLS bucket content-media denial-by-default per anon.
import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? "http://127.0.0.1:54520";
const ANON_KEY = process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"] ?? "";
const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });

describe("Storage bucket content-media: RLS anon (RS-3)", () => {
  it("anon prova list bucket content-media → permission denied o lista vuota", async () => {
    const { data, error } = await anon.storage
      .from("content-media")
      .list("00000000-0000-0000-0000-000000000001/");
    // Anon senza policy: o error 403 o data vuota (nessun accesso).
    if (error) {
      expect(error.message.toLowerCase()).toMatch(
        /permission|denied|not authorized|not allowed|policy/,
      );
    } else {
      expect(data).toEqual([]);
    }
  });

  it("anon prova upload su content-media → error permission denied", async () => {
    const testBytes = new Uint8Array([137, 80, 78, 71]); // fake PNG header
    const { error } = await anon.storage
      .from("content-media")
      .upload(`00000000-0000-0000-0000-000000000001/test-anon.jpg`, testBytes, {
        contentType: "image/jpeg",
      });
    expect(error).not.toBeNull();
    expect(error?.message.toLowerCase()).toMatch(
      /permission|denied|not authorized|not allowed|policy|violates/,
    );
  });
});
