-- CreateTable
CREATE TABLE "Template" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "requestType" TEXT NOT NULL,
    "method" TEXT,
    "urlOrHost" TEXT NOT NULL,
    "port" INTEGER,
    "headersJson" TEXT,
    "bodyJson" TEXT,
    "payload" TEXT,
    "every" INTEGER NOT NULL DEFAULT 1,
    "unit" TEXT NOT NULL DEFAULT 'minutes',
    "matchersJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Device" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "requestType" TEXT NOT NULL,
    "method" TEXT,
    "urlOrHost" TEXT NOT NULL,
    "port" INTEGER,
    "headersJson" TEXT,
    "bodyJson" TEXT,
    "payload" TEXT,
    "every" INTEGER NOT NULL DEFAULT 1,
    "unit" TEXT NOT NULL DEFAULT 'minutes',
    "matchersJson" TEXT,
    "templateId" TEXT,
    "lastCheckedAt" DATETIME,
    "lastMessage" TEXT,
    "lastColor" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Device_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Log" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "deviceId" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ok" BOOLEAN NOT NULL,
    "message" TEXT NOT NULL,
    "color" TEXT,
    CONSTRAINT "Log_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Log_deviceId_timestamp_idx" ON "Log"("deviceId", "timestamp");
