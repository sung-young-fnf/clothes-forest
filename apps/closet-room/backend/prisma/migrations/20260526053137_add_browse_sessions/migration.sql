-- CreateTable
CREATE TABLE "browse_sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "host_session_id" TEXT NOT NULL,
    "host_nickname" TEXT,
    "started_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" DATETIME,
    "last_url" TEXT,
    "last_page_meta" TEXT
);

-- CreateTable
CREATE TABLE "page_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "browse_session_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT,
    "og_image_url" TEXT,
    "og_description" TEXT,
    "site_name" TEXT,
    "price_text" TEXT,
    "captured_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "page_events_browse_session_id_fkey" FOREIGN KEY ("browse_session_id") REFERENCES "browse_sessions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "browse_sessions_host_session_id_idx" ON "browse_sessions"("host_session_id");

-- CreateIndex
CREATE INDEX "browse_sessions_started_at_idx" ON "browse_sessions"("started_at");

-- CreateIndex
CREATE INDEX "page_events_browse_session_id_captured_at_idx" ON "page_events"("browse_session_id", "captured_at");
