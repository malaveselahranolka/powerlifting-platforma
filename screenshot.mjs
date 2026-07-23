import puppeteer from 'puppeteer';
import { mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const url = process.argv[2] ?? 'http://localhost:3000';
const label = process.argv[3] ?? '';
const width = Number(process.argv[4] ?? 1440);
const height = Number(process.argv[5] ?? 900);

const OUT = join(process.cwd(), 'temporary screenshots');
await mkdir(OUT, { recursive: true });

const existing = await readdir(OUT);
const next =
  existing
    .map((f) => Number(f.match(/^screenshot-(\d+)/)?.[1] ?? 0))
    .reduce((a, b) => Math.max(a, b), 0) + 1;

const name = `screenshot-${next}${label ? `-${label}` : ''}.png`;

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width, height, deviceScaleFactor: 1 });
await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
await new Promise((r) => setTimeout(r, 900));

const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

await page.screenshot({ path: join(OUT, name), fullPage: true });
console.log(`saved: temporary screenshots/${name}`);
if (errors.length) console.log('page errors:', errors.join('\n'));
await browser.close();
