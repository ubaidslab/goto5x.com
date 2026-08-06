import { Injectable, NestMiddleware, ServiceUnavailableException } from "@nestjs/common";
import { NextFunction, Request, Response } from "express";
import { SettingsService } from "../settings-registry/settings.service";

/**
 * SRS FR-8.7 - the global maintenance-mode kill-switch, checked in front of
 * every route. When enabled, only a request from an allowlisted IP passes
 * through - that includes the admin terminal itself (a non-allowlisted
 * admin is blocked too; the allowlist is the gate, not "being an admin").
 * `/health` is excluded - it's an infra liveness probe, not a buyer/seller/
 * admin surface, and blocking it would make orchestration think the whole
 * box is down whenever maintenance mode is on.
 */
@Injectable()
export class MaintenanceModeMiddleware implements NestMiddleware {
  constructor(private readonly settings: SettingsService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    // req.path/req.url are mount-relative under NestJS's forRoutes("*")
    // (always "/" here, regardless of the real request path) - originalUrl
    // is the one property that still holds the actual incoming path.
    const path = req.originalUrl.split("?")[0];
    if (path === "/health") return next();

    const enabled = await this.settings.resolve<boolean>("platform.maintenance_mode_enabled");
    if (!enabled) return next();

    const allowlist = await this.settings.resolve<string[]>("platform.maintenance_admin_ip_allowlist");
    if (allowlist.includes(req.ip ?? "")) return next();

    throw new ServiceUnavailableException("uzeyn.com is temporarily down for maintenance.");
  }
}
