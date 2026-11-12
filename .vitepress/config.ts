import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig, type DefaultTheme } from 'vitepress';
import { channel } from './channel';

const versionNav = (english: boolean): DefaultTheme.NavItem => ({
  text: channel.beta ? 'v2 Beta' : english ? '1.x Stable' : '1.x 稳定版',
  items: [
    { text: english ? '1.x Stable' : '1.x 稳定版', link: `https://cpamp-docs.seakee.dev/${english ? 'en/' : ''}` },
    { text: 'v2 Beta', link: `https://cpamp-docs.seakee.dev/next/${english ? 'en/' : ''}` },
  ],
});

const homeUrl = (english: boolean) => (english ? 'https://cpamp.seakee.dev/' : 'https://cpamp.seakee.dev/zh/');
const demoUrl = 'https://cpamp-demo.seakee.dev/';

const zhNav: DefaultTheme.NavItem[] = [
  { text: '指南', link: '/guide/getting-started', activeMatch: '^/(guide|deployment)/' },
  { text: '功能手册', link: '/manual/dashboard', activeMatch: '^/manual/' },
  { text: '运维', link: '/operations/update', activeMatch: '^/(operations|troubleshooting)/' },
  { text: '参考', link: '/reference/faq', activeMatch: '^/(reference|gateway|migration)/' },
  { text: '在线演示', link: demoUrl },
  { text: '官网', link: homeUrl(false) },
  versionNav(false),
];

const enNav: DefaultTheme.NavItem[] = [
  { text: 'Guide', link: '/en/guide/getting-started', activeMatch: '^/en/(guide|deployment)/' },
  { text: 'Manual', link: '/en/manual/dashboard', activeMatch: '^/en/manual/' },
  { text: 'Operations', link: '/en/operations/update', activeMatch: '^/en/(operations|troubleshooting)/' },
  { text: 'Reference', link: '/en/reference/faq', activeMatch: '^/en/(reference|gateway|migration)/' },
  { text: 'Live demo', link: demoUrl },
  { text: 'Website', link: homeUrl(true) },
  versionNav(true),
];

const zhSidebar: DefaultTheme.Sidebar = [
  {
    text: '开始使用',
    items: [
      { text: '文档首页', link: '/' },
      { text: '选择适合的模式', link: '/guide/choosing-a-panel' },
      { text: '快速开始', link: '/guide/getting-started' },
      { text: 'CPAMP 与 CPA 如何协作', link: '/guide/runtime-model' },
    ],
  },
  {
    text: '安装部署',
    items: [
      { text: '安装轻量面板', link: '/deployment/cpa-panel' },
      { text: channel.beta ? '一键安装器（1.x）' : '一键安装器', link: '/deployment/installer' },
      { text: channel.beta ? '安装 v2 Beta（Docker）' : 'Docker 部署', link: '/deployment/docker' },
      { text: '原生包部署', link: '/deployment/native' },
      { text: '原生包后台控制', link: '/deployment/native-background-control' },
      { text: '反向代理', link: '/deployment/reverse-proxy' },
    ],
  },
  {
    text: '功能手册',
    items: [
      { text: '仪表盘', link: '/manual/dashboard' },
      { text: 'AI 提供商', link: '/manual/ai-providers' },
      { text: '凭证管理', link: '/manual/accounts' },
      { text: 'OAuth 登录', link: '/manual/oauth' },
      { text: '请求监控', link: '/manual/monitoring' },
      { text: '用量分析', link: '/manual/usage-analytics' },
      { text: '账号巡检（Codex / xAI）', link: '/manual/codex-inspection' },
      { text: '账号处理队列', link: '/manual/account-actions' },
      { text: '模型价格', link: '/manual/model-prices' },
      { text: '插件管理', link: '/manual/plugins' },
      { text: '配置中心', link: '/manual/configuration' },
      { text: '日志查看', link: '/manual/logs' },
      { text: '系统信息', link: '/manual/system' },
    ],
  },
  {
    text: '运维与排障',
    items: [
      { text: '更新 CPAMP', link: '/operations/update' },
      { text: '备份与恢复', link: '/operations/backup' },
      { text: '重置管理员密钥', link: '/operations/reset-admin-key' },
      { text: 'Manager Server', link: '/operations/manager-server' },
      { text: '配置与数据目录', link: '/operations/configuration' },
      { text: '请求监控为空', link: '/troubleshooting/request-monitoring' },
    ],
  },
  {
    text: '参考',
    collapsed: true,
    items: [
      { text: '常见问题', link: '/reference/faq' },
      { text: '准备 CPA 网关', link: '/gateway/configuration' },
      { text: '客户端接入', link: '/gateway/clients' },
      { text: '提供商与兼容接口', link: '/gateway/providers' },
      { text: '能力矩阵', link: '/reference/capability-matrix' },
      { text: '版本说明', link: '/reference/releases' },
      { text: '从 CPA-Manager 迁移', link: '/migration/from-cpa-manager' },
      { text: '性能优化记录（2026-07）', link: '/operations/performance-optimization-2026-07-10' },
    ],
  },
];

