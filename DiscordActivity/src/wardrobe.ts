import type { CosmeticId } from '../shared/cosmetics';
import { CosmeticsService, type CosmeticInventoryItem, type CosmeticsSnapshot } from './cosmetics';
import { drawSnakePreview, getSnakeSkin } from './game/skins';

interface WardrobeOptions {
  dialog: HTMLDialogElement;
  service: CosmeticsService;
  onEquipped(id: CosmeticId): void;
  onOpenChange(open: boolean): void;
  showStatus(message: string): void;
}

export class Wardrobe {
  private readonly dialog: HTMLDialogElement;
  private readonly service: CosmeticsService;
  private readonly onEquipped: (id: CosmeticId) => void;
  private readonly onOpenChange: (open: boolean) => void;
  private readonly showStatus: (message: string) => void;
  private readonly grid: HTMLElement;
  private readonly preview: HTMLCanvasElement;
  private readonly name: HTMLElement;
  private readonly description: HTMLElement;
  private readonly badge: HTMLElement;
  private readonly actionButton: HTMLButtonElement;
  private readonly refreshButton: HTMLButtonElement;
  private readonly status: HTMLElement;
  private readonly cardButtons = new Map<CosmeticId, HTMLButtonElement>();
  private readonly unsubscribe: () => void;
  private selectedId: CosmeticId = 'classic';
  private lastEquippedId: CosmeticId = 'classic';
  private actionStatus: string | null = null;

  constructor(options: WardrobeOptions) {
    this.dialog = options.dialog;
    this.service = options.service;
    this.onEquipped = options.onEquipped;
    this.onOpenChange = options.onOpenChange;
    this.showStatus = options.showStatus;
    this.grid = requireDescendant(this.dialog, '[data-wardrobe-grid]');
    this.preview = requireCanvas(this.dialog, '[data-wardrobe-preview]');
    this.name = requireDescendant(this.dialog, '[data-wardrobe-name]');
    this.description = requireDescendant(this.dialog, '[data-wardrobe-description]');
    this.badge = requireDescendant(this.dialog, '[data-wardrobe-badge]');
    this.actionButton = requireButton(this.dialog, '[data-wardrobe-action]');
    this.refreshButton = requireButton(this.dialog, '[data-wardrobe-refresh]');
    this.status = requireDescendant(this.dialog, '[data-wardrobe-status]');

    this.createCards();
    requireButton(this.dialog, '[data-wardrobe-close]').addEventListener('click', () => this.close());
    this.actionButton.addEventListener('click', () => void this.handleAction());
    this.refreshButton.addEventListener('click', () => void this.handleRefresh());
    this.dialog.addEventListener('close', this.handleClose);
    this.dialog.addEventListener('cancel', this.handleCancel);
    this.unsubscribe = this.service.subscribe((snapshot) => this.render(snapshot));
  }

  open(): void {
    if (!this.dialog.open) {
      this.dialog.showModal();
    }
    this.onOpenChange(true);
    this.cardButtons.get(this.selectedId)?.focus({ preventScroll: true });
    void this.service.refresh().catch(() => undefined);
  }

  close(): void {
    if (this.dialog.open) {
      this.dialog.close();
    }
  }

  dispose(): void {
    this.unsubscribe();
    this.dialog.removeEventListener('close', this.handleClose);
    this.dialog.removeEventListener('cancel', this.handleCancel);
  }

  private createCards(): void {
    for (const item of this.service.snapshot.items) {
      const skin = getSnakeSkin(item.id);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'skin-card';
      button.dataset.skinId = item.id;
      button.style.setProperty('--skin-head', skin.palette.head);
      button.style.setProperty('--skin-body', skin.palette.body);
      button.style.setProperty('--skin-accent', skin.palette.accent);
      button.setAttribute('aria-pressed', String(item.id === this.selectedId));

      const swatch = document.createElement('span');
      swatch.className = 'skin-card-swatch';
      swatch.setAttribute('aria-hidden', 'true');
      const text = document.createElement('span');
      text.className = 'skin-card-copy';
      const title = document.createElement('strong');
      title.textContent = item.name;
      const meta = document.createElement('span');
      meta.dataset.skinMeta = '';
      text.append(title, meta);
      button.append(swatch, text);
      button.addEventListener('click', () => {
        this.selectedId = item.id;
        this.actionStatus = null;
        this.render(this.service.snapshot);
      });
      this.cardButtons.set(item.id, button);
      this.grid.append(button);
    }
  }

  private render(snapshot: CosmeticsSnapshot): void {
    const selected = snapshot.items.find((item) => item.id === this.selectedId) ?? snapshot.items[0]!;
    this.selectedId = selected.id;
    drawSnakePreview(this.preview, selected.id);
    this.name.textContent = selected.name;
    this.description.textContent = selected.description;
    this.badge.textContent = itemBadge(selected, snapshot);
    this.status.textContent = snapshot.error ?? this.actionStatus ?? storefrontStatus(snapshot);
    this.refreshButton.disabled = snapshot.status === 'loading'
      || snapshot.runtime === 'browser'
      || snapshot.pendingCosmeticId !== null;

    for (const item of snapshot.items) {
      const button = this.cardButtons.get(item.id);
      if (!button) {
        continue;
      }
      const selectedCard = item.id === this.selectedId;
      button.classList.toggle('selected', selectedCard);
      button.classList.toggle('owned', item.owned);
      button.classList.toggle('equipped', item.id === snapshot.equippedSkinId);
      button.setAttribute('aria-pressed', String(selectedCard));
      const meta = button.querySelector<HTMLElement>('[data-skin-meta]');
      if (meta) {
        meta.textContent = cardMeta(item, snapshot);
      }
    }

    const action = actionState(selected, snapshot);
    this.actionButton.textContent = action.label;
    this.actionButton.disabled = action.disabled;

    if (snapshot.equippedSkinId !== this.lastEquippedId) {
      this.lastEquippedId = snapshot.equippedSkinId;
      this.onEquipped(snapshot.equippedSkinId);
    }
  }

