# LINE Messaging API セットアップガイド

このガイドでは、新しいLINE Messaging APIチャネルを作成してアクセストークンを取得する手順を説明します。

## 前提条件

- LINEアカウントを持っている
- ビジネスアカウント（無料）を持っている、または作成する

## ステップ1: LINE Developers Consoleにアクセス

1. **LINE Developers**を開く：https://developers.line.biz/
2. **「ログイン」**をクリック
3. LINEアカウントでログイン

## ステップ2: プロバイダーを作成（初回のみ）

すでにプロバイダーがある場合はスキップしてください。

1. 「プロバイダーを作成」をクリック
2. **プロバイダー名**を入力（例：「VEXUM」「個人開発」など）
3. 「作成」をクリック

## ステップ3: 新しいチャネルを作成

1. 作成したプロバイダーを選択
2. 「新しいチャネルを作成」をクリック
3. **「Messaging API」**を選択
4. 以下の情報を入力：

### チャネル情報

| 項目 | 入力内容 |
|------|----------|
| **チャネル名** | 出退勤打刻アプリ通知Bot |
| **チャネル説明** | 研修生の出退勤通知を送信するBot |
| **大業種** | IT・通信 |
| **小業種** | ソフトウェア・情報処理 |
| **メールアドレス** | あなたのメールアドレス |

5. 規約に同意して「作成」をクリック

## ステップ4: チャネルアクセストークンを取得

1. 作成したチャネルをクリック
2. 「Messaging API設定」タブを開く
3. **「チャネルアクセストークン（長期）」**セクションまでスクロール
4. 「発行」ボタンをクリック
5. **表示されたトークンをコピー**（再表示できないので注意！）

📋 **コピーしたトークンを安全な場所に保存してください**

## ステップ5: グループトークに招待

### 5-1: ボットのQRコードを取得

1. 「Messaging API設定」タブで下にスクロール
2. 「ボット情報」セクションの**「QRコード」**をクリック
3. QRコードが表示されます

### 5-2: グループトークに追加

1. **LINEアプリ**を開く
2. 通知を送りたい**グループトーク**を開く
3. 右上のメニュー（≡）→「招待」
4. 「QRコードで招待」を選択
5. 先ほど表示したQRコードをスキャン
6. ボットがグループに追加されます

## ステップ6: グループIDを取得

### 方法1: LINE Notify経由（簡単）

1. LINE Notifyページ：https://notify-bot.line.me/my/
2. グループトークで「/groupid」と送信
3. ボットが返信するグループIDをコピー

### 方法2: 開発者ツール使用

1. Google Apps Scriptで以下のテスト関数を実行：

```javascript
function testGetGroupId() {
  const url = 'https://api.line.me/v2/bot/message/push';
  const token = 'YOUR_CHANNEL_ACCESS_TOKEN'; // 取得したトークン
  
  const options = {
    'method': 'post',
    'headers': {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token
    },
    'payload': JSON.stringify({
      'to': 'GROUP_ID_HERE', // グループIDがわからない場合
      'messages': [{
        'type': 'text',
        'text': 'テストメッセージ'
      }]
    })
  };
  
  try {
    const response = UrlFetchApp.fetch(url, options);
    Logger.log(response.getContentText());
  } catch(e) {
    Logger.log(e);
  }
}
```

## ステップ7: Code.gsに設定を反映

1. Google Apps Scriptエディタで`Code.gs`を開く
2. **15-16行目**を新しい値に更新：

```javascript
const LINE_CHANNEL_ACCESS_TOKEN = 'YOUR_NEW_ACCESS_TOKEN_HERE';
const LINE_GROUP_ID = 'YOUR_NEW_GROUP_ID_HERE';
```

3. **269-271行目**の無効化コードを削除：

```javascript
function sendLineMessage(message) {
  // 以下の3行を削除
  // Logger.log('LINE通知スキップ（月間制限）: ' + message);
  // return;
  
  const url = 'https://api.line.me/v2/bot/message/push';
  // 以下続く...
}
```

4. **保存**（Ctrl+S）
5. **新しいバージョンをデプロイ**

## ステップ8: 動作確認

1. アプリで**出勤打刻**ボタンをクリック
2. LINEグループに通知が届くか確認
3. **退勤打刻**ボタンをクリック
4. 勤務時間付きの通知が届くか確認

## トラブルシューティング

### 通知が届かない

1. **アクセストークンが正しいか確認**
2. **グループIDが正しいか確認**
3. **ボットがグループに追加されているか確認**
4. **LINE APIの月間制限を確認**（無料プランは500通/月）

### エラーが出る

Apps Scriptの**実行ログ**を確認：
- 401エラー → アクセストークンが間違っている
- 400エラー → グループIDが間違っている
- 403エラー → ボットがグループに追加されていない

## 注意事項

- **無料プランの制限**：月間500通まで
- **アクセストークンの管理**：絶対に公開しないこと
- **グループIDの確認**：Cで始まる英数字の長い文字列

---

設定が完了したら、LINE通知機能が有効になります！
