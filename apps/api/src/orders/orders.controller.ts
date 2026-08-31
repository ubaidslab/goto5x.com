import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
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
import { ChangeOrderStatusDto } from "./dto/change-order-status.dto";
import { CreateManualOrderDto } from "./dto/create-manual-order.dto";
import { EditOrderDto } from "./dto/edit-order.dto";
import { OrderListQueryDto } from "./dto/order-list-query.dto";
import { UpdateDeliveryTrackingSettingsDto } from "./dto/update-delivery-tracking-settings.dto";
import { UpdateOrderCostsDto } from "./dto/update-order-costs.dto";
import { UpdateOrderTagsDto } from "./dto/update-order-tags.dto";
import { UploadOrderTrackingDto } from "./dto/upload-order-tracking.dto";
import { UploadTrackingDto } from "./dto/upload-tracking.dto";
import { OrdersOverviewService } from "./orders-overview.service";
import { OrdersService } from "./orders.service";

/**
 * A staff session needs the `orders` scope to reach any route here (SRS
 * §5.52/FR-52.2). FR-52.8 (Module 97) - each route now declares its own
 * `read`/`write` requirement rather than one blanket class-level grant:
 * every GET is `read`, every mutating route is `write` (the decorator's
 * own default, so those are left unspecified below).
 */
@Controller("stores/:storeId/orders")
@UseGuards(JwtAuthGuard, StaffScopeGuard)
export class OrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly checkout: CheckoutService,
    private readonly overview: OrdersOverviewService,
  ) {}

  /** SRS §5.38/FR-38.1 - the Orders Command Center's bucketed counts. Registered before ":orderId" so it isn't shadowed by that param route. */
  @Get("overview")
  @RequireStaffScope("orders", "read")
  getOverview(@CurrentSellerId() sellerId: string, @Param("storeId") storeId: string) {
    return this.overview.getOverview(sellerId, storeId);
  }

  /** SRS §5.38/FR-38.8-38.9 - registered before ":orderId" for the same reason as "overview" above. */
  @Get("settings/delivery-tracking")
  @RequireStaffScope("orders", "read")
  getDeliveryTrackingSettings(@CurrentSellerId() sellerId: string, @Param("storeId") storeId: string) {
    return this.orders.getDeliveryTrackingSettings(sellerId, storeId);
  }

  @Patch("settings/delivery-tracking")
  @RequireStaffScope("orders")
  updateDeliveryTrackingSettings(
    @CurrentSellerId() sellerId: string,
    @Param("storeId") storeId: string,
    @Body() dto: UpdateDeliveryTrackingSettingsDto,
  ) {
    return this.orders.updateDeliveryTrackingSettings(sellerId, storeId, dto);
  }

  @Get()
  @RequireStaffScope("orders", "read")
  list(@CurrentSellerId() sellerId: string, @Param("storeId") storeId: string, @Query() query: OrderListQueryDto) {
    return this.orders.list(sellerId, storeId, query);
  }

  @Get(":orderId")
  @RequireStaffScope("orders", "read")
  getOne(@CurrentSellerId() sellerId: string, @Param("storeId") storeId: string, @Param("orderId") orderId: string) {
    return this.orders.getOne(sellerId, storeId, orderId);
  }

  /** FR-17.1 - dashboard-created order (phone/WhatsApp selling). */
  @Post()
  @RequireStaffScope("orders")
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
  @RequireStaffScope("orders")
  markAsPaid(@CurrentSellerId() sellerId: string, @Param("storeId") storeId: string, @Param("orderId") orderId: string) {
    return this.orders.markAsPaid(sellerId, storeId, orderId);
  }

  @Post(":orderId/notes")
  @RequireStaffScope("orders")
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
  @RequireStaffScope("orders")
  updateTags(
    @CurrentSellerId() sellerId: string,
    @Param("storeId") storeId: string,
    @Param("orderId") orderId: string,
    @Body() dto: UpdateOrderTagsDto,
  ) {
    return this.orders.updateTags(sellerId, storeId, orderId, dto.tags);
  }

  /**
   * SRS §5.59/FR-59.2/FR-59.5 - the bulk-status-change action's single-order
   * building block (the frontend fans a bulk change out into one call per
   * selected order). Only accepts `cancelled`/`disputed`/`completed` -
   * see ChangeOrderStatusDto's own doc comment.
   */
  @Patch(":orderId/status")
  @RequireStaffScope("orders")
  changeStatus(
    @CurrentSellerId() sellerId: string,
    @Param("storeId") storeId: string,
    @Param("orderId") orderId: string,
    @Body() dto: ChangeOrderStatusDto,
  ) {
    return this.orders.changeStatus(sellerId, storeId, orderId, dto);
  }

  @Patch(":orderId/costs")
  @RequireStaffScope("orders")
  updateCosts(
    @CurrentSellerId() sellerId: string,
    @Param("storeId") storeId: string,
    @Param("orderId") orderId: string,
    @Body() dto: UpdateOrderCostsDto,
  ) {
    return this.orders.updateCosts(sellerId, storeId, orderId, dto);
  }

  @Patch(":orderId")
  @RequireStaffScope("orders")
  edit(
    @CurrentSellerId() sellerId: string,
    @Param("storeId") storeId: string,
    @Param("orderId") orderId: string,
    @Body() dto: EditOrderDto,
  ) {
    return this.orders.editOrder(sellerId, storeId, orderId, dto);
  }

  /**
   * SRS §5.59/FR-59.3 (a)+(b) - the order-level tracking-entry path shared
   * by the orders-list inline quick-entry UI and the CSV tracking-import
   * worker: applies one courier/tracking pair to every not-yet-shipped item
   * on the order. Path (c), the existing per-item endpoint below, is
   * unchanged for a seller who needs different couriers per item.
   */
  @Post(":orderId/tracking")
  @RequireStaffScope("orders")
  uploadTrackingForOrder(
    @CurrentSellerId() sellerId: string,
    @CurrentUser() user: JwtAccessPayload,
    @Param("storeId") storeId: string,
    @Param("orderId") orderId: string,
    @Body() dto: UploadOrderTrackingDto,
  ) {
    return this.orders.uploadTrackingForOrder(sellerId, storeId, orderId, user.sub, dto);
  }

  @Post(":orderId/items/:itemId/tracking")
  @RequireStaffScope("orders")
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
  @RequireStaffScope("orders")
  markItemDelivered(
    @CurrentSellerId() sellerId: string,
    @Param("storeId") storeId: string,
    @Param("orderId") orderId: string,
    @Param("itemId") itemId: string,
  ) {
    return this.orders.markItemDelivered(sellerId, storeId, orderId, itemId);
  }
}