const enSidebar: DefaultTheme.Sidebar = [
  {
    text: 'Get started',
    items: [
      { text: 'Docs home', link: '/en/' },
      { text: 'Choose a mode', link: '/en/guide/choosing-a-panel' },
      { text: 'Quick start', link: '/en/guide/getting-started' },
      { text: 'How CPAMP works with CPA', link: '/en/guide/runtime-model' },
    ],
  },
  {
    text: 'Install and deploy',
    items: [
      { text: 'Install the Lightweight Panel', link: '/en/deployment/cpa-panel' },
      { text: channel.beta ? 'One-click installer (1.x)' : 'One-click installer', link: '/en/deployment/installer' },
      { text: channel.beta ? 'Install v2 Beta (Docker)' : 'Docker deployment', link: '/en/deployment/docker' },
      { text: 'Native packages', link: '/en/deployment/native' },
      { text: 'Native background control', link: '/en/deployment/native-background-control' },
      { text: 'Reverse proxy', link: '/en/deployment/reverse-proxy' },
    ],
  },
  {
    text: 'Manual',
    items: [
      { text: 'Dashboard', link: '/en/manual/dashboard' },
      { text: 'AI providers', link: '/en/manual/ai-providers' },
      { text: 'Accounts', link: '/en/manual/accounts' },
      { text: 'OAuth login', link: '/en/manual/oauth' },
      { text: 'Monitoring', link: '/en/manual/monitoring' },
      { text: 'Usage analytics', link: '/en/manual/usage-analytics' },
      { text: 'Account inspection (Codex / xAI)', link: '/en/manual/codex-inspection' },
      { text: 'Account action queue', link: '/en/manual/account-actions' },
      { text: 'Model prices', link: '/en/manual/model-prices' },
      { text: 'Plugins', link: '/en/manual/plugins' },
      { text: 'Configuration', link: '/en/manual/configuration' },
      { text: 'Logs', link: '/en/manual/logs' },
      { text: 'System', link: '/en/manual/system' },
    ],
  },
  {
    text: 'Operations and troubleshooting',
    items: [
      { text: 'Upgrade CPAMP', link: '/en/operations/update' },
      { text: 'Backup and restore', link: '/en/operations/backup' },
      { text: 'Reset the Admin Key', link: '/en/operations/reset-admin-key' },
      { text: 'Manager Server', link: '/en/operations/manager-server' },
      { text: 'Configuration and data directory', link: '/en/operations/configuration' },
      { text: 'Monitoring has no data', link: '/en/troubleshooting/request-monitoring' },
    ],
  },
  {
    text: 'Reference',
    collapsed: true,
    items: [
      { text: 'FAQ', link: '/en/reference/faq' },
      { text: 'Prepare the CPA gateway', link: '/en/gateway/configuration' },
      { text: 'Client configuration', link: '/en/gateway/clients' },
      { text: 'Providers and compatible APIs', link: '/en/gateway/providers' },
      { text: 'Capability matrix', link: '/en/reference/capability-matrix' },
      { text: 'Releases', link: '/en/reference/releases' },
      { text: 'Migrate from CPA-Manager', link: '/en/migration/from-cpa-manager' },
      { text: 'Performance notes (2026-07)', link: '/en/operations/performance-optimization-2026-07-10' },
    ],
  },
];

