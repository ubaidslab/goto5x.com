import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Req } from "@nestjs/common";
import { Request } from "express";
import { BuyerChatService } from "./buyer-chat.service";
import { PostMessageDto } from "./dto/post-message.dto";
import { StartChatDto } from "./dto/start-chat.dto";

/**
 * FR-66.3 (Module 83) - public/buyer-facing, no login required (guest
 * checkout's buyers can use chat too - see BuyerChatService's own note).
 * The returned `accessToken` is the buyer's only credential, same
 * precedent as Order.statusLookupToken.
 */
@Controller("storefront/chat")
export class BuyerChatController {
  constructor(private readonly buyerChat: BuyerChatService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  start(@Body() dto: StartChatDto, @Req() req: Request) {
    return this.buyerChat.startThread(dto, req.ip ?? "unknown");
  }

  @Get(":accessToken/messages")
  getMessages(@Param("accessToken") accessToken: string) {
    return this.buyerChat.getMessages(accessToken);
  }

  @Post(":accessToken/messages")
  @HttpCode(HttpStatus.OK)
  postMessage(@Param("accessToken") accessToken: string, @Body() dto: PostMessageDto) {
    return this.buyerChat.postBuyerMessage(accessToken, dto);
  }
}
