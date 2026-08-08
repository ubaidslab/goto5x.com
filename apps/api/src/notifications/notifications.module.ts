import { Global, Module } from "@nestjs/common";
import { EmailService } from "./email.service";

/**
 * Global singleton for EmailService. Previously seven feature modules each
 * declared their own local (non-exported) EmailService provider, so Nest
 * instantiated seven independent instances; app.get(EmailService) (used by
 * e2e tests to spy on outbound email) resolves ambiguously across them,
 * and adding an eighth such module (Module 53's ReturnsModule) flipped
 * which instance won that resolution, breaking a Module 24 spy-based test
 * that had nothing to do with returns. One process-wide instance removes
 * the ambiguity for good.
 */
@Global()
@Module({
  providers: [EmailService],
  exports: [EmailService],
})
export class NotificationsModule {}
