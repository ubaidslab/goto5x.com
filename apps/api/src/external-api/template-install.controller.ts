import { Body, Controller, Headers, Post, RawBodyRequest, Req } from "@nestjs/common";
import { Request } from "express";
import { ExternalApiSignatureService } from "./external-api-signature.service";
import { TemplateInstallDto } from "./dto/template-install.dto";
import { TemplateRevokeDto } from "./dto/template-revoke.dto";
import { TemplateInstallService } from "./template-install.service";

/**
 * FR-24.3/24.6 - public, but never unauthenticated: every call is verified
 * against the Template Store's own signed-request secret (§6.5) before any
 * entitlement is granted or revoked. `dto` is used for validation/typing;
 * the signature is verified against `req.rawBody` (the exact bytes sent),
 * never the parsed-then-reserialized `dto`, since re-serializing JSON can
 * silently differ from what was actually signed.
 */
@Controller("external/template-store")
export class TemplateInstallController {
  constructor(
    private readonly signatures: ExternalApiSignatureService,
    private readonly templateInstall: TemplateInstallService,
  ) {}

  @Post("install")
  async install(
    @Body() dto: TemplateInstallDto,
    @Req() req: RawBodyRequest<Request>,
    @Headers("x-goto5x-client-type") clientType: string | undefined,
    @Headers("x-goto5x-timestamp") timestamp: string | undefined,
    @Headers("x-goto5x-signature") signature: string | undefined,
  ) {
    const { clientId } = await this.signatures.verify(clientType, timestamp, signature, req.rawBody?.toString("utf8") ?? "");
    return this.templateInstall.install(dto, clientId);
  }

  @Post("revoke")
  async revoke(
    @Body() dto: TemplateRevokeDto,
    @Req() req: RawBodyRequest<Request>,
    @Headers("x-goto5x-client-type") clientType: string | undefined,
    @Headers("x-goto5x-timestamp") timestamp: string | undefined,
    @Headers("x-goto5x-signature") signature: string | undefined,
  ) {
    await this.signatures.verify(clientType, timestamp, signature, req.rawBody?.toString("utf8") ?? "");
    return this.templateInstall.revoke(dto);
  }
}
