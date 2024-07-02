import chalk from 'chalk';
import console_stamp from 'console-stamp';
import * as puppeteer from 'puppeteer-core';
import { scrollPageToBottom } from 'puppeteer-autoscroll-down';
import * as fs from 'fs-extra';
import { chromeExecPath } from './browser';
import * as utils from './utils';

console_stamp(console);

const headerHasAnId = (header: string) => {
  return header.match(/id( )*=( )*"/g);
};

const headerId = (header: string) => {
  return header.match(/id\s*=\s*"([^"]*)"/)![1];
};

const basicTextLink = (link: string) => {
  return !link.includes('class=') &&
    !link.includes('aria-label=') &&
    !link.includes('title=')
};

const linkDestination = (link: string) => {
  return link.match(/href\s*=\s*"([^"]*)"/)![1];
};

const localLink = (link: string) => {
  return link.startsWith('#');
};

export interface GeneratePDFOptions {
  initialDocURLs: Array<string>;
  excludeURLs: Array<string>;
  outputPDFFilename: string;
  pdfMargin: puppeteer.PDFOptions['margin'];
  contentSelector: string;
  paginationSelector: string;
  // deprecated - user paperFormat
  pdfFormat?: puppeteer.PaperFormat;
  paperFormat: puppeteer.PaperFormat;
  excludeSelectors: Array<string>;
  cssStyle: string;
  puppeteerArgs: Array<string>;
  coverTitle: string;
  coverImage: string;
  disableTOC: boolean;
  coverSub: string;
  waitForRender: number;
  headerTemplate: string;
  footerTemplate: string;
  protocolTimeout: number;
  filterKeyword: string;
  baseUrl: string;
  excludePaths: Array<string>;
  restrictPaths: boolean;
  openDetail: boolean;
}

