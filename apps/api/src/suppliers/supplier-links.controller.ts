import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { CurrentSellerId } from "../common/decorators/current-seller.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { InviteSupplierDto } from "./dto/create-store-supplier-link.dto";
import { SupplierLinksService } from "./supplier-links.service";

@Controller("stores/:storeId/supplier-links")
@UseGuards(JwtAuthGuard)
export class SupplierLinksController {
  constructor(private readonly supplierLinks: SupplierLinksService) {}

  @Post()
  invite(
    @CurrentSellerId() sellerId: string,
    @Param("storeId") storeId: string,
    @Body() dto: InviteSupplierDto,
  ) {
    return this.supplierLinks.invite(sellerId, storeId, dto);
  }

  @Get()
  list(@CurrentSellerId() sellerId: string, @Param("storeId") storeId: string) {
    return this.supplierLinks.list(sellerId, storeId);
  }

  @Patch(":linkId/approve")
  approve(
    @CurrentSellerId() sellerId: string,
    @Param("storeId") storeId: string,
    @Param("linkId") linkId: string,
  ) {
    return this.supplierLinks.approve(sellerId, storeId, linkId);
  }

  @Patch(":linkId/revoke")
  revoke(
    @CurrentSellerId() sellerId: string,
    @Param("storeId") storeId: string,
    @Param("linkId") linkId: string,
  ) {
    return this.supplierLinks.revoke(sellerId, storeId, linkId);
  }
}
