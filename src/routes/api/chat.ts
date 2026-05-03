import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { chatWithTools } from "@/server/aman-brain.server";

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      GET: async () =>
        new Response("Aman Voice Assistant API. POST messages here.", {
          status: 200,
          headers: { "Content-Type": "text/plain" },
        }),
      POST: async ({ request }) => {
        try {
          const supabaseUrl = process.env.SUPABASE_URL;
          const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
          if (!supabaseUrl || !publishableKey) {
            return Response.json({ error: "Backend not configured" }, { status: 500 });
          }

          // Require auth — extract bearer token
          const authHeader = request.headers.get("authorization") ?? "";
          const token = authHeader.replace(/^Bearer\s+/i, "").trim();
          if (!token) {
            return Response.json({ error: "Not authenticated" }, { status: 401 });
          }

          // Build a per-request Supabase client that runs as the user (RLS applies)
          const supabase = createClient(supabaseUrl, publishableKey, {
            global: { headers: { Authorization: `Bearer ${token}` } },
            auth: { persistSession: false, autoRefreshToken: false },
          });

          const { data: userData, error: userErr } = await supabase.auth.getUser();
          if (userErr || !userData?.user) {
            return Response.json({ error: "Invalid session" }, { status: 401 });
          }
          const userId = userData.user.id;

          const body = (await request.json().catch(() => ({}))) as {
            messages?: Array<{ role: string; content: string }>;
            conversation_id?: string;
            model?: string;
          };
          const incoming = Array.isArray(body.messages) ? body.messages : [];
          if (incoming.length === 0) {
            return Response.json({ error: "No messages" }, { status: 400 });
          }
          const lastUser = incoming[incoming.length - 1];
          if (lastUser.role !== "user") {
            return Response.json({ error: "Last message must be user" }, { status: 400 });
          }

          // Get or create conversation
          let conversationId = body.conversation_id;
          if (!conversationId) {
            const title = lastUser.content.slice(0, 60);
            const { data: conv, error: convErr } = await supabase
              .from("conversations")
              .insert({ user_id: userId, title })
              .select("id")
              .single();
            if (convErr) {
              return Response.json({ error: convErr.message }, { status: 500 });
            }
            conversationId = conv.id;
          }

          // Persist the user message
          await supabase.from("messages").insert({
            conversation_id: conversationId,
            user_id: userId,
            role: "user",
            content: lastUser.content,
          });

          // Load full conversation history (server-side, authoritative)
          const { data: historyRows } = await supabase
            .from("messages")
            .select("role, content")
            .eq("conversation_id", conversationId)
            .order("created_at", { ascending: true });

          const history = (historyRows ?? []).map((r) => ({
            role: r.role,
            content: r.content,
          }));

          // Run AI with tools (model selectable per request)
          const reply = await chatWithTools(history, { supabase, userId }, body.model);

          // Persist assistant reply
          await supabase.from("messages").insert({
            conversation_id: conversationId,
            user_id: userId,
            role: "assistant",
            content: reply,
          });

          return Response.json({ reply, conversation_id: conversationId });
        } catch (err) {
          console.error("Chat error:", err);
          const msg = err instanceof Error ? err.message : "Unknown error";
          const status = /rate limit|429/i.test(msg) ? 429
            : /402|credits/i.test(msg) ? 402
            : 500;
          return Response.json({ error: msg }, { status });
        }
      },
    },
  },
});
