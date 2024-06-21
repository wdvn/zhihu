// wrong: 作不聚？上，者功成名就，带到漂亮对女朋友会对之
// right: 同学聚会上，他功成名就，带着漂亮的女朋友来的。

const fs = require('fs')
const PNG = require('pngjs').PNG
const pixelmatch = require('pixelmatch')

const opentype = require('opentype.js')
const { createCanvas, loadImage } = require('canvas')
const { features } = require('process')

function get_path(font, char) {
  const glyph = font.getPath(char)
  return glyph
}

function save_char(font, char, name) {
  const path = font.getPath(char, 30, 150, 150, { kerning: false, features: false })
  console.log(path.toSVG())

  const canvas = createCanvas(200, 200)
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, 200, 200)

  path.draw(ctx)

  const buffer = canvas.toBuffer('image/png')
  fs.writeFileSync(`${name}.png`, buffer)
}

async function main() {
  const font_1 = await opentype.load('font_1.ttf')
  const font_2 = await opentype.load('font_o.ttf')

  // save_char(font_1, '作', 'a1')
  // save_char(font_2, '同', 'a2')

  save_char(font_1, '不', 'b1')
  save_char(font_2, '学', 'b2')
}

main()

const img1 = PNG.sync.read(fs.readFileSync('b1.png'))
const img2 = PNG.sync.read(fs.readFileSync('b2.png'))
const { width, height } = img1
const diff = new PNG({ width, height })

pixelmatch(img1.data, img2.data, diff.data, width, height, {
  alpha: 0,
  threshold: 0.2,
  includeAA: true,
})

fs.writeFileSync('diff.png', PNG.sync.write(diff))
