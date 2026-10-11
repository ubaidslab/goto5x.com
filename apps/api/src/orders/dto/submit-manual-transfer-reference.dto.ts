import { IsString, Matches, MaxLength, MinLength } from "class-validator";

/**
 * B3b (founder decision, 2026-10-11) - "text only, validated,
 * length-limited, escaped." A positive allowlist (letters in any script,
 * digits, spaces, and a short list of punctuation actually seen on bank/
 * mobile-wallet transaction references) rather than a denylist - rejects
 * `<>&"'` and other HTML/markup-special characters outright, since this
 * text is later shown in the seller dashboard, and already-built, unrelated
 * surfaces elsewhere in this codebase render buyer-submitted strings into
 * emails/PDFs/CSV exports where "the frontend escapes it" isn't a guarantee.
 */
const SAFE_TEXT_PATTERN = /^[\p{L}\p{N}\p{Zs}.,#/_-]*$/u;
const SAFE_TEXT_MESSAGE = "may only contain letters, numbers, spaces, and . , # / _ -";

export class SubmitManualTransferReferenceDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Matches(SAFE_TEXT_PATTERN, { message: `Reference ${SAFE_TEXT_MESSAGE}` })
  reference!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Matches(SAFE_TEXT_PATTERN, { message: `Sender name ${SAFE_TEXT_MESSAGE}` })
  senderName!: string;
}