const zhSearchTranslations = {
  button: {
    buttonText: '搜索',
    buttonAriaLabel: '搜索文档',
  },
  modal: {
    noResultsText: '没有找到相关结果',
    resetButtonTitle: '清除查询条件',
    displayDetails: '显示详细列表',
    footer: {
      selectText: '选择',
      navigateText: '切换',
      closeText: '关闭',
    },
  },
};

const enSearchTranslations = {
  button: {
    buttonText: 'Search',
    buttonAriaLabel: 'Search docs',
  },
  modal: {
    noResultsText: 'No results found',
    resetButtonTitle: 'Clear search query',
    displayDetails: 'Display detailed list',
    footer: {
      selectText: 'to select',
      navigateText: 'to navigate',
      closeText: 'to close',
    },
  },
};

const editLinkPattern = `https://github.com/cpamp-hq/docs/edit/${channel.branch}/:path`;

const commonThemeConfig: DefaultTheme.Config = {
  search: {
    provider: 'local',
    options: {
      locales: {
        root: {
          translations: zhSearchTranslations,
        },
        en: {
          translations: enSearchTranslations,
        },
      },
    },
  },
  logo: { light: '/brand/logo.svg', dark: '/brand/logo-white.svg', alt: 'CPA Manager Plus' },
  siteTitle: 'Docs',
  socialLinks: [{ icon: 'github', link: 'https://github.com/seakee/CPA-Manager-Plus' }],
};

