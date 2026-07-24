# 話してみよう ― 公開手順(GitHub + Cloudflare Pages)

このフォルダには、サイトの公開に必要なファイルがすべて入っています。

```
index.html              … サイト本体(変更なし)
functions/api/chat.js   … AIを安全に扱う中継用の関数(サーバー側でのみ動く)
```

このバージョンの `chat.js` は、**Groq → OpenRouter → Gemini** の順に自動で試し、
上限エラーが出たら次のAIに自動的に切り替える仕組みになっています。
3つとも無料枠だけで使えます。

## 1. GitHubにリポジトリを作る

1. GitHubで新しいリポジトリを作成する(例: `hanashite-miyou`)
2. このフォルダの中身(`index.html` と `functions` フォルダ)をそのままpushする

```bash
git init
git add .
git commit -m "初回コミット"
git branch -M main
git remote add origin https://github.com/【あなたのユーザー名】/hanashite-miyou.git
git push -u origin main
```

**重要**: `chat.js` は必ず `functions/api/chat.js` という場所に置いてください。

```
(リポジトリのトップ)
├── index.html
└── functions/
    └── api/
        └── chat.js
```

## 2. Cloudflare Pagesと連携する

1. https://dash.cloudflare.com にアクセスし、無料アカウントを作成(お持ちであればログイン)
2. 左メニューの「Workers & Pages」→「作成」→「Pages」→「Gitに接続」を選ぶ
3. 先ほどのGitHubリポジトリを選択する
4. ビルド設定は特に何も入力せず(ビルドコマンドは空欄のままでOK)、そのまま「保存してデプロイ」を押す

数十秒待つと、`https://hanashite-miyou.pages.dev` のようなURLでサイトが公開されます。
この時点ではまだAPIキーを設定していないので、会話は動きません。

## 3. 3つのAIキーを取得する

### Groq
1. https://console.groq.com でアカウント作成(クレジットカード不要)
2. 左メニューの「API Keys」から新しいキーを発行(`gsk_` で始まる文字列)

### OpenRouter
1. https://openrouter.ai でアカウント作成(クレジットカード不要)
2. 「Keys」から新しいキーを発行(`sk-or-` で始まる文字列)

### Gemini(Google AI Studio)
1. https://aistudio.google.com にアクセスし、Googleアカウントでログイン
2. 「Get API key」から新しいキーを発行

## 4. キーをCloudflareに登録する(ここが一番大事です)

1. 公開されたPagesプロジェクトの画面で「設定」→「環境変数」を開く
2. 「本番環境」に、以下の3つを追加する。種類は必ず「シークレット(Secret)」を選ぶ

   | 変数名 | 値 |
   |---|---|
   | `GROQ_API_KEY` | Groqで発行したキー |
   | `OPENROUTER_API_KEY` | OpenRouterで発行したキー |
   | `GEMINI_API_KEY` | Geminiで発行したキー |

3. 保存すると再デプロイが必要になるので、「Deployments」タブから最新のデプロイを「Retry」する

## 5. 動作確認

公開URL(`https://xxxxx.pages.dev`)にアクセスし、マイクをタップして日本語で話しかけ、
AIから返答が返ってくれば成功です。

## 補足

- APIキーはコードのどこにも書かれていません。ブラウザからは常に自分のサイト内の `/api/chat` だけを呼び出し、
  その先でCloudflare側が各AI会社にキー付きでリクエストしています。
- 3つのキーのうち、1つでも登録されていれば動作します(全部揃っていなくても構いません)。
  ただし、揃っている方が上限に達しにくくなります。
- 会話が60往復を超えると自動的に打ち切るようにしています(`functions/api/chat.js` 内の `MAX_TURNS` を変更すれば調整できます)。
- Geminiの無料枠は、Google側の方針で会話データがモデルの学習改善に使われる可能性があります。
  生徒に使わせる前に、この点は把握しておいてください。
