import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { JobPosting, JobPostingStatus } from "@prisma/client";
import { AuditLogService } from "../admin/audit-log.service";
import { PrismaAdminService } from "../prisma/prisma-admin.service";

/**
 * SRS §5.33 FR-33.8 - Careers. `JobPosting` is a new, minimal admin-editable
 * content type (role/description/status), reusing FR-12.1's "admin-managed,
 * data not a deploy" discipline without literally overloading the
 * ContentPage table (a job posting needs its own status/pipeline shape).
 */
@Injectable()
export class JobPostingService {
  constructor(
    private readonly prismaAdmin: PrismaAdminService,
    private readonly auditLog: AuditLogService,
  ) {}

  async create(adminUserId: string, role: string, description: string): Promise<JobPosting> {
    const posting = await this.prismaAdmin.jobPosting.create({ data: { role, description } });
    await this.auditLog.record({
      adminUserId,
      action: "careers.posting_created",
      targetType: "job_posting",
      targetId: posting.id,
      afterValue: { role, status: posting.status },
    });
    return posting;
  }

  /** Public listing - only `open` postings are ever shown (FR-33.8). */
  async listOpen(): Promise<JobPosting[]> {
    return this.prismaAdmin.jobPosting.findMany({ where: { status: "open" }, orderBy: { createdAt: "desc" } });
  }

  async listAll(): Promise<JobPosting[]> {
    return this.prismaAdmin.jobPosting.findMany({ orderBy: { createdAt: "desc" } });
  }

  async updateStatus(adminUserId: string, postingId: string, status: JobPostingStatus): Promise<JobPosting> {
    const before = await this.prismaAdmin.jobPosting.findUnique({ where: { id: postingId } });
    if (!before) throw new NotFoundException("Job posting not found.");

    const after = await this.prismaAdmin.jobPosting.update({ where: { id: postingId }, data: { status } });
    await this.auditLog.record({
      adminUserId,
      action: "careers.posting_status_changed",
      targetType: "job_posting",
      targetId: postingId,
      beforeValue: { status: before.status },
      afterValue: { status },
    });
    return after;
  }

  /** Guards the apply flow: only an `open` posting accepts applications. */
  async requireOpen(postingId: string): Promise<JobPosting> {
    const posting = await this.prismaAdmin.jobPosting.findUnique({ where: { id: postingId } });
    if (!posting) throw new NotFoundException("Job posting not found.");
    if (posting.status !== "open") throw new BadRequestException("This job posting is not currently accepting applications.");
    return posting;
  }
}
