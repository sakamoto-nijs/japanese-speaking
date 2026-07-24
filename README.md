# 話してみよう ― 公開手順(GitHub + Cloudflare Pages)

このフォルダには、サイトの公開に必要なファイルがすべて入っています。

```
index.html              … サイト本体
functions/api/chat.js   … Claude APIキーを安全に扱う中継用の関数(サーバー側でのみ動く)
```

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

## 2. Cloudflare Pagesと連携する

1. https://dash.cloudflare.com にアクセスし、無料アカウントを作成(お持ちであればログイン)
2. 左メニューの「Workers & Pages」→「作成」→「Pages」→「Gitに接続」を選ぶ
3. 先ほどのGitHubリポジトリを選択する
4. ビルド設定は特に何も入力せず(ビルドコマンドは空欄のままでOK)、そのまま「保存してデプロイ」を押す
   - このサイトはビルド不要な静的サイトのため、フレームワークのプリセットは「None」のままで問題ありません

数十秒待つと、`https://hanashite-miyou.pages.dev` のようなURLでサイトが公開されます。この時点ではまだAPIキーを設定していないので、会話は動きません。

## 3. APIキーを登録する(ここが一番大事です)

1. 公開されたPagesプロジェクトの画面で「設定」→「環境変数」を開く
2. 「本番環境」に、以下を追加する
   - 変数名: `ANTHROPIC_API_KEY`
   - 値: あなたのAnthropic APIキー(console.anthropic.com で発行したもの)
   - 種類は必ず「シークレット(Secret)」を選ぶ(「テキスト」だと画面上に見えてしまいます)
3. 保存すると、再デプロイが必要になるので「Deployments」タブから最新のデプロイを「Retry」する

## 4. 動作確認

公開URL(`https://xxxxx.pages.dev`)にアクセスし、マイクをタップして日本語で話しかけ、AIから返答が返ってくれば成功です。

## 補足

- APIキーはコードのどこにも書かれていません。ブラウザからは常に自分のサイト内の `/api/chat` だけを呼び出し、その先でCloudflare側がAnthropicにキー付きでリクエストしています。
- 独自ドメイン(例: `nihongo.あなたのドメイン.com`)を使いたい場合も、Pagesの「カスタムドメイン」設定から追加できます。
- 会話が60往復を超えると自動的に打ち切るようにしています(`functions/api/chat.js` 内の数値を変更すれば調整できます)。
