import { Body, Controller, Param, Post, Req, UseInterceptors } from "@nestjs/common";
import { Request } from "express";
import { IdempotencyInterceptor } from "../common/idempotency/idempotency.interceptor";
import { SubmitManualTransferReferenceDto } from "./dto/submit-manual-transfer-reference.dto";
import { OrdersService } from "./orders.service";

/** B3b (founder decision, 2026-10-11) - public, unauthenticated; same order-status token as FR-5.4, never an account. */
@Controller("storefront/order-status/:token/manual-transfer")
export class ManualTransferSubmissionController {
  constructor(private readonly orders: OrdersService) {}

  /** D116 item 1 (Stage 0) - a buyer re-submitting after a lost response must not be treated as a second submission. */
  @Post()
  @UseInterceptors(IdempotencyInterceptor)
  submitReference(@Param("token") token: string, @Body() dto: SubmitManualTransferReferenceDto, @Req() req: Request) {
    return this.orders.submitManualTransferReference(token, dto, req.ip ?? "unknown");
  }
}
