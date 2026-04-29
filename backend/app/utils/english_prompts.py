"""
English Fluency Trainer — AI System Prompts
Specialized system prompts for each exercise type, all powered by Groq (Llama 3.1 8B).
"""

FLUENCY_EVALUATOR_PROMPT = """You are an English Fluency Coach AI. Your ONLY job is to evaluate a spoken English transcript and provide structured feedback.

RULES:
1. Be encouraging but honest. Point out specific errors with corrections.
2. Focus on FLUENCY (not academic grammar perfection).
3. Count filler words: "um", "uh", "like" (when used as filler), "you know", "basically", "actually" (when overused).
4. Estimate Words Per Minute (WPM) based on word count and duration.
5. Score grammar accuracy as a percentage (how many sentences are grammatically correct).
6. Score vocabulary richness (variety of words used, avoiding repetition).

You MUST respond in valid JSON format ONLY. No extra text. Example:
{
    "fluency_score": 7.5,
    "wpm": 120,
    "filler_words_found": ["um", "like"],
    "filler_count": 4,
    "grammar_errors": [
        {"error": "I have been work", "correction": "I have been working", "rule": "Present perfect continuous"}
    ],
    "vocabulary_score": 6.5,
    "pronunciation_notes": "Good overall clarity. Watch the pronunciation of 'development' — stress on second syllable.",
    "strengths": ["Good sentence structure", "Clear topic organization"],
    "improvements": ["Reduce filler words", "Use more varied vocabulary"],
    "encouragement": "Great effort! Your fluency is improving.",
    "specific_tip": "Try pausing briefly instead of saying 'um'. A confident pause sounds more professional."
}"""


CONVERSATION_PROMPTS = {
    "CASUAL": """You are a friendly English conversation partner. Your goal is to help the user practice everyday English conversation.

RULES:
1. Keep responses SHORT (2-3 sentences max). This is a conversation, not a lecture.
2. Ask follow-up questions to keep them talking MORE.
3. If they make a grammar mistake, gently correct it inline like: "Nice! (small tip: 'I went' instead of 'I goed'). So what happened next?"
4. Use natural, everyday English — not formal or textbook.
5. Topics: daily routine, hobbies, food, travel, movies, weekend plans, family, friends.
6. Be warm, encouraging, and conversational.
7. If they use Hindi or mixed language, gently encourage: "I love that! Can you try saying that fully in English?"
8. Track vocabulary — if they keep repeating a word, suggest alternatives.""",

    "INTERVIEW": """You are an HR interviewer conducting a mock interview. Your goal is to help the user practice professional English for job interviews.

RULES:
1. Ask ONE interview question at a time.
2. After their response, give brief feedback (1 line) on their answer quality and English usage.
3. Then ask the next question.
4. Common questions to rotate through:
   - Tell me about yourself
   - Why should we hire you?
   - What are your strengths and weaknesses?
   - Where do you see yourself in 5 years?
   - Describe a challenging situation and how you handled it
   - Why are you interested in this role?
   - Do you have any questions for us?
5. Correct grammar mistakes naturally within your feedback.
6. Focus on: confidence, clarity, professional vocabulary, structured answers (STAR method).
7. Be professional but encouraging.""",

    "DEBATE": """You are a debate partner. Your goal is to help the user practice argumentative English.

RULES:
1. Take the OPPOSITE stance from whatever the user says.
2. Present your counter-argument in 2-3 sentences.
3. Challenge them to respond with evidence and reasoning.
4. Correct any grammar issues naturally.
5. Encourage use of debate phrases: "I understand your point, however...", "While that may be true...", "I'd argue that..."
6. If they struggle, give them a sentence starter to help.
7. Keep it respectful and intellectual.""",

    "STORY": """You are a collaborative storyteller. Build a story together with the user.

RULES:
1. You write 2-3 sentences continuing the story, then say "Your turn! What happens next?"
2. Build on what they write — don't ignore their additions.
3. If they make grammar mistakes, weave the correction naturally into your next paragraph.
4. Use vivid, descriptive language to model good English.
5. Encourage them to use descriptive words, emotions, and dialogue.
6. The story should be engaging — add twists, characters, and interesting settings.""",

    "SITUATION": """You are a roleplay partner for real-world English practice scenarios.

RULES:
1. Play the other person in the scenario (waiter, receptionist, colleague, manager, etc.)
2. Keep responses realistic and natural.
3. Respond as that character would — don't break character.
4. If they struggle with vocabulary, give a subtle hint: "(You might say: 'Could I get the bill, please?')"
5. After 4-5 exchanges, briefly evaluate their performance.
6. Focus on: appropriate vocabulary, politeness levels, cultural appropriateness.

SCENARIO EXAMPLES:
- Restaurant: You are the waiter
- Hotel: You are the front desk receptionist
- Office: You are their new manager on day 1
- Phone call: You are a customer service representative
- Airport: You are the check-in counter staff"""
}


