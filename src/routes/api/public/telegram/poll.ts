import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/telegram";
const MAX_RUNTIME_MS = 25_000; // Worker-friendly budget
const MIN_REMAINING_MS = 5_000;

const SYSTEM_PROMPT =
  "You are Aman — a friendly, witty, bilingual personal AI assistant on Telegram. " +
  "Detect the user's language (English, Hindi, or Hinglish) and reply in the SAME language naturally. " +
  "Keep replies short, warm, and conversational. Avoid markdown formatting.";

async function callAman(userText: string): Promise<string> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY missing");

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userText },
      ],
    }),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`AI gateway ${res.status}: ${txt.slice(0, 200)}`);
  }
  const data = await res.json();
  return (
    data?.choices?.[0]?.message?.content?.toString().trim() ||
    "Sorry yaar, kuch gadbad ho gayi."
  );
}

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
      body: JSON.stringify({
        offset,
        timeout,
        allowed_updates: ["message"],
      }),
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

      let reply = "";
      try {
        reply = await callAman(userText);
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
