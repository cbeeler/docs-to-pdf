"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeProgram = void 0;
const commander_1 = require("commander");
const commander_options_1 = require("./commander-options");
const core_1 = require("./core");
const docusaurus_1 = require("./provider/docusaurus");
const chalk_1 = __importDefault(require("chalk"));
const console_stamp_1 = __importDefault(require("console-stamp"));
const version = require('../package.json').version;
(0, console_stamp_1.default)(console);
function makeProgram() {
    const program = new commander_1.Command('');
    const docstopdf = program
        .command('docs-to-pdf')
        .version(version, '-v, --vers', 'output the current version')
        .showSuggestionAfterError()
        .configureHelp({
        sortSubcommands: true,
        sortOptions: true,
    });
    docstopdf
        .command('docusaurus')
        .alias('d')
        .description('generate PDF from Docusaurus site')
        .option('--version <version>', 'version of Docusaurus site to generate PDF from', '2')
        .addOption(new commander_1.Option('--docsDir <dir>', 'directory of docs in Docusaurus site to generate PDF from').conflicts('--initialDocURLs'))
        .action((options) => {
        console.debug('Generate from Docusaurus');
        console.debug(options);
        (0, docusaurus_1.generateDocusaurusPDF)(options)
            .then(() => {
            console.log(chalk_1.default.green('Finish generating PDF!'));
            process.exit(0);
        })
            .catch((err) => {
            console.error(chalk_1.default.red(err.stack));
            process.exit(1);
        });
    });
    docstopdf
        .command('core', { isDefault: true })
        .description("generate PDF from Core's options")
        .action((options) => {
        if (options.pdfFormat) {
            console.log(chalk_1.default.red('--pdfFormat is deprecated, use --paperFormat'));
            process.exit(1);
        }
        console.debug('Generate from Core');
        (0, core_1.generatePDF)(options)
            .then(() => {
            console.log(chalk_1.default.green('Finish generating PDF!'));
            process.exit(0);
        })
            .catch((err) => {
            console.error(chalk_1.default.red(err.stack));
            process.exit(1);
        });
    });
    docstopdf.commands.forEach((cmd) => {
        cmd
            .option('--initialDocURLs <urls>', 'set urls to start generating PDF from', commander_options_1.commaSeparatedList)
            .option('--excludeURLs <urls>', 'urls to be excluded in PDF', commander_options_1.commaSeparatedList)
            .option('--contentSelector <selector>', 'used to find the part of main content')
            .option('--paginationSelector <selector>', 'used to find next url')
            .option('--excludeSelectors <selectors>', 'exclude selector ex: .nav', commander_options_1.commaSeparatedList)
            .option('--cssStyle <cssString>', 'css style to adjust PDF output ex: body{padding-top: 0;}')
            .option('--outputPDFFilename <filename>', 'name of output PDF file')
            .option('--pdfMargin <margin>', 'set margin around PDF file', commander_options_1.generatePuppeteerPDFMargin)
            .option('--pdfFormat <format>', '(DEPRECATED use paperFormat)') //TODO: Remove at next major version, replaced by paperFormat
            .option('--paperFormat <format>', 'pdf format ex: A3, A4...')
            .option('--coverTitle <title>', 'title for PDF cover')
            .option('--coverImage <src>', 'image for PDF cover. *.svg file not working!')
            .option('--disableTOC', 'disable table of contents')
            .option('--coverSub <subtitle>', 'subtitle for PDF cover')
            .option('--waitForRender <timeout>', 'wait for document render in milliseconds')
            .option('--headerTemplate <html>', 'html template for page header')
            .option('--footerTemplate <html>', 'html template for page footer')
            .option('--puppeteerArgs <selectors>', 'add puppeteer arguments ex: --sandbox', commander_options_1.commaSeparatedList)
            .option('--protocolTimeout <timeout>', 'timeout setting for individual protocol calls in milliseconds', commander_options_1.commaSeparatedList)
            .option('--filterKeyword <filterKeyword>', 'meta keyword to filter pages')
            .option('--baseUrl <baseUrl>', 'base URL for all relative URLs. Allows to render the pdf on localhost while referencing the deployed page.')
            .option('--excludePaths <paths>', 'paths to be excluded in PDF', commander_options_1.commaSeparatedList)
            .option('--restrictPaths', 'only the paths in the --initialDocURLs will be included in the PDF')
            .option('--openDetail', 'open details elements in the PDF, default is open');
    });
    return program;
}
exports.makeProgram = makeProgram;
