-- Data only. Hindi was removed from the site (English only), so the FAQ seeded by
-- 20261119120000_seed_faqs_and_legal_drafts ("Can I learn in Hindi?") becomes a short
-- FAQ about mobile learning. Changed only while it still has the exact seeded text, so a
-- FAQ an admin has edited is left as it is. Nothing is deleted: the Hindi-locale FAQs and
-- page drafts stay in the table, unused (the site and admin screens show English only).
UPDATE "Faq"
SET "question" = 'Can I learn on my phone?',
    "answer" = 'Yes. You can use the website on your phone, tablet or computer.',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "locale" = 'en'
  AND "question" = 'Can I learn in Hindi?'
  AND "answer" = 'Yes. The site is available in English and Hindi, and some courses are taught in Hindi. More languages are coming.';
