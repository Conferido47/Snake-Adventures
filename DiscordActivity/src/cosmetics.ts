import { PriceUtils, type DiscordSDK } from '@discord/embedded-app-sdk';
import {
  COSMETIC_PRODUCTS,
  isCosmeticId,
  type CosmeticId,
  type CosmeticProduct,
} from '../shared/cosmetics';

interface DiscordSku {
  id: string;
  price: {
    amount: number;
    currency: string;
  };
}

export interface DiscordCommerce {
  getSkus(): Promise<DiscordSku[]>;
  startPurchase(skuId: string): Promise<'completed' | 'cancelled'>;
  subscribeEntitlements(listener: () => void): Promise<void>;
  unsubscribeEntitlements(listener: () => void): Promise<void>;
}

export type CosmeticInventoryItem = CosmeticProduct & {
  skuId: string | null;
  displayPrice: string | null;
  configured: boolean;
  owned: boolean;
};

export interface CosmeticsSnapshot {
  runtime: 'browser' | 'discord';
  status: 'idle' | 'loading' | 'ready' | 'error';
  equippedSkinId: CosmeticId;
  pendingCosmeticId: CosmeticId | null;
  items: readonly CosmeticInventoryItem[];
  error: string | null;
}

interface ServerCosmeticsPayload {
  equippedSkinId: CosmeticId;
  items: Array<{
    id: CosmeticId;
    skuId: string | null;
    owned: boolean;
  }>;
}

interface CosmeticsServiceOptions {
  accessToken: string | null;
  commerce: DiscordCommerce | null;
  fetcher?: typeof fetch;
  delay?: (milliseconds: number) => Promise<void>;
}

type CosmeticsListener = (snapshot: CosmeticsSnapshot) => void;

export class CosmeticsService {
  private readonly accessToken: string | null;
  private readonly commerce: DiscordCommerce | null;
  private readonly fetcher: typeof fetch;
  private readonly delay: (milliseconds: number) => Promise<void>;
  private readonly listeners = new Set<CosmeticsListener>();
  private skus: DiscordSku[] = [];
  private subscribed = false;
  private disposed = false;
  private refreshGeneration = 0;
  private mutationInProgress = false;
  private current: CosmeticsSnapshot;

  constructor(options: CosmeticsServiceOptions) {
    this.accessToken = options.accessToken;
    this.commerce = options.commerce;
    this.fetcher = options.fetcher ?? ((input, init) => globalThis.fetch(input, init));
    this.delay = options.delay ?? ((milliseconds) => new Promise((resolve) => {
      window.setTimeout(resolve, milliseconds);
    }));
    this.current = {
      runtime: this.accessToken ? 'discord' : 'browser',
      status: 'idle',
      equippedSkinId: 'classic',
      pendingCosmeticId: null,
      items: defaultInventory(),
      error: null,
    };
  }

  get snapshot(): CosmeticsSnapshot {
    return this.current;
  }

  subscribe(listener: CosmeticsListener): () => void {
    this.listeners.add(listener);
    listener(this.current);
    return () => this.listeners.delete(listener);
  }

  async initialize(): Promise<void> {
    if (this.commerce && !this.subscribed) {
      try {
        await this.commerce.subscribeEntitlements(this.handleEntitlementCreate);
        this.subscribed = true;
      } catch {
        // Purchase polling and manual refresh remain available if the event is unsupported.
      }
    }
    await this.refresh();
  }

