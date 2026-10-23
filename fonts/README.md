# fonts/

見出し用の明朝体です。ページは外部のフォント配信を使わず、このファイルだけを読み込みます。

| ファイル | 内容 |
| --- | --- |
| `komorebi-mincho.woff2` | しっぽり明朝 Medium（Shippori Mincho・SIL Open Font License 1.1）を、このサイトで明朝表示する文字だけに絞った woff2（約58KB・375字） |
| `OFL.txt` | フォントのライセンス（再配布時に同梱が必要） |
| `subset-chars.txt` | woff2 に含めた文字の一覧（テスト `npm test` がこれを使って、見出しの文字が欠けていないか確かめる） |
| `collect-chars.cjs` | 明朝で表示される文字を集めるスクリプト（制作時だけ使う） |

含める文字は「ページで明朝表示されている文字」＋「ASCII・ひらがな・カタカナ全部・よく使う約物」です。
見出しの文言を変えて漢字が増えたときは、次の手順で作り直します（`npm test` の失敗で気づけます）。

```sh
# 1. 文字を集める（Playwright が必要）
node fonts/collect-chars.cjs index.html case.html > fonts/subset-chars.txt
# 2. サブセット化（fonttools と brotli が必要: pip install fonttools brotli）
#    元のフォントは https://github.com/google/fonts/tree/main/ofl/shipporimincho
pyftsubset ShipporiMincho-Medium.ttf --text-file=fonts/subset-chars.txt --flavor=woff2 \
  --layout-features='kern,palt,vkrn,vert,vrt2,liga' --output-file=fonts/komorebi-mincho.woff2
```

ビルド工程ではなく、文言を変えたときに手で1回だけ実行する作業です。サイトの表示には不要です。
