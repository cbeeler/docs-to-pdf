"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generatePuppeteerPDFMargin = exports.commaSeparatedList = void 0;
function commaSeparatedList(value) {
    return value.split(',');
}
exports.commaSeparatedList = commaSeparatedList;
function generatePuppeteerPDFMargin(value) {
    const marginStrings = commaSeparatedList(value);
    const marginTop = marginStrings[0];
    const marginRight = marginStrings[1];
    const marginBottom = marginStrings[2];
    const marginLeft = marginStrings[3];
    const generatedMargins = {
        top: marginTop,
        right: marginRight,
        bottom: marginBottom,
        left: marginLeft,
    };
    return generatedMargins;
}
exports.generatePuppeteerPDFMargin = generatePuppeteerPDFMargin;
