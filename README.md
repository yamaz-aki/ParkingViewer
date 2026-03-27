# 🅿️ 駐車場カメラ ライブビューア

Safie APIを使って、駐車場のカメラ映像をブラウザでライブ表示するWebアプリです。

## 構成

```
safie-parking-viewer/
├── server.js          # Express サーバー（OAuth + API）
├── .env               # 認証情報（自分で作成）
├── .env.example       # ↑のテンプレート
├── package.json
├── public/
│   ├── setup.html     # 初回セットアップ画面
│   └── viewer.html    # カメラビューア画面
└── README.md
```

## ローカルで起動する手順

### 1. 準備

```bash
cd safie-parking-viewer
npm install
```

### 2. .env ファイルを作成

```bash
cp .env.example .env
```

`.env` を開いて、Safie開発者ポータルで取得した情報を入力：

```
SAFIE_CLIENT_ID=あなたのclient_id
SAFIE_CLIENT_SECRET=あなたのclient_secret
DEVICE_ID_1=カメラ1のデバイスID
DEVICE_ID_2=カメラ2のデバイスID
```

### 3. Safie開発者ポータルでリダイレクトURIを設定

Safie側のアプリ設定で、以下をリダイレクトURIに追加してください：

```
http://localhost:3000/callback
```

### 4. 起動

```bash
npm start
```

### 5. 初回認証

ブラウザで `http://localhost:3000` を開くと、セットアップ画面が表示されます。
「Safie認証を開始」ボタンを押してSafieの認可画面で許可してください。

認証完了後、自動的にカメラビューア画面に遷移します。

---

## 社内公開（Render にデプロイ）

社内メンバーに公開するには、[Render](https://render.com) を使うのが簡単です。

### 1. GitHubにプッシュ

```bash
git init
git add .
git commit -m "initial commit"
# GitHubでリポジトリを作成してpush
```

### 2. Render で Web Service を作成

- Render にログイン → New → Web Service
- GitHubリポジトリを接続
- Build Command: `npm install`
- Start Command: `npm start`

### 3. 環境変数を設定

Render の Environment タブで以下を追加：

| Key | Value |
|-----|-------|
| `SAFIE_CLIENT_ID` | あなたのclient_id |
| `SAFIE_CLIENT_SECRET` | あなたのclient_secret |
| `SAFIE_REDIRECT_URI` | `https://あなたのアプリ.onrender.com/callback` |
| `DEVICE_ID_1` | カメラ1のデバイスID |
| `DEVICE_LABEL_1` | 平和島11 |
| `DEVICE_ID_2` | カメラ2のデバイスID |
| `DEVICE_LABEL_2` | 平和島12 |

### 4. Safie側のリダイレクトURIを更新

Safie開発者ポータルで、リダイレクトURIを Render の URL に変更：

```
https://あなたのアプリ.onrender.com/callback
```

### 5. 初回認証

デプロイ後、`https://あなたのアプリ.onrender.com/auth` にアクセスして認証。

> ⚠️ Render 無料プランはディスクが永続化されないため、再デプロイ時に `.tokens.json` が消えます。
> 永続化したい場合は、Render Disk を追加するか、環境変数にrefresh_tokenを直接設定する方式に変更してください。

---

## トラブルシューティング

| 症状 | 対処 |
|------|------|
| `refresh_tokenが取得できない` | Safie側のアプリ設定でスコープ・権限を確認 |
| `stateが一致しない` | `/reset` でトークンをクリアして再認証 |
| 映像が表示されない | ブラウザのコンソールでエラーを確認。デバイスIDが正しいか確認 |
| トークン期限切れ | 50分ごとに自動更新されます。`/reset` → `/auth` で再認証も可能 |
