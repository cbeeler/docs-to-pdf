"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isPageKept = exports.removeElementFromSelector = exports.removeExcludeSelector = exports.replaceHeader = exports.generateHeader = exports.generateTocHtml = exports.generateToc = exports.generateCoverHtml = exports.generateImageHtml = exports.getCoverImage = exports.concatHtml = exports.getUrlFromSelector = exports.findNextUrl = exports.openDetails = exports.getHtmlFromSelector = exports.getHtmlContent = exports.matchKeyword = void 0;
const chalk_1 = __importDefault(require("chalk"));
const console_stamp_1 = __importDefault(require("console-stamp"));
(0, console_stamp_1.default)(console);
/**
 * Checks whether a page contains a given keyword
 * @param page - The Puppeteer page instance.
 * @param keyword - The mata keyword to search for
 * @returns boolean if the keyword was found
 */
async function matchKeyword(page, keyword) {
    try {
        const metaKeywords = await page.$eval("head > meta[name='keywords']", (element) => element.content);
        if (metaKeywords.split(',').includes(keyword)) {
            console.log(chalk_1.default.green('Keyword found: ' + keyword + ' in ' + metaKeywords));
            return true;
        }
        console.log(chalk_1.default.yellowBright('Keyword not found: ' + keyword + ' in ' + metaKeywords));
        return false;
    }
    catch (e) {
        console.error(chalk_1.default.red('No meta keywords found: ' + e));
        return false;
    }
}
exports.matchKeyword = matchKeyword;
/**
 * Retrieves the HTML content of a specific element on a page using Puppeteer.
 * @param page - The Puppeteer page instance.
 * @param selector - The CSS selector of the element.
 * @returns The HTML content of the element.
 */
async function getHtmlContent(page, selector) {
    const html = await page.evaluate(getHtmlFromSelector, selector);
    return html;
}
exports.getHtmlContent = getHtmlContent;
/**
 * Retrieves the HTML content of an element matching the specified selector.
 * Adds page break styling for PDF generation.
 *
 * @param selector - The CSS selector of the element to retrieve.
 * @returns The HTML content of the matched element, or an empty string if no element is found.
 */
function getHtmlFromSelector(selector) {
    const element = document.querySelector(selector);
    if (element) {
        // Add pageBreak for PDF
        element.style.pageBreakAfter = 'always';
        return element.outerHTML;
    }
    else {
        return '';
    }
}
exports.getHtmlFromSelector = getHtmlFromSelector;
/**
 * Recursively opens all <details> elements on a page.
 *
 * @param page - The Puppeteer page instance.
 * @param clickFunction - A function to click the summary element of a <details> element.
 * @param waitFunction - A function to wait for a specified number of milliseconds.
 */
async function openDetails(page, clickFunction, waitFunction) {
    const detailsHandles = await page.$$('details');
    console.debug(`Found ${detailsHandles.length} elements`);
    for (const detailsHandle of detailsHandles) {
        const summaryHandle = await detailsHandle.$('summary');
        if (summaryHandle) {
            console.debug(`Clicking summary: ${await summaryHandle.evaluate((node) => node.textContent)}`);
            await (clickFunction
                ? clickFunction(summaryHandle)
                : summaryHandle.click());
            await (waitFunction
                ? waitFunction(800)
                : new Promise((r) => setTimeout(r, 800)));
        }
    }
}
exports.openDetails = openDetails;
/**
 * Finds the URL of the next page based on a CSS selector using Puppeteer.
 * @param page - The Puppeteer page instance.
 * @param selector - The CSS selector of the element containing the link to the next page.
 * @returns The URL of the next page.
 */
async function findNextUrl(page, selector) {
    const nextPageURL = await page.evaluate(getUrlFromSelector, selector);
    return nextPageURL;
}
exports.findNextUrl = findNextUrl;
/**
 * Retrieves the URL from an HTML element specified by the selector.
 * @param selector - The CSS selector to target the HTML element.
 * @returns The URL of the element, or an empty string if the element is not found.
 */
function getUrlFromSelector(selector) {
    const element = document.querySelector(selector);
    if (element) {
        // If the element is found, return its href property as the next page URL
        return element.href;
    }
    else {
        // If the element is not found, return an empty string
        return '';
    }
}
exports.getUrlFromSelector = getUrlFromSelector;
/**
 * Concatenates the HTML content of the cover, table of contents (toc), and main content.
 * @param cover - The HTML content of the cover.
 * @param toc - The HTML content of the table of contents.
 * @param content - The HTML content of the main content.
 * @param disable - A boolean indicating whether to disable the table of contents.
 * @returns The concatenated HTML content.
 */
