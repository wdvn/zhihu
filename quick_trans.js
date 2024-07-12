let dictUserNames = {};
let dictNames = {};
let dictVP = {};
let dictPhienAm = {};
let dictReady = {
    PhienAm: false,
    Vietphrase: false,
    Names: false
};
if (JSON.stringify(dictPhienAm) != "{}")
    dictReady.PhienAm = true;
const marks = ["。", "，", "、", "“", "”", "！", "？", "\n", "：", ".", ",", "!", "?",];

function rawToDict(raw) {
    let lines = String(raw).trim().split("\n");
    let resultDict = {
        Han: [],
        HanViet: {}
    };
    for (let i = 0; i < lines.length; i++) {
        HanViet = lines[i].split("=");
        if (HanViet.length < 2)
            continue;
        HanViet[0] = HanViet[0].trim();
        HanViet[1] = HanViet[1].trim();
        if (HanViet[0] == "")
            continue;
        resultDict.HanViet[HanViet[0]] = HanViet[1];
    }
    resultDict.Han = [...new Set(Object.keys(resultDict.HanViet))];
    resultDict.Han.sort((b, a) => a.length - b.length || a.localeCompare(b));
    return resultDict;
}

function translatePhienAmSimple(text) {
    let result = "";
    text = text.trim();
    for (let i = 0; i < text.length; i++) {
        PhienAm = dictPhienAm.HanViet[text.charAt(i)];
        if (PhienAm != undefined)
            result += PhienAm + " ";
        else
            result += text.charAt(i);
    }
    return result.trim();
}

//*******************UPDATE
let trieDict = null;
let mergeDict = {};

class TrieNode {
    constructor() {
        this.children = {};
        this.isEndOfWord = false;
    }
}

// muốn xóa từ khỏi từ Trie dùng
// deleteHelper(trieDict,'từ muốn xóa')
function deleteHelper(node, word, index = 0) {
    if (index === word.length) {
        if (!node.isEndOfWord) {
            return false;
        }
        node.isEndOfWord = false;
        return Object.keys(node.children).length === 0;
    }

    const char = word[index];
    const child = node.children[char];
    if (!child) {
        return false;
    }

    const shouldDeleteChild = deleteHelper(child, word, index + 1);
    if (shouldDeleteChild) {
        delete node.children[char];
        return !node.isEndOfWord && Object.keys(node.children).length === 0;
    }
    return false;
}


function buildTrie(words) {
    let root = new TrieNode();
    for (let word of words) {
        let node = root;
        for (let char of word) {
            if (!(char in node.children)) {
                node.children[char] = new TrieNode();
            }
            node = node.children[char];
        }
        node.isEndOfWord = true;
    }
    return root;
}

function findLongestPrefix(root, str) {
    let node = root;
    let longestPrefix = "";

    for (let i = 0; i < str.length; i++) {
        let char = str[i];
        if (char in node.children) {
            longestPrefix += char;
            node = node.children[char];
        } else {
            break;
        }
    }

    return longestPrefix;
}

function binarySearch(root, target) {
    return findLongestPrefix(root, target);
}


function tokenize(trie, dictionary, text) {
    let maxPrefix = '';
    let translated = []
    let skip = false;
    while (0 < text.length) {
        skip = false;
        maxPrefix = binarySearch(trie, text)
        if (!maxPrefix) {
            skip = true
            maxPrefix = text[0]
            let latinIndex = 1;
            while (latinIndex < text.length && isNumberOrAlphabet(text[latinIndex])) {
                maxPrefix += text[latinIndex]
                latinIndex++
            }
        }
        // check prefix in dictionary
        if (dictionary[maxPrefix] === undefined && !skip) {
            while (maxPrefix.length > 1) {
                maxPrefix = maxPrefix.slice(0, -1);
                if (dictionary[maxPrefix]) {
                    break
                }
            }
        }
        let word = maxPrefix;
        if (dictionary[maxPrefix] !== undefined) word = dictionary[maxPrefix]
        if (word) {
            translated.push(word)
        }

        text = text.replace(maxPrefix, "")

    }
    return translated
}

