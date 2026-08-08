import { Body, Controller, Param, Post, Req } from "@nestjs/common";
import { Request } from "express";
import { SubmitReturnRequestDto } from "./dto/submit-return-request.dto";
import { ReturnsService } from "./returns.service";

/** FR-60.2 - public, unauthenticated; same order-status token as FR-5.4, never an account. */
@Controller("storefront/order-status/:token/returns")
export class ReturnSubmissionController {
  constructor(private readonly returns: ReturnsService) {}

  @Post()
  submit(@Param("token") token: string, @Body() dto: SubmitReturnRequestDto, @Req() req: Request) {
    return this.returns.submitRequest(token, dto, req.ip ?? "unknown");
  }
}
