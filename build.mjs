import esbuild from 'esbuild';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, 'dist');
const srcDir = __dirname;

async function ensureDir(dirPath) {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch {}
}

async function minifyCSS(content) {
  return content
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([{}:;,])\s*/g, '$1')
    .trim();
}

async function build() {
  console.log('Building assets with esbuild...');

  await ensureDir(distDir);

  const jsFiles = [
    { src: 'app.js', out: 'app.js' },
    { src: 'billing.js', out: 'billing.js' },
    { src: 'login.js', out: 'login.js' },
    { src: 'payments.js', out: 'payments.js' },
  ];

  const cssFiles = [
    { src: 'styles.css', out: 'styles.css' },
    { src: 'billing.css', out: 'billing.css' },
    { src: 'login.css', out: 'login.css' },
  ];

  const htmlFiles = [
    'index.html',
    'billing.html',
    'payments.html',
    'FULL.html',
    'add-clients.html',
    'add-client.html',
    'learning.html',
  ];

  try {
    await Promise.all([
      ...jsFiles.map(async ({ src, out }) => {
        const srcPath = path.join(srcDir, src);
        const outPath = path.join(distDir, out);
        try {
          await esbuild.build({
            entryPoints: [srcPath],
            outfile: outPath,
            minify: true,
            sourcemap: 'linked',
            platform: 'browser',
            format: 'iife',
            target: ['es2015'],
            bundle: false,
            logLevel: 'silent',
          });
          const stats = await fs.stat(outPath);
          console.log(`  ✓ ${src} → ${out} (${(stats.size / 1024).toFixed(1)}KB)`);
        } catch (err) {
          console.error(`  ✗ ${src}: ${err.message}`);
        }
      }),
      ...cssFiles.map(async ({ src, out }) => {
        const srcPath = path.join(srcDir, src);
        const outPath = path.join(distDir, out);
        try {
          let content = await fs.readFile(srcPath, 'utf-8');
          content = await minifyCSS(content);
          await fs.writeFile(outPath, content);
          const stats = await fs.stat(outPath);
          console.log(`  ✓ ${src} → ${out} (${(stats.size / 1024).toFixed(1)}KB)`);
        } catch (err) {
          console.error(`  ✗ ${src}: ${err.message}`);
        }
      }),
      ...htmlFiles.map(async (file) => {
        const srcPath = path.join(srcDir, file);
        const outPath = path.join(distDir, file);
        try {
          await fs.copyFile(srcPath, outPath);
        } catch (err) {
        }
      }),
    ]);

    console.log('\nBuild complete! Assets optimized and minified.');
  } catch (err) {
    console.error('Build failed:', err.message);
    process.exit(1);
  }
}

build();
