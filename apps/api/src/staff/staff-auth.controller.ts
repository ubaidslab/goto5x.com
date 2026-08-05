import { Controller, Ip, Post, Body } from "@nestjs/common";
import { StaffLoginDto } from "./dto/staff-login.dto";
import { StaffAuthService } from "./staff-auth.service";

/** Public, unauthenticated - a staff account's own login, separate from the owner's (SRS §5.52/FR-52.3). */
@Controller("staff/auth")
export class StaffAuthController {
  constructor(private readonly staffAuth: StaffAuthService) {}

  @Post("login")
  login(@Body() dto: StaffLoginDto, @Ip() ip: string) {
    return this.staffAuth.login(dto, ip);
  }
}
