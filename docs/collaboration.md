# 2人以上で開発するときの手順

このアプリを複数人で触るための手順。すでに動いているプロジェクトに、あとから参加する人向け。

---

## A. 招待する側(いまリポジトリを持っている人)がやること

### A-1. GitHubに招待する

1. https://github.com/Asadazemi2025/cafe-pos-app を開く
2. **Settings** タブ → 左メニューの **Collaborators**
3. **Add people** に相手のGitHubユーザー名（またはメールアドレス）を入れて招待
4. 相手にメールが届くので、承認してもらう

これで相手も `git push` できるようになる。

### A-2. Supabase(データベース)に招待する

売上や在庫を見る・SQLを流す必要がある人だけでよい。

1. https://supabase.com/dashboard を開く
2. つむぐカフェのプロジェクトを選ぶ → 左下の **Organization settings** → **Team**
3. **Invite member** で相手のメールアドレスを入れる（無料プランでも人数は追加できる）

### A-3. `.env` を渡す

`.env` にはデータベースのパスワードやStripeの秘密鍵が入っている。**GitHubには入っていない**（`.gitignore` で除外している）ので、参加する人には別途渡す必要がある。

渡すときの注意:

- **チャットやSNSに貼らない。** 一度貼ると取り消せない
- 直接会って画面を見せる、パスワード管理ツールを使う、などが安全
- どうしても送るなら、送ったあとに削除できる手段を使い、届いたらすぐ消してもらう
- 特に `SUPABASE_SERVICE_ROLE_KEY` と `STRIPE_SECRET_KEY` は、漏れると誰でもデータを読み書きできてしまう

### A-4. Vercel(公開先)について

**招待は不要。** GitHubの `main` ブランチに変更が入ると自動でデプロイされるので、参加する人はGitHubにpushするだけでよい。

環境変数を触る・デプロイの失敗を調べる必要が出てきたら、そのときにVercelのプロジェクト設定から招待する（無料プランでは人数に制限があるので、必要になってからでよい）。

---

## B. 参加する人がやること

### B-1. 道具をそろえる

| いるもの | どこから |
|---|---|
| GitHubアカウント | https://github.com |
| Git | https://git-scm.com （Windowsは「Git for Windows」） |
| Node.js | https://nodejs.org の **LTS** 版 |
| Claude Code | https://claude.ai/code の案内どおり |
| エディタ(任意) | VS Code など |

入ったか確認する。ターミナル（Windowsは「Git Bash」または「PowerShell」）で:

```bash
node -v
git --version
```

どちらもバージョンが表示されればOK。

### B-2. プロジェクトを手元に持ってくる

置きたい場所へ移動してから:

```bash
git clone https://github.com/Asadazemi2025/cafe-pos-app.git
cd cafe-pos-app
npm install
```

`npm install` は数分かかる。

### B-3. `.env` を置く

もらった `.env` の中身を、`cafe-pos-app` フォルダの直下に `.env` という名前で保存する。

**このファイルは絶対にGitHubに上げない。** `.gitignore` に入っているので普通は上がらないが、`git status` に `.env` が出てきたら止めて相談すること。

### B-4. 動かしてみる

```bash
npm run dev
```

`http://localhost:3000` を開いて、合言葉でログインできれば準備完了。

> 手元から本番のデータベースにつながらない場合がある（大学や自宅の回線がブロックしていることがある）。その場合は画面が出ずエラーになるので、コードの修正だけして、動作確認は公開サイトで行う。

---

## C. 一緒に触るときのルール

同じファイルを2人が同時に書き換えると、あとから push した人がエラーになる。次の流れを守れば、ほぼ起きない。

### C-1. 作業を始める前に、必ず最新にする

```bash
git switch main
git pull
```

### C-2. 自分の作業用の枝(ブランチ)を作る

```bash
git switch -c stock-fix
```

`stock-fix` の部分は作業内容がわかる名前にする（`survey-graph`、`register-ui` など）。

### C-3. 直して、記録して、送る

```bash
git add -A
git commit -m "在庫画面の並び順を売れている順に変える"
git push -u origin stock-fix
```

### C-4. GitHubで合流させる(プルリクエスト)

1. push すると、GitHubのページに **Compare & pull request** というボタンが出る
2. 押して **Create pull request**
3. もう一人が中身を見て **Merge pull request**

`main` に入ると、Vercelが自動で公開サイトを更新する。

### C-5. 終わったら手元も最新にする

```bash
git switch main
git pull
```

---

## D. 気をつけること

### D-1. データベースは1つを共有している

開発中でも、触っているのは**本番と同じデータベース**。テストの会計を作ると、実際の売上に混ざる。

- 試すときは、本番と別の**テスト用イベント**を作ってその中でやる
- 消すときは、そのイベントごと削除する（売上の記録は残るが、イベントには紐づかなくなる）

### D-2. テーブルの形を変えるときは声をかける

`prisma/schema.prisma` を変えたときは、データベース側にも同じ変更を入れる必要がある。片方だけ変わると、もう一人の環境も公開サイトも壊れる。

手順:

1. `prisma/schema.prisma` を直す
2. `prisma/migrations/日付_名前/migration.sql` にSQLを書く
3. **SupabaseのSQL Editorで実行する**
4. `npx prisma generate` を実行してから push する
5. 「DBを変えた」ともう一人に伝える

### D-3. 秘密の値をコードに書かない

パスワードやキーは必ず `.env` に置き、コードからは `process.env.〇〇` で読む。直接書くとGitHubに残ってしまい、あとから消しても履歴に残る。

---

## E. 困ったとき

| 症状 | 対処 |
|---|---|
| `git push` が `rejected` で失敗する | 相手が先に push している。`git pull --no-rebase` してから、もう一度 push |
| 「CONFLICT」と出た | 同じ行を2人が直した。ファイルを開くと `<<<<<<<` で両方の内容が並んでいるので、残す方を選んで印を消し、`git add` → `git commit` |
| 画面が真っ白 / Application error | Supabaseが一時停止している可能性。ダッシュボードで **Resume** を押す |
| `npm run dev` でDBエラー | 手元から本番DBにつながらない回線のことがある。公開サイトで確認する |
| 何をどう直したか分からなくなった | `git status`（今の状態）と `git log --oneline -10`（最近の記録）を見る |

---

## F. Claude Codeを2人で使うときのコツ

- **同じファイルを同時に触らない。** 「今日は自分がレジ、そっちは分析」のように担当を分ける
- 作業の前に必ず `git pull`。Claudeは手元のファイルしか見ていないので、古いままだと直したはずの箇所を戻してしまうことがある
- 何を変えたかは、コミットメッセージに日本語で書いておく。あとから読む人（と、次に開いたClaude）が理解しやすい
