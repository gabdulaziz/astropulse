"""
AstroPulse knowledge base.

Everything the app "knows" about space medicine lives here: health indicators and their
thresholds, the five hazards of human spaceflight (RIDGE), body systems, mission
environments, health quests and badges.

Sources (summarised in plain words, see the build guide for details):
  * NASA Human Research Program - "5 Hazards of Human Spaceflight" (RIDGE)
  * NASA HRP evidence/risk pages: bone, muscle, cardiovascular, SANS, immune, behavioral health, sleep
  * Barger et al. 2014 (Lancet Neurology): ISS crew average ~6 h sleep
  * Trudel et al. 2022 (Nature Medicine): "space anemia", ~54% more red blood cells destroyed in space
  * Stahn et al. 2017 (Scientific Reports): core body temperature rises ~1 C on long missions
  * Zeitlin et al. 2013 / Hassler et al. 2014 (Science, MSL RAD): Mars transit and surface dose
  * Zhang et al. 2020 (Science Advances, Chang'e-4 LND): lunar surface dose
  * NASA-STD-3001: career effective dose limit of 600 mSv

THRESHOLDS ARE FOR A HACKATHON PROTOTYPE. They follow common clinical reference ranges, but
they are not medical advice and are not NASA flight rules. Flight surgeons set real limits.
"""

# ---------------------------------------------------------------------------
# Health indicators
# ---------------------------------------------------------------------------
# "nominal": (low, high) -> green; inside "caution" but outside nominal -> amber; anything else -> red.

