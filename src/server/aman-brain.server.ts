// Server-only: Aman's tool-using AI brain.
// Used by both /api/chat (web) and /api/public/telegram/poll.
// IMPORTANT: This file is *.server.ts so it never lands in the client bundle.

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const TG_GATEWAY = "https://connector-gateway.lovable.dev/telegram";

export const SYSTEM_PROMPT =
  "You are Aman — a friendly, witty, bilingual personal AI assistant. " +
  "Detect the user's language (English, Hindi, or Hinglish) and respond in the SAME language naturally. " +
  "Keep replies concise, warm, conversational — like a smart friend. Short sentences (good for voice). " +
  "Avoid markdown formatting in responses. " +
  "You have tools: get_weather, set_reminder, list_reminders, save_note, list_notes, web_search, make_whatsapp_link, send_telegram_message. " +
  "Use tools when the user asks for real info (weather, reminders, notes, sending a message). " +
  "When the user says 'save this', 'note karo', 'yaad rakhna', 'idea save karo' — call save_note. " +
  "Auto-pick category from: Idea, To-Do, Important, Random, Shopping, Other. " +
  "For WhatsApp: you cannot type into the WhatsApp app — instead use make_whatsapp_link to give the user a tap-to-open link. " +
  "Never invent weather data; always call get_weather. Times for reminders must be ISO 8601 in user's local timezone if known, else UTC.";

