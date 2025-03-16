"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TonConnectUIProvider } from "@tonconnect/ui-react";
import Script from "next/script";
import { useEffect } from "react";
import { WalletProvider } from "../hooks/useNearWallet.context";

const manifestUrl = "https://solvium.xyz/tonconnect-manifest.json";

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false } },
});

export default function App({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  useEffect(() => {
    function sessionStorageSet(key: string, value: string) {
      try {
        window.sessionStorage.setItem(
          "__telegram__" + key,
          JSON.stringify(value)
        );
        return true;
      } catch (e) {}
      return false;
    }

    function sessionStorageGet(key: string) {
      try {
        return JSON.parse(window.sessionStorage.getItem("__telegram__" + key)!);
      } catch (e) {}
      return null;
    }

    const appTgVersion = 7.8;

    let initParams = sessionStorageGet("initParams");
    if (initParams) {
      if (!initParams.tgWebAppVersion) {
        initParams.tgWebAppVersion = appTgVersion;
      }
    } else {
      initParams = {
        tgWebAppVersion: appTgVersion,
      };
    }

    sessionStorageSet("initParams", initParams);
  }, []);

  return (
    <TonConnectUIProvider manifestUrl={manifestUrl}>
      <QueryClientProvider client={queryClient}>
        <WalletProvider>
          <html lang="en">
            <head>
              <Script src="https://telegram.org/js/telegram-web-app.js"></Script>
            </head>
            <body>{children}</body>
          </html>
        </WalletProvider>
      </QueryClientProvider>
    </TonConnectUIProvider>
  );
}
