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
exports.generateFromBuild = exports.checkBuildDir = exports.stopDocusaurusServer = exports.startDocusaurusServer = exports.generateDocusaurusPDF = void 0;
const core_1 = require("../core");
const express_1 = __importDefault(require("express"));
const fs = __importStar(require("fs"));
const path_1 = __importDefault(require("path"));
async function generateDocusaurusPDF(options) {
    const { version, docsDir, ...core } = options;
    console.debug(`Docusaurus version: ${version}`);
    console.debug(`Docs directory: ${docsDir}`);
    core.contentSelector = 'article';
    // Pagination and exclude selectors are different depending on Docusaurus version
    if (version == 2) {
        console.debug('Docusaurus version 2');
        core.paginationSelector =
            'a.pagination-nav__link.pagination-nav__link--next';
        core.excludeSelectors = [
            '.margin-vert--xl a',
            "[class^='tocCollapsible']",
            '.breadcrumbs',
            '.theme-edit-this-page',
        ];
    }
    else if (version == 1) {
        console.debug('Docusaurus version 1');
        core.paginationSelector = '.docs-prevnext > a.docs-next';
        core.excludeSelectors = [
            '.fixedHeaderContainer',
            'footer.nav-footer',
            '#docsNav',
            'nav.onPageNav',
            'a.edit-page-link',
            'div.docs-prevnext',
        ];
        core.cssStyle = `
      .navPusher {padding-top: 0;}
      `;
    }
    else {
        console.error(`Unsupported Docusaurus version: ${version}`);
        throw new Error(`Unsupported Docusaurus version: ${version}`);
    }
    if (docsDir) {
        await generateFromBuild(docsDir, core);
    }
    else {
        await (0, core_1.generatePDF)(core);
    }
}
exports.generateDocusaurusPDF = generateDocusaurusPDF;
/**
 * Start Docusaurus Server from build directory
 * @param {string} buildDir - Docusaurus build directory
 * @param {number} port - port to start server on (default: 3000)
 * @returns {Promise<express.Express>} - express server
 */
async function startDocusaurusServer(buildDirPath, port = 3000) {
    const app = (0, express_1.default)();
    const dirPath = path_1.default.resolve(buildDirPath);
    app.use(express_1.default.static(dirPath));
    app.listen(port, () => {
        console.log(`Docusaurus server listening at http://localhost:${port}`);
    });
    return app;
}
exports.startDocusaurusServer = startDocusaurusServer;
/**
 * Stop Docusaurus Server
 * @param {express.Express} app - express server
 * @returns {Promise<void>}
 * @throws {Error} - if server is not running
 * @throws {Error} - if server is not an express server
 */
async function stopDocusaurusServer(app) {
    if (!app) {
        throw new Error('No server to stop');
    }
    try {
        const httpServer = app.listen();
        await httpServer.close(() => console.log('Docusaurus server stopped'));
    }
    catch {
        throw new Error('Server is not a docusaurus server');
    }
}
exports.stopDocusaurusServer = stopDocusaurusServer;
/**
 * Check build directory
 * @param {string} buildDirPath - Docusaurus build directory
 * @returns {Promise<void>}
 * @throws {Error} - if build directory does not exist
 */
async function checkBuildDir(buildDirPath) {
    let buildDirStat;
    try {
        buildDirStat = await fs.promises.stat(buildDirPath);
    }
    catch (error) {
        throw new Error(`Could not find docusaurus build directory at "${buildDirPath}". ` +
            'Have you run "docusaurus build"?');
    }
    if (!buildDirStat.isDirectory()) {
        throw new Error(`${buildDirPath} is not a docusaurus build directory.`);
    }
}
exports.checkBuildDir = checkBuildDir;
/**
 * Generate PDF from Docusaurus build directory
 * @param {string} buildDirPath - Docusaurus build directory
 * @param {GeneratePDFOptions} options - PDF generation options
 * @returns {Promise<void>}
 */
async function generateFromBuild(buildDirPath, options) {
    await checkBuildDir(buildDirPath);
    const app = await startDocusaurusServer(buildDirPath);
    const urlPath = new URL(options.initialDocURLs[0]).pathname;
    options.initialDocURLs = [`http://127.0.0.1:3000${urlPath}`];
    await (0, core_1.generatePDF)(options);
    console.log('Stopping server');
    await stopDocusaurusServer(app);
}
exports.generateFromBuild = generateFromBuild;
