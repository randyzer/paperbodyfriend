export const ANONYMOUS_MAX_ROUND_TRIPS = 3;
export const FREE_MAX_ROUND_TRIPS = 7;
export const MEMBER_PRICE_LABEL = '$9.9/月';

export type AccessTier = 'anonymous' | 'free' | 'paid';

export type BillingStatusSnapshot = {
  active: boolean;
  currentPeriodEnd: string | null;
};

export function resolveAccessTier(input: {
  authenticated: boolean;
  billingStatus: BillingStatusSnapshot | null;
}): AccessTier {
  if (!input.authenticated) {
    return 'anonymous';
  }

  return input.billingStatus?.active ? 'paid' : 'free';
}

export function getTierLabel(tier: AccessTier) {
  switch (tier) {
    case 'paid':
      return '会员用户';
    case 'free':
      return '免费用户';
    default:
      return '游客试玩';
  }
}

export function getTierDescription(tier: AccessTier) {
  switch (tier) {
    case 'paid':
      return `无限次对话 · ${MEMBER_PRICE_LABEL}`;
    case 'free':
      return `每次游戏 ${FREE_MAX_ROUND_TRIPS} 轮，超出后需升级`;
    default:
      return `每次游戏 ${ANONYMOUS_MAX_ROUND_TRIPS} 轮，超出后需登录`;
  }
}

export function getTierBadgeClassName(tier: AccessTier) {
  switch (tier) {
    case 'paid':
      return 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100';
    case 'free':
      return 'bg-amber-100 text-amber-700 hover:bg-amber-100';
    default:
      return 'bg-slate-100 text-slate-700 hover:bg-slate-100';
  }
}
