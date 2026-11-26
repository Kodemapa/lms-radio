-- No downloads of course content: the opt-in PDF download is removed.
ALTER TABLE "Lesson" DROP COLUMN "allowDownload";
