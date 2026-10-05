-- Geliştirme için örnek veri. Kişisel veri içermez: gerçek öğrenci kayıtları `example-database.sql`
-- dump'ında kalır ve bilerek içe aktarılmaz. Tekrar çalıştırılabilir (idempotent).

-- Referans veri (dump'tan, kişisel veri yok)
INSERT INTO public.naeron_bi_currencies ("m_ID", name, shortcode, symbol, "_lastRowStatus", "_lastRowUpdate") VALUES
  (27, 'Euro', 'EUR', '€', 'create', '2024-09-07 14:44:14'),
  (39, 'TÜRK LİRASI', 'TL', '₺', 'update', '2025-08-25 12:13:01'),
  (40, 'DOLAR', 'USD', '$', 'update', '2025-08-25 12:13:28')
ON CONFLICT ("m_ID") DO NOTHING;

INSERT INTO public.naeron_bi_trainings ("m_ID", name, "itemOrder", "trainingType", "_lastRowStatus", "_lastRowUpdate") VALUES
  (-2, 'Controls', 100002, NULL, 'create', '2024-05-18 13:56:52'),
  (-1, 'Others', 100001, NULL, 'create', '2024-05-18 13:56:52'),
  (211, 'PPL(A)', 1, 'modular', 'update', '2024-09-13 15:40:56'),
  (212, 'NR', 4, 'modular', 'update', '2024-09-11 17:34:17'),
  (213, 'LAPL(A)', 8, 'modular', 'update', '2024-09-14 17:27:03'),
  (214, 'Amatör Havacı', 9, 'modular', 'update', '2024-09-11 17:34:44'),
  (215, 'PIC', 3, 'modular', 'update', '2024-09-11 17:34:12'),
  (216, 'ATPL Theory', 2, 'modular', 'update', '2024-09-11 17:34:06'),
  (217, 'IR', 6, 'modular', 'update', '2024-09-11 17:34:30'),
  (218, 'CPL', 5, 'modular', 'update', '2024-09-11 17:34:26'),
  (219, 'ME', 7, 'modular', 'update', '2024-09-11 17:34:34'),
  (220, 'SEP(land) Yenileme', 10, 'modular', 'create', '2024-09-11 17:35:03'),
  (221, 'PPL(A) Theory', 11, 'modular', 'create', '2024-09-11 17:36:09'),
  (222, '90 Gün Tazeleme', 12, 'modular', 'update', '2025-08-11 15:34:55'),
  (298, 'LAPL(A) to PPL(A)', 13, 'modular', 'create', '2025-01-30 00:52:26'),
  (299, 'FI(A)', 14, 'modular', 'create', '2025-02-12 02:20:59'),
  (315, 'CR(A-SEP)', 15, 'modular', 'create', '2025-08-11 15:04:35'),
  (316, 'EASA to SHGM PPL(A) Conversion', 16, 'modular', 'create', '2025-08-17 20:38:43')
ON CONFLICT ("m_ID") DO NOTHING;

INSERT INTO public.naeron_bi_facilities ("m_ID", icao, name, latitude, longitude, "_lastRowStatus", "_lastRowUpdate") VALUES
  (52, 'LTFH', 'Samsun', '41.257709', '36.556900', 'update', '2025-11-20 17:35:17'),
  (53, 'IST', 'Istanbul', NULL, NULL, 'create', '2024-09-11 17:41:49'),
  (54, 'SFI', 'Engiz, Samsun', NULL, NULL, 'create', '2024-09-13 19:13:27'),
  (55, 'LTFC', 'Isparta', NULL, NULL, 'update', '2024-09-18 12:54:29')
ON CONFLICT ("m_ID") DO NOTHING;

INSERT INTO public.northfly_odt_nazari_subjects ("m_ID", code, name, sort_order, counts_toward_total, pass_min_score) OVERRIDING SYSTEM VALUE VALUES
  (1, 'U 01 N SD 034', 'Sınav Gözetmeni İşlemleri', 0, false, 70.00),
  (2, 'U 01 N HG 001', 'Güvenlik Bilinci', 1, true, 70.00),
  (3, 'U 01 E UO 070', 'Haberleşme 1', 2, true, 75.00),
  (4, 'U 01 E SD 028', 'Havacılığa Giriş', 3, true, 70.00),
  (5, 'U 01 E UO 027', 'Seyrüsefer 1', 4, true, 75.00),
  (6, 'U 01 E UO 026', 'Hava Hukuku 1', 5, true, 75.00),
  (7, 'U 01 E UO 071', 'Uçak Uçuş Prensipleri 1', 6, true, 75.00),
  (8, 'U 01 E UO 073', 'Uçak Operasyonel Prosedürler 1', 7, true, 75.00),
  (9, 'U 01 E UO 078', 'Uçak Genel Bilgisi 1', 8, true, 75.00),
  (10, 'U 01 E UO 075', 'Uçak Uçuş Performansı ve Planlama 1', 9, true, 75.00),
  (11, 'U 01 E UO 025', 'İnsan Performansı ve Limitleri 1', 10, true, 75.00),
  (12, 'U 01 E UO 137', 'Meteoroloji 1', 11, true, 75.00)
ON CONFLICT ("m_ID") DO NOTHING;
SELECT setval(pg_get_serial_sequence('public.northfly_odt_nazari_subjects', 'm_ID'),
              GREATEST((SELECT max("m_ID") FROM public.northfly_odt_nazari_subjects), 1));

INSERT INTO public.northfly_wapi_auto (id, enabled) VALUES (1, false) ON CONFLICT (id) DO NOTHING;

-- Tamamen uydurma örnek öğrenciler (9000001-9000003)
INSERT INTO public.naeron_bi_students
  ("m_ID", "vm_ID", "firstName", "lastName", "studentNo", gender, gsm, email, "trainingStatus",
   "actualTrainingName", "actualPhaseName", "_lastRowStatus", "_lastRowUpdate")
VALUES
  (9000001, 0, 'Test', 'Öğrenci Bir', 'T-0001', 'male', '5550000001', 'ogrenci1@example.test', NULL,
   'PPL(A)', 'TEMEL ALET SAFHASI', 'update', now()),
  (9000002, 0, 'Test', 'Öğrenci İki', 'T-0002', 'female', '5550000002', 'ogrenci2@example.test', NULL,
   'PPL(A)', 'İLK YALNIZ UÇUŞ SAFHASI', 'update', now()),
  (9000003, 0, 'Test', 'Öğrenci Üç', 'T-0003', 'male', '5550000003', 'ogrenci3@example.test', 'graduated',
   'PPL(A)', 'PPL(A) YETENEK KONTROLÜ', 'update', now())
ON CONFLICT ("m_ID") DO NOTHING;

INSERT INTO public.naeron_bi_student_contracts
  ("m_ID", "studentID", subject, "contractNo", "signDate", "contractStatus", price, payed, "currencyID", "_lastRowStatus", "_lastRowUpdate")
VALUES
  (9100001, 9000001, 'PPL(A) Eğitimi', 'T-C1', now() - interval '90 days', NULL, '10000', '4000', 27, 'update', now()),
  (9100002, 9000002, 'PPL(A) Eğitimi', 'T-C2', now() - interval '60 days', NULL, '10000', '10000', 27, 'update', now()),
  (9100003, 9000003, 'PPL(A) Eğitimi', 'T-C3', now() - interval '400 days', NULL, '10000', '10000', 27, 'update', now())
ON CONFLICT ("m_ID") DO NOTHING;

INSERT INTO public.naeron_bi_student_installments
  ("m_ID", "studentID", "contractID", "installmentDate", name, price, currency, status, "_lastRowStatus", "_lastRowUpdate")
VALUES
  (9200001, 9000001, 9100001, now() - interval '60 days', '1. Taksit', '4000', 27, 'payed', 'update', now()),
  (9200002, 9000001, 9100001, now() - interval '5 days', '2. Taksit', '3000', 27, 'notpayed', 'update', now()),
  (9200003, 9000001, 9100001, now() + interval '25 days', '3. Taksit', '3000', 27, 'notpayed', 'update', now()),
  (9200004, 9000002, 9100002, now() - interval '30 days', '1. Taksit', '5000', 27, 'payed', 'update', now()),
  (9200005, 9000002, 9100002, now() - interval '3 days', '2. Taksit', '5000', 27, 'payed', 'update', now())
ON CONFLICT ("m_ID") DO NOTHING;

INSERT INTO public.naeron_bi_student_payments
  ("m_ID", "studentID", "contractID", "paymentDate", "paymentNo", amount, "currencyID", "creatorName", "_lastRowStatus", "_lastRowUpdate")
VALUES
  (9300001, 9000001, 9100001, now() - interval '58 days', 'T-P1', '4000', 27, 'Seed', 'create', now()),
  (9300002, 9000002, 9100002, now() - interval '29 days', 'T-P2', '5000', 27, 'Seed', 'create', now()),
  (9300003, 9000002, 9100002, now() - interval '2 days', 'T-P3', '5000', 27, 'Seed', 'create', now())
ON CONFLICT ("m_ID") DO NOTHING;

INSERT INTO public.naeron_bi_student_trainings
  ("m_ID", "studentID", "trainingID", "contractID", "trainingStatus", "_lastRowStatus", "_lastRowUpdate")
VALUES
  (9400001, 9000001, 211, 9100001, NULL, 'update', now()),
  (9400002, 9000002, 211, 9100002, NULL, 'update', now()),
  (9400003, 9000003, 211, 9100003, 'graduated', 'update', now())
ON CONFLICT ("m_ID") DO NOTHING;

INSERT INTO public.naeron_bi_flights
  ("m_ID", "flightDate", "BlockTime", duration, "flightDuration", "s_Type", "s_ID", "studentName_", "dutyName_",
   "aircraftName_", "instructorName_", realized, "_lastRowStatus", "_lastRowUpdate")
VALUES
  (9500001, now() - interval '20 days', 60, 60, 60, 'student', 9000001, 'Test Öğrenci Bir', 'E-1A', 'TC-TST', 'Test Eğitmen', 1, 'update', now()),
  (9500002, now() - interval '10 days', 75, 75, 75, 'student', 9000001, 'Test Öğrenci Bir', 'E-2', 'TC-TST', 'Test Eğitmen', 1, 'update', now()),
  (9500003, now() - interval '15 days', 90, 90, 90, 'student', 9000002, 'Test Öğrenci İki', 'E-3', 'TC-TST', 'Test Eğitmen', 1, 'update', now())
ON CONFLICT ("m_ID") DO NOTHING;
