-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "eod" TEXT NOT NULL DEFAULT '',
    "nte" TEXT NOT NULL DEFAULT '',
    "dwhBudget" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "availableBudget" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "hardCommitment" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "softCommitment" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cashBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "deliveryLastMonth" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "durationYears" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ltoOfficer" TEXT NOT NULL DEFAULT '',
    "alternateLto" TEXT NOT NULL DEFAULT '',
    "operationModalities" TEXT NOT NULL DEFAULT '',
    "donors" TEXT NOT NULL DEFAULT '',
    "estimate2027" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "deliveryProgress" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "projectManager" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Meeting" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "projectSymbol" TEXT NOT NULL,
    "projectTitle" TEXT NOT NULL,
    "projectManager" TEXT NOT NULL DEFAULT '',
    "date" TEXT NOT NULL,
    "meetingType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "agenda" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "attendees" TEXT NOT NULL DEFAULT '',
    "attachments" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Meeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkPlan" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "projectSymbol" TEXT NOT NULL,
    "projectTitle" TEXT NOT NULL,
    "projectManager" TEXT NOT NULL DEFAULT '',
    "createdBy" TEXT NOT NULL DEFAULT '',
    "lastUpdated" TEXT NOT NULL,
    "tasks" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkPlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Project_symbol_key" ON "Project"("symbol");

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkPlan" ADD CONSTRAINT "WorkPlan_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
