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
    return pixelmatch(imgSrc.data, imgMod.data, diff.data, width, height, {
        alpha: 0,
        threshold: 0.2,
        includeAA: true,
    })
}

async function scanCharSwapInSource(fontSource, fontMod, modChar, rangeChar) {
    let found = '';
    let confidence = 40000;
    const baseCmap = await listAllCharInCmap(fontSource)
    let baseMp = {}
    for (let char of baseCmap) {
        baseMp[char] = 1
    }
    for (let char of rangeChar) {
        if (!baseMp[char]) {
            console.log(`Ký tự này không có trong font gốc: ${char}`)
        }
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
    const fileHtml = 'zhihu.html';
    let content = fs.readFileSync(fileHtml, {encoding: 'utf8'});

    const list_fonts = parseFontFromHtml(content);
    let mapping = {};
    const mappingPath = `${PREFIX_PATH}/${getMd5(content)}.json`;
    if (!fs.existsSync(mappingPath)) {
        console.log(`Analyze for swapping characters`);
        for (let fm of list_fonts) {
            console.log(`Loading font ${fm.fontName}`)
            const fontPath = `${PREFIX_PATH}/${fm.fontName}.ttf`
            if (!fs.existsSync(fontPath)) {
                await convertBaseToTTF(fontPath, fm.source)
            }

            const fontMod = opentype.loadSync(fontPath, {})
            const modCmap = await listAllCharInCmap(fontMod)
            for (let modChar of modCmap) {
                const origin = await scanCharSwapInSource(fontSource, fontMod, modChar, modCmap);
                if (origin) {
                    mapping[modChar] = origin
                }
            }
        }
        fs.writeFileSync(mappingPath, JSON.stringify(mapping))
    } else {
        console.log(`Using cache for ${fileHtml}`);
        let contentMapping = fs.readFileSync(mappingPath, {encoding: 'utf8'});
        mapping = JSON.parse(contentMapping);
    }
    for (let key of Object.keys(mapping)) {
        content = content.replace(key, mapping[key])
    }

    fs.writeFileSync('zhihu_copy.html', content)
}


main()