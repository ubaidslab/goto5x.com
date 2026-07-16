import { Global, Module } from "@nestjs/common";
import { EventsService } from "./events.service";

/**
 * @Global() like PrismaModule/RedisModule - every module from here on emits
 * its own lifecycle events (SRS §3.11/FR-26.1) without needing to import
 * this module explicitly.
 */
@Global()
@Module({
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}