  async refresh(): Promise<void> {
    const generation = ++this.refreshGeneration;
    if (!this.accessToken) {
      if (generation === this.refreshGeneration) {
        this.update({
          status: 'ready',
          equippedSkinId: 'classic',
          items: defaultInventory(),
          error: null,
        });
      }
      return;
    }

    this.update({ status: 'loading', error: null });
    try {
      const [response, skus] = await Promise.all([
        this.fetcher('/api/cosmetics', {
          headers: { Authorization: `Bearer ${this.accessToken}` },
        }),
        this.commerce?.getSkus().catch(() => []) ?? Promise.resolve([]),
      ]);
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(errorMessage(payload, 'The Wardrobe service is unavailable.'));
      }
      if (!isServerCosmeticsPayload(payload)) {
        throw new Error('The Wardrobe service returned an invalid response.');
      }

      if (generation === this.refreshGeneration) {
        this.skus = skus;
        this.applyPayload(payload);
      }
    } catch (error: unknown) {
      if (generation !== this.refreshGeneration) {
        return;
      }
      const message = error instanceof Error ? error.message : 'The Wardrobe service is unavailable.';
      this.update({ status: 'error', error: message });
      throw error;
    }
  }

  async equip(id: CosmeticId): Promise<void> {
    await this.runMutation(id, () => this.performEquip(id));
  }

  async purchase(id: CosmeticId): Promise<void> {
    await this.runMutation(id, async () => {
      await this.refresh();
      if (this.current.status !== 'ready') {
        throw new Error('Purchase verification must be available before checkout.');
      }
      const item = this.current.items.find((candidate) => candidate.id === id);
      if (item?.owned) {
        await this.performEquip(id);
        return;
      }
      if (!item || item.release !== 'launch' || !item.skuId || !item.displayPrice) {
        throw new Error('That skin is not available for purchase.');
      }
      if (!this.commerce || !this.accessToken) {
        throw new Error('Purchases are available inside the Discord Activity.');
      }

      const checkout = await this.commerce.startPurchase(item.skuId);
      if (checkout === 'cancelled') {
        throw new Error('Purchase canceled. You were not charged.');
      }
      let lastVerificationError: Error | null = null;
      for (const wait of [0, 500, 1_000, 2_000, 4_000]) {
        if (wait > 0) {
          await this.delay(wait);
        }
        try {
          await this.refresh();
          lastVerificationError = null;
        } catch (error: unknown) {
          lastVerificationError = error instanceof Error
            ? error
            : new Error('Purchase verification is unavailable.');
          continue;
        }
        if (this.current.items.find((candidate) => candidate.id === id)?.owned) {
          await this.performEquip(id);
          return;
        }
      }
      if (lastVerificationError) {
        throw new Error(
          'Checkout completed, but ownership could not be verified. Use Refresh Purchases shortly.',
        );
      }
      throw new Error('The purchase is still processing. Use Refresh Purchases in a moment.');
    });
  }

  dispose(): void {
    this.disposed = true;
    this.refreshGeneration += 1;
    this.listeners.clear();
    if (this.commerce && this.subscribed) {
      void this.commerce
        .unsubscribeEntitlements(this.handleEntitlementCreate)
        .catch(() => undefined);
    }
  }

  private async performEquip(id: CosmeticId): Promise<void> {
    if (!this.accessToken) {
      if (id !== 'classic') {
        throw new Error('Paid skins can be equipped inside the Discord Activity.');
      }
      this.update({ equippedSkinId: 'classic' });
      return;
    }

    ++this.refreshGeneration;
    const response = await this.fetcher('/api/cosmetics', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ cosmeticId: id }),
    });
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(errorMessage(payload, 'That skin could not be equipped.'));
    }
    if (!isServerCosmeticsPayload(payload)) {
      throw new Error('The Wardrobe service returned an invalid response.');
    }
    ++this.refreshGeneration;
    this.applyPayload(payload);
  }

  private async runMutation(id: CosmeticId, action: () => Promise<void>): Promise<void> {
    if (this.mutationInProgress) {
      throw new Error('Another Wardrobe action is already in progress.');
    }
    this.mutationInProgress = true;
    this.update({ pendingCosmeticId: id, error: null });
    try {
      await action();
    } finally {
      this.mutationInProgress = false;
      this.update({ pendingCosmeticId: null });
    }
  }

  private applyPayload(payload: ServerCosmeticsPayload): void {
    const serverById = new Map(payload.items.map((item) => [item.id, item]));
    const skuById = new Map(this.skus.map((sku) => [sku.id, sku]));
    const items = COSMETIC_PRODUCTS.map((product): CosmeticInventoryItem => {
      const server = serverById.get(product.id);
      const sku = server?.skuId ? skuById.get(server.skuId) : undefined;
      return {
        ...product,
        skuId: server?.skuId ?? null,
        displayPrice: sku ? PriceUtils.formatPrice(sku.price) : product.id === 'classic' ? 'FREE' : null,
        configured: product.id === 'classic' || Boolean(server?.skuId),
        owned: product.id === 'classic' || Boolean(server?.owned),
      };
    });
    this.update({
      status: 'ready',
      equippedSkinId: payload.equippedSkinId,
      items,
      error: null,
    });
  }

  private readonly handleEntitlementCreate = (): void => {
    void this.refresh().catch(() => undefined);
  };

  private update(changes: Partial<CosmeticsSnapshot>): void {
    if (this.disposed) {
      return;
    }
    this.current = { ...this.current, ...changes };
    for (const listener of this.listeners) {
      listener(this.current);
    }
  }
}

export function createDiscordCommerce(sdk: DiscordSDK | null): DiscordCommerce | null {
  if (!sdk) {
    return null;
  }
  return {
    async getSkus(): Promise<DiscordSku[]> {
      const { skus } = await sdk.commands.getSkus();
      return skus;
    },
    async startPurchase(skuId: string): Promise<'completed' | 'cancelled'> {
      const entitlements = await sdk.commands.startPurchase({ sku_id: skuId });
      return entitlements === null ? 'cancelled' : 'completed';
    },
    async subscribeEntitlements(listener: () => void): Promise<void> {
      await sdk.subscribe('ENTITLEMENT_CREATE', listener);
    },
    async unsubscribeEntitlements(listener: () => void): Promise<void> {
      await sdk.unsubscribe('ENTITLEMENT_CREATE', listener);
    },
  };
}

function defaultInventory(): CosmeticInventoryItem[] {
  return COSMETIC_PRODUCTS.map((product) => ({
    ...product,
    skuId: null,
    displayPrice: product.id === 'classic' ? 'FREE' : null,
    configured: product.id === 'classic',
    owned: product.id === 'classic',
  }));
}

function isServerCosmeticsPayload(value: unknown): value is ServerCosmeticsPayload {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('equippedSkinId' in value) ||
    !isCosmeticId(value.equippedSkinId) ||
    !('items' in value) ||
    !Array.isArray(value.items)
  ) {
    return false;
  }
  return value.items.every((item) => (
    typeof item === 'object' &&
    item !== null &&
    'id' in item &&
    isCosmeticId(item.id) &&
    'skuId' in item &&
    (typeof item.skuId === 'string' || item.skuId === null) &&
    'owned' in item &&
    typeof item.owned === 'boolean'
  ));
}

function errorMessage(value: unknown, fallback: string): string {
  return typeof value === 'object' &&
      value !== null &&
      'error' in value &&
      typeof value.error === 'string'
    ? value.error
    : fallback;
}
