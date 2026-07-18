import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { CurrentSellerId } from "../common/decorators/current-seller.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { AttachMediaDto } from "./dto/attach-media.dto";
import { ReorderMediaDto } from "./dto/reorder-media.dto";
import { MediaAssetsService } from "./media-assets.service";

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25MB - generous for product photos/short clips, bounded so one upload can't exhaust a request

@Controller("stores/:storeId/media")
@UseGuards(JwtAuthGuard)
export class MediaUploadController {
  constructor(private readonly media: MediaAssetsService) {}

  @Post()
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  async upload(
    @CurrentSellerId() sellerId: string,
    @Param("storeId") storeId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body("productId") productId?: string,
  ) {
    if (!file) throw new BadRequestException("No file uploaded (expected multipart field \"file\").");
    return this.media.uploadDirect(
      sellerId,
      storeId,
      { buffer: file.buffer, mimetype: file.mimetype, originalname: file.originalname },
      productId || undefined,
    );
  }

  @Get()
  list(@CurrentSellerId() sellerId: string, @Param("storeId") storeId: string) {
    return this.media.list(sellerId, storeId);
  }

  // Registered before the generic ":mediaId" route below - Nest matches
  // overlapping patterns in registration order, and "reorder"/"primary"
  // would otherwise be swallowed as a literal :mediaId value.
  @Patch("reorder")
  reorder(
    @CurrentSellerId() sellerId: string,
    @Param("storeId") storeId: string,
    @Body() dto: ReorderMediaDto,
  ) {
    return this.media.reorder(sellerId, storeId, dto.productId, dto.mediaIds);
  }

  @Patch(":mediaId/primary")
  setPrimary(
    @CurrentSellerId() sellerId: string,
    @Param("storeId") storeId: string,
    @Param("mediaId") mediaId: string,
  ) {
    return this.media.setPrimary(sellerId, storeId, mediaId);
  }

  @Patch(":mediaId")
  attach(
    @CurrentSellerId() sellerId: string,
    @Param("storeId") storeId: string,
    @Param("mediaId") mediaId: string,
    @Body() dto: AttachMediaDto,
  ) {
    return this.media.attachToProduct(sellerId, storeId, mediaId, dto.productId ?? null);
  }

  @Delete(":mediaId")
  remove(@CurrentSellerId() sellerId: string, @Param("storeId") storeId: string, @Param("mediaId") mediaId: string) {
    return this.media.remove(sellerId, storeId, mediaId);
  }
}