export default defineConfig({
  title: 'CPA Manager Plus Docs',
  description:
    'CPA and CLIProxyAPI management panel documentation for request monitoring, usage analytics, cost, quota, account health, plugins, deployment, and operations.',
  base: channel.base,
  srcExclude: ['README.md', 'tests/**'],
  ignoreDeadLinks: false,
  lastUpdated: true,
  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: `${channel.base}favicon.svg` }],
    ['link', { rel: 'icon', type: 'image/x-icon', href: `${channel.base}favicon.ico`, sizes: '16x16 32x32 48x48' }],
    ['link', { rel: 'apple-touch-icon', href: `${channel.base}apple-touch-icon.png`, sizes: '180x180' }],
    ['meta', { name: 'theme-color', content: '#005cff' }],
    ['meta', { property: 'og:site_name', content: 'CPA Manager Plus Docs' }],
    ...(channel.beta ? ([['meta', { name: 'robots', content: 'noindex' }]] as const) : []),
  ],
  sitemap: channel.beta ? undefined : { hostname: 'https://cpamp-docs.seakee.dev/' },
  transformPageData(pageData, { siteConfig }) {
    const isEnglish = pageData.relativePath.startsWith('en/');
    const siteTitle = 'CPA Manager Plus';
    const title = pageData.title ? `${pageData.title} | ${siteTitle}` : siteTitle;
    const description =
      pageData.description ||
      (isEnglish
        ? 'CPA / CLIProxyAPI management panel and observability documentation for requests, cost, quota, failures, and account health.'
        : 'CPA / CLIProxyAPI 管理面板与可观测性文档，覆盖请求监控、成本、配额、失败诊断和账号健康。');
    const toUrl = (relativePath: string) =>
      `https://cpamp-docs.seakee.dev${channel.base}${relativePath.replace(/index\.md$/, '').replace(/\.md$/, '.html')}`;
    const canonical = toUrl(pageData.relativePath);
    const zhPath = isEnglish ? pageData.relativePath.slice(3) : pageData.relativePath;
    const hasPair =
      existsSync(join(siteConfig.srcDir, zhPath)) && existsSync(join(siteConfig.srcDir, `en/${zhPath}`));
    const alternates = hasPair
      ? ([
          ['zh-CN', toUrl(zhPath)],
          ['en', toUrl(`en/${zhPath}`)],
          ['x-default', toUrl(zhPath)],
        ] as const)
      : [];
    const ogImage = 'https://cpamp-docs.seakee.dev/og.jpg';

    pageData.frontmatter.head ??= [];
    pageData.frontmatter.head.push(
      ['link', { rel: 'canonical', href: canonical }],
      ['meta', { property: 'og:type', content: 'article' }],
      ['meta', { property: 'og:title', content: title }],
      ['meta', { property: 'og:description', content: description }],
      ['meta', { property: 'og:url', content: canonical }],
      ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
      ['meta', { name: 'twitter:title', content: title }],
      ['meta', { name: 'twitter:description', content: description }],
      ['meta', { property: 'og:image', content: ogImage }],
      ['meta', { property: 'og:image:width', content: '1200' }],
      ['meta', { property: 'og:image:height', content: '630' }],
      ['meta', { property: 'og:image:alt', content: 'CPA Manager Plus dashboard' }],
      ['meta', { property: 'og:locale', content: isEnglish ? 'en_US' : 'zh_CN' }],
      ['meta', { name: 'twitter:image', content: ogImage }],
      ...alternates.map(([hreflang, href]) => ['link', { rel: 'alternate', hreflang, href }] as [string, Record<string, string>])
    );
  },
  themeConfig: commonThemeConfig,
  locales: {
    root: {
      label: '简体中文',
      lang: 'zh-CN',
      title: 'CPA Manager Plus',
      description:
        'CPA / CLIProxyAPI 管理面板使用文档：网关配置、请求监控、成本分析、配额、账号健康、插件、部署与运维。',
      themeConfig: {
        nav: zhNav,
        sidebar: zhSidebar,
        editLink: {
          pattern: editLinkPattern,
          text: '编辑此页',
        },
        lastUpdated: {
          text: '最后更新',
        },
        outline: {
          label: '本页目录',
        },
        footer: {
          message:
            '<a href="https://cpamp.seakee.dev/zh/">官网</a> · <a href="https://cpamp-demo.seakee.dev/">在线演示</a> · <a href="https://github.com/seakee/CPA-Manager-Plus">GitHub</a> · 基于 MIT 许可证发布',
          copyright: 'Copyright 2026 Seakee.',
        },
        docFooter: {
          prev: '上一页',
          next: '下一页',
        },
        sidebarMenuLabel: '菜单',
        returnToTopLabel: '返回顶部',
        langMenuLabel: '切换语言',
        darkModeSwitchLabel: '外观',
        lightModeSwitchTitle: '切换到浅色模式',
        darkModeSwitchTitle: '切换到深色模式',
      },
    },
    en: {
      label: 'English',
      lang: 'en-US',
      link: '/en/',
      title: 'CPA Manager Plus',
      description:
        'CPA / CLIProxyAPI management panel docs for gateway configuration, request monitoring, cost analytics, quota, account health, plugins, deployment, and operations.',
      themeConfig: {
        nav: enNav,
        sidebar: enSidebar,
        editLink: {
          pattern: editLinkPattern,
          text: 'Edit this page',
        },
        lastUpdated: {
          text: 'Last updated',
        },
        outline: {
          label: 'On this page',
        },
        footer: {
          message:
            '<a href="https://cpamp.seakee.dev/">Website</a> · <a href="https://cpamp-demo.seakee.dev/">Live demo</a> · <a href="https://github.com/seakee/CPA-Manager-Plus">GitHub</a> · Released under the MIT License',
          copyright: 'Copyright 2026 Seakee.',
        },
        docFooter: {
          prev: 'Previous page',
          next: 'Next page',
        },
        sidebarMenuLabel: 'Menu',
        returnToTopLabel: 'Return to top',
        langMenuLabel: 'Change language',
        darkModeSwitchLabel: 'Appearance',
        lightModeSwitchTitle: 'Switch to light mode',
        darkModeSwitchTitle: 'Switch to dark mode',
      },
    },
  },
});