INDICATORS: dict[str, dict] = {
    "heart_rate": {
        "name": "Resting Heart Rate",
        "short": "Heart rate",
        "unit": "bpm",
        "icon": "heart",
        "input": {"min": 20, "max": 220, "step": 1, "placeholder": "e.g. 64"},
        "nominal": (50, 100),
        "caution": (40, 120),
        "schedule_hours": 24,
        "systems": ["heart"],
        "hazards": ["gravity", "radiation", "isolation"],
        "why": "Heart rate shows how hard your cardiovascular system is working. In weightlessness the heart "
               "pumps against less gravity and can lose mass and fitness over time (cardiovascular deconditioning).",
        "how_to": [
            "Sit or float still for 5 minutes, no exercise in the last 30 minutes.",
            "Put the pulse oximeter on your finger or two fingers on your wrist (radial pulse).",
            "Count beats for 30 seconds and multiply by 2, or read the device after it stabilises.",
            "Record the number. Morning, before coffee, gives the most consistent trend.",
        ],
        "in_space": "Fluid shifts about 2 litres of blood and fluid from the legs toward the head. The body reads this "
                    "as 'too much volume' and sheds plasma, so the heart works differently and some astronauts feel "
                    "faint (orthostatic intolerance) when they return to gravity. Stress and poor sleep also raise resting HR.",
        "actions": {
            "nominal": ["Keep your daily cardio and resistance exercise.", "Stay hydrated."],
            "caution": [
                "Re-measure after 10 minutes of quiet rest.",
                "Check for dehydration, poor sleep, caffeine or stress.",
                "Log symptoms: dizziness, palpitations, chest discomfort, shortness of breath.",
                "If it stays out of range for 24 h, report it in your next flight surgeon conference.",
            ],
            "critical": [
                "Stop all exercise and rest.",
                "Re-measure in 5 minutes; also measure blood pressure and SpO2.",
                "Tell your crew medical officer (CMO) now.",
                "Contact the flight surgeon. If you have chest pain or fainting, follow the emergency medical checklist.",
            ],
        },
    },
    "blood_pressure": {
        "name": "Blood Pressure",
        "short": "Blood pressure",
        "unit": "mmHg",
        "icon": "activity",
        "input": {"min": 50, "max": 250, "step": 1, "placeholder": "Systolic e.g. 118",
                  "min2": 30, "max2": 150, "placeholder2": "Diastolic e.g. 76"},
        "nominal": (90, 129),
        "caution": (85, 159),
        "nominal2": (60, 84),
        "caution2": (50, 99),
        "schedule_hours": 24,
        "systems": ["heart", "brain"],
        "hazards": ["gravity", "environment", "isolation"],
        "why": "Blood pressure tells you how your heart and blood vessels are coping with fluid shifts. Long missions "
               "and space radiation may also affect blood vessel health over time.",
        "how_to": [
            "Rest quietly for 5 minutes. Feet strapped down, back supported if possible.",
            "Wrap the cuff on your bare upper arm, at heart level.",
            "Do not talk or move during the reading. Take two readings 1 minute apart.",
            "Enter the top number (systolic) and the bottom number (diastolic).",
        ],
        "in_space": "In microgravity blood pressure in the head rises and in the legs falls. Average arm pressure often "
                    "stays similar or slightly lower, but the regulation system 'unlearns' standing up. High CO2 and "
                    "stress can push pressure up.",
        "actions": {
            "nominal": ["Keep exercising and limit salt in snacks.", "Keep a steady sleep schedule."],
            "caution": [
                "Repeat the reading after 5 minutes of rest.",
                "Reduce salt and caffeine today; hydrate.",
                "Check cabin CO2 level and report headaches.",
                "Track it twice daily for 3 days and share with the flight surgeon.",
            ],
            "critical": [
                "Rest immediately and re-measure on the other arm.",
                "Watch for severe headache, vision change, confusion or chest pain.",
                "Alert the crew medical officer and contact the flight surgeon now.",
            ],
        },
    },
    "blood_glucose": {
        "name": "Blood Glucose",
        "short": "Blood sugar",
        "unit": "mg/dL",
        "icon": "droplet",
        "input": {"min": 20, "max": 600, "step": 1, "placeholder": "e.g. 92"},
        "nominal": (70, 140),
        "caution": (54, 199),
        "schedule_hours": 72,
        "systems": ["gut", "muscles"],
        "hazards": ["gravity", "environment"],
        "why": "Blood sugar shows how your body handles energy. Bed-rest and spaceflight studies show reduced "
               "insulin sensitivity when muscles are used less, and low sugar can impair judgment during critical tasks.",
        "how_to": [
            "Wash and dry your hands (use a wipe; water floats away).",
            "Use the lancet on the side of a fingertip and touch the strip to the drop.",
            "Note if you are fasting (no food for 8 h) or after a meal.",
            "Dispose of the lancet in the sharps container.",
        ],
        "in_space": "Less muscle use means muscles take up less glucose. Irregular meal timing during busy days, "
                    "stress hormones and poor sleep can all shift glucose up or down.",
        "actions": {
            "nominal": ["Keep regular meals and daily exercise."],
            "caution": [
                "If low (under 70): eat 15 g of fast carbohydrate (juice, candy), re-test in 15 minutes.",
                "If high (over 140): drink water, take a light walk or cycle session, re-test after 2 h.",
                "Log what you ate and when.",
            ],
            "critical": [
                "Under 54 mg/dL: take 15-20 g fast sugar now, tell a crewmate, re-test in 15 minutes.",
                "200 mg/dL or more: re-test, check for thirst, frequent urination, nausea.",
                "Contact the flight surgeon with the values and timing.",
            ],
        },
    },
    "body_temperature": {
        "name": "Body Temperature",
        "short": "Temperature",
        "unit": "°C",
        "icon": "thermometer",
        "input": {"min": 30, "max": 43, "step": 0.1, "placeholder": "e.g. 36.9"},
        "nominal": (36.1, 37.7),
        "caution": (35.5, 38.4),
        "schedule_hours": 24,
        "systems": ["immune"],
        "hazards": ["environment", "isolation"],
        "why": "Temperature is the quickest signal of infection or inflammation. Infections can spread fast in a "
               "closed habitat, and the immune system works differently in space.",
        "how_to": [
            "Wait 20 minutes after exercise, eating or drinking.",
            "Use the thermometer under the tongue (oral) or in the ear (tympanic).",
            "Keep the mouth closed until it beeps.",
        ],
        "in_space": "Research found core body temperature drifts up by about 1 °C over long missions, and the body "
                    "sheds heat poorly during exercise because warm air does not rise without gravity. So a slightly "
                    "higher baseline can be normal; a sudden jump is the warning sign.",
        "actions": {
            "nominal": ["No action needed."],
            "caution": [
                "Re-measure in 1 hour, at rest.",
                "Check for sore throat, cough, rash or fatigue and log symptoms.",
                "Wash hands often and clean shared surfaces to protect crewmates.",
            ],
            "critical": [
                "Rest, hydrate, and avoid shared food prep.",
                "Measure heart rate and SpO2 too.",
                "Report to the crew medical officer and the flight surgeon; follow the medical kit fever procedure.",
            ],
        },
    },
    "spo2": {
        "name": "Blood Oxygen (SpO2)",
        "short": "SpO2",
        "unit": "%",
        "icon": "wind",
        "input": {"min": 50, "max": 100, "step": 1, "placeholder": "e.g. 98"},
        "nominal": (95, 100),
        "caution": (92, 100),
        "schedule_hours": 24,
        "systems": ["lungs"],
        "hazards": ["environment"],
        "why": "SpO2 shows how well your lungs move oxygen into your blood. It catches problems with cabin air, "
               "spacesuits, lung infections or dust exposure.",
        "how_to": [
            "Warm your hands; remove nail polish if any.",
            "Clip the pulse oximeter on a finger and keep still for 30 seconds.",
            "Record the steady number.",
        ],
        "in_space": "Cabin air on a spacecraft is closely controlled, but CO2 levels are higher than on Earth, and "
                    "lunar or Martian dust is sharp and can irritate the lungs. Low SpO2 can also signal a life-support issue.",
        "actions": {
            "nominal": ["No action needed."],
            "caution": [
                "Re-measure on a different finger.",
                "Breathe slowly and deeply for 2 minutes and re-check.",
                "Check cabin O2/CO2 readings; ask crewmates if they feel symptoms too.",
            ],
            "critical": [
                "If several crew are affected, treat it as a possible atmosphere emergency: follow the cabin checklist.",
                "Use supplemental oxygen if available.",
                "Contact the flight surgeon immediately.",
            ],
        },
    },
    "sleep_hours": {
        "name": "Sleep Duration",
        "short": "Sleep",
        "unit": "h",
        "icon": "moon",
        "input": {"min": 0, "max": 16, "step": 0.25, "placeholder": "e.g. 7.5"},
        "nominal": (7, 9.5),
        "caution": (5, 12),
        "schedule_hours": 24,
        "systems": ["brain"],
        "hazards": ["isolation", "distance", "environment"],
        "why": "Sleep affects alertness, mood, the immune system and mistakes during complex tasks. It is one of "
               "the most common problems in spaceflight.",
        "how_to": [
            "When you wake up, count the hours you actually slept (not time in the sleeping bag).",
            "If you wear an actigraphy watch, use its number.",
        ],
        "in_space": "On the ISS the Sun rises 16 times a day, the station is noisy, and schedules shift. Studies found "
                    "astronauts slept about 6 hours on average, and many used sleep medication.",
        "actions": {
            "nominal": ["Keep a fixed sleep window and dim lights before bed."],
            "caution": [
                "Use eye mask and earplugs; switch lights to the warm 'pre-sleep' setting.",
                "Avoid caffeine in the 6 hours before sleep.",
                "Ask mission control for a schedule adjustment if workload is the cause.",
            ],
            "critical": [
                "Do not perform critical or hazardous tasks (EVA, robotics) without a fatigue check.",
                "Plan a recovery nap or sleep shift with the crew.",
                "Talk to the flight surgeon about the cause and options.",
            ],
        },
    },
    "mood": {
        "name": "Mood",
        "short": "Mood",
        "unit": "/5",
        "icon": "smile",
        "input": {"min": 1, "max": 5, "step": 1, "placeholder": "1 = very low, 5 = great"},
        "nominal": (3, 5),
        "caution": (2, 5),
        "schedule_hours": 24,
        "systems": ["brain"],
        "hazards": ["isolation", "distance"],
        "why": "Behavioral health problems are one of NASA's main concerns for long missions. Tracking mood daily "
               "makes slow changes visible before they become a problem.",
        "how_to": [
            "Pick the face that matches how you feel overall today.",
            "Optionally add a short note: what went well, what was hard.",
        ],
        "in_space": "Isolation, confinement, a small crew, monotony, being far from family and (on Mars) delayed "
                    "communication all add up over months.",
        "actions": {
            "nominal": ["Keep up the things that help: exercise, hobbies, window time, calls home."],
            "caution": [
                "Schedule a call with family or friends.",
                "Take a 10-minute break: Earth viewing, music, a VR nature scene.",
                "Share a meal or a movie with the crew.",
            ],
            "critical": [
                "Talk to a crewmate you trust today.",
                "Request a private conference with the flight surgeon or psychologist; it is confidential and normal.",
                "If you have thoughts of harming yourself, tell the crew medical officer right away.",
            ],
        },
    },
    "body_mass": {
        "name": "Body Mass",
        "short": "Body mass",
        "unit": "kg",
        "icon": "scale",
        "input": {"min": 30, "max": 200, "step": 0.1, "placeholder": "e.g. 74.2"},
        # Evaluated as % change from baseline, not absolute kg
        "nominal": (-3, 3),
        "caution": (-6, 5),
        "relative": True,
        "schedule_hours": 168,
        "systems": ["muscles", "bones", "gut"],
        "hazards": ["gravity", "environment"],
        "why": "Body mass is the simplest check on nutrition and muscle loss. Astronauts often lose weight in "
               "space because they eat less than they need.",
        "how_to": [
            "Scales do not work in weightlessness. Use the mass measurement device (on the ISS: SLAMMD, which "
            "uses a known force and your acceleration, F = m x a).",
            "Measure weekly, at the same time of day, before eating.",
        ],
        "in_space": "Food tastes blander with nasal congestion from fluid shift, workdays are busy, and muscle and "
                    "bone are lost without heavy exercise. Losing more than ~5% of body mass is a warning sign.",
        "actions": {
            "nominal": ["Keep eating your full meal plan."],
            "caution": [
                "Add snacks between meals and track calories for a week.",
                "Check protein intake and keep up resistance exercise.",
            ],
            "critical": [
                "Report to the flight surgeon and the nutrition team.",
                "Check for loss of appetite, nausea or low mood.",
            ],
        },
    },
    "radiation_dose": {
        "name": "Radiation Dose (daily)",
        "short": "Radiation",
        "unit": "mSv",
        "icon": "radiation",
        "input": {"min": 0, "max": 500, "step": 0.01, "placeholder": "e.g. 0.55"},
        "nominal": (0, 2),
        "caution": (0, 10),
        "schedule_hours": 24,
        "systems": ["immune", "brain", "heart"],
        "hazards": ["radiation"],
        "why": "Space radiation can damage DNA and increase long-term risks of cancer, heart disease and effects "
               "on the brain. NASA limits a career dose to 600 mSv.",
        "how_to": [
            "Read your personal dosimeter (crew passive/active dosimeter) once a day.",
            "Enter the dose for the last 24 hours in millisieverts (mSv).",
        ],
        "in_space": "Typical daily doses: ~0.7 mSv on the ISS, ~1.4 mSv on the lunar surface, ~1.8 mSv in deep space "
                    "transit to Mars, ~0.7 mSv on the Martian surface. A solar particle event can deliver much more in hours.",
        "actions": {
            "nominal": ["No action needed. Keep the dosimeter on you."],
            "caution": [
                "Check space weather alerts for solar activity.",
                "Spend sleep and rest time in the most shielded area (water walls, crew quarters).",
            ],
            "critical": [
                "Move to the storm shelter / most shielded area now.",
                "Contact mission control for space-weather status and the flight surgeon for dose assessment.",
            ],
        },
    },
}

