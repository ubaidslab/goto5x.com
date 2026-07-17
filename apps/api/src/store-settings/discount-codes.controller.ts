import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { CurrentSellerId } from "../common/decorators/current-seller.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CreateDiscountCodeDto } from "./dto/create-discount-code.dto";
import { UpdateDiscountCodeDto } from "./dto/update-discount-code.dto";
import { DiscountCodesService } from "./discount-codes.service";

@Controller("stores/:storeId/discount-codes")
@UseGuards(JwtAuthGuard)
export class DiscountCodesController {
  constructor(private readonly discountCodes: DiscountCodesService) {}

  @Post()
  create(@CurrentSellerId() sellerId: string, @Param("storeId") storeId: string, @Body() dto: CreateDiscountCodeDto) {
    return this.discountCodes.create(sellerId, storeId, dto);
  }

  @Get()
  list(@CurrentSellerId() sellerId: string, @Param("storeId") storeId: string) {
    return this.discountCodes.list(sellerId, storeId);
  }

  @Get(":discountCodeId")
  getOne(
    @CurrentSellerId() sellerId: string,
    @Param("storeId") storeId: string,
    @Param("discountCodeId") discountCodeId: string,
  ) {
    return this.discountCodes.getOne(sellerId, storeId, discountCodeId);
  }

  @Patch(":discountCodeId")
  update(
    @CurrentSellerId() sellerId: string,
    @Param("storeId") storeId: string,
    @Param("discountCodeId") discountCodeId: string,
    @Body() dto: UpdateDiscountCodeDto,
  ) {
    return this.discountCodes.update(sellerId, storeId, discountCodeId, dto);
  }

  @Delete(":discountCodeId")
  remove(
    @CurrentSellerId() sellerId: string,
    @Param("storeId") storeId: string,
    @Param("discountCodeId") discountCodeId: string,
  ) {
    return this.discountCodes.remove(sellerId, storeId, discountCodeId);
  }
}
