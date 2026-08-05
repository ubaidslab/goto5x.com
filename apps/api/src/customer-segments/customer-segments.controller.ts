import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { CurrentSellerId } from "../common/decorators/current-seller.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CreateCustomerSegmentDto } from "./dto/create-customer-segment.dto";
import { PreviewCustomerSegmentDto } from "./dto/preview-customer-segment.dto";
import { UpdateCustomerSegmentDto } from "./dto/update-customer-segment.dto";
import { CustomerSegmentsService } from "./customer-segments.service";

@Controller("stores/:storeId/customer-segments")
@UseGuards(JwtAuthGuard)
export class CustomerSegmentsController {
  constructor(private readonly segments: CustomerSegmentsService) {}

  @Post()
  create(@CurrentSellerId() sellerId: string, @Param("storeId") storeId: string, @Body() dto: CreateCustomerSegmentDto) {
    return this.segments.create(sellerId, storeId, dto);
  }

  @Post("preview")
  preview(@CurrentSellerId() sellerId: string, @Param("storeId") storeId: string, @Body() dto: PreviewCustomerSegmentDto) {
    return this.segments.previewCount(sellerId, storeId, dto);
  }

  @Get()
  list(@CurrentSellerId() sellerId: string, @Param("storeId") storeId: string) {
    return this.segments.list(sellerId, storeId);
  }

  @Get(":segmentId")
  getOne(@CurrentSellerId() sellerId: string, @Param("storeId") storeId: string, @Param("segmentId") segmentId: string) {
    return this.segments.getOne(sellerId, storeId, segmentId);
  }

  @Patch(":segmentId")
  update(
    @CurrentSellerId() sellerId: string,
    @Param("storeId") storeId: string,
    @Param("segmentId") segmentId: string,
    @Body() dto: UpdateCustomerSegmentDto,
  ) {
    return this.segments.update(sellerId, storeId, segmentId, dto);
  }

  @Delete(":segmentId")
  remove(@CurrentSellerId() sellerId: string, @Param("storeId") storeId: string, @Param("segmentId") segmentId: string) {
    return this.segments.remove(sellerId, storeId, segmentId);
  }
}
