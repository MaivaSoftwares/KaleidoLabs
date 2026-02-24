import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { RainbowKitProvider, darkTheme, connectorsForWallets } from '@rainbow-me/rainbowkit';
import { WagmiProvider, createConfig } from 'wagmi';
import { createClient, http } from 'viem';
import { eip712WalletActions } from 'viem/zksync';
import { abstractWallet } from '@abstract-foundation/agw-react/connectors';
import '@rainbow-me/rainbowkit/styles.css';
import Index from "./pages/Index";
import Gallery from "./pages/gallery";
import NotFound from "./pages/NotFound";
import PremiumMining from "./pages/PremiumMining";
import AdminWithdrawal from "./pages/AdminWithdrawal";
import Layout from "./components/Layout";

// Configure QueryClient
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity,
      refetchOnWindowFocus: false,
    },
  },
});

// Define the Abstract Chain
const abstractChain = {
  id: 2741,
  name: 'Abstract Chain',
  network: 'abstract',
  nativeCurrency: {
    decimals: 18,
    name: 'Ether',
    symbol: 'ETH',
  },
  rpcUrls: {
    public: { http: ['https://api.mainnet.abs.xyz'] },
    default: { http: ['https://api.mainnet.abs.xyz'] },
  },
} as const;

// Configure RainbowKit connectors
const connectors = connectorsForWallets([
  {
    groupName: "Abstract",
    wallets: [abstractWallet],
  },
], {
  appName: "Kaleido SuperNode",
  projectId: "7439d50f6ec73579ccea76ce03c20946",
  appDescription: "Kaleido SuperNode DApp",
  appIcon: "",
  appUrl: "",
});

// Create wagmi config
const wagmiConfig = createConfig({
  connectors,
  chains: [abstractChain],
  transports: {
    [abstractChain.id]: http(abstractChain.rpcUrls.public.http[0]),
  },
  ssr: true,
});

const App = () => (
  <BrowserRouter>
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={darkTheme()}>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <Routes>
              <Route path="/" element={<Layout><Index /></Layout>} />
              <Route path="/gallery" element={<Layout><Gallery /></Layout>} />
              <Route path="/premium-mining" element={<Layout><PremiumMining /></Layout>} />
              <Route path="/admin/withdraw" element={<Layout><AdminWithdrawal /></Layout>} />
              <Route path="*" element={<Layout><NotFound /></Layout>} />
            </Routes>
          </TooltipProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </BrowserRouter>
);

export default App;