  private async handleAction(): Promise<void> {
    const snapshot = this.service.snapshot;
    const item = snapshot.items.find((candidate) => candidate.id === this.selectedId);
    if (!item) {
      return;
    }
    this.actionStatus = item.owned ? `Equipping ${item.name}...` : 'Opening Discord checkout...';
    this.render(this.service.snapshot);
    try {
      if (item.owned) {
        await this.service.equip(item.id);
        this.report(`${item.name} equipped.`);
      } else {
        await this.service.purchase(item.id);
        this.report(`${item.name} purchased and equipped.`);
      }
    } catch (error: unknown) {
      this.report(error instanceof Error ? error.message : 'The Wardrobe action failed.');
    } finally {
      this.cardButtons.get(item.id)?.focus({ preventScroll: true });
    }
  }

  private async handleRefresh(): Promise<void> {
    try {
      this.actionStatus = 'Checking Discord purchases...';
      this.render(this.service.snapshot);
      await this.service.refresh();
      this.report('Purchases refreshed.');
    } catch (error: unknown) {
      this.report(error instanceof Error ? error.message : 'Purchases could not be refreshed.');
    } finally {
      this.refreshButton.focus({ preventScroll: true });
    }
  }

  private report(message: string): void {
    this.actionStatus = message;
    this.status.textContent = message;
    this.showStatus(message);
  }

  private readonly handleClose = (): void => {
    this.onOpenChange(false);
  };

  private readonly handleCancel = (event: Event): void => {
    event.preventDefault();
    this.close();
  };
}

function actionState(
  item: CosmeticInventoryItem,
  snapshot: CosmeticsSnapshot,
): { label: string; disabled: boolean } {
  if (snapshot.pendingCosmeticId !== null) {
    return { label: 'WORKING...', disabled: true };
  }
  if (snapshot.status === 'loading') {
    return { label: 'VERIFYING...', disabled: true };
  }
  if (snapshot.status === 'error') {
    return { label: 'VERIFICATION UNAVAILABLE', disabled: true };
  }
  if (item.release === 'future') {
    return { label: 'COMING SOON', disabled: true };
  }
  if (item.owned) {
    return item.id === snapshot.equippedSkinId
      ? { label: 'EQUIPPED', disabled: true }
      : { label: 'EQUIP SKIN', disabled: false };
  }
  if (snapshot.runtime === 'browser') {
    return { label: 'AVAILABLE IN DISCORD', disabled: true };
  }
  if (!item.configured) {
    return { label: 'SKU NOT CONFIGURED', disabled: true };
  }
  if (!item.displayPrice) {
    return { label: 'STORE UNAVAILABLE', disabled: true };
  }
  return { label: `BUY ${item.displayPrice}`, disabled: false };
}

function itemBadge(item: CosmeticInventoryItem, snapshot: CosmeticsSnapshot): string {
  if (item.id === snapshot.equippedSkinId) {
    return 'EQUIPPED';
  }
  if (item.owned) {
    return 'OWNED';
  }
  if (item.release === 'future') {
    return 'SECOND DROP';
  }
  return item.displayPrice ?? 'DISCORD EXCLUSIVE';
}

function cardMeta(item: CosmeticInventoryItem, snapshot: CosmeticsSnapshot): string {
  if (item.id === snapshot.equippedSkinId) {
    return 'Equipped';
  }
  if (item.owned) {
    return 'Owned';
  }
  if (item.release === 'future') {
    return 'Coming soon';
  }
  return item.displayPrice ?? (snapshot.runtime === 'browser' ? 'Discord exclusive' : 'Not configured');
}

function storefrontStatus(snapshot: CosmeticsSnapshot): string {
  if (snapshot.status === 'loading') {
    return 'Checking your Discord inventory...';
  }
  if (snapshot.runtime === 'browser') {
    return 'Preview every skin here. Purchases and paid equipment are available inside Discord.';
  }
  return 'Purchases are permanent cosmetics and do not change gameplay.';
}

function requireDescendant(root: ParentNode, selector: string): HTMLElement {
  const element = root.querySelector(selector);
  if (!(element instanceof HTMLElement)) {
    throw new Error(`Missing Wardrobe element ${selector}.`);
  }
  return element;
}

function requireButton(root: ParentNode, selector: string): HTMLButtonElement {
  const element = root.querySelector(selector);
  if (!(element instanceof HTMLButtonElement)) {
    throw new Error(`Missing Wardrobe button ${selector}.`);
  }
  return element;
}

function requireCanvas(root: ParentNode, selector: string): HTMLCanvasElement {
  const element = root.querySelector(selector);
  if (!(element instanceof HTMLCanvasElement)) {
    throw new Error(`Missing Wardrobe canvas ${selector}.`);
  }
  return element;
}
