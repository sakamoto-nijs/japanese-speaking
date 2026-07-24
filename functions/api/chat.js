// Cloudflare Pages Function
// このファイルはサーバー側(Cloudflareの環境)でのみ実行されます。
// APIキーはブラウザ側には一切送られません。
//
// 事前準備:
//   Cloudflare Pages の管理画面 →「設定」→「環境変数」で
//   変数名 ANTHROPIC_API_KEY にAnthropicのAPIキーを「シークレット」として登録してください。

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch (err) {
    return new Response(JSON.stringify({ error: "リクエストの形式が正しくありません。" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { system, messages } = body || {};

  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response(JSON.stringify({ error: "messages が必要です。" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 簡易的な上限(会話が長くなりすぎるのを防ぐ)
  if (messages.length > 60) {
    return new Response(JSON.stringify({ error: "この会話は上限に達しました。終了してもう一度始めてください。" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!env.ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ error: "サーバー側にAPIキーが設定されていません。" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        system: system || "",
        messages: messages,
      }),
    });

    const data = await anthropicResponse.json();

    return new Response(JSON.stringify(data), {
      status: anthropicResponse.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Claude APIの呼び出しに失敗しました。" }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }
}
