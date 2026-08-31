import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { CurrentSellerId } from "../common/decorators/current-seller.decorator";
import { RequireStaffScope } from "../common/decorators/require-staff-scope.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { StaffScopeGuard } from "../common/guards/staff-scope.guard";
import { CreateDiscountCodeDto } from "./dto/create-discount-code.dto";
import { UpdateDiscountCodeDto } from "./dto/update-discount-code.dto";
import { DiscountCodesService } from "./discount-codes.service";

/** SRS §5.52/FR-52.2 - a staff session needs the `discounts` scope to reach any route here. */
@Controller("stores/:storeId/discount-codes")
@UseGuards(JwtAuthGuard, StaffScopeGuard)
export class DiscountCodesController {
  constructor(private readonly discountCodes: DiscountCodesService) {}

  @Post()
  @RequireStaffScope("discounts")
  create(@CurrentSellerId() sellerId: string, @Param("storeId") storeId: string, @Body() dto: CreateDiscountCodeDto) {
    return this.discountCodes.create(sellerId, storeId, dto);
  }

  @Get()
  @RequireStaffScope("discounts", "read")
  list(@CurrentSellerId() sellerId: string, @Param("storeId") storeId: string) {
    return this.discountCodes.list(sellerId, storeId);
  }

  @Get(":discountCodeId")
  @RequireStaffScope("discounts", "read")
  getOne(
    @CurrentSellerId() sellerId: string,
    @Param("storeId") storeId: string,
    @Param("discountCodeId") discountCodeId: string,
  ) {
    return this.discountCodes.getOne(sellerId, storeId, discountCodeId);
  }

  @Patch(":discountCodeId")
  @RequireStaffScope("discounts")
  update(
    @CurrentSellerId() sellerId: string,
    @Param("storeId") storeId: string,
    @Param("discountCodeId") discountCodeId: string,
    @Body() dto: UpdateDiscountCodeDto,
  ) {
    return this.discountCodes.update(sellerId, storeId, discountCodeId, dto);
  }

  @Delete(":discountCodeId")
  @RequireStaffScope("discounts")
  remove(
    @CurrentSellerId() sellerId: string,
    @Param("storeId") storeId: string,
    @Param("discountCodeId") discountCodeId: string,
  ) {
    return this.discountCodes.remove(sellerId, storeId, discountCodeId);
  }
}
