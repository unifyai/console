const voicePresets = [
  {
    voiceId: '11af83e2-23eb-452f-956e-7fee218ccb5c',
    name: 'English Female Calm 1', // Original: Midwestern Woman
    description:
      'A calm, conversational, feminine voice perfect for narration stories or on phone calls. Speaking in an American accent. ',
    gender: 'female',
    language: 'en',
    provider: 'cartesia',
  },
  {
    voiceId: '6f84f4b8-58a2-430c-8c79-688dad597532',
    name: 'English Female Friendly 1', // Original: Brooke
    description:
      'A friendly and natural American female voice that feels warm, engaging, and easy to listen to in any conversation.',
    gender: 'female',
    language: 'en',
    provider: 'cartesia',
  },
  {
    voiceId: 'c99d36f3-5ffd-4253-803a-535c1bc9c306',
    name: 'English Male Deep 1', // Original: Griffin
    description: "A deep, smoooth British man's voice perfect for narration.",
    gender: 'male',
    language: 'en',
    provider: 'cartesia',
  },
  {
    voiceId: '57c63422-d911-4666-815b-0c332e4d7d6a',
    name: 'English Female Bright 1', // Original: Lori
    description:
      'A bright, expressive young female American voice full of energy and charm, perfect for animated characters, lively narrations, and engaging storytelling.',
    gender: 'female',
    language: 'en',
    provider: 'cartesia',
  },
  {
    voiceId: '846fa30b-6e1a-49b9-b7df-6be47092a09a',
    name: 'Spanish Male Confident 1', // Original: Spanish Storyteller Man
    description:
      'A confident and engaging Spanish voice, perfect for conversational AI and phone interactions. His tone is warm, clear, and naturally expressive, ensuring smooth and natural conversations. ',
    gender: 'male',
    language: 'es',
    provider: 'cartesia',
  },
  {
    voiceId: '4df027cb-2920-4a1f-8c34-f21529d5c3fe',
    name: 'English Male Confident 1', // Original: Carson
    description: 'A young American accented male with a confident, firm, friendly tone',
    gender: 'male',
    language: 'en',
    provider: 'cartesia',
  },
  {
    voiceId: 'c8605446-247c-4d39-acd4-8f4c28aa363c',
    name: 'English Female Wise 1', // Original: Wise Lady
    description:
      'This voice is wise and authoritative, perfect for a confident narrator. Speaking in an American accent.',
    gender: 'female',
    language: 'en',
    provider: 'cartesia',
  },
  {
    voiceId: '00967b2f-88a6-4a31-8153-110a92134b9f',
    name: 'English Male Warm 1', // Original: Ethan
    description:
      'A warm and expressive American male voice, great for audiobooks and clear communication.',
    gender: 'male',
    language: 'en',
    provider: 'cartesia',
  },
  {
    voiceId: '4af7c703-f2a9-45dd-a7fd-724cf7efc371',
    name: 'English Female Smooth 1', // Original: Carrie
    description:
      'A smooth, conversational female voice great for phone calls and support. Speaking in an American accent.',
    gender: 'female',
    language: 'en',
    provider: 'cartesia',
  },
  {
    voiceId: 'da69d796-4603-4419-8a95-293bfc5679eb',
    name: 'English Male Neutral 1', // Original: David
    description: 'Neutral version of the David voice. Speaking in an American accent.',
    gender: 'male',
    language: 'en',
    provider: 'cartesia',
  },
  {
    voiceId: '791d5162-d5eb-40f0-8189-f19db44611d8',
    name: 'Hindi Male Confident 1', // Original: Ayush
    description:
      'A confident, young Indian male voice, ideal for delivering demos, instructions, and customer support',
    gender: 'male',
    language: 'hi',
    provider: 'cartesia',
  },
  {
    voiceId: '87bc56aa-ab01-4baa-9071-77d497064686',
    name: 'English Male Smooth 1', // Original: Jordan
    description:
      'A smooth and friendly American male voice with a natural, easygoing tone, perfect for casual conversations and engaging narration.',
    gender: 'male',
    language: 'en',
    provider: 'cartesia',
  },
  {
    voiceId: '97f4b8fb-f2fe-444b-bb9a-c109783a857a',
    name: 'English Male Warm 2', // Original: Nathan
    description:
      'A warm and natural male American voice with a confident yet relaxed tone, perfect for narration.',
    gender: 'male',
    language: 'en',
    provider: 'cartesia',
  },
  {
    voiceId: '694f9389-aac1-45b6-b726-9d9369183238',
    name: 'English Female Natural 1', // Original: Sarah
    description:
      'This voice is natural and expressive with an American accent, perfect for a wide range of conversational use cases including customer support, sales, reception, and more.',
    gender: 'female',
    language: 'en',
    provider: 'cartesia',
  },
  {
    voiceId: 'e00d0e4c-a5c8-443f-a8a3-473eb9a62355',
    name: 'English Male Friendly 1', // Original: Friendly Sidekick
    description:
      'This voice is friendly and supportive, designed for voicing characters in games and videos. Speaking in an American accent.',
    gender: 'male',
    language: 'en',
    provider: 'cartesia',
  },
  {
    voiceId: '7fe6faca-172f-4fd9-a193-25642b8fdb07',
    name: 'English Male Rich 1', // Original: American Voiceover Man
    description:
      'A versatile and engaging voice with a rich, professional tone, perfect for commercials, narrations, promos, and dynamic voiceovers that captivate and connect with any audience.',
    gender: 'male',
    language: 'en',
    provider: 'cartesia',
  },
  {
    voiceId: '2a4d065a-ac91-4203-a015-eb3fc3ee3365',
    name: 'English Male Warm 3', // Original: Customer Service Man
    description:
      'A warm, professional, and reassuring male voice that provides clear, courteous, and helpful responses, perfect for guiding customers with confidence and ease. Speaking in an American accent.',
    gender: 'male',
    language: 'en',
    provider: 'cartesia',
  },
  {
    voiceId: 'a8136a0c-9642-497a-882d-8d591bdcb2fa',
    name: 'English Female Clear 1', // Original: American Narrator Lady
    description:
      'A clear, expressive, and captivating voice that brings stories, documentaries, and audiobooks to life with a natural American cadence.',
    gender: 'female',
    language: 'en',
    provider: 'cartesia',
  },
  {
    voiceId: 'af346552-54bf-4c2b-a4d4-9d2820f51b6c',
    name: 'English Female Warm 1', // Original: Help Desk Woman
    description:
      'This feminine African American voice has a warm, friendly, and reassuring tone, designed to convey patience and professionalism in every interaction.',
    gender: 'female',
    language: 'en',
    provider: 'cartesia',
  },
  {
    voiceId: '23e9e50a-4ea2-447b-b589-df90dbb848a2',
    name: 'English Male Wise 1', // Original: Dallas
    description: 'A male voice that carries wisdom and composure. ',
    gender: 'male',
    language: 'en',
    provider: 'cartesia',
  },
  {
    voiceId: '701a96e1-7fdd-4a6c-a81e-a4a450403599',
    name: 'English Male Clear 1', // Original: Orion
    description:
      'A clear, well-enunciated male American voice with a confident and professional tone, perfect for voiceovers, corporate narrations, and instructional content.',
    gender: 'male',
    language: 'en',
    provider: 'cartesia',
  },
  {
    voiceId: '63406bbd-ce1b-4fff-8beb-86d3da9891b9',
    name: 'English Male Clear 2', // Original: Grant
    description:
      'A clear, well-paced male voice with a steady and professional tone, perfect for voiceovers, presentations, and informative narrations.',
    gender: 'male',
    language: 'en',
    provider: 'cartesia',
  },
  {
    voiceId: '3dcaa773-fb1a-47f7-82a4-1bf756c4e1fb',
    name: 'English Male Confident 2', // Original: Harry
    description:
      'A confident and approachable male voice with a natural, friendly tone, perfect for engaging conversations and relatable narration. Speaking in an American accent.',
    gender: 'male',
    language: 'en',
    provider: 'cartesia',
  },
  {
    voiceId: 'cefcb124-080b-4655-b31f-932f3ee743de',
    name: 'Spanish Female Warm 1', // Original: Elena
    description:
      'Elena is a warm and inviting Spanish voice, designed for seamless and natural conversations. Her speech is clear, articulate, and expressive, making her ideal for phone systems, virtual assistants, and customer support.',
    gender: 'female',
    language: 'es',
    provider: 'cartesia',
  },
  {
    voiceId: 'e5923af7-a329-4e9b-b95a-5ace4a083535',
    name: 'Italian Male Charismatic 1', // Original: Lucio
    description:
      'Luca is a charismatic and engaging Italian voice, perfect for conversational AI and phone interactions. His tone is warm, smooth, and naturally expressive, making every dialogue feel authentic and personal.',
    gender: 'male',
    language: 'it',
    provider: 'cartesia',
  },
  {
    voiceId: '38aabb6a-f52b-4fb0-a3d1-988518f4dc06',
    name: 'German Female Warm 1', // Original: Alina
    description:
      'Alina is a warm, engaging German voice designed for seamless and natural conversations. With a smooth, friendly tone and clear articulation, she is perfect for phone systems, virtual assistants, and customer service interactions.',
    gender: 'female',
    language: 'de',
    provider: 'cartesia',
  },
  {
    voiceId: '00a77add-48d5-4ef6-8157-71e5437b282d',
    name: 'English Female Calm 3', // Original: Calm Lady
    description: 'This American voice is calm and nurturing, perfect for a narrator.',
    gender: 'female',
    language: 'en',
    provider: 'cartesia',
  },
  {
    voiceId: 'c59c247b-6aa9-4ab6-91f9-9eabea7dc69e',
    name: 'Chinese Male Knowledgeable 1', // Original: Chinese Lecturer Man
    description:
      'This masculine voice has a knowledgeable, articulate, and authoritative tone, ideal for delivering educational content, academic presentations, or professional instructions.',
    gender: 'male',
    language: 'zh',
    provider: 'cartesia',
  },
  {
    voiceId: '2695b6b5-5543-4be1-96d9-3967fb5e7fec',
    name: 'Spanish Male Relaxed 1', // Original: Spanish-speaking Reporter Man
    description:
      'This masculine voice has a relaxed, conversational tone with a touch of background noise, creating an authentic, laid-back atmosphere.',
    gender: 'male',
    language: 'es',
    provider: 'cartesia',
  },
  {
    voiceId: '1cf751f6-8749-43ab-98bd-230dd633abdb',
    name: 'Portuguese Female Warm 1', // Original: Conversational Brazilian Woman
    description:
      'This feminine voice has a warm, friendly, and approachable tone, with a natural flow and slight casualness, making it perfect for informal dialogues.',
    gender: 'female',
    language: 'pt',
    provider: 'cartesia',
  },
  {
    voiceId: '304fdbd8-65e6-40d6-ab78-f9d18b9efdf9',
    name: 'Korean Female Smooth 1', // Original: Korean Support Woman
    description:
      'A smooth Korean female voice with a gentle, expressive tone, perfect for conversations.',
    gender: 'female',
    language: 'ko',
    provider: 'cartesia',
  },
  {
    voiceId: 'dcf62f33-7cff-4f20-85b2-2efaa68cbc32',
    name: 'Polish Female Warm 1', // Original: Zofia
    description:
      'A warm and expressive Polish female voice, great for audiobooks and clear communication.',
    gender: 'female',
    language: 'pl',
    provider: 'cartesia',
  },
  {
    voiceId: '59d4fd2f-f5eb-4410-8105-58db7661144f',
    name: 'Japanese Female Calm 1', // Original: Yuki
    description:
      'A calm and clear Japanese female voice, perfect for narration and engaging conversations.',
    gender: 'female',
    language: 'ja',
    provider: 'cartesia',
  },
  {
    voiceId: 'a0cc0d65-5317-4652-b166-d9d34a244c6f',
    name: 'English Male Clear 3', // Original: Neil
    description:
      'This voice is clear and crisp with an Indian accent, perfect for a wide range of conversational use cases like customer support, sales, and reception.',
    gender: 'male',
    language: 'en',
    provider: 'cartesia',
  },
  {
    voiceId: 'bec003e2-3cb3-429c-8468-206a393c67ad',
    name: 'Hindi Female Friendly 1', // Original: Parvati
    description:
      'A young and friendly female voice for Hindi, perfect for customer support use cases.',
    gender: 'female',
    language: 'hi',
    provider: 'cartesia',
  },
  {
    voiceId: 'bdab08ad-4137-4548-b9db-6142854c7525',
    name: 'Hindi Male Authoritative 1', // Original: Hindi Reporter Man
    description:
      'A clear and authoritative Hindi male voice, perfect for news broadcasts, documentaries, and corporate presentations.',
    gender: 'male',
    language: 'hi',
    provider: 'cartesia',
  },
  {
    voiceId: '663afeec-d082-4ab5-827e-2e41bf73a25b',
    name: 'Korean Female Graceful 1', // Original: Korean Narrator Woman
    description:
      'A graceful and melodic Korean female voice, perfect for narrating audiobooks, documentaries, and cultural stories.',
    gender: 'female',
    language: 'ko',
    provider: 'cartesia',
  },
  {
    voiceId: '15d0c2e2-8d29-44c3-be23-d585d5f154a1',
    name: 'Spanish Male Rich 1', // Original: Mexican Man
    description: 'This voice is rich with a Mexican accent, perfect for casual conversations',
    gender: 'male',
    language: 'es',
    provider: 'cartesia',
  },
  {
    voiceId: 'ee7ea9f8-c0c1-498c-9279-764d6b56d189',
    name: 'English Male Polite 1', // Original: Polite Man
    description:
      'This voice is polite and conversational, with a slight accent, designed for customer support and casual conversations',
    gender: 'male',
    language: 'en',
    provider: 'cartesia',
  },
  {
    voiceId: '573e3144-a684-4e72-ac2b-9b2063a50b53',
    name: 'English Female Neutral 1', // Original: Teacher Lady
    description:
      'This voice is neutral and clear, perfect for narrating educational content. Speaking in an American accent.',
    gender: 'female',
    language: 'en',
    provider: 'cartesia',
  },
  {
    voiceId: '7360f116-6306-4e9a-b487-1235f35a0f21',
    name: 'English Male Upbeat 1', // Original: Commercial Man
    description:
      'This voice is upbeat and enthusiastic, perfect for commercials and advertisements. Speaking in an American accent.',
    gender: 'male',
    language: 'en',
    provider: 'cartesia',
  },
  {
    voiceId: '13524ffb-a918-499a-ae97-c98c7c4408c4',
    name: 'English Male Smooth 2', // Original: Australian Man
    description:
      'This voice is smooth and disciplined, with an Australian Accent, suited for narrating educational content',
    gender: 'male',
    language: 'en',
    provider: 'cartesia',
  },
  {
    voiceId: '820a3788-2b37-4d21-847a-b65d8a68c99a',
    name: 'English Male Smooth 3', // Original: Salesman
    description:
      'This voice is smooth and persuasive, perfect for sales pitches and phone conversations. Speaking in an American accent.',
    gender: 'male',
    language: 'en',
    provider: 'cartesia',
  },
  {
    voiceId: 'f146dcec-e481-45be-8ad2-96e1e40e7f32',
    name: 'English Male Calm 1', // Original: Reading Man
    description: 'American male with calm narrational voice.',
    gender: 'male',
    language: 'en',
    provider: 'cartesia',
  },
  {
    voiceId: '71a7ad14-091c-4e8e-a314-022ece01c121',
    name: 'English Female Elegant 1', // Original: British Reading Lady
    description:
      'This is a calm and elegant voice with a British accent, perfect for storytelling and narration',
    gender: 'female',
    language: 'en',
    provider: 'cartesia',
  },
  {
    voiceId: '5abd2130-146a-41b1-bcdb-974ea8e19f56',
    name: 'English Female Expressive 1', // Original: Joan
    description:
      'This voice is natural and expressive with an American accent, perfect for use cases like interviews and customer support calls.',
    gender: 'female',
    language: 'en',
    provider: 'cartesia',
  },
  {
    voiceId: '7f423809-0011-4658-ba48-a411f5e516ba',
    name: 'Hindi Male Warm 1', // Original: Hindi Narrator Man
    description:
      'A warm and authoritative Hindi male voice, perfect for narrating stories, audiobooks, and documentaries.',
    gender: 'male',
    language: 'hi',
    provider: 'cartesia',
  },
  {
    voiceId: 'd7e54830-4754-4b17-952c-bcdb7e80a2fb',
    name: 'English Female Clear 2', // Original: Tori
    description:
      'This female American voice is clear and welcoming, perfect for an ordinary conversation.',
    gender: 'female',
    language: 'en',
    provider: 'cartesia',
  },
  {
    voiceId: 'ab109683-f31f-40d7-b264-9ec3e26fb85e',
    name: 'English Male Calm 2', // Original: Dave
    description: 'A calm, American male voice. ',
    gender: 'male',
    language: 'en',
    provider: 'cartesia',
  },
  {
    voiceId: 'f785af04-229c-4a7c-b71b-f3194c7f08bb',
    name: 'English Male Natural 1', // Original: John
    description:
      'This voice is natural and empathetic with an American accent, perfect for use cases like demos and customer support calls.',
    gender: 'male',
    language: 'en',
    provider: 'cartesia',
  },
  {
    voiceId: 'b042270c-d46f-4d4f-8fb0-7dd7c5fe5615',
    name: 'Spanish Male Conversational 1', // Original: Juan
    description: 'A conversational Spanish male voice, great for phone calls and narrations. ',
    gender: 'male',
    language: 'es',
    provider: 'cartesia',
  },
  {
    voiceId: '031851ba-cc34-422d-bfdb-cdbb7f4651ee',
    name: 'English Female Smooth 2', // Original: Cathy (British)
    description: 'A smooth, British feminine voice great for voiceovers. ',
    gender: 'female',
    language: 'en',
    provider: 'cartesia',
  },
  {
    voiceId: 'bf32f849-7bc9-4b91-8c62-954588efcc30',
    name: 'Chinese Female Casual 1', // Original: Chinese Lisa
    description: 'A casual female Chinese conversational voice. ',
    gender: 'female',
    language: 'zh',
    provider: 'cartesia',
  },
  {
    voiceId: '653b9445-ae0c-4312-a3ce-375504cff31e',
    name: 'Chinese Male Conversational 1', // Original: Mr. Liu
    description: 'A conversational Chinese man, great for phone calls and voice messages. ',
    gender: 'male',
    language: 'zh',
    provider: 'cartesia',
  },
  {
    voiceId: '1259b7e3-cb8a-43df-9446-30971a46b8b0',
    name: 'English Male Friendly 2', // Original: Devansh
    description:
      'This voice is friendly and neutral with an Indian accent, perfect for a wide range of conversational use cases like call center support.',
    gender: 'male',
    language: 'en',
    provider: 'cartesia',
  },
  {
    voiceId: 'f4e8781b-a420-4080-81cf-576331238efa',
    name: 'English Female Natural 2', // Original: Samantha
    description: 'A natural, conversational voice great for phone calling and support use-cases. ',
    gender: 'female',
    language: 'en',
    provider: 'cartesia',
  },
  {
    voiceId: '7447a397-30c1-4681-b687-0ed1b7abf0fb',
    name: 'English Female Youthful 1', // Original: Brighton
    description:
      'A youthful, expressive voice full of energy and emotion, perfect for animated characters, engaging narrations, and lively storytelling. Speaking in an American accent.',
    gender: 'female',
    language: 'en',
    provider: 'cartesia',
  },
  {
    voiceId: '700d1ee3-a641-4018-ba6e-899dcadc9e2b',
    name: 'Portuguese Female Pleasant 1', // Original: Pleasant Brazilian Lady
    description: 'This voice is pleasant and clear, perfect for casual conversations in Portuguese',
    gender: 'female',
    language: 'pt',
    provider: 'cartesia',
  },
  {
    voiceId: '0cd0cde2-3b93-42b5-bcb9-f214a591aa29',
    name: 'Japanese Female Cheerful 1', // Original: Young Shy Japanese Woman
    description:
      'A bright and cheerful Japanese female voice with a youthful, playful tone, perfect for energetic and cute anime characters.',
    gender: 'female',
    language: 'ja',
    provider: 'cartesia',
  },
  {
    voiceId: '6d287143-8db3-434a-959c-df147192da27',
    name: 'English Female Conversational 1', // Original: Stacy
    description:
      'A nice conversational female American voice great for natural support conversations. ',
    gender: 'female',
    language: 'en',
    provider: 'cartesia',
  },
  {
    voiceId: '5ef98b2a-68d2-4a35-ac52-632a2d288ea6',
    name: 'Spanish Male Smooth 1', // Original: Mario
    description: "A smooth, slower Spanish man's voice, great for narrations and conversations. ",
    gender: 'male',
    language: 'es',
    provider: 'cartesia',
  },
  {
    voiceId: 'bc46586b-b463-4367-a96e-44127177a521',
    name: 'English Female Bright 2', // Original: Maggie
    description: 'A bright, friendly young American voice with a relaxed and effortless vibe.',
    gender: 'female',
    language: 'en',
    provider: 'cartesia',
  },
  {
    voiceId: '6a360542-a117-4ed5-9e09-e8bf9b05eabb',
    name: 'Portuguese Male Calm 1', // Original: Tiago
    description:
      'A calm and clear Portuguese male voice, perfect for narration and engaging conversations.',
    gender: 'male',
    language: 'pt',
    provider: 'cartesia',
  },
  {
    voiceId: 'd718e944-b313-4998-b011-d1cc078d4ef3',
    name: 'Italian Female Professional 1', // Original: Liv
    description:
      'A clear and professional Italian female voice well suited for conversational speech.',
    gender: 'female',
    language: 'it',
    provider: 'cartesia',
  },
  {
    voiceId: '8d8ce8c9-44a4-46c4-b10f-9a927b99a853',
    name: 'English Female Smooth 3', // Original: Connie
    description: 'A smooth conversational American female voice.',
    gender: 'female',
    language: 'en',
    provider: 'cartesia',
  },
  {
    voiceId: '5c3c89e5-535f-43ef-b14d-f8ffe148c1f0',
    name: 'French Male Smooth 1', // Original: French Narrator Man
    description: 'A smooth conversational French female voice.',
    gender: 'male',
    language: 'fr',
    provider: 'cartesia',
  },
  {
    voiceId: '0418348a-0ca2-4e90-9986-800fb8b3bbc0',
    name: 'French Male Stern 1', // Original: Stern French Man
    description: 'A grave and assertive voice, well-suited for stern characters.',
    gender: 'male',
    language: 'fr',
    provider: 'cartesia',
  },
  {
    voiceId: '7b2c0a2e-3dd3-4a44-b16b-26ecd8134279',
    name: 'English Male Bright 1', // Original: Luke
    description: 'A bright American male voice speaking in a New York accent.',
    gender: 'male',
    language: 'en',
    provider: 'cartesia',
  },
  {
    voiceId: '5a31e4fb-f823-4359-aa91-82c0ae9a991c',
    name: 'Turkish Male Deep 1', // Original: Turkish Narrator Man
    description: 'A deep and resonant Turkish male voice.',
    gender: 'male',
    language: 'tr',
    provider: 'cartesia',
  },
  {
    voiceId: 'e8a863c6-22c7-4671-86ca-91cacffc038d',
    name: 'Japanese Male Confident 1', // Original: Japanese Male Conversational
    description: 'A clear and confident Japanese voice.',
    gender: 'male',
    language: 'ja',
    provider: 'cartesia',
  },
  {
    voiceId: '9BWtsMINqrJLrRacOk9x',
    name: 'English Female Husky 1', // Original: Aria
    description: 'A middle-aged female with an African-American accent. Calm with a hint of rasp.',
    gender: 'female',
    language: 'en',
    provider: 'elevenlabs',
  },
  {
    voiceId: '21m00Tcm4TlvDq8ikWAM',
    name: 'Korean Female Calm 1', // Original: Rachel
    description: 'A young, female, calm voice with a american accent.',
    gender: 'female',
    language: 'ko',
    provider: 'elevenlabs',
  },
  {
    voiceId: '29vD33N1CtxCmqQRPOHJ',
    name: 'English Male Well-rounded 1', // Original: Drew
    description: 'A middle aged, male, well-rounded voice with a american accent.',
    gender: 'male',
    language: 'en',
    provider: 'elevenlabs',
  },
  {
    voiceId: '2EiwWnXFnvU5JabPnv8n',
    name: 'Spanish Male Veteran 1', // Original: Clyde
    description: 'A middle aged, male, veteran voice with a american accent.',
    gender: 'male',
    language: 'es',
    provider: 'elevenlabs',
  },
  {
    voiceId: '5Q0t7uMcjvnagumLfvZi',
    name: 'English Male Authoritative 1', // Original: Paul
    description: 'A middle aged, male, authoritative voice with a american accent.',
    gender: 'male',
    language: 'en',
    provider: 'elevenlabs',
  },
  {
    voiceId: 'CYw3kZ02Hs0563khs1Fj',
    name: 'English Male Conversational 1', // Original: Dave
    description: 'A young, male, conversational voice with a british accent.',
    gender: 'male',
    language: 'en',
    provider: 'elevenlabs',
  },
  {
    voiceId: 'CwhRBWXzGAHq8TQ4Fs17',
    name: 'Turkish Male Neutral 1', // Original: Roger
    description: 'A neutral adult male voice',
    gender: 'male',
    language: 'tr',
    provider: 'elevenlabs',
  },
  {
    voiceId: 'EXAVITQu4vr4xnSDxMaL',
    name: 'Italian Female Professional 1', // Original: Sarah
    description:
      'Young adult woman with a confident and warm, mature quality and a reassuring, professional tone.',
    gender: 'female',
    language: 'it',
    provider: 'elevenlabs',
  },
  {
    voiceId: 'ErXwobaYiN019PkySvjV',
    name: 'English Male Well-rounded 2', // Original: Antoni
    description: 'A young, male, well-rounded voice with a american accent.',
    gender: 'male',
    language: 'en',
    provider: 'elevenlabs',
  },
  {
    voiceId: 'FGY2WhTYpPnrIDTdsKH5',
    name: 'English Female Sassy 1', // Original: Laura
    description: 'This young adult female voice delivers sunny enthusiasm with a quirky attitude.',
    gender: 'female',
    language: 'en',
    provider: 'elevenlabs',
  },
  {
    voiceId: 'GBv7mTt0atIp3Br8iCZE',
    name: 'English Male Calm 1', // Original: Thomas
    description: 'A young, male, calm voice with a american accent.',
    gender: 'male',
    language: 'en',
    provider: 'elevenlabs',
  },
  {
    voiceId: 'IKne3meq5aSn9XLyUdCD',
    name: 'French Male Hyped 1', // Original: Charlie
    description: 'A young male with a confident and energetic voice.',
    gender: 'male',
    language: 'fr',
    provider: 'elevenlabs',
  },
  {
    voiceId: 'JBFqnCBsd6RMkjVDRZzb',
    name: 'English Male Mature 1', // Original: George
    description: 'Warm resonance that instantly captivates listeners.',
    gender: 'male',
    language: 'en',
    provider: 'elevenlabs',
  },
  {
    voiceId: 'LcfcDJNUP1GQjkzn1xUU',
    name: 'Korean Female Calm 2', // Original: Emily
    description: 'A middle aged, female, calm voice with.',
    gender: 'female',
    language: 'ko',
    provider: 'elevenlabs',
  },
  {
    voiceId: 'MF3mGyEYCl7XYWbV9V6O',
    name: 'Portuguese Female Emotional 1', // Original: Elli
    description: 'A young, female, emotional voice with a american accent.',
    gender: 'female',
    language: 'pt',
    provider: 'elevenlabs',
  },
  {
    voiceId: 'N2lVS1w4EtoT3dr4eOWO',
    name: 'Spanish Male General 1', // Original: Callum
    description: 'A young, deceptively gravelly male voice.',
    gender: 'male',
    language: 'es',
    provider: 'elevenlabs',
  },
  {
    voiceId: 'ODq5zmih8GrVes37Dizd',
    name: 'Chinese Male Shouty 1', // Original: Patrick
    description: 'A middle aged, male, shouty voice.',
    gender: 'male',
    language: 'zh',
    provider: 'elevenlabs',
  },
  {
    voiceId: 'SAz9YHcvj6GT2YYXdXww',
    name: 'German Female Calm 1', // Original: River
    description: 'A relaxed, neutral voice ready for narrations or conversational projects.',
    gender: 'female',
    language: 'de',
    provider: 'elevenlabs',
  },
  {
    voiceId: 'SOYHLrjzK2X1ezoPC6cr',
    name: 'English Male Rough 1', // Original: Harry
    description: 'An animated warrior ready to charge forward.',
    gender: 'male',
    language: 'en',
    provider: 'elevenlabs',
  },
  {
    voiceId: 'TX3LPaxmHKxFdv7VOQHJ',
    name: 'Japanese Male Confident 2', // Original: Liam
    description: 'A young adult with energy and warmth.',
    gender: 'male',
    language: 'ja',
    provider: 'elevenlabs',
  },
  {
    voiceId: 'ThT5KcBeYPX3keUQqHPh',
    name: 'English Female Pleasant 1', // Original: Dorothy
    description: 'A young, female, pleasant voice with a british accent.',
    gender: 'female',
    language: 'en',
    provider: 'elevenlabs',
  },
  {
    voiceId: 'TxGEqnHWrfWFTfGW9XjX',
    name: 'Chinese Male Deep 1', // Original: Josh
    description: 'A young, male, deep voice.',
    gender: 'male',
    language: 'zh',
    provider: 'elevenlabs',
  },
  {
    voiceId: 'VR6AewLTigWG4xSOukaG',
    name: 'English Male Crisp 1', // Original: Arnold
    description: 'A middle aged, male, crisp voice with a american accent.',
    gender: 'male',
    language: 'en',
    provider: 'elevenlabs',
  },
  {
    voiceId: 'XB0fDUnXU5powFXDhCwa',
    name: 'Portuguese Female Relaxed 1', // Original: Charlotte
    description: "Sensual and raspy, she's ready to voice your temptress in video games.",
    gender: 'female',
    language: 'pt',
    provider: 'elevenlabs',
  },
  {
    voiceId: 'Xb7hH8MSUJpSbSDYk0k2',
    name: 'Japanese Female Professional 1', // Original: Alice
    description:
      'Clear and engaging, friendly woman with a British accent suitable for e-learning.',
    gender: 'female',
    language: 'ja',
    provider: 'elevenlabs',
  },
  {
    voiceId: 'XrExE9yKIg1WjnnlVkGX',
    name: 'English Female Upbeat 1', // Original: Matilda
    description: 'A professional woman with a pleasing alto pitch. Suitable for many use cases.',
    gender: 'female',
    language: 'en',
    provider: 'elevenlabs',
  },
  {
    voiceId: 'Yko7PKHZNXotIFUBG7I9',
    name: 'French Male Calm 3', // Original: George
    description: 'A middle aged, male, calm voice.',
    gender: 'male',
    language: 'fr',
    provider: 'elevenlabs',
  },
  {
    voiceId: 'ZQe5CZNOzWyzPSCn5a3c',
    name: 'English Male Calm 4', // Original: James
    description: 'An old, male, calm voice with a australian accent.',
    gender: 'male',
    language: 'en',
    provider: 'elevenlabs',
  },
  {
    voiceId: 'Zlb1dXrM653N07WRdFW3',
    name: 'Hindi Male Articulate 1', // Original: Joseph
    description: 'A middle aged, male, articulate voice with a british accent.',
    gender: 'male',
    language: 'hi',
    provider: 'elevenlabs',
  },
  {
    voiceId: 'bIHbv24MWmeRgasZH58o',
    name: 'English Male Chill 1', // Original: Will
    description: 'A middle aged, conversational and laid back male voice.',
    gender: 'male',
    language: 'en',
    provider: 'elevenlabs',
  },
  {
    voiceId: 'bVMeCyTHy58xNoL34h3p',
    name: 'Spanish Male Excited 1', // Original: Jeremy
    description: 'A young, male, excited voice with a irish accent.',
    gender: 'male',
    language: 'es',
    provider: 'elevenlabs',
  },
  {
    voiceId: 'cgSgspJ2msm6clMCkdW9',
    name: 'English Female Cute 1', // Original: Jessica
    description:
      'Young and popular, this playful American female voice is perfect for trendy content.',
    gender: 'female',
    language: 'en',
    provider: 'elevenlabs',
  },
  {
    voiceId: 'cjVigY5qzO86Huf0OWal',
    name: 'English Male Classy 1', // Original: Eric
    description: 'A smooth tenor pitch from a man in his 40s - perfect for agentic use cases.',
    gender: 'male',
    language: 'en',
    provider: 'elevenlabs',
  },
  {
    voiceId: 'flq6f7yk4E4fJM5XTYuZ',
    name: 'Portuguese Male Calm 1', // Original: Michael
    description: 'An old, male, calm voice with a american accent.',
    gender: 'male',
    language: 'pt',
    provider: 'elevenlabs',
  },
  {
    voiceId: 'iP95p4xoKVk53GoZ742B',
    name: 'English Male Casual 1', // Original: Chris
    description: 'Natural and real, this down-to-earth voice is great across many use-cases.',
    gender: 'male',
    language: 'en',
    provider: 'elevenlabs',
  },
  {
    voiceId: 'jsCqWAovK2LkecY7zXl4',
    name: 'Hindi Female Expressive 1', // Original: Freya
    description: 'A young, female, expressive voice with a american accent.',
    gender: 'female',
    language: 'hi',
    provider: 'elevenlabs',
  },
  {
    voiceId: 'nPczCjzI2devNBz1zQrb',
    name: 'English Male Classy 2', // Original: Brian
    description: 'Middle-aged man with a resonant and comforting tone.',
    gender: 'male',
    language: 'en',
    provider: 'elevenlabs',
  },
  {
    voiceId: 'oWAxZDx7w5VEj9dCyTzz',
    name: 'Spanish Female Pleasant 1', // Original: Grace
    description: 'A young, female, pleasant voice with a us-southern accent.',
    gender: 'female',
    language: 'es',
    provider: 'elevenlabs',
  },
  {
    voiceId: 'onwK4e9ZLuTAKqWW03F9',
    name: 'English Male Formal 1', // Original: Daniel
    description: 'A strong voice perfect for delivering a professional broadcast or news story.',
    gender: 'male',
    language: 'en',
    provider: 'elevenlabs',
  },
  {
    voiceId: 'pFZP5JQG7iQjIQuC4Bku',
    name: 'Polish Female Confident 1', // Original: Lily
    description:
      'Velvety British female voice delivers news and narrations with warmth and clarity.',
    gender: 'female',
    language: 'pl',
    provider: 'elevenlabs',
  },
  {
    voiceId: 'pMsXgVXv3BLzUgSXRplE',
    name: 'English Female Pleasant 2', // Original: Serena
    description: 'A middle aged, female, pleasant voice with a american accent.',
    gender: 'female',
    language: 'en',
    provider: 'elevenlabs',
  },
  {
    voiceId: 'pNInz6obpgDQGcFmaJgB',
    name: 'English Male Deep 2', // Original: Adam
    description: 'A deep resonant male voice.',
    gender: 'male',
    language: 'en',
    provider: 'elevenlabs',
  },
  {
    voiceId: 'pqHfZKP75CvOlQylNhV4',
    name: 'Hindi Male Crisp 2', // Original: Bill
    description: 'Friendly and comforting voice ready to narrate your stories.',
    gender: 'male',
    language: 'hi',
    provider: 'elevenlabs',
  },
  {
    voiceId: 't0jbNlBVZ17f02VDIeMI',
    name: 'Spanish Male Raspy 1', // Original: Jessie
    description: 'An old, male, raspy voice with a american accent.',
    gender: 'male',
    language: 'es',
    provider: 'elevenlabs',
  },
  {
    voiceId: 'wViXBPUzp2ZZixB1xQuM',
    name: 'English Male Crisp 3', // Original: Arnold
    description: 'A middle aged, male, crisp voice with a american accent.',
    gender: 'male',
    language: 'en',
    provider: 'elevenlabs',
  },
  {
    voiceId: 'yoZ06aMxZJJ28mfd3POQ',
    name: 'English Male Raspy 2', // Original: Sam
    description: 'A young, male, raspy voice with a american accent.',
    gender: 'male',
    language: 'en',
    provider: 'elevenlabs',
  },
  {
    voiceId: 'z9fAnlkpzviPz146aGWa',
    name: 'English Female Poised 1', // Original: Glinda
    description: 'A middle aged, female, poised voice with a american accent.',
    gender: 'female',
    language: 'en',
    provider: 'elevenlabs',
  },
  {
    voiceId: 'zcAOhNBS3c14rBihAFp1',
    name: 'Italian Male Neutral 1', // Original: Giovanni
    description: 'A young, male, Neutral voice with a italian accent.',
    gender: 'male',
    language: 'it',
    provider: 'elevenlabs',
  },
  {
    voiceId: 'zrHiDhphv9ZnVXBqCLjz',
    name: 'Chinese Female Childish 1', // Original: Mimi
    description: 'A young, female, childish and enthusiastic voice.',
    gender: 'female',
    language: 'zh',
    provider: 'elevenlabs',
  },
  {
    voiceId: 'AZnzlk1XvdvUeBnXmlld',
    name: 'English Female Childish 1', // Original: Domi
    description: 'A young, female, childish voice with an american accent.',
    gender: 'female',
    language: 'en',
    provider: 'elevenlabs',
  },
  {
    voiceId: 'D38z5RcWu1voky8WS1ja',
    name: 'Hindi Male Experienced 1', // Original: Fin
    description: 'A middle aged, male, mature voice that conveys experience.',
    gender: 'male',
    language: 'hi',
    provider: 'elevenlabs',
  },
  {
    voiceId: 'shimmer',
    name: 'Multilingual Female Professional 1', // Original: Shimmer
    description: 'A young, female voice that sounds professional.',
    gender: 'female',
    language: 'multi',
    provider: 'openai',
  },
  {
    voiceId: 'fable',
    name: 'Multilingual Female Professional 2', // Original: Fable
    description: 'A slow-paced, mature female voice.',
    gender: 'female',
    language: 'multi',
    provider: 'openai',
  },
  {
    voiceId: 'alloy',
    name: 'Multilingual Female Professional 3', // Original: Alloy
    description: 'A confident-sounding mature female voice.',
    gender: 'female',
    language: 'multi',
    provider: 'openai',
  },
  {
    voiceId: 'marin',
    name: 'Multilingual Female Dynamic 1', // Original: Marin
    description: 'A young, female dynamic voice.',
    gender: 'female',
    language: 'multi',
    provider: 'openai',
  },
  {
    voiceId: 'coral',
    name: 'Multilingual Female Dynamic 2', // Original: Coral
    description: 'A female voice beaming with enthusiasm.',
    gender: 'female',
    language: 'multi',
    provider: 'openai',
  },
  {
    voiceId: 'nova',
    name: 'Multilingual Female Neutral 1', // Original: Nova
    description: 'A regular, female voice.',
    gender: 'female',
    language: 'multi',
    provider: 'openai',
  },
  {
    voiceId: 'sage',
    name: 'Multilingual Female Neutral 2', // Original: Sage
    description: 'A neutral, young female voice.',
    gender: 'female',
    language: 'multi',
    provider: 'openai',
  },
  {
    voiceId: 'cedar',
    name: 'Multilingual Male Neutral 1', // Original: Cedar
    description: 'A young, neutral male voice.',
    gender: 'male',
    language: 'multi',
    provider: 'openai',
  },
  {
    voiceId: 'echo',
    name: 'Multilingual Male Neutral 2', // Original: Echo
    description: 'A slow-paced, regular male voice.',
    gender: 'male',
    language: 'multi',
    provider: 'openai',
  },
  {
    voiceId: 'ash',
    name: 'Multilingual Male Grave 1', // Original: Ash
    description: 'A male voice with a heavy grain.',
    gender: 'male',
    language: 'multi',
    provider: 'openai',
  },
  {
    voiceId: 'onyx',
    name: 'Multilingual Male Grave 2', // Original: Onyx
    description: 'A deep, wise-sounding male voice.',
    gender: 'male',
    language: 'multi',
    provider: 'openai',
  },
  {
    voiceId: 'ballad',
    name: 'Multilingual Male Dynamic 1', // Original: Ballad
    description: 'A young, enthusiastic male voice.',
    gender: 'male',
    language: 'multi',
    provider: 'openai',
  },
  {
    voiceId: 'verse',
    name: 'Multilingual Male Dynamic 2', // Original: Verse
    description: 'A young, dynamic-sounding male voice.',
    gender: 'male',
    language: 'multi',
    provider: 'openai',
  },
];

export default voicePresets;