function rephrase(tokens) {
    let nonWord = {
        '"': 1,
        '[': 1,
        '{': 1,
        ' ': 1,
        ',': 1,
        '!': 1,
        '?': 1,
        ';': 1,
        "'": 1,
        '.': 1,
    }
    let result = [];
    let i = 0;
    let upper = false;
    while (i < tokens.length && !upper) {
        let word = tokens[i]
        if (!nonWord[tokens[i]]) {
            result.push(" ")
            word = toUpperCaseFirstLetter(word)
            upper = true
        }
        result.push(word)
        i++

    }
    while (i < tokens.length) {
        if (!nonWord[tokens[i]]) {
            result.push(" ")
        }
        result.push(tokens[i])
        i++
    }
    return result.join("")
}

// Sử dụng
// dictUserNames > dictNames > dictVP > dictPhienAm > ignore  "\u0528" + not in dict

function translate(trie, dictionary, text) {
    let lines = []
    for (let line of text.split("\n")) {
        // lines.push(line)
        const tokens = tokenize(trie, dictionary, line.trim());
        // rephrase is optional
        lines.push(rephrase(tokens))

    }
    return lines.join("\n")

}

async function initQT(data) {
    console.log(data)
    if (!trieDict) {
        const dictSpecial = {
            Han: ["，", "“", " ”", "。", "、", '？', "的"],
            HanViet: {
                "，": ",",
                "“": '"',
                " ”": '"',
                "。": '.',
                "、": ",",
                '？': '?',
                "的": "",
            }
        }
        let listDict = [];
        listDict.push(dictSpecial)
        listDict.push(dictUserNames)
        listDict.push(dictNames)
        listDict.push(dictVP)
        listDict.push(dictPhienAm)
        let book = {
            Han: [],
            HanViet: {},
        };
        for (let i = 0; i < listDict.length; i++) {
            if (!listDict[i].Han) {
                continue
            }
            for (let word of listDict[i].Han) {
                if (book.HanViet[word] !== undefined) {
                    continue
                }
                book.Han.push(word)
                book.HanViet[word] = listDict[i].HanViet[word].split("/")[0]
            }
        }
        trieDict = buildTrie(book.Han)
        mergeDict = book
        console.log("dictUserNames", dictUserNames)
        console.log('dictNames', dictNames)
        console.log('dictVP', dictVP)
        console.log('dictVP', dictPhienAm)
        console.log('FINSH INIT QT', book.HanViet);
    }
}

function translate2(text) {
    initQT()
    return translate(trieDict, mergeDict.HanViet, text)
}

