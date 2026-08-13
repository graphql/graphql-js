import type { AppProps } from 'next/app';
import { Roboto_Flex, Roboto_Mono } from 'next/font/google';
import { useRouter } from 'next/router';

import '../css/globals.css';

const robotoFlex = Roboto_Flex({
  subsets: ['latin'],
});

const robotoMono = Roboto_Mono({
  subsets: ['latin'],
});

// TODO: do we need google analytics?

export default function App({ Component, pageProps }: AppProps) {
  const { pathname } = useRouter();
  const isApiDocsRoute = ['/api-v16', '/api-v17'].some(
    (basePath) => pathname === basePath || pathname.startsWith(`${basePath}/`),
  );

  return (
    <div
      className={isApiDocsRoute ? 'site-route api-docs-route' : 'site-route'}
    >
      <style jsx global>{`
        html {
          font-family: ${robotoFlex.style.fontFamily};
        }

        .roboto-mono {
          font-family: ${robotoMono.style.fontFamily};
        }
      `}</style>
      <Component {...pageProps} />
    </div>
  );
}
