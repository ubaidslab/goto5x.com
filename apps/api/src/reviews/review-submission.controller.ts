import { Body, Controller, Param, Post, Req, UploadedFiles, UseInterceptors } from "@nestjs/common";
import { FilesInterceptor } from "@nestjs/platform-express";
import { Request } from "express";
import { SubmitReviewDto } from "./dto/submit-review.dto";
import { ReviewsService } from "./reviews.service";

const MAX_REVIEW_MEDIA_FILES = 5;
const MAX_REVIEW_MEDIA_BYTES = 20 * 1024 * 1024; // 20MB - generous enough for a short video clip, same order of magnitude as MediaUploadController's 25MB product-media limit.

/** FR-14.1 - public, unauthenticated; same order-status token as FR-5.4, never an account. */
@Controller("storefront/order-status/:token/reviews")
export class ReviewSubmissionController {
  constructor(private readonly reviews: ReviewsService) {}

  @Post()
  submit(@Param("token") token: string, @Body() dto: SubmitReviewDto, @Req() req: Request) {
    return this.reviews.submit(token, dto, req.ip ?? "unknown");
  }

  /** Phase 4 close-out (FR-14.1) - a second step, right after submit(), so a photo/video is never required to leave a review at all. */
  @Post(":reviewId/media")
  @UseInterceptors(FilesInterceptor("media", MAX_REVIEW_MEDIA_FILES, { limits: { fileSize: MAX_REVIEW_MEDIA_BYTES } }))
  addMedia(
    @Param("token") token: string,
    @Param("reviewId") reviewId: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req: Request,
  ) {
    return this.reviews.addMedia(token, reviewId, files, req.ip ?? "unknown");
  }
}