//*******************END UPDATE
// function translate2(txtChinese) {
//     result = [];
//     tmpArr = {};
//     for (let i = 0; i < dictUserNames.Han.length; i++) {
//         let tempHan = dictUserNames.Han[i];
//         pos = txtChinese.indexOf(tempHan);
//         while (pos > -1) {
//             tmpArr.pos = pos;
//             tmpArr.orgText = tempHan;
//             tmpArr.transText = dictUserNames.HanViet[tempHan];
//             tmpArr.dict = "UserNames";
//             result.push(tmpArr);
//             tmpArr = {};
//             txtChinese = txtChinese.replace(tempHan, "\u0528".repeat(tempHan.length));
//             pos = txtChinese.indexOf(tempHan, pos + 1);
//         }
//     }
//     for (let i = 0; i < dictNames.Han.length; i++) {
//         let tempHan = dictNames.Han[i];
//         pos = txtChinese.indexOf(tempHan);
//         while (pos > -1) {
//             tmpArr.pos = pos;
//             tmpArr.orgText = tempHan;
//             tmpArr.transText = dictNames.HanViet[tempHan];
//             tmpArr.dict = "Names";
//             result.push(tmpArr);
//             tmpArr = {};
//             txtChinese = txtChinese.replace(tempHan, "\u0528".repeat(tempHan.length));
//             pos = txtChinese.indexOf(tempHan, pos + 1);
//         }
//     }
//     for (let i = 0; i < dictVP.Han.length; i++) {
//         let tempHan = dictVP.Han[i];
//         pos = txtChinese.indexOf(tempHan);
//         while (pos > -1) {
//             tmpArr.pos = pos;
//             tmpArr.orgText = tempHan;
//             tmpArr.transText = dictVP.HanViet[tempHan];
//             tmpArr.dict = "VP";
//             result.push(tmpArr);
//             tmpArr = {};
//             txtChinese = txtChinese.replace(tempHan, "\u0528".repeat(tempHan.length));
//             pos = txtChinese.indexOf(tempHan, pos + 1);
//         }
//     }
//     for (let i = 0; i < dictPhienAm.Han.length; i++) {
//         let tempHan = dictPhienAm.Han[i];
//         pos = txtChinese.indexOf(tempHan);
//         while (pos > -1) {
//             tmpArr.pos = pos;
//             tmpArr.orgText = tempHan;
//             tmpArr.transText = dictPhienAm.HanViet[tempHan];
//             tmpArr.dict = "PhienAm";
//             result.push(tmpArr);
//             tmpArr = {};
//             txtChinese = txtChinese.replace(tempHan, "\u0528".repeat(tempHan.length));
//             pos = txtChinese.indexOf(tempHan, pos);
//         }
//     }
//     for (let i = 0; i < txtChinese.length; i++) {
//         if (txtChinese.charAt(i) != "\u0528") {
//             tmpArr.pos = i;
//             tmpArr.orgText = txtChinese.charAt(i);
//             tmpArr.transText = tmpArr.orgText;
//             result.push(tmpArr);
//             tmpArr = {};
//         }
//     }
//     return result.sort((a, b) => a.pos - b.pos);
// }

function isNumberOrAlphabet(inputString) {
    return /^[0-9]+$/.test(inputString) || /^[a-zA-Z]+$/.test(inputString);
}

function toUpperCaseFirstLetterEachWord(text) {
    let tmpArr = text.split(" ");
    for (i = 0; i < tmpArr.length; i++)
        tmpArr[i] = tmpArr[i].charAt(0).toUpperCase() + tmpArr[i].slice(1);
    return tmpArr.join(" ");
}

function toUpperCaseFirstLetter(text) {
    return text.charAt(0).toUpperCase() + text.slice(1);
}

function VpToHTML(transArr) {
    let is_first_char_in_line = true;
    let result = '';
    for (let line of transArr.split("\n")) {
        result += `<p class="chapter_line">` + line + '</p>';
    }

    return result;
}

function trimLines(input) {
    return input.split("\n").map((line) => line.trim()).filter((line) => line !== "").join("\n");
}

function trimLines2(input) {
    return input.split("\n").map((line) => line.trim()).join("\n");
}

