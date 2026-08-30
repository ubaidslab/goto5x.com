import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentSellerId } from "../common/decorators/current-seller.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAccessPayload } from "../common/types";
import { CreateStoreDto } from "./dto/create-store.dto";
import { UpdatePaymentModelDto } from "./dto/update-payment-model.dto";
import { UpdateStoreDto } from "./dto/update-store.dto";
import { StoresService } from "./stores.service";

const MAX_LOGO_UPLOAD_BYTES = 5 * 1024 * 1024; // 5MB - generous for a logo image

@Controller("stores")
@UseGuards(JwtAuthGuard)
export class StoresController {
  constructor(private readonly stores: StoresService) {}

  @Post()
  create(@CurrentSellerId() sellerId: string, @Body() dto: CreateStoreDto) {
    return this.stores.create(sellerId, dto);
  }

  @Get()
  listOwn(@CurrentSellerId() sellerId: string) {
    return this.stores.listOwn(sellerId);
  }

  @Get(":id")
  getOwn(@CurrentSellerId() sellerId: string, @Param("id") id: string) {
    return this.stores.getOwn(sellerId, id);
  }

  @Patch(":id")
  updateOwn(@CurrentSellerId() sellerId: string, @Param("id") id: string, @Body() dto: UpdateStoreDto) {
    return this.stores.updateOwn(sellerId, id, dto);
  }

  /** FR-32.5 - reuses the media pipeline; see StoresService.setLogo(). */
  @Post(":id/logo")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_LOGO_UPLOAD_BYTES } }))
  setLogo(
    @CurrentSellerId() sellerId: string,
    @Param("id") id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No file uploaded (expected multipart field "file").');
    return this.stores.setLogo(sellerId, id, { buffer: file.buffer, mimetype: file.mimetype, originalname: file.originalname });
  }

  @Delete(":id/logo")
  removeLogo(@CurrentSellerId() sellerId: string, @Param("id") id: string) {
    return this.stores.removeLogo(sellerId, id);
  }

  /** Module 16 (FR-20.1) - the onboarding wizard's progress read. */
  @Get(":id/onboarding")
  getOnboarding(@CurrentSellerId() sellerId: string, @Param("id") id: string) {
    return this.stores.getOnboardingProgress(sellerId, id);
  }

  @Post(":id/onboarding/theme-ack")
  ackOnboardingTheme(@CurrentSellerId() sellerId: string, @Param("id") id: string) {
    return this.stores.ackOnboardingTheme(sellerId, id);
  }

  @Post(":id/onboarding/domain-ack")
  ackOnboardingDomain(@CurrentSellerId() sellerId: string, @Param("id") id: string) {
    return this.stores.ackOnboardingDomain(sellerId, id);
  }

  /** Module 95 (SRS §5.6l/FR-6.61-6.68) - the store-wide payment-model choice. */
  @Get(":id/payment-model")
  getPaymentModel(@CurrentSellerId() sellerId: string, @Param("id") id: string) {
    return this.stores.getPaymentModel(sellerId, id);
  }

  @Patch(":id/payment-model")
  updatePaymentModel(
    @CurrentSellerId() sellerId: string,
    @CurrentUser() user: JwtAccessPayload,
    @Param("id") id: string,
    @Body() dto: UpdatePaymentModelDto,
  ) {
    return this.stores.updatePaymentModel(sellerId, id, user.sub, dto);
  }
}
