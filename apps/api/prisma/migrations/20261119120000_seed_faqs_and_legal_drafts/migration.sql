-- Data only. FAQs: the questions the home page showed from the language files, so
-- admins can edit them under Admin -> FAQs. Added only when there are no FAQs yet.
INSERT INTO "Faq" ("id", "locale", "question", "answer", "position", "updatedAt")
SELECT v.id, v.locale, v.question, v.answer, v.position, CURRENT_TIMESTAMP
FROM (VALUES
    (gen_random_uuid(), 'en', 'Who are the courses for?', 'The learning experience is designed specifically for radiology postgraduates and residents studying fetal ultrasound. Check each course page for its level and prerequisites.', 1),
    (gen_random_uuid(), 'en', 'How are image cases graded?', 'Faculty draw the reference measurements on the image and set an allowed deviation. Your calipers and ellipses are recalculated from your own drawing and compared with that range, so you see a pass or a clear reason for each miss.', 2),
    (gen_random_uuid(), 'en', 'Are the scans from real patients?', 'Cases use real ultrasound images that are de-identified before learners see them: patient details are removed from the DICOM on our server. In line with the PC-PNDT Act, nothing on the platform reveals or teaches fetal sex.', 3),
    (gen_random_uuid(), 'en', 'Can I download videos?', 'No. To protect faculty content, videos stream only inside the website and our apps, with your details watermarked on screen.', 4),
    (gen_random_uuid(), 'en', 'Do I get a certificate?', 'Courses with certificates show it on the course page. You receive it after completing every lesson.', 5),
    (gen_random_uuid(), 'en', 'Can I learn in Hindi?', 'Yes. The site is available in English and Hindi, and some courses are taught in Hindi. More languages are coming.', 6),
    (gen_random_uuid(), 'hi', 'कोर्स किनके लिए हैं?', 'यह शिक्षण अनुभव भ्रूण अल्ट्रासाउंड सीखने वाले रेडियोलॉजी पीजी और रेज़िडेंट के लिए बनाया गया है। स्तर और आवश्यकताओं के लिए पाठ्यक्रम का पृष्ठ देखें।', 1),
    (gen_random_uuid(), 'hi', 'इमेज केस की ग्रेडिंग कैसे होती है?', 'फैकल्टी इमेज पर संदर्भ माप बनाती है और स्वीकृत विचलन तय करती है। आपके कैलिपर और एलिप्स आपकी अपनी ड्रॉइंग से दोबारा गणना करके उस सीमा से मिलाए जाते हैं, इसलिए आपको पास या हर चूक का स्पष्ट कारण दिखता है।', 2),
    (gen_random_uuid(), 'hi', 'क्या स्कैन असली रोगियों के हैं?', 'केस असली अल्ट्रासाउंड इमेज का उपयोग करते हैं जिनकी पहचान शिक्षार्थियों को दिखाने से पहले हटा दी जाती है: हमारे सर्वर पर DICOM से रोगी विवरण हटाए जाते हैं। PC-PNDT अधिनियम के अनुरूप, प्लेटफ़ॉर्म पर कुछ भी भ्रूण का लिंग नहीं बताता या सिखाता।', 3),
    (gen_random_uuid(), 'hi', 'क्या मैं वीडियो डाउनलोड कर सकता/सकती हूँ?', 'नहीं। फ़ैकल्टी की सामग्री की सुरक्षा के लिए वीडियो केवल वेबसाइट और हमारे ऐप में चलते हैं, स्क्रीन पर आपके विवरण के वॉटरमार्क के साथ।', 4),
    (gen_random_uuid(), 'hi', 'क्या मुझे प्रमाणपत्र मिलेगा?', 'जिन कोर्स में प्रमाणपत्र है, वह कोर्स पेज पर दिखता है। सभी पाठ पूरे करने के बाद आपको प्रमाणपत्र मिलता है।', 5),
    (gen_random_uuid(), 'hi', 'क्या मैं हिंदी में सीख सकता/सकती हूँ?', 'हाँ। साइट अंग्रेज़ी और हिंदी में उपलब्ध है, और कुछ कोर्स हिंदी में पढ़ाए जाते हैं। और भाषाएँ जल्द आ रही हैं।', 6)
) AS v(id, locale, question, answer, position)
WHERE NOT EXISTS (SELECT 1 FROM "Faq");

-- The footer links to these legal pages. Created as unpublished drafts (no legal text is
-- invented here); admins write, review and publish them under Admin -> Content pages.
INSERT INTO "ContentPage" ("id", "slug", "locale", "title", "body", "published", "updatedAt")
SELECT v.id, v.slug, v.locale, v.title, v.body, false, CURRENT_TIMESTAMP
FROM (VALUES
    (gen_random_uuid(), 'privacy', 'en', 'Privacy policy', 'Draft. This page has not been written yet: an administrator must add the text, have it reviewed, and publish it. Until then it is not shown on the site.'),
    (gen_random_uuid(), 'privacy', 'hi', 'गोपनीयता नीति', 'मसौदा। यह पेज अभी लिखा नहीं गया है: व्यवस्थापक पाठ जोड़कर, समीक्षा करवाकर इसे प्रकाशित करें। तब तक यह साइट पर नहीं दिखेगा।'),
    (gen_random_uuid(), 'terms', 'en', 'Terms & conditions', 'Draft. This page has not been written yet: an administrator must add the text, have it reviewed, and publish it. Until then it is not shown on the site.'),
    (gen_random_uuid(), 'terms', 'hi', 'नियम एवं शर्तें', 'मसौदा। यह पेज अभी लिखा नहीं गया है: व्यवस्थापक पाठ जोड़कर, समीक्षा करवाकर इसे प्रकाशित करें। तब तक यह साइट पर नहीं दिखेगा।'),
    (gen_random_uuid(), 'refund', 'en', 'Refund policy', 'Draft. This page has not been written yet: an administrator must add the text, have it reviewed, and publish it. Until then it is not shown on the site.'),
    (gen_random_uuid(), 'refund', 'hi', 'रिफ़ंड नीति', 'मसौदा। यह पेज अभी लिखा नहीं गया है: व्यवस्थापक पाठ जोड़कर, समीक्षा करवाकर इसे प्रकाशित करें। तब तक यह साइट पर नहीं दिखेगा।')
) AS v(id, slug, locale, title, body)
ON CONFLICT ("slug", "locale") DO NOTHING;
