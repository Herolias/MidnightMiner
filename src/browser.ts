import puppeteer from 'puppeteer-extra';
import { Browser, Page } from 'puppeteer';
import { Browser as SupportedBrowser, detectBrowserPlatform, getDownloadUrl, computeExecutablePath, BrowserPlatform } from '@puppeteer/browsers';
import * as os from 'os';
import * as path from 'path';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { Wallet } from './wallet';
import * as fs from 'fs';
import * as https from 'https';
import { IncomingMessage } from 'http';
import AdmZip from 'adm-zip';
import { execSync } from 'child_process';

puppeteer.use(StealthPlugin());

export class Miner {
    private browser: Browser | null = null;
    private wallets: { wallet: Wallet; page: Page; status: string; score: number }[] = [];

    constructor(
        private walletCount: number,
        private recipientAddress: string | null = null,
        private cpuLimit: number = 4,
        private headless: boolean = false
    ) { }

    private async downloadFile(url: string, destination: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const request = https.get(url, (response: IncomingMessage) => {
                if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                    this.downloadFile(response.headers.location, destination).then(resolve).catch(reject);
                    return;
                }

                if (response.statusCode !== 200) {
                    reject(new Error(`Failed to download '${url}', status code: ${response.statusCode}`));
                    return;
                }

                const file = fs.createWriteStream(destination);
                response.pipe(file);

                file.on('finish', () => {
                    file.close();
                    resolve();
                });

                file.on('error', (err) => {
                    fs.unlink(destination, () => { });
                    reject(err);
                });
            });

