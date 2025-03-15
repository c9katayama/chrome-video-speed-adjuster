#!/bin/bash

# SVGからPNGに変換するスクリプト
# このスクリプトを実行するにはInkscapeが必要です

# 16x16のアイコンを作成
inkscape -w 16 -h 16 images/icon.svg -o images/icon16.png

# 48x48のアイコンを作成
inkscape -w 48 -h 48 images/icon.svg -o images/icon48.png

# 128x128のアイコンを作成
inkscape -w 128 -h 128 images/icon.svg -o images/icon128.png

echo "アイコンの変換が完了しました。"