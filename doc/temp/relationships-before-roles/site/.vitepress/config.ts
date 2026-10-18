import { defineConfig } from 'vitepress'
import { withMermaid } from 'vitepress-plugin-mermaid'
import markdownItKatex from 'markdown-it-katex'

const repository = process.env.GITHUB_REPOSITORY
const [owner, repositoryName] = repository?.split('/') ?? []
const isUserOrOrganizationSite = repositoryName === `${owner}.github.io`
const base = repository
  ? isUserOrOrganizationSite
    ? '/'
    : `/${repositoryName}/`
  : '/'

const englishSidebar = [
  {
    text: 'Introduction',
    items: [{ text: 'Introduction', link: '/introduction/introduction' }],
  },
  {
    text: 'Core Concepts',
    items: [
      { text: 'System', link: '/core-concepts/system' },
      { text: 'Pattern', link: '/core-concepts/pattern' },
      { text: 'Knowledge Space', link: '/core-concepts/knowledge-space' },
      { text: 'Agent', link: '/core-concepts/workflow-canvas' },
      { text: 'Canvas', link: '/core-concepts/canvas' },
      { text: 'Why Two Canvas Levels?', link: '/core-concepts/two-level-canvas' },
      { text: 'Tool', link: '/core-concepts/tool' },
      { text: 'Component Ecosystem', link: '/core-concepts/component-ecosystem' },
    ],
  },
  {
    text: 'Architecture',
    items: [
      { text: 'Level 1 — System', link: '/architecture/level-1-system' },
      { text: 'Level 2 — Execution Module', link: '/architecture/level-2-execution-module' },
      { text: 'Level 3 — Agent', link: '/architecture/level-3-agent' },
      { text: 'Level 4 — Node', link: '/architecture/level-4-node' },
    ],
  },
  {
    text: 'Benchmark',
    items: [
      { text: 'Claude Code', link: '/benchmark/claude-code' },
      { text: 'Coze', link: '/benchmark/coze' },
      { text: 'Dify', link: '/benchmark/dify' },
      { text: 'Amazon Bedrock', link: '/benchmark/amazon-bedrock' },
      { text: 'LangGraph', link: '/benchmark/langgraph' },
    ],
  },
  {
    text: 'Examples',
    items: [
      { text: 'Auto-generator', link: '/examples/auto-generator' },
      { text: 'WorldQuant Alpha', link: '/examples/worldquant-alpha' },
    ],
  },
  {
    text: 'Design Notes',
    items: [
      { text: '001 Why Spatial UI', link: '/design-notes/001-why-spatial-ui.md' },
    ],
  },
]

const chineseSidebar = [
  {
    text: '设计决策',
    items: [
      { text: '为什么是双层 Canvas', link: '/zh/core-concepts/two-level-canvas' },
      { text: '关系先于角色', link: '/zh/core-concepts/pattern' },
    ],
  },
]

export default withMermaid(
  defineConfig({
    title: 'Odyssey',
    description: 'Odyssey documentation',
    base,
    cleanUrls: true,
    lastUpdated: true,
    locales: {
      root: {
        label: 'English',
        lang: 'en',
        link: '/core-concepts/two-level-canvas',
        themeConfig: {
          nav: [
            { text: 'Docs', link: '/introduction/introduction' },
            { text: 'Evolution', link: '/evolution/' },
            { text: 'GitHub', link: 'https://github.com/riverLiang008/odyssey-architecture' },
          ],
          sidebar: englishSidebar,
          outline: { label: 'On this page' },
          lastUpdated: { text: 'Last updated' },
          editLink: {
            pattern: 'https://github.com/riverLiang008/odyssey-architecture/edit/main/:path',
            text: 'Edit this page on GitHub',
          },
          docFooter: {
            prev: 'Previous page',
            next: 'Next page',
          },
        },
      },
      zh: {
        label: '简体中文',
        lang: 'zh-CN',
        link: '/zh/core-concepts/two-level-canvas',
        themeConfig: {
          nav: [
            { text: '设计文档', link: '/zh/core-concepts/two-level-canvas' },
            { text: 'GitHub', link: 'https://github.com/riverLiang008/odyssey-architecture' },
          ],
          sidebar: chineseSidebar,
          outline: { label: '本页目录' },
          lastUpdated: { text: '最后更新' },
          editLink: {
            pattern: 'https://github.com/riverLiang008/odyssey-architecture/edit/main/:path',
            text: '在 GitHub 上编辑此页',
          },
          docFooter: {
            prev: '上一页',
            next: '下一页',
          },
        },
      },
    },
    markdown: {
      config: (md) => md.use(markdownItKatex),
    },
    mermaid: {
      theme: 'default',
    },
    themeConfig: {
      search: { provider: 'local' },
      socialLinks: [
        { icon: 'github', link: 'https://github.com/riverLiang008/odyssey-architecture' },
      ],
      footer: {
        message: 'Odyssey documentation · v3.0 (Latest)',
      },
    },
  }),
)
