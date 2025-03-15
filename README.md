# Chrome Video Speed Adjuster

HTML5ビデオの再生速度を変更するためのChrome拡張機能です。

## 機能

- ウェブサイト上のHTML5ビデオの再生速度を変更できます
- ビデオの左上に再生速度を表示します
- キーボードショートカットで簡単に操作できます
- 巻き戻しや早送りの機能も搭載しています
- コントローラーの非表示時間をカスタマイズ可能

## インストール方法

### 開発版をインストールする場合

1. このリポジトリをクローンまたはダウンロードします
   ```
   git clone https://github.com/yourusername/chrome-video-speed-adjuster.git
   ```
2. Chromeで `chrome://extensions` を開きます
3. 右上の「デベロッパーモード」をオンにします
4. 「パッケージ化されていない拡張機能を読み込む」をクリックします
5. ダウンロードしたフォルダを選択します

## 使い方

拡張機能をインストールすると、HTML5ビデオを含むウェブページを開いたときに、ビデオの左上に再生速度インジケーターが表示されます。

### キーボードショートカット

デフォルトのキーボードショートカットは以下の通りです：

- **S** - 再生速度を下げる
- **D** - 再生速度を上げる
- **R** - 再生速度をリセット
- **Z** - 10秒巻き戻し
- **X** - 10秒早送り
- **V** - コントローラーの表示/非表示を切り替え

### カスタマイズ

拡張機能のオプションページで以下の設定をカスタマイズできます：

- 速度変更のステップ幅
- リセット時の速度
- 巻き戻し/早送りの秒数
- コントローラーの非表示までの時間
- キーボードショートカット
- コントローラーの初期表示/非表示

## 開発

### 必要な環境

- Node.js
- npm

### セットアップ

```bash
# リポジトリのクローン
git clone https://github.com/yourusername/chrome-video-speed-adjuster.git
cd chrome-video-speed-adjuster

# 依存パッケージのインストール
npm install

# アイコンの生成
node create_icons.js
```

## 貢献方法

1. このリポジトリをフォークします
2. 新しいブランチを作成します (`git checkout -b feature/amazing-feature`)
3. 変更をコミットします (`git commit -m 'Add some amazing feature'`)
4. ブランチにプッシュします (`git push origin feature/amazing-feature`)
5. プルリクエストを作成します

## 注意事項

- この拡張機能はHTML5ビデオにのみ対応しています
- 一部のウェブサイトでは、キーボードショートカットが他の機能と競合する場合があります
- ローカルファイルでの使用には、拡張機能の設定でファイルURLへのアクセスを許可する必要があります

## ライセンス

[MIT License](LICENSE)
