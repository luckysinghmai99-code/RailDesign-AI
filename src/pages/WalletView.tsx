import React, { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, CreditCard, ShieldCheck, XCircle } from 'lucide-react';
import { usePlatform } from '../context/PlatformContext.tsx';
import { apiRequest } from '../lib/api.ts';
import type { PaymentRecord, TokenPackage, TokenTransaction, TokenWallet } from '../shared/types.ts';

export function WalletView() {
  const { user, wallet, setWallet, packages, navigate } = usePlatform();
  const [transactions, setTransactions] = useState<TokenTransaction[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [activeOrder, setActiveOrder] = useState<{
    orderId: string;
    mode: 'live_pg' | 'local_sandbox_verified';
    paymentSessionId: string;
    sandboxVerificationToken?: string;
    pkg: TokenPackage;
  } | null>(null);
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const loadWallet = async () => {
    try {
      const res = await apiRequest<{
        wallet: TokenWallet;
        transactions: TokenTransaction[];
        payments: PaymentRecord[];
      }>('/api/wallet');
      setWallet(res.wallet);
      setTransactions(res.transactions);
      setPayments(res.payments);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (user) {
      void loadWallet();
    }
  }, [user]);

  const handleBuyPackage = async (pkg: TokenPackage) => {
    setErrorMsg('');
    setStatusMsg('');
    setBusy(true);
    try {
      const res = await apiRequest<{
        order: {
          orderId: string;
          mode: 'live_pg' | 'local_sandbox_verified';
          paymentSessionId: string;
          sandboxVerificationToken?: string;
        };
        package: TokenPackage;
      }>('/api/payments/cashfree/create-order', {
        method: 'POST',
        body: JSON.stringify({ packageId: pkg.id }),
      });
      setActiveOrder({ ...res.order, pkg: res.package });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to start checkout.');
    } finally {
      setBusy(false);
    }
  };

  const handleCashfreeVerify = async (action: 'confirm' | 'fail' | 'cancel') => {
    if (!activeOrder) return;
    setBusy(true);
    setErrorMsg('');
    try {
      const res = await apiRequest<{
        status: string;
        creditedTokens: number;
        wallet: TokenWallet;
        payments: PaymentRecord[];
      }>('/api/payments/cashfree/verify', {
        method: 'POST',
        body: JSON.stringify({
          orderId: activeOrder.orderId,
          action,
          sandboxVerificationToken: activeOrder.sandboxVerificationToken,
        }),
      });
      setWallet(res.wallet);
      setPayments(res.payments);
      setActiveOrder(null);
      await loadWallet();
      if (res.status === 'paid') {
        setStatusMsg(`Payment verified via Cashfree. +${res.creditedTokens} tokens credited to your wallet.`);
      } else {
        setStatusMsg(`Order ${activeOrder.orderId} recorded as ${res.status}. No tokens were charged.`);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Verification failed.');
    } finally {
      setBusy(false);
    }
  };

  if (!user) return null;

  return (
    <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <button
        type="button"
        onClick={() => navigate('dashboard')}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white mb-4 cursor-pointer"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to Dashboard
      </button>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-slate-900 dark:text-white">
            Token Wallet & Billing Center
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            50 tokens cover up to 3 standard design screens. Unused reservations and failed jobs are refunded automatically.
          </p>
        </div>

        <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111622] text-xs font-semibold text-slate-800 dark:text-slate-200">
          <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          Cashfree Payments
        </div>
      </div>

      {/* Wallet Balances */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111622] p-5">
          <p className="text-xs text-slate-500 dark:text-slate-400">Available Balance</p>
          <p className="mt-1 text-3xl font-mono font-bold tabular-nums text-slate-900 dark:text-white">
            {wallet?.availableTokens ?? 0}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111622] p-5">
          <p className="text-xs text-slate-500 dark:text-slate-400">Reserved in Active Jobs</p>
          <p className="mt-1 text-3xl font-mono font-bold tabular-nums text-amber-600 dark:text-amber-400">
            {wallet?.reservedTokens ?? 0}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111622] p-5">
          <p className="text-xs text-slate-500 dark:text-slate-400">Lifetime Used Tokens</p>
          <p className="mt-1 text-3xl font-mono font-bold tabular-nums text-slate-900 dark:text-white">
            {wallet?.usedTokens ?? 0}
          </p>
        </div>
      </div>

      {statusMsg && (
        <div className="mt-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{statusMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="mt-5 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
          <XCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Token Packages */}
      <div className="mt-8">
        <h2 className="text-lg font-display font-semibold text-slate-900 dark:text-white mb-4">
          Purchase Token Packages
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {packages.map((pkg) => (
            <div
              key={pkg.id}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111622] p-5 flex flex-col justify-between"
            >
              <div>
                <h3 className="text-base font-display font-bold text-slate-900 dark:text-white">{pkg.name}</h3>
                <p className="mt-1 text-2xl font-mono font-bold tabular-nums text-blue-600 dark:text-blue-400">
                  {pkg.tokens.toLocaleString()} tokens
                </p>
                <p className="mt-1 text-xs font-mono tabular-nums text-slate-500">
                  ₹{pkg.priceInr.toLocaleString()} INR · ${pkg.priceUsd} USD
                </p>
                <p className="mt-3 text-xs text-slate-600 dark:text-slate-400">{pkg.description}</p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleBuyPackage(pkg)}
                className="mt-5 w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
              >
                <CreditCard className="w-3.5 h-3.5" />
                Checkout with Cashfree
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Cashfree Verification Modal */}
      {activeOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111622] p-6">
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 text-xs font-semibold mb-2">
              <ShieldCheck className="w-4 h-4" />
              Cashfree Server-Verified Checkout
            </div>
            <h3 className="text-lg font-display font-bold text-slate-900 dark:text-white">
              {activeOrder.pkg.name} — ₹{activeOrder.pkg.priceInr}
            </h3>
            <p className="mt-1 text-xs font-mono text-slate-500">
              Order ID: {activeOrder.orderId}
            </p>
            <p className="mt-3 text-xs text-slate-600 dark:text-slate-300">
              {activeOrder.mode === 'live_pg'
                ? 'Complete your Cashfree PG payment and click Verify Order Status below.'
                : 'Running in cryptographic sandbox mode (CASHFREE_APP_ID / CASHFREE_SECRET_KEY unset). Choose an outcome to test server HMAC verification:'}
            </p>

            <div className="mt-5 space-y-2.5">
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleCashfreeVerify('confirm')}
                className="w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
              >
                Verify & Credit +{activeOrder.pkg.tokens} Tokens
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleCashfreeVerify('fail')}
                  className="py-2 px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-red-600 dark:text-red-400 cursor-pointer"
                >
                  Simulate Failed
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleCashfreeVerify('cancel')}
                  className="py-2 px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300 cursor-pointer"
                >
                  Cancel Order
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Transaction & Payment Ledgers */}
      <div className="mt-10 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h2 className="text-base font-display font-semibold text-slate-900 dark:text-white mb-3">
            Token Ledger
          </h2>
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111622]">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                <tr>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Description</th>
                  <th className="py-2.5 px-3 text-right">Delta</th>
                  <th className="py-2.5 px-3 text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {transactions.map((tx) => (
                  <tr key={tx.id}>
                    <td className="py-2.5 px-3 capitalize font-medium">{tx.type}</td>
                    <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 max-w-xs truncate">
                      {tx.description}
                    </td>
                    <td
                      className={`py-2.5 px-3 text-right font-mono tabular-nums ${
                        tx.amount >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {tx.amount >= 0 ? `+${tx.amount}` : tx.amount}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums">{tx.balanceAfter}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h2 className="text-base font-display font-semibold text-slate-900 dark:text-white mb-3">
            Payment History
          </h2>
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111622]">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                <tr>
                  <th className="py-2.5 px-3">Order</th>
                  <th className="py-2.5 px-3">Gateway</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Tokens</th>
                  <th className="py-2.5 px-3 text-right">INR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-500">
                      No payment orders yet.
                    </td>
                  </tr>
                ) : (
                  payments.map((p) => (
                    <tr key={p.id}>
                      <td className="py-2.5 px-3 font-mono truncate max-w-[130px]">{p.orderId}</td>
                      <td className="py-2.5 px-3 capitalize">{p.gateway}</td>
                      <td className="py-2.5 px-3 capitalize">{p.status}</td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums">+{p.tokensPurchased}</td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums">₹{p.amountInr}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
