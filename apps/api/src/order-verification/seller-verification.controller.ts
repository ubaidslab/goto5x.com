import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { CurrentSellerId } from "../common/decorators/current-seller.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { JwtAccessPayload } from "../common/types";
import { ConnectVerificationEmailDto } from "./dto/connect-verification-email.dto";
import { UpdateVerificationSettingsDto } from "./dto/update-verification-settings.dto";
import { OrderVerificationService } from "./order-verification.service";
import { SellerVerificationEmailsService } from "./seller-verification-emails.service";

/** FR-37.3 - a seller's own connected SMTP senders for the Email OTP channel. */
@Controller("sellers/me/verification-emails")
@UseGuards(JwtAuthGuard)
export class SellerVerificationEmailsController {
  constructor(private readonly verificationEmails: SellerVerificationEmailsService) {}

  @Get()
  list(@CurrentSellerId() sellerId: string) {
    return this.verificationEmails.list(sellerId);
  }

  @Post()
  connect(@CurrentSellerId() sellerId: string, @Body() dto: ConnectVerificationEmailDto) {
    return this.verificationEmails.connect(sellerId, dto);
  }

  @Delete(":id")
  revoke(@CurrentSellerId() sellerId: string, @Param("id") id: string) {
    return this.verificationEmails.revoke(sellerId, id);
  }
}

/** FR-37.1/FR-37.6 - the seller's own store-level channel + message-template choice. */
@Controller("stores/:storeId/verification-settings")
@UseGuards(JwtAuthGuard)
export class StoreVerificationSettingsController {
  constructor(private readonly orderVerification: OrderVerificationService) {}

  @Get()
  get(@CurrentSellerId() sellerId: string, @Param("storeId") storeId: string) {
    return this.orderVerification.getSettingsForStore(sellerId, storeId);
  }

  @Patch()
  update(
    @CurrentSellerId() sellerId: string,
    @CurrentUser() user: JwtAccessPayload,
    @Param("storeId") storeId: string,
    @Body() dto: UpdateVerificationSettingsDto,
  ) {
    return this.orderVerification.updateSettingsForStore(sellerId, storeId, user.sub, dto);
  }
}

/** The seller's own view of an order's verification gate, plus its two seller-triggered actions. */
@Controller("stores/:storeId/orders/:orderId/verification")
@UseGuards(JwtAuthGuard)
export class SellerOrderVerificationController {
  constructor(private readonly orderVerification: OrderVerificationService) {}

  @Get()
  getStatus(@CurrentSellerId() sellerId: string, @Param("storeId") storeId: string, @Param("orderId") orderId: string) {
    return this.orderVerification.getStatusForSeller(sellerId, storeId, orderId);
  }

  /** FR-37.2 - re-issues the OTP and returns a fresh wa.me deep link (or resends the email) for the seller to act on. */
  @Post("resend")
  resend(@CurrentSellerId() sellerId: string, @Param("storeId") storeId: string, @Param("orderId") orderId: string) {
    return this.orderVerification.resendForSeller(sellerId, storeId, orderId);
  }

  @Post("mark-prepaid-received")
  markPrepaidReceived(
    @CurrentSellerId() sellerId: string,
    @Param("storeId") storeId: string,
    @Param("orderId") orderId: string,
  ) {
    return this.orderVerification.markPrepaidReceived(sellerId, storeId, orderId);
  }
}
