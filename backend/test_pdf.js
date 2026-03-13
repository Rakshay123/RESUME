const pdfParse = require('pdf-parse');
const fs = require('fs');

async function test() {
    console.log("pdfParse type:", typeof pdfParse);
    console.log("pdfParse keys:", Object.keys(pdfParse));
    if (pdfParse.default) console.log("pdfParse.default type:", typeof pdfParse.default);
}
test();
