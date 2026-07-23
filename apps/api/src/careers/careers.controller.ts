import { BadRequestException, Body, Controller, Get, Param, Post, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApplyJobDto } from "./dto/apply-job.dto";
import { JobApplicationService } from "./job-application.service";
import { JobPostingService } from "./job-posting.service";

// FR-33.8 - "a dedicated size/type limit for documents, same 'explicit
// limit, no silent truncation' discipline as every other upload path in
// this SRS (e.g. FR-9.2)." A CV is a document, not media - its own limit,
// separate from MediaUploadController's 25MB image/clip limit.
const MAX_CV_UPLOAD_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_CV_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

/** SRS §5.33 FR-33.8 - the public careers listing + application flow. No auth - candidates are not platform users. */
@Controller("careers")
export class CareersController {
  constructor(
    private readonly jobPostings: JobPostingService,
    private readonly applications: JobApplicationService,
  ) {}

  @Get()
  listOpen() {
    return this.jobPostings.listOpen();
  }

  @Post(":jobPostingId/apply")
  @UseInterceptors(FileInterceptor("cv", { limits: { fileSize: MAX_CV_UPLOAD_BYTES } }))
  async apply(
    @Param("jobPostingId") jobPostingId: string,
    @Body() dto: ApplyJobDto,
    @UploadedFile() cv: Express.Multer.File,
  ) {
    if (!cv) throw new BadRequestException('No file uploaded (expected multipart field "cv").');
    if (!ALLOWED_CV_MIME_TYPES.has(cv.mimetype)) {
      throw new BadRequestException("CV must be a PDF or Word document (.pdf, .doc, .docx).");
    }
    return this.applications.apply(
      jobPostingId,
      dto.applicantName,
      dto.applicantEmail,
      dto.applicantPhone,
      { buffer: cv.buffer, mimetype: cv.mimetype, originalname: cv.originalname },
    );
  }
}
