import { Module } from "@nestjs/common";
import { MediaModule } from "../media/media.module";
import { InvoicePdfService } from "./invoice-pdf.service";

@Module({
  imports: [MediaModule],
  providers: [InvoicePdfService],
  exports: [InvoicePdfService],
})
export class InvoicesModule {}
