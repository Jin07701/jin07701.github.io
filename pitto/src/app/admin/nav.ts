/** §27 管理画面の区分。 */
export const ADMIN_NAV = [
  { href: "/admin", label: "概要" },
  { href: "/admin/owners", label: "オーナー" },
  { href: "/admin/locations", label: "駐輪場" },
  { href: "/admin/sessions", label: "利用" },
  { href: "/admin/incidents", label: "トラブル" },
] as const;

export const INCIDENT_TYPE_LABEL: Record<string, string> = {
  UNAUTHORIZED_PARKING: "無断駐輪",
  SPACE_ACTUALLY_FREE: "実際は空き",
  FORGOT_TO_END: "出庫忘れ",
  OTHER: "その他",
};

export const INCIDENT_STATUS_LABEL: Record<string, string> = {
  OPEN: "未対応",
  IN_REVIEW: "確認中",
  RESOLVED: "対応済み",
  REJECTED: "却下",
};

export const LOCATION_STATUS_LABEL: Record<string, string> = {
  DRAFT: "下書き",
  PENDING_REVIEW: "審査待ち",
  PUBLISHED: "公開中",
  SUSPENDED: "停止中",
};

export const OWNER_STATUS_LABEL: Record<string, string> = {
  PENDING_REVIEW: "審査待ち",
  APPROVED: "承認済み",
  SUSPENDED: "停止中",
};

export const SESSION_STATUS_LABEL: Record<string, string> = {
  PENDING: "開始処理中",
  ACTIVE: "利用中",
  PAYMENT_PENDING: "決済待ち",
  COMPLETED: "完了",
  FLAGGED: "要確認",
};

export function formatDateTime(value: Date): string {
  return value.toLocaleString("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tokyo",
  });
}