STATUS_ORDER = {"nominal": 0, "caution": 1, "critical": 2, "unknown": -1}

# ---------------------------------------------------------------------------
# The five hazards of human spaceflight (NASA HRP, "RIDGE")
# ---------------------------------------------------------------------------
HAZARDS = [
    {
        "key": "radiation", "letter": "R", "name": "Space Radiation",
        "summary": "Outside Earth's protective magnetic field, galactic cosmic rays and solar particle events pass "
                   "through spacecraft walls and the body.",
        "effects": ["DNA damage and higher lifetime cancer risk", "Possible effects on the brain and behaviour",
                    "Cardiovascular disease risk", "Acute radiation sickness in a big solar storm"],
        "countermeasures": ["Personal dosimeters", "Shielding with water, food and equipment",
                            "Storm shelters and space-weather forecasting", "Mission dose limits (600 mSv career)"],
        "indicators": ["radiation_dose", "heart_rate", "body_temperature"],
    },
    {
        "key": "isolation", "letter": "I", "name": "Isolation & Confinement",
        "summary": "Small crews live and work in tight spaces for months, far from family and friends.",
        "effects": ["Low mood, anxiety, irritability", "Sleep problems and fatigue", "Crew conflict",
                    "Lower performance and mistakes"],
        "countermeasures": ["Daily mood tracking", "Regular calls home", "Private psychological conferences",
                            "Exercise, hobbies, window time", "Good crew selection and training"],
        "indicators": ["mood", "sleep_hours", "heart_rate"],
    },
    {
        "key": "distance", "letter": "D", "name": "Distance from Earth",
        "summary": "The farther away, the longer the communication delay and the harder an emergency return.",
        "effects": ["Moon: ~1.3 s one-way delay", "Mars: about 3 to 22 minutes one-way delay",
                    "No quick evacuation to a hospital", "Limited medical supplies"],
        "countermeasures": ["Crew must self-assess and act on their own (autonomy)",
                            "Onboard decision support tools like AstroPulse", "Well-stocked medical kit and training"],
        "indicators": ["mood", "sleep_hours"],
    },
    {
        "key": "gravity", "letter": "G", "name": "Gravity Fields",
        "summary": "Astronauts switch between weightlessness, Moon (0.17 g), Mars (0.38 g) and Earth gravity.",
        "effects": ["Bone loss of about 1-1.5% per month in hips and spine", "Muscle atrophy",
                    "Fluid shift to the head and eye changes (SANS)", "Balance problems and space motion sickness",
                    "Kidney stone risk from bone calcium"],
        "countermeasures": ["About 2 hours of exercise a day (resistance, treadmill, cycle)", "Nutrition and vitamin D",
                            "Hydration", "Regular eye checks"],
        "indicators": ["blood_pressure", "heart_rate", "body_mass", "blood_glucose"],
    },
    {
        "key": "environment", "letter": "E", "name": "Hostile & Closed Environments",
        "summary": "The spacecraft is a sealed bubble: air, water, temperature, noise and microbes must all be managed.",
        "effects": ["Higher CO2 causing headaches", "Microbes spreading between crew",
                    "Changes in the immune system", "Noise and light disturbing sleep", "Toxic dust on Moon/Mars"],
        "countermeasures": ["Environmental monitoring", "Hygiene and surface cleaning",
                            "Air filtration", "Tracking temperature and SpO2"],
        "indicators": ["body_temperature", "spo2", "sleep_hours"],
    },
]

