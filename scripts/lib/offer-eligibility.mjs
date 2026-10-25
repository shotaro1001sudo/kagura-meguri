// Shared publication status for reviewed catalog offers; empty reason means eligible.
const date = s => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0,10) === s;
export function offerEligibility(o,today) {
  if (!o || o.enabled !== true) return "disabled";
  if (o.revoked === true || o.approvalStatus === "revoked") return "revoked";
  if (o.approved !== true || typeof o.approvalReference !== "string" || !o.approvalReference.trim()) return "missing_approval";
  if (!date(today) || !date(o.verifiedAt) || !date(o.expiresAt) || o.verifiedAt > today) return "invalid_dates";
  if (o.expiresAt < today) return "expired";
  if (Date.parse(today)-Date.parse(o.verifiedAt)>90*864e5) return "stale_verification";
  if (typeof o.url !== "string" || !o.url.trim()) return "missing_url";
  return "";
}