function replaceEssence(input) {
    const replacementMap = {
        "０": "0",
        "１": "1",
        "２": "2",
        "３": "3",
        "４": "4",
        "５": "5",
        "６": "6",
        "７": "7",
        "８": "8",
        "９": "9",
        "Ｚ": "Z",
        "Ｙ": "Y",
        "Ｘ": "X",
        "Ｗ": "W",
        "Ｖ": "V",
        "Ｕ": "U",
        "Ｔ": "T",
        "Ｓ": "S",
        "Ｒ": "R",
        "Ｑ": "Q",
        "Ｐ": "P",
        "Ｏ": "O",
        "Ｎ": "N",
        "Ｍ": "M",
        "Ｌ": "L",
        "Ｋ": "K",
        "Ｊ": "J",
        "Ｉ": "I",
        "Ｈ": "H",
        "Ｇ": "G",
        "Ｆ": "F",
        "Ｅ": "E",
        "Ｄ": "D",
        "Ｃ": "C",
        "Ｂ": "B",
        "Ａ": "A",
        "ｚ": "z",
        "ｙ": "y",
        "ｘ": "x",
        "ｗ": "w",
        "ｖ": "v",
        "ｕ": "u",
        "ｔ": "t",
        "ｓ": "s",
        "ｒ": "r",
        "ｑ": "q",
        "ｐ": "p",
        "ｏ": "o",
        "ｎ": "n",
        "ｍ": "m",
        "ｌ": "l",
        "ｋ": "k",
        "ｊ": "j",
        "ｉ": "i",
        "ｈ": "h",
        "ｇ": "g",
        "ｆ": "f",
        "ｅ": "e",
        "ｄ": "d",
        "ｃ": "c",
        "ｂ": "b",
        "ａ": "a",
        "＿": "_",
        "╴": "_",
        "’": "’",
        "》": "⟩",
        "｝": "}",
        "﹜": "}",
        "】": "]",
        "］": "]",
        "﹞": "]",
        "）": ")",
        "｠": ")",
        "〈": "⟨",
        "《": "⟨",
        "｛": "{",
        "﹛": "{",
        "【": "[",
        "［": "[",
        "﹝": "[",
        "（": "(",
        "｟": "(",
        "“": "“",
        "”": "”",
        "』": "”",
        "‘": "‘",
        "「": "‘",
        "℃": "℃",
        "°": "°",
        "￡": "￡",
        "＄": "$",
        "﹩": "$",
        "￥": "￥",
        "·": "·",
        "•": "·",
        "‧": "·",
        "・": "·",
        "﹖": "?",
        "？": "?",
        "﹗": "!",
        "！": "!",
        "～": "~",
        "﹀": "∨",
        "︿": "∧",
        "︳": "|",
        "｜": "|",
        "︱": "|",
        "≧": "≥",
        "≦": "≤",
        "≒": "≈",
        "＝": "=",
        "﹦": "=",
        "＞": ">",
        "﹥": ">",
        "＜": "<",
        "﹤": "<",
        "﹣": "-",
        "﹟": "#",
        "＾": "^",
        "‵": "`",
        "¨": "¨",
        "‥": "¨",
        "ˉ": "-",
        "。": ".",
        "，": ",",
        "､ ": ",",
        "、": ",",
        "」": "’",
        "『": "“",
        "：": ":",
        "；": ";",
        "､": ",",
    };
    const regex = new RegExp(Object.keys(replacementMap).map((key) => escapeRegExp(key)).join("|"), "g");
    return input.replace(regex, (char) => replacementMap[char] || char);
}

function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function startTranslations() {
    const start = performance.now();
    let listNames = document.getElementById("Names2").value.trim();
    dictUserNames = rawToDict(listNames);
    let new_chapter_title = capNames(1, translate2Result(chapter_title))
    document.getElementById("chapter_title").innerHTML = new_chapter_title;
    document.title = new_chapter_title;
    let textTrung = replaceEssence(trimLines2(text_content_no_img_1));
    txt_content = textTrung;
    let text2 = translate2(textTrung)
    let text2HTML = VpToHTML(text2)
    let trans_doc = text2HTML.split("\n");
    for (let i = 0; i < array_img.length; i++) {
        const img = array_img[i];
        const line_temp = img.line;
        trans_doc[line_temp] = trans_doc[line_temp].replace(/.*/, img.content);
    }
    trans_doc = trans_doc.join("");
    document.getElementById("chap_content").innerHTML = trans_doc;
    if (author_say != null && author_say.length > 0) {
        let text3 = translate2(replaceEssence(trimLines2(author_say)));
        document.getElementById("author_say").innerHTML = VpToHTML(text3);
    }
    toggleEditor();
    const end = performance.now();
    console.log(`Execution time: ${end - start} ms`);
}

function loadOnSitePhienAm(dict = "https://rawcdn.githack.com/Moleys/VietPhrase/main/ChinesePhienAmWords.txt") {
    fetch(dict).then((res) => res.text()).then((data) => {
            dictPhienAm = rawToDict(data.trim());
            dictReady.PhienAm = true;
            saveDictPhienAm();
        }
    );
}

