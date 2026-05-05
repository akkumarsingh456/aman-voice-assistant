import { createFileRoute } from "@tanstack/react-router";

// Server-side proxy so BYOK keys never leave via a cross-origin browser fetch.
// The browser POSTs { provider, key } here; we call the provider's /v1/models
// endpoint from the server and return only a sanitized status.
export const Route = createFileRoute("/api/test-key")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: { provider?: string; key?: string };
        try {
          body = (await request.json()) as { provider?: string; key?: string };
        } catch {
          return Response.json({ ok: false, msg: "bad request" }, { status: 400 });
        }

        const provider = body.provider;
        const key = (body.key ?? "").trim();

        if (!key) return Response.json({ ok: false, msg: "empty" }, { status: 400 });
        if (!key.startsWith("sk-")) {
          return Response.json({ ok: false, msg: "invalid format" }, { status: 400 });
        }

        const url =
          provider === "openai"
            ? "https://api.openai.com/v1/models"
            : provider === "deepseek"
              ? "https://api.deepseek.com/v1/models"
              : null;

        if (!url) {
          return Response.json({ ok: false, msg: "unknown provider" }, { status: 400 });
        }

        try {
          const r = await fetch(url, {
            headers: { Authorization: `Bearer ${key}` },
          });
          if (r.ok) return Response.json({ ok: true, msg: "valid" });
          if (r.status === 401) return Response.json({ ok: false, msg: "invalid key" });
          return Response.json({ ok: false, msg: `HTTP ${r.status}` });
        } catch (err) {
          return Response.json({
            ok: false,
            msg: err instanceof Error ? err.message : "network error",
          });
        }
      },
    },
  },
});
