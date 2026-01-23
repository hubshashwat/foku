import { defineConfig, loadEnv } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const manifest = JSON.parse(fs.readFileSync('./manifest.json', 'utf-8'));

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    const isPremium = env.VITE_PREMIUM_BUILD === 'true';

    console.log(`Building extension - Premium: ${isPremium}`);

    return {
        plugins: [crx({ manifest })],
        resolve: {
            alias: {
                '@premium': isPremium
                    ? resolve(__dirname, './premium/premium-impl.js')
                    : resolve(__dirname, './premium-api.js'),
            },
        },
        server: {
            port: 5173,
            strictPort: true,
            hmr: {
                port: 5173,
            },
        },
    };
});