function loadOnSiteVietphrase(dict = "https://rawcdn.githack.com/Moleys/VietPhrase/main/VietPhrase.txt") {
    fetch(dict).then((res) => res.text()).then((data) => {
            dictVP = rawToDict(data.trim());
            dictReady.Vietphrase = true;
            saveDictVP();
        }
    );
}

async function loadOnSiteNames(dict = "https://rawcdn.githack.com/Moleys/VietPhrase/main/Names.txt") {
    let res = await fetch(dict);
    let data = await res.text();
    dictNames = rawToDict(data.trim());
    dictReady.Names = true;
    saveDictNames();
    return dictNames;
}

function checkTextInNames(text) {
    if (dictUserNames["Han"] && dictUserNames["Han"].includes(text)) {
        return true;
    }
    return false;
}

function getDictionaryMeaning(text) {
    if (dictNames.HanViet.hasOwnProperty(text)) {
        return dictNames.HanViet[text];
    }
    if (dictVP.HanViet.hasOwnProperty(text)) {
        return dictNames.HanViet[text];
    }
    return null;
}

function suggestWordsFromDictionary() {
    let targetElement = document.getElementById("translationSuggestionFromDictionary");
    targetElement.innerHTML = "";
    let wordMeaning = getDictionaryMeaning(document.getElementById("frmUpdate_txtChinese").innerText);
    if (wordMeaning != null) {
        let wordMeaningArray = wordMeaning.split("/");
        for (let word of wordMeaningArray) {
            let markElement = document.createElement("mark");
            markElement.className = "primary";
            markElement.innerText = word;
            markElement.onclick = function () {
                setTextToNames(this.innerText);
            }
            ;
            let spaceElement = document.createTextNode(" ");
            targetElement.appendChild(markElement);
            targetElement.appendChild(spaceElement);
        }
    }
}

function suggestWordsFromMoldich() {
    let targetElement = document.getElementById("translationSuggestionFromDictionary");
    fetch("https://moldich.gq/api.php?q=" + document.getElementById("frmUpdate_txtChinese").innerText).then(function (responseMoldich) {
        return responseMoldich.json();
    }).then(function (wordMeaning) {
        if (wordMeaning != null) {
            for (let word of wordMeaning) {
                let markElement = document.createElement("mark");
                markElement.className = "primary";
                markElement.innerText = word;
                markElement.onclick = function () {
                    setTextToNames(this.innerText);
                }
                ;
                let spaceElement = document.createTextNode(" ");
                targetElement.appendChild(markElement);
                targetElement.appendChild(spaceElement);
            }
        }
    }).catch(function (error) {
        console.error("Error fetching data:", error);
    });
}

function setTranslationSuggestion() {
    let selectedChineseText = document.getElementById("frmUpdate_txtChinese").innerText;
    let transPhienAm = translatePhienAmSimple(selectedChineseText);
    document.getElementById("txtPhienAmThuong").innerText = transPhienAm;
    let transTextValues = translate2Result(selectedChineseText);
    document.getElementById("frmUpdate_txtViet").value = transTextValues;
    suggestWordsFromDictionary();
    suggestWordsFromMoldich();
}

function translate2Result(text) {
    const convert = translate2(text);
    if (typeof convert === 'string') {
        return convert
    }
    let inputString = translate2(text).map((obj) => obj.transText.split("/")[0]).join(" ").trim();
    const replacements = [[/“\s/g, "“"], [/'\s/g, "'"], [/\"\s/g, '"'], [/'/g, "'"], [/:,\s/g, ": "], [/\s\?/g, "?"], [/\s\./g, ". "], [/\s:\s/g, ": "], [/⟨\s/g, "⟨"], [/\s⟩/g, "⟩"], [/\[\s/g, "["], [/\s\]/g, "]"], [/\s…/g, "…"], [/,/g, ", "], [/\s!/g, "!"], [/”\s/g, "”"], [/\s:/g, ":"], [/\s,\s/g, ", "], [/\s\s/g, " "], [/\s：\s/g, ": "], [/\s，\s/g, ", "],];
    let outputString = inputString;
    for (const [pattern, replacement] of replacements) {
        outputString = outputString.replace(pattern, replacement);
    }
    return outputString;
}

