-- Data only. Fills the footer's legal pages (privacy, terms, refund) in English and
-- Hindi and publishes them. Only pages that still hold the placeholder draft text from
-- 20261119120000_seed_faqs_and_legal_drafts are changed: anything an administrator has
-- already written is left alone. Admins can edit these under Admin -> Content pages.

CREATE TEMP TABLE "_legal" ("slug" TEXT, "locale" TEXT, "title" TEXT, "body" TEXT);

INSERT INTO "_legal" ("slug", "locale", "title", "body") VALUES
('privacy', 'en', 'Privacy policy', $legal$Last updated: 19 November 2026

This policy explains what personal data GIFS e-LMS (Global Institute of Foetal Science) collects when you use our website and apps, why we collect it, and the choices you have. We process personal data in line with the Digital Personal Data Protection Act, 2023 (DPDP Act) and other applicable Indian law.

## Information we collect

- Account details: your name, mobile number, email address (optional), password (stored only as a secure hash) and preferred language.
- Professional details you choose to give us, such as learner type, qualifications, registration number, headline, biography and profile picture.
- Learning records: courses you enroll in, lessons you complete, quiz and assessment answers, assignment submissions, certificates and course reviews.
- Device and security information: device identifiers, browser type, sign-in times and IP address, used to keep your account secure and to enforce device limits.
- Messages you send us through the contact form.

## How we use your information

- To create and manage your account and let you sign in securely.
- To deliver courses, simulators, assessments and certificates, and to show your progress.
- To let instructors review your submissions and give feedback.
- To protect course content, including the watermark that shows your name or ID on protected videos and documents.
- To send service messages such as sign-in codes, review results and important account notices.
- To improve the platform and prevent misuse, fraud and unauthorised access.

## Clinical images and PC-PNDT

Ultrasound and other clinical images on the platform are de-identified before learners see them. Do not upload any image or document that identifies a patient. In line with the PC-PNDT Act, the platform never reveals or teaches fetal sex determination.

## Sharing your information

We do not sell your personal data. We share it only:

- with the instructors of courses you take, who can see your progress and submissions for those courses;
- with service providers who help us run the platform (hosting, storage, email and SMS delivery), under contracts that require them to protect it;
- when the law requires it, or to protect the rights and safety of our users and the public.

## Where your data is stored

Your data is stored on servers located in India.

## How long we keep it

We keep your data for as long as your account is active. When you delete your account, we erase your personal details. Anonymous course statistics may be kept so that course reports stay accurate. Some records may be kept longer where the law requires it.

## Your rights

Under the DPDP Act you can ask to access, correct or erase your personal data, withdraw consent, and nominate someone to exercise your rights. You can update your profile and delete your account from the Account section. For anything else, write to us through the Contact page.

## Security

We use encryption in transit, hashed passwords, short-lived signed links for protected media, device limits and access controls. No system is completely secure, so please keep your password private and sign out on shared devices.

## Children

The platform is meant for medical students, professionals and trainees aged 18 or over.

## Changes to this policy

We may update this policy from time to time. We will show the new date at the top of this page and, for important changes, notify you on the platform.

## Contact

For privacy questions or complaints, contact our Grievance Officer through the Contact page.$legal$),

