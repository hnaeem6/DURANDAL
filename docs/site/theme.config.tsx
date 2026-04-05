import type { DocsThemeConfig } from "nextra-theme-docs";

const config: DocsThemeConfig = {
  logo: <strong>DURANDAL Docs</strong>,
  project: {
    link: "https://github.com/your-org/durandal",
  },
  docsRepositoryBase: "https://github.com/your-org/durandal/tree/main/docs/site",
  footer: {
    content: "DURANDAL - Your unbreakable AI workforce.",
  },
  head: (
    <>
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta name="description" content="DURANDAL documentation" />
      <title>DURANDAL Docs</title>
    </>
  ),
  sidebar: {
    defaultMenuCollapseLevel: 1,
  },
  toc: {
    backToTop: true,
  },
};

export default config;
