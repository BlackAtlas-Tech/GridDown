/**
 * GridDown Field Guides Module - Offline Survival Reference
 * Comprehensive wilderness survival, foraging, and skills database
 * 
 * DISCLAIMER: This information is for educational reference only.
 * Proper identification of wild plants requires hands-on training.
 * When in doubt, do NOT eat it. Many plants have toxic look-alikes.
 */
const FieldGuidesModule = (function() {
    'use strict';

    // State
    let activeCategory = 'survival';
    let activeSubcategory = null;
    let expandedItem = null;
    let searchQuery = '';
    let bookmarks = [];

    // Load bookmarks from storage
    function loadBookmarks() {
        try {
            const stored = localStorage.getItem('griddown_fieldguide_bookmarks');
            if (stored) bookmarks = JSON.parse(stored);
        } catch (e) {
            bookmarks = [];
        }
    }

    function saveBookmarks() {
        try {
            localStorage.setItem('griddown_fieldguide_bookmarks', JSON.stringify(bookmarks));
        } catch (e) {}
    }

    // =====================================================
    // FIELD GUIDES DATABASE
    // =====================================================
    
    const FIELD_GUIDES = {
        
        // =====================================================
        // SURVIVAL SKILLS
        // =====================================================
        survival: {
            name: 'Survival Skills',
            icon: '🏕️',
            color: '#22c55e',
            subcategories: {
                fire: {
                    name: 'Fire Starting',
                    icon: '🔥',
                    items: [
                        {
                            id: 'fire-basics',
                            title: 'Fire Triangle & Basics',
                            keywords: ['fire', 'heat', 'fuel', 'oxygen', 'combustion'],
                            summary: 'Understanding the three elements required for fire: heat, fuel, and oxygen.',
                            content: [
                                '## The Fire Triangle',
                                'Fire requires three elements:',
                                '• **Heat** - Initial ignition source',
                                '• **Fuel** - Combustible material',
                                '• **Oxygen** - Air flow',
                                '',
                                '## Fire Lay Progression',
                                '1. **Tinder** - Catches spark, burns fast (2-3 minutes worth)',
                                '2. **Kindling** - Pencil-thick sticks, sustains flame',
                                '3. **Fuel** - Wrist-thick and larger, provides heat',
                                '',
                                '## Tinder Sources',
                                '• Dry grass, leaves, pine needles',
                                '• Birch bark (contains flammable oils)',
                                '• Cattail fluff, thistle down',
                                '• Fatwood / resinous wood shavings',
                                '• Char cloth, dryer lint, cotton balls with vaseline',
                                '• Fine wood shavings (feather stick)',
                                '',
                                '## Fire Lays',
                                '**Teepee**: Good starting structure, burns hot and fast',
                                '**Log Cabin**: Stable, good airflow, longer burn',
                                '**Lean-to**: Wind-resistant, reflects heat one direction',
                                '**Star/Radial**: Long logs fed inward, efficient fuel use',
                                '**Dakota Hole**: Underground, smokeless, wind-resistant'
                            ],
                            tips: [
                                'Gather 3x more tinder/kindling than you think you need',
                                'Protect your fire-starting materials from moisture',
                                'Dead standing wood is drier than ground wood',
                                'Small flames need small fuel - don\'t smother with big logs'
                            ]
                        },
                        {
                            id: 'fire-bow-drill',
                            title: 'Bow Drill Fire',
                            keywords: ['bow drill', 'friction fire', 'primitive', 'spindle', 'fireboard'],
                            summary: 'Friction fire method using a bow, spindle, fireboard, and bearing block.',
                            content: [
                                '## Components',
                                '**Fireboard**: Flat, dry softwood (willow, cedar, cottonwood)',
                                '**Spindle**: Straight, dry, same wood as fireboard, ~12" long',
                                '**Bow**: Curved branch with cordage, ~arm length',
                                '**Bearing Block**: Hardwood or stone with socket for spindle top',
                                '**Coal Catcher**: Bark or leaf under notch',
                                '',
                                '## Fireboard Setup',
                                '1. Carve shallow depression for spindle',
                                '2. Burn in the hole with initial drilling',
                                '3. Cut V-notch to edge (1/8 of circle)',
                                '4. Notch allows coal dust to collect',
                                '',
                                '## Technique',
                                '1. Wrap spindle with bow string (one loop)',
                                '2. Place spindle in fireboard depression',
                                '3. Apply downward pressure with bearing block',
                                '4. Saw bow back and forth - FULL strokes',
                                '5. Start slow, increase speed as smoke appears',
                                '6. Dark smoke and pile of dust = coal forming',
                                '7. Stop when coal glows, carefully transfer to tinder',
                                '8. Blow gently until flame appears',
                                '',
                                '## Common Problems',
                                '• **Squeaking**: Wood too hard or wet, reduce pressure',
                                '• **No coal**: Notch too small, not enough friction',
                                '• **Spindle pops out**: More downward pressure needed',
                                '• **String slips**: Wrap tighter, use rosin/pitch'
                            ],
                            tips: [
                                'Practice when you don\'t need it',
                                'Same wood for spindle and fireboard works best',
                                'The "fingernail test": if you can dent it, it may work',
                                'Keep your arms locked, use your back for power'
                            ],
                            diagram: 'bow-drill'
                        },
                        {
                            id: 'fire-ferro-rod',
                            title: 'Ferro Rod / Fire Steel',
                            keywords: ['ferro rod', 'ferrocerium', 'fire steel', 'sparks', 'striker'],
                            summary: 'Modern fire-starting tool producing 3000°F sparks, works when wet.',
                            content: [
                                '## How It Works',
                                'Ferrocerium alloy produces extremely hot sparks when scraped.',
                                'Sparks reach ~3000°F (1650°C) - hot enough to ignite most tinder.',
                                '',
                                '## Technique',
                                '1. Prepare tinder nest/bundle first',
                                '2. Hold rod steady against tinder',
                                '3. Scrape striker DOWN the rod (not rod across striker)',
                                '4. Direct sparks into center of tinder',
                                '5. Once smoking, gently blow to flame',
                                '',
                                '## Best Tinder for Ferro Rod',
                                '• Petroleum jelly cotton balls (best)',
                                '• Char cloth',
                                '• Birch bark shavings',
                                '• Fine fatwood shavings',
                                '• Dry grass/bark dust',
                                '• Commercial tinder tabs',
                                '',
                                '## Tips',
                                '• Keep protective coating on new rods',
                                '• Scrape coating off before first use',
                                '• Move the striker, not the rod (better control)',
                                '• 90° angle gives best sparks',
                                '• Works wet - just dry the surface first'
                            ],
                            tips: [
                                'Carry multiple strikers - back of knife, hacksaw blade',
                                'The spine of most knives works as a striker',
                                'Practice getting flame in under 30 seconds'
                            ]
                        },
                        {
                            id: 'fire-flint-steel',
                            title: 'Flint & Steel (Traditional)',
                            keywords: ['flint', 'steel', 'char cloth', 'traditional', 'sparks'],
                            summary: 'Traditional method using flint rock and high-carbon steel with char cloth.',
                            content: [
                                '## Materials',
                                '**Flint**: Sharp-edged stone (chert, jasper, quartz also work)',
                                '**Steel**: High-carbon steel striker (not stainless)',
                                '**Char Cloth**: Charred cotton fabric (catches spark)',
                                '',
                                '## Making Char Cloth',
                                '1. Cut 100% cotton into 1-2" squares',
                                '2. Place in metal tin with small hole in lid',
                                '3. Heat tin in fire until smoke stops',
                                '4. Let cool completely before opening',
                                '5. Result: black, fragile fabric that catches sparks',
                                '',
                                '## Striking Technique',
                                '1. Hold char cloth on top of flint edge',
                                '2. Strike steel downward against flint edge',
                                '3. Sparks should land on char cloth',
                                '4. Glowing spot appears when spark catches',
                                '5. Fold char cloth into tinder bundle',
                                '6. Blow gently to flame',
                                '',
                                '## Alternative Catches',
                                '• True tinder fungus (Fomes fomentarius)',
                                '• Punk wood (soft, rotted wood)',
                                '• Amadou (prepared fungus)',
                                '• Dried cattail heads'
                            ],
                            tips: [
                                'Old files, rasps make good strikers',
                                'Stainless steel won\'t work - needs carbon steel',
                                'Store char cloth in waterproof container'
                            ]
                        }
                    ]
                },
                water: {
                    name: 'Water',
                    icon: '💧',
                    items: [
                        {
                            id: 'water-finding',
                            title: 'Finding Water',
                            keywords: ['water', 'source', 'stream', 'spring', 'groundwater'],
                            summary: 'Methods and indicators for locating water in the wilderness.',
                            content: [
                                '## Water Priority',
                                'Average survival time without water: **3 days**',
                                'Need: 2-4 liters/day (more in heat/exertion)',
                                '',
                                '## Best Sources (cleanest to riskiest)',
                                '1. **Spring** - Groundwater emerging, often cleanest',
                                '2. **Flowing stream** - Moving water, less stagnant',
                                '3. **Lake/Pond** - Standing water, more contamination',
                                '4. **Rain collection** - Very clean, collect directly',
                                '5. **Dew collection** - Wipe vegetation with cloth',
                                '6. **Snow/Ice** - Melt first (eating frozen = hypothermia)',
                                '',
                                '## Finding Indicators',
                                '• **Terrain**: Water flows downhill, check valleys',
                                '• **Vegetation**: Lush green = water nearby',
                                '• **Animals**: Game trails often lead to water',
                                '• **Birds**: Grain-eaters (pigeons) fly toward water at dusk',
                                '• **Insects**: Bees within 3 miles of water',
                                '• **Sound**: Listen for flowing water in quiet',
                                '',
                                '## Digging for Water',
                                '• Dig in outside bend of dry riverbeds',
                                '• Dig at base of cliffs/rock faces',
                                '• Look for damp sand/mud',
                                '• Dig 1-2 feet, let water seep in',
                                '',
                                '## DO NOT DRINK',
                                '• Saltwater (ocean, brackish)',
                                '• Urine (increases dehydration)',
                                '• Blood (high salt, protein = more water to process)',
                                '• Alcohol (diuretic, causes dehydration)'
                            ],
                            tips: [
                                'All natural water should be purified',
                                'Clear water can still contain pathogens',
                                'When desperate, muddy water > no water (filter/purify first)'
                            ]
                        },
                        {
                            id: 'water-purification',
                            title: 'Water Purification',
                            keywords: ['purification', 'boiling', 'filter', 'tablets', 'pathogens'],
                            summary: 'Methods to make water safe to drink by killing or removing pathogens.',
                            content: [
                                '## Pathogen Types',
                                '• **Protozoa** (Giardia, Crypto): Largest, filtered easily',
                                '• **Bacteria** (E.coli, Cholera): Killed by most methods',
                                '• **Viruses** (Hepatitis, Norovirus): Smallest, hardest to remove',
                                '',
                                '## Boiling (Most Reliable)',
                                '• **Rolling boil for 1 minute** (sea level)',
                                '• Add 1 minute per 1000ft/300m elevation',
                                '• Kills all pathogens',
                                '• Cons: Fuel required, doesn\'t remove chemicals',
                                '',
                                '## Chemical Treatment',
                                '**Iodine tablets**: 30 min wait, kills bacteria/viruses',
                                '**Chlorine dioxide**: 4 hours for Crypto, very effective',
                                '**Household bleach**: 2 drops/liter, 30 min wait',
                                '• Cons: Taste, doesn\'t kill Crypto (except ClO2)',
                                '',
                                '## Filtration',
                                '**Pump filters**: Remove protozoa, bacteria',
                                '**Gravity filters**: Same, no pumping',
                                '**Straw filters**: Personal use, lightweight',
                                '• Check pore size: 0.2 micron for bacteria',
                                '• Cons: Won\'t remove viruses (most filters)',
                                '',
                                '## UV Light (SteriPEN)',
                                '• Effective against all pathogens',
                                '• Water must be clear',
                                '• Cons: Batteries required, doesn\'t filter debris',
                                '',
                                '## Field Expedient Filter',
                                'Layer in container (bottom to top):',
                                '1. Gravel (large particles)',
                                '2. Sand (medium particles)',
                                '3. Charcoal (absorbs chemicals)',
                                '4. Sand',
                                '5. Gravel',
                                '**Note: Still requires boiling/chemical treatment**'
                            ],
                            tips: [
                                'Filter cloudy water through cloth first',
                                'Combo method best: filter + boil/chemical',
                                'Pre-filter extends filter life'
                            ]
                        },
                        {
                            id: 'water-solar-still',
                            title: 'Solar Still',
                            keywords: ['solar still', 'distillation', 'condensation', 'desert'],
                            summary: 'Emergency water collection using solar evaporation and condensation.',
                            content: [
                                '## How It Works',
                                'Sun evaporates moisture from soil/vegetation.',
                                'Plastic sheet condenses vapor, drips to collector.',
                                '',
                                '## Construction',
                                '1. Dig hole 3ft wide, 2ft deep',
                                '2. Place container in center',
                                '3. Add green vegetation around container',
                                '4. Cover with clear plastic sheet',
                                '5. Seal edges with dirt/rocks',
                                '6. Place small rock in center (creates drip point)',
                                '7. Ensure plastic doesn\'t touch container',
                                '',
                                '## Yield',
                                '• Expect: 0.5 - 1 liter per day',
                                '• Best in sunny, humid areas',
                                '• Energy to build may exceed water gained in some conditions',
                                '',
                                '## Variations',
                                '**Transpiration bag**: Tie clear bag over leafy branch',
                                '**Seawater still**: Pour saltwater in hole, distills fresh',
                                '**Urine still**: Pour urine in hole (last resort)',
                                '',
                                '## Improve Output',
                                '• Add succulent plants (cacti, etc)',
                                '• Urinate in hole (not in container!)',
                                '• Build multiple stills',
                                '• Site in full sun, protected from wind'
                            ],
                            tips: [
                                'Build in morning, collect in afternoon/evening',
                                'Clear plastic works better than colored',
                                'The energy cost may not be worth it - evaluate situation'
                            ],
                            diagram: 'solar-still'
                        }
                    ]
                },
                shelter: {
                    name: 'Shelter',
                    icon: '🏠',
                    items: [
                        {
                            id: 'shelter-priorities',
                            title: 'Shelter Priorities',
                            keywords: ['shelter', 'exposure', 'hypothermia', 'heat', 'protection'],
                            summary: 'Understanding when and why shelter is critical for survival.',
                            content: [
                                '## Rule of 3s',
                                '• 3 hours without shelter (extreme weather)',
                                '• 3 days without water',
                                '• 3 weeks without food',
                                '',
                                '## Primary Threats',
                                '**Cold**: Hypothermia kills faster than dehydration',
                                '**Heat**: Heat stroke, severe dehydration',
                                '**Wet**: Accelerates heat loss 25x',
                                '**Wind**: Wind chill dramatically increases heat loss',
                                '',
                                '## Site Selection',
                                '✓ Protected from wind',
                                '✓ Away from water (cold air, flooding)',
                                '✓ Away from dead trees (widowmakers)',
                                '✓ Near building materials',
                                '✓ Near water source (but not too close)',
                                '✗ Avoid valley bottoms (cold air pools)',
                                '✗ Avoid hilltops (wind exposure)',
                                '✗ Avoid game trails (animal traffic)',
                                '',
                                '## Insulation Priority',
                                '**Ground insulation is critical**',
                                'You lose more heat to ground than air.',
                                'Need 4-6 inches of dead leaves/pine needles below you.',
                                '',
                                '## Quick Shelter Options',
                                '• Natural: caves, rock overhangs, fallen trees',
                                '• Debris hut: fastest improvised shelter',
                                '• Tarp: if available, extremely versatile',
                                '• Snow: quinzee, snow cave (advanced)'
                            ],
                            tips: [
                                'Small shelters = easier to heat',
                                'Shelter from rain AND ground moisture',
                                'Build before you need it - takes longer than expected'
                            ]
                        },
                        {
                            id: 'shelter-debris-hut',
                            title: 'Debris Hut',
                            keywords: ['debris hut', 'shelter', 'leaves', 'primitive', 'insulation'],
                            summary: 'Classic survival shelter using natural materials for insulation.',
                            content: [
                                '## Overview',
                                'A-frame structure stuffed with dead leaves/debris.',
                                'Requires no tools, uses body heat for warmth.',
                                '',
                                '## Construction',
                                '**1. Ridgepole**',
                                '• 9-12ft pole, sturdy',
                                '• Prop one end on stump/rock (2-3ft high)',
                                '• Other end on ground',
                                '• Should be just long enough to lie in',
                                '',
                                '**2. Ribbing**',
                                '• Lean sticks along both sides',
                                '• Angle: 45-60 degrees',
                                '• Space: 6-8 inches apart',
                                '• Creates lattice structure',
                                '',
                                '**3. Lattice**',
                                '• Weave smaller sticks horizontally',
                                '• Prevents debris from falling through',
                                '',
                                '**4. Debris Layer**',
                                '• Pile dead leaves 2-3 feet thick',
                                '• Start at bottom, work up',
                                '• More is better - compress to check',
                                '• Should not see framework through debris',
                                '',
                                '**5. Shingling (optional)**',
                                '• Layer bark/branches over debris',
                                '• Sheds water, holds debris in place',
                                '',
                                '**6. Bedding**',
                                '• Fill interior with dry leaves',
                                '• 6+ inches below you',
                                '• More to pull over yourself',
                                '',
                                '**7. Door Plug**',
                                '• Pile of debris to block entrance',
                                '• Pull in behind you'
                            ],
                            tips: [
                                'Make it SMALL - just big enough to fit in',
                                'Gather 10x more debris than you think needed',
                                'Takes 2-4 hours to build properly',
                                'Test by lying inside - if cold, add more debris'
                            ],
                            diagram: 'debris-hut'
                        },
                        {
                            id: 'shelter-tarp',
                            title: 'Tarp Configurations',
                            keywords: ['tarp', 'shelter', 'configurations', 'rain', 'a-frame'],
                            summary: 'Versatile shelter setups using a basic tarp or poncho.',
                            content: [
                                '## A-Frame',
                                '• Ridgeline between two trees',
                                '• Tarp draped over, staked at corners',
                                '• Good rain protection, both ends open',
                                '',
                                '## Lean-To',
                                '• One edge high, other staked to ground',
                                '• Open front faces fire for heat reflection',
                                '• Minimal rain protection, good for warmth',
                                '',
                                '## Flying Diamond',
                                '• Single center pole or tree attachment',
                                '• Corners pulled out and staked',
                                '• 360° coverage, low profile',
                                '',
                                '## Plow Point',
                                '• One corner high on pole/tree',
                                '• Opposite corner staked to ground',
                                '• Other corners staked wide',
                                '• Good wind protection from one direction',
                                '',
                                '## Cornet / C-Fly',
                                '• Half A-frame with one side to ground',
                                '• Very wind resistant',
                                '• Enter from open end',
                                '',
                                '## Setup Tips',
                                '• Steep angles shed rain better',
                                '• Ridgeline slightly higher than tarp for tension',
                                '• Guylines at 45° angle for stability',
                                '• Use truckers hitch for tight lines',
                                '• Drip lines: tie cord on ridgeline where tarp meets it'
                            ],
                            tips: [
                                '8x10 tarp is ideal minimum size for 1 person',
                                'Silnylon: light but slippery knots',
                                'Always carry extra cordage',
                                'Face opening away from wind, toward fire'
                            ]
                        },
                        {
                            id: 'shelter-snow-cave',
                            title: 'Snow Shelter (Quinzee)',
                            keywords: ['snow', 'quinzee', 'snow cave', 'winter', 'cold'],
                            summary: 'Survival shelter made by hollowing out a pile of snow.',
                            content: [
                                '## Quinzee vs Snow Cave',
                                '**Quinzee**: Pile snow, let sinter, hollow out',
                                '**Snow Cave**: Dig into existing drift/bank',
                                'Quinzee works with any snow depth.',
                                '',
                                '## Building a Quinzee',
                                '**1. Pile Snow**',
                                '• Create dome 7-8ft diameter, 5ft tall',
                                '• Mix snow layers (helps sintering)',
                                '• Takes 1-2 hours',
                                '',
                                '**2. Sinter (Wait)**',
                                '• Let pile sit 1-2 hours (critical!)',
                                '• Snow crystals bond together',
                                '• Longer in cold temps',
                                '',
                                '**3. Insert Guide Sticks**',
                                '• Push sticks 12" deep all over dome',
                                '• Marks wall thickness while digging',
                                '',
                                '**4. Dig Out**',
                                '• Entrance low, angled up',
                                '• Sleeping platform above entrance',
                                '• Dome ceiling (prevents drips)',
                                '• Stop when you hit guide sticks',
                                '',
                                '**5. Ventilation**',
                                '• Poke vent hole in roof (critical!)',
                                '• Keep entrance partially open',
                                '• CO2 sinks, must be able to escape',
                                '',
                                '## Safety',
                                '⚠️ **Ventilation = life**: Never seal completely',
                                '⚠️ Mark entrance outside (visibility)',
                                '⚠️ Keep digging tool inside',
                                '⚠️ Interior should be ~32°F (warmer = melting)',
                                '',
                                '## Interior Temp',
                                'Body heat maintains 32°F+ inside.',
                                'Can be 50-70°F warmer than outside air.'
                            ],
                            tips: [
                                'Smooth ceiling prevents drips',
                                'Dig in shifts - sweating = wet = cold',
                                'Candle can boost temp and test ventilation',
                                'Platform MUST be above entrance'
                            ],
                            diagram: 'quinzee'
                        }
                    ]
                },
                navigation: {
                    name: 'Navigation',
                    icon: '🧭',
                    items: [
                        {
                            id: 'nav-compass',
                            title: 'Compass Basics',
                            keywords: ['compass', 'bearing', 'azimuth', 'declination', 'magnetic'],
                            summary: 'Using a baseplate compass for navigation and bearing travel.',
                            content: [
                                '## Compass Parts',
                                '• **Baseplate**: Transparent with ruler markings',
                                '• **Direction of travel arrow**: Points where you want to go',
                                '• **Rotating bezel**: Marked 0-360°',
                                '• **Orienting lines**: Inside bezel, align with map',
                                '• **Magnetic needle**: Red end points north',
                                '',
                                '## Taking a Bearing (Field)',
                                '1. Point direction-of-travel arrow at destination',
                                '2. Rotate bezel until needle aligns in orienting arrow',
                                '3. Read bearing at index line',
                                '',
                                '## Following a Bearing',
                                '1. Set desired bearing on bezel',
                                '2. Hold compass flat, rotate body until needle in orienting arrow',
                                '3. Walk in direction of travel arrow',
                                '4. Pick landmark, walk to it, repeat',
                                '',
                                '## Map to Field (with declination)',
                                '1. Place compass on map',
                                '2. Align edge with start and destination',
                                '3. Rotate bezel until orienting lines parallel to map grid lines',
                                '4. Read bearing, adjust for declination',
                                '5. Follow bearing in field',
                                '',
                                '## Magnetic Declination',
                                '• Difference between true north and magnetic north',
                                '• East declination: ADD to bearing',
                                '• West declination: SUBTRACT from bearing',
                                '• Or use adjustable declination compass',
                                '',
                                '## Common Errors',
                                '• Metal objects affecting needle',
                                '• Not holding compass level',
                                '• Parallax error when reading',
                                '• Forgetting declination adjustment'
                            ],
                            tips: [
                                'Red in the shed = needle in orienting arrow',
                                'Trust your compass, not your instincts',
                                'Check bearing frequently while traveling'
                            ]
                        },
                        {
                            id: 'nav-no-compass',
                            title: 'Navigation Without Compass',
                            keywords: ['sun', 'stars', 'shadow', 'navigation', 'direction'],
                            summary: 'Finding direction using natural indicators when you lack a compass.',
                            content: [
                                '## Shadow Stick Method',
                                '1. Place stick vertically in flat ground',
                                '2. Mark tip of shadow',
                                '3. Wait 15-30 minutes',
                                '4. Mark new shadow tip',
                                '5. Line between marks = East-West',
                                '6. First mark is West, second is East',
                                '7. Standing on line facing East, North is to your left',
                                '',
                                '## Watch Method (Northern Hemisphere)',
                                '• Point hour hand at sun',
                                '• Halfway between hour hand and 12 = South',
                                '• (Use 1 o\'clock if Daylight Saving Time)',
                                '',
                                '## North Star (Polaris)',
                                '1. Find Big Dipper',
                                '2. Pointer stars (edge of cup) point to Polaris',
                                '3. Distance = 5x the span of pointer stars',
                                '4. Polaris = True North',
                                '',
                                '## Southern Hemisphere',
                                '• No South Star equivalent',
                                '• Use Southern Cross:',
                                '  - Extend long axis 4.5x its length',
                                '  - That point is roughly South',
                                '',
                                '## Natural Indicators (Unreliable)',
                                'These are general tendencies, not rules:',
                                '• Moss: Often on north side (shade) - NOT reliable',
                                '• Tree growth: Can indicate prevailing wind',
                                '• Snow melt: South-facing slopes melt first',
                                '• Ant hills: Often on south side of trees',
                                '⚠️ Natural indicators vary - use multiple methods'
                            ],
                            tips: [
                                'Shadow method works anywhere sun is visible',
                                'Practice finding Polaris at home',
                                'Natural indicators = backup only'
                            ]
                        },
                        {
                            id: 'nav-lost',
                            title: 'When Lost: STOP Protocol',
                            keywords: ['lost', 'stop', 'panic', 'found', 'rescue'],
                            summary: 'What to do when you realize you\'re lost in the wilderness.',
                            content: [
                                '## S.T.O.P.',
                                '**S - Sit down**: Resist urge to keep moving',
                                '**T - Think**: How did you get here? Last known location?',
                                '**O - Observe**: What resources do you have? Landmarks?',
                                '**P - Plan**: Make a deliberate decision, don\'t wander',
                                '',
                                '## Decision: Stay or Go?',
                                '**STAY if**:',
                                '• Someone knows where you are',
                                '• You have shelter/supplies',
                                '• Terrain is difficult',
                                '• Weather is bad',
                                '• You\'re injured',
                                '',
                                '**GO if**:',
                                '• No one knows you\'re missing',
                                '• You know exactly which way to safety',
                                '• You have no shelter and weather is bad',
                                '• You\'re in immediate danger (flood, fire)',
                                '',
                                '## If You Stay',
                                '• Build shelter and fire',
                                '• Create signals (3 of anything = distress)',
                                '• Conserve energy',
                                '• Make yourself visible/audible',
                                '• Ration water and food',
                                '',
                                '## If You Go',
                                '• Leave note at last location',
                                '• Follow drainage (streams lead to rivers, rivers to civilization)',
                                '• Mark your trail (for searchers and backtracking)',
                                '• Travel during day, shelter at night',
                                '• Conserve energy - slow and steady',
                                '',
                                '## Signaling',
                                '• Signal fire (green vegetation = smoke)',
                                '• Whistle: 3 blasts',
                                '• Mirror flash at aircraft',
                                '• Ground-to-air signals',
                                '• Bright colors visible from air'
                            ],
                            tips: [
                                'Panic is the real enemy - control it first',
                                'Most searches succeed within 72 hours',
                                'Stay visible and near your last known position'
                            ]
                        }
                    ]
                },
                signaling: {
                    name: 'Signaling',
                    icon: '🚨',
                    items: [
                        {
                            id: 'signal-ground-air',
                            title: 'Ground-to-Air Signals',
                            keywords: ['signal', 'rescue', 'aircraft', 'ground', 'symbol'],
                            summary: 'International ground-to-air visual signals for rescue.',
                            content: [
                                '## International Signals',
                                'Make symbols at least 10ft tall, contrast with ground:',
                                '',
                                '**V** = Require Assistance',
                                '**X** = Require Medical Assistance',
                                '**I** = Proceeding this direction',
                                '**→** = Proceeding this direction',
                                '**II** = All is well, do not wait',
                                '**N** = No (negative)',
                                '**Y** = Yes (affirmative)',
                                '**□** = Require supplies',
                                '**F** = Need food and water',
                                '',
                                '## Making Signals Visible',
                                '• Contrast: Dark on light, light on dark',
                                '• Size: Minimum 3ft wide, 18ft long',
                                '• Shadow: Build up 3D for shadows',
                                '• Movement: Flapping cloth attracts attention',
                                '• Fire/smoke at night/day',
                                '',
                                '## Signal Mirror',
                                '• Can be seen 50+ miles',
                                '• Aim: Sight hole, peace sign, flash target',
                                '• Flash: Steady sweep, not constant',
                                '• Any reflective surface works (CD, foil, phone)',
                                '',
                                '## Signal Fire',
                                '• 3 fires in triangle = distress',
                                '• Day: Green vegetation for white smoke',
                                '• Night: Dry fuel for bright flame',
                                '• Platform above snow/wet ground',
                                '',
                                '## Body Signals to Aircraft',
                                '• Both arms up (Y): Yes / Need help',
                                '• One arm up, one down: No / Don\'t land',
                                '• Wave both arms overhead: Pick me up',
                                '• Point arm: Land this direction'
                            ],
                            tips: [
                                'Three of anything = universal distress signal',
                                'Signal mirror is the single best signaling device',
                                'Contrast and movement catch attention'
                            ]
                        }
                    ]
                }
            }
        },

        // =====================================================
        // KNOTS
        // =====================================================
        knots: {
            name: 'Knots',
            icon: '🪢',
            color: '#8b5cf6',
            subcategories: {
                essential: {
                    name: 'Essential Knots',
                    icon: '⭐',
                    items: [
                        {
                            id: 'knot-bowline',
                            title: 'Bowline',
                            keywords: ['bowline', 'loop', 'rescue', 'non-slip'],
                            summary: 'The "King of Knots" - creates a fixed loop that won\'t slip or jam.',
                            content: [
                                '## Uses',
                                '• Rescue loop around person',
                                '• Securing line to anchor',
                                '• Any fixed loop that must not slip',
                                '',
                                '## Properties',
                                '• Non-slip loop',
                                '• Won\'t jam under load',
                                '• Easy to untie after loading',
                                '• Strength: ~60% of rope strength',
                                '',
                                '## Tying (Rabbit Story)',
                                '1. Form a small loop (the "hole")',
                                '2. "Rabbit comes out of the hole"',
                                '3. "Goes around the tree" (standing end)',
                                '4. "Goes back down the hole"',
                                '5. Tighten by pulling standing end',
                                '',
                                '## Step by Step',
                                '1. Make overhand loop in standing part',
                                '2. Thread working end up through loop',
                                '3. Pass working end behind standing part',
                                '4. Thread working end back down through loop',
                                '5. Dress and set the knot',
                                '',
                                '## Variations',
                                '**Running bowline**: Slides, useful for snares',
                                '**Double bowline**: More secure, rescue',
                                '**Bowline on a bight**: Midline loop'
                            ],
                            tips: [
                                'The most important knot to master',
                                'Practice until you can tie one-handed',
                                'Finish with a half hitch for critical loads'
                            ],
                            diagram: 'bowline'
                        },
                        {
                            id: 'knot-clove-hitch',
                            title: 'Clove Hitch',
                            keywords: ['clove hitch', 'hitch', 'post', 'adjustable'],
                            summary: 'Quick hitch for securing rope to a post or pole.',
                            content: [
                                '## Uses',
                                '• Starting lashings',
                                '• Temporary tie to post/pole',
                                '• Quick adjustable anchor',
                                '• Clothesline attachment',
                                '',
                                '## Properties',
                                '• Quick to tie and untie',
                                '• Adjustable under light load',
                                '• Can slip with changing loads',
                                '• Best perpendicular to pole',
                                '',
                                '## Tying',
                                '1. Wrap rope around pole',
                                '2. Cross over the first wrap',
                                '3. Wrap around pole again',
                                '4. Tuck working end under last wrap',
                                '5. Pull both ends to tighten',
                                '',
                                '## Alternate (Pre-formed)',
                                '1. Form two loops',
                                '2. Place second loop behind first',
                                '3. Slip both over post',
                                '4. Tighten',
                                '',
                                '## Cautions',
                                '• Not secure alone for critical loads',
                                '• Add half hitches for security',
                                '• Can roll on smooth poles',
                                '• Inspect frequently under load'
                            ],
                            tips: [
                                'Great for starting square lashings',
                                'Finish with two half hitches for security',
                                'Learn to tie both ways (around and pre-formed)'
                            ],
                            diagram: 'clove-hitch'
                        },
                        {
                            id: 'knot-taut-line',
                            title: 'Taut Line Hitch',
                            keywords: ['taut line', 'adjustable', 'tent', 'guy line'],
                            summary: 'Adjustable loop for tensioning tent guy lines and tarps.',
                            content: [
                                '## Uses',
                                '• Tent guy lines',
                                '• Tarp ridgelines',
                                '• Any adjustable tension line',
                                '• Clothesline tensioner',
                                '',
                                '## Properties',
                                '• Slides when loose, grips when loaded',
                                '• Easy to adjust',
                                '• Works best on similar diameter objects',
                                '',
                                '## Tying',
                                '1. Pass rope around anchor point',
                                '2. Wrap working end twice inside the loop',
                                '3. Pass working end over standing part',
                                '4. Wrap once more outside the wraps',
                                '5. Tuck under itself',
                                '6. Slide to adjust, pull standing part to lock',
                                '',
                                '## Pattern',
                                '2 wraps inside, 1 wrap outside',
                                '',
                                '## Alternatives',
                                '**Midshipman\'s hitch**: More reliable on slick rope',
                                '**Farrimond friction hitch**: Quick release version',
                                '**Prusik**: For climbing applications'
                            ],
                            tips: [
                                'Works best when loaded at consistent angle',
                                'May slip on wet or slick modern ropes',
                                'The go-to knot for camping'
                            ],
                            diagram: 'taut-line'
                        },
                        {
                            id: 'knot-sheet-bend',
                            title: 'Sheet Bend',
                            keywords: ['sheet bend', 'join', 'two ropes', 'different'],
                            summary: 'Best knot for joining two ropes, especially of different sizes.',
                            content: [
                                '## Uses',
                                '• Joining two ropes',
                                '• Joining ropes of different diameters',
                                '• Extending rope length',
                                '• Nets (weaver\'s knot)',
                                '',
                                '## Properties',
                                '• Works with different size ropes',
                                '• Easy to untie after loading',
                                '• Can spill if not loaded consistently',
                                '• About 55% rope strength',
                                '',
                                '## Tying',
                                '1. Form bight in larger/stiffer rope',
                                '2. Pass smaller rope up through bight',
                                '3. Pass around back of bight',
                                '4. Tuck under itself (same side it entered)',
                                '5. Tighten by pulling all ends',
                                '',
                                '## Key Points',
                                '• Working end and standing part on SAME SIDE',
                                '• Larger rope forms the bight',
                                '• Tails should be long (~6 inches)',
                                '',
                                '## Double Sheet Bend',
                                '• Extra wrap for slippery ropes',
                                '• Better for very different diameters',
                                '• More secure overall'
                            ],
                            tips: [
                                'Working ends on same side prevents failure',
                                'Use double version for critical applications',
                                'Won\'t work well if jerked repeatedly'
                            ],
                            diagram: 'sheet-bend'
                        },
                        {
                            id: 'knot-truckers',
                            title: 'Trucker\'s Hitch',
                            keywords: ['truckers', 'mechanical advantage', 'tension', 'tighten'],
                            summary: 'Creates mechanical advantage to tension a line tight.',
                            content: [
                                '## Uses',
                                '• Tensioning ridgelines',
                                '• Securing loads on vehicles',
                                '• Tarp tie-downs',
                                '• Any application needing mechanical advantage',
                                '',
                                '## Properties',
                                '• 2:1 to 3:1 mechanical advantage',
                                '• Extremely tight lines',
                                '• Quick release possible',
                                '',
                                '## Tying',
                                '1. Secure one end to anchor',
                                '2. Make a slip loop/directional figure 8 midline',
                                '3. Pass working end around second anchor',
                                '4. Thread working end through loop',
                                '5. Pull down to tension (like a pulley)',
                                '6. Secure with two half hitches',
                                '',
                                '## Loop Options',
                                '**Slip loop**: Quick but can jam',
                                '**Directional fig-8**: Most secure, won\'t jam',
                                '**Alpine butterfly**: Won\'t jam, easy release',
                                '',
                                '## Quick Release',
                                'Use a bight for final half hitches',
                                'Pull to release',
                                '',
                                '## Tips',
                                '• Loop should be close to second anchor',
                                '• Multiple passes increase MA further',
                                '• Can use with rope or webbing'
                            ],
                            tips: [
                                'Practice makes perfect - awkward at first',
                                'Loop placement matters for max leverage',
                                'The most useful utility knot'
                            ],
                            diagram: 'truckers-hitch'
                        },
                        {
                            id: 'knot-prusik',
                            title: 'Prusik Knot',
                            keywords: ['prusik', 'friction', 'climb', 'ascending'],
                            summary: 'Friction hitch that grips when loaded, slides when not.',
                            content: [
                                '## Uses',
                                '• Ascending a rope',
                                '• Backup for rappelling',
                                '• Adjustable tie-off',
                                '• Tensioning systems',
                                '',
                                '## Properties',
                                '• Grips in both directions',
                                '• Slides when unloaded',
                                '• Requires cord thinner than main rope',
                                '• Needs prusik loop (cord with ends joined)',
                                '',
                                '## Tying',
                                '1. Form prusik loop (cord ends joined)',
                                '2. Pass loop around main rope',
                                '3. Thread loop through itself',
                                '4. Wrap 2-3 more times in same direction',
                                '5. Thread through again',
                                '6. Dress wraps neatly, evenly',
                                '',
                                '## Number of Wraps',
                                '• Slippery rope: More wraps',
                                '• Fuzzy/rough rope: Fewer wraps',
                                '• Usually 3 wraps works',
                                '',
                                '## Sliding',
                                '• Push knot, don\'t pull',
                                '• Keep wraps neat',
                                '• If it won\'t slide, loosen wraps slightly',
                                '',
                                '## Alternatives',
                                '**Klemheist**: One direction, easier with webbing',
                                '**Bachmann**: Carabiner version, easier to manage'
                            ],
                            tips: [
                                'Prusik loop should be ~1/2 diameter of main rope',
                                'Can use to ascend rope in emergency',
                                'Test before trusting with body weight'
                            ],
                            diagram: 'prusik'
                        }
                    ]
                },
                hitches: {
                    name: 'Hitches',
                    icon: '🔗',
                    items: [
                        {
                            id: 'knot-two-half-hitches',
                            title: 'Two Half Hitches',
                            keywords: ['half hitch', 'secure', 'tie off', 'simple'],
                            summary: 'Simple, reliable way to secure a rope to a post or ring.',
                            content: [
                                '## Uses',
                                '• Tying boat to dock',
                                '• Securing rope to post/ring',
                                '• Finishing other knots',
                                '• General tie-off',
                                '',
                                '## Tying',
                                '1. Pass rope around object',
                                '2. Make half hitch around standing part',
                                '3. Make second half hitch in same direction',
                                '4. Snug against object',
                                '',
                                '## Notes',
                                '• Both hitches same direction',
                                '• Forms a clove hitch on standing part',
                                '• Easy to untie even after loading',
                                '',
                                '## Round Turn + Two Half Hitches',
                                '• Extra wrap (round turn) first',
                                '• More secure, easier to tie under load',
                                '• Better for heavy loads'
                            ],
                            tips: [
                                'Always check hitches are in same direction',
                                'Add round turn for more security'
                            ]
                        },
                        {
                            id: 'knot-timber-hitch',
                            title: 'Timber Hitch',
                            keywords: ['timber', 'drag', 'log', 'bundle'],
                            summary: 'For dragging logs or bundling sticks. Grips tighter under load.',
                            content: [
                                '## Uses',
                                '• Dragging logs/timber',
                                '• Bundling sticks/poles',
                                '• Starting diagonal lashing',
                                '• Hoisting logs',
                                '',
                                '## Tying',
                                '1. Pass rope around log',
                                '2. Wrap working end around standing part',
                                '3. Twist working end around itself 3+ times',
                                '4. Tighten by pulling standing part',
                                '',
                                '## Properties',
                                '• Tightens under load',
                                '• Easy to untie when unloaded',
                                '• More twists = more grip',
                                '• Won\'t work on smooth cylinders',
                                '',
                                '## For Dragging',
                                '• Add half hitch near log end',
                                '• Keeps log aligned while dragging'
                            ],
                            tips: [
                                'Minimum 3 twists',
                                'Great for starting diagonal lashings',
                                'Log texture helps it grip'
                            ]
                        }
                    ]
                },
                lashings: {
                    name: 'Lashings',
                    icon: '🔨',
                    items: [
                        {
                            id: 'lash-square',
                            title: 'Square Lashing',
                            keywords: ['square', 'lashing', 'poles', 'perpendicular', '90'],
                            summary: 'Joins two poles at right angles (90°).',
                            content: [
                                '## Uses',
                                '• Building frames',
                                '• Shelters, tables, towers',
                                '• Any 90° pole junction',
                                '',
                                '## Materials',
                                '• Two poles',
                                '• Rope/cordage (6-8 feet typically)',
                                '',
                                '## Tying',
                                '1. Start with clove hitch on vertical pole',
                                '2. Wrap in square pattern:',
                                '   - Over horizontal, behind vertical',
                                '   - Under horizontal, in front of vertical',
                                '3. Repeat 3-4 times (wrapping turns)',
                                '4. Frapping turns: Wrap between poles',
                                '5. Pull frapping very tight',
                                '6. End with clove hitch',
                                '',
                                '## Pattern',
                                'Wrapping: Goes around both poles',
                                'Frapping: Goes between poles, tightens wrapping',
                                '',
                                '## Tips',
                                '• Keep wraps parallel, no overlaps',
                                '• Frapping pulls it all tight',
                                '• Pull each wrap snug before next'
                            ],
                            tips: [
                                'Start clove hitch below crossing point',
                                'Minimum 3 wraps and 3 fraps',
                                'Tighter frapping = stronger joint'
                            ],
                            diagram: 'square-lash'
                        },
                        {
                            id: 'lash-diagonal',
                            title: 'Diagonal Lashing',
                            keywords: ['diagonal', 'lashing', 'brace', 'spring'],
                            summary: 'Joins poles that cross at angles other than 90°, or have spring.',
                            content: [
                                '## Uses',
                                '• Bracing in structures',
                                '• Poles that spring apart',
                                '• Non-perpendicular joints',
                                '',
                                '## When to Use',
                                '• Square lashing: Poles touching at cross',
                                '• Diagonal lashing: Poles have gap/spring',
                                '',
                                '## Tying',
                                '1. Start with timber hitch around both poles',
                                '2. Pull poles together tight',
                                '3. Wrap diagonally over joint 3-4 times',
                                '4. Wrap opposite diagonal 3-4 times',
                                '5. Frapping turns between poles',
                                '6. End with clove hitch',
                                '',
                                '## Pattern',
                                'Forms X pattern over the joint',
                                'Timber hitch start pulls poles together'
                            ],
                            tips: [
                                'Timber hitch is key - pulls gap closed',
                                'Each diagonal needs equal wraps',
                                'Good for A-frame shelters'
                            ]
                        },
                        {
                            id: 'lash-tripod',
                            title: 'Tripod Lashing',
                            keywords: ['tripod', 'lashing', 'pot', 'frame'],
                            summary: 'Binds three poles to form a stable tripod.',
                            content: [
                                '## Uses',
                                '• Cooking pot hanger',
                                '• Shelter framework',
                                '• Camp furniture',
                                '• Water filter frame',
                                '',
                                '## Tying',
                                '1. Lay three poles side by side',
                                '2. Clove hitch on outside pole',
                                '3. Weave rope over-under through poles',
                                '4. Repeat 6-8 times (like weaving)',
                                '5. Wrap frapping turns between each pole',
                                '6. End with clove hitch',
                                '7. Spread legs, middle pole opposite direction',
                                '',
                                '## Key Points',
                                '• Leave some slack for spreading',
                                '• Middle pole goes opposite way',
                                '• Frapping tightens it all up',
                                '',
                                '## Spread Pattern',
                                'Two legs one way, one leg opposite',
                                'Forms stable A-frame shape'
                            ],
                            tips: [
                                'Don\'t wrap too tight before spreading',
                                'Experiment with leg spread for stability',
                                'Essential camp skill'
                            ],
                            diagram: 'tripod-lash'
                        }
                    ]
                }
            }
        },

        // =====================================================
        // FORAGING / PLANTS
        // =====================================================
        plants: {
            name: 'Edible Plants',
            icon: '🌿',
            color: '#16a34a',
            subcategories: {
                common: {
                    name: 'Common Edibles',
                    icon: '🥬',
                    items: [
                        {
                            id: 'plant-dandelion',
                            title: 'Dandelion',
                            keywords: ['dandelion', 'taraxacum', 'greens', 'common'],
                            summary: 'One of the most recognizable and useful wild edibles.',
                            content: [
                                '## Identification',
                                '• **Leaves**: Jagged, "lion\'s teeth" edges, basal rosette',
                                '• **Flower**: Single yellow flower head on hollow stem',
                                '• **Stem**: Hollow, exudes milky white sap',
                                '• **Root**: Long, deep taproot, tan/brown',
                                '• **Seeds**: White puffball',
                                '',
                                '## Edible Parts',
                                '**Leaves**: Best young, before flowering. Bitter when older.',
                                '**Flowers**: Remove green base, eat petals raw or fried.',
                                '**Roots**: Roast for coffee substitute, eat cooked.',
                                '**Stems**: Edible but very bitter.',
                                '',
                                '## Preparation',
                                '• Young leaves: Raw in salads',
                                '• Older leaves: Boil, change water to reduce bitterness',
                                '• Flowers: Batter and fry, or make wine',
                                '• Roots: Roast until dark brown, grind for "coffee"',
                                '',
                                '## Nutrition',
                                'High in vitamins A, C, K, calcium, iron',
                                'More nutritious than most garden vegetables',
                                '',
                                '## Season',
                                'Year-round, best in spring before flowering',
                                '',
                                '## Look-alikes',
                                '⚠️ Cat\'s ear, hawkweed (also edible)',
                                'True dandelion: Single flower per stem, hollow stem, milky sap'
                            ],
                            habitat: 'Lawns, fields, disturbed areas. Everywhere.',
                            season: 'Spring-Fall (leaves), Spring (flowers)',
                            confidence: 'Very Easy'
                        },
                        {
                            id: 'plant-cattail',
                            title: 'Cattail',
                            keywords: ['cattail', 'typha', 'survival', 'supermarket'],
                            summary: 'The "supermarket of the swamp" - multiple edible parts year-round.',
                            content: [
                                '## Identification',
                                '• **Leaves**: Long, flat, sword-like, from base',
                                '• **Stalk**: Tall (6-10 ft), round',
                                '• **Flower**: Brown "corn dog" shape (female), yellow spike above (male)',
                                '• **Habitat**: Wetlands, pond edges, marshes',
                                '',
                                '## Edible Parts (By Season)',
                                '',
                                '**Spring**: Young shoots ("Cossack asparagus")',
                                '• Peel outer leaves, eat white core',
                                '• Tastes like cucumber/mild asparagus',
                                '',
                                '**Early Summer**: Green flower spike (female)',
                                '• Boil and eat like corn on cob',
                                '• Only when green, before it browns',
                                '',
                                '**Early Summer**: Pollen (male spike)',
                                '• Shake into bag',
                                '• High protein flour substitute (mix 50/50)',
                                '',
                                '**Fall/Winter**: Rhizomes (roots)',
                                '• Peel, eat raw or cooked',
                                '• High in starch, can make flour',
                                '',
                                '## Other Uses',
                                '• **Fluff**: Fire tinder, insulation, wound padding',
                                '• **Leaves**: Weaving, cordage, shelter thatch',
                                '',
                                '## Warnings',
                                '⚠️ Harvest from clean water only',
                                '⚠️ Don\'t confuse with Iris (toxic) - Iris has flat overlapping leaves'
                            ],
                            habitat: 'Wetlands, pond/lake edges, marshes, ditches',
                            season: 'Year-round (different parts)',
                            confidence: 'Easy'
                        },
                        {
                            id: 'plant-clover',
                            title: 'Clover (Red & White)',
                            keywords: ['clover', 'trifolium', 'common', 'lawn'],
                            summary: 'Abundant lawn plant with edible leaves and flowers.',
                            content: [
                                '## Identification',
                                '• **Leaves**: Three round leaflets (occasionally 4)',
                                '• **Red clover**: Larger, V-mark on leaves, pink/red flowers',
                                '• **White clover**: Smaller, white flowers, creeping habit',
                                '• **Flowers**: Ball-shaped cluster of tiny flowers',
                                '',
                                '## Edible Parts',
                                '**Flowers**: Raw or dried for tea',
                                '**Leaves**: Raw when young, cooked when older',
                                '**Seeds**: Can be sprouted',
                                '',
                                '## Preparation',
                                '• Flowers: Best raw, sweet nectar taste',
                                '• Leaves: Young raw, older should be cooked',
                                '• Tea: Dry flowers, steep in hot water',
                                '',
                                '## Nutrition',
                                'Protein-rich, contains isoflavones',
                                'Red clover tea traditionally used medicinally',
                                '',
                                '## Notes',
                                '• Difficult to digest raw in quantity',
                                '• Best as addition to other foods',
                                '• Dry and add to flour',
                                '',
                                '## Look-alikes',
                                '**Wood sorrel**: Heart-shaped leaflets, sour taste (also edible)',
                                '**Black medick**: Yellow flowers, similar leaves (edible)'
                            ],
                            habitat: 'Lawns, fields, roadsides',
                            season: 'Spring-Fall',
                            confidence: 'Easy'
                        },
                        {
                            id: 'plant-plantain',
                            title: 'Plantain (Broadleaf & Narrow)',
                            keywords: ['plantain', 'plantago', 'wound', 'bandaid'],
                            summary: 'Common "weed" with edible leaves and medicinal properties.',
                            content: [
                                '## Identification',
                                '**Broadleaf plantain (P. major)**:',
                                '• Oval/egg-shaped leaves',
                                '• Prominent parallel veins',
                                '• Leaves from basal rosette',
                                '',
                                '**Narrow-leaf plantain (P. lanceolata)**:',
                                '• Lance-shaped leaves',
                                '• Same vein pattern',
                                '',
                                '**Both**:',
                                '• Fibrous strings when leaf torn',
                                '• Flower spike on leafless stalk',
                                '',
                                '## Edible Parts',
                                '**Leaves**: Young leaves raw, older cooked',
                                '**Seeds**: Edible, related to psyllium',
                                '**Flower stalk**: When young and tender',
                                '',
                                '## Preparation',
                                '• Young leaves: Raw in salads',
                                '• Older leaves: Cook like spinach (removes toughness)',
                                '• Remove fibrous strings from large leaves',
                                '',
                                '## Medicinal',
                                '"Nature\'s Band-Aid"',
                                '• Chew leaf, apply to wounds/stings',
                                '• Traditionally used for insect bites',
                                '• Contains allantoin (promotes healing)',
                                '',
                                '## Notes',
                                'Very mild flavor, good bulk green',
                                'Available almost year-round'
                            ],
                            habitat: 'Lawns, paths, disturbed soil, cracks in pavement',
                            season: 'Spring-Fall',
                            confidence: 'Easy'
                        },
                        {
                            id: 'plant-chickweed',
                            title: 'Chickweed',
                            keywords: ['chickweed', 'stellaria', 'spring', 'mild'],
                            summary: 'Mild-tasting spring green, one of the first available.',
                            content: [
                                '## Identification',
                                '• **Leaves**: Small, opposite, oval, pointed tip',
                                '• **Stem**: Single line of hairs (key ID feature)',
                                '• **Flowers**: Tiny white, 5 deeply split petals (look like 10)',
                                '• **Growth**: Mat-forming, spreading',
                                '',
                                '## Key ID Feature',
                                'Single line of fine hairs running up stem',
                                'Hair line switches sides at each leaf node',
                                '',
                                '## Edible Parts',
                                '**Entire above-ground plant**',
                                '• Leaves, stems, flowers all edible',
                                '• Mild, slightly sweet taste',
                                '',
                                '## Preparation',
                                '• Best raw in salads',
                                '• Adds bulk to sandwiches',
                                '• Can be cooked but loses volume',
                                '• Very mild, good for picky eaters',
                                '',
                                '## Look-alikes',
                                '⚠️ **Scarlet pimpernel**: Toxic, orange/red flowers',
                                '⚠️ **Spurge**: Milky sap (chickweed has clear sap)',
                                '',
                                '## Notes',
                                'One of the mildest wild greens',
                                'Often available in winter in mild climates'
                            ],
                            habitat: 'Gardens, lawns, disturbed areas, shady moist spots',
                            season: 'Early Spring, Fall (cool weather)',
                            confidence: 'Moderate (check ID carefully)'
                        }
                    ]
                },
                nuts: {
                    name: 'Nuts & Seeds',
                    icon: '🌰',
                    items: [
                        {
                            id: 'plant-acorn',
                            title: 'Acorns (Oak)',
                            keywords: ['acorn', 'oak', 'quercus', 'nut', 'leach'],
                            summary: 'Abundant nut requiring processing to remove bitter tannins.',
                            content: [
                                '## Identification',
                                '• From oak trees (Quercus species)',
                                '• Nut in distinctive "cap"',
                                '• **White oak group**: Rounded leaf lobes, sweeter acorns',
                                '• **Red oak group**: Pointed leaf lobes, more tannins',
                                '',
                                '## Processing Required',
                                'Acorns contain tannins - bitter and can cause digestive issues',
                                '',
                                '**Cold Water Leaching**:',
                                '1. Shell acorns, remove bad ones',
                                '2. Grind into coarse meal',
                                '3. Place in running water or change water daily',
                                '4. Taste test - continue until not bitter',
                                '5. May take 1-2 weeks',
                                '',
                                '**Hot Water Leaching** (faster):',
                                '1. Boil ground acorns',
                                '2. Drain, add fresh boiling water',
                                '3. Repeat until water runs clear and taste is mild',
                                '4. ⚠️ Always use boiling water - cold after hot = locks tannins',
                                '',
                                '## Uses',
                                '• Ground into flour for bread, porridge',
                                '• Roasted whole as nut',
                                '• Very nutritious - oils, carbs, some protein',
                                '',
                                '## Notes',
                                'White oak acorns need less leaching',
                                'Gather in fall, store dry',
                                'Discard any with holes (weevils)'
                            ],
                            habitat: 'Oak forests, parks, suburban areas',
                            season: 'Fall',
                            confidence: 'Easy ID, moderate processing'
                        },
                        {
                            id: 'plant-pine-nuts',
                            title: 'Pine Nuts',
                            keywords: ['pine', 'nut', 'pinus', 'cone', 'seed'],
                            summary: 'Edible seeds from pine cones - some species larger than others.',
                            content: [
                                '## Best Species',
                                '**Pinyon pine** (SW USA): Large, easy nuts',
                                '**Stone pine** (Mediterranean): Commercial pine nuts',
                                '**Korean pine**: Large nuts',
                                'All pines have edible seeds, but most are tiny',
                                '',
                                '## Harvesting',
                                '1. Collect closed or slightly open cones in fall',
                                '2. Dry cones until scales open fully',
                                '3. Shake or tap out seeds',
                                '4. Shell seeds (thin shell on most)',
                                '',
                                '## Other Edible Pine Parts',
                                '**Inner bark (cambium)**: Scrape, dry, grind to flour',
                                '**Needles**: Tea (vitamin C) - avoid Ponderosa, Norfolk, Yew',
                                '**Pollen**: Spring, add to flour',
                                '',
                                '## Nutrition',
                                'High fat, protein, calories',
                                'Excellent survival food',
                                '',
                                '## Notes',
                                'Very time-consuming for small nuts',
                                'Prioritize pinyon if available'
                            ],
                            habitat: 'Conifer forests',
                            season: 'Fall',
                            confidence: 'Easy'
                        }
                    ]
                },
                berries: {
                    name: 'Berries',
                    icon: '🫐',
                    items: [
                        {
                            id: 'plant-blackberry',
                            title: 'Blackberry / Raspberry',
                            keywords: ['blackberry', 'raspberry', 'rubus', 'bramble'],
                            summary: 'Familiar berries with additional edible and useful parts.',
                            content: [
                                '## Identification',
                                '• **Canes**: Thorny, arching stems',
                                '• **Leaves**: Compound, usually 3-5 leaflets, serrated',
                                '• **Flowers**: White or pink, 5 petals',
                                '• **Fruit**: Aggregate drupes',
                                '',
                                '**Blackberry**: Fruit stays on core when picked',
                                '**Raspberry**: Fruit is hollow (core stays on plant)',
                                '',
                                '## Edible Parts',
                                '**Berries**: Raw, cooked, dried',
                                '**Young shoots**: Peel, eat raw (spring)',
                                '**Leaves**: Tea (dry first, fresh can cause nausea)',
                                '',
                                '## Season',
                                'Berries: Mid-summer to fall',
                                'Shoots: Spring',
                                '',
                                '## No Dangerous Look-alikes',
                                'No deadly berries look similar',
                                'All Rubus species are edible',
                                '',
                                '## Notes',
                                'Leaf tea traditionally used for diarrhea',
                                'High in vitamin C',
                                'Thorns can be used as fish hooks, needles'
                            ],
                            habitat: 'Forest edges, clearings, disturbed areas',
                            season: 'Summer (fruit), Spring (shoots)',
                            confidence: 'Very Easy'
                        },
                        {
                            id: 'berry-warning',
                            title: '⚠️ Berry Safety Rules',
                            keywords: ['safety', 'warning', 'poison', 'toxic'],
                            summary: 'Critical rules for safely identifying wild berries.',
                            content: [
                                '## The Rules',
                                '',
                                '### ❌ AVOID (High Risk)',
                                '• **White berries**: 90% toxic (exceptions exist but not worth risk)',
                                '• **Yellow berries**: Many toxic',
                                '• **Red berries**: ~50% toxic - know specifically what it is',
                                '',
                                '### ✓ GENERALLY SAFER',
                                '• **Blue/Black berries**: ~90% safe',
                                '• **Aggregate berries** (raspberry type): All safe',
                                '',
                                '## Absolute Rules',
                                '1. **Never eat a berry you cannot positively identify**',
                                '2. **Never rely on one characteristic**',
                                '3. **Never assume because birds eat it, you can**',
                                '4. **Never taste to identify**',
                                '',
                                '## Deadly Look-alikes',
                                '• **Pokeweed berries**: Dark purple, look tempting, toxic',
                                '• **Deadly nightshade**: Black berries, extremely toxic',
                                '• **Yew berries**: Red, seed is deadly',
                                '• **Holly**: Red, moderately toxic',
                                '• **Bittersweet**: Orange/red, toxic',
                                '',
                                '## When In Doubt',
                                'DON\'T EAT IT',
                                'The calories aren\'t worth the risk',
                                'Focus on plants you know 100%'
                            ],
                            confidence: 'CRITICAL SAFETY INFO'
                        }
                    ]
                },
                universal: {
                    name: 'Universal Edibility Test',
                    icon: '⚠️',
                    items: [
                        {
                            id: 'edibility-test',
                            title: 'Universal Edibility Test',
                            keywords: ['test', 'unknown', 'edibility', 'safety'],
                            summary: 'Last-resort systematic test for unknown plants. Takes 24+ hours.',
                            content: [
                                '## ⚠️ IMPORTANT WARNINGS',
                                '• This is a LAST RESORT when starving',
                                '• Takes 24+ hours to complete',
                                '• Many toxic plants will pass early stages',
                                '• NOT reliable for mushrooms - NEVER test fungi this way',
                                '• Does not detect all toxins',
                                '',
                                '## Before Starting',
                                '• Only test ONE plant part at a time',
                                '• Ensure enough of plant available if edible',
                                '• Have water available',
                                '• Do not eat anything else during test',
                                '',
                                '## The Test',
                                '',
                                '**1. Smell Test**',
                                '• Crush plant part',
                                '• If strong/unpleasant odor, reject',
                                '',
                                '**2. Skin Contact (8 hours)**',
                                '• Rub on inner wrist',
                                '• Wait 8 hours for reaction',
                                '• If rash/irritation, reject',
                                '',
                                '**3. Lip Test (3 min)**',
                                '• Touch to corner of lip',
                                '• Wait 3 minutes',
                                '• If burning/tingling, reject',
                                '',
                                '**4. Tongue Test (15 min)**',
                                '• Place on tongue, do not chew',
                                '• Wait 15 minutes',
                                '• If burning/tingling, reject',
                                '',
                                '**5. Chew Test (15 min)**',
                                '• Chew but do not swallow',
                                '• Wait 15 minutes',
                                '• If bad reaction, spit out and reject',
                                '',
                                '**6. Swallow Test (8 hours)**',
                                '• Swallow small amount',
                                '• Wait 8 hours, eat nothing else',
                                '• If sick, induce vomiting, reject',
                                '',
                                '**7. Larger Portion**',
                                '• If no reaction, eat 1/4 cup',
                                '• Wait another 8 hours',
                                '• If no reaction, plant part is likely edible',
                                '',
                                '## Reject Immediately If',
                                '• Milky or colored sap',
                                '• Beans/seeds in pods',
                                '• Bitter or soapy taste',
                                '• Almond scent in leaves/wood',
                                '• Grain heads with pink/black spurs',
                                '• Three-leaved growth pattern',
                                '',
                                '## Reality Check',
                                'This test is rarely practical.',
                                'Better to learn known edibles beforehand.'
                            ],
                            confidence: 'Last Resort Only'
                        }
                    ]
                }
            }
        }
    };

    // =====================================================
    // MODULE FUNCTIONS
    // =====================================================

    function init() {
        loadBookmarks();
        console.log('FieldGuidesModule initialized');
        return true;
    }

    function getCategories() {
        return Object.entries(FIELD_GUIDES).map(([key, cat]) => ({
            id: key,
            name: cat.name,
            icon: cat.icon,
            color: cat.color,
            subcategoryCount: Object.keys(cat.subcategories || {}).length
        }));
    }

    function getCategory(categoryId) {
        return FIELD_GUIDES[categoryId] || null;
    }

    function getSubcategories(categoryId) {
        const cat = FIELD_GUIDES[categoryId];
        if (!cat || !cat.subcategories) return [];
        
        return Object.entries(cat.subcategories).map(([key, sub]) => ({
            id: key,
            name: sub.name,
            icon: sub.icon,
            itemCount: sub.items?.length || 0
        }));
    }

    function getItems(categoryId, subcategoryId) {
        const cat = FIELD_GUIDES[categoryId];
        if (!cat || !cat.subcategories) return [];
        
        const sub = cat.subcategories[subcategoryId];
        if (!sub || !sub.items) return [];
        
        return sub.items;
    }

    function getItem(itemId) {
        for (const cat of Object.values(FIELD_GUIDES)) {
            if (!cat.subcategories) continue;
            for (const sub of Object.values(cat.subcategories)) {
                if (!sub.items) continue;
                const item = sub.items.find(i => i.id === itemId);
                if (item) return item;
            }
        }
        return null;
    }

    function search(query) {
        if (!query || query.length < 2) return [];
        
        const q = query.toLowerCase();
        const results = [];
        
        for (const [catKey, cat] of Object.entries(FIELD_GUIDES)) {
            if (!cat.subcategories) continue;
            
            for (const [subKey, sub] of Object.entries(cat.subcategories)) {
                if (!sub.items) continue;
                
                for (const item of sub.items) {
                    const matchTitle = item.title.toLowerCase().includes(q);
                    const matchKeywords = item.keywords?.some(k => k.toLowerCase().includes(q));
                    const matchSummary = item.summary?.toLowerCase().includes(q);
                    
                    if (matchTitle || matchKeywords || matchSummary) {
                        results.push({
                            ...item,
                            _category: catKey,
                            _categoryName: cat.name,
                            _subcategory: subKey,
                            _subcategoryName: sub.name,
                            _matchType: matchTitle ? 'title' : matchKeywords ? 'keyword' : 'summary'
                        });
                    }
                }
            }
        }
        
        // Sort by relevance (title matches first)
        results.sort((a, b) => {
            if (a._matchType === 'title' && b._matchType !== 'title') return -1;
            if (b._matchType === 'title' && a._matchType !== 'title') return 1;
            return 0;
        });
        
        return results;
    }

    function toggleBookmark(itemId) {
        const idx = bookmarks.indexOf(itemId);
        if (idx === -1) {
            bookmarks.push(itemId);
        } else {
            bookmarks.splice(idx, 1);
        }
        saveBookmarks();
        return bookmarks.includes(itemId);
    }

    function isBookmarked(itemId) {
        return bookmarks.includes(itemId);
    }

    function getBookmarkedItems() {
        return bookmarks.map(id => getItem(id)).filter(Boolean);
    }

    // State management
    function getState() {
        return {
            activeCategory,
            activeSubcategory,
            expandedItem,
            searchQuery
        };
    }

    function setActiveCategory(cat) {
        activeCategory = cat;
        activeSubcategory = null;
        expandedItem = null;
    }

    function setActiveSubcategory(sub) {
        activeSubcategory = sub;
        expandedItem = null;
    }

    function setExpandedItem(item) {
        expandedItem = item;
    }

    function setSearchQuery(q) {
        searchQuery = q;
    }

    // =====================================================
    // PUBLIC API
    // =====================================================

    return {
        init,
        getCategories,
        getCategory,
        getSubcategories,
        getItems,
        getItem,
        search,
        toggleBookmark,
        isBookmarked,
        getBookmarkedItems,
        getState,
        setActiveCategory,
        setActiveSubcategory,
        setExpandedItem,
        setSearchQuery,
        FIELD_GUIDES
    };
})();

if (typeof window !== 'undefined') {
    window.FieldGuidesModule = FieldGuidesModule;
}
