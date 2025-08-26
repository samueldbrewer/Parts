-- CreateTable
CREATE TABLE "VoiceSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endTime" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "inputAudioTokens" INTEGER NOT NULL DEFAULT 0,
    "outputAudioTokens" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VoiceSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoiceConversation" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "VoiceConversation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VoiceSession_userId_idx" ON "VoiceSession"("userId");

-- CreateIndex
CREATE INDEX "VoiceSession_status_idx" ON "VoiceSession"("status");

-- CreateIndex
CREATE INDEX "VoiceSession_startTime_idx" ON "VoiceSession"("startTime");

-- CreateIndex
CREATE INDEX "VoiceConversation_sessionId_idx" ON "VoiceConversation"("sessionId");

-- CreateIndex
CREATE INDEX "VoiceConversation_timestamp_idx" ON "VoiceConversation"("timestamp");