CREATE TABLE IF NOT EXISTS work_download_counts (
  slug TEXT PRIMARY KEY NOT NULL,
  download_count INTEGER NOT NULL DEFAULT 0 CHECK(download_count >= 0),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