export const TOOLS = [
  {
    type: "function",
    function: {
      name: "get_weather",
      description: "Get current weather for a city or coordinates.",
      parameters: {
        type: "object",
        properties: {
          location: { type: "string", description: "City name, e.g. 'Delhi' or 'Mumbai, India'." },
        },
        required: ["location"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "set_reminder",
      description: "Create a reminder for the user. Returns id.",
      parameters: {
        type: "object",
        properties: {
          text: { type: "string", description: "What to remind about." },
          remind_at: {
            type: "string",
            description: "ISO 8601 datetime when the reminder should fire (e.g. 2026-05-01T09:30:00Z).",
          },
          channel: { type: "string", enum: ["web", "telegram", "sms"], description: "Where to deliver." },
        },
        required: ["text", "remind_at"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_reminders",
      description: "List the user's upcoming (undelivered) reminders.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "save_note",
      description:
        "Save a note / idea / to-do for the user. Auto-pick category from: Idea, To-Do, Important, Random, Shopping, Other.",
      parameters: {
        type: "object",
        properties: {
          text: { type: "string", description: "The note content as the user said it." },
          category: {
            type: "string",
            enum: ["Idea", "To-Do", "Important", "Random", "Shopping", "Other"],
          },
        },
        required: ["text", "category"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_notes",
      description: "List the user's recent saved notes, optionally filtered by category.",
      parameters: {
        type: "object",
        properties: {
          category: {
            type: "string",
            enum: ["Idea", "To-Do", "Important", "Random", "Shopping", "Other"],
          },
          limit: { type: "number", description: "Max results (default 20)." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "web_search",
      description: "Search the web for current information. Returns top result snippets.",
      parameters: {
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "make_whatsapp_link",
      description:
        "Build a tap-to-open WhatsApp link with a pre-filled message. Returns a wa.me URL the user can tap.",
      parameters: {
        type: "object",
        properties: {
          phone: { type: "string", description: "Phone number in international format without + (e.g. 919876543210). Optional." },
          message: { type: "string", description: "Pre-filled message text." },
        },
        required: ["message"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "send_telegram_message",
      description:
        "Send a message via your Telegram bot to a chat that has previously messaged the bot. Provide telegram_chat_id from your contacts.",
      parameters: {
        type: "object",
        properties: {
          chat_id: { type: "number", description: "Telegram chat ID (numeric)." },
          text: { type: "string" },
        },
        required: ["chat_id", "text"],
      },
    },
  },
];

// ─── Tool implementations ───

async function geocode(name: string) {
  const r = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1`,
  );
  const j = await r.json();
  return j?.results?.[0] ?? null;
}

export async function toolGetWeather(args: { location: string }) {
  const place = await geocode(args.location);
  if (!place) return { error: `Couldn't find "${args.location}".` };
  const r = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&timezone=auto`,
  );
  const j = await r.json();
  return {
    location: `${place.name}, ${place.country}`,
    temperature_c: j.current?.temperature_2m,
    feels_like_c: j.current?.apparent_temperature,
    humidity: j.current?.relative_humidity_2m,
    wind_kmh: j.current?.wind_speed_10m,
    weather_code: j.current?.weather_code,
    time: j.current?.time,
  };
}

export function toolMakeWhatsAppLink(args: { phone?: string; message: string }) {
  const phone = (args.phone ?? "").replace(/[^\d]/g, "");
  const url = phone
    ? `https://wa.me/${phone}?text=${encodeURIComponent(args.message)}`
    : `https://wa.me/?text=${encodeURIComponent(args.message)}`;
  return { url, instructions: "Tap the link to open WhatsApp with the message ready to send." };
}

export async function toolSendTelegram(args: { chat_id: number; text: string }) {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const tgKey = process.env.TELEGRAM_API_KEY;
  if (!lovableKey || !tgKey) return { error: "Telegram not configured." };
  const r = await fetch(`${TG_GATEWAY}/sendMessage`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": tgKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ chat_id: args.chat_id, text: args.text }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) return { error: `Telegram error ${r.status}`, details: j };
  return { ok: true, message_id: j?.result?.message_id };
}

export async function toolWebSearch(args: { query: string }) {
  const key = process.env.BRAVE_SEARCH_API_KEY;
  if (!key) {
    return {
      error:
        "Web search isn't configured yet. The user needs to add a BRAVE_SEARCH_API_KEY (free tier at brave.com/search/api/).",
    };
  }
  const r = await fetch(
    `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(args.query)}&count=5`,
    { headers: { "X-Subscription-Token": key, Accept: "application/json" } },
  );
  if (!r.ok) return { error: `Search failed (${r.status})` };
  const j = await r.json();
  const results = (j?.web?.results ?? []).slice(0, 5).map((x: any) => ({
    title: x.title,
    url: x.url,
    snippet: x.description,
  }));
  return { results };
}

// ─── Tool dispatcher (reminders need supabase client — passed in) ───

export type ToolCtx = {
  // For server functions w/ user auth, pass authed supabase + userId.
  // For Telegram poll (no app user), reminders fall back to telegram_chat_id only.
  supabase?: any;
  userId?: string | null;
  telegramChatId?: number | null;
};

export async function runTool(
  name: string,
  args: any,
  ctx: ToolCtx,
): Promise<any> {
  switch (name) {
    case "get_weather":
      return toolGetWeather(args);
    case "make_whatsapp_link":
      return toolMakeWhatsAppLink(args);
    case "send_telegram_message":
      return toolSendTelegram(args);
    case "web_search":
      return toolWebSearch(args);
    case "set_reminder": {
      if (!ctx.supabase || !ctx.userId) {
        return { error: "Reminders require sign-in on the web app." };
      }
      const { data, error } = await ctx.supabase
        .from("reminders")
        .insert({
          user_id: ctx.userId,
          text: args.text,
          remind_at: args.remind_at,
          channel: args.channel ?? "web",
          telegram_chat_id: ctx.telegramChatId ?? null,
        })
        .select("id, remind_at, text")
        .single();
      if (error) return { error: error.message };
      return { ok: true, reminder: data };
    }
    case "list_reminders": {
      if (!ctx.supabase || !ctx.userId) return { error: "Sign-in required." };
      const { data, error } = await ctx.supabase
        .from("reminders")
        .select("id, text, remind_at, channel, delivered")
        .eq("delivered", false)
        .order("remind_at", { ascending: true })
        .limit(20);
      if (error) return { error: error.message };
      return { reminders: data };
    }
    case "save_note": {
      if (!ctx.supabase || !ctx.userId) return { error: "Sign-in required to save notes." };
      const { data, error } = await ctx.supabase
        .from("notes")
        .insert({
          user_id: ctx.userId,
          text: args.text,
          category: args.category ?? "Other",
        })
        .select("id, text, category, created_at")
        .single();
      if (error) return { error: error.message };
      return { ok: true, note: data };
    }
    case "list_notes": {
      if (!ctx.supabase || !ctx.userId) return { error: "Sign-in required." };
      let q = ctx.supabase
        .from("notes")
        .select("id, text, category, created_at")
        .order("created_at", { ascending: false })
        .limit(args.limit ?? 20);
      if (args.category) q = q.eq("category", args.category);
      const { data, error } = await q;
      if (error) return { error: error.message };
      return { notes: data };
    }
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

// ─── AI call with tool loop (non-streaming, used by Telegram) ───

const ALLOWED_MODELS = new Set([
  "google/gemini-3-flash-preview",
  "google/gemini-3.1-pro-preview",
  "google/gemini-2.5-pro",
  "google/gemini-2.5-flash",
  "google/gemini-2.5-flash-lite",
  "openai/gpt-5",
  "openai/gpt-5-mini",
  "openai/gpt-5-nano",
  "openai/gpt-5.2",
  "deepseek/deepseek-chat",
  "deepseek/deepseek-reasoner",
  "openai-direct/gpt-4o",
  "openai-direct/gpt-4o-mini",
]);

const DEEPSEEK_URL = "https://api.deepseek.com/v1/chat/completions";
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

export async function chatWithTools(
  history: Array<{ role: string; content: string }>,
  ctx: ToolCtx,
  model?: string,
  byokKey?: string,
): Promise<string> {
  const chosen = model && ALLOWED_MODELS.has(model) ? model : "google/gemini-3-flash-preview";

  // Decide endpoint + auth + outbound model id
  let endpoint = AI_URL;
  let authKey = process.env.LOVABLE_API_KEY ?? "";
  let outboundModel = chosen;

  if (chosen.startsWith("deepseek/")) {
    if (!byokKey) throw new Error("DeepSeek key missing — paste it in the key vault.");
    endpoint = DEEPSEEK_URL;
    authKey = byokKey;
    outboundModel = chosen.replace("deepseek/", "");
  } else if (chosen.startsWith("openai-direct/")) {
    if (!byokKey) throw new Error("OpenAI key missing — paste it in the key vault.");
    endpoint = OPENAI_URL;
    authKey = byokKey;
    outboundModel = chosen.replace("openai-direct/", "");
  } else if (!authKey) {
    throw new Error("LOVABLE_API_KEY missing");
  }

  const messages: any[] = [{ role: "system", content: SYSTEM_PROMPT }, ...history];

  for (let step = 0; step < 4; step++) {
    const r = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${authKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: outboundModel, messages, tools: TOOLS }),
    });
    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      throw new Error(`AI gateway ${r.status}: ${txt.slice(0, 200)}`);
    }
    const j = await r.json();
    const msg = j.choices?.[0]?.message;
    if (!msg) throw new Error("No message from AI");
    messages.push(msg);

    const calls = msg.tool_calls;
    if (!calls || calls.length === 0) {
      return (msg.content ?? "").toString().trim() || "…";
    }
    for (const c of calls) {
      let args: any = {};
      try { args = JSON.parse(c.function.arguments || "{}"); } catch { /* noop */ }
      const result = await runTool(c.function.name, args, ctx);
      messages.push({
        role: "tool",
        tool_call_id: c.id,
        content: JSON.stringify(result),
      });
    }
  }
  return "Sorry, I got stuck thinking. Try again?";
}