function loadFrmUpdateDict(selectedText) {
    let selectedChineseText = selectedText.trim();
    if (selectedChineseText == "" && !isChineseText(selectedChineseText))
        return;
    document.getElementById("modalEditNames").style = "display:block";
    document.getElementById("frmUpdate_txtChinese").innerText = selectedChineseText;
    document.getElementById("frmUpdate_txtChineseLeft").innerText = "";
    document.getElementById("frmUpdate_txtChineseRight").innerText = "";
    document.getElementById("frmUpdate_btnDelete").style.display = "none";
    setTranslationSuggestion();
    if (checkTextInNames(selectedChineseText) == true) {
        document.getElementById("frmUpdate_btnDelete").style.display = "inline-block";
    }
}

function dictToRaw(dictionary) {
    let rawOutput = "";
    for (const key in dictionary) {
        if (Array.isArray(dictionary[key])) {
            dictionary[key].forEach((value) => {
                    rawOutput += `${value}=${dictionary["HanViet"][value]}\n`;
                }
            );
        }
    }
    return rawOutput.trim();
}

function deleteTextFromNames(text) {
    if (dictUserNames["Han"] && dictUserNames["Han"].includes(text)) {
        const index = dictUserNames["Han"].indexOf(text);
        dictUserNames["Han"].splice(index, 1);
    }
}

function frmUpdate_btnDeleteClick() {
    let textChinese = document.getElementById("frmUpdate_txtChinese").innerText;
    modalEditNamesClose();
    deleteTextFromNames(textChinese);
    document.getElementById("Names2").value = dictToRaw(dictUserNames);
    selectedText = "";
    startTranslations();
}

function setTextToNames(text) {
    document.getElementById("frmUpdate_txtViet").value = text;
}

function emptyNames() {
    document.getElementById("frmUpdate_txtViet").value = "";
}

function copyNamesRaw() {
    navigator.clipboard.writeText(document.getElementById("frmUpdate_txtChinese").innerText);
}

function capNames(number, inputString) {
    const words = inputString.split(" ");
    if (number === 0)
        return inputString.toLowerCase();
    if (number === 10)
        return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
    for (let i = 0; i < words.length; i++) {
        words[i] = i < number ? words[i].charAt(0).toUpperCase() + words[i].slice(1) : words[i].toLowerCase();
    }
    return words.join(" ");
}

function setCapNames(number) {
    document.getElementById("frmUpdate_txtViet").value = capNames(number, document.getElementById("frmUpdate_txtViet").value);
}

function frmUpdate_btnSaveClick() {
    let txtChinese = document.getElementById("frmUpdate_txtChinese").innerText.trim();
    let txtViet = document.getElementById("frmUpdate_txtViet").value.trim();
    let txtListNames = document.getElementById("Names2").value.trim();
    txtListNames += "\n" + txtChinese + "=" + txtViet;
    document.getElementById("Names2").value = txtListNames.trim();
    localStorage.setItem("Names_" + bookid, txtListNames);
    document.getElementById("modalEditNames").style.display = "none";
    startTranslations();
}

function modalEditNamesClose() {
    document.getElementById("modalEditNames").style.display = "none";
}

function frmUpdate_btnCancelClick() {
    modalEditNamesClose();
}

function isChineseText(text) {
    regex = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff66-\uff9f]/;
    return text.match(regex) != null;
}