# ---------------------------------------------------------------------------
# Body systems (for the clickable body figure)
# ---------------------------------------------------------------------------
BODY_SYSTEMS = [
    {
        "key": "brain", "name": "Brain & Mind",
        "function": "Controls thinking, memory, mood, sleep and coordination of the whole body.",
        "space_effects": ["Isolation and stress can lower mood and cause anxiety",
                          "Sleep is shorter and lighter in space",
                          "Fluid shift changes brain position slightly inside the skull",
                          "Cosmic radiation may affect thinking over long missions"],
        "indicators": ["mood", "sleep_hours", "blood_pressure"],
        "countermeasures": ["Daily mood journal", "Fixed sleep schedule", "Calls home and crew time"],
    },
    {
        "key": "eyes", "name": "Eyes & Vision",
        "function": "Sight, needed for every task from reading checklists to docking a spacecraft.",
        "space_effects": ["Spaceflight-Associated Neuro-ocular Syndrome (SANS): swelling of the optic disc, "
                          "flattening of the back of the eye, folds in the eye layers",
                          "Vision can become more far-sighted",
                          "Seen in a large share of long-duration astronauts"],
        "indicators": ["blood_pressure"],
        "countermeasures": ["Regular vision tests and eye imaging (OCT, fundoscopy, ultrasound)",
                            "Adjustable-focus glasses", "Research countermeasures such as lower-body negative pressure"],
    },
    {
        "key": "ears", "name": "Inner Ear & Balance",
        "function": "The vestibular system senses motion and gravity to keep balance.",
        "space_effects": ["Space motion sickness in the first days for most first-time flyers",
                          "Disorientation when gravity changes (landing on Moon/Mars or Earth)"],
        "indicators": ["mood"],
        "countermeasures": ["Move the head slowly in the first days", "Anti-nausea medication",
                            "Balance training before landing"],
    },
    {
        "key": "lungs", "name": "Lungs",
        "function": "Bring oxygen into the blood and remove carbon dioxide.",
        "space_effects": ["Higher cabin CO2 can cause headaches and tiredness",
                          "Lunar and Martian dust is sharp and can irritate airways",
                          "Spacesuit and cabin pressure changes"],
        "indicators": ["spo2"],
        "countermeasures": ["Monitor SpO2 and cabin CO2", "Dust control in airlocks", "Pre-breathe protocol before spacewalks"],
    },
    {
        "key": "heart", "name": "Heart & Blood Vessels",
        "function": "Pumps blood carrying oxygen and nutrients to every cell.",
        "space_effects": ["About 2 litres of fluid shift toward the head",
                          "Heart can lose mass and fitness (deconditioning)",
                          "Feeling faint when standing after landing (orthostatic intolerance)",
                          "Radiation may raise long-term heart disease risk"],
        "indicators": ["heart_rate", "blood_pressure", "radiation_dose"],
        "countermeasures": ["Daily cardio exercise", "Fluid and salt loading before landing", "Compression garments"],
    },
    {
        "key": "immune", "name": "Blood & Immune System",
        "function": "Red blood cells carry oxygen; white blood cells fight infection.",
        "space_effects": ["'Space anemia': the body destroys about 54% more red blood cells than on Earth",
                          "Immune system becomes less balanced",
                          "Dormant viruses (like chickenpox/shingles and Epstein-Barr) can reactivate",
                          "Wounds may heal more slowly"],
        "indicators": ["body_temperature", "radiation_dose", "heart_rate"],
        "countermeasures": ["Daily temperature check", "Hygiene and cleaning", "Good nutrition and sleep",
                            "Pre-flight quarantine"],
    },
    {
        "key": "gut", "name": "Digestion & Nutrition",
        "function": "Turns food into energy and building blocks; home to the gut microbiome.",
        "space_effects": ["Astronauts often eat less than they need", "Food tastes bland with a stuffy nose",
                          "Gut microbes change", "Vitamin D is low without sunlight"],
        "indicators": ["body_mass", "blood_glucose"],
        "countermeasures": ["Full meal plan and snacks", "Vitamin D supplement", "Weekly body mass check"],
    },
    {
        "key": "kidneys", "name": "Kidneys",
        "function": "Filter the blood and control water and salt balance.",
        "space_effects": ["Calcium released from bones raises kidney stone risk",
                          "Astronauts tend to drink less water"],
        "indicators": ["blood_pressure"],
        "countermeasures": ["Drink at least 2-2.5 L of water a day", "Exercise to protect bone", "Limit salt"],
    },
    {
        "key": "muscles", "name": "Muscles",
        "function": "Move the body and hold posture; legs and back work constantly on Earth.",
        "space_effects": ["Without load, leg and back muscles shrink quickly",
                          "Loss of strength and endurance", "Back pain from spine lengthening"],
        "indicators": ["body_mass", "blood_glucose"],
        "countermeasures": ["Resistance exercise (ARED on the ISS)", "Treadmill with harness", "Protein-rich diet"],
    },
    {
        "key": "bones", "name": "Bones",
        "function": "Support the body, protect organs and store calcium.",
        "space_effects": ["Bone density drops about 1-1.5% per month in hips and spine",
                          "Recovery after return can take years",
                          "Higher fracture risk when landing on Mars"],
        "indicators": ["body_mass"],
        "countermeasures": ["Heavy resistance exercise", "Vitamin D and calcium", "Bone scans before and after flight"],
    },
    {
        "key": "skin", "name": "Skin",
        "function": "Protects the body, controls temperature and senses touch.",
        "space_effects": ["Rashes and dry, sensitive skin", "Thin skin on feet", "Slower wound healing"],
        "indicators": ["body_temperature"],
        "countermeasures": ["Moisturiser", "Photo-log skin changes in AstroPulse", "Keep wounds clean"],
    },
]