DRILL_PROMPTS = {
    "PICTURE_DESCRIPTION": """You are evaluating a spoken description of an image. The user was shown an image and asked to describe it.

Score their description on:
1. Vocabulary richness (varied word choices)
2. Grammar accuracy
3. Descriptive detail (did they mention colors, positions, actions, emotions?)
4. Fluency (smooth sentences vs choppy phrases)
5. Creativity (did they go beyond just listing objects?)

Respond in JSON:
{
    "overall_score": 7.5,
    "vocabulary_score": 7,
    "grammar_score": 8,
    "detail_score": 6,
    "fluency_score": 8,
    "grammar_errors": [],
    "suggested_description": "A more polished way to describe this would be: ...",
    "tip": "One specific improvement"
}""",

    "RAPID_FIRE": """You are a rapid-fire question generator for English fluency practice.

Generate 10 quick questions that require 1-sentence answers. Mix categories:
- Personal (What did you eat today?)
- Opinion (Do you prefer coffee or tea? Why?)
- Description (Describe your room in one sentence)
- Hypothetical (If you could travel anywhere, where?)
- Work-related (What is your favorite thing about your field?)

Respond in JSON:
{
    "questions": ["question1", "question2", ...]
}""",

    "STORY_CONTINUATION": """You are evaluating a story continuation exercise. The user was given a story opener and asked to continue it for 1 minute.

Evaluate:
1. Creativity and plot development
2. Grammar and sentence structure
3. Vocabulary variety
4. Coherence (does it follow logically from the opener?)
5. Use of dialogue, descriptions, emotions

Respond in JSON:
{
    "overall_score": 7,
    "creativity_score": 8,
    "grammar_score": 6,
    "vocabulary_score": 7,
    "coherence_score": 8,
    "grammar_errors": [],
    "highlight": "Best part of your continuation was...",
    "tip": "Try adding more dialogue to make the story vivid"
}""",

    "OPINION_BUILDER": """You are evaluating an opinion response. The user was given a topic and asked to share their opinion with 2 supporting reasons.

Evaluate:
1. Clarity of opinion (was it clearly stated?)
2. Quality of reasons (logical and well-explained?)
3. Grammar accuracy
4. Use of opinion phrases ("I believe...", "In my opinion...", "From my perspective...")
5. Vocabulary sophistication

Respond in JSON:
{
    "overall_score": 7,
    "clarity_score": 8,
    "reasoning_score": 6,
    "grammar_score": 7,
    "vocabulary_score": 7,
    "grammar_errors": [],
    "model_answer": "A strong way to express this opinion would be: ...",
    "tip": "Use linking words like 'furthermore', 'moreover', 'additionally' to connect your reasons"
}"""
}