('terms', 'en', 'Terms & conditions', $legal$Last updated: 19 November 2026

These terms govern your use of GIFS e-LMS, the e-learning platform of the Global Institute of Foetal Science, including its website, mobile and desktop apps, live classes and simulators. By creating an account or using the platform, you agree to these terms.

## Your account

- You must give accurate information and keep it up to date.
- Your account is for you alone. Do not share your password or sign-in codes.
- We may limit the number of devices signed in to one account.
- You are responsible for activity on your account. Tell us at once through the Contact page if you think someone else has used it.

## Use of course content

- Courses, videos, documents, images, simulators and assessments are licensed to you for your own personal, non-commercial learning while your enrolment is active.
- You must not download, record, screenshot, copy, share, resell or publish any course content, or try to get around the platform's content protection or watermarking.
- Protected content shows your name or ID as a watermark. Leaked content can be traced to the account it came from.

## Acceptable use

You agree not to:

- upload anything that identifies a patient, or any content you do not have the right to share;
- use the platform for, or ask about, fetal sex determination, which is prohibited under the PC-PNDT Act;
- post abusive, misleading or unlawful content in reviews, submissions or messages;
- interfere with the platform's security or operation, or access other users' accounts or data.

## Educational purpose only

The platform is for education and training. It is not a substitute for clinical judgement, supervision or the guidelines of your institution and regulator. Do not use course material to diagnose or treat patients without appropriate qualification and supervision.

## Instructors

Instructors are responsible for the accuracy of the content they publish and must have the rights to it. Courses are reviewed before they are published, and we may remove content that breaks these terms.

## Certificates

Certificates confirm that you completed a course on the platform. They do not by themselves grant any licence or registration to practise.

## Fees and payments

Some courses are free and some are paid. Prices are shown in Indian rupees and include applicable taxes unless stated otherwise. Refunds are covered by our Refund policy.

## Suspension and termination

We may suspend or close an account that breaks these terms, for example for sharing content or misusing the platform. You can delete your account at any time from the Account section.

## Limitation of liability

We work to keep the platform available and accurate, but it is provided "as is". To the extent the law allows, we are not liable for indirect or consequential losses arising from your use of the platform.

## Changes

We may update these terms. The date at the top of this page shows when they last changed. Continuing to use the platform after a change means you accept the updated terms.

## Governing law

These terms are governed by the laws of India, and the courts of India have jurisdiction over any dispute.

## Contact

Questions about these terms? Reach us through the Contact page.$legal$),

('refund', 'en', 'Refund policy', $legal$Last updated: 19 November 2026

This policy explains when you can get a refund for a paid course on GIFS e-LMS.

## Free courses

Free courses involve no payment, so there is nothing to refund.

## Paid courses

You can ask for a full refund within 7 days of purchase if you have completed less than 20% of the course and have not downloaded or been issued a certificate for it.

## When refunds are not available

- More than 7 days after purchase.
- When 20% or more of the course has been completed, or a certificate has been issued.
- When access was suspended because these terms or the Terms & conditions were broken, for example by sharing course content.
- For live classes or workshops that have already taken place.

## Course cancelled or changed

If we cancel a paid course, or remove a substantial part of it, before you finish it, you will get a full refund, or a credit towards another course if you prefer.

## How to ask for a refund

Write to us through the Contact page with your registered mobile number or email, the course name and the reason. We reply within 5 working days.

## How refunds are paid

Approved refunds go back to the original payment method within 7 to 10 working days. Your access to the course ends when the refund is processed.

## Contact

Questions about payments or refunds? Reach us through the Contact page.$legal$),

