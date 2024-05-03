"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generatePDF = void 0;
const chalk_1 = __importDefault(require("chalk"));
const console_stamp_1 = __importDefault(require("console-stamp"));
const puppeteer = __importStar(require("puppeteer-core"));
const puppeteer_autoscroll_down_1 = require("puppeteer-autoscroll-down");
const fs = __importStar(require("fs-extra"));
const browser_1 = require("./browser");
const utils = __importStar(require("./utils"));
(0, console_stamp_1.default)(console);
const headerHasAnId = (header) => {
    return header.match(/id( )*=( )*"/g);
};
const headerId = (header) => {
    return header.match(/id\s*=\s*"([^"]*)"/)[1];
};
const basicTextLink = (link) => {
    return !link.includes('class=') &&
        !link.includes('aria-label=') &&
        !link.includes('title=');
};
const linkDestination = (link) => {
    return link.match(/href\s*=\s*"([^"]*)"/)[1];
};
const localLink = (link) => {
    return link.startsWith('#');
};
/* c8 ignore start */
async function generatePDF({ initialDocURLs, excludeURLs, outputPDFFilename = 'docs-to-pdf.pdf', pdfMargin = { top: 32, right: 32, bottom: 32, left: 32 }, contentSelector, paginationSelector, paperFormat, excludeSelectors, cssStyle, puppeteerArgs, coverTitle, coverImage, disableTOC, coverSub, waitForRender, headerTemplate, footerTemplate, protocolTimeout, filterKeyword, baseUrl, excludePaths, restrictPaths, openDetail = true, }) {
    let contentHTML = '';
    const execPath = process.env.PUPPETEER_EXECUTABLE_PATH ?? (0, browser_1.chromeExecPath)();
    console.debug(chalk_1.default.cyan(`Using Chromium from ${execPath}`));
    const browser = await puppeteer.launch({
        headless: 'new',
        executablePath: execPath,
        args: puppeteerArgs,
        protocolTimeout: protocolTimeout,
    });
    const chromeTmpDataDir = browser
        .process()
        ?.spawnargs.find((arg) => arg.startsWith('--user-data-dir'))
        ?.split('=')[1];
    console.debug(chalk_1.default.cyan(`Chrome user data dir: ${chromeTmpDataDir}`));
    const page = await browser.newPage();
    // Block PDFs as puppeteer can not access them
    await page.setRequestInterception(true);
    page.on('request', (request) => {
        if (request.url().endsWith('.pdf')) {
            console.log(chalk_1.default.yellowBright(`ignore pdf: ${request.url()}`));
            request.abort();
        }
        else
            request.continue();
    });
    const linksToIds = {};
    console.debug(`InitialDocURLs: ${initialDocURLs}`);
    for (const url of initialDocURLs) {
        let nextPageURL = url;
        const urlPath = new URL(url).pathname;
        // Create a list of HTML for the content section of all pages by looping
        while (nextPageURL) {
            console.log(chalk_1.default.cyan(`Retrieving html from ${nextPageURL}`));
            const match = nextPageURL.match(/((?=\/docs).+)$/m);
            let path = match[1];
            // Go to the page specified by nextPageURL
            await page.goto(`${nextPageURL}`, {
                waitUntil: 'networkidle0',
                timeout: 0,
            });
            if (waitForRender) {
                console.log(chalk_1.default.green('Waiting for render...'));
                await new Promise((r) => setTimeout(r, waitForRender));
            }
            if (await utils.isPageKept(page, nextPageURL, urlPath, excludeURLs, filterKeyword, excludePaths, restrictPaths)) {
                // Open all <details> elements on the page
                if (openDetail) {
                    await utils.openDetails(page);
                }
                // Get the HTML string of the content section.
                let pageHtml = await utils.getHtmlContent(page, contentSelector);
                // Set all the IDs to something unique
                {
                    // regex modified from utils.generateToc
                    pageHtml = pageHtml.replace(/<h[\d+](.+?)<\/h[\d+]( )*>/g, (header) => {
                        const newHeaderId = `${Math.random().toString(36).slice(2, 10)}-${Object.keys(linksToIds).length}`;
                        if (headerHasAnId(header)) {
                            const id = headerId(header);
                            linksToIds[`${path}#${id}`] = `#${newHeaderId}`;
                            // taken from utils.replaceHeader
                            header = header.replace(/id\s*=\s*"([^"]*)"/g, `id="${newHeaderId}"`);
                        }
                        else {
                            linksToIds[path] = `#${newHeaderId}`;
                            header = header.replace(/(<h[\d+])/g, `$1 id="${newHeaderId}"`);
                        }
                        return header;
                    });
                }
                // Fix the local links
                {
                    pageHtml = pageHtml.replace(/<a (.+?)<\/a( )*>/g, (link) => {
                        if (basicTextLink(link)) {
                            if (localLink(linkDestination(link))) {
                                link = link.replace(/href\s*=\s*"([^"]*)"/g, `href="${linksToIds[`${path}${linkDestination(link)}`]}"`);
                            }
                        }
                        return link;
                    });
                }
                contentHTML += pageHtml;
                console.log(chalk_1.default.green('Success'));
            }
            // Find next page url before DOM operations
            nextPageURL = await utils.findNextUrl(page, paginationSelector);
        }
    }
    // Fix the non-local links
    {
        contentHTML = contentHTML.replace(/<a (.+?)<\/a( )*>/g, (link) => {
            if (basicTextLink(link)) {
                const destination = linksToIds[linkDestination(link)];
                if (destination) {
                    link = link.replace(/href\s*=\s*"([^"]*)"/g, `href="${destination}"`);
                }
            }
            return link;
        });
    }
    console.log(chalk_1.default.cyan('Start generating PDF...'));
    // Generate cover Image if declared
    let coverImageHtml = '';
    if (coverImage) {
        console.log(chalk_1.default.cyan('Get coverImage...'));
        const image = await utils.getCoverImage(page, coverImage);
        coverImageHtml = utils.generateImageHtml(image.base64, image.type);
    }
    // Generate Cover
    console.log(chalk_1.default.cyan('Generate cover...'));
    const coverHTML = utils.generateCoverHtml(coverTitle, coverImageHtml, coverSub);
    // Generate Toc
    // const { modifiedContentHTML, tocHTML } = utils.generateToc(contentHTML);
    const modifiedContentHTML = contentHTML;
    const tocHTML = '';
    // Restructuring the HTML of a document
    console.log(chalk_1.default.cyan('Restructuring the html of a document...'));
    // Go to initial page
    await page.goto(`${initialDocURLs[0]}`, { waitUntil: 'networkidle0' });
    await page.evaluate(utils.concatHtml, coverHTML, tocHTML, modifiedContentHTML, disableTOC, baseUrl);
    // Remove unnecessary HTML by using excludeSelectors
    if (excludeSelectors) {
        console.log(chalk_1.default.cyan('Remove unnecessary HTML...'));
        await utils.removeExcludeSelector(page, excludeSelectors);
    }
    // Add CSS to HTML
    if (cssStyle) {
        console.log(chalk_1.default.cyan('Add CSS to HTML...'));
        await page.addStyleTag({ content: cssStyle });
    }
    // Scroll to the bottom of the page with puppeteer-autoscroll-down
    // This forces lazy-loading images to load
    console.log(chalk_1.default.cyan('Scroll to the bottom of the page...'));
    await (0, puppeteer_autoscroll_down_1.scrollPageToBottom)(page, {}); //cast to puppeteer-core type
    // Generate PDF
    console.log(chalk_1.default.cyan('Generate PDF...'));
    await page.pdf({
        path: outputPDFFilename,
        format: paperFormat,
        printBackground: true,
        margin: pdfMargin,
        displayHeaderFooter: !!(headerTemplate || footerTemplate),
        headerTemplate,
        footerTemplate,
        timeout: 0,
    });
    console.log(chalk_1.default.green(`PDF generated at ${outputPDFFilename}`));
    await browser.close();
    console.log(chalk_1.default.green('Browser closed'));
    if (chromeTmpDataDir !== null) {
        fs.removeSync(chromeTmpDataDir);
    }
    console.debug(chalk_1.default.cyan('Chrome user data dir removed'));
}
exports.generatePDF = generatePDF;
/* c8 ignore stop */
