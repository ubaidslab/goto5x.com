import { IsIn } from "class-validator";

/**
 * SRS §5.59/FR-59.2/FR-59.5 - the target statuses `OrdersService.changeStatus()`
 * accepts. `confirmed` (mark-as-paid), `shipped`/`delivered` (tracking-entry
 * paths / markItemDelivered()) are reached through their own existing
 * methods, never this one - see order-status-transitions.util.ts's doc
 * comment for why.
 */
export class ChangeOrderStatusDto {
  @IsIn(["cancelled", "disputed", "completed"])
  status!: "cancelled" | "disputed" | "completed";
}