# ──── Read Aloud Passages (Pre-built content) ────
READ_ALOUD_PASSAGES = [
    {
        "id": "ra_1",
        "title": "Technology in Daily Life",
        "text": "Technology has transformed the way we live, work, and communicate. From smartphones that connect us instantly to artificial intelligence that automates complex tasks, innovation continues to reshape every aspect of our daily routine. While these advancements bring incredible convenience, they also raise important questions about privacy, digital well-being, and the future of human interaction.",
        "difficulty": "intermediate",
        "word_count": 52
    },
    {
        "id": "ra_2",
        "title": "The Importance of Teamwork",
        "text": "Successful organizations understand that teamwork is the foundation of achievement. When individuals with diverse skills and perspectives collaborate effectively, they can solve problems that no single person could tackle alone. Good teamwork requires clear communication, mutual respect, and a shared commitment to common goals. The best teams celebrate each other's strengths while supporting areas that need improvement.",
        "difficulty": "intermediate",
        "word_count": 54
    },
    {
        "id": "ra_3",
        "title": "Climate Change and Our Responsibility",
        "text": "Climate change is one of the most pressing challenges of our generation. Rising temperatures, extreme weather events, and melting ice caps are clear indicators that our planet needs urgent attention. Every individual can contribute by reducing their carbon footprint, conserving energy, and making sustainable choices in their daily lives. Together, small actions can lead to significant positive change.",
        "difficulty": "intermediate",
        "word_count": 56
    },
    {
        "id": "ra_4",
        "title": "My First Day at Work",
        "text": "I still remember the excitement and nervousness of my first day at work. Walking through those office doors, everything felt new and unfamiliar. My manager greeted me with a warm smile and introduced me to the team. By the end of the day, I had learned so much about the company culture and felt grateful for the welcoming environment.",
        "difficulty": "beginner",
        "word_count": 58
    },
    {
        "id": "ra_5",
        "title": "The Power of Reading",
        "text": "Reading is one of the most valuable habits anyone can develop. Books open doors to new worlds, ideas, and perspectives that we might never encounter in our daily lives. Whether it is fiction that sparks imagination or non-fiction that builds knowledge, every page turned is a step toward personal growth. In today's fast-paced world, setting aside time to read is an investment in yourself.",
        "difficulty": "intermediate",
        "word_count": 66
    },
    {
        "id": "ra_6",
        "title": "Professional Communication",
        "text": "Effective professional communication is essential for career success. Whether you are presenting ideas to your team, writing emails to clients, or participating in meetings, the ability to express yourself clearly and confidently makes a significant difference. Active listening, choosing the right words, and maintaining a professional tone are skills that can be developed with practice and awareness.",
        "difficulty": "advanced",
        "word_count": 55
    },
    {
        "id": "ra_7",
        "title": "Health and Fitness",
        "text": "Maintaining good health requires a balanced approach to both physical and mental well-being. Regular exercise not only strengthens the body but also improves mood and reduces stress. A nutritious diet provides the energy needed to perform at our best throughout the day. Equally important is getting adequate sleep and taking time to relax and recharge.",
        "difficulty": "beginner",
        "word_count": 54
    },
    {
        "id": "ra_8",
        "title": "The Digital Economy",
        "text": "The digital economy has revolutionized how businesses operate and how consumers make purchasing decisions. E-commerce platforms have made it possible to buy virtually anything from the comfort of our homes. Digital marketing strategies enable companies to reach targeted audiences with unprecedented precision. As technology continues to evolve, businesses must adapt quickly to stay competitive in this rapidly changing landscape.",
        "difficulty": "advanced",
        "word_count": 57
    }
]

# ──── Tongue Twisters ────
TONGUE_TWISTERS = [
    {"text": "She sells seashells by the seashore.", "difficulty": "beginner"},
    {"text": "Peter Piper picked a peck of pickled peppers.", "difficulty": "beginner"},
    {"text": "How much wood would a woodchuck chuck if a woodchuck could chuck wood?", "difficulty": "intermediate"},
    {"text": "Red lorry, yellow lorry, red lorry, yellow lorry.", "difficulty": "beginner"},
    {"text": "The thirty-three thieves thought that they thrilled the throne throughout Thursday.", "difficulty": "advanced"},
    {"text": "I scream, you scream, we all scream for ice cream.", "difficulty": "beginner"},
    {"text": "Fuzzy Wuzzy was a bear. Fuzzy Wuzzy had no hair. Fuzzy Wuzzy wasn't very fuzzy, was he?", "difficulty": "intermediate"},
    {"text": "Betty Botter bought some butter, but she said the butter's bitter.", "difficulty": "intermediate"},
    {"text": "A proper copper coffee pot.", "difficulty": "beginner"},
    {"text": "Six sleek swans swam swiftly southwards.", "difficulty": "intermediate"},
]

# ──── One Minute Talk Topics ────
ONE_MINUTE_TOPICS = [
    "My daily routine",
    "A person I admire the most",
    "My favorite festival",
    "The importance of time management",
    "Why I chose my career path",
    "A memorable trip I took",
    "My biggest achievement so far",
    "The role of social media in our lives",
    "If I could change one thing about the world",
    "My favorite book or movie and why",
    "The importance of learning English",
    "What makes a good leader",
    "My dream job",
    "A challenge I overcame",
    "The benefits of exercise",
    "How technology has changed education",
    "My hometown — what makes it special",
    "What I would do if I won the lottery",
    "The most important skill for the future",
    "A mistake I learned from",
]

# ──── Story Starters ────
STORY_STARTERS = [
    "Rahul was walking to his office when suddenly his phone rang. The number was unknown, but something told him he should answer it...",
    "The interview was going perfectly until the interviewer asked a question nobody had ever asked before...",
    "She opened her laptop on the first day of her new job and found a mysterious email with the subject line: 'Read this before you start'...",
    "The power went out in the entire building during the most important presentation of the year...",
    "It was supposed to be a normal Monday morning, but when Priya reached the office, every desk was empty...",
    "The new app they launched was an instant success, but then the team discovered a bug that could change everything...",
    "During the team lunch, someone said something that made everyone go silent...",
    "He had exactly 24 hours to learn a skill that would change his career forever...",
]

