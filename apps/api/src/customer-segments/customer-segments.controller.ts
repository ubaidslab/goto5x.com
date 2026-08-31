import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { CurrentSellerId } from "../common/decorators/current-seller.decorator";
import { RequireStaffScope } from "../common/decorators/require-staff-scope.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { StaffScopeGuard } from "../common/guards/staff-scope.guard";
import { CreateCustomerSegmentDto } from "./dto/create-customer-segment.dto";
import { PreviewCustomerSegmentDto } from "./dto/preview-customer-segment.dto";
import { UpdateCustomerSegmentDto } from "./dto/update-customer-segment.dto";
import { CustomerSegmentsService } from "./customer-segments.service";

/** SRS §5.52/FR-52.7-52.8 (Module 97) - a staff session needs the `marketing` scope. */
@Controller("stores/:storeId/customer-segments")
@UseGuards(JwtAuthGuard, StaffScopeGuard)
export class CustomerSegmentsController {
  constructor(private readonly segments: CustomerSegmentsService) {}

  @Post()
  @RequireStaffScope("marketing")
  create(@CurrentSellerId() sellerId: string, @Param("storeId") storeId: string, @Body() dto: CreateCustomerSegmentDto) {
    return this.segments.create(sellerId, storeId, dto);
  }

  /** A count-only computation, not a mutation - `read` is enough despite the POST verb. */
  @Post("preview")
  @RequireStaffScope("marketing", "read")
  preview(@CurrentSellerId() sellerId: string, @Param("storeId") storeId: string, @Body() dto: PreviewCustomerSegmentDto) {
    return this.segments.previewCount(sellerId, storeId, dto);
  }

  @Get()
  @RequireStaffScope("marketing", "read")
  list(@CurrentSellerId() sellerId: string, @Param("storeId") storeId: string) {
    return this.segments.list(sellerId, storeId);
  }

  @Get(":segmentId")
  @RequireStaffScope("marketing", "read")
  getOne(@CurrentSellerId() sellerId: string, @Param("storeId") storeId: string, @Param("segmentId") segmentId: string) {
    return this.segments.getOne(sellerId, storeId, segmentId);
  }

  @Patch(":segmentId")
  @RequireStaffScope("marketing")
  update(
    @CurrentSellerId() sellerId: string,
    @Param("storeId") storeId: string,
    @Param("segmentId") segmentId: string,
    @Body() dto: UpdateCustomerSegmentDto,
  ) {
    return this.segments.update(sellerId, storeId, segmentId, dto);
  }

  @Delete(":segmentId")
  @RequireStaffScope("marketing")
  remove(@CurrentSellerId() sellerId: string, @Param("storeId") storeId: string, @Param("segmentId") segmentId: string) {
    return this.segments.remove(sellerId, storeId, segmentId);
  }
}
