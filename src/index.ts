import puppeteer, { Browser, Page } from 'puppeteer';
import chalk from 'chalk';
import ora from 'ora';

import { ResponseMessage, Config } from './types/types';

const createUrl = (protocol: string, host: string, port: string): string =>
  `${protocol}://${host}:${port}`;

const checkForErrors = (browser: Browser, url: string) => async (path: string) => {
  const page: Page = await browser.newPage();
  const responseMessage: ResponseMessage = {
    path,
    consoleErrors: [],
    consoleWarnings: [],
    status: null,
    exceptions: [],
  };

  page.on('pageerror', (error) => {
    responseMessage.exceptions.push(error);
  });

  page.on('response', (response) => {
    responseMessage.status = response.status();
  });

  page.on('console', msg => {
    for (let i = 0; i < msg.args().length; ++i)
      if (msg.type() === 'warning') {
        responseMessage.consoleWarnings.push(msg.text());
      }
  });

  await page.goto(`${url}${path}`);

  return responseMessage;
}

const formatStatus = (status: number): string => {
  if (status >= 200 && status < 400) {
    return chalk.green(status.toString());
  }
  if (status >= 400 && status < 500) {
    return chalk.yellow(status.toString());
  }
  return chalk.red(status.toString());
}

const formatErrorLength = (errors: string[]): string => {
  if (errors.length) {
    return `${chalk.red(errors.length.toString())}`;
  }
  return `${chalk.green(errors.length.toString())}`;
};

const formatWarningLength = (warnings: string[]): string => {
  if (warnings.length) {
    return `${chalk.yellow(warnings.length.toString())}`;
  }
  return `${chalk.green(warnings.length.toString())}`;
};

const reportResponse = (result: ResponseMessage) => {
  const log = console.log;
  log('\b');
  log(chalk.blue(result.path));
  log(`${chalk.gray('- Status:')} ${formatStatus(result.status)}`);
  log(`${chalk.gray('- Errors:')} ${formatErrorLength(result.exceptions)}`);
  if (result.consoleWarnings.length) {
    result.exceptions.forEach(e => log(`${chalk.gray('--')} ${chalk.red(e)}`));
  }
  log(`${chalk.gray('- Warnings:')} ${formatWarningLength(result.consoleWarnings)}`);
  if (result.consoleWarnings.length) {
    result.consoleWarnings.forEach(w => log(`${chalk.gray('--')} ${chalk.yellow(w)}`));
  }
}

export const run = async (config: Config) => {
const protocol: string = config.protocol || 'http';
const host: string = config.host || '127.0.0.1';
const port: string = config.port || '3000';

const paths: string[] = config.paths;
  const url = createUrl(protocol, host, port);
  ora(`Running ${url}`).start();

  const browser = await puppeteer.launch();
  const runCheck = checkForErrors(browser, url);

  const results: ResponseMessage[] = await Promise.all(paths.map(path => runCheck(path)));
  const errors: ResponseMessage[] = results.filter(m => m.exceptions.length);

  await browser.close();

  results.forEach(r => reportResponse(r));

  if (errors.length) {
    process.exit(1);
    console.log(errors);
  } else {
    process.exit(0);
  }
};