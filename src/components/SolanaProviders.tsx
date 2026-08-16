import { useMemo, type ReactNode } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PRIMARY_RPC } from '../lib/solana';
import '@solana/wallet-adapter-react-ui/styles.css';

/**
 * Mounted only by the passport screen, which is the one place a wallet is
 * needed. Keeping it out of the root means the weigh flow — the screen used
 * at 3am, offline, on a phone — never downloads the wallet stack.
 */
export function SolanaProviders({ children }: { children: ReactNode }) {
  const endpoint = useMemo(() => PRIMARY_RPC, []);

  // Phantom, Solflare and Backpack register themselves through the Wallet
  // Standard, so an explicit adapter list is not needed.
  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={[]} autoConnect={false}>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
