/**
 * GridDown Medical Module - Offline Wilderness Medicine Reference
 * Curated database of wilderness medicine, drug interactions, and trauma protocols
 * 
 * DISCLAIMER: This information is for educational reference only and is not a 
 * substitute for professional medical training or emergency medical care.
 * Always seek professional medical help when available.
 */
const MedicalModule = (function() {
    'use strict';

    // Medical database organized by category
    const MEDICAL_DATABASE = {
        
        // =====================================================
        // TRAUMA & BLEEDING
        // =====================================================
        trauma: {
            name: 'Trauma & Bleeding',
            icon: '🩸',
            color: '#ef4444',
            items: [
                {
                    id: 'severe-bleeding',
                    title: 'Severe Bleeding Control',
                    severity: 'critical',
                    keywords: ['hemorrhage', 'bleeding', 'blood loss', 'tourniquet', 'wound'],
                    summary: 'Life-threatening bleeding requires immediate direct pressure and possibly a tourniquet.',
                    protocol: [
                        'Ensure scene safety and wear gloves if available',
                        'Apply direct pressure with clean cloth or gauze',
                        'If blood soaks through, add more material - do NOT remove',
                        'Elevate injured limb above heart level if possible',
                        'For limb wounds not controlled by pressure: apply tourniquet 2-3 inches above wound',
                        'Note time tourniquet applied - do NOT remove in field',
                        'Pack deep wounds tightly with gauze, maintain pressure',
                        'Monitor for shock: pale skin, rapid pulse, confusion'
                    ],
                    notes: 'Tourniquet myth: Modern evidence shows tourniquets are safe for several hours. Apply tight enough to stop bleeding completely.',
                    equipment: ['Tourniquet (CAT, SOFT-T)', 'Hemostatic gauze (QuikClot, Celox)', 'Pressure bandage', 'Nitrile gloves']
                },
                {
                    id: 'tourniquet-application',
                    title: 'Tourniquet Application',
                    severity: 'critical',
                    keywords: ['tourniquet', 'cat', 'soft-t', 'limb bleeding'],
                    summary: 'Proper tourniquet placement for uncontrolled limb hemorrhage.',
                    protocol: [
                        'Place tourniquet 2-3 inches above the wound (not on joint)',
                        'Pull strap tight through buckle',
                        'Twist windlass until bleeding stops completely',
                        'Lock windlass in clip/holder',
                        'Secure loose strap end',
                        'Write time on tourniquet or patient forehead with marker',
                        'Do NOT loosen or remove - leave for medical personnel',
                        'If first tourniquet doesn\'t control bleeding, apply second above first'
                    ],
                    notes: 'High and tight for junctional wounds (groin, armpit). One tourniquet may not be enough for large patients.',
                    equipment: ['CAT tourniquet', 'SOFT-T tourniquet', 'Sharpie marker']
                },
                {
                    id: 'wound-packing',
                    title: 'Wound Packing',
                    severity: 'high',
                    keywords: ['wound packing', 'deep wound', 'gauze', 'hemostatic'],
                    summary: 'Packing deep wounds to control bleeding from areas where tourniquets cannot be applied.',
                    protocol: [
                        'Expose the wound completely',
                        'Identify the source of bleeding if possible',
                        'Pack gauze directly into wound, starting at bleeding source',
                        'Pack tightly - use fingers to push gauze deep',
                        'Continue packing until wound is completely filled',
                        'Apply direct pressure on top for minimum 3 minutes',
                        'Apply pressure bandage over packed wound',
                        'Do NOT remove packing - let medical personnel handle'
                    ],
                    notes: 'Hemostatic gauze (QuikClot, Celox) is preferred but plain gauze works. Pack firmly - it will be uncomfortable for patient.',
                    equipment: ['Hemostatic gauze', 'Plain gauze (kerlix)', 'Pressure bandage', 'Gloves']
                },
                {
                    id: 'fractures',
                    title: 'Fracture Management',
                    severity: 'high',
                    keywords: ['broken bone', 'fracture', 'splint', 'immobilize'],
                    summary: 'Stabilize suspected fractures to prevent further injury and reduce pain.',
                    protocol: [
                        'Check circulation below injury: pulse, sensation, movement',
                        'Do NOT attempt to realign bone unless no pulse below injury',
                        'Splint in position found - immobilize joint above and below',
                        'Pad splint material for comfort',
                        'Secure splint snugly but not tight enough to cut off circulation',
                        'Recheck circulation after splinting',
                        'Apply cold pack wrapped in cloth (20 min on, 20 min off)',
                        'Elevate if possible',
                        'Monitor for compartment syndrome: severe pain, numbness, pale/cold limb'
                    ],
                    notes: 'Open fractures (bone visible) require wound care first. Angulated fractures with no pulse may need gentle traction to restore circulation.',
                    equipment: ['SAM splint', 'Padding material', 'Triangular bandage', 'Elastic bandage', 'Cold pack']
                },
                {
                    id: 'chest-trauma',
                    title: 'Chest Trauma',
                    severity: 'critical',
                    keywords: ['chest wound', 'pneumothorax', 'sucking chest wound', 'rib fracture'],
                    summary: 'Penetrating or blunt chest trauma can be immediately life-threatening.',
                    protocol: [
                        'SUCKING CHEST WOUND (penetrating):',
                        '- Apply chest seal or occlusive dressing (plastic/foil) taped on 3 sides',
                        '- Leave one side open to allow air to escape',
                        '- Monitor for tension pneumothorax',
                        '',
                        'TENSION PNEUMOTHORAX signs:',
                        '- Increasing difficulty breathing',
                        '- Trachea deviated away from injured side',
                        '- Distended neck veins',
                        '- If suspected: burp the chest seal or needle decompression if trained',
                        '',
                        'RIB FRACTURES:',
                        '- Do NOT wrap chest tightly',
                        '- Encourage deep breathing to prevent pneumonia',
                        '- Position of comfort (usually sitting up)'
                    ],
                    notes: 'Check for exit wound on back. All penetrating chest trauma needs evacuation.',
                    equipment: ['Chest seal (Hyfin, Asherman)', 'Occlusive material (plastic wrap)', 'Tape']
                },
                {
                    id: 'head-injury',
                    title: 'Head Injury / TBI',
                    severity: 'critical',
                    keywords: ['head injury', 'concussion', 'tbi', 'skull fracture', 'brain'],
                    summary: 'Traumatic brain injury assessment and management.',
                    protocol: [
                        'Assume cervical spine injury - stabilize head/neck',
                        'Check AVPU: Alert, Voice, Pain, Unresponsive',
                        'Check pupils: equal, reactive to light',
                        '',
                        'DANGER SIGNS (evacuate immediately):',
                        '- Unequal pupils',
                        '- Clear fluid from ears/nose (CSF leak)',
                        '- Battle signs (bruising behind ears)',
                        '- Raccoon eyes (bruising around eyes)',
                        '- Decreasing consciousness',
                        '- Repeated vomiting',
                        '- Seizures',
                        '',
                        'MANAGEMENT:',
                        '- Keep head elevated 30° if no spinal injury',
                        '- Prevent hypoxia - maintain airway',
                        '- Control visible bleeding with gentle pressure',
                        '- Do NOT pack ears/nose if draining fluid',
                        '- Monitor neuro status every 15 minutes'
                    ],
                    notes: 'Any loss of consciousness, even brief, requires evacuation for evaluation. Delayed deterioration is common with brain bleeds.',
                    equipment: ['Cervical collar', 'Wound care supplies', 'Pen light']
                },
                {
                    id: 'spinal-injury',
                    title: 'Spinal Injury',
                    severity: 'critical',
                    keywords: ['spine', 'spinal cord', 'neck injury', 'paralysis', 'c-spine'],
                    summary: 'Suspected spinal injury requires immobilization to prevent permanent paralysis.',
                    protocol: [
                        'SUSPECT SPINAL INJURY if:',
                        '- Mechanism: fall >3x height, diving, vehicle accident, direct trauma',
                        '- Neck/back pain or tenderness',
                        '- Numbness, tingling, weakness in extremities',
                        '- Altered consciousness',
                        '',
                        'MANAGEMENT:',
                        '- Manual stabilization: hold head in neutral position',
                        '- Do NOT move patient unless immediate danger',
                        '- Log roll only if necessary (minimum 4 people ideal)',
                        '- Apply cervical collar if available',
                        '- Pad voids under neck and small of back',
                        '- Secure to backboard/litter for transport',
                        '',
                        'AIRWAY: If needed, use jaw thrust (not head tilt)'
                    ],
                    notes: 'In wilderness settings with long evacuation, clearing the spine may be appropriate if patient is alert, not intoxicated, has no distracting injuries, and has no midline tenderness.',
                    equipment: ['Cervical collar', 'Backboard/litter', 'Padding', 'Straps']
                },
                {
                    id: 'burns',
                    title: 'Burn Treatment',
                    severity: 'high',
                    keywords: ['burn', 'thermal', 'chemical', 'scald', 'fire'],
                    summary: 'Burn assessment and treatment based on depth and body surface area.',
                    protocol: [
                        'STOP THE BURNING:',
                        '- Remove from source, remove clothing/jewelry',
                        '- Cool with cool (not cold) water for 10-20 minutes',
                        '- Do NOT use ice, butter, or other home remedies',
                        '',
                        'ASSESS DEPTH:',
                        '- Superficial (1st): Red, painful, no blisters',
                        '- Partial thickness (2nd): Blisters, very painful, red/white',
                        '- Full thickness (3rd): White/brown/black, leathery, minimal pain',
                        '',
                        'ASSESS SIZE (Rule of 9s for adults):',
                        '- Head: 9%, Each arm: 9%, Chest: 18%, Back: 18%',
                        '- Each leg: 18%, Groin: 1%',
                        '- Patient palm = 1% BSA',
                        '',
                        'TREATMENT:',
                        '- Cover with clean, dry dressing (non-adherent if available)',
                        '- Do NOT break blisters',
                        '- Elevate burned extremities',
                        '- Aggressive fluid replacement for burns >15% BSA'
                    ],
                    notes: 'Circumferential burns can cut off circulation - monitor closely. Face/airway burns may cause swelling - prepare for difficult airway.',
                    equipment: ['Burn dressing', 'Non-adherent gauze', 'Clean water', 'Pain medication']
                }
            ]
        },

        // =====================================================
        // ENVIRONMENTAL EMERGENCIES
        // =====================================================
        environmental: {
            name: 'Environmental',
            icon: '🌡️',
            color: '#3b82f6',
            items: [
                {
                    id: 'hypothermia',
                    title: 'Hypothermia',
                    severity: 'critical',
                    keywords: ['cold', 'hypothermia', 'freezing', 'shivering', 'core temperature'],
                    summary: 'Core body temperature drops below 95°F (35°C), potentially fatal.',
                    protocol: [
                        'MILD (90-95°F / 32-35°C):',
                        '- Shivering, impaired coordination',
                        '- Remove wet clothing, add dry insulation',
                        '- Give warm sweet drinks if alert',
                        '- Gentle exercise to generate heat',
                        '',
                        'MODERATE (82-90°F / 28-32°C):',
                        '- Shivering stops, confusion, slurred speech',
                        '- Handle gently - rough movement can trigger cardiac arrest',
                        '- Insulate from ground, cover head',
                        '- Apply heat packs to neck, armpits, groin (not directly on skin)',
                        '- No drinks if altered mental status',
                        '',
                        'SEVERE (<82°F / <28°C):',
                        '- Unconscious, may appear dead',
                        '- Check pulse for 60 seconds before starting CPR',
                        '- Evacuate immediately - field rewarming difficult',
                        '- "Not dead until warm and dead"'
                    ],
                    notes: 'Afterdrop: Core temp may continue dropping during rewarming as cold blood returns from extremities. Rewarm core first.',
                    equipment: ['Sleeping bag', 'Vapor barrier', 'Heat packs', 'Insulation', 'Warm fluids']
                },
                {
                    id: 'heat-exhaustion',
                    title: 'Heat Exhaustion',
                    severity: 'high',
                    keywords: ['heat', 'exhaustion', 'dehydration', 'sweating', 'hot'],
                    summary: 'Body overheating with intact thermoregulation - precursor to heat stroke.',
                    protocol: [
                        'SIGNS:',
                        '- Heavy sweating, weakness, nausea',
                        '- Headache, dizziness',
                        '- Pale, cool, moist skin',
                        '- Normal to slightly elevated temperature',
                        '- Mental status intact',
                        '',
                        'TREATMENT:',
                        '- Move to shade/cool area',
                        '- Remove excess clothing',
                        '- Lie down with legs elevated',
                        '- Cool with water, wet cloths, fanning',
                        '- Oral rehydration if alert: water + electrolytes',
                        '- Rest - no exertion for remainder of day minimum',
                        '',
                        'MONITOR for progression to heat stroke'
                    ],
                    notes: 'Prevention: Acclimatize gradually, hydrate before thirst, take breaks, use electrolytes.',
                    equipment: ['Shade structure', 'Water', 'Electrolyte mix', 'Spray bottle']
                },
                {
                    id: 'heat-stroke',
                    title: 'Heat Stroke',
                    severity: 'critical',
                    keywords: ['heat stroke', 'hyperthermia', 'hot', 'confusion', 'not sweating'],
                    summary: 'Life-threatening emergency - core temp >104°F with altered mental status.',
                    protocol: [
                        'SIGNS:',
                        '- Core temp >104°F (40°C)',
                        '- Altered mental status (confusion, combative, unconscious)',
                        '- May or may not be sweating',
                        '- Hot, flushed skin',
                        '- Rapid pulse, rapid breathing',
                        '',
                        'TREATMENT - COOL AGGRESSIVELY:',
                        '- This is a true emergency - cool first, transport second',
                        '- Remove clothing',
                        '- Ice water immersion if possible (best method)',
                        '- If no immersion: wet entire body + fan continuously',
                        '- Ice packs to neck, armpits, groin',
                        '- Do NOT give fluids if altered mental status',
                        '- Continue cooling until temp <102°F or mental status improves',
                        '- Evacuate urgently'
                    ],
                    notes: 'Every minute of delay increases organ damage risk. Mortality increases dramatically above 106°F. Cool first!',
                    equipment: ['Cold water', 'Ice', 'Tarp for immersion', 'Thermometer']
                },
                {
                    id: 'altitude-sickness',
                    title: 'Altitude Sickness (AMS/HACE/HAPE)',
                    severity: 'high',
                    keywords: ['altitude', 'mountain sickness', 'ams', 'hace', 'hape', 'elevation'],
                    summary: 'Spectrum of illness from mild AMS to life-threatening HACE/HAPE.',
                    protocol: [
                        'ACUTE MOUNTAIN SICKNESS (AMS):',
                        '- Headache + one of: nausea, fatigue, dizziness, poor sleep',
                        '- Treatment: Stop ascent, rest, hydrate, ibuprofen/acetaminophen',
                        '- Descend if symptoms worsen or don\'t improve in 24h',
                        '',
                        'HIGH ALTITUDE CEREBRAL EDEMA (HACE):',
                        '- AMS + ataxia (can\'t walk straight) or altered mental status',
                        '- IMMEDIATE DESCENT - this is life-threatening',
                        '- Dexamethasone 8mg then 4mg every 6h if available',
                        '- Supplemental oxygen',
                        '',
                        'HIGH ALTITUDE PULMONARY EDEMA (HAPE):',
                        '- Breathless at rest, dry cough, pink frothy sputum',
                        '- Crackles in lungs, cyanosis',
                        '- IMMEDIATE DESCENT',
                        '- Nifedipine 30mg extended-release if available',
                        '- Supplemental oxygen, keep warm, minimize exertion'
                    ],
                    notes: 'Prevention: Ascend slowly (<1000ft/day above 10,000ft), "climb high sleep low", acetazolamide (Diamox) 125mg BID starting 24h before ascent.',
                    equipment: ['Pulse oximeter', 'Dexamethasone', 'Nifedipine', 'Acetazolamide', 'Oxygen']
                },
                {
                    id: 'frostbite',
                    title: 'Frostbite',
                    severity: 'high',
                    keywords: ['frostbite', 'frozen', 'cold injury', 'fingers', 'toes'],
                    summary: 'Tissue freezing, typically affecting extremities.',
                    protocol: [
                        'FROSTNIP (superficial):',
                        '- Numbness, white/waxy skin, soft when pressed',
                        '- Rewarm with body heat (armpits, warm hands)',
                        '- No permanent damage expected',
                        '',
                        'FROSTBITE:',
                        '- Hard, frozen tissue; white/gray/blue color',
                        '- Do NOT rewarm if there\'s risk of refreezing (makes it worse)',
                        '- Do NOT rub or massage frozen tissue',
                        '',
                        'REWARMING (only if no refreezing risk):',
                        '- Water bath 98.6-102°F (37-39°C)',
                        '- Takes 30-60 minutes until tissue is soft and red/purple',
                        '- Extremely painful - give strongest pain meds available',
                        '- After rewarming: loosely bandage, separate digits',
                        '- Do NOT break blisters',
                        '- Ibuprofen for anti-inflammatory effect'
                    ],
                    notes: 'Frozen tissue is surprisingly durable for travel. Better to walk out on frozen feet than rewarm and be unable to move. Avoid alcohol and tobacco.',
                    equipment: ['Thermometer', 'Warm water container', 'Pain medication', 'Loose bandages', 'Ibuprofen']
                },
                {
                    id: 'lightning',
                    title: 'Lightning Strike',
                    severity: 'critical',
                    keywords: ['lightning', 'electrical', 'thunder', 'storm'],
                    summary: 'Lightning strike injury assessment and treatment.',
                    protocol: [
                        'SCENE SAFETY:',
                        '- If storm ongoing, move victim only if safe to do so',
                        '- Lightning can strike twice in same location',
                        '',
                        'ASSESSMENT:',
                        '- Lightning victims are safe to touch immediately',
                        '- Primary cause of death: cardiac arrest',
                        '- Check breathing and pulse',
                        '',
                        'TREATMENT:',
                        '- Begin CPR immediately if no pulse - survival rates better than other cardiac arrest',
                        '- Treat multiple victims: prioritize those who appear dead (reverse triage)',
                        '- Look for entry/exit burns',
                        '- Assume spinal injury if patient was thrown',
                        '- Monitor for: ruptured eardrums, eye injuries, confusion',
                        '',
                        'All lightning strike victims need medical evaluation'
                    ],
                    notes: 'Prevention: 30/30 rule - shelter when lightning-to-thunder <30 seconds, stay sheltered 30 minutes after last thunder.',
                    equipment: ['CPR capability', 'Burn supplies', 'Spinal precautions']
                },
                {
                    id: 'drowning',
                    title: 'Drowning / Submersion',
                    severity: 'critical',
                    keywords: ['drowning', 'submersion', 'water', 'swimming', 'near drowning'],
                    summary: 'Water submersion causing respiratory impairment.',
                    protocol: [
                        'RESCUE:',
                        '- Reach, throw, row, then go (protect yourself)',
                        '- Assume spinal injury if diving or mechanism unknown',
                        '',
                        'IMMEDIATE CARE:',
                        '- Remove from water horizontally if possible',
                        '- If not breathing, begin rescue breaths immediately',
                        '- If no pulse, begin CPR',
                        '- Do NOT attempt to drain water from lungs',
                        '- Abdominal thrusts not recommended',
                        '',
                        'POST-RESCUE:',
                        '- All submersion victims need medical evaluation',
                        '- Remove wet clothing, prevent hypothermia',
                        '- Monitor closely - can deteriorate hours later',
                        '- Supplemental oxygen if available',
                        '- Position: if breathing, recovery position'
                    ],
                    notes: 'Fresh vs salt water: clinically not different in treatment. Cold water drowning: continue CPR longer - hypothermia is protective.',
                    equipment: ['Throw rope', 'PFD', 'Rescue breathing barrier', 'Dry clothes/blankets']
                },
                {
                    id: 'dehydration',
                    title: 'Dehydration Assessment',
                    severity: 'moderate',
                    keywords: ['dehydration', 'fluid loss', 'dry mouth', 'urine', 'skin turgor', 'thirst'],
                    summary: 'Systematic assessment of dehydration severity using field-available signs, with oral rehydration protocol.',
                    protocol: [
                        'ASSESSMENT SIGNS:',
                        '- Skin turgor: pinch skin on back of hand — return >2 seconds = dehydrated',
                        '- Mucous membranes: dry, sticky mouth and lips',
                        '- Urine color: dark yellow to brown indicates significant dehydration',
                        '- Capillary refill: press fingernail, release — >2 seconds = poor perfusion',
                        '- Mental status: confusion or irritability in moderate-severe cases',
                        '- Heart rate: elevated at rest (body compensating for low volume)',
                        '',
                        'SEVERITY STAGING:',
                        '- **Stage I — Mild (3-5% body weight lost)**:',
                        '  Thirst, dry mouth, slightly decreased urine, mild fatigue',
                        '- **Stage II — Moderate (6-9% body weight lost)**:',
                        '  Rapid pulse, sunken eyes, skin tenting, very dark urine, dizziness on standing',
                        '- **Stage III — Severe (>10% body weight lost)**:',
                        '  Altered consciousness, no urine output, weak rapid pulse, shock',
                        '  ⚠️ Life-threatening — evacuate immediately',
                        '',
                        'FIELD TREATMENT:',
                        '- Mild: Oral fluids — 1-2 liters over 2-4 hours, rest in shade',
                        '- Moderate: ORS (6 tsp sugar + ½ tsp salt per liter) — small frequent sips',
                        '  Target 100 ml/kg over 4 hours',
                        '- Severe: ORS if conscious, evacuate for IV fluids',
                        '- Monitor urine output as primary recovery indicator',
                        '- Goal: light yellow urine every 2-3 hours',
                        '',
                        'URINE COLOR GUIDE:',
                        '- Clear/pale: Adequate (possibly over-hydrated)',
                        '- Light yellow: Ideal hydration',
                        '- Yellow: Beginning dehydration — increase intake',
                        '- Dark yellow/amber: Dehydrated — ORS needed',
                        '- Brown/tea-colored: Severe dehydration or possible rhabdomyolysis ⚠️',
                        '',
                        'PREVENTION:',
                        '- Pre-hydrate: 500ml 2 hours before exertion',
                        '- During activity: 250ml every 20-30 minutes',
                        '- Replace electrolytes during prolonged sweating (>1 hour)',
                        '- Monitor urine color throughout the day'
                    ],
                    notes: 'Thirst is a late indicator — by the time you feel thirsty, you are already 1-2% dehydrated. In hot environments, a working adult can lose 1-2 liters of sweat per hour. Dark urine is the most reliable field indicator of dehydration status.',
                    equipment: ['ORS ingredients (water, sugar, salt)', 'Water container with markings', 'Watch for monitoring intervals']
                },
                {
                    id: 'trench-foot',
                    title: 'Trench Foot / Immersion Foot',
                    severity: 'moderate',
                    keywords: ['trench foot', 'immersion foot', 'wet feet', 'cold injury', 'nonfreezing', 'foot care'],
                    summary: 'Non-freezing cold injury from prolonged exposure to wet, cold conditions — preventable but debilitating if it develops.',
                    protocol: [
                        'CAUSES:',
                        '- Feet wet and cold (but above freezing) for 12+ hours',
                        '- Temperature range: 32-60°F (0-16°C)',
                        '- Tight boots that restrict circulation accelerate onset',
                        '- Does NOT require freezing temperatures — 50°F and wet is enough',
                        '',
                        'STAGES:',
                        '- **Stage 1 — Injury phase**: Feet cold, numb, pale/white, wrinkled',
                        '  May not feel pain — numbness masks the damage',
                        '- **Stage 2 — Immediate post-exposure**: Feet become red, swollen, painful',
                        '  Hot, burning sensation as blood flow returns',
                        '  This is when most people realize they have a problem',
                        '- **Stage 3 — Hyperemic phase (days-weeks)**: Intense pain, blisters possible',
                        '  Extreme sensitivity to cold that can persist for months or years',
                        '',
                        'RECOGNITION:',
                        '- Feet numb, cold, and discolored (pale, waxy, or blotchy red/blue)',
                        '- Skin soft and waterlogged (macerated)',
                        '- Swelling that doesn\'t improve when feet are elevated',
                        '- Pain, tingling, or burning when feet begin to rewarm',
                        '- In advanced cases: blisters, skin peeling, open sores',
                        '',
                        'TREATMENT:',
                        '- Remove wet boots and socks immediately',
                        '- Air dry feet — do NOT rub, massage, or apply direct heat',
                        '- Elevate feet slightly above heart level',
                        '- Let feet rewarm SLOWLY at room/body temperature',
                        '- Do NOT walk on affected feet if avoidable',
                        '- Ibuprofen for pain and inflammation',
                        '- Keep feet clean and dry — infection risk is high',
                        '- Loosely wrap in dry, clean material',
                        '⚠️ Do NOT pop blisters — high infection risk',
                        '',
                        'PREVENTION (Critical):',
                        '- Change socks every 4-6 hours in wet conditions',
                        '- Carry extra dry socks in a waterproof bag',
                        '- Air dry feet during rest breaks (even 10 minutes helps)',
                        '- Apply antiperspirant or foot powder',
                        '- Loosen boots when stationary to improve circulation',
                        '- Sleep with dry socks and boots removed if possible'
                    ],
                    notes: 'Trench foot is 100% preventable with proper foot care but becomes a mission-ending injury once it develops. The numbness phase is deceptive — the feet feel fine until you take your boots off and the damage becomes apparent. In field operations, enforced sock rotation every 4-6 hours is the single most important prevention measure.',
                    equipment: ['Extra dry socks (minimum 3 pairs)', 'Waterproof bag for dry socks', 'Foot powder/antiperspirant', 'Ibuprofen']
                }
            ]
        },

        // =====================================================
        // MEDICAL EMERGENCIES
        // =====================================================
        medical: {
            name: 'Medical Emergencies',
            icon: '💊',
            color: '#8b5cf6',
            items: [
                {
                    id: 'anaphylaxis',
                    title: 'Anaphylaxis',
                    severity: 'critical',
                    keywords: ['allergy', 'anaphylaxis', 'allergic reaction', 'epipen', 'swelling'],
                    summary: 'Severe allergic reaction that can rapidly become life-threatening.',
                    protocol: [
                        'SIGNS:',
                        '- Hives, itching, flushing',
                        '- Swelling of face, lips, tongue, throat',
                        '- Difficulty breathing, wheezing',
                        '- Rapid pulse, dizziness, feeling of doom',
                        '- Nausea, vomiting, abdominal pain',
                        '',
                        'TREATMENT:',
                        '- EPINEPHRINE is the only life-saving treatment',
                        '- EpiPen: Remove cap, jab into outer thigh (through clothing OK)',
                        '- Hold for 10 seconds',
                        '- If no improvement in 5-15 minutes, give second dose',
                        '- Position: sitting up if breathing difficulty, legs elevated if shock',
                        '- Give antihistamine (Benadryl 50mg) - but NOT instead of epi',
                        '- Evacuate - biphasic reaction can occur hours later'
                    ],
                    notes: 'Epinephrine has no contraindications in anaphylaxis - give it even if patient has heart conditions. Effects last only 15-20 minutes.',
                    equipment: ['Epinephrine auto-injector', 'Diphenhydramine (Benadryl)', 'Second epi dose']
                },
                {
                    id: 'asthma',
                    title: 'Asthma Attack',
                    severity: 'high',
                    keywords: ['asthma', 'wheezing', 'inhaler', 'breathing', 'bronchospasm'],
                    summary: 'Acute bronchospasm causing breathing difficulty.',
                    protocol: [
                        'SIGNS:',
                        '- Wheezing, shortness of breath',
                        '- Chest tightness, coughing',
                        '- Difficulty speaking in full sentences',
                        '- Using accessory muscles to breathe',
                        '',
                        'TREATMENT:',
                        '- Sit patient upright',
                        '- Assist with their rescue inhaler (albuterol)',
                        '- Shake inhaler, 2 puffs with spacer if available',
                        '- Can repeat every 20 minutes up to 3 times',
                        '- Stay calm - anxiety worsens bronchospasm',
                        '',
                        'SEVERE ATTACK (needs evacuation):',
                        '- No improvement with inhaler',
                        '- Can\'t speak, blue lips',
                        '- Silent chest (too tight to wheeze)',
                        '- Epinephrine can be used for severe attack'
                    ],
                    notes: 'Caffeine has mild bronchodilator effect. Cold air can trigger attacks - breathe through buff/scarf.',
                    equipment: ['Rescue inhaler (albuterol)', 'Spacer', 'Epinephrine for severe cases']
                },
                {
                    id: 'diabetic-emergency',
                    title: 'Diabetic Emergency',
                    severity: 'critical',
                    keywords: ['diabetes', 'blood sugar', 'hypoglycemia', 'hyperglycemia', 'insulin'],
                    summary: 'Blood sugar too low (hypoglycemia) or too high (hyperglycemia).',
                    protocol: [
                        'HYPOGLYCEMIA (low blood sugar) - MORE COMMON EMERGENCY:',
                        '- Rapid onset: shaking, sweating, confusion, irritability',
                        '- May progress to unconsciousness/seizures',
                        '- Treatment: GIVE SUGAR immediately',
                        '- If conscious: juice, candy, glucose tabs (15-20g sugar)',
                        '- If unconscious: glucose gel rubbed on gums',
                        '- Glucagon injection if available and trained',
                        '- Response should occur in 10-15 minutes',
                        '',
                        'HYPERGLYCEMIA (high blood sugar):',
                        '- Gradual onset: thirst, frequent urination, nausea',
                        '- Fruity breath odor (ketoacidosis)',
                        '- Treatment requires insulin - evacuate',
                        '- Encourage water intake if conscious',
                        '',
                        'IF UNSURE: Give sugar - it won\'t significantly harm high blood sugar but will save a hypoglycemic'
                    ],
                    notes: 'Known diabetic altered mental status = give sugar. Check for medical ID bracelet/necklace.',
                    equipment: ['Glucose tablets/gel', 'Glucagon kit', 'Juice boxes', 'Candy']
                },
                {
                    id: 'seizure',
                    title: 'Seizure',
                    severity: 'high',
                    keywords: ['seizure', 'convulsion', 'epilepsy', 'fitting'],
                    summary: 'Abnormal electrical brain activity causing involuntary movements.',
                    protocol: [
                        'DURING SEIZURE:',
                        '- Protect from injury: move away from hazards',
                        '- Do NOT restrain - let it run its course',
                        '- Do NOT put anything in mouth',
                        '- Time the seizure - important information',
                        '- Place something soft under head',
                        '',
                        'AFTER SEIZURE (postictal phase):',
                        '- Place in recovery position',
                        '- Patient will be confused, sleepy - this is normal',
                        '- Stay with them until fully alert',
                        '- Check for injuries, incontinence',
                        '',
                        'EVACUATE IF:',
                        '- First seizure ever',
                        '- Seizure >5 minutes',
                        '- Multiple seizures without full recovery',
                        '- Seizure in water',
                        '- Pregnant',
                        '- Known diabetic',
                        '- Significant injury during seizure'
                    ],
                    notes: 'Known epileptic with typical seizure who recovers fully may not need evacuation if they have medication and this is their normal pattern.',
                    equipment: ['Padding', 'Watch/timer', 'Recovery position aids']
                },
                {
                    id: 'chest-pain',
                    title: 'Chest Pain / Heart Attack',
                    severity: 'critical',
                    keywords: ['heart attack', 'cardiac', 'chest pain', 'mi', 'myocardial'],
                    summary: 'Potential cardiac emergency requiring immediate action.',
                    protocol: [
                        'HEART ATTACK SIGNS:',
                        '- Chest pressure, squeezing, heaviness (not sharp)',
                        '- Pain radiating to jaw, arm, back',
                        '- Shortness of breath',
                        '- Nausea, sweating, feeling of doom',
                        '- Women may have atypical symptoms: fatigue, nausea only',
                        '',
                        'TREATMENT:',
                        '- Stop all activity, rest in position of comfort',
                        '- Aspirin 324mg (4 baby aspirin) - chew, don\'t swallow whole',
                        '- Nitroglycerin if prescribed and BP not low',
                        '- Loosen tight clothing',
                        '- Calm reassurance - anxiety increases oxygen demand',
                        '- Be prepared for CPR',
                        '- Evacuate immediately - time is heart muscle'
                    ],
                    notes: 'Not all chest pain is cardiac - but treat as cardiac until proven otherwise. Aspirin reduces mortality if given early.',
                    equipment: ['Aspirin', 'Patient\'s own medications', 'CPR capability']
                },
                {
                    id: 'stroke',
                    title: 'Stroke',
                    severity: 'critical',
                    keywords: ['stroke', 'cva', 'facial droop', 'weakness', 'speech'],
                    summary: 'Brain attack from blocked or bleeding vessel - time critical.',
                    protocol: [
                        'RECOGNIZE STROKE (BE FAST):',
                        '- Balance: sudden dizziness, loss of coordination',
                        '- Eyes: vision changes',
                        '- Face: facial droop (ask to smile)',
                        '- Arms: arm weakness (raise both arms)',
                        '- Speech: slurred or confused speech',
                        '- Time: note time symptoms started',
                        '',
                        'TREATMENT:',
                        '- Time is critical - brain cells dying every minute',
                        '- Do NOT give aspirin (could be bleeding stroke)',
                        '- Position: head elevated 30°',
                        '- Nothing by mouth (swallowing may be impaired)',
                        '- Protect airway - may vomit',
                        '- Calm reassurance',
                        '- Evacuate immediately',
                        '',
                        'Note exact time of symptom onset - affects treatment options'
                    ],
                    notes: 'Treatment with clot-busting drugs most effective within 3 hours. Evacuation is the treatment.',
                    equipment: ['Evacuation capability', 'Airway management', 'Suction if available']
                },
                {
                    id: 'abdominal-pain',
                    title: 'Abdominal Emergencies',
                    severity: 'high',
                    keywords: ['abdomen', 'stomach', 'appendicitis', 'abdominal pain'],
                    summary: 'Assessment of potentially serious abdominal conditions.',
                    protocol: [
                        'RED FLAGS (evacuate immediately):',
                        '- Rigid, board-like abdomen',
                        '- Severe pain that suddenly becomes painless (perforation)',
                        '- Blood in vomit or stool',
                        '- Fever with severe abdominal pain',
                        '- Pain that started around umbilicus and moved to right lower quadrant (appendicitis)',
                        '- Signs of shock with abdominal pain',
                        '',
                        'ASSESSMENT:',
                        '- Location of pain',
                        '- Character (crampy vs constant)',
                        '- Associated symptoms (N/V, fever, bowel changes)',
                        '- Last bowel movement, last meal',
                        '- Menstrual history if applicable',
                        '',
                        'GENERAL MANAGEMENT:',
                        '- NPO (nothing by mouth) if serious condition suspected',
                        '- Position of comfort (usually knees bent)',
                        '- Monitor vital signs',
                        '- Pain medication may mask important findings'
                    ],
                    notes: 'Abdominal pain in wilderness requires evacuation if not clearly minor (like gas or known condition). Peritonitis is life-threatening.',
                    equipment: ['Thermometer', 'Pain medication (if long evacuation)', 'IV fluids if trained']
                }
            ]
        },

        // =====================================================
        // BITES & STINGS
        // =====================================================
        bites: {
            name: 'Bites & Stings',
            icon: '🐍',
            color: '#22c55e',
            items: [
                {
                    id: 'snake-bite',
                    title: 'Snake Bite',
                    severity: 'high',
                    keywords: ['snake', 'bite', 'venom', 'rattlesnake', 'pit viper'],
                    summary: 'Venomous snake bite management and evacuation.',
                    protocol: [
                        'DO:',
                        '- Remove from striking range of snake',
                        '- Keep patient calm and still - movement spreads venom',
                        '- Remove jewelry/watches before swelling',
                        '- Splint bitten extremity, keep at or below heart level',
                        '- Mark edge of swelling with pen and time',
                        '- Clean wound gently',
                        '- Evacuate - all venomous bites need antivenin evaluation',
                        '',
                        'DO NOT:',
                        '- Cut and suck',
                        '- Apply tourniquet',
                        '- Apply ice',
                        '- Apply electric shock',
                        '- Give alcohol',
                        '- Try to catch the snake',
                        '',
                        'Monitor for: spreading swelling, bruising, nausea, weakness, difficulty breathing'
                    ],
                    notes: '25% of pit viper bites are "dry" (no venom). Still evacuate. Take photo of snake if safe to do so. Most important factor is rapid evacuation.',
                    equipment: ['Splint material', 'Marker pen', 'Watch for timing', 'Wound care']
                },
                {
                    id: 'spider-bite',
                    title: 'Spider Bite',
                    severity: 'moderate',
                    keywords: ['spider', 'black widow', 'brown recluse', 'bite'],
                    summary: 'Management of potentially venomous spider bites.',
                    protocol: [
                        'BLACK WIDOW:',
                        '- Immediate pain, redness, two fang marks',
                        '- Muscle cramps spreading from bite, abdominal rigidity',
                        '- Headache, nausea, sweating',
                        '- Clean wound, apply ice pack',
                        '- Pain medication (muscle relaxants help)',
                        '- Evacuate - antivenin available for severe cases',
                        '',
                        'BROWN RECLUSE:',
                        '- Often painless initially',
                        '- "Bulls-eye" lesion develops over hours/days',
                        '- Can cause significant tissue death',
                        '- Clean wound, apply cool compress',
                        '- Evacuate if signs of systemic illness',
                        '',
                        'GENERAL:',
                        '- Most spider bites are harmless',
                        '- If possible, capture/photograph spider safely',
                        '- Watch for signs of infection'
                    ],
                    notes: 'Many "spider bites" are actually other conditions (MRSA, etc.). Seek care if wound worsens over 24-48 hours.',
                    equipment: ['Ice pack', 'Pain medication', 'Wound care supplies']
                },
                {
                    id: 'bee-wasp-sting',
                    title: 'Bee & Wasp Stings',
                    severity: 'moderate',
                    keywords: ['bee', 'wasp', 'sting', 'hornet', 'yellow jacket'],
                    summary: 'Treatment of stings and monitoring for allergic reaction.',
                    protocol: [
                        'NORMAL REACTION:',
                        '- Pain, redness, swelling at site',
                        '- Remove stinger quickly (scrape, don\'t squeeze)',
                        '- Clean area with soap and water',
                        '- Ice pack for swelling',
                        '- Antihistamine (Benadryl) for itching',
                        '- Pain reliever as needed',
                        '',
                        'LARGE LOCAL REACTION:',
                        '- Swelling extending beyond sting site',
                        '- Still not anaphylaxis',
                        '- Antihistamine, ice, elevation',
                        '- Consider steroids if available',
                        '',
                        'WATCH FOR ANAPHYLAXIS:',
                        '- Hives away from sting site',
                        '- Swelling of face/throat',
                        '- Difficulty breathing',
                        '- See Anaphylaxis protocol'
                    ],
                    notes: 'Multiple stings (>10-20) can cause systemic toxicity even without allergy. Known allergic individuals should carry epinephrine.',
                    equipment: ['Stiff card for stinger removal', 'Ice pack', 'Antihistamine', 'Epinephrine for allergic individuals']
                },
                {
                    id: 'tick-bite',
                    title: 'Tick Bite & Removal',
                    severity: 'low',
                    keywords: ['tick', 'lyme disease', 'rocky mountain spotted fever'],
                    summary: 'Proper tick removal and disease monitoring.',
                    protocol: [
                        'REMOVAL:',
                        '- Use fine-tipped tweezers',
                        '- Grasp tick as close to skin as possible',
                        '- Pull upward with steady, even pressure',
                        '- Don\'t twist or jerk (may break mouthparts)',
                        '- Don\'t squeeze tick body',
                        '',
                        'AFTER REMOVAL:',
                        '- Clean bite area with alcohol or soap/water',
                        '- Save tick in sealed container (for ID if illness develops)',
                        '- Note date of bite',
                        '',
                        'DO NOT:',
                        '- Use petroleum jelly, nail polish, or heat',
                        '- Wait for tick to detach on its own',
                        '',
                        'MONITOR FOR (2-30 days after bite):',
                        '- Expanding rash (especially "bulls-eye")',
                        '- Fever, fatigue, headache, muscle aches',
                        '- Seek care if symptoms develop'
                    ],
                    notes: 'Disease transmission usually requires attachment for 24-48+ hours. Regular tick checks are important prevention.',
                    equipment: ['Fine-tipped tweezers', 'Alcohol wipes', 'Small container for tick']
                },
                {
                    id: 'animal-bite',
                    title: 'Animal Bite / Rabies',
                    severity: 'high',
                    keywords: ['bite', 'animal', 'rabies', 'dog', 'wild animal'],
                    summary: 'Wound care and rabies risk assessment.',
                    protocol: [
                        'IMMEDIATE CARE:',
                        '- Control bleeding with direct pressure',
                        '- Wash wound thoroughly with soap and water for 15 minutes',
                        '- This significantly reduces rabies risk',
                        '- Irrigate deeply if possible',
                        '- Apply antibiotic ointment',
                        '- Bandage loosely',
                        '',
                        'RABIES RISK ASSESSMENT:',
                        '- HIGH risk: bats, raccoons, skunks, foxes, coyotes',
                        '- MODERATE: dogs/cats (depends on vaccination status)',
                        '- LOW: squirrels, rabbits, rodents',
                        '- Unprovoked attack = higher risk',
                        '',
                        'EVACUATE FOR:',
                        '- Any bite from high-risk animal',
                        '- Bite to face or hands',
                        '- Deep puncture wounds',
                        '- Signs of infection (redness, swelling, pus)',
                        '',
                        'Rabies is 100% fatal once symptoms start - when in doubt, evacuate'
                    ],
                    notes: 'If possible and safe, observe or contain animal for 10 days (dogs/cats). Bats: if bat was in room while sleeping, assume exposure.',
                    equipment: ['Soap', 'Water for irrigation', 'Antibiotic ointment', 'Bandages']
                }
            ]
        },

        // =====================================================
        // MEDICATIONS REFERENCE
        // =====================================================
        medications: {
            name: 'Medications',
            icon: '💉',
            color: '#f59e0b',
            items: [
                {
                    id: 'pain-meds',
                    title: 'Pain Medications',
                    severity: 'info',
                    keywords: ['pain', 'ibuprofen', 'acetaminophen', 'tylenol', 'advil', 'analgesic'],
                    summary: 'Over-the-counter and common prescription pain medications.',
                    protocol: [
                        'ACETAMINOPHEN (Tylenol):',
                        '- Dose: 500-1000mg every 6 hours (max 3000mg/day)',
                        '- Good for: pain, fever',
                        '- Caution: liver toxicity in overdose, avoid with alcohol',
                        '- Does NOT reduce inflammation',
                        '',
                        'IBUPROFEN (Advil, Motrin):',
                        '- Dose: 400-800mg every 6-8 hours with food (max 2400mg/day)',
                        '- Good for: pain, fever, inflammation, altitude sickness',
                        '- Caution: GI bleeding, kidney issues, avoid if dehydrated',
                        '',
                        'NAPROXEN (Aleve):',
                        '- Dose: 220-440mg every 12 hours with food (max 660mg/day)',
                        '- Longer lasting than ibuprofen',
                        '- Same cautions as ibuprofen',
                        '',
                        'COMBINING:',
                        '- Can alternate ibuprofen and acetaminophen safely',
                        '- Do NOT combine ibuprofen with naproxen (both NSAIDs)'
                    ],
                    notes: 'Acetaminophen and ibuprofen together are often more effective than either alone. Stay hydrated when using NSAIDs.',
                    equipment: ['Acetaminophen', 'Ibuprofen', 'Naproxen']
                },
                {
                    id: 'allergy-meds',
                    title: 'Allergy Medications',
                    severity: 'info',
                    keywords: ['allergy', 'antihistamine', 'benadryl', 'zyrtec', 'claritin'],
                    summary: 'Antihistamines for allergic reactions.',
                    protocol: [
                        'DIPHENHYDRAMINE (Benadryl):',
                        '- Dose: 25-50mg every 6 hours',
                        '- Fast-acting, good for acute reactions',
                        '- Causes drowsiness - useful as sleep aid',
                        '- Caution: impairs coordination, dry mouth',
                        '',
                        'CETIRIZINE (Zyrtec):',
                        '- Dose: 10mg once daily',
                        '- Less sedating than Benadryl',
                        '- Good for ongoing allergies',
                        '',
                        'LORATADINE (Claritin):',
                        '- Dose: 10mg once daily',
                        '- Non-sedating',
                        '- Takes longer to work',
                        '',
                        'FOR ANAPHYLAXIS:',
                        '- Antihistamines are NOT enough',
                        '- EPINEPHRINE is required',
                        '- Antihistamines can be given after epinephrine'
                    ],
                    notes: 'Benadryl causes significant impairment - don\'t operate vehicles or do technical activities. Use non-sedating options during the day.',
                    equipment: ['Diphenhydramine', 'Cetirizine or Loratadine']
                },
                {
                    id: 'gi-meds',
                    title: 'GI Medications',
                    severity: 'info',
                    keywords: ['diarrhea', 'nausea', 'vomiting', 'stomach', 'antacid', 'imodium'],
                    summary: 'Medications for gastrointestinal issues.',
                    protocol: [
                        'LOPERAMIDE (Imodium):',
                        '- Dose: 4mg initially, then 2mg after each loose stool (max 16mg/day)',
                        '- Slows gut motility',
                        '- Caution: avoid if bloody diarrhea or fever (may be bacterial)',
                        '',
                        'BISMUTH SUBSALICYLATE (Pepto-Bismol):',
                        '- Dose: 30ml or 2 tablets every 30-60 min (max 8 doses/day)',
                        '- Good for traveler\'s diarrhea, nausea',
                        '- Will turn stool/tongue black (normal)',
                        '- Avoid with aspirin allergy',
                        '',
                        'ONDANSETRON (Zofran, Rx):',
                        '- Dose: 4-8mg every 8 hours',
                        '- Excellent for nausea/vomiting',
                        '- Does not cause drowsiness',
                        '',
                        'OMEPRAZOLE (Prilosec):',
                        '- Dose: 20mg once daily',
                        '- For heartburn/acid reflux',
                        '- Takes a few days for full effect'
                    ],
                    notes: 'Diarrhea causes dehydration - oral rehydration (water + electrolytes) is most important treatment. Antibiotics may be needed for traveler\'s diarrhea.',
                    equipment: ['Loperamide', 'Bismuth subsalicylate', 'Ondansetron', 'Oral rehydration salts']
                },
                {
                    id: 'antibiotics',
                    title: 'Antibiotics (Prescription)',
                    severity: 'info',
                    keywords: ['antibiotic', 'infection', 'amoxicillin', 'azithromycin', 'cipro'],
                    summary: 'Common antibiotics for wilderness medical kits.',
                    protocol: [
                        'AMOXICILLIN-CLAVULANATE (Augmentin):',
                        '- Dose: 875/125mg twice daily',
                        '- Good for: skin infections, animal bites, dental infections',
                        '- Penicillin allergy = do not use',
                        '',
                        'AZITHROMYCIN (Z-Pack):',
                        '- Dose: 500mg day 1, then 250mg days 2-5',
                        '- Good for: respiratory infections, traveler\'s diarrhea',
                        '- Safe in penicillin allergy',
                        '',
                        'CIPROFLOXACIN (Cipro):',
                        '- Dose: 500mg twice daily',
                        '- Good for: traveler\'s diarrhea, UTI',
                        '- Caution: tendon problems, sun sensitivity',
                        '',
                        'TRIMETHOPRIM-SULFAMETHOXAZOLE (Bactrim):',
                        '- Dose: 160/800mg twice daily',
                        '- Good for: UTI, skin infections (including MRSA)',
                        '- Sulfa allergy = do not use',
                        '',
                        'Complete the full course even if feeling better'
                    ],
                    notes: 'Antibiotics require prescription. Discuss wilderness medical kit with physician before trip. Misuse contributes to resistance.',
                    equipment: ['Prescribed antibiotics', 'Physician guidance']
                },
                {
                    id: 'altitude-meds',
                    title: 'Altitude Medications',
                    severity: 'info',
                    keywords: ['altitude', 'diamox', 'acetazolamide', 'dexamethasone', 'nifedipine'],
                    summary: 'Medications for altitude illness prevention and treatment.',
                    protocol: [
                        'ACETAZOLAMIDE (Diamox) - Prevention:',
                        '- Dose: 125mg twice daily, starting 24h before ascent',
                        '- Speeds acclimatization',
                        '- Side effects: tingling, frequent urination, altered taste',
                        '- Sulfa allergy = use caution',
                        '',
                        'DEXAMETHASONE (Decadron) - Treatment:',
                        '- Dose: 8mg initially, then 4mg every 6 hours',
                        '- For HACE or severe AMS when descent delayed',
                        '- Does NOT help acclimatization - masks symptoms',
                        '- Must still descend',
                        '',
                        'NIFEDIPINE - Treatment:',
                        '- Dose: 30mg extended-release every 12 hours',
                        '- For HAPE',
                        '- Lowers pulmonary artery pressure',
                        '- Can cause headache, dizziness',
                        '',
                        'IBUPROFEN:',
                        '- 600mg every 8 hours can help prevent/treat AMS headache'
                    ],
                    notes: 'Descent is always the best treatment. Medications buy time for descent. Acetazolamide enhances acclimatization; dexamethasone just masks symptoms.',
                    equipment: ['Acetazolamide', 'Dexamethasone', 'Nifedipine', 'Pulse oximeter']
                },
                {
                    id: 'drug-interactions',
                    title: 'Common Drug Interactions',
                    severity: 'info',
                    keywords: ['interaction', 'drug interaction', 'contraindication'],
                    summary: 'Important medication interactions to avoid.',
                    protocol: [
                        'NSAIDS (Ibuprofen, Naproxen):',
                        '- + Blood thinners (warfarin) = increased bleeding',
                        '- + ACE inhibitors = reduced BP effect, kidney risk',
                        '- + Other NSAIDs = increased GI bleeding risk',
                        '- + Lithium = lithium toxicity',
                        '',
                        'ACETAMINOPHEN:',
                        '- + Alcohol = liver damage',
                        '- + Warfarin = increased bleeding risk',
                        '',
                        'ANTIHISTAMINES (Benadryl):',
                        '- + Alcohol = increased sedation',
                        '- + Other sedatives = additive effects',
                        '',
                        'FLUOROQUINOLONES (Cipro):',
                        '- + Antacids, calcium, iron = reduced absorption',
                        '- + NSAIDs = increased seizure risk',
                        '- + Steroids = increased tendon rupture risk',
                        '',
                        'GENERAL:',
                        '- Always know what medications someone takes',
                        '- When in doubt, don\'t combine medications'
                    ],
                    notes: 'This is not comprehensive. Always verify drug interactions when giving medications, especially to someone on chronic medications.',
                    equipment: ['Medication list for all party members']
                }
            ]
        },

        // =====================================================
        // ASSESSMENT & TRIAGE
        // =====================================================
        assessment: {
            name: 'Assessment',
            icon: '📋',
            color: '#06b6d4',
            items: [
                {
                    id: 'primary-survey',
                    title: 'Primary Survey (MARCH)',
                    severity: 'info',
                    keywords: ['primary survey', 'march', 'assessment', 'abcde', 'triage'],
                    summary: 'Initial rapid assessment to identify life threats.',
                    protocol: [
                        'M - MASSIVE HEMORRHAGE:',
                        '- Look for severe bleeding',
                        '- Control with tourniquet or pressure',
                        '',
                        'A - AIRWAY:',
                        '- Is airway open and clear?',
                        '- Head-tilt chin-lift (or jaw thrust if trauma)',
                        '- Clear obstructions',
                        '',
                        'R - RESPIRATION:',
                        '- Is patient breathing adequately?',
                        '- Look, listen, feel',
                        '- Check for chest wounds',
                        '',
                        'C - CIRCULATION:',
                        '- Check pulse (carotid or radial)',
                        '- Assess for shock (pale, cool, clammy)',
                        '- Control other bleeding',
                        '',
                        'H - HYPOTHERMIA/HEAD:',
                        '- Prevent heat loss',
                        '- Quick neuro check (AVPU)',
                        '',
                        'Address each problem as you find it before moving on'
                    ],
                    notes: 'MARCH is preferred in tactical/wilderness settings. Traditional ABCDE works similarly. Adapt to situation.',
                    equipment: ['Tourniquet', 'Airway adjuncts', 'Chest seal', 'Blanket']
                },
                {
                    id: 'vital-signs',
                    title: 'Vital Signs',
                    severity: 'info',
                    keywords: ['vital signs', 'pulse', 'respiration', 'blood pressure', 'temperature'],
                    summary: 'How to assess and interpret vital signs.',
                    protocol: [
                        'PULSE:',
                        '- Normal adult: 60-100 beats/minute',
                        '- Check radial (wrist) or carotid (neck)',
                        '- Count for 15 seconds × 4',
                        '- Note: regular vs irregular, strong vs weak',
                        '',
                        'RESPIRATION:',
                        '- Normal adult: 12-20 breaths/minute',
                        '- Watch chest rise, don\'t tell patient you\'re counting',
                        '- Note: labored, shallow, use of accessory muscles',
                        '',
                        'SKIN SIGNS (perfusion):',
                        '- Color: pink (normal), pale/gray (shock), blue (hypoxia)',
                        '- Temperature: warm (normal), cool (shock), hot (fever)',
                        '- Moisture: dry (normal), clammy (shock)',
                        '',
                        'AVPU (mental status):',
                        '- Alert',
                        '- Voice responsive',
                        '- Pain responsive',
                        '- Unresponsive',
                        '',
                        'Record vitals every 15-30 minutes and note trends'
                    ],
                    notes: 'Trends are more important than single readings. Vital signs in wilderness may differ from hospital norms.',
                    equipment: ['Watch with second hand', 'Thermometer', 'Blood pressure cuff (optional)', 'Pulse oximeter (optional)']
                },
                {
                    id: 'soap-notes',
                    title: 'SOAP Documentation',
                    severity: 'info',
                    keywords: ['documentation', 'soap', 'notes', 'record', 'patient care'],
                    summary: 'Standard format for documenting patient assessment.',
                    protocol: [
                        'S - SUBJECTIVE:',
                        '- Chief complaint in patient\'s words',
                        '- History of present illness',
                        '- OPQRST for pain (Onset, Provokes/Palliates, Quality, Radiates, Severity, Time)',
                        '- SAMPLE (Symptoms, Allergies, Medications, Past medical, Last intake, Events)',
                        '',
                        'O - OBJECTIVE:',
                        '- Vital signs with time',
                        '- Physical exam findings',
                        '- What you observe (not what patient reports)',
                        '',
                        'A - ASSESSMENT:',
                        '- Your working diagnosis/problem list',
                        '',
                        'P - PLAN:',
                        '- What you did',
                        '- What you plan to do',
                        '- Evacuation plan if needed',
                        '',
                        'Document everything - it helps next providers and protects you'
                    ],
                    notes: 'Use any paper available. Send documentation with patient during evacuation. Include responder names and times.',
                    equipment: ['Paper', 'Pen', 'Waterproof notebook']
                },
                {
                    id: 'triage',
                    title: 'Mass Casualty Triage',
                    severity: 'info',
                    keywords: ['triage', 'mci', 'start', 'mass casualty'],
                    summary: 'Rapid triage system for multiple patients.',
                    protocol: [
                        'START TRIAGE:',
                        '',
                        '1. Can patient walk? → GREEN (Minor)',
                        '',
                        '2. Check breathing:',
                        '   - Not breathing → Open airway → Still not breathing → BLACK (Deceased)',
                        '   - Breathing after airway opened → RED (Immediate)',
                        '   - Respiratory rate >30 → RED (Immediate)',
                        '',
                        '3. Check perfusion:',
                        '   - Radial pulse absent OR cap refill >2 sec → RED (Immediate)',
                        '',
                        '4. Check mental status:',
                        '   - Can\'t follow simple commands → RED (Immediate)',
                        '',
                        '5. If passed all checks → YELLOW (Delayed)',
                        '',
                        'CATEGORIES:',
                        '- RED/Immediate: Life-threatening but survivable',
                        '- YELLOW/Delayed: Serious but can wait',
                        '- GREEN/Minor: Walking wounded',
                        '- BLACK/Deceased: Dead or unsalvageable'
                    ],
                    notes: 'Triage is dynamic - recheck patients. Goal is greatest good for greatest number. In wilderness, may need to prioritize who gets evacuated first.',
                    equipment: ['Triage tags', 'Marker', 'Flagging tape']
                }
            ]
        },

        // =====================================================
        // PROCEDURES
        // =====================================================
        procedures: {
            name: 'Procedures',
            icon: '🩺',
            color: '#ec4899',
            items: [
                {
                    id: 'cpr',
                    title: 'CPR',
                    severity: 'critical',
                    keywords: ['cpr', 'cardiac arrest', 'compressions', 'rescue breathing', 'aed'],
                    summary: 'Cardiopulmonary resuscitation for cardiac arrest.',
                    protocol: [
                        'ADULT CPR:',
                        '1. Confirm unresponsive - tap shoulders, shout',
                        '2. Call for help, get AED if available',
                        '3. Check pulse (carotid) for max 10 seconds',
                        '4. If no pulse, begin compressions:',
                        '   - Center of chest, between nipples',
                        '   - Push hard (2+ inches) and fast (100-120/min)',
                        '   - Allow full chest recoil',
                        '   - 30 compressions, then 2 breaths',
                        '   - Continue 30:2 ratio',
                        '',
                        'COMPRESSION-ONLY CPR:',
                        '- If untrained or unwilling to give breaths',
                        '- Continuous compressions without stopping',
                        '',
                        'AED:',
                        '- Turn on, follow prompts',
                        '- Bare chest, attach pads',
                        '- Don\'t touch during analysis/shock',
                        '- Resume CPR immediately after shock',
                        '',
                        'Continue until: patient recovers, help arrives, or you\'re exhausted'
                    ],
                    notes: 'High-quality compressions are most important. Push hard. Minimize interruptions. Drowning/asphyxiation: start with 5 rescue breaths. Hypothermia: continue CPR longer.',
                    equipment: ['AED', 'CPR barrier mask', 'Firm surface']
                },
                {
                    id: 'choking',
                    title: 'Choking / Airway Obstruction',
                    severity: 'critical',
                    keywords: ['choking', 'obstruction', 'heimlich', 'airway'],
                    summary: 'Relief of foreign body airway obstruction.',
                    protocol: [
                        'CONSCIOUS ADULT - SEVERE OBSTRUCTION:',
                        '- Can\'t speak, cough, or breathe',
                        '- Abdominal thrusts (Heimlich):',
                        '  - Stand behind, arms around waist',
                        '  - Fist above navel, thumb side in',
                        '  - Quick upward thrusts',
                        '  - Repeat until object expelled or unconscious',
                        '',
                        'PREGNANT OR OBESE:',
                        '- Chest thrusts instead of abdominal',
                        '',
                        'UNCONSCIOUS:',
                        '- Lower to ground',
                        '- Begin CPR (30 compressions)',
                        '- Before breaths, look in mouth - remove visible object',
                        '- Continue CPR',
                        '',
                        'SELF:',
                        '- Use own fist for thrusts',
                        '- Or thrust against chair back/countertop',
                        '',
                        'INFANT (<1 year):',
                        '- 5 back slaps + 5 chest thrusts',
                        '- Support head, face down on forearm'
                    ],
                    notes: 'Mild obstruction (can cough/speak): encourage coughing, don\'t interfere. Blind finger sweeps not recommended.',
                    equipment: ['Training in technique']
                },
                {
                    id: 'splinting',
                    title: 'Splinting Techniques',
                    severity: 'info',
                    keywords: ['splint', 'immobilize', 'fracture', 'sam splint'],
                    summary: 'Proper splinting of suspected fractures.',
                    protocol: [
                        'PRINCIPLES:',
                        '- Immobilize joint above and below injury',
                        '- Splint in position found (unless no pulse)',
                        '- Pad all voids and bony prominences',
                        '- Check CMS before and after (Circulation, Motor, Sensation)',
                        '',
                        'ARM/WRIST:',
                        '- SAM splint or padded boards',
                        '- Forearm: elbow to fingers',
                        '- Sling and swathe for support',
                        '',
                        'LEG:',
                        '- Two splints (medial and lateral) or traction splint for femur',
                        '- Pad well, secure at multiple points',
                        '',
                        'ANKLE:',
                        '- Figure-8 wrap or pillow splint',
                        '- Can walk if needed with proper support',
                        '',
                        'IMPROVISED MATERIALS:',
                        '- Sleeping pads, sticks, trekking poles',
                        '- Tape, belts, strips of clothing',
                        '- Buddy splinting (injured finger to adjacent finger)'
                    ],
                    notes: 'Snug but not tight - should be able to slide finger under. Check circulation frequently. Ice helps swelling (20 min on/20 off).',
                    equipment: ['SAM splint', 'Padding', 'Triangular bandages', 'Elastic bandage', 'Tape']
                },
                {
                    id: 'wound-closure',
                    title: 'Wound Closure',
                    severity: 'info',
                    keywords: ['wound', 'suture', 'steri-strips', 'closure', 'laceration'],
                    summary: 'Field wound closure techniques.',
                    protocol: [
                        'WHEN TO CLOSE IN FIELD:',
                        '- Clean cut (not crush/bite)',
                        '- Less than 6-8 hours old',
                        '- No signs of infection',
                        '- Evacuation >24 hours away',
                        '',
                        'WHEN NOT TO CLOSE:',
                        '- Animal/human bites',
                        '- Puncture wounds',
                        '- Contaminated wounds',
                        '- Signs of infection',
                        '- Wounds over 12 hours old',
                        '',
                        'STERI-STRIPS/BUTTERFLY CLOSURE:',
                        '- Clean and dry wound edges',
                        '- Apply strips perpendicular to wound',
                        '- Don\'t pull too tight',
                        '- Apply every 3-4mm',
                        '- Benzoin tincture helps adhesion',
                        '',
                        'WOUND CARE IF NOT CLOSING:',
                        '- Irrigate thoroughly with clean water',
                        '- Pack loosely with moist gauze',
                        '- Cover with dry dressing',
                        '- Change daily'
                    ],
                    notes: 'Irrigation is more important than closure. Use at least 500ml of clean water under pressure (syringe or squeeze bottle).',
                    equipment: ['Steri-strips', 'Benzoin tincture', 'Irrigation syringe', 'Sterile gauze', 'Clean water']
                },
                {
                    id: 'recovery-position',
                    title: 'Recovery Position',
                    severity: 'info',
                    keywords: ['recovery position', 'unconscious', 'breathing', 'lateral recumbent'],
                    summary: 'Safe positioning for unconscious breathing patient.',
                    protocol: [
                        'INDICATION:',
                        '- Unconscious but breathing',
                        '- No suspected spinal injury',
                        '',
                        'PROCEDURE:',
                        '1. Kneel beside patient',
                        '2. Place near arm at right angle to body',
                        '3. Bring far arm across chest, hold hand against cheek',
                        '4. Bend far knee up',
                        '5. Roll patient toward you onto side',
                        '6. Adjust top leg for stability (hip and knee at 90°)',
                        '7. Tilt head back slightly to open airway',
                        '8. Position hand under cheek to maintain head position',
                        '',
                        'MONITORING:',
                        '- Check breathing frequently',
                        '- Switch sides every 30 minutes if prolonged',
                        '- Be ready to roll supine for CPR if needed'
                    ],
                    notes: 'Position allows fluids to drain from mouth, maintains open airway. Left side preferred for pregnant patients.',
                    equipment: ['Flat surface', 'Blanket/padding']
                }
            ]
        },

        // =====================================================
        // PROLONGED FIELD CARE
        // =====================================================
        prolonged_care: {
            name: 'Prolonged Field Care',
            icon: '🕐',
            color: '#7c3aed',
            items: [
                {
                    id: 'pfc-wound-reassessment',
                    title: 'Wound Reassessment Schedule',
                    severity: 'high',
                    keywords: ['wound check', 'reassessment', 'infection', 'prolonged care', 'delayed evacuation'],
                    summary: 'Systematic wound monitoring protocol when evacuation is delayed 12-72 hours.',
                    protocol: [
                        'REASSESSMENT SCHEDULE:',
                        '- 2 hours: First recheck — bleeding controlled? Dressing saturated?',
                        '- 6 hours: Check for early infection signs — increasing pain, warmth',
                        '- 12 hours: Full reassessment — remove dressing, inspect wound',
                        '- 24 hours: Critical infection window — look for spreading redness, pus, fever',
                        '- Every 12 hours thereafter until evacuation',
                        '',
                        'WHAT TO CHECK:',
                        '- Distal circulation: pulse, sensation, movement below the wound',
                        '- Dressing condition: soaked through? Foul odor?',
                        '- Surrounding skin: redness spreading? Mark the border with a pen',
                        '- Pain level: increasing pain without new injury = infection sign',
                        '- Temperature: feel forehead, monitor for fever/chills',
                        '- Swelling: increasing? Compartment syndrome risk in tight spaces',
                        '',
                        'WHEN TO REPACK A WOUND:',
                        '- Dressing saturated with blood (not just stained)',
                        '- Signs of infection developing under old packing',
                        '- Wound packing has shifted or loosened',
                        '- Irrigate with clean water before repacking',
                        '',
                        'DOCUMENTATION:',
                        '- Record time of each check',
                        '- Note changes in redness border (mark with pen on skin)',
                        '- Track pain level trend (increasing = concerning)',
                        '- Record any medications given with time and dose'
                    ],
                    notes: 'A wound that looked fine at 2 hours can show infection by 24 hours. The 12-hour and 24-hour checks are the most important. Mark redness borders on the skin so you can objectively track whether infection is spreading.',
                    equipment: ['Sharpie/pen (to mark redness borders)', 'Clean water for irrigation', 'Fresh dressings/gauze', 'Watch/timer', 'Notebook for documentation']
                },
                {
                    id: 'pfc-fluid-management',
                    title: 'Field Fluid Management',
                    severity: 'high',
                    keywords: ['dehydration', 'fluid', 'oral rehydration', 'ORS', 'urine output', 'hydration'],
                    summary: 'Managing hydration when IV fluids are unavailable and evacuation is delayed.',
                    protocol: [
                        'ORAL REHYDRATION SOLUTION (ORS):',
                        '- 1 liter clean water',
                        '- 6 level teaspoons sugar (30g)',
                        '- ½ level teaspoon salt (2.5g)',
                        '- Mix thoroughly — should taste like tears',
                        '- Make fresh every 24 hours',
                        '',
                        'FIELD ALTERNATIVES:',
                        '- Diluted sports drink (half water, half sports drink)',
                        '- Coconut water (natural electrolytes)',
                        '- Broth or bouillon dissolved in water',
                        '- Clear sodas with pinch of salt (less ideal)',
                        '',
                        'ADMINISTRATION:',
                        '- Conscious patient: small frequent sips (60-90ml every 5 minutes)',
                        '- Nausea present: 5ml (1 teaspoon) every 1-2 minutes',
                        '- Target: 1-2 liters in the first 4 hours for moderate dehydration',
                        '- Ongoing: ~250ml/hour during active recovery',
                        '',
                        'MONITORING HYDRATION:',
                        '- Urine output: target is light yellow, >0.5ml/kg/hour',
                        '- Urine color chart: Clear=over-hydrated, Light yellow=good, Dark yellow=dehydrated, Brown=severe',
                        '- Skin turgor: pinch skin on back of hand — slow return (>2 sec) = dehydrated',
                        '- Mucous membranes: dry mouth and lips = dehydrated',
                        '- Mental status: confusion can indicate severe dehydration',
                        '',
                        'DEHYDRATION STAGES:',
                        '- Mild (3-5%): Thirst, dry mouth, decreased urine',
                        '- Moderate (6-9%): Rapid pulse, sunken eyes, skin tenting',
                        '- Severe (>10%): Altered consciousness, no urine, shock'
                    ],
                    notes: 'Oral rehydration is nearly as effective as IV fluids for mild-moderate dehydration. The WHO ORS formula has saved millions of lives. If patient is vomiting, give tiny amounts (5ml) very frequently rather than large amounts infrequently.',
                    equipment: ['Clean water', 'Sugar', 'Salt', 'Measuring spoon', 'Container for mixing']
                },
                {
                    id: 'pfc-infection-monitoring',
                    title: 'Infection Recognition & Response',
                    severity: 'high',
                    keywords: ['infection', 'cellulitis', 'sepsis', 'wound infection', 'antibiotics', 'red streaks'],
                    summary: 'Recognizing wound infection progression from local contamination to systemic sepsis, and field-level response options.',
                    protocol: [
                        'INFECTION TIMELINE:',
                        '- 0-6 hours: Contamination phase — bacteria present but not multiplying',
                        '- 6-24 hours: Colonization — bacteria establishing, minimal signs',
                        '- 24-48 hours: Local infection — redness, warmth, swelling, pain, pus',
                        '- 48-72 hours: Spreading infection — cellulitis, red streaks, fever',
                        '- 72+ hours: Systemic risk — sepsis possible if untreated',
                        '',
                        'LOCAL INFECTION SIGNS:',
                        '- Increasing pain at wound site (most reliable early sign)',
                        '- Redness spreading beyond wound edges',
                        '- Warmth when comparing injured area to same spot on other side',
                        '- Swelling increasing',
                        '- Pus or foul-smelling drainage',
                        '- Wound edges separating or breaking down',
                        '',
                        'CELLULITIS SIGNS (SPREADING):',
                        '- Red streaks extending from wound toward heart (lymphangitis)',
                        '- Skin hot and painful beyond immediate wound area',
                        '- Swollen lymph nodes (armpit for arm wounds, groin for leg wounds)',
                        '- Mark the border of redness with pen — check if it expands',
                        '',
                        'SEPSIS WARNING SIGNS (SYSTEMIC):',
                        '⚠️ Any of these = URGENT evacuation needed:',
                        '- Fever >101°F (38.3°C) or hypothermia <96.8°F (36°C)',
                        '- Heart rate >90 at rest',
                        '- Respiratory rate >20',
                        '- Confusion or altered mental status',
                        '- Skin mottling, cold extremities despite fever',
                        '',
                        'FIELD RESPONSE:',
                        '- Irrigate wound aggressively with clean water (500ml minimum)',
                        '- Remove dead tissue if accessible (devitalized skin edges)',
                        '- Leave wound open (do NOT close infected wounds)',
                        '- If antibiotics available: start broad-spectrum (see Medications section)',
                        '- Elevate affected limb',
                        '- Increase fluid intake',
                        '- Monitor vital signs every 2-4 hours',
                        '- EVACUATE if any systemic signs develop'
                    ],
                    notes: 'The single most reliable early sign of wound infection is increasing pain. A wound that was getting less painful but suddenly hurts more is likely infected. Red streaks (lymphangitis) heading toward the heart is a true emergency — start antibiotics immediately if available and evacuate.',
                    equipment: ['Irrigation syringe', 'Clean water (at least 1 liter)', 'Sharpie for marking redness', 'Thermometer if available', 'Broad-spectrum antibiotics if carried']
                },
                {
                    id: 'pfc-patient-overnight',
                    title: 'Managing a Patient Overnight',
                    severity: 'moderate',
                    keywords: ['overnight', 'patient care', 'prolonged', 'field hospital', 'monitoring', 'sleep'],
                    summary: 'Maintaining patient care through an overnight period when evacuation cannot happen until daylight.',
                    protocol: [
                        'HYPOTHERMIA PREVENTION:',
                        '- Ground insulation is the #1 priority (lose heat 25x faster to ground than air)',
                        '- Multiple layers underneath: packs, branches, foam pads, extra clothing',
                        '- Cover patient completely including head (50% heat loss from head/neck)',
                        '- Vapor barrier: trash bag or space blanket INSIDE insulation layer',
                        '- Warm water bottles (NOT hot) in armpits and groin if available',
                        '- Keep patient dry — change wet clothing immediately',
                        '',
                        'POSITION MANAGEMENT:',
                        '- Reposition every 2 hours to prevent pressure sores',
                        '- Log-roll for spinal precaution patients',
                        '- Recovery position for unconscious breathing patients',
                        '- Elevate injured extremities above heart level',
                        '- Semi-reclined (45°) for patients with breathing difficulty',
                        '',
                        'MONITORING SCHEDULE:',
                        '- Vital signs check every 2 hours minimum',
                        '- Conscious patients: pain check, offer water, reassess comfort',
                        '- Unconscious patients: airway check every 30 minutes',
                        '- Wound checks: per wound reassessment schedule',
                        '- Note any changes in mental status immediately',
                        '',
                        'MEDICATION SCHEDULE:',
                        '- Set alarms/reminders for medication doses',
                        '- Record every dose with exact time given',
                        '- Do NOT let pain medication lapse — staying ahead of pain is easier than catching up',
                        '- Overlap caretaker shifts so no gap in monitoring',
                        '',
                        'CARETAKER MANAGEMENT:',
                        '- Rotate caregivers in 2-4 hour shifts',
                        '- Brief incoming caretaker on: current status, last vitals, medications due, what to watch for',
                        '- At least one person must be awake at all times',
                        '- Keep a written log — fatigue degrades memory',
                        '',
                        'PREPARATION FOR MORNING:',
                        '- Pack and organize evacuation gear before dark',
                        '- Identify evacuation route while visibility is good',
                        '- Pre-stage litter/carry equipment',
                        '- Communicate evacuation plan to all team members'
                    ],
                    notes: 'The overnight period is when most preventable field deaths occur. Hypothermia kills quietly — a patient who is stable at sunset can be hypothermic by midnight. The caretaker rotation is as important as the medical care — fatigued caregivers miss critical changes.',
                    equipment: ['Ground insulation (pads, branches, packs)', 'Extra layers/sleeping bag', 'Space blanket', 'Light source (headlamp)', 'Watch/timer for checks', 'Notebook and pen']
                },
                {
                    id: 'pfc-improvised-rehydration',
                    title: 'Improvised ORS & Field Nutrition',
                    severity: 'moderate',
                    keywords: ['ORS', 'nutrition', 'calories', 'feeding', 'rehydration', 'recovery diet'],
                    summary: 'Providing oral rehydration and adequate nutrition to support recovery when standard medical supplies are unavailable.',
                    protocol: [
                        'WHO ORS FORMULA:',
                        '- 1 liter clean water',
                        '- 6 teaspoons (30g) sugar',
                        '- ½ teaspoon (2.5g) salt',
                        '- This is the gold standard — matches intestinal absorption',
                        '',
                        'FIELD ALTERNATIVES WHEN NO SUGAR/SALT:',
                        '- Rice water: boil rice, strain, add pinch of salt — excellent ORS alternative',
                        '- Thin cereal porridge with salt',
                        '- Mashed banana in water with salt',
                        '- Honey dissolved in water with salt (NOT for children under 1 year)',
                        '',
                        'CALORIC NEEDS DURING RECOVERY:',
                        '- Resting injured adult: ~1,500-2,000 calories/day',
                        '- Infection increases caloric need by 20-30%',
                        '- Burns increase caloric need by 40-100% depending on severity',
                        '- Protein is critical for wound healing — prioritize if available',
                        '',
                        'FEEDING GUIDELINES:',
                        '- Start with clear liquids (ORS, broth)',
                        '- Progress to soft foods as tolerated',
                        '- Small frequent meals (every 2-3 hours) rather than large meals',
                        '- High-calorie, easy-to-digest foods: nut butters, honey, rice, crackers',
                        '- Avoid: fatty foods, raw foods, dairy (can worsen GI symptoms)',
                        '',
                        'FEEDING SCHEDULE FOR INJURED PATIENTS:',
                        '- Hour 0-4: ORS only (sips every 5 minutes)',
                        '- Hour 4-12: ORS + clear broth if tolerating',
                        '- Hour 12-24: Soft foods if no vomiting',
                        '- Day 2+: Normal diet as tolerated',
                        '',
                        'SPECIAL CONSIDERATIONS:',
                        '- Abdominal injury: NO oral intake until evaluated',
                        '- Head injury with vomiting: small sips only, position on side',
                        '- Burns: fluid needs are dramatically higher — push ORS aggressively',
                        '- Diabetic patients: monitor blood sugar, adjust sugar in ORS'
                    ],
                    notes: 'The biggest mistake in prolonged field care is under-feeding. An injured body needs MORE calories than normal to heal, not less. ORS is absorbed faster than plain water and significantly reduces dehydration complications.',
                    equipment: ['Clean water', 'Sugar/honey', 'Salt', 'Measuring capability', 'Cup/container for small frequent doses']
                },
                {
                    id: 'pfc-pain-management-extended',
                    title: 'Extended Pain Management',
                    severity: 'moderate',
                    keywords: ['pain', 'pain management', 'prolonged', 'medication rotation', 'comfort'],
                    summary: 'Managing patient pain over 24-72 hours with limited supplies, including medication rotation and non-pharmacological techniques.',
                    protocol: [
                        'MEDICATION ROTATION STRATEGY:',
                        '- Alternate acetaminophen and ibuprofen every 3 hours',
                        '- Example schedule:',
                        '  Hour 0: Ibuprofen 400mg',
                        '  Hour 3: Acetaminophen 500mg',
                        '  Hour 6: Ibuprofen 400mg',
                        '  Hour 9: Acetaminophen 500mg',
                        '- This provides continuous pain relief without exceeding either drug\'s max dose',
                        '',
                        'DAILY MAXIMUMS (Adults):',
                        '- Acetaminophen: 3,000mg/day (or 2,000mg if liver concerns)',
                        '- Ibuprofen: 1,200mg/day (OTC dosing)',
                        '- Naproxen: 660mg/day',
                        '- Do NOT combine ibuprofen and naproxen (both NSAIDs)',
                        '',
                        'STAYING AHEAD OF PAIN:',
                        '- Give medication on schedule, not "as needed"',
                        '- It takes more medication to control pain that has escalated',
                        '- Wake patient for scheduled doses — missed doses mean pain spikes',
                        '',
                        'NON-PHARMACOLOGICAL METHODS:',
                        '- Cold: reduce swelling first 48 hours (20 min on, 20 min off)',
                        '- Elevation: above heart level for extremity injuries',
                        '- Immobilization: splinted injuries hurt less',
                        '- Positioning: find the position of most comfort',
                        '- Distraction: conversation, tasks, planning next steps',
                        '- Controlled breathing: 4 counts in, 4 counts out (reduces pain perception)',
                        '',
                        'PAIN ASSESSMENT OVER TIME:',
                        '- Use 0-10 scale consistently',
                        '- Record pain level at each medication dose',
                        '- Trend matters more than single number',
                        '- Increasing pain trend despite medication = reassess injury (missed injury? Compartment syndrome? Infection?)',
                        '',
                        'SLEEP AND PAIN:',
                        '- Pain is worse at night (fewer distractions)',
                        '- Time a medication dose 30 min before intended sleep',
                        '- Comfortable positioning is worth extra effort',
                        '- Even brief sleep periods significantly aid recovery'
                    ],
                    notes: 'The alternating acetaminophen/ibuprofen schedule is evidence-based and used in hospitals. It provides better pain control than either drug alone because their mechanisms are different and their peak effects overlap. Always track doses carefully to avoid accidental overdose over multiple days.',
                    equipment: ['Acetaminophen (Tylenol)', 'Ibuprofen (Advil/Motrin)', 'Watch/timer for dosing schedule', 'Notebook to track doses', 'Cold packs or cold water source']
                }
            ]
        },

        // =====================================================
        // PEDIATRIC EMERGENCIES
        // =====================================================
        pediatric: {
            name: 'Pediatric Emergencies',
            icon: '👶',
            color: '#ec4899',
            items: [
                {
                    id: 'peds-scaling',
                    title: 'Pediatric Scaling Reference',
                    severity: 'info',
                    keywords: ['pediatric', 'child', 'weight estimation', 'dosing', 'equipment sizing'],
                    summary: 'Age-based weight estimation, medication dose calculations, and equipment sizing for pediatric patients.',
                    protocol: [
                        'WEIGHT ESTIMATION BY AGE:',
                        '- Newborn: 3.5 kg (7.7 lbs)',
                        '- 6 months: 7 kg (15 lbs)',
                        '- 1 year: 10 kg (22 lbs)',
                        '- 2 years: 12 kg (26 lbs)',
                        '- 5 years: 18 kg (40 lbs)',
                        '- 8 years: 25 kg (55 lbs)',
                        '- 10 years: 32 kg (70 lbs)',
                        '- 12 years: 40 kg (88 lbs)',
                        '',
                        'QUICK FORMULAS:',
                        '- Age 1-5: Weight (kg) = (Age × 2) + 8',
                        '- Age 6-12: Weight (kg) = (Age × 3) + 7',
                        '- These are estimates — use actual weight when possible',
                        '',
                        'KEY DIFFERENCES FROM ADULTS:',
                        '- Airway: proportionally larger tongue, smaller airway, higher larynx',
                        '- Breathing: faster respiratory rate, smaller lung volume, belly breathers',
                        '- Circulation: faster heart rate, lower blood pressure, less blood volume',
                        '- Temperature: lose heat faster due to higher surface-area-to-mass ratio',
                        '- Injury patterns: head injuries more common (proportionally larger head)',
                        '',
                        'EQUIPMENT SIZING:',
                        '- OPA (oral airway): measure from corner of mouth to earlobe',
                        '- NPA (nasal airway): measure from nostril to earlobe',
                        '- BP cuff: width should cover 2/3 of upper arm',
                        '- Cervical collar: use rolled towel if pediatric collar unavailable',
                        '',
                        'AGE CATEGORY DEFINITIONS:',
                        '- Neonate: birth to 28 days',
                        '- Infant: 1 month to 1 year',
                        '- Child: 1 year to puberty (~12 years)',
                        '- Adolescent: puberty to 18 years (treat as small adult)'
                    ],
                    notes: 'Children are NOT small adults — they have fundamentally different physiology. The most important difference is their ability to compensate: a child can maintain normal blood pressure until they have lost 30-40% of their blood volume, then crash suddenly. By the time a child looks sick, they are VERY sick.',
                    equipment: ['Weight reference chart', 'Measuring tape (for Broselow tape equivalent)', 'Age-appropriate equipment if available']
                },
                {
                    id: 'peds-airway',
                    title: 'Pediatric Airway Management',
                    severity: 'critical',
                    keywords: ['pediatric airway', 'child choking', 'infant airway', 'back blows', 'foreign body'],
                    summary: 'Managing airway emergencies in infants and children, including position differences and foreign body obstruction clearance.',
                    protocol: [
                        'AIRWAY POSITIONING BY AGE:',
                        '- Infant (<1 year): Neutral position (head level, not tilted)',
                        '  • Place thin pad under shoulders to offset large occiput',
                        '  • Do NOT hyperextend neck — this closes the airway',
                        '- Child (1-8 years): Slight sniffing position',
                        '  • Gentle head tilt, chin lift',
                        '  • Less extension than an adult',
                        '- Adolescent (>8 years): Same as adult sniffing position',
                        '',
                        'FOREIGN BODY OBSTRUCTION — INFANT (<1 year):',
                        '1. Confirm complete obstruction (no crying, no coughing, no air movement)',
                        '2. Place infant face-down on your forearm, head lower than body',
                        '3. Support head and jaw with your hand',
                        '4. Give 5 BACK BLOWS between shoulder blades with heel of hand',
                        '5. Turn infant face-up on forearm',
                        '6. Give 5 CHEST THRUSTS (2 fingers, center of chest, just below nipple line)',
                        '7. Repeat back blows and chest thrusts until object clears or infant becomes unresponsive',
                        '⚠️ Do NOT use abdominal thrusts on infants — risk of liver/spleen injury',
                        '',
                        'FOREIGN BODY OBSTRUCTION — CHILD (>1 year):',
                        '1. Confirm complete obstruction',
                        '2. Stand or kneel behind child',
                        '3. Give abdominal thrusts (Heimlich) — fist above navel, below xiphoid',
                        '4. Use less force than adult — proportional to child size',
                        '5. Repeat until object clears or child becomes unresponsive',
                        '',
                        'IF PATIENT BECOMES UNRESPONSIVE:',
                        '- Lower to ground, begin CPR',
                        '- Before each rescue breath, look in mouth for visible object',
                        '- Remove object ONLY if you can see it',
                        '- Do NOT blind finger sweep in children or infants'
                    ],
                    notes: 'The #1 cause of cardiac arrest in children is respiratory failure, not cardiac problems. Managing the airway effectively prevents most pediatric cardiac arrests. Small children are nose-breathers — suction nasal secretions if obstructing.',
                    equipment: ['Suction device (bulb syringe for infants)', 'Shoulder roll (towel/clothing)', 'Appropriately sized airway adjuncts if available']
                },
                {
                    id: 'peds-cpr',
                    title: 'Pediatric CPR',
                    severity: 'critical',
                    keywords: ['pediatric CPR', 'child CPR', 'infant CPR', 'compression', 'rescue breathing'],
                    summary: 'CPR technique modifications for infants and children, including compression depth, hand placement, and ratio differences.',
                    protocol: [
                        'INFANT CPR (<1 year):',
                        '- Check for responsiveness: tap foot, call out',
                        '- Check breathing: look, listen, feel (max 10 seconds)',
                        '- Compression point: just below nipple line, center of chest',
                        '- Technique: 2 fingers (single rescuer) or 2-thumb encircling hands (2 rescuers)',
                        '- Depth: 1.5 inches (4 cm) — about 1/3 chest depth',
                        '- Rate: 100-120 compressions/minute',
                        '- Ratio: 30:2 (single rescuer), 15:2 (two rescuers)',
                        '- Breaths: just enough to see chest rise (small puffs)',
                        '⚠️ Cover infant\'s mouth AND nose with your mouth for rescue breaths',
                        '',
                        'CHILD CPR (1 year to puberty):',
                        '- Check for responsiveness: tap shoulders, call out',
                        '- Compression point: lower half of sternum',
                        '- Technique: 1 hand (small child) or 2 hands (larger child)',
                        '- Depth: 2 inches (5 cm) — about 1/3 chest depth',
                        '- Rate: 100-120 compressions/minute',
                        '- Ratio: 30:2 (single rescuer), 15:2 (two rescuers)',
                        '- Breaths: standard mouth-to-mouth, watch for chest rise',
                        '',
                        'KEY DIFFERENCES FROM ADULT CPR:',
                        '- Always give 5 initial rescue breaths FIRST (respiratory cause likely)',
                        '- Two-rescuer ratio is 15:2 (not 30:2 like adults)',
                        '- Compression depth is proportional (1/3 of chest depth)',
                        '- Pulse check: brachial artery (inner upper arm) for infants, carotid for children',
                        '- AED: use pediatric pads/dose if available; adult pads OK if no pediatric',
                        '',
                        'WHEN TO START CPR:',
                        '- No breathing or only gasping',
                        '- No pulse found within 10 seconds',
                        '- Heart rate <60 with signs of poor perfusion (pale, limp, unresponsive)',
                        '',
                        'WHEN TO STOP:',
                        '- Patient recovers (breathing, pulse, movement)',
                        '- Professional help takes over',
                        '- Scene becomes unsafe',
                        '- You are too exhausted to continue effectively'
                    ],
                    notes: 'Remember: most pediatric cardiac arrests are caused by breathing problems, not heart problems. This is why rescue breaths are MORE important in pediatric CPR than adult CPR. Five initial breaths before compressions can be the difference between life and death.',
                    equipment: ['Pocket mask (pediatric if available)', 'Pediatric AED pads if available', 'Flat hard surface']
                },
                {
                    id: 'peds-hypothermia',
                    title: 'Pediatric Hypothermia',
                    severity: 'high',
                    keywords: ['pediatric hypothermia', 'child cold', 'infant cold', 'warming', 'heat loss'],
                    summary: 'Preventing and treating hypothermia in children, who cool faster than adults due to higher surface-area-to-mass ratio.',
                    protocol: [
                        'WHY CHILDREN COOL FASTER:',
                        '- Higher surface-area-to-mass ratio (up to 3x more relative skin surface)',
                        '- Less subcutaneous fat for insulation',
                        '- Less ability to generate heat through shivering',
                        '- Infants cannot shiver effectively at all',
                        '- Head represents up to 20% of body surface (vs 9% in adults)',
                        '',
                        'RECOGNITION:',
                        '- Infant: may not shiver — look for lethargy, weak cry, poor feeding, cool/mottled skin',
                        '- Child: shivering, complaining of cold, clumsiness, irritability',
                        '- Severe: shivering stops, altered consciousness, rigid muscles',
                        '- Feel abdomen — if trunk is cool, hypothermia is significant',
                        '',
                        'PREVENTION (Most important):',
                        '- Cover the head — always (hat, hood, improvised)',
                        '- Layer clothing: base layer, insulation, wind/water shell',
                        '- Change wet clothing IMMEDIATELY — children tolerate wet clothing very poorly',
                        '- Insulate from ground (ground contact = rapid heat loss)',
                        '- Keep child active if mild cold exposure — movement generates heat',
                        '- Feed frequently — children burn calories faster',
                        '',
                        'TREATMENT:',
                        '- Remove from cold environment / wind',
                        '- Remove ALL wet clothing',
                        '- Insulate from ground first (most important)',
                        '- Warm the core: armpits, chest, groin — NOT extremities first',
                        '- Skin-to-skin contact: caregiver removes shirt, holds child against bare chest, covers both',
                        '- Warm (not hot) fluids by mouth if conscious',
                        '- Warm water bottles wrapped in cloth to armpits and groin',
                        '⚠️ Do NOT use hot water — burns happen easily on cold skin',
                        '⚠️ Do NOT rub extremities — can cause cardiac arrhythmia',
                        '',
                        'AFTERDROP:',
                        '- Temperature may continue to drop after rewarming begins',
                        '- Cold blood from extremities returns to core',
                        '- Handle gently — rough handling can trigger cardiac arrhythmia',
                        '- Continue warming until sustained improvement'
                    ],
                    notes: 'A child can become hypothermic in conditions that an adult considers merely uncomfortable. Rain + wind + 60°F can cause hypothermia in a small child within 1-2 hours. Prevention is far more effective than treatment — keep them dry, covered, and fed.',
                    equipment: ['Dry clothing', 'Hat/head covering', 'Ground insulation', 'Space blanket/vapor barrier', 'Warm fluids', 'Warm water bottles (wrapped)']
                },
                {
                    id: 'peds-fluid',
                    title: 'Pediatric Fluid Requirements',
                    severity: 'high',
                    keywords: ['pediatric fluid', 'child dehydration', 'infant dehydration', 'fluid replacement'],
                    summary: 'Calculating and providing appropriate fluid replacement for dehydrated infants and children.',
                    protocol: [
                        'MAINTENANCE FLUID NEEDS (4-2-1 RULE):',
                        '- First 10 kg of body weight: 4 ml/kg/hour',
                        '- Next 10 kg (10-20 kg): 2 ml/kg/hour additional',
                        '- Each kg above 20 kg: 1 ml/kg/hour additional',
                        '',
                        'EXAMPLES:',
                        '- 8 kg infant: 8 × 4 = 32 ml/hour = ~200 ml over 6 hours',
                        '- 15 kg toddler: (10×4) + (5×2) = 50 ml/hour = ~300 ml over 6 hours',
                        '- 25 kg child: (10×4) + (10×2) + (5×1) = 65 ml/hour = ~390 ml over 6 hours',
                        '',
                        'DEHYDRATION SIGNS BY AGE:',
                        '- Infant: sunken fontanelle (soft spot), no tears when crying, <4 wet diapers/day',
                        '- Toddler/Child: dry mouth, no tears, dark concentrated urine, lethargy',
                        '- All ages: skin tenting, sunken eyes, rapid heart rate, delayed capillary refill (>2 sec)',
                        '',
                        'ORAL REHYDRATION FOR CHILDREN:',
                        '- Mild dehydration: 50 ml/kg ORS over 4 hours',
                        '- Moderate dehydration: 100 ml/kg ORS over 4 hours',
                        '- Give by spoon or syringe: 5-10 ml every 1-2 minutes',
                        '- Breastfeeding infants: continue breastfeeding PLUS ORS',
                        '',
                        'PEDIATRIC ORS MODIFICATIONS:',
                        '- Same WHO formula as adults (6 tsp sugar, ½ tsp salt per liter)',
                        '- Can add small amount of mashed banana or unsweetened fruit juice for taste',
                        '- Do NOT use full-strength fruit juice (too much sugar causes osmotic diarrhea)',
                        '- Do NOT use sports drinks undiluted for children — too concentrated',
                        '',
                        'VOMITING MANAGEMENT:',
                        '- Wait 15-20 minutes after vomiting episode',
                        '- Restart with tiny amounts: 5 ml (1 teaspoon) every 2 minutes',
                        '- Gradually increase volume as tolerated',
                        '- If vomiting persists after 4-6 hours of attempts, this is a failure of oral rehydration — evacuate'
                    ],
                    notes: 'Children dehydrate faster than adults because they have higher metabolic rates and higher fluid turnover relative to body weight. An infant can become dangerously dehydrated within 12 hours of vomiting or diarrhea. The sunken fontanelle (soft spot on top of the head) in infants under 18 months is one of the most reliable dehydration signs.',
                    equipment: ['ORS ingredients (water, sugar, salt)', 'Oral syringe or teaspoon for measured dosing', 'Cup with measurement marks']
                },
                {
                    id: 'peds-fractures',
                    title: 'Pediatric Fracture Considerations',
                    severity: 'moderate',
                    keywords: ['pediatric fracture', 'child broken bone', 'growth plate', 'splinting children'],
                    summary: 'Key differences in pediatric fracture assessment and management, including growth plate injuries and age-appropriate pain assessment.',
                    protocol: [
                        'GROWTH PLATE INJURIES:',
                        '- Growth plates (physis) are weaker than ligaments in children',
                        '- Where an adult would sprain a joint, a child fractures the growth plate',
                        '- Suspect growth plate injury with ANY significant joint trauma in a child',
                        '- Tenderness directly over the growth plate area = treat as fracture',
                        '- Growth plate locations: near joints (wrist, ankle, knee, elbow)',
                        '',
                        'FRACTURE PATTERNS UNIQUE TO CHILDREN:',
                        '- Greenstick: bone bends and cracks on one side (like a green twig)',
                        '- Buckle/Torus: bone compresses and buckles (usually at wrist from fall)',
                        '- Both are stable — splint and evacuate',
                        '- Children\'s bones heal faster than adults (weeks vs months)',
                        '',
                        'SPLINTING CHILDREN:',
                        '- Pad all splints generously — children have less tissue protection',
                        '- Immobilize joint above AND below fracture site',
                        '- Check circulation distal to splint frequently (every 15-30 min)',
                        '- Children swell quickly — allow room for swelling',
                        '- Do NOT use traction splints on children under 8 years',
                        '',
                        'PAIN ASSESSMENT:',
                        '- Verbal children (>3 years): use 0-10 scale or faces pain scale',
                        '- Pre-verbal/non-verbal: use FLACC scale:',
                        '  F — Face: relaxed (0), occasional grimace (1), frequent grimace (2)',
                        '  L — Legs: relaxed (0), restless (1), drawn up/kicked (2)',
                        '  A — Activity: lying quietly (0), squirming (1), arched/rigid (2)',
                        '  C — Cry: no cry (0), whimper (1), crying steadily (2)',
                        '  C — Consolability: content (0), distractable (1), inconsolable (2)',
                        '  Score 0-10: 0=no pain, 1-3=mild, 4-6=moderate, 7-10=severe',
                        '',
                        'PAIN MANAGEMENT:',
                        '- Ibuprofen: 10 mg/kg every 6-8 hours (max 40 mg/kg/day)',
                        '- Acetaminophen: 15 mg/kg every 4-6 hours (max 75 mg/kg/day)',
                        '- Can alternate both (same rotation schedule as adults)',
                        '- Immobilization significantly reduces fracture pain',
                        '- Ice/cold pack: 10 min on, 10 min off (shorter intervals than adults)',
                        '',
                        'RED FLAGS — EVACUATE IMMEDIATELY:',
                        '- Open fracture (bone visible or protruding)',
                        '- Loss of pulse, sensation, or movement below fracture',
                        '- Suspected femur fracture (high force injury, risk of significant blood loss)',
                        '- Any suspected spine or pelvis injury',
                        '- Compartment syndrome signs: pain out of proportion, tight swelling, pain with passive stretch'
                    ],
                    notes: 'The most commonly missed injury in pediatric field medicine is the growth plate fracture — it can look like "just a sprain" but has long-term consequences if not properly treated. When in doubt, splint it and treat it as a fracture. Children are remarkably tough but they cannot always articulate their pain — the FLACC scale is your best tool for pre-verbal patients.',
                    equipment: ['SAM splint or improvised splinting material', 'Padding (clothing, towels)', 'Elastic wrap or cravats', 'Cold pack', 'Age-appropriate pain medication']
                }
            ]
        },

        // =====================================================
        // SPECIALTY EMERGENCIES
        // =====================================================
        specialty: {
            name: 'Specialty Emergencies',
            icon: '🏥',
            color: '#b45309',
            items: [
                {
                    id: 'spec-emergency-childbirth',
                    title: 'Emergency Childbirth',
                    severity: 'critical',
                    keywords: ['childbirth', 'delivery', 'labor', 'birth', 'obstetric', 'OB', 'pregnancy', 'contractions'],
                    summary: 'Managing an imminent field delivery when evacuation is not possible — normal delivery steps, cord management, and immediate postpartum care.',
                    protocol: [
                        'SIGNS OF IMMINENT DELIVERY:',
                        '- Contractions <2 minutes apart, lasting 60-90 seconds',
                        '- Strong urge to push / urge to bear down',
                        '- Visible crowning (baby\'s head visible at vaginal opening)',
                        '- If crowning: DO NOT attempt transport — deliver on scene',
                        '',
                        'PREPARATION:',
                        '- Clean, warm, private environment',
                        '- Clean hands — wash thoroughly or use gloves if available',
                        '- Clean towels/clothing for baby',
                        '- Position mother: semi-reclined (45°) or left side',
                        '- Do NOT rush — nature does the work',
                        '',
                        'NORMAL DELIVERY STEPS:',
                        '1. Support the baby\'s head as it emerges — DO NOT pull',
                        '2. Check for nuchal cord (cord around neck):',
                        '   - If loose: slide it over the baby\'s head',
                        '   - If tight: attempt to slip over head, if impossible — deliver through it',
                        '3. After the head delivers, it will rotate naturally — let it',
                        '4. Gently guide the upper shoulder down, then the lower shoulder up',
                        '5. The rest of the body follows quickly — be ready, babies are slippery',
                        '6. Note the time of birth',
                        '',
                        'IMMEDIATE NEWBORN CARE:',
                        '- Place baby skin-to-skin on mother\'s abdomen/chest',
                        '- Dry the baby vigorously with clean towel (stimulates breathing)',
                        '- Clear mouth and nose with clean cloth (wipe, don\'t suction deeply)',
                        '- Baby should cry and turn pink within 30-60 seconds',
                        '- If baby does NOT breathe: gentle stimulation (flick soles of feet, rub back)',
                        '- Cover baby and mother together — prevent heat loss',
                        '',
                        'CORD MANAGEMENT:',
                        '- The cord does NOT need to be cut immediately',
                        '- Wait at least 1-3 minutes (allows blood transfer to baby)',
                        '- If clean cutting tools unavailable: leave cord intact, wrap baby with cord',
                        '- To cut: tie cord tightly in TWO places (6 inches and 8 inches from baby)',
                        '  Cut between the ties with clean, sharp instrument',
                        '- Check cord stump for bleeding — retie if needed',
                        '',
                        'PLACENTA:',
                        '- Delivers 5-30 minutes after baby — DO NOT pull on the cord',
                        '- Let it deliver naturally with gentle pushing by mother',
                        '- Save the placenta for medical personnel to inspect',
                        '- After placenta delivers: massage the uterus (see postpartum hemorrhage)',
                        '',
                        'RED FLAGS — EVACUATE URGENTLY:',
                        '⚠️ Prolapsed cord (cord visible before baby)',
                        '⚠️ Breech presentation (buttocks or feet first)',
                        '⚠️ Heavy bleeding before delivery',
                        '⚠️ Baby not breathing after 1 minute of stimulation',
                        '⚠️ Placenta not delivered within 30 minutes'
                    ],
                    notes: 'Most deliveries proceed normally without any intervention. Your primary job is to not interfere with the natural process, keep things clean, and keep the baby warm. The biggest risks are cord complications, bleeding after delivery, and the baby not breathing. Skin-to-skin contact with the mother is the best way to keep the baby warm.',
                    equipment: ['Clean gloves', 'Clean towels/cloths (at least 3)', 'String/shoelace for cord ties', 'Clean sharp cutting tool', 'Blanket for warmth', 'Bulb syringe if available']
                },
                {
                    id: 'spec-postpartum-hemorrhage',
                    title: 'Postpartum Hemorrhage',
                    severity: 'critical',
                    keywords: ['postpartum', 'hemorrhage', 'bleeding', 'fundal massage', 'uterine', 'atony', 'birth bleeding'],
                    summary: 'Managing life-threatening bleeding after childbirth — the leading cause of maternal death worldwide and a true field emergency.',
                    protocol: [
                        'DEFINITION:',
                        '- Blood loss >500ml after vaginal delivery',
                        '- Any bleeding that causes hemodynamic instability (rapid pulse, lightheaded)',
                        '- A soaked pad in <15 minutes = significant hemorrhage',
                        '',
                        'MOST COMMON CAUSE — UTERINE ATONY (75%):',
                        '- The uterus should contract firmly after delivery',
                        '- A soft, boggy uterus = it is not contracting = it is bleeding',
                        '',
                        'FUNDAL MASSAGE (Primary Treatment):',
                        '1. Place one hand on the lower abdomen just above the pubic bone (stabilizing hand)',
                        '2. Place the other hand on top of the uterus (feel it as a firm mass at/below the navel)',
                        '3. Massage the top of the uterus firmly in a circular motion',
                        '4. The uterus should become firm like a grapefruit — this is the goal',
                        '5. If it softens, massage again immediately',
                        '6. Continue until the uterus stays firm on its own',
                        '7. Check uterine tone every 15 minutes for the first 2 hours',
                        '',
                        'IF BLEEDING CONTINUES:',
                        '- Have the mother empty her bladder (full bladder prevents uterine contraction)',
                        '- Breastfeeding or nipple stimulation releases oxytocin (promotes uterine contraction)',
                        '- Bimanual compression: one hand on abdomen, other fist inside the vagina pushing upward',
                        '  (Only if trained or hemorrhage is life-threatening)',
                        '- Abdominal aortic compression: press fist firmly above the navel against the spine',
                        '  (Desperate measure — buys time for evacuation)',
                        '',
                        'SUPPORTIVE CARE:',
                        '- Elevate legs',
                        '- Keep warm — hypothermia worsens bleeding',
                        '- Aggressive oral fluid replacement if conscious',
                        '- Monitor pulse and mental status',
                        '- Nothing per vagina until source identified (except bimanual compression)',
                        '',
                        'HEMORRHAGE CLASSIFICATION:',
                        '- Class I (<750ml): Normal vital signs, may not be apparent',
                        '- Class II (750-1500ml): Tachycardia, narrowed pulse pressure',
                        '- Class III (1500-2000ml): Hypotension, confusion, cold extremities',
                        '- Class IV (>2000ml): Imminent cardiac arrest',
                        '⚠️ Class III or IV = life-threatening emergency, evacuate NOW'
                    ],
                    notes: 'Fundal massage is the single most important intervention and saves lives. It is uncomfortable for the mother — explain what you are doing and why. Most postpartum hemorrhage occurs within 1-2 hours of delivery, so vigilant monitoring during this period is critical. A uterus that feels like a firm grapefruit is contracting properly; a uterus that feels soft and doughy is NOT.',
                    equipment: ['Clean gloves', 'Absorbent pads/towels', 'IV fluids if available', 'Oxytocin if available (10 units IM)', 'ORS for oral fluid replacement']
                },
                {
                    id: 'spec-crush-injury',
                    title: 'Crush Injury / Crush Syndrome',
                    severity: 'critical',
                    keywords: ['crush', 'crush syndrome', 'entrapment', 'rhabdomyolysis', 'hyperkalemia', 'building collapse', 'trapped'],
                    summary: 'Managing the release of a person trapped under heavy weight — the release itself can be more dangerous than the entrapment due to sudden toxin release into the bloodstream.',
                    protocol: [
                        'CRITICAL CONCEPT:',
                        '⚠️ A person trapped under weight for >1 HOUR may die when released',
                        '- Crushed muscle releases potassium, myoglobin, and acids into the blood',
                        '- These toxins are trapped in the limb while compressed',
                        '- When the weight is lifted, toxins flood the circulation',
                        '- Can cause fatal cardiac arrhythmia within minutes of release',
                        '',
                        'BEFORE RELEASE — Assessment:',
                        '- How long has the person been trapped?',
                        '  < 1 hour: Release immediately, monitor',
                        '  1-4 hours: Prepare fluids, monitor closely after release',
                        '  > 4 hours: HIGH RISK — follow full crush syndrome protocol',
                        '  > 8 hours: EXTREME RISK — advanced preparation essential',
                        '- What body parts are trapped? (legs/arms worst — most muscle mass)',
                        '- Is the person alert and oriented?',
                        '',
                        'PRE-RELEASE PREPARATION (>1 hour entrapment):',
                        '1. Start oral fluids NOW, while still trapped (1-1.5 liters/hour if tolerated)',
                        '2. If IV available: normal saline 1-1.5 liters/hour',
                        '3. If you have a tourniquet: apply ABOVE the crush site BEFORE releasing the weight',
                        '4. This traps the toxins in the limb temporarily',
                        '5. Gradually release the tourniquet after fluids are running',
                        '',
                        'RELEASE PROTOCOL:',
                        '1. Ensure fluid loading has been underway for at least 30 minutes if possible',
                        '2. If tourniquet applied: keep it on during initial release',
                        '3. Remove the weight',
                        '4. Monitor heart rhythm (if capability exists) — cardiac arrest risk is IMMEDIATE',
                        '5. If no tourniquet was used: begin aggressive fluid replacement instantly',
                        '6. If tourniquet was used: slowly release over 5-10 minutes while monitoring',
                        '',
                        'POST-RELEASE MONITORING:',
                        '- Cardiac arrest can occur within 5-30 minutes of release',
                        '- Watch for: irregular pulse, chest pain, muscle rigidity, dark brown urine',
                        '- Dark/cola-colored urine = myoglobin (kidney damage in progress)',
                        '- Continue aggressive hydration: 500ml/hour minimum',
                        '- Elevate the affected limb',
                        '- Splint any obvious fractures',
                        '- Keep the patient warm',
                        '⚠️ Do NOT apply cold packs to the crushed area',
                        '',
                        'IF NO FLUIDS AND NO TOURNIQUET AVAILABLE:',
                        '- This is the worst scenario — release and hydrate as best you can',
                        '- The decision to release vs leave trapped depends on:',
                        '  Release if: rescue/evacuation is possible within hours',
                        '  Leave trapped if: no fluids, no tourniquet, >4 hours, and evacuation >12 hours away',
                        '  Leaving trapped keeps the person alive longer by keeping toxins sequestered'
                    ],
                    notes: 'The counterintuitive reality of crush syndrome is that the person may feel relatively fine while trapped — they are talking, alert, and their vital signs may be stable. The danger comes when you release them. The aggressive fluid loading before and during release is the single most important intervention. If you remember nothing else: FLUIDS BEFORE RELEASE.',
                    equipment: ['IV fluids (normal saline — ideal)', 'ORS for oral fluid loading', 'Tourniquet', 'Cardiac monitor if available', 'Urine collection container (to monitor color)']
                },
                {
                    id: 'spec-dental-emergency',
                    title: 'Dental Emergencies',
                    severity: 'moderate',
                    keywords: ['dental', 'tooth', 'toothache', 'knocked out', 'avulsion', 'abscess', 'jaw', 'broken tooth'],
                    summary: 'Managing dental pain and injuries in the field — from knocked-out teeth to abscesses that can become life-threatening.',
                    protocol: [
                        'KNOCKED-OUT TOOTH (Avulsion):',
                        '⏱️ Time-critical: reimplant within 30 minutes for best outcome',
                        '1. Find the tooth — handle by the crown (white part), NEVER the root',
                        '2. If dirty: rinse gently with clean water (do NOT scrub the root)',
                        '3. Reimplant: push tooth back into the socket, bite down on gauze to hold',
                        '4. If cannot reimplant: store in MILK (best), saliva (OK), or saline',
                        '5. Do NOT store in water (damages root cells)',
                        '6. Do NOT let the tooth dry out',
                        '7. Seek dental care ASAP — even successfully reimplanted teeth need follow-up',
                        '• Only reimplant permanent (adult) teeth, NOT baby teeth',
                        '',
                        'BROKEN / CRACKED TOOTH:',
                        '- Rinse mouth with warm salt water',
                        '- If sharp edge: cover with dental wax, sugarless gum, or candle wax',
                        '- Pain management: ibuprofen 400mg + acetaminophen 500mg',
                        '- Clove oil (eugenol) applied directly = natural dental anesthetic',
                        '- If nerve exposed (intense pain, sensitivity): keep covered, evacuate for dental care',
                        '',
                        'DENTAL ABSCESS:',
                        '⚠️ Can become life-threatening if infection spreads',
                        '- Signs: severe throbbing pain, swelling in jaw/face/neck, fever, foul taste',
                        '- Warm salt water rinses (every 2-3 hours)',
                        '- Pain management: ibuprofen (reduces inflammation)',
                        '- If antibiotics available: amoxicillin 500mg every 8 hours',
                        '- DO NOT lance or attempt to drain',
                        '- Red flags for evacuation:',
                        '  ⚠️ Swelling spreading to neck or under jaw (Ludwig\'s angina — airway threat)',
                        '  ⚠️ Difficulty swallowing or opening mouth (trismus)',
                        '  ⚠️ Fever >101°F with facial swelling',
                        '',
                        'TEMPORARY FILLING (Lost filling/crown):',
                        '- Clean the cavity with warm salt water',
                        '- Pack with dental wax, sugarless gum, or a paste of zinc oxide and eugenol',
                        '- If a crown fell off: clean it, apply denture adhesive or toothpaste inside, press back on',
                        '',
                        'JAW INJURY:',
                        '- If dislocated: do NOT attempt to reduce in the field',
                        '- If fractured: immobilize with bandage wrapped under chin and over top of head',
                        '- Soft or liquid diet only',
                        '- Evacuate — jaw fractures need surgical evaluation'
                    ],
                    notes: 'A knocked-out tooth has the best chance of survival if reimplanted within 30 minutes. After 60 minutes, success drops dramatically. Milk is the best transport medium because its pH and osmolality match tooth root cells. A dental abscess that causes neck swelling is a true emergency — Ludwig\'s angina can close the airway.',
                    equipment: ['Dental wax or sugarless gum', 'Clove oil (eugenol)', 'Salt for rinses', 'Ibuprofen', 'Amoxicillin if available', 'Small container with milk (for tooth transport)']
                },
                {
                    id: 'spec-eye-injury',
                    title: 'Eye Injuries',
                    severity: 'high',
                    keywords: ['eye', 'eye injury', 'chemical', 'foreign body', 'snow blindness', 'corneal', 'penetrating eye'],
                    summary: 'Managing eye emergencies from chemical exposure to penetrating injuries — protecting vision in the field.',
                    protocol: [
                        'CHEMICAL EXPOSURE:',
                        '⏱️ Time-critical: Begin irrigation IMMEDIATELY',
                        '1. Flush affected eye with clean water continuously for 20 MINUTES minimum',
                        '2. Tilt head so contaminated water drains away from unaffected eye',
                        '3. Hold eyelids open during flushing (patient will resist — it\'s necessary)',
                        '4. Use any clean water source: water bottle, hydration bladder, IV bag',
                        '5. Alkali burns (concrete, oven cleaner, drain cleaner) are WORSE than acid — flush longer (30+ min)',
                        '6. After flushing: patch lightly, evacuate for ophthalmology evaluation',
                        '',
                        'FOREIGN BODY:',
                        '- Superficial (on surface, not embedded):',
                        '  Pull upper lid over lower lid (tears may wash it out)',
                        '  Flush with clean water',
                        '  Use moist cotton swab to gently lift off the surface',
                        '- Embedded (stuck in cornea):',
                        '  ⚠️ Do NOT attempt to remove embedded foreign bodies',
                        '  Patch both eyes (reduces eye movement)',
                        '  Evacuate for professional removal',
                        '- Metal foreign bodies: rust ring can form in hours — urgent evacuation',
                        '',
                        'SNOW BLINDNESS (UV Keratitis):',
                        '- Essentially a sunburn of the cornea — extremely painful',
                        '- Symptoms appear 6-12 hours AFTER exposure (delayed onset)',
                        '- Both eyes usually affected: gritty feeling, tearing, light sensitivity, pain',
                        '- Treatment: patch BOTH eyes, cool damp compress, dark environment',
                        '- Pain management: ibuprofen + oral pain medication',
                        '- Do NOT rub eyes',
                        '- Resolves in 24-48 hours with rest',
                        '- Prevention: sunglasses or improvised eye slits (tape with narrow slit over eyes)',
                        '',
                        'PENETRATING EYE INJURY:',
                        '⚠️ Do NOT:',
                        '- Apply pressure to the eye',
                        '- Remove any object protruding from the eye',
                        '- Let the patient rub the eye',
                        '- Rinse if penetrating wound suspected',
                        'DO:',
                        '- Shield the eye: tape a cup, cone, or ring of gauze around (not on) the eye',
                        '- The shield should not touch the eye or any protruding object',
                        '- Patch the OTHER eye as well (prevents sympathetic movement)',
                        '- Position: semi-reclined, instruct patient not to strain, cough, or bend over',
                        '- Evacuate URGENTLY for surgical repair',
                        '',
                        'BLUNT EYE TRAUMA:',
                        '- Cold compress for 10-20 minutes (reduces swelling)',
                        '- Check for: pupil shape (irregular = serious), vision changes, blood in eye',
                        '- If hyphema (visible blood pooling in front of iris): elevate head, no aspirin/NSAIDs, evacuate',
                        '- If orbital fracture suspected (restricted eye movement, numbness of cheek): evacuate'
                    ],
                    notes: 'Chemical burns: the first 5 minutes of irrigation are the most important — do not waste time looking for special solutions, use any clean water immediately. Snow blindness is entirely preventable with proper eye protection. In an emergency, cut narrow horizontal slits in tape, cardboard, or birch bark to create improvised snow goggles.',
                    equipment: ['Clean water (at least 1 liter for irrigation)', 'Eye patches or clean cloth', 'Rigid eye shield (cup, cone, cut-out from water bottle bottom)', 'Tape', 'Sunglasses or improvised eye slits', 'Ibuprofen for pain']
                },
                {
                    id: 'spec-psych-first-aid',
                    title: 'Psychological First Aid',
                    severity: 'moderate',
                    keywords: ['psychological', 'mental health', 'panic', 'anxiety', 'crisis', 'grounding', 'acute stress', 'PFA', 'emotional'],
                    summary: 'Supporting people experiencing acute psychological distress — stabilizing panic, managing group stress, and recognizing when someone needs professional intervention.',
                    protocol: [
                        'CORE PRINCIPLES OF PFA:',
                        '- Safety: Ensure physical safety first — psychological care comes after',
                        '- Calm: Your calm presence is the most powerful intervention',
                        '- Connection: Help the person feel not alone',
                        '- Self-efficacy: Help them take small actions (restores sense of control)',
                        '- Hope: Normalize their reaction without minimizing their experience',
                        '',
                        'ACUTE STRESS REACTIONS (NORMAL):',
                        '- Trembling, rapid breathing, racing heart',
                        '- Difficulty concentrating, feeling "unreal" or detached',
                        '- Emotional swings (crying, anger, numbness)',
                        '- Difficulty sleeping, hypervigilance',
                        '- These are NORMAL responses to abnormal events',
                        '- Most people recover naturally within days to weeks',
                        '',
                        'GROUNDING TECHNIQUE (5-4-3-2-1):',
                        'When someone is panicking, dissociating, or spiraling:',
                        '- "Tell me 5 things you can SEE right now"',
                        '- "Tell me 4 things you can TOUCH right now"',
                        '- "Tell me 3 things you can HEAR right now"',
                        '- "Tell me 2 things you can SMELL right now"',
                        '- "Tell me 1 thing you can TASTE right now"',
                        '- Speak slowly and calmly — match their pace then gradually slow it',
                        '- This works by anchoring the person to the present moment',
                        '',
                        'BOX BREATHING (for panic/hyperventilation):',
                        '- Breathe in for 4 counts',
                        '- Hold for 4 counts',
                        '- Breathe out for 4 counts',
                        '- Hold for 4 counts',
                        '- Repeat until breathing normalizes',
                        '- Count out loud with the person',
                        '',
                        'MANAGING PANIC IN A GROUP:',
                        '- Give people TASKS — idle hands spiral, busy hands stabilize',
                        '- Assign specific, concrete jobs: "You — gather water. You — build the fire"',
                        '- Establish routine and structure (meal times, watch schedule)',
                        '- Brief the group regularly with honest updates (uncertainty breeds panic)',
                        '- Isolate anyone in a full panic episode from the group temporarily',
                        '- Acknowledge fear honestly: "This is scary. Here\'s what we\'re doing about it."',
                        '',
                        'WHEN TO EVACUATE FOR PSYCH CRISIS:',
                        '⚠️ Threat of self-harm or harm to others',
                        '⚠️ Complete dissociation (unresponsive, catatonic)',
                        '⚠️ Psychotic symptoms (hallucinations, delusions, severe disorganization)',
                        '⚠️ Inability to perform basic self-care (eating, drinking, following instructions)',
                        '',
                        'CAREGIVER SELF-CARE:',
                        '- You cannot help others from an empty tank',
                        '- Buddy system: check on each other',
                        '- Talk about what you experienced — do not suppress',
                        '- Eat, hydrate, sleep even when you feel you can\'t',
                        '- It is OK to be affected — this does not mean you are weak'
                    ],
                    notes: 'The most effective psychological first aid is not a technique — it is your calm, present, non-judgmental attention. You do not need to fix the person\'s experience or make them feel better. You need to make them feel safe and not alone. Assigning tasks is the most underrated intervention in a group crisis — it restores a sense of control and agency.',
                    equipment: ['No specialized equipment needed', 'Pen and paper (for task assignments)', 'Comfort items if available (warm drink, blanket)']
                }
            ]
        },

        // =====================================================
        // KIT CONTENTS
        // =====================================================
        kit_contents: {
            name: 'Kit Contents',
            icon: '🩹',
            color: '#0891b2',
            items: [
                {
                    id: 'kit-ifak',
                    title: 'IFAK Contents',
                    severity: 'info',
                    keywords: ['IFAK', 'first aid kit', 'individual', 'trauma kit', 'med kit', 'gear list', 'kit contents'],
                    summary: 'Complete Individual First Aid Kit (IFAK) contents — the life-saving gear every field operator should carry on their person.',
                    protocol: [
                        'TIER 1 — HEMORRHAGE CONTROL (Top Priority):',
                        '• 1x Tourniquet (CAT Gen 7 or SOF-T Wide) — staged for one-handed use',
                        '• 1x Hemostatic gauze (QuikClot Combat Gauze or Celox) — for junctional wounds',
                        '• 1x Pressure bandage (Israeli bandage, 6-inch) — for extremity wounds',
                        '• 1x Compressed gauze (z-fold, minimum 4.5" × 4.1 yards)',
                        '• 2x Chest seals (vented preferred, e.g., HyFin Vent) — one for entry, one for exit',
                        '',
                        'TIER 2 — AIRWAY:',
                        '• 1x Nasopharyngeal airway (NPA, 28Fr with lubricant) — for unconscious patients maintaining gag reflex',
                        '• 1x CPR pocket mask or barrier device',
                        '',
                        'TIER 3 — SECONDARY:',
                        '• 2x Nitrile gloves (sized to fit you)',
                        '• 1x Trauma shears',
                        '• 1x Permanent marker (Sharpie) — for marking tourniquet time, triage, medications given',
                        '• 1x Casualty card or duct tape strip (for recording treatment)',
                        '• 2x Adhesive bandages (for minor wounds — because not everything is trauma)',
                        '• 1x Roll medical tape (1-inch)',
                        '• 1x Emergency blanket / space blanket (hypothermia prevention)',
                        '',
                        'OPTIONAL ADDITIONS:',
                        '• 2x Cravats / triangular bandages (sling, swath, improvised tourniquet)',
                        '• 1x SAM splint (moldable aluminum splint)',
                        '• Pain medication: ibuprofen 400mg x4, acetaminophen 500mg x4',
                        '• Antihistamine: diphenhydramine 25mg x4',
                        '• Eye shield (rigid, clear)',
                        '• Irrigation syringe (20ml, for wound cleaning)',
                        '',
                        'PACKING ORDER:',
                        '• Tourniquet on TOP or in external pouch (fastest access)',
                        '• Chest seals next (second most time-critical)',
                        '• Hemostatic gauze and pressure bandage together',
                        '• Airway at bottom (needed less urgently than bleeding control)',
                        '• Gloves accessible from OUTSIDE the kit',
                        '',
                        'PLACEMENT:',
                        '• On body — belt-mounted, chest-mounted, or in consistent pack location',
                        '• EVERYONE on the team should know where YOUR IFAK is',
                        '• You may be treating yourself, or someone may need to treat you',
                        '• Left/right placement should be standardized across the team'
                    ],
                    notes: 'The IFAK is designed for ONE casualty with ONE major injury — it is not a group kit. Every person carries their own. Standardize kit contents across your team so anyone can open anyone\'s IFAK and find things by feel in the dark. Train with your actual kit — know what\'s in it, where it is, and how to use every item.',
                    equipment: ['IFAK pouch (MOLLE-compatible or belt-mounted)', 'Vacuum-sealed contents to reduce size', 'Red cross or medical marking on pouch']
                },
                {
                    id: 'kit-team-medical',
                    title: 'Team Medical Kit',
                    severity: 'info',
                    keywords: ['team medical', 'group kit', 'team leader', 'expanded medical', 'field medical', 'medical supplies'],
                    summary: 'Expanded medical kit carried by the team leader or designated medic — supplements individual IFAKs for multi-casualty scenarios and prolonged field care.',
                    protocol: [
                        'TEAM KIT PHILOSOPHY:',
                        '• Supplements IFAKs — does NOT replace them',
                        '• Carried by team leader or designated medic',
                        '• Sized for team of 4-8 people over 24-72 hours',
                        '• Focus: things individuals don\'t carry but the team needs',
                        '',
                        'WOUND MANAGEMENT:',
                        '• 2x Additional pressure bandages (Israeli, 6-inch)',
                        '• 4x Rolled gauze (Kerlix or equivalent)',
                        '• 1x Wound irrigation syringe (60ml with 18-gauge tip)',
                        '• 1x Bottle sterile saline or clean water (500ml, for irrigation)',
                        '• 10x Wound closure strips (Steri-Strips)',
                        '• 1x Skin stapler (if trained) OR suture kit',
                        '• 2x Abdominal pads (5x9, for large wounds)',
                        '• 1x Roll self-adherent wrap (Coban)',
                        '',
                        'SPLINTING & IMMOBILIZATION:',
                        '• 2x SAM splints (36-inch, moldable)',
                        '• 4x Cravats / triangular bandages',
                        '• 1x Roll athletic tape (1.5-inch)',
                        '• 1x Cervical collar (adjustable, if trained)',
                        '',
                        'MEDICATIONS:',
                        '• Ibuprofen 200mg — 24 tabs (anti-inflammatory, pain, fever)',
                        '• Acetaminophen 500mg — 24 tabs (pain, fever, alternates with ibuprofen)',
                        '• Diphenhydramine 25mg — 12 tabs (allergic reactions, sleep aid, anti-nausea)',
                        '• Loperamide 2mg — 12 tabs (diarrhea — critical for preventing dehydration)',
                        '• Aspirin 325mg — 4 tabs (suspected cardiac event only)',
                        '• Antacid tabs — 12 (GI distress)',
                        '• Oral rehydration salt packets — 6 (mix with 1L water each)',
                        '• Antibiotic ointment — 6 single-use packets',
                        '• Hydrocortisone cream 1% — 1 tube (rash, insect bites, contact dermatitis)',
                        '',
                        'ASSESSMENT TOOLS:',
                        '• Pulse oximeter (finger-clip, with extra battery)',
                        '• Manual blood pressure cuff + stethoscope (if trained)',
                        '• Thermometer (digital, fast-read)',
                        '• Penlight (pupil assessment)',
                        '• Patient assessment cards (SOAP notes or casualty cards, 10 pack)',
                        '• Pen + permanent marker',
                        '',
                        'ENVIRONMENTAL:',
                        '• 2x Emergency blankets (space blankets)',
                        '• 1x Hypothermia wrap (or large tarp + insulation)',
                        '• 2x Chemical heat packs (for hypothermia treatment)',
                        '• 1x Eye irrigation solution (500ml)',
                        '',
                        'HYGIENE & INFECTION PREVENTION:',
                        '• 10x pairs nitrile gloves',
                        '• Hand sanitizer (4 oz)',
                        '• Bio-hazard bags — 4 (for contaminated materials)',
                        '• Sharps container if carrying needles/stapler'
                    ],
                    notes: 'The team medical kit weight target is 8-12 lbs packed. It should be in a clearly marked bag that any team member can find and open. Inventory and restock after EVERY deployment. Standardize contents across your organization so any medic can grab any team kit and know exactly what\'s inside.',
                    equipment: ['Clearly marked medical bag (red cross or MEDICAL label)', 'Waterproof inner bags for medications', 'Contents list taped inside lid']
                },
                {
                    id: 'kit-medication-list',
                    title: 'Recommended Field Medications',
                    severity: 'info',
                    keywords: ['medications', 'field meds', 'OTC', 'prescription', 'drug list', 'pharmacy', 'expiration'],
                    summary: 'Over-the-counter and prescription medications to discuss with your physician for inclusion in a field medical kit, with indications and expiration guidance.',
                    protocol: [
                        'OTC MEDICATIONS (No Prescription Needed):',
                        '',
                        '• **Ibuprofen 200mg** — Pain, inflammation, fever',
                        '  Dose: 400-600mg every 6-8 hours, max 1200mg/day (OTC)',
                        '  Cautions: avoid with bleeding, kidney issues, empty stomach',
                        '',
                        '• **Acetaminophen 500mg** — Pain, fever (no anti-inflammatory effect)',
                        '  Dose: 500-1000mg every 4-6 hours, max 3000mg/day',
                        '  Cautions: liver toxicity with alcohol or overdose',
                        '',
                        '• **Diphenhydramine 25mg** — Allergic reactions, sleep aid, motion sickness',
                        '  Dose: 25-50mg every 6 hours, max 300mg/day',
                        '  Cautions: drowsiness, dry mouth, don\'t combine with alcohol',
                        '',
                        '• **Loperamide 2mg** — Diarrhea control',
                        '  Dose: 4mg initially, then 2mg after each loose stool, max 8mg/day',
                        '  Cautions: stop if fever or bloody stool (may need antibiotics instead)',
                        '',
                        '• **Aspirin 325mg** — Suspected heart attack ONLY in field context',
                        '  Dose: 1 tablet chewed (not swallowed) at onset of chest pain',
                        '  Cautions: blood thinner, avoid with active bleeding',
                        '',
                        '• **Antacids (Tums/calcium carbonate)** — Heartburn, GI distress',
                        '  Dose: 1-2 tabs as needed',
                        '',
                        '• **Hydrocortisone cream 1%** — Rash, insect bites, contact dermatitis',
                        '  Apply thin layer 2-3x daily',
                        '',
                        'PRESCRIPTION MEDICATIONS (Discuss With Your Physician):',
                        '⚠️ These require a prescription and medical training to use appropriately',
                        '',
                        '• **Epinephrine auto-injector** — Anaphylaxis (severe allergic reaction)',
                        '  Carry if anyone on team has known severe allergies',
                        '',
                        '• **Ciprofloxacin 500mg** — Broad-spectrum antibiotic (travelers\' diarrhea, UTI)',
                        '  Discuss: for extended remote trips where evacuation >48 hours',
                        '',
                        '• **Amoxicillin 500mg** — Antibiotic (dental infection, skin infection, URI)',
                        '  Discuss: for extended trips, dental emergencies',
                        '',
                        '• **Ondansetron (Zofran) 4mg** — Anti-nausea/vomiting (dissolving tablet)',
                        '  Discuss: for preventing dehydration from vomiting',
                        '',
                        '• **Acetazolamide (Diamox) 125mg** — Altitude sickness prevention',
                        '  Discuss: for planned high-altitude operations',
                        '',
                        'EXPIRATION GUIDANCE:',
                        '• Most tablets/capsules remain effective 1-2 years past printed expiration',
                        '• Liquids, creams, and injectables: follow printed expiration strictly',
                        '• Epinephrine: replace at expiration — potency loss is clinically significant',
                        '• Store medications cool, dry, and dark (NOT in a hot car)',
                        '• Rotate stock: when you use a dose from your kit, replace it at next resupply',
                        '• Mark the expiration date on the OUTSIDE of the package for quick inspection',
                        '',
                        'DOCUMENTATION:',
                        '• Record every medication given: drug, dose, time, patient name',
                        '• This information is critical for hospital handoff',
                        '• A Sharpie on the patient\'s forehead or arm is acceptable in mass casualty'
                    ],
                    notes: 'This is a reference list, not medical advice. Discuss all medications — especially prescriptions — with your physician before adding them to your kit. They can help you identify medications that are appropriate for your specific situation, medical history, and expected environment. Carry a written list of what\'s in your kit and the indications for each medication.',
                    equipment: ['Waterproof medication bag', 'Medication reference card', 'Sharpie for documentation']
                }
            ]
        }
    };

    // State
    let bookmarks = [];
    let searchQuery = '';
    let activeCategory = null;
    let expandedItem = null;

    /**
     * Initialize the module
     */
    function init() {
        // Load bookmarks from storage
        loadBookmarks();
    }

    /**
     * Load bookmarks from storage
     */
    async function loadBookmarks() {
        try {
            const saved = await Storage.Settings.get('medical_bookmarks');
            if (saved) {
                bookmarks = saved;
            }
        } catch (e) {
            console.error('Failed to load medical bookmarks:', e);
        }
    }

    /**
     * Save bookmarks to storage
     */
    async function saveBookmarks() {
        try {
            await Storage.Settings.set('medical_bookmarks', bookmarks);
        } catch (e) {
            console.error('Failed to save medical bookmarks:', e);
        }
    }

    /**
     * Toggle bookmark for an item
     */
    function toggleBookmark(itemId) {
        const index = bookmarks.indexOf(itemId);
        if (index > -1) {
            bookmarks.splice(index, 1);
        } else {
            bookmarks.push(itemId);
        }
        saveBookmarks();
        return bookmarks.includes(itemId);
    }

    /**
     * Check if item is bookmarked
     */
    function isBookmarked(itemId) {
        return bookmarks.includes(itemId);
    }

    /**
     * Search the medical database
     */
    function search(query) {
        searchQuery = query.toLowerCase().trim();
        const results = [];

        if (!searchQuery) {
            return results;
        }

        Object.entries(MEDICAL_DATABASE).forEach(([catKey, category]) => {
            category.items.forEach(item => {
                const searchFields = [
                    item.title,
                    item.summary,
                    ...(item.keywords || []),
                    ...(item.protocol || [])
                ].join(' ').toLowerCase();

                if (searchFields.includes(searchQuery)) {
                    results.push({
                        ...item,
                        category: catKey,
                        categoryName: category.name,
                        categoryIcon: category.icon,
                        categoryColor: category.color
                    });
                }
            });
        });

        // Sort by relevance (title match first)
        results.sort((a, b) => {
            const aTitle = a.title.toLowerCase().includes(searchQuery);
            const bTitle = b.title.toLowerCase().includes(searchQuery);
            if (aTitle && !bTitle) return -1;
            if (!aTitle && bTitle) return 1;
            return 0;
        });

        return results;
    }

    /**
     * Get items for a category
     */
    function getCategoryItems(categoryKey) {
        const category = MEDICAL_DATABASE[categoryKey];
        if (!category) return [];
        
        return category.items.map(item => ({
            ...item,
            category: categoryKey,
            categoryName: category.name,
            categoryIcon: category.icon,
            categoryColor: category.color
        }));
    }

    /**
     * Get a single item by ID
     */
    function getItem(itemId) {
        for (const [catKey, category] of Object.entries(MEDICAL_DATABASE)) {
            const item = category.items.find(i => i.id === itemId);
            if (item) {
                return {
                    ...item,
                    category: catKey,
                    categoryName: category.name,
                    categoryIcon: category.icon,
                    categoryColor: category.color
                };
            }
        }
        return null;
    }

    /**
     * Get bookmarked items
     */
    function getBookmarkedItems() {
        return bookmarks.map(id => getItem(id)).filter(Boolean);
    }

    /**
     * Get severity color
     */
    function getSeverityColor(severity) {
        const colors = {
            critical: '#ef4444',
            high: '#f59e0b',
            moderate: '#3b82f6',
            low: '#22c55e',
            info: '#6b7280'
        };
        return colors[severity] || colors.info;
    }

    /**
     * Get severity label
     */
    function getSeverityLabel(severity) {
        const labels = {
            critical: 'CRITICAL',
            high: 'HIGH PRIORITY',
            moderate: 'MODERATE',
            low: 'LOW PRIORITY',
            info: 'REFERENCE'
        };
        return labels[severity] || 'INFO';
    }

    /**
     * Get state for UI
     */
    function getState() {
        return {
            searchQuery,
            activeCategory,
            expandedItem,
            bookmarkCount: bookmarks.length
        };
    }

    /**
     * Set active category
     */
    function setActiveCategory(category) {
        activeCategory = category;
        expandedItem = null;
    }

    /**
     * Set expanded item
     */
    function setExpandedItem(itemId) {
        expandedItem = itemId;
    }

    /**
     * Get database for export/printing
     */
    function getDatabase() {
        return MEDICAL_DATABASE;
    }

    /**
     * Get protocol categories (excludes medications)
     * Returns object format for compatibility
     */
    function getCategories() {
        const cats = {};
        Object.entries(MEDICAL_DATABASE).forEach(([key, cat]) => {
            if (key !== 'medications') {
                cats[key] = {
                    name: cat.name,
                    icon: cat.icon,
                    color: cat.color,
                    itemCount: cat.items.length
                };
            }
        });
        return cats;
    }

    /**
     * Get medication categories for separate display
     */
    function getMedCategories() {
        return {
            pain: { name: 'Pain Relief', icon: '💊' },
            allergy: { name: 'Allergy', icon: '🤧' },
            gi: { name: 'GI/Stomach', icon: '🫃' },
            antibiotic: { name: 'Antibiotics', icon: '💉' },
            altitude: { name: 'Altitude', icon: '🏔️' },
            other: { name: 'Other', icon: '📋' }
        };
    }

    /**
     * Get protocols for a specific category
     */
    function getProtocolsByCategory(categoryKey) {
        const cat = MEDICAL_DATABASE[categoryKey];
        if (!cat) return [];
        return cat.items.map(item => transformProtocol(item, categoryKey));
    }

    /**
     * Get a single protocol by ID
     */
    function getProtocol(protocolId) {
        for (const [catKey, category] of Object.entries(MEDICAL_DATABASE)) {
            const item = category.items.find(i => i.id === protocolId);
            if (item) {
                return transformProtocol(item, catKey);
            }
        }
        return null;
    }

    /**
     * Transform internal protocol structure to UI-expected format
     */
    function transformProtocol(item, categoryKey) {
        // Convert protocol array to steps format
        const steps = [];
        let currentStep = { title: 'Procedure', content: '', warning: '' };
        
        if (item.protocol && Array.isArray(item.protocol)) {
            item.protocol.forEach(line => {
                if (line === '') {
                    if (currentStep.content) {
                        steps.push({ ...currentStep });
                        currentStep = { title: 'Continue', content: '', warning: '' };
                    }
                } else if (line.endsWith(':') && !line.includes(' ')) {
                    // This is a section header
                    if (currentStep.content) {
                        steps.push({ ...currentStep });
                    }
                    currentStep = { title: line.slice(0, -1), content: '', warning: '' };
                } else if (line.startsWith('WARNING:') || line.startsWith('CAUTION:')) {
                    currentStep.warning = line.substring(line.indexOf(':') + 1).trim();
                } else {
                    currentStep.content += (currentStep.content ? '\n' : '') + line;
                }
            });
            if (currentStep.content) {
                steps.push(currentStep);
            }
        }

        // If we didn't parse any steps, create one big step
        if (steps.length === 0 && item.protocol) {
            steps.push({
                title: 'Protocol',
                content: Array.isArray(item.protocol) ? item.protocol.join('\n') : item.protocol,
                warning: ''
            });
        }

        return {
            id: item.id,
            title: item.title,
            severity: item.severity || 'info',
            tags: item.keywords || [],
            overview: item.summary || '',
            steps: steps,
            equipment: item.equipment || [],
            medications: [], // Could be enhanced later
            notes: item.notes || '',
            category: categoryKey,
            categoryName: MEDICAL_DATABASE[categoryKey]?.name || ''
        };
    }

    /**
     * Get all medications as a keyed object
     */
    function getAllMedications() {
        const meds = {};
        const medCategory = MEDICAL_DATABASE.medications;
        if (medCategory && medCategory.items) {
            medCategory.items.forEach(item => {
                meds[item.id] = transformMedication(item);
            });
        }
        return meds;
    }

    /**
     * Get a single medication by ID
     */
    function getMedication(medId) {
        const meds = MEDICAL_DATABASE.medications;
        if (!meds) return null;
        const item = meds.items.find(i => i.id === medId);
        if (item) {
            return transformMedication(item);
        }
        return null;
    }

    /**
     * Get medications by category
     */
    function getMedicationsByCategory(catKey) {
        const allMeds = getAllMedications();
        return Object.values(allMeds).filter(m => m.category === catKey);
    }

    /**
     * Transform medication data to expected format
     */
    function transformMedication(item) {
        // Determine category based on title/keywords
        let category = 'other';
        const lowerTitle = item.title.toLowerCase();
        if (lowerTitle.includes('pain') || lowerTitle.includes('ibuprofen') || lowerTitle.includes('acetaminophen')) {
            category = 'pain';
        } else if (lowerTitle.includes('allergy') || lowerTitle.includes('antihistamine')) {
            category = 'allergy';
        } else if (lowerTitle.includes('gi') || lowerTitle.includes('stomach') || lowerTitle.includes('diarrhea')) {
            category = 'gi';
        } else if (lowerTitle.includes('antibiotic')) {
            category = 'antibiotic';
        } else if (lowerTitle.includes('altitude')) {
            category = 'altitude';
        }

        // Extract uses from protocol
        const uses = [];
        if (item.keywords) {
            uses.push(...item.keywords.slice(0, 3));
        }

        // Parse dosing from protocol
        const dosing = {};
        const warnings = [];
        const interactions = [];

        if (item.protocol && Array.isArray(item.protocol)) {
            item.protocol.forEach(line => {
                if (line.toLowerCase().includes('dose:') || line.toLowerCase().includes('- dose:')) {
                    const match = line.match(/dose:?\s*(.+)/i);
                    if (match) {
                        dosing.standard = match[1].trim();
                    }
                }
                if (line.toLowerCase().includes('caution:') || line.toLowerCase().includes('warning')) {
                    warnings.push(line);
                }
                if (line.includes('+') && line.includes('=')) {
                    interactions.push(line);
                }
            });
        }

        return {
            id: item.id,
            name: item.title,
            category: category,
            uses: uses.length > 0 ? uses : [item.summary?.split('.')[0] || 'General use'],
            dosing: Object.keys(dosing).length > 0 ? dosing : { standard: 'See protocol' },
            warnings: warnings.length > 0 ? warnings : [],
            interactions: interactions,
            notes: item.notes || '',
            protocol: item.protocol || []
        };
    }

    /**
     * Expose MEDICATIONS for panels.js compatibility
     */
    const MEDICATIONS = (() => {
        const meds = {};
        const medCategory = MEDICAL_DATABASE.medications;
        if (medCategory && medCategory.items) {
            medCategory.items.forEach(item => {
                meds[item.id] = transformMedication(item);
            });
        }
        return meds;
    })();

    /**
     * Get quick reference tables for essential medical data
     */
    function getQuickReferences() {
        return {
            vitalSigns: {
                title: '📊 Normal Vital Signs (Adults)',
                content: [
                    { label: 'Heart Rate', value: '60-100 bpm' },
                    { label: 'Respiratory Rate', value: '12-20 breaths/min' },
                    { label: 'Blood Pressure', value: '90-140 / 60-90 mmHg' },
                    { label: 'Temperature', value: '97.8-99.1°F (36.5-37.3°C)' },
                    { label: 'SpO2', value: '95-100%' },
                    { label: 'Blood Glucose', value: '70-120 mg/dL' }
                ]
            },
            cpr: {
                title: '❤️ CPR Guidelines',
                content: [
                    { label: 'Compression Rate', value: '100-120/min' },
                    { label: 'Compression Depth', value: '2-2.4 inches (5-6 cm)' },
                    { label: 'Ratio (1 rescuer)', value: '30:2' },
                    { label: 'Ratio (2 rescuer)', value: '30:2 (15:2 child)' },
                    { label: 'AED Check', value: 'Every 2 minutes' },
                    { label: 'Pulse Check', value: 'Max 10 seconds' }
                ]
            },
            burns: {
                title: '🔥 Rule of 9s (Burn Area)',
                content: [
                    { label: 'Head & Neck', value: '9%' },
                    { label: 'Each Arm', value: '9%' },
                    { label: 'Chest (front)', value: '9%' },
                    { label: 'Abdomen (front)', value: '9%' },
                    { label: 'Upper Back', value: '9%' },
                    { label: 'Lower Back', value: '9%' },
                    { label: 'Each Leg (front)', value: '9%' },
                    { label: 'Each Leg (back)', value: '9%' },
                    { label: 'Groin', value: '1%' },
                    { label: 'Palm of Hand', value: '~1%' }
                ]
            },
            gcs: {
                title: '🧠 Glasgow Coma Scale',
                content: [
                    { label: 'Eye - Spontaneous', value: '4' },
                    { label: 'Eye - To voice', value: '3' },
                    { label: 'Eye - To pain', value: '2' },
                    { label: 'Eye - None', value: '1' },
                    { label: 'Verbal - Oriented', value: '5' },
                    { label: 'Verbal - Confused', value: '4' },
                    { label: 'Verbal - Inappropriate', value: '3' },
                    { label: 'Verbal - Incomprehensible', value: '2' },
                    { label: 'Verbal - None', value: '1' },
                    { label: 'Motor - Obeys commands', value: '6' },
                    { label: 'Motor - Localizes pain', value: '5' },
                    { label: 'Motor - Withdraws', value: '4' },
                    { label: 'Motor - Flexion', value: '3' },
                    { label: 'Motor - Extension', value: '2' },
                    { label: 'Motor - None', value: '1' },
                    { label: 'TOTAL (Normal)', value: '15' },
                    { label: 'Severe TBI', value: '≤8' }
                ]
            },
            bloodLoss: {
                title: '🩸 Hemorrhage Classification',
                content: [
                    { label: 'Class I - Blood Loss', value: '<750 mL (<15%)' },
                    { label: 'Class I - Heart Rate', value: '<100' },
                    { label: 'Class II - Blood Loss', value: '750-1500 mL (15-30%)' },
                    { label: 'Class II - Heart Rate', value: '100-120' },
                    { label: 'Class III - Blood Loss', value: '1500-2000 mL (30-40%)' },
                    { label: 'Class III - Heart Rate', value: '120-140' },
                    { label: 'Class IV - Blood Loss', value: '>2000 mL (>40%)' },
                    { label: 'Class IV - Heart Rate', value: '>140' }
                ]
            },
            painMeds: {
                title: '💊 Pain Medication Quick Dosing',
                content: [
                    { label: 'Acetaminophen (Tylenol)', value: '325-650mg q4-6h (max 3g/day)' },
                    { label: 'Ibuprofen (Advil)', value: '200-400mg q4-6h (max 1.2g/day)' },
                    { label: 'Naproxen (Aleve)', value: '220-440mg q8-12h (max 660mg/day)' },
                    { label: 'Aspirin', value: '325-650mg q4h (max 4g/day)' }
                ]
            },
            allergyMeds: {
                title: '🤧 Allergy Medication Dosing',
                content: [
                    { label: 'Diphenhydramine (Benadryl)', value: '25-50mg q4-6h (max 300mg/day)' },
                    { label: 'Cetirizine (Zyrtec)', value: '10mg once daily' },
                    { label: 'Loratadine (Claritin)', value: '10mg once daily' },
                    { label: 'Epinephrine (EpiPen)', value: '0.3mg IM, may repeat x1' }
                ]
            },
            hypothermia: {
                title: '🥶 Hypothermia Stages',
                content: [
                    { label: 'Mild (90-95°F)', value: 'Shivering, alert, clumsy' },
                    { label: 'Moderate (82-90°F)', value: 'Shivering stops, confused' },
                    { label: 'Severe (<82°F)', value: 'Unconscious, rigid' },
                    { label: 'Treatment', value: 'Remove wet, insulate, warm core' }
                ]
            },
            altitude: {
                title: '🏔️ Altitude Illness',
                content: [
                    { label: 'AMS begins', value: '>8,000 ft (2,400m)' },
                    { label: 'High altitude', value: '8,000-12,000 ft' },
                    { label: 'Very high altitude', value: '12,000-18,000 ft' },
                    { label: 'Extreme altitude', value: '>18,000 ft' },
                    { label: 'Safe ascent rate', value: '<1,000 ft/day above 10,000' },
                    { label: 'Diamox prophylaxis', value: '125-250mg BID' }
                ]
            },
            pedsVitals: {
                title: '👶 Pediatric Vital Signs by Age',
                content: [
                    { label: 'Infant HR', value: '100-160 bpm' },
                    { label: 'Infant RR', value: '30-60 breaths/min' },
                    { label: 'Infant SBP', value: '70-90 mmHg' },
                    { label: 'Toddler (1-3y) HR', value: '90-150 bpm' },
                    { label: 'Toddler RR', value: '24-40 breaths/min' },
                    { label: 'Toddler SBP', value: '80-100 mmHg' },
                    { label: 'Child (4-8y) HR', value: '70-120 bpm' },
                    { label: 'Child RR', value: '18-30 breaths/min' },
                    { label: 'Child SBP', value: '90-110 mmHg' },
                    { label: 'Adolescent HR', value: '60-100 bpm' },
                    { label: 'Adolescent RR', value: '12-20 breaths/min' },
                    { label: 'Adolescent SBP', value: '100-120 mmHg' },
                    { label: 'Low BP formula', value: '70 + (age × 2) mmHg = lower limit of normal' }
                ]
            },
            pedsMeds: {
                title: '💊 Pediatric Medication Dosing',
                content: [
                    { label: 'Ibuprofen', value: '10 mg/kg q6-8h (max 40 mg/kg/day)' },
                    { label: 'Acetaminophen', value: '15 mg/kg q4-6h (max 75 mg/kg/day)' },
                    { label: 'Diphenhydramine', value: '1-1.25 mg/kg q6h (max 5 mg/kg/day)' },
                    { label: 'Epinephrine (IM)', value: '0.01 mg/kg (max 0.3mg child, 0.15mg infant)' },
                    { label: 'ORS volume (mild)', value: '50 ml/kg over 4 hours' },
                    { label: 'ORS volume (moderate)', value: '100 ml/kg over 4 hours' }
                ]
            },
            avpu: {
                title: '🧠 AVPU Scale',
                content: [
                    { label: 'A — Alert', value: 'Eyes open, aware, responds to questions' },
                    { label: 'V — Voice', value: 'Responds to verbal stimulus only' },
                    { label: 'P — Pain', value: 'Responds to painful stimulus only' },
                    { label: 'U — Unresponsive', value: 'No response to any stimulus' },
                    { label: 'Use when', value: 'Quick field assessment (faster than GCS)' },
                    { label: 'V or worse', value: 'Consider airway management' },
                    { label: 'P or U', value: 'GCS likely ≤8, critical patient' }
                ]
            },
            woundInfection: {
                title: '🩹 Wound Infection Timeline',
                content: [
                    { label: '0-6 hours', value: 'Contamination — bacteria present, not multiplying' },
                    { label: '6-24 hours', value: 'Colonization — minimal visible signs' },
                    { label: '24-48 hours', value: 'Local infection — redness, warmth, swelling, pain' },
                    { label: '48-72 hours', value: 'Spreading — cellulitis, red streaks, fever' },
                    { label: '72+ hours', value: 'Systemic risk — sepsis possible' },
                    { label: 'Key early sign', value: 'Increasing pain (most reliable indicator)' },
                    { label: 'Red streaks', value: '⚠️ URGENT — lymphangitis, start antibiotics, evacuate' }
                ]
            },
            rapidTrauma: {
                title: '🔍 Rapid Trauma Assessment (DCAP-BTLS)',
                content: [
                    { label: 'D — Deformities', value: 'Bones out of alignment, asymmetry' },
                    { label: 'C — Contusions', value: 'Bruising, discoloration' },
                    { label: 'A — Abrasions', value: 'Scrapes, road rash' },
                    { label: 'P — Punctures', value: 'Penetrating wounds, holes' },
                    { label: 'B — Burns', value: 'Thermal, chemical, electrical' },
                    { label: 'T — Tenderness', value: 'Pain on palpation' },
                    { label: 'L — Lacerations', value: 'Cuts, tears in skin' },
                    { label: 'S — Swelling', value: 'Edema, fluid accumulation' },
                    { label: 'Check order', value: 'Head → Neck → Chest → Abdomen → Pelvis → Extremities → Back' },
                    { label: 'Remember', value: 'Look, listen, feel at EACH region' }
                ]
            },
            crushRelease: {
                title: '⚠️ Crush Release Decision Matrix',
                content: [
                    { label: '<1 hour trapped', value: 'Release immediately, monitor, oral fluids' },
                    { label: '1-4 hours trapped', value: 'Fluid load 30 min before release if possible' },
                    { label: '>4 hours + fluids', value: 'Aggressive IV/oral fluids → tourniquet → release → slow TQ release' },
                    { label: '>4 hours NO fluids', value: 'Tourniquet before release, oral fluids ASAP' },
                    { label: '>4 hrs, no TQ, no fluids', value: '⚠️ Consider leaving trapped if evac >12hr (toxins sequestered)' },
                    { label: 'Post-release danger', value: 'Cardiac arrest risk 5-30 min after release' },
                    { label: 'Key sign', value: 'Dark/cola urine = myoglobin = kidney damage' },
                    { label: '#1 intervention', value: 'FLUIDS BEFORE RELEASE' }
                ]
            },
            medCompatibility: {
                title: '💊 Common Field Med Interactions',
                content: [
                    { label: 'Ibuprofen + Acetaminophen', value: '✅ Safe — alternate every 3 hours' },
                    { label: 'Ibuprofen + Naproxen', value: '❌ Both NSAIDs — do NOT combine' },
                    { label: 'Ibuprofen + Aspirin', value: '⚠️ Avoid — ibuprofen blocks aspirin\'s cardiac benefit' },
                    { label: 'Acetaminophen + Aspirin', value: '✅ Safe — different mechanisms' },
                    { label: 'Diphenhydramine + any above', value: '✅ Safe — may cause drowsiness' },
                    { label: 'NSAIDs + bleeding risk', value: '⚠️ All NSAIDs thin blood — avoid with active bleeding' },
                    { label: 'Acetaminophen + alcohol', value: '❌ Liver damage risk — max 2g/day if any alcohol' },
                    { label: 'Max Acetaminophen', value: '3g/day (2g/day with liver concerns)' },
                    { label: 'Max Ibuprofen (OTC)', value: '1.2g/day' }
                ]
            },
            ifakChecklist: {
                title: '🩹 IFAK Resupply Checklist',
                content: [
                    { label: 'Tourniquet (CAT/SOF-T)', value: '×1 — inspect every 6 months for wear/UV damage' },
                    { label: 'Hemostatic gauze', value: '×1 — check expiration annually, replace if opened' },
                    { label: 'Chest seals (vented)', value: '×2 — check adhesive seal integrity every 6 months' },
                    { label: 'Pressure bandage (6")', value: '×1 — check vacuum seal, replace if compromised' },
                    { label: 'Compressed gauze', value: '×1 — replace if packaging opened or wet' },
                    { label: 'NPA + lube', value: '×1 (28Fr) — check lube packet, replace annually' },
                    { label: 'Nitrile gloves', value: '×2 pair — replace if brittle or discolored' },
                    { label: 'Trauma shears', value: '×1 — clean and oil hinge, sharpen or replace' },
                    { label: 'Sharpie + casualty card', value: '×1 each — test marker, replace if dry' },
                    { label: 'Space blanket', value: '×1 — replace after any use (single-use item)' },
                    { label: 'Inspect schedule', value: 'Full inventory: monthly. Expiration check: quarterly.' }
                ]
            },
            kitWeight: {
                title: '🎒 Kit Weight Targets',
                content: [
                    { label: 'IFAK (individual)', value: '1.5-2.5 lbs — on body, always' },
                    { label: 'Day hike 10 Essentials', value: '5-8 lbs — every trip, no exceptions' },
                    { label: '24-hour go bag', value: '10-15 lbs — grab in 5 minutes' },
                    { label: '72-hour go bag', value: '25-35 lbs — grab in 15 minutes' },
                    { label: 'SAR individual pack', value: '25-35 lbs — personal + SAR gear' },
                    { label: 'Team medical kit', value: '8-12 lbs — carried by medic/team lead' },
                    { label: 'Litter team add-on', value: '+5-10 lbs — distributed across 4-6 members' },
                    { label: 'Technical rescue', value: '+8-15 lbs — rope/hardware addition' },
                    { label: 'Fitness test', value: 'Carry your full kit 3 miles — if you can\'t, lighten it' }
                ]
            }
        };
    }

    // Public API
    return {
        init,
        search,
        getCategories,
        getMedCategories,
        getCategoryItems,
        getItem,
        getProtocol,
        getProtocolsByCategory,
        getMedication,
        getAllMedications,
        getMedicationsByCategory,
        getBookmarkedItems,
        toggleBookmark,
        isBookmarked,
        getSeverityColor,
        getSeverityLabel,
        getState,
        setActiveCategory,
        setExpandedItem,
        getDatabase,
        getQuickReferences,
        MEDICAL_DATABASE,
        MEDICATIONS
    };
})();

window.MedicalModule = MedicalModule;
