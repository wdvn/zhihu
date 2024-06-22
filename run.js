// wrong: 作不聚？上，者功成名就，带到漂亮对女朋友会对之
// right: 同学聚会上，他功成名就，带着漂亮的女朋友来的。

const fs = require('fs')
const PNG = require('pngjs').PNG
const pixelmatch = require('pixelmatch')

const opentype = require('opentype.js')
const {createCanvas, loadImage} = require('canvas')
const {features} = require('process')
const {parseFontFromHtml, convertBaseToTTF, listAllCharInCmap, getMd5, PREFIX_PATH} = require("./parse_html");
const {ssim} = require("ssim.js");

function get_path(font, char) {
    const glyph = font.getPath(char)
    return glyph
}

function getFilePath(fontName, s) {
    if (!fs.existsSync(`${PREFIX_PATH}/${fontName}`)) {
        fs.mkdirSync(`${PREFIX_PATH}/${fontName}`);
    }
    return `${PREFIX_PATH}/${fontName}/${getMd5(s)}.png`
}

async function save_char(font, char, type = 'mod') {
    const path = font.getPath(char, 30, 150, 150, {kerning: false, features: false})

    const canvas = createCanvas(200, 200)
    const ctx = canvas.getContext('2d')

    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, 200, 200)

    path.draw(ctx)

    const buffer = canvas.toBuffer('image/png')
    fs.writeFileSync(`${getFilePath(type, char)}`, buffer)
}

async function compareChar(fontSource, fontMod, sourceChar, modChar) {
    const f1 = getFilePath('origin', sourceChar);
    const f2 = getFilePath('mod', modChar);
    if (!fs.existsSync(f1)) {
        await save_char(fontSource, sourceChar, 'origin')
    }
    if (!fs.existsSync(f2)) {
        await save_char(fontMod, modChar, 'mod')
    }
    const imgSrc = PNG.sync.read(fs.readFileSync(f1))
    const {width, height} = imgSrc

    const imgMod = PNG.sync.read(fs.readFileSync(f2))
    const diff = new PNG({width, height})
    const numDiffPixels = pixelmatch(imgSrc.data, imgMod.data, diff.data, width, height, {
        alpha: 0,
        threshold: 0.2,
        includeAA: true,
    })

    const totalPixels = width * height;
    return numDiffPixels
}

async function scanCharSwapInSource(fontSource, fontMod, modChar) {
    let found = '';
    let confidence = 40000;
    const baseCmap = await listAllCharInCmap(fontSource)
    for (let char of baseCmap) {
        const out = await compareChar(fontSource, fontMod, char, modChar)
        if (out < confidence) {
            confidence = out
            found = char
        }
    }
    return found
}

async function main() {
    const fontSource = await opentype.load('Source Han Sans CN Regular.ttf')
    //
    // // save_char(font_1, '作', 'a1')
    // // save_char(font_2, '同', 'a2')
    //
    // save_char(font_1, '不', 'b1')
    // save_char(font_2, '学', 'b2')
    const list_fonts = parseFontFromHtml('zhihu.html');
    // for (let item of list_fonts) {
    //     convertBaseToTTF(item.fontName, item.source)
    //     const chars = await listAllCharInCmap(`${item.fontName}.ttf`)
    //     console.log(chars)
    //     compareChar(fontSource,)
    // }
    const fontMod = opentype.loadSync(`${list_fonts[0].fontName}.ttf`, {})
    const modCmap = await listAllCharInCmap(fontMod)
    let mapping = {};
    for (let modChar of modCmap) {
        const origin = await scanCharSwapInSource(fontSource, fontMod, modChar);
        if (origin) {
            mapping[modChar] = origin
        }
    }
    console.log(JSON.stringify(mapping))
}


main()
//
// const img1 = PNG.sync.read(fs.readFileSync('b1.png'))
// const img2 = PNG.sync.read(fs.readFileSync('b2.png'))
// const { width, height } = img1
// const diff = new PNG({ width, height })
//
// pixelmatch(img1.data, img2.data, diff.data, width, height, {
//   alpha: 0,
//   threshold: 0.2,
//   includeAA: true,
// })
//
// fs.writeFileSync('diff.png', PNG.sync.write(diff))
