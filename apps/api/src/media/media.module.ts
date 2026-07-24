import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AuthModule } from "../auth/auth.module";
import { PlansModule } from "../plans/plans.module";
import { SettingsModule } from "../settings-registry/settings.module";
import { DriveController } from "./google-drive/drive.controller";
import { DriveConnectionsService } from "./google-drive/drive-connections.service";
import { DriveImportService } from "./google-drive/drive-import.service";
import { DRIVE_CLIENT } from "./google-drive/drive-client.interface";
import { GoogleDriveClientService } from "./google-drive/google-drive-client.service";
import { MediaAssetsService } from "./media-assets.service";
import { MediaUploadController } from "./media-upload.controller";
import { ObjectStorageService } from "./object-storage.service";

@Module({
  imports: [JwtModule.register({}), AuthModule, PlansModule, SettingsModule], // for SecurityEventService (FR-9.1's connect/revoke audit trail) and JwtService (signed OAuth `state`)
  controllers: [MediaUploadController, DriveController],
  providers: [
    ObjectStorageService,
    MediaAssetsService,
    DriveConnectionsService,
    DriveImportService,
    { provide: DRIVE_CLIENT, useClass: GoogleDriveClientService },
  ],
  // DriveConnectionsService/DRIVE_CLIENT exported starting Module 24 (SRS
  // §5.36, FR-36.3) - DataExportModule needs both to check for an active
  // Drive connection and upload into the seller's dedicated export folder.
  exports: [MediaAssetsService, ObjectStorageService, DriveConnectionsService, DRIVE_CLIENT],
})
export class MediaModule {}
