const path = require('path');
const lightCodeTheme = require('prism-react-renderer/themes/github');
const darkCodeTheme = require('prism-react-renderer/themes/dracula');

/** @type {import('@docusaurus/types').DocusaurusConfig} */
module.exports = {
  title: 'graphql-js',
  tagline: 'A reference implementation of GraphQL for JavaScript',
  url: 'https://js.graphql.org',
  baseUrl: '/',
  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',
  favicon: 'img/favicon.ico',
  organizationName: 'graphql', // Usually your GitHub org/user name.
  projectName: 'graphql-js', // Usually your repo name.
  themeConfig: {
    navbar: {
      title: 'grahql-js',
      logo: {
        alt: 'GraphQL Logo',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'doc',
          docId: 'index',
          position: 'left',
          label: 'Tutorial',
        },
        {
          href: 'https://github.com/graphql/graphql-js',
          label: 'GitHub',
          position: 'right',
        },
        {
          to: 'api/graphql-js',
          label: 'API',
          position: 'left',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            {
              label: 'Tutorial',
              to: 'tutorials',
            },
          ],
        },
        {
          title: 'Community',
          items: [
            {
              label: 'Code of Conduct',
              href: 'https://graphql.org/codeofconduct/',
            },
            {
              label: 'Stack Overflow',
              href: 'https://stackoverflow.com/questions/tagged/graphql-js',
            },
            {
              label: 'Discord',
              href: 'https://discord.graphql.org/',
            },
            {
              label: 'Twitter',
              href: 'https://twitter.com/graphql',
            },
            {
              label: 'Upcoming Events',
              href: 'https://graphql.org/community/upcoming-events/',
            },
          ],
        },
        {
          title: 'More',
          items: [
            {
              label: 'GraphQL JS Working Group',
              href: 'https://github.com/graphql/graphql-js-wg',
            },
            {
              label: 'GraphQL Foundation',
              href: 'https://graphql.org/foundation',
            },
            {
              label: 'GraphQL Spec',
              href: 'https://spec.graphql.org',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} <a href="https://graphql.org/foundation/" target="_blank" rel="noopener noreferrer">The GraphQL Foundation</a>. All rights reserved. The Linux Foundation has registered trademarks and uses trademarks. For a list of trademarks of The Linux Foundation, please see our <a href="https://www.linuxfoundation.org/trademark-usage" target="_blank" rel="noopener noreferrer">Trademark Usage</a> page. Linux is a registered trademark of Linus Torvalds. <a href="https://www.linuxfoundation.org/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a> and <a href="https://www.linuxfoundation.org/terms" target="_blank" rel="noopener noreferrer">Terms of Use</a>. Built with <a href="https://docusaurus.io/" target="_blank" rel="noopener noreferrer">Docusaurus</a>.`,
    },
    prism: {
      theme: lightCodeTheme,
      darkTheme: darkCodeTheme,
    },
  },
  presets: [
    [
      '@docusaurus/preset-classic',
      {
        docs: {
          path: 'tutorials',
          routeBasePath: 'tutorials',
          sidebarPath: require.resolve('./sidebars.js'),
          editUrl: 'https://github.com/graphql/graphql-js/edit/main/www/',
        },
        blog: {
          showReadingTime: true,
          editUrl: 'https://github.com/graphql/graphql-js/edit/main/www/blog/',
        },
        theme: {
          customCss: require.resolve('./src/css/custom.css'),
        },
      },
    ],
  ],
  plugins: [
    [
      'docusaurus-plugin-typedoc-api',
      {
        projectRoot: path.join(__dirname, '..'),
        packages: ['.'],
      },
    ],
  ],
};
