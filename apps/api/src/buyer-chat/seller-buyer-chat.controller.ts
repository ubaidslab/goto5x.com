import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { CurrentSellerId } from "../common/decorators/current-seller.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { BuyerChatService } from "./buyer-chat.service";
import { PostMessageDto } from "./dto/post-message.dto";

/** FR-66.3 (Module 83) - the seller-facing inbox: list threads, view one, reply, close. */
@Controller("stores/:storeId/buyer-chat")
@UseGuards(JwtAuthGuard)
export class SellerBuyerChatController {
  constructor(private readonly buyerChat: BuyerChatService) {}

  @Get()
  list(@CurrentSellerId() sellerId: string, @Param("storeId") storeId: string) {
    return this.buyerChat.listThreadsForSeller(sellerId, storeId);
  }

  @Get(":threadId")
  get(@CurrentSellerId() sellerId: string, @Param("storeId") storeId: string, @Param("threadId") threadId: string) {
    return this.buyerChat.getThreadForSeller(sellerId, storeId, threadId);
  }

  @Post(":threadId/reply")
  reply(
    @CurrentSellerId() sellerId: string,
    @Param("storeId") storeId: string,
    @Param("threadId") threadId: string,
    @Body() dto: PostMessageDto,
  ) {
    return this.buyerChat.replyAsSeller(sellerId, storeId, threadId, dto);
  }

  @Patch(":threadId/close")
  close(@CurrentSellerId() sellerId: string, @Param("storeId") storeId: string, @Param("threadId") threadId: string) {
    return this.buyerChat.closeThread(sellerId, storeId, threadId);
  }
}
