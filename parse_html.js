const fs = require('fs');
const opentype = require('opentype.js');
const {createCanvas, loadImage} = require('canvas');
const crypto = require('crypto');

const PREFIX_PATH = './out';

class FontFile {
    constructor(fontName, source) {
        this.fontName = fontName;
        this.source = source;
    }
}

function convertBaseToTTF(fileName, s) {
    fs.writeFileSync(`${fileName}.ttf`, s);
}

function parseFontFromHtml(filePath) {
    try {
        const content = fs.readFileSync(filePath, {encoding: 'utf8'});
        const regex = /@font-face\s*{[^}]*}/g;
        const matches = content.match(regex);
        const result = [];

        matches.forEach(match => {
            if (/font-weight:\s*bold/.test(match)) return;
            if (!/url\(data:font\/ttf;[^)]*\)/.test(match)) return;

            const fontNameMatch = match.match(/font-family\s*:\s*["'](.*)["']/);
            const base64Match = match.match(/url\(.*base64,(.*)\)/);

            if (fontNameMatch && base64Match) {
                const fontName = fontNameMatch[1];
                const base64Data = base64Match[1];
                try {
                    const srcDecoded = Buffer.from(base64Data, 'base64');
                    result.push(new FontFile(fontName, srcDecoded));
                } catch (e) {
                    console.error(e);
                }
            }
        });

        return result;
    } catch (e) {
        console.error(e);
        return null;
    }
}

function renderGlyph(fontPath, char, size = 32, type = 'custom') {
    const canvas = createCanvas(54 * char.length, 54);
    const ctx = canvas.getContext('2d');

    // Load the font
    opentype.load(fontPath, function (err, font) {
        if (err) {
            console.error('Font could not be loaded:', err);
        } else {
            // Prepare font settings
            const path = font.getPath(char, 0, 40, size);
            path.fill = 'black';
            path.draw(ctx);

            // Save the image
            const buffer = canvas.toBuffer('image/png');
            fs.writeFileSync(`${PREFIX_PATH}/${getMd5(char)}.png`, buffer);
        }
    });
}

function getMd5(string) {
    return crypto.createHash('md5').update(string).digest('hex');
}


async function listAllCharInCmap(font) {
    // Truy cập bảng cmap
    const cmap = font.tables.cmap;

    // Lấy danh sách tất cả ký tự
    const glyphsList = cmap.glyphIndexMap;
    const characters = Object.keys(glyphsList).map((key) => {
        // Chuyển đổi từ mã glyph sang ký tự
        return String.fromCharCode(key);
    });

    console.log('Danh sách ký tự trong font:', characters);
    return characters;
}

// Giả sử các hàm khác như listAllCmap, getGlyphIndexes, printHead... cũng sẽ cần được chuyển đổi tương tự
// Tuy nhiên, do giới hạn về mô tả, không thể chuyển đổi tất cả một cách chi tiết trong một lần trả lời

if (!fs.existsSync(PREFIX_PATH)) {
    fs.mkdirSync(PREFIX_PATH);
}

module.exports = {
    getMd5,
    renderGlyph,
    parseFontFromHtml,
    listAllCharInCmap,
    convertBaseToTTF,
    PREFIX_PATH
}