# ---------------------------------------------------------------------------
# Mission environments
# ---------------------------------------------------------------------------
ENVIRONMENTS = {
    "station": {
        "name": "Space Station (LEO)", "gravity_g": 0.0, "comm_delay": "Near real-time (< 1 s)",
        "comm_delay_s": 0.5, "typical_dose_msv_day": 0.7, "evacuation": "Hours (return capsule docked)",
        "notes": "Earth's magnetic field still blocks much radiation. Flight surgeons are a call away.",
    },
    "spacecraft": {
        "name": "Deep-Space Spacecraft (e.g. Orion)", "gravity_g": 0.0, "comm_delay": "Seconds to minutes",
        "comm_delay_s": 60, "typical_dose_msv_day": 1.8, "evacuation": "Days (free-return trajectory)",
        "notes": "Outside the magnetic field: watch radiation closely. Very small cabin.",
    },
    "rover": {
        "name": "Pressurized Rover", "gravity_g": 0.17, "comm_delay": "Via base relay",
        "comm_delay_s": 2, "typical_dose_msv_day": 1.4, "evacuation": "Drive back to base",
        "notes": "Long drives, little room for exercise, and dust in the airlock.",
    },
    "lunar_base": {
        "name": "Lunar Surface Base", "gravity_g": 0.17, "comm_delay": "~1.3 s one-way",
        "comm_delay_s": 1.3, "typical_dose_msv_day": 1.4, "evacuation": "About 3 days to Earth",
        "notes": "One-sixth gravity, sharp regolith dust, 14-day nights at most sites.",
    },
    "mars_base": {
        "name": "Mars Surface Base", "gravity_g": 0.38, "comm_delay": "3-22 min one-way",
        "comm_delay_s": 1200, "typical_dose_msv_day": 0.7, "evacuation": "Not possible for months",
        "notes": "Crew must handle medical problems on their own: send reports, but act first.",
    },
}

