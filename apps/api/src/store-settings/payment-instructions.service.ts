import { Injectable, NotFoundException } from "@nestjs/common";
import { TenantPrismaService } from "../prisma/tenant-prisma.service";
import { UpdatePaymentInstructionsDto } from "./dto/update-payment-instructions.dto";

/**
 * SRS FR-6.14. `store_payment_instructions` is auto-created (empty
 * defaults) the moment a store is created (StoresService.create()), so
 * every method here can assume the row exists - same discipline as
 * ShippingSettingsService/TaxSettingsService.
 */
@Injectable()
export class PaymentInstructionsService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  async getForStore(sellerId: string, storeId: string) {
    return this.tenantPrisma.run(sellerId, async (tx) => {
      const store = await tx.store.findUnique({ where: { id: storeId } });
      if (!store) throw new NotFoundException("Store not found.");
      return tx.storePaymentInstructions.findUniqueOrThrow({ where: { storeId } });
    });
  }

  async update(sellerId: string, storeId: string, dto: UpdatePaymentInstructionsDto) {
    return this.tenantPrisma.run(sellerId, async (tx) => {
      const store = await tx.store.findUnique({ where: { id: storeId } });
      if (!store) throw new NotFoundException("Store not found.");
      return tx.storePaymentInstructions.update({ where: { storeId }, data: dto });
    });
  }
}

export interface PaymentInstructionsLike {
  bankAccountTitle: string | null;
  bankAccountNumber: string | null;
  bankName: string | null;
  jazzcashNumber: string | null;
  easypaisaNumber: string | null;
  codEnabled: boolean;
}

/** Shared with CheckoutService (FR-6.14's store-readiness gate). */
export function hasAnyPaymentMethod(instructions: PaymentInstructionsLike): boolean {
  return Boolean(
    instructions.bankAccountNumber || instructions.jazzcashNumber || instructions.easypaisaNumber || instructions.codEnabled,
  );
}

/**
 * Every field here is already buyer-safe (a seller configures these
 * specifically to be shown to buyers, FR-6.14) - shared by the checkout
 * confirmation email and the buyer-facing order-status lookup so the two
 * never drift on wording.
 */
export function formatPaymentInstructions(instructions: PaymentInstructionsLike): string {
  const lines: string[] = [];
  if (instructions.bankAccountNumber) {
    lines.push(
      `Bank transfer: ${instructions.bankAccountTitle ?? ""} ${instructions.bankName ? `(${instructions.bankName})` : ""} - ${instructions.bankAccountNumber}`.trim(),
    );
  }
  if (instructions.jazzcashNumber) lines.push(`JazzCash: ${instructions.jazzcashNumber}`);
  if (instructions.easypaisaNumber) lines.push(`Easypaisa: ${instructions.easypaisaNumber}`);
  if (instructions.codEnabled) lines.push("Cash on Delivery is available.");
  return lines.join("\n");
}
