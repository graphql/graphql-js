'use strict';

const path = require('path');

const lightCodeTheme = require('prism-react-renderer/themes/github');
const darkCodeTheme = require('prism-react-renderer/themes/dracula');

/** @type {import('@docusaurus/types').Config} */
module.exports = {
  title: 'graphql-js',
  tagline: 'A reference implementation of GraphQL for JavaScript',
  url: 'https://graphql-js.graphql.org',
  baseUrl: '/',
  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'throw',
  onDuplicateRoutes: 'throw',
  favicon: 'img/favicon.ico',
  organizationName: 'graphql',
  projectName: 'graphql-js',
  presets: [
    [
      '@docusaurus/preset-classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: require.resolve('./sidebars.js'),
          editUrl:
            'https://github.com/graphql/graphql-js/edit/main/website/docs/',
        },
        theme: {
          customCss: require.resolve('./src/css/custom.css'),
        },
      }),
    ],
  ],
  plugins: [
    [
      'docusaurus-plugin-typedoc-api',
      {
        projectRoot: path.join(__dirname, '..'),
        packages: [{ path: '.', slug: 'graphql-js' }],
      },
    ],
  ],
  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      navbar: {
        title: 'graphql-js',
        logo: {
          alt: 'GraphQL Logo',
          src: 'img/logo.svg',
        },
        items: [
          {
            type: 'doc',
            docId: 'tutorials/index',
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
                to: 'docs/tutorials/',
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
        copyright: `Copyright &copy; ${new Date().getFullYear()} <a href="https://graphql.org/foundation/" target="_blank" rel="noopener noreferrer">The GraphQL Foundation</a>. All rights reserved. <br/> For web site terms of use, trademark policy and general project policies please see&nbsp; <a href="https://lfprojects.org/" target="_blank" rel="noopener noreferrer">https://lfprojects.org</a>.`,
      },
      prism: {
        theme: lightCodeTheme,
        darkTheme: darkCodeTheme,
      },
    }),
};
