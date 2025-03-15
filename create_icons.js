// SVGからPNGアイコンを生成するスクリプト
const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');
const { JSDOM } = require('jsdom');
const { DOMParser } = new JSDOM().window;

// アイコンサイズのリスト
const iconSizes = [16, 48, 128];

// SVGファイルを読み込む
const svgPath = path.join(__dirname, 'images', 'icon.svg');
const svgContent = fs.readFileSync(svgPath, 'utf8');

// SVGをDOMに変換
const parser = new DOMParser();
const svgDoc = parser.parseFromString(svgContent, 'image/svg+xml');

// SVGの幅と高さを取得
const svgWidth = parseInt(svgDoc.documentElement.getAttribute('width'));
const svgHeight = parseInt(svgDoc.documentElement.getAttribute('height'));

// 各サイズのアイコンを生成
async function generateIcons() {
  try {
    // SVG画像をロード
    const svgImage = await loadImage(`data:image/svg+xml;base64,${Buffer.from(svgContent).toString('base64')}`);
    
    // 各サイズのアイコンを生成
    for (const size of iconSizes) {
      // キャンバスを作成
      const canvas = createCanvas(size, size);
      const ctx = canvas.getContext('2d');
      
      // SVG画像を描画
      ctx.drawImage(svgImage, 0, 0, size, size);
      
      // PNGとして保存
      const iconPath = path.join(__dirname, 'images', `icon${size}.png`);
      const out = fs.createWriteStream(iconPath);
      const stream = canvas.createPNGStream();
      stream.pipe(out);
      
      out.on('finish', () => {
        console.log(`Created icon: ${iconPath}`);
      });
    }
  } catch (error) {
    console.error('Error generating icons:', error);
  }
}

generateIcons(); 