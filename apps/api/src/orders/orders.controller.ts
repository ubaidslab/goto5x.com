import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { OrderStatus } from "@prisma/client";
import { BlockDuringImpersonation } from "../common/decorators/block-during-impersonation.decorator";
import { CurrentSellerId } from "../common/decorators/current-seller.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequireStaffScope } from "../common/decorators/require-staff-scope.decorator";
import { ImpersonationWriteGuard } from "../common/guards/impersonation-write.guard";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { StaffScopeGuard } from "../common/guards/staff-scope.guard";
import { JwtAccessPayload } from "../common/types";
import { CheckoutService } from "./checkout.service";
import { AddOrderNoteDto } from "./dto/add-order-note.dto";
import { CreateManualOrderDto } from "./dto/create-manual-order.dto";
import { EditOrderDto } from "./dto/edit-order.dto";
import { UpdateOrderCostsDto } from "./dto/update-order-costs.dto";
import { UpdateOrderTagsDto } from "./dto/update-order-tags.dto";
import { UploadTrackingDto } from "./dto/upload-tracking.dto";
import { OrderBucket, OrdersOverviewService } from "./orders-overview.service";
import { OrdersService } from "./orders.service";

/** A staff session needs the `orders` scope to reach any route here (SRS §5.52/FR-52.2). */
@Controller("stores/:storeId/orders")
@UseGuards(JwtAuthGuard, StaffScopeGuard)
@RequireStaffScope("orders")
export class OrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly checkout: CheckoutService,
    private readonly overview: OrdersOverviewService,
  ) {}

  /** SRS §5.38/FR-38.1 - the Orders Command Center's bucketed counts. Registered before ":orderId" so it isn't shadowed by that param route. */
  @Get("overview")
  getOverview(@CurrentSellerId() sellerId: string, @Param("storeId") storeId: string) {
    return this.overview.getOverview(sellerId, storeId);
  }

  @Get()
  list(
    @CurrentSellerId() sellerId: string,
    @Param("storeId") storeId: string,
    @Query("status") status?: OrderStatus,
    @Query("bucket") bucket?: OrderBucket,
    @Query("tag") tag?: string,
  ) {
    return this.orders.list(sellerId, storeId, { status, bucket, tag });
  }

  @Get(":orderId")
  getOne(@CurrentSellerId() sellerId: string, @Param("storeId") storeId: string, @Param("orderId") orderId: string) {
    return this.orders.getOne(sellerId, storeId, orderId);
  }

  /** FR-17.1 - dashboard-created order (phone/WhatsApp selling). */
  @Post()
  createManual(
    @CurrentSellerId() sellerId: string,
    @Param("storeId") storeId: string,
    @Body() dto: CreateManualOrderDto,
  ) {
    return this.checkout.createManualOrder(sellerId, storeId, dto);
  }

  /**
   * FR-17.1 - the only v1.0 payment path for any order, storefront or
   * manual. Blocked during impersonation (v0.23) - support can view an
   * order, never confirm its payment on the seller's behalf.
   */
  @Post(":orderId/mark-as-paid")
  @UseGuards(ImpersonationWriteGuard)
  @BlockDuringImpersonation()
  markAsPaid(@CurrentSellerId() sellerId: string, @Param("storeId") storeId: string, @Param("orderId") orderId: string) {
    return this.orders.markAsPaid(sellerId, storeId, orderId);
  }

  @Post(":orderId/notes")
  addNote(
    @CurrentSellerId() sellerId: string,
    @CurrentUser() user: JwtAccessPayload,
    @Param("storeId") storeId: string,
    @Param("orderId") orderId: string,
    @Body() dto: AddOrderNoteDto,
  ) {
    return this.orders.addNote(sellerId, storeId, orderId, user.sub, dto.body);
  }

  @Patch(":orderId/tags")
  updateTags(
    @CurrentSellerId() sellerId: string,
    @Param("storeId") storeId: string,
    @Param("orderId") orderId: string,
    @Body() dto: UpdateOrderTagsDto,
  ) {
    return this.orders.updateTags(sellerId, storeId, orderId, dto.tags);
  }

  @Patch(":orderId/costs")
  updateCosts(
    @CurrentSellerId() sellerId: string,
    @Param("storeId") storeId: string,
    @Param("orderId") orderId: string,
    @Body() dto: UpdateOrderCostsDto,
  ) {
    return this.orders.updateCosts(sellerId, storeId, orderId, dto);
  }

  @Patch(":orderId")
  edit(
    @CurrentSellerId() sellerId: string,
    @Param("storeId") storeId: string,
    @Param("orderId") orderId: string,
    @Body() dto: EditOrderDto,
  ) {
    return this.orders.editOrder(sellerId, storeId, orderId, dto);
  }

  @Post(":orderId/items/:itemId/tracking")
  uploadTracking(
    @CurrentSellerId() sellerId: string,
    @CurrentUser() user: JwtAccessPayload,
    @Param("storeId") storeId: string,
    @Param("orderId") orderId: string,
    @Param("itemId") itemId: string,
    @Body() dto: UploadTrackingDto,
  ) {
    return this.orders.uploadTracking(sellerId, storeId, orderId, itemId, user.sub, dto);
  }

  @Post(":orderId/items/:itemId/deliver")
  markItemDelivered(
    @CurrentSellerId() sellerId: string,
    @Param("storeId") storeId: string,
    @Param("orderId") orderId: string,
    @Param("itemId") itemId: string,
  ) {
    return this.orders.markItemDelivered(sellerId, storeId, orderId, itemId);
  }
}
