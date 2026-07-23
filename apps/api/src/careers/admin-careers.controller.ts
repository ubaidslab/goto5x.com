import { Body, Controller, ForbiddenException, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { AdminAuthGuard } from "../common/guards/admin-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAccessPayload } from "../common/types";
import { CreateJobPostingDto } from "./dto/create-job-posting.dto";
import { UpdateApplicationStatusDto } from "./dto/update-application-status.dto";
import { UpdateJobPostingStatusDto } from "./dto/update-job-posting-status.dto";
import { JobApplicationService } from "./job-application.service";
import { JobPostingService } from "./job-posting.service";

/** SRS §5.33 FR-33.8 - admin management of postings + the application pipeline. Applicant data never appears on any public endpoint. */
@Controller("admin/careers")
@UseGuards(AdminAuthGuard)
export class AdminCareersController {
  constructor(
    private readonly jobPostings: JobPostingService,
    private readonly applications: JobApplicationService,
  ) {}

  @Post("postings")
  create(@CurrentUser() user: JwtAccessPayload, @Body() dto: CreateJobPostingDto) {
    this.assertAdminUserId(user);
    return this.jobPostings.create(user.adminUserId, dto.role, dto.description);
  }

  @Get("postings")
  listAll() {
    return this.jobPostings.listAll();
  }

  @Patch("postings/:postingId/status")
  updatePostingStatus(
    @CurrentUser() user: JwtAccessPayload,
    @Param("postingId") postingId: string,
    @Body() dto: UpdateJobPostingStatusDto,
  ) {
    this.assertAdminUserId(user);
    return this.jobPostings.updateStatus(user.adminUserId, postingId, dto.status);
  }

  @Get("postings/:postingId/applications")
  async listApplications(@Param("postingId") postingId: string) {
    const applications = await this.applications.listForPosting(postingId);
    return Promise.all(
      applications.map(async (application) => ({
        ...application,
        statusLabel: await this.applications.stageLabel(application.status),
      })),
    );
  }

  @Patch("applications/:applicationId/status")
  updateApplicationStatus(
    @CurrentUser() user: JwtAccessPayload,
    @Param("applicationId") applicationId: string,
    @Body() dto: UpdateApplicationStatusDto,
  ) {
    this.assertAdminUserId(user);
    return this.applications.updateStatus(user.adminUserId, applicationId, dto.status);
  }

  private assertAdminUserId(user: JwtAccessPayload): asserts user is JwtAccessPayload & { adminUserId: string } {
    if (!user.adminUserId) {
      throw new ForbiddenException("This endpoint requires an authenticated admin session.");
    }
  }
}
