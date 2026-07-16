import { BadRequestException, Body, Controller, Delete, Get, Inject, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { CurrentSellerId } from "../../common/decorators/current-seller.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { JwtAccessPayload } from "../../common/types";
import { DRIVE_CLIENT, IDriveClient } from "./drive-client.interface";
import { DriveConnectionsService } from "./drive-connections.service";
import { DriveImportService } from "./drive-import.service";
import { ImportDriveFilesDto } from "./dto/import-drive-files.dto";

interface DriveOAuthState {
  sellerId: string;
  userId: string;
}

@Controller("media/drive")
export class DriveController {
  constructor(
    private readonly connections: DriveConnectionsService,
    private readonly imports: DriveImportService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    @Inject(DRIVE_CLIENT) private readonly driveClient: IDriveClient,
  ) {}

  // Reads the seller's identity via the normal JwtAuthGuard here (this is
  // the "click connect" step, a regular authenticated API call) and encodes
  // it into a short-lived signed `state` param. /callback below cannot sit
  // behind JwtAuthGuard: it's Google's own server-to-browser redirect, so it
  // never carries this API's Authorization header - `state` is what proves
  // which seller this callback belongs to.
  @Get("connect")
  @UseGuards(JwtAuthGuard)
  connect(@CurrentSellerId() sellerId: string, @CurrentUser() user: JwtAccessPayload) {
    const state = this.jwt.sign({ sellerId, userId: user.sub } as DriveOAuthState, {
      secret: this.config.getOrThrow<string>("JWT_ACCESS_SECRET"),
      expiresIn: "10m",
    });
    return { authUrl: this.driveClient.getAuthUrl(state) };
  }

  @Get("callback")
  async callback(@Query("code") code: string, @Query("state") state: string) {
    if (!code || !state) throw new BadRequestException("Missing code or state.");
    let payload: DriveOAuthState;
    try {
      payload = this.jwt.verify(state, { secret: this.config.getOrThrow<string>("JWT_ACCESS_SECRET") });
    } catch {
      throw new BadRequestException("Invalid or expired OAuth state - restart the connect flow.");
    }
    const connection = await this.connections.connect(payload.sellerId, payload.userId, code);
    return { connected: true, connection };
  }

  @Get("connection")
  @UseGuards(JwtAuthGuard)
  status(@CurrentSellerId() sellerId: string) {
    return this.connections.getStatus(sellerId);
  }

  @Delete("connection")
  @UseGuards(JwtAuthGuard)
  revoke(@CurrentSellerId() sellerId: string, @CurrentUser() user: JwtAccessPayload) {
    return this.connections.revoke(sellerId, user.sub);
  }

  @Get("files")
  @UseGuards(JwtAuthGuard)
  listFiles(@CurrentSellerId() sellerId: string) {
    return this.imports.listImportableFiles(sellerId);
  }

  @Post("stores/:storeId/import")
  @UseGuards(JwtAuthGuard)
  import(
    @CurrentSellerId() sellerId: string,
    @Param("storeId") storeId: string,
    @Body() dto: ImportDriveFilesDto,
  ) {
    return this.imports.importFiles(sellerId, storeId, dto.fileIds);
  }
}
