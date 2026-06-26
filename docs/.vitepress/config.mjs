import { defineConfig } from 'vitepress';

export default defineConfig({
  base:        '/stack/scene-graph/',
  title:       'wity-scene',
  description: 'Open-source headless XML scene-graph library for spatial overlays and compositing. Deterministic, isomorphic, zero dependencies. By Wity AI.',

  sitemap: {
    hostname: 'https://www.wity.ai',
  },

  head: [
    // Favicons
    ['link', { rel: 'icon',             type: 'image/x-icon',  href: 'https://www.wity.ai/assets/favicon/favicon.ico' }],
    ['link', { rel: 'icon',             type: 'image/png',     sizes: '32x32', href: 'https://www.wity.ai/assets/favicon/favicon-32x32.png' }],
    ['link', { rel: 'icon',             type: 'image/png',     sizes: '16x16', href: 'https://www.wity.ai/assets/favicon/favicon-16x16.png' }],
    ['link', { rel: 'apple-touch-icon', sizes: '180x180',      href: 'https://www.wity.ai/assets/favicon/apple-touch-icon.png' }],
    ['link', { rel: 'mask-icon',        href: 'https://www.wity.ai/assets/favicon/safari-pinned-tab.svg', color: '#000000' }],
    ['meta', { name: 'msapplication-TileImage', content: 'https://www.wity.ai/assets/favicon/mstile-150x150.png' }],
    ['meta', { name: 'theme-color', content: '#ffffff' }],

    // Canonical
    ['link', { rel: 'canonical', href: 'https://www.wity.ai/stack/scene-graph/' }],

    // Open Graph
    ['meta', { property: 'og:type',        content: 'website' }],
    ['meta', { property: 'og:site_name',   content: 'Wity AI' }],
    ['meta', { property: 'og:url',         content: 'https://www.wity.ai/stack/scene-graph/' }],
    ['meta', { property: 'og:title',       content: 'wity-scene — Open Source XML Scene-Graph Library by Wity AI' }],
    ['meta', { property: 'og:description', content: 'Headless, isomorphic XML scene-graph library for spatial overlays, title cards, and compositing. Deterministic: f(scene, t) → ComputedFrame. Zero dependencies. Runs in browser and Node.js.' }],
    ['meta', { property: 'og:image',       content: 'https://uploads.wity.ai/user-uploads/accounts_wity_ai/ai_image_editor_uploads/2026_04_20T16_47_32_984Z-wity-ai-og-images.png' }],

    // Twitter
    ['meta', { name: 'twitter:card',        content: 'summary_large_image' }],
    ['meta', { name: 'twitter:creator',     content: '@wity__ai' }],
    ['meta', { name: 'twitter:url',         content: 'https://www.wity.ai/stack/scene-graph/' }],
    ['meta', { name: 'twitter:title',       content: 'wity-scene — Open Source XML Scene-Graph Library by Wity AI' }],
    ['meta', { name: 'twitter:description', content: 'Headless, isomorphic XML scene-graph library for spatial overlays, title cards, and compositing. Deterministic: f(scene, t) → ComputedFrame. Zero dependencies.' }],
    ['meta', { name: 'twitter:image',       content: 'https://uploads.wity.ai/user-uploads/accounts_wity_ai/ai_image_editor_uploads/2026_04_20T16_47_32_984Z-wity-ai-og-images.png' }],

    // Additional meta
    ['meta', { name: 'author',   content: 'Wity AI' }],
    ['meta', { name: 'keywords', content: 'scene graph, xml scene, spatial overlay, compositing, animation, title card, lower third, headless, isomorphic, javascript, wity-scene, wity ai, open source' }],
    ['meta', { name: 'robots',   content: 'index, follow' }],

    // SoftwareSourceCode ld+json
    ['script', { type: 'application/ld+json' }, JSON.stringify({
      '@context': 'https://schema.org',
      '@type':    'SoftwareSourceCode',
      name:       'wity-scene',
      description: 'Open-source headless XML scene-graph library for spatial overlays, title cards, and compositing. Deterministic: f(scene, t) → ComputedFrame. Zero dependencies. Runs in browser and Node.js.',
      url:        'https://www.wity.ai/stack/scene-graph/',
      codeRepository: 'https://github.com/wity-ai/wity-scene',
      programmingLanguage: 'JavaScript',
      keywords:   'scene graph, xml scene, spatial overlay, compositing, animation, headless, isomorphic, javascript',
      author: {
        '@type': 'Organization',
        name:    'Wity AI',
        url:     'https://www.wity.ai',
      },
      isPartOf: {
        '@type': 'WebSite',
        name:    'Wity AI',
        url:     'https://www.wity.ai',
      },
    })],

    // Organization ld+json — matches main site structured data
    ['script', { type: 'application/ld+json' }, JSON.stringify({
      '@context': 'https://schema.org',
      '@type':    'Organization',
      name:       'Wity AI',
      url:        'https://www.wity.ai',
      logo: {
        '@type': 'ImageObject',
        url:     'https://www.wity.ai/assets/imgs/vritti-logo-dark.png',
      },
      description: 'Wity AI builds AI-powered tools and platforms for brainstorming, content creation, and digital product workflows.',
      sameAs: [
        'https://twitter.com/wity__ai',
        'https://www.linkedin.com/company/wityai/',
        'https://www.youtube.com/@wity__ai',
        'https://www.jity.ai',
      ],
    })],
  ],

  themeConfig: {
    logo: {
      light: 'https://www.wity.ai/assets/imgs/vritti-logo-dark.png',
      dark:  'https://www.wity.ai/assets/imgs/vritti-logo-dark.png',
      alt:   'Wity AI',
    },

    nav: [
      { text: 'Guide',         link: '/guide/overview' },
      { text: 'API',           link: '/packages/scene-core' },
      { text: 'llms.txt',      link: '/stack/scene-graph/llms.txt' },
      { text: 'llms-full.txt', link: '/stack/scene-graph/llms-full.txt' },
      { text: 'llms-api.txt',  link: '/stack/scene-graph/llms-api.txt' },
    ],

    sidebar: [
      {
        text:  'Guide',
        items: [
          { text: 'Overview',    link: '/guide/overview' },
          { text: 'Schema v1.0', link: '/guide/schema' },
          { text: 'Rendering',   link: '/guide/rendering' },
          { text: 'Deployment',  link: '/guide/deployment' },
        ],
      },
      {
        text:  'Packages',
        items: [
          { text: '@wity/scene-core',     link: '/packages/scene-core' },
          { text: '@wity/scene-headless', link: '/packages/scene-headless' },
          { text: '@wity/scene-player',   link: '/packages/scene-player' },
          { text: '@wity/scene-to-video', link: '/packages/scene-to-video' },
          { text: '@wity/scene-compose',  link: '/packages/scene-compose' },
        ],
      },
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/wity-ai/wity-scene' },
    ],

    footer: {
      message: 'Part of the <a href="https://www.wity.ai">Wity AI</a> open-source stack · <a href="https://github.com/wity-ai/wity-scene">GitHub</a>',
      copyright: '© 2026 Wity AI',
    },
  },
});
