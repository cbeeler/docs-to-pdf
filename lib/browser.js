"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.chromeExecPath = void 0;
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const browsers_1 = require("@puppeteer/browsers");
const revisions_js_1 = require("puppeteer-core/lib/cjs/puppeteer/revisions.js");
function chromeExecPath(computeExecutable = browsers_1.computeExecutablePath) {
    const cacheDir = path_1.default.join(os_1.default.homedir(), '.cache', 'puppeteer');
    const builId = revisions_js_1.PUPPETEER_REVISIONS['chrome'];
    const executablePath = computeExecutable({
        cacheDir: cacheDir,
        browser: browsers_1.Browser.CHROME,
        buildId: builId,
    });
    return executablePath;
}
exports.chromeExecPath = chromeExecPath;
