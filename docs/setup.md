# セットアップ手順

このアプリを実際に使えるようにするための、はじめの一回だけの準備。

## 1. データベース(Supabase)を用意する

1. [supabase.com](https://supabase.com) で新しいプロジェクトを作成する(無料枠でOK)
2. Project Settings > Database > Connection string(URI)をコピーして、`.env`の`DATABASE_URL`に貼る
3. Project Settings > API から、`Project URL`と`publishable key`(旧anon key)、`service_role key`をそれぞれ`.env`の該当箇所に貼る
4. Supabaseの「SQL Editor」を開き、`prisma/migrations/20260817000000_init/migration.sql`の中身をそのまま貼り付けて実行する(テーブル一式がまとめて作られる)

## 2. 合言葉とキーを.envに入れる

`.env.example`をコピーして`.env`を作り、次を埋める。

- `TEAM_PASSPHRASE` … お店の合言葉(自由に決める)
- `TEAM_SESSION_TOKEN` … 長いランダム文字列。ターミナルで`openssl rand -hex 32`を実行して出た値を貼る
- 上記1で取得したSupabaseの3つの値

## 3. 動作確認

```bash
npm install
npm run dev
```

`http://localhost:3000` を開き、合言葉でログインできればOK。「材料・仕入れ」→「メニュー・レシピ」の順で最初のメニューを登録すると、レジ画面に商品が表示される。

## 4. カード決済(Stripe)を使う場合

1. [dashboard.stripe.com](https://dashboard.stripe.com) でアカウントを作成(まだ実際の入金設定をしなくても、テストモードだけならすぐ使える)
2. 開発者 > APIキーから、テストモードの「シークレットキー」と「公開可能キー」を取得
3. `.env`の`STRIPE_SECRET_KEY`と`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`に貼る
4. レジ画面で「カードで会計」を押すと、物理的なカードリーダーがなくても「シミュレートされたリーダー」に自動接続され、決済フローを最後まで確認できる
5. 実際の店舗で使うときは、Stripeでカードリーダー実機(BBPOS WisePOS E や Stripe Reader S700 など)を注文し、`src/components/register/CardPaymentDialog.tsx`内の`USE_SIMULATED_READER`を`false`に変更する

## 5. 本番公開(Vercel)

1. このリポジトリをGitHubにプッシュする
2. [vercel.com](https://vercel.com) でGitHub連携し、このリポジトリをインポートする
3. Vercelの Settings > Environment Variables に、`.env`と同じ内容を登録する(本番用のStripeキーに切り替える場合はここで差し替える)
4. 以降は`main`へのプッシュのたびに自動でデプロイされる
