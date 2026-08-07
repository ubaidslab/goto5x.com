import { Body, Controller, Param, Post, Req } from "@nestjs/common";
import { Request } from "express";
import { SubmitReviewDto } from "./dto/submit-review.dto";
import { ReviewsService } from "./reviews.service";

/** FR-14.1 - public, unauthenticated; same order-status token as FR-5.4, never an account. */
@Controller("storefront/order-status/:token/reviews")
export class ReviewSubmissionController {
  constructor(private readonly reviews: ReviewsService) {}

  @Post()
  submit(@Param("token") token: string, @Body() dto: SubmitReviewDto, @Req() req: Request) {
    return this.reviews.submit(token, dto, req.ip ?? "unknown");
  }
}
