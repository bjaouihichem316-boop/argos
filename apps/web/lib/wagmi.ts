import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { base, baseSepolia } from "wagmi/chains";

export const wagmiConfig = getDefaultConfig({
  appName: "ARGOS",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_ID ?? "argos-local-dev",
  chains: [base, baseSepolia],
  ssr: true,
});
