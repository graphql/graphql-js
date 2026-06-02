const meta = {
  docs: {
    type: 'page',
    title: 'Documentation',
  },
  'upgrade-guides': {
    type: 'menu',
    title: 'Upgrade Guides',
    items: {
      'v16-v17': {
        title: 'v16 to v17',
        href: '/upgrade-guides/v16-v17',
      },
      'v15-v16': {
        title: 'v15 to v16',
        href: '/upgrade-guides/v15-v16',
      },
      'v14-v15': {
        title: 'v14 to v15',
        href: '/upgrade-guides/v14-v15',
      },
    },
  },
  api: {
    type: 'menu',
    title: 'API',
    items: {
      v17: {
        title: 'v17',
        href: '/api-v17/graphql',
      },
      v16: {
        title: 'v16',
        href: '/api-v16/graphql',
      },
      'graphql-http': {
        title: 'graphql-http',
        href: '/docs/graphql-http',
      },
    },
  },
  'api-v16': {
    title: 'v16 API',
    theme: {
      collapsed: true,
    },
  },
  'api-v17': {
    title: 'v17 API',
    theme: {
      collapsed: true,
    },
  },
};

export default meta;