function concatHtml(cover, toc, content, disable, baseUrl) {
    // Clear the body content
    const body = document.body;
    body.innerHTML = '';
    // Add base tag for relative links
    // see: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/base
    if (baseUrl) {
        body.innerHTML += `<base href="${baseUrl}" />`;
    }
    // Add the cover HTML to the body
    body.innerHTML += cover;
    // Add the table of contents HTML to the body if not disabled
    if (!disable) {
        body.innerHTML += toc;
    }
    // Add the main content HTML to the body
    body.innerHTML += content;
    // Return the concatenated HTML content
    return body.innerHTML;
}
exports.concatHtml = concatHtml;
/**
 * Retrieves the cover image from the specified URL using Puppeteer.
 * @param page - The Puppeteer page object.
 * @param url - The URL of the cover image.
 * @returns An object containing the base64-encoded image content and the content type.
 */
async function getCoverImage(page, url) {
    // Download buffer of coverImage if it exists
    const imgSrc = await page.goto(url);
    const imgSrcBuffer = await imgSrc?.buffer();
    const base64 = imgSrcBuffer?.toString('base64') || '';
    const type = imgSrc?.headers()['content-type'] || '';
    console.log(chalk_1.default.cyan('Cover image content-type: ' + type));
    return { base64, type };
}
exports.getCoverImage = getCoverImage;
/**
 * Generates the HTML code for an image with the specified base64 content, content type, width, and height.
 * @param imgBase64 - The base64-encoded content of the image.
 * @param contentType - The content type of the image. Defaults to 'image/png'.
 * @param width - The width of the image. Defaults to 140.
 * @param height - The height of the image. Defaults to 140.
 * @returns The HTML code for the image.
 */
function generateImageHtml(imgBase64, contentType = 'image/png', width = 140, height = 140) {
    // Return the HTML code for the image with the specified properties
    return `<img
    class="cover-img"
    src="data:${contentType};base64, ${imgBase64}"
    alt=""
    width="${width}"
    height="${height}"
    />`;
}
exports.generateImageHtml = generateImageHtml;
/**
 * Generates the HTML code for a cover page with a title, subtitle, and image.
 * @param coverTitle - The title for the cover page.
 * @param coverImageHtml - The HTML code for the cover image.
 * @param coverSub - The subtitle for the cover page.
 * @returns The HTML code for the cover page.
 */
function generateCoverHtml(coverTitle, coverImageHtml, coverSub) {
    // Return the HTML code for the cover page with optional title, subtitle, and cover image
    return `
  <div
    class="pdf-cover"
    style="
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      height: 100vh;
      page-break-after: always;  
      text-align: center;
    "
  >
    ${coverTitle ? `<h1>${coverTitle}</h1>` : ''}
    ${coverSub ? `<h3>${coverSub}</h3>` : ''}
    ${coverImageHtml}
  </div>`;
}
exports.generateCoverHtml = generateCoverHtml;
/**
 * Generates a table of contents (TOC) HTML and modifies the content HTML by replacing header tags with updated header IDs.
 * @param contentHtml - The content HTML string.
 * @param maxLevel - The maximum header level to include in the TOC. Defaults to 3.
 * @returns An object containing the modified content HTML and the TOC HTML.
 */
function generateToc(contentHtml, maxLevel = 4) {
    const headers = [];
    console.log(chalk_1.default.cyan('Start generating TOC...'));
    // Create TOC only for h1~h${maxLevel}
    // Regex to match all header tags
    const re = new RegExp('<h[1-' + maxLevel + '](.+?)</h[1-' + maxLevel + ']( )*>', 'g');
    const modifiedContentHTML = contentHtml.replace(re, htmlReplacer);
    function htmlReplacer(matchedStr) {
        // Generate header information and update the headers array
        const { headerText, headerId, level } = generateHeader(headers, matchedStr);
        headers.push({ header: headerText, level, id: headerId });
        // Replace the header ID in the matched string and return the modified string
        return replaceHeader(matchedStr, headerId, maxLevel);
    }
    const tocHTML = generateTocHtml(headers);
    return { modifiedContentHTML, tocHTML };
}
exports.generateToc = generateToc;
/**
 * Generates the HTML code for a table of contents based on the provided headers.
 * @param headers - An array of header objects containing level, id, and header properties.
 * @returns The HTML code for the table of contents.
 */
