-- 002_seed_exercises.sql
-- Semillas mínimas de ejercicios (puedes ampliarlo luego)

INSERT OR IGNORE INTO exercises(id,name,image,bodyPart,primaryMuscles,secondaryMuscles,equipment,isCustom) VALUES
('seed_bench_press','Bench Press','https://www.lyfta.app/thumbnails/00251201.jpg','Chest','Pectoralis Major Sternal Head','Deltoid Anterior, Pectoralis Major Clavicular Head, Triceps Brachii','Barbell',0),
('seed_triceps_pushdown','Triceps Pushdown','https://www.lyfta.app/thumbnails/02411201.jpg','Triceps, Upper Arms','Triceps Brachii','','Cable',0),
('seed_incline_bench_press','Incline Bench Press','https://www.lyfta.app/thumbnails/03141201.jpg','Chest','Pectoralis Major Clavicular Head','Deltoid Anterior, Triceps Brachii','Dumbbell',0),
('seed_lateral_raise','Lateral Raise','https://www.lyfta.app/thumbnails/03341201.jpg','Shoulders','Deltoid Lateral','Deltoid Anterior, Serratus Anterior','Dumbbell',0),
('seed_full_squat','Full Squat','https://www.lyfta.app/thumbnails/00431201.jpg','Quadriceps, Thighs','Gluteus Maximus, Quadriceps','Adductor Magnus, Soleus','Barbell',0),
('seed_push_up','Push-up','https://www.lyfta.app/thumbnails/00071201.jpg','Chest','Pectoralis Major','Triceps Brachii, Deltoid Anterior, Serratus Anterior, Core','Body weight',0),
('seed_bent_over_row','Bent Over Row','https://www.lyfta.app/thumbnails/00271201.jpg','Back','Infraspinatus, Latissimus Dorsi, Teres Major, Teres Minor, Trapezius Middle & Upper Fibers','Brachialis, Brachioradialis, Deltoid Posterior','Barbell',0),
('seed_lat_pulldown','Bar Lateral Pulldown','https://www.lyfta.app/thumbnails/02181201.jpg','Back','Latissimus Dorsi','Biceps Brachii, Teres Major, Rhomboids','Cable',0);
