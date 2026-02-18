/* eslint-disable camelcase, new-cap, react/react-in-jsx-scope, react/no-unknown-property */

import type { AppProps } from 'next/app';
import { Roboto_Flex, Roboto_Mono } from 'next/font/google';

// eslint-disable-next-line import/no-unassigned-import
import '../css/globals.css';

const robotoFlex = Roboto_Flex({
  subsets: ['latin'],
});

const robotoMono = Roboto_Mono({
  subsets: ['latin'],
});

// TODO: do we need google analytics?

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <style jsx global>{`
        html {
          font-family: ${robotoFlex.style.fontFamily};
        }

        .roboto-mono {
          font-family: ${robotoMono.style.fontFamily};
        }
      `}</style>
      <Component {...pageProps} />
    </>
  );
}