document.getElementById("prevLeft").addEventListener("click", function () {
    const leftSpan = document.getElementById("frmUpdate_txtChineseLeft");
    const middleSpan = document.getElementById("frmUpdate_txtChinese");
    if (leftSpan.textContent.length > 0) {
        const lastChar = leftSpan.textContent.slice(-1);
        middleSpan.textContent = lastChar + middleSpan.textContent;
        leftSpan.textContent = leftSpan.textContent.slice(0, -1);
        setTranslationSuggestion();
    }
});
document.getElementById("prevRight").addEventListener("click", function () {
    const leftSpan = document.getElementById("frmUpdate_txtChineseLeft");
    const middleSpan = document.getElementById("frmUpdate_txtChinese");
    if (middleSpan.textContent.length > 1) {
        const firstChar = middleSpan.textContent.charAt(0);
        middleSpan.textContent = middleSpan.textContent.slice(1);
        leftSpan.textContent = leftSpan.textContent + firstChar;
        setTranslationSuggestion();
    }
});
document.getElementById("nextLeft").addEventListener("click", function () {
    const middleSpan = document.getElementById("frmUpdate_txtChinese");
    const rightSpan = document.getElementById("frmUpdate_txtChineseRight");
    if (middleSpan.textContent.length > 1) {
        const lastChar = middleSpan.textContent.slice(-1);
        middleSpan.textContent = middleSpan.textContent.slice(0, -1);
        rightSpan.textContent = lastChar + rightSpan.textContent;
        setTranslationSuggestion();
    }
});
document.getElementById("nextRight").addEventListener("click", function () {
    const middleSpan = document.getElementById("frmUpdate_txtChinese");
    const rightSpan = document.getElementById("frmUpdate_txtChineseRight");
    if (rightSpan.textContent.length > 0) {
        const firstChar = rightSpan.textContent.charAt(0);
        middleSpan.textContent = middleSpan.textContent + firstChar;
        rightSpan.textContent = rightSpan.textContent.slice(1);
        setTranslationSuggestion();
    }
});

function getListNamesToTextarea() {
    if (localStorage.getItem("Names_" + bookid) !== null) {
        let listNames = localStorage.getItem("Names_" + bookid).trim();
        dictUserNames = rawToDict(listNames);
        document.getElementById("Names2").textContent = listNames;
    }
}

function saveDictVP() {
    const request = indexedDB.open("QTlikedWeb", 1);
    request.onsuccess = () => {
        dbase = request.result;
        dbase.transaction(["essentialDicts"], "readwrite").objectStore("essentialDicts").put({
            name: "Vietphrase",
            data: JSON.stringify(dictVP)
        }).onsuccess = function (e) {
            console.log(e.target.result);
        }
        ;
        dbase.transaction(["essentialDicts"]).oncomplete = () => {
            dbase.close();
        }
        ;
    }
    ;
}

function saveDictNames() {
    const request = indexedDB.open("QTlikedWeb", 1);
    request.onsuccess = () => {
        dbase = request.result;
        dbase.transaction(["essentialDicts"], "readwrite").objectStore("essentialDicts").put({
            name: "Names",
            data: JSON.stringify(dictNames)
        }).onsuccess = function (e) {
            console.log(e.target.result);
        }
        ;
        dbase.transaction(["essentialDicts"]).oncomplete = () => {
            dbase.close();
        }
        ;
    }
    ;
}

function saveDictPhienAm() {
    const request = indexedDB.open("QTlikedWeb", 1);
    request.onsuccess = () => {
        dbase = request.result;
        dbase.transaction(["essentialDicts"], "readwrite").objectStore("essentialDicts").put({
            name: "PhienAm",
            data: JSON.stringify(dictPhienAm)
        }).onsuccess = function (e) {
            console.log(e.target.result);
        }
        ;
        dbase.transaction(["essentialDicts"]).oncomplete = () => {
            dbase.close();
        }
        ;
    }
    ;
}

async function checkDictionaryExists(dictionaryName, db) {
    return new Promise((resolve, reject) => {
            const transaction = db.transaction(["essentialDicts"], "readonly");
            const objectStore = transaction.objectStore("essentialDicts");
            const getRequest = objectStore.get(dictionaryName);
            getRequest.onsuccess = function (event) {
                const result = event.target.result;
                if (result) {
                    resolve(true);
                } else {
                    resolve(false);
                }
            }
            ;
            getRequest.onerror = function (e) {
                reject(e.target.error);
            }
            ;
        }
    );
}

const indexedDB = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB || window.shimIndexedDB;
var dbase;

