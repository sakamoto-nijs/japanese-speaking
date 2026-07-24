// Cloudflare Pages Function
// このファイルはサーバー側(Cloudflareの環境)でのみ実行されます。
// APIキーはブラウザ側には一切送られません。
//
// 事前準備:
//   Cloudflare Pages の管理画面 →「設定」→「環境変数」で、以下の3つを
//   すべて「シークレット」として登録してください。
//     GROQ_API_KEY        … https://console.groq.com で発行
//     OPENROUTER_API_KEY  … https://openrouter.ai で発行
//     GEMINI_API_KEY      … https://aistudio.google.com で発行
//
// 動作:
//   基本は Groq → OpenRouter → Gemini の順に試し、上限エラー(429)や
//   一時的な障害が出たら、自動的に次の候補に切り替えます。
//   フロント側から "preferred"(例: "groq")が送られてきた場合は、
//   そのAIを最優先で試し、ダメなら残りを順番に試します。
//   実際に答えたAIの名前は、レスポンスの "provider" に入れて返します。

const MAX_TURNS = 60;

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch (err) {
    return jsonError("リクエストの形式が正しくありません。", 400);
  }

  const { system, messages, preferred } = body || {};

  if (!Array.isArray(messages) || messages.length === 0) {
    return jsonError("messages が必要です。", 400);
  }

  if (messages.length > MAX_TURNS) {
    return jsonError("この会話は上限に達しました。終了してもう一度始めてください。", 400);
  }

  let providers = [
    { name: "groq", run: () => callGroq(env, system, messages) },
    { name: "openrouter", run: () => callOpenRouter(env, system, messages) },
    { name: "gemini", run: () => callGemini(env, system, messages) },
  ];

  // フロント側で生徒が選んだ相手(preferred)があれば、それを最優先で試す。
  // 見つからない場合はそのまま元の順番(groq→openrouter→gemini)を使う。
  if (preferred) {
    const chosen = providers.find(p => p.name === preferred);
    if (chosen) {
      providers = [chosen, ...providers.filter(p => p.name !== preferred)];
    }
  }

  let lastError = null;

  for (const provider of providers) {
    try {
      const text = await provider.run();
      if (text) {
        // フロント側(index.html)はこの形("content"配列)を前提にしている
        // provider には実際に答えたAI("groq"/"openrouter"/"gemini")が入る
        return new Response(JSON.stringify({ content: [{ type: "text", text }], provider: provider.name }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
    } catch (err) {
      console.error(`[${provider.name}] failed:`, err.message);
      lastError = err;
      // 次の候補へフォールスルー
    }
  }

  console.error("All providers failed:", lastError && lastError.message);
  return jsonError("すべてのAIが混み合っています。少し待ってからもう一度試してください。", 503);
}

/* ===================== Groq ===================== */
async function callGroq(env, system, messages) {
  if (!env.GROQ_API_KEY) throw new Error("GROQ_API_KEY not set");

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      max_tokens: 1000,
      messages: [
        { role: "system", content: system || "" },
        ...toOpenAIMessages(messages),
      ],
    }),
  });

  if (!res.ok) throw new Error(`Groq HTTP ${res.status}`);
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error("Groq: empty response");
  return text;
}

/* ===================== OpenRouter ===================== */
async function callOpenRouter(env, system, messages) {
  if (!env.OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY not set");

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${env.OPENROUTER_API_KEY}`,
    },
    body: JSON.stringify({
      model: "meta-llama/llama-3.3-70b-instruct:free",
      max_tokens: 1000,
      messages: [
        { role: "system", content: system || "" },
        ...toOpenAIMessages(messages),
      ],
    }),
  });

  if (!res.ok) throw new Error(`OpenRouter HTTP ${res.status}`);
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error("OpenRouter: empty response");
  return text;
}

/* ===================== Gemini ===================== */
async function callGemini(env, system, messages) {
  if (!env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not set");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${env.GEMINI_API_KEY}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system || "" }] },
      contents: toGeminiContents(messages),
      generationConfig: { maxOutputTokens: 1000 },
    }),
  });

  if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`);
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("");
  if (!text) throw new Error("Gemini: empty response");
  return text;
}

/* ===================== 変換ヘルパー ===================== */

// Anthropic形式 [{role:'user'|'assistant', content:'...'}] → OpenAI互換形式(そのまま使える)
function toOpenAIMessages(messages) {
  return messages.map(m => ({ role: m.role, content: m.content }));
}

// Anthropic形式 → Gemini形式(assistant→model、contentはparts配列に)
function toGeminiContents(messages) {
  return messages.map(m => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
}

function jsonError(message, status) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