('privacy', 'hi', 'गोपनीयता नीति', $legal$अंतिम अपडेट: 19 नवंबर 2026

यह नीति बताती है कि GIFS e-LMS (ग्लोबल इंस्टीट्यूट ऑफ़ फ़ीटल साइंस) हमारी वेबसाइट और ऐप के उपयोग के दौरान कौन-सा व्यक्तिगत डेटा एकत्र करता है, क्यों करता है, और आपके पास क्या विकल्प हैं। हम डिजिटल व्यक्तिगत डेटा संरक्षण अधिनियम, 2023 (DPDP अधिनियम) और अन्य लागू भारतीय क़ानूनों के अनुसार डेटा संसाधित करते हैं।

## हम कौन-सी जानकारी एकत्र करते हैं

- खाते का विवरण: नाम, मोबाइल नंबर, ईमेल (वैकल्पिक), पासवर्ड (केवल सुरक्षित हैश के रूप में) और पसंदीदा भाषा।
- आपके द्वारा दी गई पेशेवर जानकारी, जैसे शिक्षार्थी प्रकार, योग्यताएँ, पंजीकरण संख्या, परिचय और प्रोफ़ाइल फ़ोटो।
- सीखने का रिकॉर्ड: नामांकित कोर्स, पूरे किए गए पाठ, क्विज़ और मूल्यांकन के उत्तर, असाइनमेंट, प्रमाणपत्र और समीक्षाएँ।
- डिवाइस और सुरक्षा जानकारी: डिवाइस पहचान, ब्राउज़र, साइन-इन समय और IP पता।
- संपर्क फ़ॉर्म से भेजे गए संदेश।

## हम आपकी जानकारी का उपयोग कैसे करते हैं

- आपका खाता बनाने और सुरक्षित साइन-इन के लिए।
- कोर्स, सिम्युलेटर, मूल्यांकन और प्रमाणपत्र देने और आपकी प्रगति दिखाने के लिए।
- प्रशिक्षकों को आपके असाइनमेंट की समीक्षा और फ़ीडबैक देने देने के लिए।
- कोर्स सामग्री की सुरक्षा के लिए, जिसमें सुरक्षित वीडियो पर आपके नाम या आईडी का वॉटरमार्क शामिल है।
- साइन-इन कोड, समीक्षा परिणाम और खाते से जुड़ी ज़रूरी सूचनाएँ भेजने के लिए।
- प्लेटफ़ॉर्म को बेहतर बनाने और दुरुपयोग रोकने के लिए।

## क्लिनिकल इमेज और PC-PNDT

प्लेटफ़ॉर्म पर अल्ट्रासाउंड और अन्य क्लिनिकल इमेज शिक्षार्थियों को दिखाने से पहले पहचान-रहित की जाती हैं। ऐसी कोई इमेज या दस्तावेज़ अपलोड न करें जिससे किसी रोगी की पहचान हो। PC-PNDT अधिनियम के अनुरूप, प्लेटफ़ॉर्म कभी भी भ्रूण का लिंग नहीं बताता या सिखाता।

## जानकारी साझा करना

हम आपका व्यक्तिगत डेटा नहीं बेचते। हम इसे केवल इनके साथ साझा करते हैं:

- आपके कोर्स के प्रशिक्षक, जो उन कोर्स में आपकी प्रगति और असाइनमेंट देख सकते हैं;
- सेवा प्रदाता (होस्टिंग, स्टोरेज, ईमेल और SMS), जो अनुबंध के तहत इसकी सुरक्षा के लिए बाध्य हैं;
- जब क़ानून इसकी माँग करे।

## डेटा कहाँ रखा जाता है

आपका डेटा भारत में स्थित सर्वरों पर रखा जाता है।

## हम डेटा कब तक रखते हैं

जब तक आपका खाता सक्रिय है। खाता हटाने पर आपका व्यक्तिगत विवरण मिटा दिया जाता है; केवल अनाम कोर्स आँकड़े रह सकते हैं। क़ानून की आवश्यकता होने पर कुछ रिकॉर्ड लंबे समय तक रखे जा सकते हैं।

## आपके अधिकार

DPDP अधिनियम के तहत आप अपने डेटा तक पहुँच, सुधार या मिटाने का अनुरोध कर सकते हैं, सहमति वापस ले सकते हैं, और किसी को नामित कर सकते हैं। प्रोफ़ाइल अपडेट और खाता हटाना "खाता" अनुभाग में उपलब्ध है। अन्य अनुरोधों के लिए संपर्क पेज से लिखें।

## सुरक्षा

हम एन्क्रिप्शन, हैश किए गए पासवर्ड, सुरक्षित मीडिया के लिए अल्पकालिक लिंक, डिवाइस सीमा और पहुँच नियंत्रण का उपयोग करते हैं। अपना पासवर्ड गोपनीय रखें और साझा डिवाइस पर साइन आउट करें।

## बच्चे

यह प्लेटफ़ॉर्म 18 वर्ष या उससे अधिक आयु के चिकित्सा छात्रों, पेशेवरों और प्रशिक्षुओं के लिए है।

## इस नीति में बदलाव

हम समय-समय पर यह नीति अपडेट कर सकते हैं। नई तारीख इस पेज के शीर्ष पर दिखेगी।

## संपर्क

गोपनीयता से जुड़े प्रश्नों या शिकायतों के लिए संपर्क पेज के माध्यम से हमारे शिकायत अधिकारी से संपर्क करें।$legal$),