CAREER_DOSE_LIMIT_MSV = 600.0

# ---------------------------------------------------------------------------
# Gamification: daily quests, ranks and badges
# ---------------------------------------------------------------------------
TASKS = [
    {"key": "morning_vitals", "title": "Morning vitals check-in", "xp": 25, "category": "monitoring",
     "description": "Log heart rate, blood pressure, temperature and SpO2.", "icon": "activity"},
    {"key": "exercise_resistance", "title": "Resistance training (60 min)", "xp": 40, "category": "fitness",
     "description": "Squats, deadlifts and heel raises on the resistance device protect bone and muscle.", "icon": "dumbbell"},
    {"key": "exercise_cardio", "title": "Cardio session (30+ min)", "xp": 30, "category": "fitness",
     "description": "Treadmill or cycle ergometer keeps your heart fit.", "icon": "bike"},
    {"key": "hydrate", "title": "Drink 2.5 L of water", "xp": 20, "category": "nutrition",
     "description": "Protects kidneys from stones and keeps blood volume up.", "icon": "droplet"},
    {"key": "nutrition", "title": "Full meal plan + vitamin D", "xp": 15, "category": "nutrition",
     "description": "Eat all planned meals; no sunlight means vitamin D comes from supplements.", "icon": "apple"},
    {"key": "sleep_routine", "title": "Lights-out on schedule", "xp": 20, "category": "rest",
     "description": "8-hour sleep window, warm lights 1 h before bed, no screens in the bag.", "icon": "moon"},
    {"key": "mood_journal", "title": "Mood journal entry", "xp": 15, "category": "mind",
     "description": "Rate your mood and write one line about your day.", "icon": "smile"},
    {"key": "crew_connect", "title": "Connect with someone", "xp": 20, "category": "mind",
     "description": "Call home or share a meal with the crew.", "icon": "users"},
    {"key": "window_time", "title": "10 minutes of window time", "xp": 10, "category": "mind",
     "description": "Look at Earth (or a VR nature scene). Nature views reduce stress.", "icon": "globe"},
    {"key": "eye_check", "title": "Vision self-check", "xp": 20, "category": "monitoring",
     "description": "Read the acuity chart and the Amsler grid; report any wavy lines or blur.", "icon": "eye"},
    {"key": "radiation_log", "title": "Read your dosimeter", "xp": 10, "category": "monitoring",
     "description": "Log yesterday's radiation dose.", "icon": "radiation"},
]
TASKS_BY_KEY = {t["key"]: t for t in TASKS}