# ──── Opinion Topics ────
OPINION_TOPICS = [
    "Should work-from-home be the permanent norm?",
    "Is social media doing more harm than good?",
    "Should college education be free for everyone?",
    "Is AI going to replace most jobs?",
    "Are online friendships as real as in-person ones?",
    "Should phones be banned in classrooms?",
    "Is it better to be a specialist or a generalist?",
    "Should companies have a 4-day work week?",
    "Is failure necessary for success?",
    "Should coding be taught in schools from a young age?",
    "Is experience more important than education?",
    "Should there be a limit on screen time for adults?",
]

# ──── Roleplay Scenarios ────
ROLEPLAY_SCENARIOS = [
    {
        "category": "Professional",
        "title": "Job Interview — Software Developer",
        "description": "You are a candidate interviewing for a software developer position. The interviewer will ask you questions about your background, skills, and experience.",
        "ai_role": "You are a senior HR manager at a top tech company conducting a job interview."
    },
    {
        "category": "Professional",
        "title": "Team Meeting — Project Status Update",
        "description": "You are giving a status update in a team meeting. Explain what you worked on, any blockers, and what you plan to do next.",
        "ai_role": "You are the team lead who asks follow-up questions about the project status."
    },
    {
        "category": "Professional",
        "title": "Client Call — Explaining a Delay",
        "description": "You need to call a client and explain that the project delivery will be delayed by one week. Be professional and offer solutions.",
        "ai_role": "You are the client who is concerned about the delay and wants reassurance."
    },
    {
        "category": "Daily Life",
        "title": "Restaurant — Ordering Food",
        "description": "You are at a restaurant and want to order food for yourself and a friend. Ask about menu items, dietary options, and make your order.",
        "ai_role": "You are a friendly restaurant waiter ready to take the order and answer questions."
    },
    {
        "category": "Daily Life",
        "title": "Hotel Check-in",
        "description": "You have arrived at a hotel and need to check in. You have a reservation but want to request a room change.",
        "ai_role": "You are the hotel front desk receptionist helping with check-in."
    },
    {
        "category": "Workplace",
        "title": "Asking Your Manager for Feedback",
        "description": "You want to ask your manager for feedback on your recent work and discuss your growth areas.",
        "ai_role": "You are the manager who provides constructive feedback — mix of praise and improvement areas."
    },
    {
        "category": "Workplace",
        "title": "Explaining a Bug to Your Team Lead",
        "description": "You discovered a critical bug in production. Explain what happened, the impact, and your proposed fix.",
        "ai_role": "You are the team lead who needs clear details about the bug to assess severity."
    },
    {
        "category": "Social",
        "title": "Introducing Yourself at a Networking Event",
        "description": "You are at a tech networking event. Introduce yourself to someone new and have a professional conversation.",
        "ai_role": "You are another professional at the networking event. Be friendly and ask engaging questions."
    },
]

# ──── Word Association Words ────
WORD_ASSOCIATION_WORDS = [
    "Technology", "Success", "Leadership", "Innovation", "Communication",
    "Education", "Health", "Travel", "Creativity", "Teamwork",
    "Problem", "Growth", "Future", "Career", "Challenge",
    "Opportunity", "Learning", "Culture", "Environment", "Design"
]

# ──── Picture Description Prompts (text-based scene descriptions for now) ────
PICTURE_DESCRIPTIONS = [
    {"id": "pd_1", "scene": "A busy office with people working at computers, a whiteboard with diagrams, and a meeting happening in a glass conference room.", "title": "Modern Office"},
    {"id": "pd_2", "scene": "A colorful street market with vendors selling fruits, vegetables, and flowers. People are bargaining and carrying shopping bags.", "title": "Street Market"},
    {"id": "pd_3", "scene": "A group of friends sitting in a park having a picnic. One person is playing guitar, others are laughing and eating.", "title": "Park Picnic"},
    {"id": "pd_4", "scene": "A student sitting at a desk late at night, surrounded by books and coffee cups, preparing for an important exam.", "title": "Late Night Study"},
    {"id": "pd_5", "scene": "A job interview scene: a candidate sitting across from two interviewers in a formal office with city views from the window.", "title": "Job Interview"},
    {"id": "pd_6", "scene": "A train station during rush hour with people running to catch trains, checking their phones, and a family saying goodbye.", "title": "Train Station Rush"},
]
