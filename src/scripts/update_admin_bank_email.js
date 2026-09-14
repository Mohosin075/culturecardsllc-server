const fs = require('fs');

// 1. Update api.ts to include sendEmail method
let apiTs = fs.readFileSync('D:/Mohosin/projects/dashboard/culture_dash/app/lib/api.ts', 'utf8');

if (!apiTs.includes('sendEmail: (partnerId: string)')) {
  apiTs = apiTs.replace(
    'updateBankDetails: (',
    `sendEmail: (partnerId: string) =>\n      this.request<any>(\`/partner/\${partnerId}/send-email\`, { method: "POST" }),\n    updateBankDetails: (`
  );
  fs.writeFileSync('D:/Mohosin/projects/dashboard/culture_dash/app/lib/api.ts', apiTs, 'utf8');
  console.log('Updated api.ts with sendEmail endpoint!');
}

// 2. Update partners page with Copy Bank Details Modal + Send Email Button
const updatedPartnersPage = `"use client";

import { useEffect, useState } from "react";
import {
  Handshake,
  Plus,
  Search,
  Copy,
  Check,
  ExternalLink,
  Users,
  DollarSign,
  Landmark,
  Download,
  Sparkles,
  ShieldCheck,
  RefreshCw,
  Mail,
  Eye,
  X,
  CreditCard,
} from "lucide-react";
import { api } from "@/app/lib/api";

interface Partner {
  _id: string;
  name: string;
  email: string;
  promoCode: string;
  revenueSharePercentage: number;
  totalReferredUsers: number;
  totalEarnings: number;
  accessToken: string;
  bankDetails?: {
    accountNumber?: string;
    routingNumber?: string;
    bankName?: string;
    accountHolderName?: string;
  };
  createdAt?: string;
}

export default function AdminPartnersPage() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedNotification, setCopiedNotification] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Bank Info Modal state
  const [selectedPartnerForBank, setSelectedPartnerForBank] = useState<Partner | null>(null);
  const [copiedBankInfo, setCopiedBankInfo] = useState(false);

  // Email sending state
  const [sendingEmailId, setSendingEmailId] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    promoCode: "",
    revenueSharePercentage: 50,
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const fetchPartners = async () => {
    try {
      setLoading(true);
      const res = await api.partners.getAll();
      const rawData = Array.isArray(res) ? res : (res?.data || []);
      setPartners(rawData);
    } catch (err: any) {
      console.error("Failed to load partners:", err);
      setPartners([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPartners();
  }, []);

  const handleCopyLink = (token: string, partnerId: string, partnerName: string) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const magicUrl = \`\${origin}/partner/dashboard?token=\${token}\`;
    navigator.clipboard.writeText(magicUrl);
    setCopiedId(partnerId);
    setCopiedNotification(\`Magic link for \${partnerName} copied to clipboard!\`);
    setTimeout(() => setCopiedId(null), 2500);
    setTimeout(() => setCopiedNotification(null), 4000);
  };

  const handleSendEmail = async (partner: Partner) => {
    try {
      setSendingEmailId(partner._id);
      await api.partners.sendEmail(partner._id);
      setCopiedNotification(\`Magic link & promo code successfully emailed to \${partner.email}!\`);
      setTimeout(() => setCopiedNotification(null), 4000);
    } catch (err: any) {
      alert("Failed to send email: " + (err?.message || "Unknown error"));
    } finally {
      setSendingEmailId(null);
    }
  };

  const handleCopyFullBankInfo = (partner: Partner) => {
    if (!partner.bankDetails) return;
    const infoText = \`Partner: \${partner.name} (\${partner.email})\\nBank Name: \${partner.bankDetails.bankName || 'N/A'}\\nAccount Holder: \${partner.bankDetails.accountHolderName || 'N/A'}\\nRouting Number: \${partner.bankDetails.routingNumber || 'N/A'}\\nAccount Number: \${partner.bankDetails.accountNumber || 'N/A'}\`;
    navigator.clipboard.writeText(infoText);
    setCopiedBankInfo(true);
    setTimeout(() => setCopiedBankInfo(false), 2500);
  };

  const handleCreatePartner = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setSubmitting(true);

    try {
      await api.partners.create(formData);
      setIsModalOpen(false);
      setFormData({ name: "", email: "", promoCode: "", revenueSharePercentage: 50 });
      setCopiedNotification(\`Partner \${formData.name} created! Magic link emailed automatically.\`);
      setTimeout(() => setCopiedNotification(null), 4000);
      await fetchPartners();
    } catch (err: any) {
      setFormError(err?.response?.data?.message || err.message || "Failed to create partner");
    } finally {
      setSubmitting(false);
    }
  };

  const exportToCSV = () => {
    if (!partners.length) return;
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const headers = ["Name", "Email", "Promo Code", "Share %", "Referred Users", "Total Earnings ($)", "Bank Holder", "Bank Name", "Routing No", "Account No", "Magic Link"];
    const rows = partners.map(p => [
      \`"\${p.name}"\`,
      \`"\${p.email}"\`,
      \`"\${p.promoCode}"\`,
      \`\${p.revenueSharePercentage}%\`,
      p.totalReferredUsers || 0,
      (p.totalEarnings || 0).toFixed(2),
      \`"\${p.bankDetails?.accountHolderName || ''}"\`,
      \`"\${p.bankDetails?.bankName || ''}"\`,
      \`"\${p.bankDetails?.routingNumber || ''}"\`,
      \`"\${p.bankDetails?.accountNumber || ''}"\`,
      \`"\${origin}/partner/dashboard?token=\${p.accessToken}"\`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", \`culturecards_partners_\${new Date().toISOString().slice(0, 10)}.csv\`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredPartners = partners.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.promoCode.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalReferredUsersAll = partners.reduce((sum, p) => sum + (p.totalReferredUsers || 0), 0);
  const totalPartnerEarningsAll = partners.reduce((sum, p) => sum + (p.totalEarnings || 0), 0);
  const activeBankCount = partners.filter(p => p.bankDetails?.accountNumber).length;

  return (
    <div className="space-y-8 p-6 max-w-7xl mx-auto">
      {/* Toast Notification */}
      {copiedNotification && (
        <div className="fixed top-5 right-5 z-50 bg-emerald-600 text-white text-xs font-semibold px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-3">
          <Check size={16} />
          <span>{copiedNotification}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-white tracking-tight">Partner & Affiliate Management</h1>
            <span className="px-2.5 py-0.5 rounded-full bg-[#155DFC]/10 text-[#155DFC] text-xs font-semibold border border-[#155DFC]/20 flex items-center gap-1">
              <Sparkles size={12} /> 50/50 Revenue Engine
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Manage influencers, send magic portal links via email, copy bank payout details, and track promo codes.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchPartners}
            className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 transition-all border border-white/5"
            title="Refresh Partners"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
          <button
            onClick={exportToCSV}
            disabled={!partners.length}
            className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-zinc-200 text-xs font-semibold rounded-xl border border-white/10 transition-all disabled:opacity-40"
          >
            <Download size={15} />
            Export CSV
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#155DFC] hover:bg-[#155DFC]/90 text-white text-xs font-semibold rounded-xl transition-all shadow-lg shadow-[#155DFC]/25 hover:shadow-[#155DFC]/40"
          >
            <Plus size={16} />
            Add New Partner
          </button>
        </div>
      </div>

      {/* Metrics Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#111111] border border-white/5 p-5 rounded-2xl relative overflow-hidden group hover:border-[#155DFC]/30 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">Total Partners</span>
            <div className="w-9 h-9 rounded-xl bg-[#155DFC]/10 text-[#155DFC] flex items-center justify-center">
              <Handshake size={18} />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-white mt-2">{partners.length}</p>
          <span className="text-[11px] text-zinc-500 mt-1 block">Active affiliate managers</span>
        </div>

        <div className="bg-[#111111] border border-white/5 p-5 rounded-2xl relative overflow-hidden group hover:border-emerald-500/30 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">Referred Collectors</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <Users size={18} />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-white mt-2">{totalReferredUsersAll}</p>
          <span className="text-[11px] text-zinc-500 mt-1 block">Signed up with promo codes</span>
        </div>

        <div className="bg-[#111111] border border-white/5 p-5 rounded-2xl relative overflow-hidden group hover:border-purple-500/30 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">Total Partner Earnings</span>
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
              <DollarSign size={18} />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-white mt-2">\${totalPartnerEarningsAll.toFixed(2)}</p>
          <span className="text-[11px] text-zinc-500 mt-1 block">Accumulated 50% commission</span>
        </div>

        <div className="bg-[#111111] border border-white/5 p-5 rounded-2xl relative overflow-hidden group hover:border-amber-500/30 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">Bank Accounts Set Up</span>
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <Landmark size={18} />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-white mt-2">{activeBankCount} / {partners.length}</p>
          <span className="text-[11px] text-zinc-500 mt-1 block">Ready for automated payout</span>
        </div>
      </div>

      {/* Partner Table Section */}
      <div className="bg-[#111111] border border-white/5 rounded-2xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
            <input
              type="text"
              placeholder="Search partner by name, email, or promo code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#155DFC]"
            />
          </div>

          <div className="text-xs text-zinc-400 font-medium">
            Showing <span className="text-white font-bold">{filteredPartners.length}</span> of {partners.length} partners
          </div>
        </div>

        {loading ? (
          <div className="h-64 flex items-center justify-center text-zinc-500 text-sm">
            <RefreshCw size={20} className="animate-spin mr-2 text-[#155DFC]" /> Loading partners dataset...
          </div>
        ) : filteredPartners.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-zinc-500 text-sm border border-dashed border-white/5 rounded-xl space-y-2">
            <Handshake size={32} className="text-zinc-600 mb-1" />
            <p className="font-semibold text-zinc-300">No partners found</p>
            <p className="text-xs text-zinc-500">
              {searchQuery ? "Try resetting your search query filter." : "Click 'Add New Partner' to create your first partner."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 text-zinc-400 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Partner Info</th>
                  <th className="py-3 px-4">Promo Code</th>
                  <th className="py-3 px-4">Revenue Split</th>
                  <th className="py-3 px-4">Referred Users</th>
                  <th className="py-3 px-4">Total Earnings</th>
                  <th className="py-3 px-4">Bank Details</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredPartners.map((partner) => (
                  <tr key={partner._id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="py-4 px-4">
                      <div className="font-bold text-white text-sm">{partner.name}</div>
                      <div className="text-xs text-zinc-400">{partner.email}</div>
                    </td>
                    <td className="py-4 px-4">
                      <span className="inline-flex items-center px-3 py-1 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono font-bold text-xs">
                        {partner.promoCode}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-zinc-300 font-medium">
                      <span className="text-emerald-400 font-bold">{partner.revenueSharePercentage}% Partner</span>
                      <span className="text-zinc-500 text-[11px] block">{100 - partner.revenueSharePercentage}% Platform</span>
                    </td>
                    <td className="py-4 px-4 text-zinc-200 font-bold text-sm">
                      <div className="flex items-center gap-1.5">
                        <Users size={14} className="text-zinc-500" />
                        <span>{partner.totalReferredUsers || 0}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-emerald-400 font-extrabold text-sm">
                      \${(partner.totalEarnings || 0).toFixed(2)}
                    </td>
                    <td className="py-4 px-4 text-xs">
                      {partner.bankDetails?.accountNumber ? (
                        <button
                          onClick={() => setSelectedPartnerForBank(partner)}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 font-mono text-[11px] transition-all group/bank cursor-pointer"
                          title="Click to view & copy full bank details"
                        >
                          <Landmark size={12} />
                          <span>{partner.bankDetails.accountNumber}</span>
                          <Eye size={12} className="opacity-0 group-hover/bank:opacity-100 transition-opacity ml-1 text-emerald-300" />
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[11px]">
                          Pending Setup
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Send Email Button */}
                        <button
                          onClick={() => handleSendEmail(partner)}
                          disabled={sendingEmailId === partner._id}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600/10 hover:bg-purple-600/20 text-purple-300 border border-purple-500/20 text-xs font-semibold transition-all disabled:opacity-50"
                          title="Email Magic Link to Partner"
                        >
                          <Mail size={14} className={sendingEmailId === partner._id ? "animate-bounce" : ""} />
                          <span>{sendingEmailId === partner._id ? "Sending..." : "Send Email"}</span>
                        </button>

                        {/* Copy Link Button */}
                        <button
                          onClick={() => handleCopyLink(partner.accessToken, partner._id, partner.name)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-zinc-200 border border-white/10 transition-all hover:border-[#155DFC]/40"
                          title="Copy Standalone Magic Link"
                        >
                          {copiedId === partner._id ? (
                            <>
                              <Check size={14} className="text-emerald-400" />
                              <span className="text-emerald-400">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy size={14} className="text-zinc-400" />
                              <span>Copy Link</span>
                            </>
                          )}
                        </button>

                        {/* Open Portal Link */}
                        <a
                          href={\`/partner/dashboard?token=\${partner.accessToken}\`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white border border-white/10 transition-colors"
                          title="Open Standalone Partner Portal"
                        >
                          <ExternalLink size={15} />
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* View & Copy Bank Details Modal */}
      {selectedPartnerForBank && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#141414] border border-white/10 rounded-2xl w-full max-w-md p-6 space-y-5 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <h2 className="text-base font-extrabold text-white flex items-center gap-2">
                <Landmark size={18} className="text-emerald-400" />
                Bank Payout Details ({selectedPartnerForBank.name})
              </h2>
              <button
                onClick={() => setSelectedPartnerForBank(null)}
                className="text-zinc-400 hover:text-white transition-colors text-sm w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center"
              >
                <X size={16} />
              </button>
            </div>

            <div className="bg-black/50 border border-white/10 rounded-xl p-4 space-y-3 font-mono text-xs">
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-zinc-400">Account Holder:</span>
                <span className="text-white font-bold">{selectedPartnerForBank.bankDetails?.accountHolderName || 'N/A'}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-zinc-400">Bank Name:</span>
                <span className="text-white font-bold">{selectedPartnerForBank.bankDetails?.bankName || 'N/A'}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-zinc-400">US Routing Number:</span>
                <span className="text-emerald-400 font-bold">{selectedPartnerForBank.bankDetails?.routingNumber || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Account Number:</span>
                <span className="text-emerald-400 font-bold">{selectedPartnerForBank.bankDetails?.accountNumber || 'N/A'}</span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-2">
              <span className="text-[11px] text-zinc-500">🔒 Use these details for weekly payouts</span>
              <button
                onClick={() => handleCopyFullBankInfo(selectedPartnerForBank)}
                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition-all shadow-lg shadow-emerald-600/20"
              >
                {copiedBankInfo ? <Check size={14} /> : <Copy size={14} />}
                <span>{copiedBankInfo ? "Copied All Details!" : "Copy All Info"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Partner Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#141414] border border-white/10 rounded-2xl w-full max-w-md p-6 space-y-5 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Handshake size={20} className="text-[#155DFC]" />
                Add Partner Influencer
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-zinc-400 hover:text-white transition-colors text-sm w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center"
              >
                <X size={16} />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl flex items-center gap-2">
                <ShieldCheck size={16} />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreatePartner} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                  Partner Name (e.g. Boobie)
                </label>
                <input
                  type="text"
                  required
                  placeholder="Enter partner name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#155DFC]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                  Partner Email
                </label>
                <input
                  type="email"
                  required
                  placeholder="partner@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#155DFC]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                  Promo / Referral Code (e.g. OG)
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. OG"
                  value={formData.promoCode}
                  onChange={(e) => setFormData({ ...formData, promoCode: e.target.value.toUpperCase() })}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs font-mono uppercase text-white focus:outline-none focus:border-[#155DFC]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5 flex items-center justify-between">
                  <span>Partner Revenue Share Percentage</span>
                  <span className="text-[#155DFC] font-bold text-sm">{formData.revenueSharePercentage}% Partner / {100 - formData.revenueSharePercentage}% Platform</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={formData.revenueSharePercentage}
                  onChange={(e) => setFormData({ ...formData, revenueSharePercentage: Number(e.target.value) })}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#155DFC]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs text-zinc-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 bg-[#155DFC] hover:bg-[#155DFC]/90 text-white text-xs font-semibold rounded-xl transition-all disabled:opacity-50 shadow-lg shadow-[#155DFC]/20"
                >
                  {submitting ? "Sending Email..." : "Create & Send Magic Email"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
`;

fs.writeFileSync('D:/Mohosin/projects/dashboard/culture_dash/app/(dashboard)/partners/page.tsx', updatedPartnersPage, 'utf8');
console.log('Updated Partners Page with Copy Bank Info Modal and Send Email button!');
