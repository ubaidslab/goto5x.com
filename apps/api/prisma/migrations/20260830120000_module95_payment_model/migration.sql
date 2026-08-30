-- CreateEnum
CREATE TYPE "PaymentModel" AS ENUM ('prepaid', 'cod', 'advance');

-- AlterTable
ALTER TABLE "stores" ADD COLUMN     "payment_model" "PaymentModel" NOT NULL DEFAULT 'cod';

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "payment_model" "PaymentModel" NOT NULL DEFAULT 'cod';