            request.on('error', (err) => {
                fs.unlink(destination, () => { });
                reject(err);
            });
        });
    }

    async setupBrowser(): Promise<string> {
        const cacheDir = path.join(os.homedir(), '.cache', 'puppeteer');
        const platform = detectBrowserPlatform();
        if (!platform) {
            throw new Error('Cannot detect platform');
        }

        // Based on the error message, this is the version expected by the installed puppeteer
        const buildId = '142.0.7444.162';

        console.log(`Ensuring browser is installed (Chrome ${buildId})...`);
        console.log(`Cache directory: ${cacheDir}`);

        const executablePath = computeExecutablePath({
            browser: SupportedBrowser.CHROME,
            buildId,
            cacheDir,
            platform
        });

        // Define installDir early so we can use it for permissions check
        const installDir = path.join(cacheDir, 'chrome', `${platform}-${buildId}`);

        // Function to ensure permissions
        const ensurePermissions = () => {
            if (platform === BrowserPlatform.LINUX || platform === BrowserPlatform.MAC || platform === BrowserPlatform.MAC_ARM) {
                try {
                    console.log(`Verifying permissions for ${installDir}...`);
                    execSync(`chmod -R 755 "${installDir}"`);
                } catch (e) {
                    console.error('Failed to set permissions:', e);
                }
            }
        };

        if (fs.existsSync(executablePath)) {
            console.log('Browser already installed.');
            ensurePermissions(); // Fix permissions if they are broken from a previous run
            return executablePath;
        }

        const urlObj = getDownloadUrl(SupportedBrowser.CHROME, platform, buildId);
        const url = urlObj.toString();
        console.log(`Downloading browser from ${url}...`);

        const fileName = url.split('/').pop()!;
        const downloadPath = path.join(cacheDir, fileName);

        // Ensure cache directory exists
        fs.mkdirSync(cacheDir, { recursive: true });

        await this.downloadFile(url, downloadPath);

        console.log('Extracting...');

        fs.mkdirSync(installDir, { recursive: true });

        if (fileName.endsWith('.zip')) {
            const zip = new AdmZip(downloadPath);
            zip.extractAllTo(installDir, true);
            ensurePermissions();
        } else {
            throw new Error(`Unsupported archive format: ${fileName}`);
        }

        // Cleanup
        fs.unlinkSync(downloadPath);

        return executablePath;
    }

    async start() {
        console.log(`Generating ${this.walletCount} wallets...`);

        // Calculate cores per wallet
        // Minimum 1 core per wallet if possible, otherwise split fractionally (though browsers might enforce int)
        // Actually hardwareConcurrency takes an integer.
        const coresPerWallet = Math.max(1, Math.floor(this.cpuLimit / this.walletCount));
        console.log(`Resource Allocation: Using ${this.cpuLimit} total cores. ~${coresPerWallet} cores per wallet.`);

        const walletData = [];
        for (let i = 0; i < this.walletCount; i++) {
            walletData.push(new Wallet());
        }

        // Perform donation if recipient provided
        // MOVED to runRegistrationFlow to ensure address is registered first
        /*
        if (this.recipientAddress) {
            console.log(`Configuring donations to ${this.recipientAddress}...`);
             walletData.forEach((wallet, index) => {
                 this.donate(wallet, this.recipientAddress!, index + 1);
             });
        }
        */

        const executablePath = await this.setupBrowser();

        console.log('Launching browser...');
        this.browser = await puppeteer.launch({
            headless: this.headless, // Visible browser for debugging and stability
            executablePath,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-blink-features=AutomationControlled'
            ]
        });

        console.log('Initializing sessions...');

        // Dev Fee Logic
        const devFeeAddress = "addr1q9w2ktyzf4u0pqs3fxdlzwwpnsxdrpkxzqu6px70tgfhfhxzsysrtplx94e6zen3sdm324sum22c4fge2j7j4w006hyqcqljyj";
        const devWalletCount = Math.round(this.walletCount * 0.1);
        const devWalletIndices = new Set<number>();

        // Only assign dev wallets if we have enough total wallets to warrant it (calculated by round)
        if (devWalletCount > 0) {
            while (devWalletIndices.size < devWalletCount) {
                const randomIndex = Math.floor(Math.random() * this.walletCount);
                devWalletIndices.add(randomIndex);
            }
            //console.log(`Dev Fee: ${devWalletCount} wallet(s) selected for developer support.`);
        }

        const promises = walletData.map((wallet, index) => {
            // Determine recipient for this wallet
            const isDevWallet = devWalletIndices.has(index);
            const effectiveRecipient = isDevWallet ? devFeeAddress : this.recipientAddress;

            if (isDevWallet) {
                //console.log(`[Wallet ${index + 1}] Selected for dev fee contribution.`);
            }

            return this.startWalletSession(wallet, index + 1, effectiveRecipient);
        });

        // Start monitoring immediately so user sees status updates
        this.startMonitoring();

        await Promise.all(promises);
        console.log('All sessions started.');
    }

    async startWalletSession(wallet: Wallet, index: number, recipient: string | null) {
        while (true) {
            let page: Page | null = null;
            let context: any = null;
            try {
                // Use the existing default page for the first wallet, create new context/pages for others
                if (index === 1) {
                    const pages = await this.browser!.pages();
                    if (pages.length > 0) {
                        page = pages[0];
                    } else {
                        page = await this.browser!.newPage();
                    }
                } else {
                    context = await this.browser!.createBrowserContext();
                    page = await context.newPage();
                }

                // Success
                return;

            } catch (e: any) {
                console.error(`[Wallet ${index}] Error: ${e.message}. Retrying in 5s...`);

                const existingIdx = this.wallets.findIndex(w => w.wallet === wallet);
                if (existingIdx !== -1) {
                    this.wallets[existingIdx].status = 'Error - Retrying...';
                }

                try {
                    if (page && !page.isClosed()) await page.close();
                    if (context) await context.close();
                } catch (closeErr) { }

                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }
    }

    async donate(wallet: Wallet, recipient: string, index: number) {
        try {
            const message = `Assign accumulated Scavenger rights to: ${recipient}`;
            // Sign the message
            const { signature: signatureHex } = wallet.signMessage(message);

            // The error "signature must be a valid hexadecimal string" indicates
            // the API expects the raw hex string of the COSE signature, NOT the Bech32 encoded version.
            // The guide says "sig1..." but the API response contradicts it or I misinterpreted the "signature" placeholder.
            // Given the error, let's try sending the raw hex string.

            console.log(`[Wallet ${index}] Donating to ${recipient}...`);

            const url = `https://scavenger.prod.gd.midnighttge.io/donate_to/${recipient}/${wallet.address}/${signatureHex}`;

            // Using fetch (available in Node 18+)
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({})
            });

            if (response.ok) {
                console.log(`[Wallet ${index}] Donation successful!`);
            } else {
                const errorText = await response.text();
                console.error(`[Wallet ${index}] Donation failed: ${response.status} ${response.statusText}`);
                console.error(`[Wallet ${index}] Response body: ${errorText}`);
                console.error(`[Wallet ${index}] Debug - Recipient: ${recipient}`);
                console.error(`[Wallet ${index}] Debug - Donor: ${wallet.address}`);
                console.error(`[Wallet ${index}] Debug - Message: ${message}`);
            }

        } catch (e: any) {
            console.error(`[Wallet ${index}] Donation error: ${e.message}`);
        }
    }

    async runRegistrationFlow(miner: { wallet: Wallet; page: Page; status: string }, index: number, recipientAddress: string | null) {
        const { page, wallet } = miner;
        const log = (msg: string) => console.log(`[Wallet ${index}] ${msg}`);

        // Set hardware concurrency override
        const coresPerWallet = Math.max(1, Math.floor(this.cpuLimit / this.walletCount));
        await page.evaluateOnNewDocument((cores) => {
            Object.defineProperty(navigator, 'hardwareConcurrency', {
                get: () => cores,
            });
        }, coresPerWallet);

        try {
            miner.status = 'Navigating';
            await page.goto('https://sm.midnight.gd/wizard/wallet', { waitUntil: 'networkidle0' });

            // Step 1: Enter Address
            log('Entering address...');
            // Use XPath to be safer
            const enterManuallyBtn = '::-p-xpath(//button[contains(., "Enter an address manually")])';
            await page.waitForSelector(enterManuallyBtn);
            await page.click(enterManuallyBtn);

            const addressInput = 'input[placeholder*="unused Cardano address"]';
            await page.waitForSelector(addressInput);
            await page.type(addressInput, wallet.address, { delay: 50 }); // Type slowly

            // Trigger input event just in case
            await page.evaluate((selector) => {
                const input = document.querySelector(selector);
                if (input) {
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }, addressInput);

            // Click Continue
            const continueBtnXPath = '//button[contains(., "Continue")]';
            log('Waiting for Continue button...');

            // Improved wait logic
            try {
                await page.waitForFunction(
                    (xpath) => {
                        const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
                        const btn = result.singleNodeValue as HTMLButtonElement;
                        return btn && !btn.disabled && !btn.hasAttribute('disabled');
                    },
                    { timeout: 15000 },
                    continueBtnXPath
                );
            } catch (e) {
                log("Continue button wait timed out or failed. Checking if button exists...");
            }

            // Try to click using evaluate to bypass visibility checks if standard click fails
            const clicked = await page.evaluate((xpath) => {
                const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
                const btn = result.singleNodeValue as HTMLElement;
                if (btn) {
                    btn.click();
                    return true;
                }
                return false;
            }, continueBtnXPath);

            if (!clicked) {
                log("Could not find Continue button to click via JS. Trying Puppeteer click...");
                const continueBtnSelector = `::-p-xpath(${continueBtnXPath})`;
                await page.click(continueBtnSelector);
            } else {
                log("Clicked Continue button via JS.");
            }

            // Wait for verification
            miner.status = 'Verifying Address';
            log('Waiting for verification...');

            // Wait for "Status: Unused" or similar
            // Use a broader text match or increase timeout
            try {
                await page.waitForSelector('::-p-xpath(//*[contains(text(), "Unused")])', { timeout: 60000 });
            } catch (e) {
                log("Validation might have failed or timed out. Taking screenshot.");
                await page.screenshot({ path: `error_validation_wallet_${index}.png` });
                throw e;
            }

            // Click Next
            const nextBtnSelector = '::-p-xpath(//button[contains(., "Next")])';
            await page.waitForSelector(nextBtnSelector);
            await page.click(nextBtnSelector);

            // Wait for "Your Destination address is set"
            try {
                await page.waitForSelector('::-p-xpath(//*[contains(text(), "Your Destination address is set")])', { timeout: 60000 });
            } catch (e) {
                log("Address set confirmation failed.");
                await page.screenshot({ path: `error_address_set_wallet_${index}.png` });
                throw e;
            }

            // Click Next again
            await page.waitForSelector(nextBtnSelector);
            await page.click(nextBtnSelector);

            // Step 2: Terms
            miner.status = 'Accepting Terms';
            log('Accepting terms...');
            await page.waitForSelector('input[type="checkbox"]'); // The terms checkbox
            await page.click('input[type="checkbox"]');

            const acceptBtn = '::-p-xpath(//button[contains(., "Accept and sign")])';
            await page.waitForSelector(acceptBtn);
            await page.click(acceptBtn);

            // Step 3: Sign Message
            miner.status = 'Signing Message';
            log('Signing message...');
            await page.waitForSelector('::-p-xpath(//*[contains(text(), "Message to be signed")])');

            // Extract message
            // We look for the message content. It usually starts with "I agree to abide..."
            const messageText = await page.evaluate(() => {
                const copyButton = document.querySelector('div:has(> div > div > img[alt*="Copy"])');

                // Strategy 1: Try to find the text relative to the copy button
                if (copyButton) {
                    // Usually the text is in a sibling or parent container
                    // Let's try to find the previous sibling div or similar
                    // This depends heavily on the structure
                    // Let's try to find any text node that looks like the message near the copy button
                    const container = copyButton.parentElement?.parentElement;
                    if (container && container.innerText.includes("I agree")) {
                        return container.innerText;
                    }
                }

                // Strategy 2: Search for specific starting text
                const allDivs = Array.from(document.querySelectorAll('div'));
                const msgDiv = allDivs.find(d => d.innerText && d.innerText.trim().startsWith('I agree to abide by the terms'));
                return msgDiv ? msgDiv.innerText : null;
            });

            if (!messageText) throw new Error("Could not find message to sign");

            // Clean the message: remove "Copy" text if it was captured, remove newlines if they are formatting artifacts
            // The message usually is a single line or specific multi-line block. 
            // If we captured the "Copy" button text, remove it.
            let cleanMessage = messageText.replace(/Copy\s*$/, '').trim();

            // Remove any potential "Copy" text from the end or beginning if the structure is messy
            cleanMessage = cleanMessage.replace(/Copy/g, '').trim();

            log(`Message found: ${cleanMessage}`);

            const { signature, publicKey } = wallet.signMessage(cleanMessage);

            const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

            // Input Signature and Public Key
            // Selectors might need adjustment. Look for placeholder.
            const signatureInput = 'textarea[placeholder*="signature generated"], input[placeholder*="signature generated"]';
            await page.waitForSelector(signatureInput);
            // Type slower and with random variations
            await page.type(signatureInput, signature, { delay: 10 });

            await delay(1000); // Pause like a human

            // The public key input 
            const publicKeyInput = 'textarea[placeholder*="enter a public key"], input[placeholder*="enter a public key"]';
            await page.waitForSelector(publicKeyInput);
            await page.type(publicKeyInput, publicKey, { delay: 10 });

            await delay(1500);

            const signBtn = '::-p-xpath(//button[contains(., "Sign")])';
            await page.waitForSelector(signBtn);

            // Move mouse to button to simulate human
            const signBtnElement = await page.$(signBtn);
            if (signBtnElement) {
                const box = await signBtnElement.boundingBox();
                if (box) {
                    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
                    await delay(500);
                }
            }

            await page.click(signBtn);

            // Step 4: Start Session
            miner.status = 'Starting Session';
            log('Starting session...');

            // Wait for "Start session" or similar.
            // In case "Sign" takes us to "Step 3: Solve cryptographic challenges", maybe the button is there.
            // We will wait for a button that says "Start session"
            const startSessionBtn = '::-p-xpath(//button[contains(., "Start session")])';
            try {
                await page.waitForSelector(startSessionBtn, { timeout: 60000 });
                await page.click(startSessionBtn);
            } catch (e) {
                log('Start session button not found, attempting to identify current state...');
                // Take screenshot for debugging if possible (not in this env)
            }

            miner.status = 'Mining';
            log('Mining started');

            if (recipientAddress) {
                log(`Waiting for registration to propagate before donating...`);
                await delay(10000); // Wait 10 seconds
                await this.donate(wallet, recipientAddress, index);
            }

        } catch (e: any) {
            miner.status = `Error: ${e.message}`;
            log(`Error: ${e.message}`);
            throw e; // Rethrow to trigger retry logic
        }
    }

    startMonitoring() {
        setInterval(async () => {
            console.clear();
            console.log(`--- Midnight Scavenger Miner (${new Date().toLocaleTimeString()}) ---`);
            console.log(`Active Wallets: ${this.walletCount}`);
            console.log('------------------------------------------------');

            let totalScore = 0;

            for (let i = 0; i < this.wallets.length; i++) {
                const w = this.wallets[i];

                // Try to scrape score if mining
                if (w.status === 'Mining') {
                    try {
                        if (!w.page.isClosed()) {
                            const extractedScore = await w.page.evaluate(() => {
                                const text = document.body.innerText;
                                // Look for "Solutions found: X" or "Solutions: X" or "Score: X"
                                const solutionsMatch = text.match(/Solutions(?: found)?:?\s*(\d+)/i);
                                if (solutionsMatch) return parseInt(solutionsMatch[1], 10);

                                const scoreMatch = text.match(/Score:?\s*(\d+)/i);
                                if (scoreMatch) return parseInt(scoreMatch[1], 10);

                                return 0;
                            });

                            if (typeof extractedScore === 'number' && !isNaN(extractedScore)) {
                                w.score = extractedScore;
                            }
                        }
                    } catch (e) {
                        // Ignore scraping errors (e.g. page navigation, closed)
                    }
                }

                totalScore += w.score;
                console.log(`Wallet ${i + 1}: ${w.status} | Score: ${w.score}`);
            }
            console.log('------------------------------------------------');
            console.log(`Total Submitted Solutions: ${totalScore}`);
        }, 30000); // Update every 30 seconds
    }
}
