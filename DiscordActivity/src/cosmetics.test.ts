import { describe, expect, it, vi } from 'vitest';
import { COSMETIC_PRODUCTS } from '../shared/cosmetics';
import { CosmeticsService, type DiscordCommerce } from './cosmetics';

const wrenboundSku = '123456789012345678';

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

function payload(owned: boolean, equippedSkinId = 'classic'): object {
  return {
    equippedSkinId,
    items: COSMETIC_PRODUCTS.map((product) => ({
      id: product.id,
      skuId: product.id === 'wrenbound' ? wrenboundSku : null,
      owned: product.id === 'classic' || (product.id === 'wrenbound' && owned),
    })),
  };
}

function fakeCommerce(): DiscordCommerce & {
  startPurchase: ReturnType<typeof vi.fn<(
    skuId: string,
  ) => Promise<'completed' | 'cancelled'>>>;
} {
  return {
    getSkus: vi.fn(async () => [{
      id: wrenboundSku,
      price: { amount: 99, currency: 'usd' },
    }]),
    startPurchase: vi.fn(async () => 'completed' as const),
    subscribeEntitlements: vi.fn(async () => undefined),
    unsubscribeEntitlements: vi.fn(async () => undefined),
  };
}

describe('CosmeticsService', () => {
  it('keeps ordinary browser play on the free Classic skin', async () => {
    const service = new CosmeticsService({ accessToken: null, commerce: null });
    await service.initialize();

    expect(service.snapshot.runtime).toBe('browser');
    expect(service.snapshot.equippedSkinId).toBe('classic');
    expect(service.snapshot.items.find((item) => item.id === 'classic')?.owned).toBe(true);
    expect(service.snapshot.items.find((item) => item.id === 'wrenbound')?.owned).toBe(false);
  });

  it('merges authoritative ownership with Discord-localized SKU pricing', async () => {
    const commerce = fakeCommerce();
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(payload(false)), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    const service = new CosmeticsService({ accessToken: 'token', commerce, fetcher });

    await service.initialize();

    const item = service.snapshot.items.find((candidate) => candidate.id === 'wrenbound');
    expect(item).toMatchObject({ configured: true, owned: false, skuId: wrenboundSku });
    expect(item?.displayPrice).toContain('0.99');
    expect(commerce.subscribeEntitlements).toHaveBeenCalledOnce();
  });

  it('calls the native fetch implementation with its global receiver', async () => {
    const originalFetch = globalThis.fetch;
    const receiverAwareFetch = vi.fn(function (
      this: typeof globalThis,
      _input: RequestInfo | URL,
      _init?: RequestInit,
    ): Promise<Response> {
      if (this !== globalThis) {
        throw new TypeError("Failed to execute 'fetch' on 'Window': Illegal invocation");
      }
      return Promise.resolve(new Response(JSON.stringify(payload(false)), { status: 200 }));
    });
    globalThis.fetch = receiverAwareFetch as typeof fetch;

    try {
      const service = new CosmeticsService({ accessToken: 'token', commerce: fakeCommerce() });
      await service.initialize();

      expect(service.snapshot.status).toBe('ready');
      expect(receiverAwareFetch).toHaveBeenCalledOnce();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('does not unlock from checkout alone and equips only after backend verification', async () => {
    const commerce = fakeCommerce();
    let getCount = 0;
    const fetcher = vi.fn<typeof fetch>(async (_input, init) => {
      if (init?.method === 'PUT') {
        return new Response(JSON.stringify(payload(true, 'wrenbound')), { status: 200 });
      }
      getCount += 1;
      return new Response(JSON.stringify(payload(getCount >= 3)), { status: 200 });
    });
    const service = new CosmeticsService({
      accessToken: 'token',
      commerce,
      fetcher,
      delay: async () => undefined,
    });
    await service.initialize();

    await service.purchase('wrenbound');

    expect(commerce.startPurchase).toHaveBeenCalledWith(wrenboundSku);
    expect(service.snapshot.equippedSkinId).toBe('wrenbound');
    expect(fetcher.mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(true);
  });

  it('stops immediately when Discord checkout is canceled', async () => {
    const commerce = fakeCommerce();
    commerce.startPurchase.mockResolvedValue('cancelled');
    const fetcher = vi.fn<typeof fetch>(async () => new Response(JSON.stringify(payload(false)), {
      status: 200,
    }));
    const service = new CosmeticsService({ accessToken: 'token', commerce, fetcher });
    await service.initialize();

    await expect(service.purchase('wrenbound')).rejects.toThrow('Purchase canceled');

    expect(commerce.startPurchase).toHaveBeenCalledOnce();
    expect(service.snapshot.equippedSkinId).toBe('classic');
  });

  it('does not open checkout when authoritative verification is unavailable', async () => {
    const commerce = fakeCommerce();
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify(payload(false)), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        error: 'Discord purchase verification is temporarily unavailable.',
      }), { status: 503 }));
    const service = new CosmeticsService({ accessToken: 'token', commerce, fetcher });
    await service.initialize();

    await expect(service.purchase('wrenbound')).rejects.toThrow('verification');

    expect(commerce.startPurchase).not.toHaveBeenCalled();
    expect(service.snapshot.status).toBe('error');
  });

  it('allows only one purchase or equip operation at a time', async () => {
    const pendingPut = deferred<Response>();
    const fetcher = vi.fn<typeof fetch>(async (_input, init) => {
      if (init?.method === 'PUT') {
        return pendingPut.promise;
      }
      return new Response(JSON.stringify(payload(true)), { status: 200 });
    });
    const service = new CosmeticsService({
      accessToken: 'token',
      commerce: fakeCommerce(),
      fetcher,
    });
    await service.initialize();

    const firstEquip = service.equip('wrenbound');

    expect(service.snapshot.pendingCosmeticId).toBe('wrenbound');
    await expect(service.equip('classic')).rejects.toThrow('already in progress');

    pendingPut.resolve(new Response(JSON.stringify(payload(true, 'wrenbound')), { status: 200 }));
    await firstEquip;

    expect(service.snapshot.pendingCosmeticId).toBeNull();
    expect(service.snapshot.equippedSkinId).toBe('wrenbound');
  });

  it('does not let a stale refresh overwrite a successful equip', async () => {
    const pendingPut = deferred<Response>();
    const staleGet = deferred<Response>();
    let getCount = 0;
    const fetcher = vi.fn<typeof fetch>(async (_input, init) => {
      if (init?.method === 'PUT') {
        return pendingPut.promise;
      }
      getCount += 1;
      if (getCount === 1) {
        return new Response(JSON.stringify(payload(true)), { status: 200 });
      }
      return staleGet.promise;
    });
    const service = new CosmeticsService({
      accessToken: 'token',
      commerce: fakeCommerce(),
      fetcher,
    });
    await service.initialize();

    const equip = service.equip('wrenbound');
    const refresh = service.refresh();
    pendingPut.resolve(new Response(JSON.stringify(payload(true, 'wrenbound')), { status: 200 }));
    await equip;
    staleGet.resolve(new Response(JSON.stringify(payload(true, 'classic')), { status: 200 }));
    await refresh;

    expect(service.snapshot.equippedSkinId).toBe('wrenbound');
    expect(service.snapshot.status).toBe('ready');
  });
});
