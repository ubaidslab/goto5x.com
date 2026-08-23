import { forwardRef, Module } from "@nestjs/common";
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
  // AuthModule wrapped in forwardRef() - Module 70 (FR-6.47) added
  // BillingModule -> InvoicesModule -> MediaModule, closing a real cycle
  // back through AuthModule -> GrowthProgramsModule -> BillingModule that
  // didn't exist before (NestJS's scanner otherwise throws "imports array
  // is undefined" at this exact module, since AuthModule's own binding
  // isn't assigned yet mid-circular-load).
  imports: [JwtModule.register({}), forwardRef(() => AuthModule), PlansModule, SettingsModule], // for SecurityEventService (FR-9.1's connect/revoke audit trail) and JwtService (signed OAuth `state`)
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
