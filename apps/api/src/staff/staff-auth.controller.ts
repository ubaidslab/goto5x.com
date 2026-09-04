import { Controller, HttpCode, Ip, Post, Body } from "@nestjs/common";
import { CompleteStaffPasswordResetDto } from "./dto/complete-staff-password-reset.dto";
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

  /** FR-52.15 - the only way a staff account's password can ever change other than at creation; reachable only via an admin-triggered emailed link. */
  @Post("password-reset/complete")
  @HttpCode(200)
  completePasswordReset(@Body() dto: CompleteStaffPasswordResetDto) {
    return this.staffAuth.completePasswordReset(dto);
  }
}
