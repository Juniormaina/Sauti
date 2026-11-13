import { count } from 'drizzle-orm';
import { db } from '../../src/db/index.ts';
import {
  achievements,
  activities,
  courses,
  lessons,
  modules,
  programmes,
} from '../../src/db/schema.ts';

let seedPromise: Promise<void> | null = null;

export async function ensureSeeded(): Promise<void> {
  if (seedPromise) return seedPromise;
  seedPromise = runSeed().catch((err) => {
    seedPromise = null;
    throw err;
  });
  return seedPromise;
}

async function runSeed() {
  const [{ total }] = await db.select({ total: count() }).from(programmes);
  if (Number(total) > 0) return;

  const achievementSeed = [
    {
      code: 'FIRST_LESSON',
      title: 'First Voice Step',
      description: 'Completed your first SAUTI lesson.',
      badgeType: 'milestone',
      xpReward: 50,
      threshold: 1,
    },
    {
      code: 'VOICE_PIONEER',
      title: 'Voice Studio Explorer',
      description: 'Recorded your first spoken practice session.',
      badgeType: 'voice',
      xpReward: 75,
      threshold: 1,
    },
    {
      code: 'FIVE_LESSONS',
      title: 'Steady Rhythm',
      description: 'Completed five interactive lessons across SAUTI.',
      badgeType: 'milestone',
      xpReward: 150,
      threshold: 5,
    },
    {
      code: 'CONVERSATION_BUILDER',
      title: 'Conversation Builder',
      description: 'Finished a guided AI conversation practice session.',
      badgeType: 'speaking',
      xpReward: 100,
      threshold: 1,
    },
    {
      code: 'STREAK_THREE',
      title: 'Three-Day Momentum',
      description: 'Practised English three days in a row.',
      badgeType: 'streak',
      xpReward: 120,
      threshold: 3,
    },
  ];

  await db.insert(achievements).values(achievementSeed).onConflictDoNothing();

  const programmeDefs = [
    {
      slug: 'little-voices',
      title: 'Little Voices',
      environment: 'little_voices',
      ageRange: '3-5',
      description: 'Picture-led phonics, first words, friendly animal sounds, and gentle listening songs.',
      sortOrder: 1,
      courses: [
        {
          slug: 'lv-first-sounds-greetings',
          title: 'First Sounds, Colours & Warm Greetings',
          description: 'Listen, point, and say hello with bright objects from home and nature.',
          cefrLevel: 'A1',
          topic: 'Everyday English',
          skillFocus: 'Listening',
          estimatedMinutes: 20,
          modules: [
            {
              title: 'Hello & Sunshine Words',
              description: 'Greeting friends and naming favourite morning objects.',
              lessons: [
                {
                  title: 'Saying Hello & Naming Colours',
                  objective: 'Recognise and speak basic greeting words and bright everyday colours.',
                  introduction: 'Tap to listen to Sunbird and repeat each happy greeting aloud.',
                  cefrLevel: 'A1',
                  skillType: 'Speaking',
                  durationMinutes: 8,
                  contentJson: {
                    keyPhrases: [
                      { phrase: 'Good morning!', meaning: 'A warm greeting when you wake up.', example: 'Good morning, Mama!' },
                      { phrase: 'Yellow sun', meaning: 'A bright warm colour in the sky.', example: 'Look at the yellow sun.' },
                      { phrase: 'Red apple', meaning: 'A sweet crunchy fruit.', example: 'I like a red apple.' },
                    ],
                    dialogue: [
                      { speaker: 'Koko', line: 'Good morning! What colour is the sun?' },
                      { speaker: 'Zuri', line: 'The sun is yellow!' },
                    ],
                    culturalNote: 'In many homes from Nairobi to London, children start the day by greeting family elders warmly.',
                    audioScript: 'Good morning! Look at the yellow sun and the red apple.',
                  },
                  activities: [
                    {
                      type: 'picture_recognition',
                      prompt: 'Tap the picture that matches: "Yellow Sun"',
                      instruction: 'Listen and pick the sunny picture.',
                      payloadJson: {
                        options: [
                          { id: 'sun', label: 'Yellow Sun', visual: 'sun', colour: '#F6C96B' },
                          { id: 'apple', label: 'Red Apple', visual: 'apple', colour: '#F28B75' },
                          { id: 'cloud', label: 'Blue Sky', visual: 'cloud', colour: '#A9D9E8' },
                        ],
                        correctId: 'sun',
                      },
                      points: 20,
                    },
                    {
                      type: 'listen_repeat',
                      prompt: 'Say aloud: "Good morning!"',
                      instruction: 'Listen first, then speak clearly into your microphone.',
                      payloadJson: { targetText: 'Good morning' },
                      points: 30,
                    },
                    {
                      type: 'word_matching',
                      prompt: 'Match each picture word to its colour',
                      instruction: 'Pair the object with its matching colour.',
                      payloadJson: {
                        pairs: [
                          { left: 'Sun', right: 'Yellow' },
                          { left: 'Apple', right: 'Red' },
                          { left: 'Leaf', right: 'Green' },
                        ],
                      },
                      points: 25,
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          slug: 'lv-storytime-fluent-kids',
          title: 'Storybook Adventures for Early Speakers',
          description: 'For young children ready to describe animals, weather, and short stories in full sentences.',
          cefrLevel: 'B1',
          topic: 'Conversation skills',
          skillFocus: 'Speaking',
          estimatedMinutes: 25,
          modules: [
            {
              title: 'The Weaver Bird Nest',
              description: 'Describing nature scenes and asking gentle questions.',
              lessons: [
                {
                  title: 'Telling What Happens Next',
                  objective: 'Use simple action verbs and picture clues to narrate a two-sentence story.',
                  introduction: 'Look closely at the garden scene and practise telling the story in your own voice.',
                  cefrLevel: 'B1',
                  skillType: 'Speaking',
                  durationMinutes: 10,
                  contentJson: {
                    keyPhrases: [
                      { phrase: 'The bird is building a nest.', meaning: 'Making a cosy home from grass.', example: 'Look! The weaver bird is building a nest.' },
                      { phrase: 'After the rain', meaning: 'When the clouds clear away.', example: 'After the rain, the rainbow appears.' },
                    ],
                    audioScript: 'The weaver bird carries green grass to the acacia branch after the morning rain.',
                  },
                  activities: [
                    {
                      type: 'listen_select',
                      prompt: 'Listen carefully. What is the weaver bird carrying?',
                      instruction: 'Play the audio and choose the right answer.',
                      payloadJson: {
                        audioText: 'The weaver bird carries green grass to the tall tree.',
                        options: ['Green grass', 'A red hat', 'A wooden spoon'],
                        correctAnswer: 'Green grass',
                      },
                      points: 25,
                    },
                    {
                      type: 'voice_recording',
                      prompt: 'Tell us what your favourite animal does in the morning.',
                      instruction: 'Speak one or two cheerful sentences.',
                      payloadJson: { targetText: 'The bird sings in the tall green tree' },
                      points: 30,
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      slug: 'young-explorers',
      title: 'Young Explorers',
      environment: 'young_explorers',
      ageRange: '6-10',
      description: 'Adventurous stories, phonics spelling quests, sentence builders, and everyday school talk.',
      sortOrder: 2,
      courses: [
        {
          slug: 'ye-market-garden-adventures',
          title: 'Everyday Objects & Story Explorers',
          description: 'Build clear sentences, spell everyday nouns, and answer listening quests.',
          cefrLevel: 'A2',
          topic: 'Vocabulary',
          skillFocus: 'Speaking',
          estimatedMinutes: 30,
          modules: [
            {
              title: 'At the Weekend Market',
              description: 'Polite requests, counting, and describing fresh fruit and crafts.',
              lessons: [
                {
                  title: 'Asking Politely & Building Sentences',
                  objective: 'Form polite questions using "May I have" and spell common market words.',
                  introduction: 'Join Asha and Leo as they shop for mangoes, notebooks, and woven baskets.',
                  cefrLevel: 'A2',
                  skillType: 'Speaking',
                  durationMinutes: 12,
                  contentJson: {
                    keyPhrases: [
                      { phrase: 'May I have two ripe mangoes, please?', meaning: 'A polite way to ask for something.', example: 'May I have two ripe mangoes, please?' },
                      { phrase: 'How much does this cost?', meaning: 'Asking the price.', example: 'Excuse me, how much does this notebook cost?' },
                    ],
                    dialogue: [
                      { speaker: 'Asha', line: 'Good afternoon! May I have three sweet mangoes, please?' },
                      { speaker: 'Vendor', line: 'Of course! Here are three fresh mangoes for you.' },
                    ],
                    culturalNote: 'Warm greetings before asking a question make conversations friendly in Kenya and across the world.',
                    audioScript: 'Good afternoon! May I have three sweet mangoes, please?',
                  },
                  activities: [
                    {
                      type: 'sentence_building',
                      prompt: 'Arrange the words into a polite request',
                      instruction: 'Tap the words in the right order.',
                      payloadJson: {
                        words: ['May', 'I', 'have', 'two', 'mangoes', 'please?'],
                        shuffled: ['mangoes', 'I', 'please?', 'May', 'two', 'have'],
                      },
                      points: 25,
                    },
                    {
                      type: 'spelling',
                      prompt: 'Spell the name of this tropical yellow-orange fruit: M _ N G _',
                      instruction: 'Listen to the word and type the full spelling.',
                      payloadJson: { audioText: 'mango', correctAnswer: 'mango', hint: '5 letters, starts with M' },
                      points: 20,
                    },
                    {
                      type: 'story_comprehension',
                      prompt: 'Read the short story and answer the question',
                      instruction: 'Find the detail from Asha’s weekend visit.',
                      payloadJson: {
                        story: 'On Saturday morning, Asha walked with her uncle to the open-air market in Kisumu. She carried a woven basket and bought three ripe mangoes and a blue notebook for school.',
                        question: 'What did Asha carry to the market?',
                        options: ['A woven basket', 'A yellow umbrella', 'A silver bicycle'],
                        correctAnswer: 'A woven basket',
                      },
                      points: 25,
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          slug: 'ye-junior-storytellers',
          title: 'Confident Junior Storytellers',
          description: 'Advanced narrative vocabulary, clear read-aloud pacing, and expressive dialogue for ages 6–10.',
          cefrLevel: 'B2',
          topic: 'Reading',
          skillFocus: 'Reading',
          estimatedMinutes: 30,
          modules: [
            {
              title: 'Science Fair Narratives',
              description: 'Explaining curiosity and cause-and-effect clearly.',
              lessons: [
                {
                  title: 'Explaining How Things Work',
                  objective: 'Use sequence words ("first", "next", "finally") when reading and speaking.',
                  introduction: 'Learn how to explain a mini solar lantern project to your class.',
                  cefrLevel: 'B2',
                  skillType: 'Reading',
                  durationMinutes: 12,
                  contentJson: {
                    keyPhrases: [
                      { phrase: 'First, sunlight charges the battery.', meaning: 'Explaining step one clearly.', example: 'First, sunlight charges the small battery during the afternoon.' },
                      { phrase: 'As a result', meaning: 'Showing what happens next.', example: 'As a result, the lantern glows brightly at dusk.' },
                    ],
                    audioScript: 'First, sunlight charges the small battery. Finally, the lantern lights up the reading desk.',
                  },
                  activities: [
                    {
                      type: 'read_aloud',
                      prompt: 'Read the science card aloud with steady pauses',
                      instruction: 'Tap Record and read the sentence clearly.',
                      payloadJson: { targetText: 'First, sunlight charges the battery so the lantern glows brightly at dusk.' },
                      points: 30,
                    },
                    {
                      type: 'fill_blanks',
                      prompt: 'Complete the explanation sentence',
                      instruction: 'Type the missing sequence word.',
                      payloadJson: {
                        sentence: '_____, sunlight charges the small battery during the day.',
                        blankAnswer: 'First',
                        hint: 'Starts with F',
                      },
                      points: 20,
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      slug: 'teen-voices',
      title: 'Teen Voices',
      environment: 'teen_voices',
      ageRange: '11-17',
      description: 'Expressing opinions, school debates, storytelling, and real-world teen social fluency.',
      sortOrder: 3,
      courses: [
        {
          slug: 'tv-expressing-opinions',
          title: 'Speak Up: Expressing Opinions & Storytelling',
          description: 'Build natural confidence sharing ideas in class discussions, clubs, and podcasts.',
          cefrLevel: 'B1',
          topic: 'Conversation skills',
          skillFocus: 'Speaking',
          estimatedMinutes: 35,
          modules: [
            {
              title: 'Voice Your Perspective',
              description: 'Agreeing, disagreeing politely, and giving strong examples.',
              lessons: [
                {
                  title: 'Framing an Opinion Clearly',
                  objective: 'Use structured opinion phrases ("From my perspective", "A good example is") in speech and writing.',
                  introduction: 'Learn to hold the floor calmly in debates and group projects without rushing.',
                  cefrLevel: 'B1',
                  skillType: 'Speaking',
                  durationMinutes: 14,
                  contentJson: {
                    keyPhrases: [
                      { phrase: 'From my perspective', meaning: 'A confident, polite way to share your view.', example: 'From my perspective, community libraries boost reading habits.' },
                      { phrase: 'I see your point, however...', meaning: 'Respectful disagreement in a debate.', example: 'I see your point, however, spoken practice builds fluency faster.' },
                    ],
                    dialogue: [
                      { speaker: 'Maya', line: 'From my perspective, school debate clubs help shy students find their voice.' },
                      { speaker: 'Daniel', line: 'I agree, and practising short speeches every week makes a huge difference.' },
                    ],
                    audioScript: 'From my perspective, practising short speeches every week builds real confidence.',
                  },
                  activities: [
                    {
                      type: 'multiple_choice',
                      prompt: 'Which phrase shows respectful disagreement in a school discussion?',
                      instruction: 'Choose the most constructive response.',
                      payloadJson: {
                        options: [
                          'I see your point, however I think we should also consider...',
                          'That makes zero sense at all.',
                          'Stop talking and listen to me.',
                        ],
                        correctAnswer: 'I see your point, however I think we should also consider...',
                      },
                      points: 20,
                    },
                    {
                      type: 'grammar_correction',
                      prompt: 'Fix the subject-verb agreement in this debate sentence',
                      instruction: 'Rewrite the corrected sentence cleanly.',
                      payloadJson: {
                        incorrectSentence: 'Every student in the drama club practise their lines daily.',
                        correctAnswer: 'Every student in the drama club practises their lines daily.',
                        acceptableAnswers: [
                          'Every student in the drama club practises their lines daily.',
                          'Every student in the drama club practices their lines daily.',
                        ],
                      },
                      points: 25,
                    },
                    {
                      type: 'conversation_sim',
                      prompt: 'Respond to your debate partner about smartphones in classrooms',
                      instruction: 'Speak or write a two-sentence response using "From my perspective".',
                      payloadJson: {
                        partnerPrompt: 'Do you think study apps on phones help or distract students during lessons?',
                        targetPhrases: ['From my perspective', 'example'],
                      },
                      points: 35,
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          slug: 'tv-debate-mastery',
          title: 'Debate, Rhetoric & Creative Podcasts',
          description: 'Upper-intermediate and advanced persuasive speaking for teen leaders.',
          cefrLevel: 'C1',
          topic: 'Academic English',
          skillFocus: 'Speaking',
          estimatedMinutes: 40,
          modules: [
            {
              title: 'Structuring Persuasive Arguments',
              description: 'Using rhetorical pauses, counterarguments, and vivid evidence.',
              lessons: [
                {
                  title: 'Claim, Evidence & Counterpoint',
                  objective: 'Deliver a 30-second persuasive argument with clear signposting.',
                  introduction: 'Great speakers guide listeners smoothly from claim to evidence.',
                  cefrLevel: 'C1',
                  skillType: 'Speaking',
                  durationMinutes: 15,
                  contentJson: {
                    keyPhrases: [
                      { phrase: 'While critics argue that...', meaning: 'Introducing a counterargument smoothly.', example: 'While critics argue that uniforms limit expression, they reduce social pressure.' },
                    ],
                    audioScript: 'While critics argue that public speaking causes anxiety, structured practice transforms nervousness into clarity.',
                  },
                  activities: [
                    {
                      type: 'writing',
                      prompt: 'Write a 2–3 sentence rebuttal starting with "While some argue that..."',
                      instruction: 'Topic: Should creative arts receive equal funding to STEM subjects?',
                      payloadJson: { minWords: 12 },
                      points: 35,
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      slug: 'young-adults',
      title: 'Young Adults',
      environment: 'young_adults',
      ageRange: '18-25',
      description: 'University seminars, everyday independence, presentations, and early-career interviews.',
      sortOrder: 4,
      courses: [
        {
          slug: 'ya-everyday-university-english',
          title: 'University Seminars & Everyday Independence',
          description: 'Participate smoothly in tutorials, campus life, and global conversations.',
          cefrLevel: 'B2',
          topic: 'Academic English',
          skillFocus: 'Speaking',
          estimatedMinutes: 35,
          modules: [
            {
              title: 'Seminar Discussions & Introductions',
              description: 'Contributing ideas naturally in group discussions and introductions.',
              lessons: [
                {
                  title: 'Building on Another Speaker’s Idea',
                  objective: 'Link your contribution smoothly to what a peer just said.',
                  introduction: 'In university seminars and internships, strong communicators listen actively before speaking.',
                  cefrLevel: 'B2',
                  skillType: 'Speaking',
                  durationMinutes: 12,
                  contentJson: {
                    keyPhrases: [
                      { phrase: 'Building on what Elena mentioned...', meaning: 'Connecting your point to another speaker.', example: 'Building on what Elena mentioned, renewable microgrids also lower energy costs.' },
                      { phrase: 'Could you clarify what you meant by...?', meaning: 'Asking a thoughtful follow-up question.', example: 'Could you clarify what you meant by community-led design?' },
                    ],
                    dialogue: [
                      { speaker: 'Liam', line: 'I think urban transit needs better last-mile walkways.' },
                      { speaker: 'Wanjiku', line: 'Building on what Liam mentioned, safe pedestrian lighting encourages evening commuters.' },
                    ],
                    culturalNote: 'Collaborative turn-taking works equally well in Nairobi, Toronto, and Singapore.',
                    audioScript: 'Building on what Liam mentioned, safe pedestrian lighting encourages evening commuters.',
                  },
                  activities: [
                    {
                      type: 'fill_blanks',
                      prompt: 'Complete the seminar transition phrase',
                      instruction: 'Type the missing verb.',
                      payloadJson: {
                        sentence: '________ on what my classmate just noted, peer mentoring improves retention.',
                        blankAnswer: 'Building',
                        hint: 'Starts with B',
                      },
                      points: 20,
                    },
                    {
                      type: 'role_play',
                      prompt: 'Role-play: Introduce yourself at an international university orientation mixer.',
                      instruction: 'Mention your field of study and one goal for this year (speak or write).',
                      payloadJson: {
                        scenario: 'University orientation mixer in Nairobi or London',
                        targetPhrases: ['studying', 'hoping to'],
                      },
                      points: 35,
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          slug: 'ya-starter-foundations',
          title: 'Starter Everyday English for Young Adults',
          description: 'Practical A1–A2 speaking and listening for young adults starting from scratch.',
          cefrLevel: 'A1',
          topic: 'Everyday English',
          skillFocus: 'Listening',
          estimatedMinutes: 25,
          modules: [
            {
              title: 'Cafés, Directions & New Friends',
              description: 'Clear foundational phrases for daily errands and introductions.',
              lessons: [
                {
                  title: 'Ordering & Introducing Yourself',
                  objective: 'Introduce yourself and order a drink comfortably at a café.',
                  introduction: 'Simple, respectful everyday phrases you can use right away.',
                  cefrLevel: 'A1',
                  skillType: 'Speaking',
                  durationMinutes: 10,
                  contentJson: {
                    keyPhrases: [
                      { phrase: 'Hi, my name is...', meaning: 'Friendly self-introduction.', example: 'Hi, my name is Brian. Nice to meet you.' },
                      { phrase: 'Could I get a cup of spiced tea, please?', meaning: 'Polite café order.', example: 'Could I get a cup of spiced tea, please?' },
                    ],
                    audioScript: 'Hi, my name is Brian. Could I get a cup of spiced tea, please?',
                  },
                  activities: [
                    {
                      type: 'listen_repeat',
                      prompt: 'Repeat: "Could I get a cup of spiced tea, please?"',
                      instruction: 'Speak clearly at a relaxed pace.',
                      payloadJson: { targetText: 'Could I get a cup of spiced tea please' },
                      points: 25,
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      slug: 'professional-english',
      title: 'Professional English',
      environment: 'professional_english',
      ageRange: '26-45',
      description: 'Executive communication, meetings, stakeholder presentations, interviews, and business writing.',
      sortOrder: 5,
      courses: [
        {
          slug: 'pe-meetings-presentations',
          title: 'High-Impact Meetings & Stakeholder Briefings',
          description: 'Lead meetings crisply, handle tough questions, and present recommendations with authority.',
          cefrLevel: 'C1',
          topic: 'Workplace English',
          skillFocus: 'Speaking',
          estimatedMinutes: 40,
          modules: [
            {
              title: 'Leading Cross-Functional Meetings',
              description: 'Setting agendas, synthesising decisions, and diplomatically challenging assumptions.',
              lessons: [
                {
                  title: 'Framing Recommendations & Next Steps',
                  objective: 'Present a concise executive summary using the Situation-Complication-Resolution structure.',
                  introduction: 'Busy teams value clarity. Practise opening a quarterly review in 30 seconds.',
                  cefrLevel: 'C1',
                  skillType: 'Speaking',
                  durationMinutes: 15,
                  contentJson: {
                    keyPhrases: [
                      { phrase: 'To align on our primary objective...', meaning: 'Focusing a meeting early.', example: 'To align on our primary objective, we want to cut onboarding time by 20%.' },
                      { phrase: 'My recommendation is that we pilot...', meaning: 'Proposing a measured action.', example: 'My recommendation is that we pilot the mobile workflow in two branches.' },
                    ],
                    dialogue: [
                      { speaker: 'Amara', line: 'To align on our primary objective, let us review customer turnaround times first.' },
                      { speaker: 'David', line: 'Agreed. My recommendation is that we automate receipt confirmations this quarter.' },
                    ],
                    audioScript: 'To align on our primary objective, my recommendation is that we pilot the new workflow this quarter.',
                  },
                  activities: [
                    {
                      type: 'writing',
                      prompt: 'Draft a 3-sentence meeting follow-up email summarising one decision and one owner.',
                      instruction: 'Keep your tone crisp, polite, and action-oriented.',
                      payloadJson: { minWords: 18 },
                      points: 30,
                    },
                    {
                      type: 'voice_recording',
                      prompt: 'Deliver a 20-second executive opening recommending a new team initiative.',
                      instruction: 'Speak steadily using "To align on..." or "My recommendation is...".',
                      payloadJson: { targetText: 'To align on our objective, my recommendation is that we pilot the workflow.' },
                      points: 35,
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          slug: 'pe-workplace-foundations',
          title: 'Workplace Essentials (A2–B1)',
          description: 'For working adults strengthening everyday office calls, scheduling, and polite updates.',
          cefrLevel: 'A2',
          topic: 'Workplace English',
          skillFocus: 'Speaking',
          estimatedMinutes: 30,
          modules: [
            {
              title: 'Scheduling & Status Updates',
              description: 'Clear phone and video call etiquette.',
              lessons: [
                {
                  title: 'Rescheduling & Confirming Times',
                  objective: 'Propose alternative meeting times politely without hesitation.',
                  introduction: 'Learn clear phrases for calendar changes across time zones.',
                  cefrLevel: 'A2',
                  skillType: 'Speaking',
                  durationMinutes: 10,
                  contentJson: {
                    keyPhrases: [
                      { phrase: 'Would Thursday at 10 a.m. work for you?', meaning: 'Polite schedule proposal.', example: 'Would Thursday at 10 a.m. East Africa Time work for you?' },
                    ],
                    audioScript: 'Would Thursday at ten in the morning work for your schedule?',
                  },
                  activities: [
                    {
                      type: 'multiple_choice',
                      prompt: 'Which sentence is best for rescheduling a client call?',
                      instruction: 'Pick the clearest professional phrasing.',
                      payloadJson: {
                        options: [
                          'Could we move our call to Thursday at 10 a.m. if that suits you?',
                          'I cannot talk today, maybe whenever.',
                          'Call me later.',
                        ],
                        correctAnswer: 'Could we move our call to Thursday at 10 a.m. if that suits you?',
                      },
                      points: 20,
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      slug: 'lifelong-english',
      title: 'Lifelong English',
      environment: 'lifelong_english',
      ageRange: '46+',
      description: 'Calm, welcoming real-world communication for travel, family conversations, health, and community.',
      sortOrder: 6,
      courses: [
        {
          slug: 'le-travel-everyday-confidence',
          title: 'Travel, Hospitality & Everyday Confidence',
          description: 'Practical, relaxed listening and speaking at your own comfortable pace.',
          cefrLevel: 'A2',
          topic: 'Everyday English',
          skillFocus: 'Speaking',
          estimatedMinutes: 30,
          modules: [
            {
              title: 'Airports, Hotels & Community Stories',
              description: 'Asking for help calmly and sharing stories with international friends.',
              lessons: [
                {
                  title: 'Checking In & Asking for Directions',
                  objective: 'Ask clearly for gate details, quiet rooms, and local directions.',
                  introduction: 'There is never any rush. Listen slowly, repeat comfortably, and build lasting confidence.',
                  cefrLevel: 'A2',
                  skillType: 'Speaking',
                  durationMinutes: 12,
                  contentJson: {
                    keyPhrases: [
                      { phrase: 'Excuse me, could you speak a little more slowly?', meaning: 'A calm, respectful way to ask someone to slow down.', example: 'Excuse me, could you speak a little more slowly, please?' },
                      { phrase: 'Which way is the train platform?', meaning: 'Asking clearly for directions.', example: 'Excuse me, which way is the train platform?' },
                    ],
                    dialogue: [
                      { speaker: 'Grace', line: 'Good morning. Could you tell me where Gate 4 is, please?' },
                      { speaker: 'Staff', line: 'Certainly. Walk straight ahead and turn left near the bookshop.' },
                    ],
                    culturalNote: 'Asking someone to repeat or speak slowly is a sign of confident, clear communication everywhere.',
                    audioScript: 'Excuse me, could you speak a little more slowly, please? Which way is Gate four?',
                  },
                  activities: [
                    {
                      type: 'listen_select',
                      prompt: 'Listen to the staff member’s directions. Where should Grace turn?',
                      instruction: 'Play the audio and select the matching direction.',
                      payloadJson: {
                        audioText: 'Walk straight ahead and turn left near the bookshop.',
                        options: ['Turn left near the bookshop', 'Turn right at the café', 'Go back downstairs'],
                        correctAnswer: 'Turn left near the bookshop',
                      },
                      points: 25,
                    },
                    {
                      type: 'listen_repeat',
                      prompt: 'Practise saying: "Excuse me, could you speak a little more slowly?"',
                      instruction: 'Take your time and speak warmly.',
                      payloadJson: { targetText: 'Excuse me could you speak a little more slowly' },
                      points: 30,
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          slug: 'le-cultural-discussions',
          title: 'Literature, Current Affairs & Memoir Sharing',
          description: 'Advanced conversational nuance (B2–C2) for lifelong learners who love thoughtful dialogue.',
          cefrLevel: 'C2',
          topic: 'Conversation skills',
          skillFocus: 'Reading',
          estimatedMinutes: 35,
          modules: [
            {
              title: 'Reflecting on Experience',
              description: 'Rich idioms and nuanced storytelling.',
              lessons: [
                {
                  title: 'Sharing Meaningful Memories Clearly',
                  objective: 'Use reflective past tenses and vivid sensory words in conversation.',
                  introduction: 'Explore how short reflective stories connect generations across cultures.',
                  cefrLevel: 'C2',
                  skillType: 'Reading',
                  durationMinutes: 15,
                  contentJson: {
                    keyPhrases: [
                      { phrase: 'Looking back, what stayed with me most was...', meaning: 'Introducing a thoughtful reflection.', example: 'Looking back, what stayed with me most was the aroma of roasted coffee after rain.' },
                    ],
                    audioScript: 'Looking back, what stayed with me most was the warmth of evening conversations on the veranda.',
                  },
                  activities: [
                    {
                      type: 'writing',
                      prompt: 'Write two reflective sentences beginning with "Looking back, what stayed with me most was..."',
                      instruction: 'Share a favourite memory from home, travel, or family.',
                      payloadJson: { minWords: 12 },
                      points: 30,
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ];

  for (const progDef of programmeDefs) {
    const [prog] = await db
      .insert(programmes)
      .values({
        slug: progDef.slug,
        title: progDef.title,
        environment: progDef.environment,
        ageRange: progDef.ageRange,
        description: progDef.description,
        sortOrder: progDef.sortOrder,
      })
      .returning();

    let courseOrder = 1;
    for (const courseDef of progDef.courses) {
      const [course] = await db
        .insert(courses)
        .values({
          programmeId: prog.id,
          slug: courseDef.slug,
          title: courseDef.title,
          description: courseDef.description,
          cefrLevel: courseDef.cefrLevel,
          topic: courseDef.topic,
          skillFocus: courseDef.skillFocus,
          estimatedMinutes: courseDef.estimatedMinutes,
          sortOrder: courseOrder++,
        })
        .returning();

      let modOrder = 1;
      for (const modDef of courseDef.modules) {
        const [mod] = await db
          .insert(modules)
          .values({
            courseId: course.id,
            title: modDef.title,
            description: modDef.description,
            sortOrder: modOrder++,
          })
          .returning();

        let lessonOrder = 1;
        for (const lessonDef of modDef.lessons) {
          const [lesson] = await db
            .insert(lessons)
            .values({
              moduleId: mod.id,
              title: lessonDef.title,
              objective: lessonDef.objective,
              introduction: lessonDef.introduction,
              contentJson: lessonDef.contentJson,
              cefrLevel: lessonDef.cefrLevel,
              skillType: lessonDef.skillType,
              durationMinutes: lessonDef.durationMinutes,
              sortOrder: lessonOrder++,
            })
            .returning();

          let actOrder = 1;
          for (const actDef of lessonDef.activities) {
            await db.insert(activities).values({
              lessonId: lesson.id,
              type: actDef.type,
              prompt: actDef.prompt,
              instruction: actDef.instruction,
              payloadJson: actDef.payloadJson,
              points: actDef.points,
              sortOrder: actOrder++,
            });
          }
        }
      }
    }
  }
}
