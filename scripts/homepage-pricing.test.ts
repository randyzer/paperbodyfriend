import assert from 'node:assert/strict';

async function main() {
  const {
    ANONYMOUS_MAX_ROUND_TRIPS,
    FREE_MAX_ROUND_TRIPS,
    MEMBER_PRICE_LABEL,
    getTierDescription,
    getTierLabel,
    resolveAccessTier,
  } = await import('../src/lib/paid-access');

  assert.equal(
    resolveAccessTier({
      authenticated: false,
      billingStatus: null,
    }),
    'anonymous',
  );

  assert.equal(
    resolveAccessTier({
      authenticated: true,
      billingStatus: { active: false, currentPeriodEnd: null },
    }),
    'free',
  );

  assert.equal(
    resolveAccessTier({
      authenticated: true,
      billingStatus: { active: true, currentPeriodEnd: null },
    }),
    'paid',
  );

  assert.equal(getTierLabel('anonymous'), '游客试玩');
  assert.equal(getTierLabel('free'), '免费用户');
  assert.equal(getTierLabel('paid'), '会员用户');

  assert.match(
    getTierDescription('anonymous'),
    new RegExp(String(ANONYMOUS_MAX_ROUND_TRIPS)),
  );
  assert.match(
    getTierDescription('free'),
    new RegExp(String(FREE_MAX_ROUND_TRIPS)),
  );
  assert.equal(getTierDescription('paid').includes(MEMBER_PRICE_LABEL), true);

  console.log('homepage pricing test passed.');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
