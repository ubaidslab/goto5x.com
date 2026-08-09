import { Body, Controller, Post } from "@nestjs/common";
import { UnsubscribeNewsletterDto } from "./dto/unsubscribe-newsletter.dto";
import { PlatformNewsletterService } from "./platform-newsletter.service";

/** Public, unauthenticated - a seller clicking a newsletter's unsubscribe link never has a dashboard session open (FR-62.3). */
@Controller("newsletters")
export class NewsletterUnsubscribeController {
  constructor(private readonly newsletters: PlatformNewsletterService) {}

  @Post("unsubscribe")
  unsubscribe(@Body() dto: UnsubscribeNewsletterDto) {
    return this.newsletters.unsubscribe(dto.token);
  }
}
