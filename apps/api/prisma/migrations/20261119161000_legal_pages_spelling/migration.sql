-- Data only. US spelling ("enrollment") in the English terms page, matching the rest of the site.
UPDATE "ContentPage" SET "body" = replace("body", 'while your enrolment is active', 'while your enrollment is active')
WHERE "slug" = 'terms' AND "locale" = 'en';
