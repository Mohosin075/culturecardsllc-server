const fs = require('fs');

const updatedPartnerPortalPage = `"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  TrendingUp,
  Users,
  DollarSign,
  Landmark,
  ShieldCheck,
  Share2,
  Copy,
  Check,
  AlertCircle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  BarChart3,
  LineChart,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { api } from "@/app/lib/api";

interface DashboardData {
  partnerInfo: {
    _id: string;
    name: string;
    email: string;
    promoCode: string;
    revenueSharePercentage: number;
    bankDetails?: {
      accountNumber?: string;
      routingNumber?: string;
      bankName?: string;
      accountHolderName?: string;
    };
    totalEarnings: number;
  };
  metrics: {
    totalReferredUsers: number;
    totalTransactions: number;
    totalPlatformFees: number;
    partnerShareTotal: number;
    ownerShareTotal: number;
  };
  realtimeGraphData: Array<{
    date: string;
    partnerEarnings: number;
    ownerEarnings: number;
    volume: number;
  }>;
}

function PartnerDashboardContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [chartType, setChartType] = useState<"bar" | "area">("bar");

  // Bank Form state
  const [bankForm, setBankForm] = useState({
    accountHolderName: "",
    bankName: "",
    routingNumber: "",
    accountNumber: "",
  });
  const [bankSubmitting, setBankSubmitting] = useState(false);
  const [bankSuccess, setBankSuccess] = useState(false);
  const [bankError, setBankError] = useState("");

  const fetchDashboard = async () => {
    if (!token) {
      setError("No access token provided. Please use your private magic link.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");
      const res = await api.partners.getDashboard(token);
      const dashboardData = res?.data || res;
      setData(dashboardData);
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || "Failed to load partner dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, [token]);

  const handleCopyCode = () => {
    if (!data?.partnerInfo.promoCode) return;
    navigator.clipboard.writeText(data.partnerInfo.promoCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const handleCopyPortalLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const handleBankSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setBankSubmitting(true);
    setBankSuccess(false);
    setBankError("");

    try {
      await api.partners.updateBankDetails(token, bankForm);
      setBankSuccess(true);
      setBankForm({ accountHolderName: "", bankName: "", routingNumber: "", accountNumber: "" });
      await fetchDashboard();
    } catch (err: any) {
      setBankError(err?.response?.data?.message || err.message || "Failed to update bank details");
    } finally {
      setBankSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center space-y-4">
        <Loader2 size={36} className="animate-spin text-[#155DFC]" />
        <p className="text-xs text-zinc-400 font-mono">Authenticating partner magic link...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-[#111111] border border-red-500/20 p-8 rounded-2xl text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center mx-auto">
            <AlertCircle size={24} />
          </div>
          <h2 className="text-lg font-bold text-white">Access Restricted</h2>
          <p className="text-xs text-zinc-400 leading-relaxed">{error || "Invalid magic link access token."}</p>
        </div>
      </div>
    );
  }

  const { partnerInfo, metrics, realtimeGraphData } = data;

  return (
    <div className="min-h-screen bg-black text-white font-sans antialiased">
      {/* Top Partner Navbar */}
      <header className="border-b border-white/10 bg-[#0d0d0d]/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#155DFC] to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-[#155DFC]/20">
              CC
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-white tracking-wide text-sm">{partnerInfo.name}</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-semibold flex items-center gap-1">
                  <ShieldCheck size={10} /> Verified Partner
                </span>
              </div>
              <span className="text-xs text-zinc-400">{partnerInfo.email}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchDashboard}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 transition-colors border border-white/5"
              title="Refresh Analytics"
            >
              <RefreshCw size={15} />
            </button>

            <button
              onClick={handleCopyPortalLink}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 text-xs font-semibold border border-white/10 transition-colors"
            >
              {copiedLink ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              <span>{copiedLink ? "Link Copied!" : "Portal Link"}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Banner Card with Promo Code & Quick Share */}
        <div className="bg-gradient-to-r from-[#111111] via-[#161618] to-[#111111] border border-white/10 rounded-2xl p-6 relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-2xl">
          <div className="space-y-2 max-w-xl">
            <span className="text-[11px] font-bold tracking-wider uppercase text-[#155DFC] bg-[#155DFC]/10 px-2.5 py-1 rounded-md border border-[#155DFC]/20 inline-block">
              Affiliate Share Policy ({partnerInfo.revenueSharePercentage}% Revenue Split)
            </span>
            <h2 className="text-xl font-extrabold text-white">Share Your Exclusive Promo Code</h2>
            <p className="text-xs text-zinc-400 leading-relaxed">
              When collectors sign up using your promo code, you automatically earn <strong>{partnerInfo.revenueSharePercentage}% of all transaction fees</strong> generated from their card sales, marketplace purchases, and trades!
            </p>
          </div>

          <div className="bg-black/60 border border-white/10 p-4 rounded-xl flex items-center gap-4 justify-between min-w-[260px]">
            <div>
              <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Your Promo Code</span>
              <div className="text-2xl font-mono font-extrabold text-white tracking-widest text-[#155DFC]">
                {partnerInfo.promoCode}
              </div>
            </div>
            <button
              onClick={handleCopyCode}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-[#155DFC] hover:bg-[#155DFC]/90 text-white text-xs font-semibold rounded-xl transition-all shadow-lg shadow-[#155DFC]/20"
            >
              {copiedCode ? (
                <>
                  <Check size={14} />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy size={14} />
                  <span>Copy Code</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* 4 Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#111111] border border-white/5 p-5 rounded-2xl space-y-2 hover:border-[#155DFC]/30 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-400">Total Referred Collectors</span>
              <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
                <Users size={18} />
              </div>
            </div>
            <p className="text-3xl font-extrabold text-white">{metrics.totalReferredUsers}</p>
            <span className="text-[11px] text-zinc-500 block">Collectors linked to code {partnerInfo.promoCode}</span>
          </div>

          <div className="bg-[#111111] border border-white/5 p-5 rounded-2xl space-y-2 hover:border-emerald-500/30 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-400">Your Net Earnings ({partnerInfo.revenueSharePercentage}%)</span>
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                <DollarSign size={18} />
              </div>
            </div>
            <p className="text-3xl font-extrabold text-emerald-400">\${metrics.partnerShareTotal.toFixed(2)}</p>
            <span className="text-[11px] text-zinc-500 block">Accumulated affiliate income</span>
          </div>

          <div className="bg-[#111111] border border-white/5 p-5 rounded-2xl space-y-2 hover:border-purple-500/30 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-400">Total Trading Volume</span>
              <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
                <TrendingUp size={18} />
              </div>
            </div>
            <p className="text-3xl font-extrabold text-white">\${metrics.totalTransactions.toFixed(2)}</p>
            <span className="text-[11px] text-zinc-500 block">Total sales & trade volume</span>
          </div>

          <div className="bg-[#111111] border border-white/5 p-5 rounded-2xl space-y-2 hover:border-amber-500/30 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-400">Platform Share ({100 - partnerInfo.revenueSharePercentage}%)</span>
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
                <Share2 size={18} />
              </div>
            </div>
            <p className="text-3xl font-extrabold text-zinc-300">\${metrics.ownerShareTotal.toFixed(2)}</p>
            <span className="text-[11px] text-zinc-500 block">Platform revenue share</span>
          </div>
        </div>

        {/* Real-time Side-by-Side Revenue Graph */}
        <div className="bg-[#111111] border border-white/5 p-6 rounded-2xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                <TrendingUp size={18} className="text-[#155DFC]" />
                Live Revenue Comparison Graph ({partnerInfo.revenueSharePercentage}% / {100 - partnerInfo.revenueSharePercentage}%)
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Real-time breakdown comparing your affiliate earnings against the platform share.
              </p>
            </div>

            <div className="flex items-center gap-1 bg-black/40 border border-white/10 p-1 rounded-xl">
              <button
                onClick={() => setChartType("bar")}
                className={\`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold transition-all \${
                  chartType === "bar" ? "bg-[#155DFC] text-white" : "text-zinc-400 hover:text-white"
                }\`}
              >
                <BarChart3 size={13} />
                Bar View
              </button>
              <button
                onClick={() => setChartType("area")}
                className={\`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold transition-all \${
                  chartType === "area" ? "bg-[#155DFC] text-white" : "text-zinc-400 hover:text-white"
                }\`}
              >
                <LineChart size={13} />
                Area View
              </button>
            </div>
          </div>

          {realtimeGraphData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-zinc-500 text-sm border border-dashed border-white/5 rounded-xl">
              No transaction history recorded yet. Share your code <strong className="text-white mx-1">{partnerInfo.promoCode}</strong> to start earning!
            </div>
          ) : (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                {chartType === "bar" ? (
                  <BarChart data={realtimeGraphData} margin={{ top: 20, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                    <XAxis dataKey="date" stroke="#71717a" fontSize={12} tickLine={false} />
                    <YAxis stroke="#71717a" fontSize={12} tickLine={false} tickFormatter={(val) => \`$\${val}\`} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#18181b", border: "1px solid #27272a", borderRadius: "12px" }}
                      formatter={(value: any) => [\`$\${Number(value).toFixed(2)}\`, ""]}
                    />
                    <Legend />
                    <Bar dataKey="partnerEarnings" name="Your Earnings (50%)" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="ownerEarnings" name="Platform Share (50%)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                ) : (
                  <AreaChart data={realtimeGraphData} margin={{ top: 20, right: 20, left: 0, bottom: 5 }}>
                    <defs>
                      <linearGradient id="colorPartner" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorOwner" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                    <XAxis dataKey="date" stroke="#71717a" fontSize={12} tickLine={false} />
                    <YAxis stroke="#71717a" fontSize={12} tickLine={false} tickFormatter={(val) => \`$\${val}\`} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#18181b", border: "1px solid #27272a", borderRadius: "12px" }}
                      formatter={(value: any) => [\`$\${Number(value).toFixed(2)}\`, ""]}
                    />
                    <Legend />
                    <Area type="monotone" dataKey="partnerEarnings" name="Your Earnings (50%)" stroke="#10b981" fillOpacity={1} fill="url(#colorPartner)" />
                    <Area type="monotone" dataKey="ownerEarnings" name="Platform Share (50%)" stroke="#3b82f6" fillOpacity={1} fill="url(#colorOwner)" />
                  </AreaChart>
                )}
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Payout & Banking Form */}
        <div className="bg-[#111111] border border-white/5 p-6 rounded-2xl space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/5 pb-4">
            <div>
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                <Landmark size={18} className="text-emerald-400" />
                Direct Payout Banking Details
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Configure your bank account for direct automated affiliate payouts.
              </p>
            </div>
            {partnerInfo.bankDetails?.accountNumber && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono font-bold">
                <CheckCircle2 size={13} />
                Current: {partnerInfo.bankDetails.accountNumber}
              </span>
            )}
          </div>

          {bankSuccess && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-xl flex items-center gap-2 font-medium">
              <CheckCircle2 size={16} />
              <span>Banking information updated successfully! Future commissions will be sent here.</span>
            </div>
          )}

          {bankError && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle size={16} />
              <span>{bankError}</span>
            </div>
          )}

          <form onSubmit={handleBankSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                Account Holder Name
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Boobie Holdings LLC"
                value={bankForm.accountHolderName}
                onChange={(e) => setBankForm({ ...bankForm, accountHolderName: e.target.value })}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                Bank Name
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Chase / Bank of America"
                value={bankForm.bankName}
                onChange={(e) => setBankForm({ ...bankForm, bankName: e.target.value })}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                US Routing Number (9 Digits)
              </label>
              <input
                type="text"
                required
                maxLength={9}
                placeholder="123456789"
                value={bankForm.routingNumber}
                onChange={(e) => setBankForm({ ...bankForm, routingNumber: e.target.value.replace(/\\D/g, '') })}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                Account Number
              </label>
              <input
                type="text"
                required={!partnerInfo.bankDetails?.accountNumber}
                placeholder={partnerInfo.bankDetails?.accountNumber ? \`Keep current (\${partnerInfo.bankDetails.accountNumber})\` : "Bank account number"}
                value={bankForm.accountNumber}
                onChange={(e) => setBankForm({ ...bankForm, accountNumber: e.target.value })}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="sm:col-span-2 flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t border-white/5">
              <p className="text-[11px] text-zinc-500">
                🔒 Bank transfers are encrypted and processed automatically. No SSN required.
              </p>
              <button
                type="submit"
                disabled={bankSubmitting}
                className="w-full sm:w-auto px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition-all shadow-lg shadow-emerald-600/20 disabled:opacity-50"
              >
                {bankSubmitting ? "Saving Payout Details..." : "Save Payout Details"}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}

export default function PartnerDashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black text-white flex items-center justify-center">
          <Loader2 size={36} className="animate-spin text-[#155DFC]" />
        </div>
      }
    >
      <PartnerDashboardContent />
    </Suspense>
  );
}
`;

fs.writeFileSync('D:/Mohosin/projects/dashboard/culture_dash/app/partner/dashboard/page.tsx', updatedPartnerPortalPage, 'utf8');
console.log('Updated Standalone Partner Portal Page successfully!');
