import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      GET: async () => {
        return new Response(
          "Aman Voice Assistant API is running. Use the frontend UI to chat with Aman.",
          { status: 200, headers: { "Content-Type": "text/plain" } },
        );
      },
      POST: async ({ request }) => {
        const apiKey = process.env.LOVABLE_API_KEY;
        if (!apiKey) {
          return new Response(
            JSON.stringify({ error: "AI gateway not configured" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }

        let body: { messages?: Array<{ role: string; content: string }> } = {};
        try {
          body = await request.json();
        } catch {
          return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const messages = Array.isArray(body.messages) ? body.messages : [];
        if (messages.length === 0) {
          return new Response(JSON.stringify({ error: "No messages provided" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const systemPrompt = {
          role: "system",
          content:
            "You are Aman — a friendly, witty, bilingual personal AI assistant. " +
            "Detect the user's language (English, Hindi, or Hinglish) and respond in the SAME language naturally. " +
            "Keep replies concise, warm, and conversational — like a smart friend. " +
            "Use short sentences (good for voice). Avoid markdown formatting in responses.",
        };

        try {
          const upstream = await fetch(
            "https://ai.gateway.lovable.dev/v1/chat/completions",
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "google/gemini-2.5-flash",
                stream: true,
                messages: [systemPrompt, ...messages],
              }),
            },
          );

          if (upstream.status === 429) {
            return new Response(
              JSON.stringify({ error: "Rate limit reached. Please slow down." }),
              { status: 429, headers: { "Content-Type": "application/json" } },
            );
          }
          if (upstream.status === 402) {
            return new Response(
              JSON.stringify({
                error: "AI credits exhausted. Add credits in Lovable settings.",
              }),
              { status: 402, headers: { "Content-Type": "application/json" } },
            );
          }
          if (!upstream.ok || !upstream.body) {
            const text = await upstream.text().catch(() => "");
            return new Response(
              JSON.stringify({
                error: `AI gateway error (${upstream.status}): ${text.slice(0, 200)}`,
              }),
              { status: 502, headers: { "Content-Type": "application/json" } },
            );
          }

          return new Response(upstream.body, {
            status: 200,
            headers: {
              "Content-Type": "text/event-stream",
              "Cache-Control": "no-cache",
              Connection: "keep-alive",
            },
          });
        } catch (err) {
          console.error("Chat handler error:", err);
          return new Response(
            JSON.stringify({
              error: err instanceof Error ? err.message : "Unknown server error",
            }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
