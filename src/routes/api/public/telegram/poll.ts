import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { chatWithTools } from "@/server/aman-brain.server";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/telegram";
const MAX_RUNTIME_MS = 25_000;
const MIN_REMAINING_MS = 5_000;
const HISTORY_LIMIT = 20;

async function sendTelegramMessage(
  chatId: number,
  text: string,
  lovableKey: string,
  telegramKey: string,
) {
  const res = await fetch(`${GATEWAY_URL}/sendMessage`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": telegramKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    console.error(`Telegram sendMessage ${res.status}: ${txt.slice(0, 200)}`);
  }
}

export const Route = createFileRoute("/api/public/telegram/poll")({
  server: {
    handlers: {
      GET: async () => runPoll(),
      POST: async () => runPoll(),
    },
  },
});

async function runPoll() {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const telegramKey = process.env.TELEGRAM_API_KEY;

  if (!lovableKey || !telegramKey) {
    return Response.json(
      { ok: false, error: "Missing LOVABLE_API_KEY or TELEGRAM_API_KEY" },
      { status: 500 },
    );
  }

  const start = Date.now();
  let processed = 0;

  const { data: state, error: stateErr } = await supabaseAdmin
    .from("telegram_bot_state")
    .select("update_offset")
    .eq("id", 1)
    .single();
  if (stateErr) {
    return Response.json({ ok: false, error: stateErr.message }, { status: 500 });
  }
  let offset = Number(state.update_offset) || 0;

  while (true) {
    const remaining = MAX_RUNTIME_MS - (Date.now() - start);
    if (remaining < MIN_REMAINING_MS) break;
    const timeout = Math.min(20, Math.floor(remaining / 1000) - 3);
    if (timeout < 1) break;

    const res = await fetch(`${GATEWAY_URL}/getUpdates`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": telegramKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ offset, timeout, allowed_updates: ["message"] }),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return Response.json(
        { ok: false, error: `getUpdates ${res.status}: ${txt.slice(0, 200)}` },
        { status: 502 },
      );
    }
    const data = await res.json();
    const updates: any[] = data?.result ?? [];
    if (updates.length === 0) continue;

    for (const u of updates) {
      const msg = u.message;
      if (!msg || !msg.text) continue;
      const chatId = msg.chat.id as number;
      const username = msg.from?.username ?? msg.from?.first_name ?? null;
      const userText = String(msg.text);

      // Build per-chat history from telegram_messages
      const { data: prior } = await supabaseAdmin
        .from("telegram_messages")
        .select("user_text, aman_reply, created_at")
        .eq("chat_id", chatId)
        .order("created_at", { ascending: false })
        .limit(HISTORY_LIMIT);

      const history: Array<{ role: string; content: string }> = [];
      for (const row of (prior ?? []).reverse()) {
        if (row.user_text) history.push({ role: "user", content: row.user_text });
        if (row.aman_reply) history.push({ role: "assistant", content: row.aman_reply });
      }
      history.push({ role: "user", content: userText });

      let reply = "";
      try {
        reply = await chatWithTools(history, {
          telegramChatId: chatId,
          // No web user — reminders/web-only tools will return a friendly error.
        });
      } catch (err) {
        console.error("Aman AI error:", err);
        reply = "Sorry, mera dimaag thoda busy hai abhi. Try again?";
      }

      await sendTelegramMessage(chatId, reply, lovableKey, telegramKey);

      await supabaseAdmin.from("telegram_messages").upsert(
        {
          update_id: u.update_id,
          chat_id: chatId,
          from_username: username,
          user_text: userText,
          aman_reply: reply,
          raw_update: u,
        },
        { onConflict: "update_id" },
      );
      processed++;
    }

    offset = Math.max(...updates.map((u: any) => u.update_id)) + 1;
    await supabaseAdmin
      .from("telegram_bot_state")
      .update({ update_offset: offset, updated_at: new Date().toISOString() })
      .eq("id", 1);
  }

  return Response.json({ ok: true, processed, offset });
}
