-- AlterTable
ALTER TABLE "User" ADD COLUMN     "difficulty" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "level" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "puzzleCount" INTEGER NOT NULL DEFAULT 0;
