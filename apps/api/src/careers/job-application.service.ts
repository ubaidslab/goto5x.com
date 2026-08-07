import { randomUUID } from "crypto";
import { Injectable, NotFoundException } from "@nestjs/common";
import { JobApplication, JobApplicationStatus } from "@prisma/client";
import { AuditLogService } from "../admin/audit-log.service";
import { ObjectStorageService } from "../media/object-storage.service";
import { PrismaAdminService } from "../prisma/prisma-admin.service";
import { RateLimitService } from "../common/rate-limit/rate-limit.service";
import { SettingsService } from "../settings-registry/settings.service";
import { JobPostingService } from "./job-posting.service";

export interface CvFile {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
}

/**
 * SRS §5.33 FR-33.8. Applicant data (contact details, CV) is never exposed
 * on any public endpoint - `listForPosting`/`withDisplayStatus` are only
 * ever called from `admin-careers.controller.ts` (behind `AdminAuthGuard`),
 * same access discipline as customer PII elsewhere in this SRS (§5.13).
 */
@Injectable()
export class JobApplicationService {
  constructor(
    private readonly prismaAdmin: PrismaAdminService,
    private readonly objectStorage: ObjectStorageService,
    private readonly settings: SettingsService,
    private readonly auditLog: AuditLogService,
    private readonly jobPostings: JobPostingService,
    private readonly rateLimit: RateLimitService,
  ) {}

  async apply(
    jobPostingId: string,
    applicantName: string,
    applicantEmail: string,
    applicantPhone: string | undefined,
    cv: CvFile,
    ip: string,
  ): Promise<JobApplication> {
    // Phase B pre-launch audit finding - public, unauthenticated; accepts a
    // 5MB file upload per call with no prior rate limit.
    const applyLimit = await this.settings.resolve<number>("careers.apply_rate_limit_per_hour");
    await this.rateLimit.enforcePerHour(`careers-apply-ip:${ip}`, applyLimit);

    await this.jobPostings.requireOpen(jobPostingId);

    const key = `careers/${jobPostingId}/${randomUUID()}-${cv.originalname}`;
    const cvUrl = await this.objectStorage.putObject(key, cv.buffer, cv.mimetype);

    return this.prismaAdmin.jobApplication.create({
      data: { jobPostingId, applicantName, applicantEmail, applicantPhone, cvUrl },
    });
  }

  /** Admin-only - the application pipeline for one posting. */
  async listForPosting(postingId: string): Promise<JobApplication[]> {
    return this.prismaAdmin.jobApplication.findMany({ where: { jobPostingId: postingId }, orderBy: { createdAt: "asc" } });
  }

  async updateStatus(adminUserId: string, applicationId: string, status: JobApplicationStatus): Promise<JobApplication> {
    const before = await this.prismaAdmin.jobApplication.findUnique({ where: { id: applicationId } });
    if (!before) throw new NotFoundException("Application not found.");

    const after = await this.prismaAdmin.jobApplication.update({ where: { id: applicationId }, data: { status } });
    await this.auditLog.record({
      adminUserId,
      action: "careers.application_status_changed",
      targetType: "job_application",
      targetId: applicationId,
      beforeValue: { status: before.status },
      afterValue: { status },
    });
    return after;
  }

  /** FR-33.8 - the current display label for a fixed status value, admin-editable data (never hard-coded English). */
  async stageLabel(status: JobApplicationStatus): Promise<string> {
    const labels = await this.settings.resolve<Record<string, string>>("careers.application_stage_labels");
    return labels[status] ?? status;
  }
}
