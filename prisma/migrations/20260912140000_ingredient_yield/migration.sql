-- AlterTable(歩留まり: 買った量のうち実際に使える割合)
ALTER TABLE "Ingredient" ADD COLUMN "yieldRate" DECIMAL(5,4) NOT NULL DEFAULT 1;