function generateTocHtml(headers) {
    // Map the headers array to create a list item for each header with the appropriate indentation
    const toc = headers
        .map((header) => `<li class="toc-item toc-item-${header.level}" style="margin-left:${(header.level - 1) * 20}px"><a href="#${header.id}">${header.header}</a></li>`)
        .join('\n');
    // Return the HTML code for the table of contents
    return `
  <div class="toc-page" style="page-break-after: always;">
    <h1 class="toc-header">Table of contents:</h1>
    ${toc}
  </div>
  `;
}
exports.generateTocHtml = generateTocHtml;
/**
 * Generates header information from the matched string and updates the headers array.
 * @param headers - The headers array to update with the new header information.
 * @param matchedStr - The matched string containing the header information.
 * @returns An object containing the header text, header ID, and level.
 */
function generateHeader(headers, matchedStr) {
    // Remove anchor tags inserted by Docusaurus for direct links to the header
    const headerText = matchedStr
        .replace(/<a[^>]*>#<\/a( )*>/g, '')
        .replace(/<[^>]*>/g, '')
        .trim();
    // Generate a random header ID using a combination of random characters and the headers array length
    const headerId = `${Math.random().toString(36).slice(2, 5)}-${headers.length}`;
    // Extract the level from the matched string (e.g., h1, h2, etc.)
    const level = Number(matchedStr[matchedStr.indexOf('h') + 1]);
    return { headerText, headerId, level };
}
exports.generateHeader = generateHeader;
/**
 * Replaces the ID attribute of the headers in a string with the specified headerId.
 * @param matchedStr - The string containing headers to be modified.
 * @param headerId - The ID value to replace the existing IDs with.
 * @returns The modified string with replaced header IDs.
 */
function replaceHeader(matchedStr, headerId, maxLevel = 3) {
    // Create a regular expression to match the header tags
    const re = new RegExp('<h[1-' + maxLevel + '].*?>', 'g');
    // Replaces the ID attribute of the headers using regular expressions and the headerId parameter
    const modifiedContentHTML = matchedStr.replace(re, (header) => {
        if (header.match(/id( )*=( )*"/g)) {
            // If the header already has an ID attribute, replace its value with the headerId parameter
            return header.replace(/id\s*=\s*"([^"]*)"/g, `id="${headerId}"`);
        }
        else {
            // If the header doesn't have an ID attribute, add the headerId parameter as a new ID attribute
            return header.substring(0, header.length - 1) + ` id="${headerId}">`;
        }
    });
    // Return the modified string with replaced header IDs
    return modifiedContentHTML;
}
exports.replaceHeader = replaceHeader;
/**
 * Removes elements from the page that match the exclude selectors.
 * @param page - The Puppeteer page object.
 * @param excludeSelectors - An array of CSS selectors for elements to be removed.
 */
async function removeExcludeSelector(page, excludeSelectors) {
    excludeSelectors.map(async (excludeSelector) => {
        await page.evaluate(removeElementFromSelector, excludeSelector);
    });
}
exports.removeExcludeSelector = removeExcludeSelector;
/**
 * Removes all elements that match the specified selector from the document.
 *
 * @param selector - The CSS selector of the elements to remove.
 */
function removeElementFromSelector(selector) {
    // Find all elements that match the selector
    const matches = document.querySelectorAll(selector);
    // Remove each matched element
    matches.forEach((match) => match.remove());
}
exports.removeElementFromSelector = removeElementFromSelector;
/**
 * Check if a page should be kept based on exclusion and filtering conditions.
 *
 * @param page - The Puppeteer page instance
 * @param nextPageURL The URL of the next page to be checked.
 * @param urlPath The path of the URL to be checked.
 * @param excludeURLs List of URLs to exclude.
 * @param filterKeyword Keyword to filter pages.
 * @param excludePaths List of path patterns to exclude.
 * @param restrictPaths Whether to restrict by path.
 * @returns True if the page should be kept, false if it should be excluded.
 */
async function isPageKept(page, nextPageURL, urlPath, excludeURLs, filterKeyword, excludePaths, restrictPaths) {
    if (excludeURLs && excludeURLs.includes(nextPageURL)) {
        console.log(chalk_1.default.green('This URL is excluded.'));
        return false;
    }
    else if (filterKeyword && !(await matchKeyword(page, filterKeyword))) {
        console.log(chalk_1.default.yellowBright(`Page excluded by keyword filter: ${filterKeyword}`));
        return false;
    }
    else if (excludePaths &&
        excludePaths.some((path) => nextPageURL.includes(path))) {
        console.log(chalk_1.default.yellowBright(`Page excluded by path filter: ${excludePaths}`));
        return false;
    }
    else if (restrictPaths && nextPageURL.includes(urlPath) === false) {
        console.log(chalk_1.default.yellowBright(`Page excluded by path restriction: ${urlPath} !== ${urlPath}`));
        return false;
    }
    return true;
}
exports.isPageKept = isPageKept;