('terms', 'hi', 'नियम एवं शर्तें', $legal$अंतिम अपडेट: 19 नवंबर 2026

ये शर्तें ग्लोबल इंस्टीट्यूट ऑफ़ फ़ीटल साइंस के ई-लर्निंग प्लेटफ़ॉर्म GIFS e-LMS (वेबसाइट, मोबाइल और डेस्कटॉप ऐप, लाइव कक्षाएँ और सिम्युलेटर) के उपयोग पर लागू होती हैं। खाता बनाकर या प्लेटफ़ॉर्म का उपयोग करके आप इन शर्तों से सहमत होते हैं।

## आपका खाता

- सही जानकारी दें और उसे अद्यतन रखें।
- खाता केवल आपके लिए है। अपना पासवर्ड या साइन-इन कोड साझा न करें।
- एक खाते पर साइन-इन डिवाइस की संख्या सीमित हो सकती है।
- खाते की गतिविधि के लिए आप ज़िम्मेदार हैं। दुरुपयोग का संदेह हो तो तुरंत संपर्क पेज से बताएँ।

## कोर्स सामग्री का उपयोग

- कोर्स, वीडियो, दस्तावेज़, इमेज, सिम्युलेटर और मूल्यांकन केवल आपके निजी, गैर-व्यावसायिक अध्ययन के लिए हैं।
- किसी भी सामग्री को डाउनलोड, रिकॉर्ड, स्क्रीनशॉट, कॉपी, साझा या प्रकाशित न करें, और सामग्री सुरक्षा या वॉटरमार्क को दरकिनार करने का प्रयास न करें।
- सुरक्षित सामग्री पर आपका नाम या आईडी वॉटरमार्क के रूप में दिखता है, जिससे लीक हुई सामग्री का स्रोत पता चल सकता है।

## स्वीकार्य उपयोग

आप सहमत हैं कि आप:

- रोगी की पहचान वाली या बिना अधिकार की कोई सामग्री अपलोड नहीं करेंगे;
- भ्रूण लिंग निर्धारण के लिए प्लेटफ़ॉर्म का उपयोग नहीं करेंगे, जो PC-PNDT अधिनियम के तहत प्रतिबंधित है;
- समीक्षाओं, असाइनमेंट या संदेशों में अपमानजनक, भ्रामक या ग़ैरक़ानूनी सामग्री नहीं डालेंगे;
- प्लेटफ़ॉर्म की सुरक्षा में हस्तक्षेप या अन्य उपयोगकर्ताओं के डेटा तक पहुँच का प्रयास नहीं करेंगे।

## केवल शैक्षिक उद्देश्य

यह प्लेटफ़ॉर्म शिक्षा और प्रशिक्षण के लिए है। यह क्लिनिकल निर्णय, पर्यवेक्षण या आपके संस्थान और नियामक के दिशानिर्देशों का विकल्प नहीं है।

## प्रशिक्षक

प्रशिक्षक अपनी प्रकाशित सामग्री की सटीकता और उसके अधिकारों के लिए ज़िम्मेदार हैं। प्रकाशन से पहले कोर्स की समीक्षा होती है, और शर्तों का उल्लंघन करने वाली सामग्री हटाई जा सकती है।

## प्रमाणपत्र

प्रमाणपत्र यह पुष्टि करता है कि आपने प्लेटफ़ॉर्म पर कोर्स पूरा किया है। यह अपने आप में प्रैक्टिस का कोई लाइसेंस या पंजीकरण नहीं देता।

## शुल्क और भुगतान

कुछ कोर्स निःशुल्क और कुछ सशुल्क हैं। कीमतें भारतीय रुपये में हैं और जब तक अलग से न बताया जाए, लागू कर शामिल हैं। रिफ़ंड हमारी रिफ़ंड नीति के अनुसार होते हैं।

## निलंबन और समाप्ति

शर्तों का उल्लंघन करने वाले खाते (जैसे सामग्री साझा करना) निलंबित या बंद किए जा सकते हैं। आप "खाता" अनुभाग से कभी भी अपना खाता हटा सकते हैं।

## दायित्व की सीमा

हम प्लेटफ़ॉर्म को उपलब्ध और सटीक रखने का प्रयास करते हैं, पर यह "जैसा है" के आधार पर दिया जाता है। क़ानून की अनुमति की सीमा तक हम अप्रत्यक्ष या परिणामी हानि के लिए उत्तरदायी नहीं हैं।

## बदलाव

हम ये शर्तें अपडेट कर सकते हैं। पेज के शीर्ष पर दी गई तारीख अंतिम बदलाव दिखाती है।

## लागू क़ानून

ये शर्तें भारत के क़ानूनों द्वारा शासित हैं और किसी भी विवाद पर भारत के न्यायालयों का अधिकार क्षेत्र होगा।

## संपर्क

इन शर्तों के बारे में प्रश्न हों तो संपर्क पेज से हमसे जुड़ें।$legal$),

