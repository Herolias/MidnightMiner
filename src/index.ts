import { Command } from 'commander';
import { Miner } from './browser';
import * as fs from 'fs';
import inquirer from 'inquirer';
import * as os from 'os';

const program = new Command();
const totalCpus = os.cpus().length;

program
  .name('midnight-miner')
  .description('CLI to automate Midnight Scavenger Hunt wallet generation and mining')
  .version('1.0.0');

program
  .command('start')
  .description('Start the mining process')
  .option('-w, --wallets <number>', 'Number of wallets to generate', '1')
  .option('-c, --cpu <number>', `Number of CPU cores to use (Total available: ${totalCpus})`, `${totalCpus}`)
  .option('--headless', 'Run in headless mode (recommended for servers)', false)
  .action(async (options) => {
    const walletCount = parseInt(options.wallets, 10);
    if (isNaN(walletCount) || walletCount < 1) {
      console.error('Invalid number of wallets');
      process.exit(1);
    }

    const cpuCount = parseInt(options.cpu, 10);
    if (isNaN(cpuCount) || cpuCount < 1 || cpuCount > totalCpus) {
        console.warn(`Warning: Invalid CPU count. Using max available (${totalCpus}).`);
    }
    
    const headless = !!options.headless;

    // Prompt for recipient address
    const answers = await inquirer.prompt([
        {
            type: 'input',
            name: 'recipient',
            message: 'Enter the recipient wallet address for donations (leave empty to skip):',
        }
    ]);

    const recipient = answers.recipient ? answers.recipient.trim() : null;

    const miner = new Miner(walletCount, recipient, cpuCount, headless);
    
    // Keep process alive
    process.on('SIGINT', async () => {
        console.log('\nStopping miner...');
        process.exit();
    });

    await miner.start();
  });

program.parse();

