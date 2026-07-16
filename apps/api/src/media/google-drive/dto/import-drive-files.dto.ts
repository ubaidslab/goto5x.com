import { IsArray, IsOptional, IsString } from "class-validator";

export class ImportDriveFilesDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  fileIds?: string[];
}
