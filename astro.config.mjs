// @ts-check
import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import mdx from '@astrojs/mdx';

// https://astro.build/config
export default defineConfig({
    site: "https://yavashark.dev",
    integrations: [preact(), mdx()],
    redirects: {
        "/engine": "/#playground",
    },
    markdown: {
        shikiConfig: {
            themes: { light: "github-light", dark: "github-dark" },
        },
    },
});