('refund', 'hi', 'रिफ़ंड नीति', $legal$अंतिम अपडेट: 19 नवंबर 2026

यह नीति बताती है कि GIFS e-LMS पर सशुल्क कोर्स के लिए आपको रिफ़ंड कब मिल सकता है।

## निःशुल्क कोर्स

निःशुल्क कोर्स में कोई भुगतान नहीं होता, इसलिए रिफ़ंड लागू नहीं है।

## सशुल्क कोर्स

यदि आपने कोर्स का 20% से कम पूरा किया है और प्रमाणपत्र जारी नहीं हुआ है, तो ख़रीद के 7 दिनों के भीतर पूरा रिफ़ंड माँगा जा सकता है।

## जब रिफ़ंड उपलब्ध नहीं है

- ख़रीद के 7 दिन बाद।
- जब कोर्स का 20% या अधिक पूरा हो चुका हो, या प्रमाणपत्र जारी हो चुका हो।
- जब नियम एवं शर्तों के उल्लंघन (जैसे सामग्री साझा करना) के कारण पहुँच निलंबित की गई हो।
- पहले ही हो चुकी लाइव कक्षाओं या कार्यशालाओं के लिए।

## कोर्स रद्द या बदला गया

यदि हम कोई सशुल्क कोर्स रद्द करते हैं या उसका बड़ा हिस्सा हटाते हैं, तो आपको पूरा रिफ़ंड मिलेगा, या आप चाहें तो किसी अन्य कोर्स के लिए क्रेडिट।

## रिफ़ंड का अनुरोध कैसे करें

संपर्क पेज से अपना पंजीकृत मोबाइल नंबर या ईमेल, कोर्स का नाम और कारण लिखकर भेजें। हम 5 कार्य दिवसों में उत्तर देते हैं।

## रिफ़ंड का भुगतान

स्वीकृत रिफ़ंड 7 से 10 कार्य दिवसों में मूल भुगतान माध्यम में लौटाया जाता है। रिफ़ंड होने पर कोर्स की पहुँच समाप्त हो जाती है।

## संपर्क

भुगतान या रिफ़ंड से जुड़े प्रश्नों के लिए संपर्क पेज से हमसे जुड़ें।$legal$);

-- Add any page that doesn't exist yet (e.g. a database created before the drafts migration).
INSERT INTO "ContentPage" ("id", "slug", "locale", "title", "body", "published", "updatedAt")
SELECT gen_random_uuid(), l."slug", l."locale", l."title", l."body", true, CURRENT_TIMESTAMP
FROM "_legal" l
ON CONFLICT ("slug", "locale") DO NOTHING;

-- Replace only the untouched placeholder drafts.
UPDATE "ContentPage" p
SET "title" = l."title", "body" = l."body", "published" = true, "updatedAt" = CURRENT_TIMESTAMP
FROM "_legal" l
WHERE p."slug" = l."slug" AND p."locale" = l."locale"
  AND (p."body" LIKE 'Draft. This page has not been written yet%' OR p."body" LIKE 'मसौदा। यह पेज अभी लिखा नहीं गया है%');

DROP TABLE "_legal";