/* c8 ignore start */
export async function generatePDF({
  initialDocURLs,
  excludeURLs,
  outputPDFFilename = 'docs-to-pdf.pdf',
  pdfMargin = { top: 32, right: 32, bottom: 32, left: 32 },
  contentSelector,
  paginationSelector,
  paperFormat,
  excludeSelectors,
  cssStyle,
  puppeteerArgs,
  coverTitle,
  coverImage,
  disableTOC,
  coverSub,
  waitForRender,
  headerTemplate,
  footerTemplate,
  protocolTimeout,
  filterKeyword,
  baseUrl,
  excludePaths,
  restrictPaths,
  openDetail = true,
}: GeneratePDFOptions): Promise<void> {
  let contentHTML = '';
  const execPath = process.env.PUPPETEER_EXECUTABLE_PATH ?? chromeExecPath();
  console.debug(chalk.cyan(`Using Chromium from ${execPath}`));
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: execPath,
    args: puppeteerArgs,
    protocolTimeout: protocolTimeout,
  });

  const chromeTmpDataDir = browser
    .process()
    ?.spawnargs.find((arg) => arg.startsWith('--user-data-dir'))
    ?.split('=')[1] as string;
  console.debug(chalk.cyan(`Chrome user data dir: ${chromeTmpDataDir}`));

  const page = await browser.newPage();

  // Block PDFs as puppeteer can not access them
  await page.setRequestInterception(true);
  page.on('request', (request) => {
    if (request.url().endsWith('.pdf')) {
      console.log(chalk.yellowBright(`ignore pdf: ${request.url()}`));
      request.abort();
    } else request.continue();
  });

  const linksToIds: Record<string, string> = {};

  console.debug(`InitialDocURLs: ${initialDocURLs}`);
  for (const url of initialDocURLs) {
    let nextPageURL = url;
    const urlPath = new URL(url).pathname;

    // Create a list of HTML for the content section of all pages by looping
    while (nextPageURL) {
      console.log(chalk.cyan(`Retrieving html from ${nextPageURL}`));

      const match = nextPageURL.match(/((?=\/docs).+)$/m);

      let path = match![1];

      // Go to the page specified by nextPageURL
      await page.goto(`${nextPageURL}`, {
        waitUntil: 'networkidle0',
        timeout: 0,
      });
      if (waitForRender) {
        console.log(chalk.green('Waiting for render...'));
        await new Promise((r) => setTimeout(r, waitForRender));
      }

      if (
        await utils.isPageKept(
          page,
          nextPageURL,
          urlPath,
          excludeURLs,
          filterKeyword,
          excludePaths,
          restrictPaths,
        )
      ) {
        // Open all <details> elements on the page
        if (openDetail) {
          await utils.openDetails(page);
        }
        // Get the HTML string of the content section.
        let pageHtml = await utils.getHtmlContent(page, contentSelector);

        // Set all the IDs to something unique
        {
          const addLinkAndIds = (link: string, id: string) => {
            linksToIds[link] = id;
            linksToIds[link.replaceAll('%20', ' ')] = id; // This is needed to handle spaces in filenames
          };

          // regex modified from utils.generateToc
          pageHtml = pageHtml.replace(/<h[\d+](.+?)<\/h[\d+]( )*>/g, (header: string) => {
            const newHeaderId = `${Math.random().toString(36).slice(2, 10)}-${Object.keys(linksToIds).length}`;

            if(headerHasAnId(header)) {
              const id = headerId(header);
              addLinkAndIds(`${path}#${id}`, `#${newHeaderId}`);

              // taken from utils.replaceHeader
              header = header.replace(/id\s*=\s*"([^"]*)"/g, `id="${newHeaderId}"`);
            } else {
              addLinkAndIds(path, `#${newHeaderId}`);
              header = header.replace(/(<h[\d+])/g, `$1 id="${newHeaderId}"`);
            }

            return header;
          });
        }

        // Fix the local links
        {
          pageHtml = pageHtml.replace(/<a (.+?)<\/a( )*>/g, (link: string) => {
            if(basicTextLink(link)) {

              if(localLink(linkDestination(link))) {
                link = link.replace(/href\s*=\s*"([^"]*)"/g, `href="${linksToIds[`${path}${linkDestination(link)}`]}"`);
              }
            }
            return link;
          });
        }

        contentHTML += pageHtml;
        console.log(chalk.green('Success'));
      }

      // Find next page url before DOM operations
      nextPageURL = await utils.findNextUrl(page, paginationSelector);
    }
  }

  // Fix the non-local links
  {
    contentHTML = contentHTML.replace(/<a (.+?)<\/a( )*>/g, (link: string) => {
      if(basicTextLink(link)) {
        const destination = linksToIds[linkDestination(link)];

        if(destination) {
          link = link.replace(/href\s*=\s*"([^"]*)"/g, `href="${destination}"`);
        }
      }

      return link;
    });
  }

  console.log(chalk.cyan('Start generating PDF...'));

  // Generate cover Image if declared
  let coverImageHtml = '';
  if (coverImage) {
    console.log(chalk.cyan('Get coverImage...'));
    const image = await utils.getCoverImage(page, coverImage);
    coverImageHtml = utils.generateImageHtml(image.base64, image.type);
  }

  // Generate Cover
  console.log(chalk.cyan('Generate cover...'));
  const coverHTML = utils.generateCoverHtml(
    coverTitle,
    coverImageHtml,
    coverSub,
  );

  // Generate Toc
  // const { modifiedContentHTML, tocHTML } = utils.generateToc(contentHTML);

  const modifiedContentHTML = contentHTML;
  const tocHTML = '';

  // Restructuring the HTML of a document
  console.log(chalk.cyan('Restructuring the html of a document...'));

  // Go to initial page
  await page.goto(`${initialDocURLs[0]}`, { waitUntil: 'networkidle0' });

  await page.evaluate(
    utils.concatHtml,
    coverHTML,
    tocHTML,
    modifiedContentHTML,
    disableTOC,
    baseUrl,
  );

  // Remove unnecessary HTML by using excludeSelectors
  if (excludeSelectors) {
    console.log(chalk.cyan('Remove unnecessary HTML...'));
    await utils.removeExcludeSelector(page, excludeSelectors);
  }

  // Add CSS to HTML
  if (cssStyle) {
    console.log(chalk.cyan('Add CSS to HTML...'));
    await page.addStyleTag({ content: cssStyle });
  }

  // Scroll to the bottom of the page with puppeteer-autoscroll-down
  // This forces lazy-loading images to load
  console.log(chalk.cyan('Scroll to the bottom of the page...'));
  await scrollPageToBottom(page, {}); //cast to puppeteer-core type

  // Generate PDF
  console.log(chalk.cyan('Generate PDF...'));

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

  console.log(chalk.green(`PDF generated at ${outputPDFFilename}`));
  await browser.close();
  console.log(chalk.green('Browser closed'));

  if (chromeTmpDataDir !== null) {
    fs.removeSync(chromeTmpDataDir);
  }
  console.debug(chalk.cyan('Chrome user data dir removed'));
}
/* c8 ignore stop */
