import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ReturnRequestStatus } from "@prisma/client";
import { CurrentSellerId } from "../common/decorators/current-seller.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CompleteReturnRequestDto } from "./dto/complete-return-request.dto";
import { DecideReturnRequestDto } from "./dto/decide-return-request.dto";
import { ReturnsService } from "./returns.service";

/** FR-60.3 - seller's own return queue, tenant-scoped exactly like every other dashboard surface. */
@Controller("stores/:storeId/returns")
@UseGuards(JwtAuthGuard)
export class ReturnsController {
  constructor(private readonly returns: ReturnsService) {}

  @Get()
  list(@CurrentSellerId() sellerId: string, @Param("storeId") storeId: string, @Query("status") status?: ReturnRequestStatus) {
    return this.returns.listForStore(sellerId, storeId, status);
  }

  @Patch(":returnId")
  decide(
    @CurrentSellerId() sellerId: string,
    @Param("storeId") storeId: string,
    @Param("returnId") returnId: string,
    @Body() dto: DecideReturnRequestDto,
  ) {
    return this.returns.sellerDecide(sellerId, storeId, returnId, dto);
  }

  @Post(":returnId/complete")
  complete(
    @CurrentSellerId() sellerId: string,
    @Param("storeId") storeId: string,
    @Param("returnId") returnId: string,
    @Body() dto: CompleteReturnRequestDto,
  ) {
    return this.returns.completeReturn(sellerId, storeId, returnId, dto);
  }
}
