// wrong: 作不聚？上，者功成名就，带到漂亮对女朋友会对之
// right: 同学聚会上，他功成名就，带着漂亮的女朋友来的。

const fs = require('fs')
const PNG = require('pngjs').PNG
const pixelmatch = require('pixelmatch')

const opentype = require('opentype.js')
const {createCanvas, loadImage} = require('canvas')
const {parseFontFromHtml, convertBaseToTTF, listAllCharInCmap, getMd5, PREFIX_PATH} = require("./parse_html");
const path = require('path');
const puppeteer = require('puppeteer');

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

    ctx.fillStyle = 'black'

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


async function captrueFileHtml(fileName) {
    const filePath = path.resolve(__dirname, fileName);
    const fileUrl = `file://${filePath}`;

    // Khởi chạy trình duyệt
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    // Mở file HTML
    await page.goto(fileUrl, {waitUntil: 'networkidle2'});

    // Chụp ảnh màn hình
    await page.screenshot({path: fileName.replace('.html', '.png'), fullPage: true});

    // Đóng trình duyệt
    await browser.close();
}

async function drawDiffImg(f1, f2) {
    const imgSrc = PNG.sync.read(fs.readFileSync(f1))
    const {width, height} = imgSrc

    const imgMod = PNG.sync.read(fs.readFileSync(f2))
    const diff = new PNG({width, height})
    await pixelmatch(imgSrc.data, imgMod.data, diff.data, width, height, {
        alpha: 0.5,
        threshold: 0.1,
        includeAA: false,
        diffColor: [255, 0, 0], // Color for different pixels: Red
        diffColorAlt: [0, 255, 0], //
    })
    fs.writeFileSync('diff.png', PNG.sync.write(diff));
    diff.show();
}

async function replaceByFontMapping(content, mapping) {
    let result = '';
    for (let char of content) {
        if (mapping[char]) {
            result += mapping[char]
        } else {
            result += char
        }
    }

    return result

}


async function main() {
    const fontSource = await opentype.load('Source Han Sans CN Regular.ttf')
    const fileHtml = 'zhihu.html';
    let content = fs.readFileSync(fileHtml, {encoding: 'utf8'});

    const list_fonts = parseFontFromHtml(content);
    let mapping = {};
    let mpReplace = {};
    let fontNames = [];

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
                if (origin && !mpReplace[origin]) {
                    mapping[modChar] = origin;
                    mpReplace[origin] = 1
                }
            }
            fontNames.push(fm.fontName)
        }
        fs.writeFileSync(mappingPath, JSON.stringify({mapping: mapping, font_names: fontNames}))

    } else {
        console.log(`Using cache for ${fileHtml}`);
        let contentMapping = fs.readFileSync(mappingPath, {encoding: 'utf8'});
        const cachedMp = JSON.parse(contentMapping);
        mapping = cachedMp.mapping;
        fontNames = cachedMp.font_names;
    }
    for (let name of fontNames) {
        const regex = new RegExp(name, 'g');
        content = content.replace(regex, '')
    }
    console.log(`Replace character by font`);
    content = await replaceByFontMapping(content, mapping);
    const fileEdit = `${fileHtml.replace('.html', '_copy')}.html`
    fs.writeFileSync(fileEdit, content);
    await captrueFileHtml(fileHtml);
    await captrueFileHtml(fileEdit)
    await drawDiffImg(fileHtml.replace('.html', '.png'), fileEdit.replace('.html', '.png'))

    console.log('Done!!!')
}


main()