const pdfParse = require('pdf-parse');
const fs = require('fs');

async function test() {
    console.log("pdfParse type:", typeof pdfParse);
    if (typeof pdfParse !== 'function' && pdfParse.default) {
        console.log("Found .default on pdfParse");
    }
}
test();