XP_PER_READING = 5
XP_PER_LEVEL = 1500
RANKS = ["Cadet", "Candidate", "Mission Specialist", "Flight Engineer", "Commander", "Space Legend"]

BADGES = [
    {"key": "first_contact", "name": "First Contact", "icon": "radio", "description": "Log your first measurement."},
    {"key": "streak_3", "name": "Liftoff Streak", "icon": "flame", "description": "Check in 3 days in a row."},
    {"key": "streak_7", "name": "Orbital Habit", "icon": "orbit", "description": "Check in 7 days in a row."},
    {"key": "streak_30", "name": "Long-Duration", "icon": "rocket", "description": "Check in 30 days in a row."},
    {"key": "full_spectrum", "name": "Full Spectrum", "icon": "layers", "description": "Log every health indicator at least once."},
    {"key": "iron_astronaut", "name": "Iron Astronaut", "icon": "dumbbell", "description": "Complete 10 resistance sessions."},
    {"key": "hydration_hero", "name": "Hydration Hero", "icon": "droplet", "description": "Hit your water goal 14 times."},
    {"key": "sleep_master", "name": "Sleep Master", "icon": "moon", "description": "7 nights of nominal sleep."},
    {"key": "data_scientist", "name": "Data Scientist", "icon": "chart", "description": "Log 100 measurements."},
    {"key": "commander", "name": "Commander", "icon": "star", "description": "Reach level 5."},
]