function firstRun() {
    let request = indexedDB.open("QTlikedWeb", 1);
    request.onupgradeneeded = () => {
        dbase = request.result;
        if (!dbase.objectStoreNames.contains("essentialDicts"))
            dbase.createObjectStore("essentialDicts", {
                keyPath: "name"
            });
        dbase.close();
    }
    ;
    request.onsuccess = () => {
        console.log("connect database successed");
    }
    ;
    request.onerror = function (e) {
        console.log("Loi", e.target.error);
    }
    ;
}

function loadDictVP() {
    const request = indexedDB.open("QTlikedWeb", 1);
    request.onsuccess = () => {
        dbase = request.result;
        if (dbase.objectStoreNames.contains("essentialDicts"))
            dbase.transaction("essentialDicts").objectStore("essentialDicts").get("Vietphrase").onsuccess = function (e) {
                if (e.target.result == undefined)
                    return;
                dictVP = JSON.parse(e.target.result.data);
                dictReady.Vietphrase = true;
                dbase.transaction("essentialDicts").oncomplete = () => {
                    dbase.close();
                }
                ;
            }
            ;
    }
    ;
}

function loadDictNames() {
    const request = indexedDB.open("QTlikedWeb", 1);
    request.onsuccess = () => {
        dbase = request.result;
        if (dbase.objectStoreNames.contains("essentialDicts"))
            dbase.transaction("essentialDicts").objectStore("essentialDicts").get("Names").onsuccess = function (e) {
                if (e.target.result == undefined)
                    return;
                dictNames = JSON.parse(e.target.result.data);
                dictReady.Names = true;
                dbase.transaction("essentialDicts").oncomplete = () => {
                    dbase.close();
                }
                ;
            }
            ;
    }
    ;
}

function loadDictPhienAm() {
    const request = indexedDB.open("QTlikedWeb", 1);
    request.onsuccess = () => {
        dbase = request.result;
        if (dbase.objectStoreNames.contains("essentialDicts"))
            dbase.transaction("essentialDicts").objectStore("essentialDicts").get("PhienAm").onsuccess = function (e) {
                if (e.target.result == undefined)
                    return;
                dictPhienAm = JSON.parse(e.target.result.data);
                dictReady.PhienAm = true;
                dbase.transaction("essentialDicts").oncomplete = () => {
                    dbase.close();
                }
                ;
            }
            ;
    }
    ;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function initVP() {
    firstRun();
    const db = await new Promise((resolve, reject) => {
            const request = indexedDB.open("QTlikedWeb", 1);
            request.onsuccess = () => {
                resolve(request.result);
            }
            ;
            request.onerror = () => {
                reject(request.error);
            }
            ;
        }
    );
    const objectStore = db.transaction(["essentialDicts"], "readonly").objectStore("essentialDicts");
    const namesRequest = objectStore.get("Names");
    const vpRequest = objectStore.get("Vietphrase");
    const paRequest = objectStore.get("PhienAm");
    namesRequest.onsuccess = function (event) {
        const dictNamesData = event.target.result;
        if (dictNamesData) {
            dictNames = JSON.parse(dictNamesData.data);
            dictReady.Names = true;
        } else {
            loadOnSiteNames();
        }
        console.log(dictReady);
    }
    ;
    vpRequest.onsuccess = function (event) {
        const dictVPData = event.target.result;
        if (dictVPData) {
            dictVP = JSON.parse(dictVPData.data);
            dictReady.Vietphrase = true;
        } else {
            loadOnSiteVietphrase();
        }
        console.log(dictReady);
    }
    ;
    paRequest.onsuccess = function (event) {
        const dictPhienAmData = event.target.result;
        if (dictPhienAmData) {
            dictPhienAm = JSON.parse(dictPhienAmData.data);
            dictReady.PhienAm = true;
        } else {
            loadOnSitePhienAm();
        }
        console.log(dictReady);
    }
    while (!dictReady.Names && !dictReady.Vietphrase && !dictReady.PhienAm) {
        await sleep(1000);
    }

    db.close();
    getListNamesToTextarea();
    await initQT();
}

initVP();
