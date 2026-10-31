/* =========================================================
   Conventional Hymns — song data
   ---------------------------------------------------------
   Add your hymns here. Each song:
     {
       number: 1,                         // hymn number in your book
       title:  "Song title",
       author: "Optional",                // optional
       verses: ["line 1\nline 2", ...],   // one string per stanza, \n = new line
       chorus: "line 1\nline 2"           // optional, shown after stanza 1
     }
   The English hymns are public-domain texts. The other languages
   contain short sample songs — replace them with your hymn book.
   ========================================================= */

window.HYMN_BOOK = {
  languages: [
    { code: "te", name: "Telugu",  native: "తెలుగు",  glyph: "తె", chorus: "పల్లవి" },
    { code: "or", name: "Odia",    native: "ଓଡ଼ିଆ",   glyph: "ଓ",  chorus: "ଘୋଷା" },
    { code: "en", name: "English", native: "English", glyph: "Aa", chorus: "Chorus" },
    { code: "hi", name: "Hindi",   native: "हिन्दी",   glyph: "हि", chorus: "टेक" },
    { code: "mr", name: "Marathi", native: "मराठी",   glyph: "म",  chorus: "ध्रुपद" },
    { code: "bn", name: "Bangla",  native: "বাংলা",   glyph: "বা", chorus: "কোরাস" }
  ],

  /* Title page (shown after a language is chosen): Revelation 19:1-7.
     Odia is the text printed in the book; English is the King James
     Version; the others are translations — compare with your Bible
     and edit here if you want different wording. */
  covers: {
    or: {
      title: "ହାଲ୍ଲିଲୂୟା ସଙ୍ଗୀତ",
      verse: [
        "\"ଏଥି ଉତ୍ତାରେ ମୁଁ ସ୍ୱର୍ଗରେ ମହା ଜନତାର ଶବ୍ଦ ପରି ଗୋଟିଏ ମହା ଶବ୍ଦ ଏହା କହିବାର ଶୁଣିଲି, ହାଲ୍ଲିଲୂୟା ; ପରିତ୍ରାଣ, ଗୌରବ ଓ ପରାକ୍ରମ ଆମ୍ଭମାନଙ୍କ ଈଶ୍ୱରଙ୍କର … …",
        "ପୁଣି ସେମାନେ ଦ୍ୱିତୀୟ ଥର କହିଲେ, ହାଲ୍ଲିଲୂୟା … …",
        "ସେଥିରେ ସେହି ଚବିଶ ପ୍ରାଚୀନ ଓ ଚାରି ପ୍ରାଣୀ ଉବୁଡ଼ ହୋଇ ସିଂହାସନୋପବିଷ୍ଟ ଈଶ୍ୱରଙ୍କୁ ପ୍ରଣାମ କରି କହିଲେ, ଆମେନ୍, ହାଲ୍ଲିଲୂୟା !",
        "ସେତେବେଳେ ସିଂହାସନଠାରୁ ଗୋଟିଏ ରବ ନିର୍ଗତ ହୋଇ କହିଲା, ହେ ଈଶ୍ୱରଙ୍କ ଦାସସମସ୍ତେ, ହେ ତାହାଙ୍କର ଭୟକାରୀ କ୍ଷୁଦ୍ର ଓ ମହାନ୍ ଲୋକସମସ୍ତେ, ତାହାଙ୍କର ପ୍ରଶଂସା କର ।",
        "ଆଉ ମୁଁ ମହାଜନତାର ଶବ୍ଦ ପରି ଏବଂ ବହୁ ଜଳକଲ୍ଲୋଳ ଓ ଘୋର ମେଘଗର୍ଜନର ଶବ୍ଦ ପରି ଗୋଟିଏ ଶବ୍ଦ ଏହା କହିବାର ଶୁଣିଲି, ହାଲ୍ଲିଲୂୟା, କାରଣ ପ୍ରଭୁ ଆମ୍ଭମାନଙ୍କର ସର୍ବଶକ୍ତିମାନ୍ ଈଶ୍ୱର ରାଜତ୍ୱ ଗ୍ରହଣ କରିଅଛନ୍ତି ।",
        "ଆସ, ଆମ୍ଭେମାନେ ଆନନ୍ଦ ଓ ଉଲ୍ଲାସ କରୁ… କାରଣ ମେଷଶାବକଙ୍କ ବିବାହର ସମୟ ଉପସ୍ଥିତ, ଆଉ ତାହାଙ୍କ କନ୍ୟା ଆପଣାକୁ ସଜ୍ଜିତ କରିଅଛି ।\""
      ],
      cite: "(ପ୍ରକାଶିତ ବାକ୍ୟ ୧୯:୧-୭)",
      fellowship: "ଖ୍ରୀଷ୍ଟ-ଯୀଶୁରେ-ସମସ୍ତେ-ଏକ ମଣ୍ଡଳୀର ସହଭାଗିତା",
      tag: "~ ଭାର୍ଯ୍ୟାରୂପୀ, ପ୍ରେରିତିକ ଓ ଭାବବାଦିକ ~",
      by: "ଓଡ଼ିଶା ଶାଖା କର୍ତ୍ତୃକ ସଂକଳିତ ।"
    },
    te: {
      title: "హల్లెలూయా సంగీతము",
      verse: [
        "\"అటు తరువాత పరలోకమందు గొప్ప జనసమూహపు శబ్దమువంటి గొప్ప స్వరము ఈలాగు చెప్పగా వింటిని — హల్లెలూయ; రక్షణయు మహిమయు శక్తియు మన దేవునివే … …",
        "మరియు రెండవసారి వారు — హల్లెలూయ అని చెప్పిరి … …",
        "అప్పుడు ఇరువది నలుగురు పెద్దలును నాలుగు జీవులును సాగిలపడి — ఆమేన్, హల్లెలూయ అని చెప్పుచు సింహాసనాసీనుడైన దేవునికి నమస్కారము చేసిరి.",
        "మరియు — మన దేవుని దాసులారా, ఆయనకు భయపడువారలారా, కొద్దివారేమి గొప్పవారేమి మీరందరు ఆయనను స్తుతించుడి అని చెప్పుచున్న యొక స్వరము సింహాసనములోనుండి వచ్చెను.",
        "అప్పుడు గొప్ప జనసమూహపు శబ్దమును, విస్తారమైన జలముల శబ్దమును, బలమైన ఉరుముల శబ్దమును పోలిన యొక స్వరము — హల్లెలూయ, సర్వశక్తిగల ప్రభువైన మన దేవుడు ఏలుచున్నాడు అని చెప్పగా వింటిని.",
        "మనము సంతోషపడి ఉత్సహించి ఆయనను మహిమపరచుదము … గొఱ్ఱెపిల్ల వివాహోత్సవ సమయము వచ్చినది, ఆయన భార్య తన్ను తాను సిద్ధపరచుకొనియున్నది.\""
      ],
      cite: "(ప్రకటన 19:1-7)",
      fellowship: "క్రీస్తు యేసునందు అందరు ఒకే సంఘ సహవాసము",
      tag: "~ వధూరూప, అపొస్తలిక మరియు ప్రవచనాత్మక ~",
      by: "ఒడిశా శాఖ ద్వారా సంకలనము చేయబడినది."
    },
    en: {
      title: "Hallelujah Songs",
      verse: [
        "\"After these things I heard a great voice of much people in heaven, saying, Alleluia; Salvation, and glory, and honour, and power, unto the Lord our God … …",
        "And again they said, Alleluia … …",
        "And the four and twenty elders and the four beasts fell down and worshipped God that sat on the throne, saying, Amen; Alleluia.",
        "And a voice came out of the throne, saying, Praise our God, all ye his servants, and ye that fear him, both small and great.",
        "And I heard as it were the voice of a great multitude, and as the voice of many waters, and as the voice of mighty thunderings, saying, Alleluia: for the Lord God omnipotent reigneth.",
        "Let us be glad and rejoice, and give honour to him: for the marriage of the Lamb is come, and his wife hath made herself ready.\""
      ],
      cite: "(Revelation 19:1-7)",
      fellowship: "All One Church Fellowship in Christ Jesus",
      tag: "~ Bridal, Apostolic and Prophetic ~",
      by: "Compiled by the Odisha Branch."
    },
    hi: {
      title: "हल्लेलूयाह संगीत",
      verse: [
        "\"इसके बाद मैंने स्वर्ग में मानो बड़ी भीड़ का ऊँचा शब्द सुना, जो कहती थी, हल्लेलूयाह! उद्धार, और महिमा, और सामर्थ हमारे परमेश्वर ही की है … …",
        "फिर दूसरी बार उन्होंने कहा, हल्लेलूयाह … …",
        "और चौबीसों प्राचीनों और चारों प्राणियों ने गिरकर परमेश्वर को दण्डवत किया, जो सिंहासन पर बैठा था, और कहा, आमीन, हल्लेलूयाह!",
        "और सिंहासन में से एक शब्द निकला, कि हे हमारे परमेश्वर के सब दासो, और उससे डरनेवालो, क्या छोटे, क्या बड़े, तुम सब उसकी स्तुति करो।",
        "फिर मैंने बड़ी भीड़ का सा, और बहुत जल का सा, और बड़े गर्जनों का सा शब्द सुना, कि हल्लेलूयाह! क्योंकि प्रभु हमारा परमेश्वर सर्वशक्तिमान राज्य करता है।",
        "आओ, हम आनन्दित और मगन हों … क्योंकि मेम्ने का ब्याह आ पहुँचा, और उसकी पत्नी ने अपने आप को तैयार कर लिया है।\""
      ],
      cite: "(प्रकाशितवाक्य 19:1-7)",
      fellowship: "मसीह यीशु में सब एक कलीसिया की सहभागिता",
      tag: "~ वधू-स्वरूप, प्रेरितिक और भविष्यवक्तात्मक ~",
      by: "ओडिशा शाखा द्वारा संकलित।"
    },
    mr: {
      title: "हालेलूया संगीत",
      verse: [
        "\"ह्यानंतर स्वर्गात मोठ्या लोकसमुदायाच्या आवाजासारखी मोठी वाणी मी ऐकली; ती म्हणत होती, हालेलूया! तारण, गौरव व सामर्थ्य ही आमच्या देवाची आहेत … …",
        "ते पुन्हा म्हणाले, हालेलूया … …",
        "तेव्हा ते चोवीस वडील व ते चार प्राणी ह्यांनी पालथे पडून राजासनावर बसलेल्या देवाला नमन केले व म्हटले, आमेन, हालेलूया!",
        "तेव्हा राजासनापासून वाणी निघाली की, अहो देवाचे सर्व दासहो, लहानथोर तुम्ही जे त्याचे भय धरता ते सर्व त्याची स्तुती करा.",
        "मग मोठ्या लोकसमुदायाच्या आवाजासारखी, अनेक जलप्रवाहांच्या आवाजासारखी व मोठ्या मेघगर्जनांच्या आवाजासारखी वाणी मी ऐकली; ती म्हणत होती, हालेलूया! कारण आमचा देव सर्वसमर्थ प्रभू राज्य करीत आहे.",
        "आपण आनंद व उल्लास करू … कारण कोकऱ्याचे लग्न आले आहे आणि त्याच्या वधूने स्वतःला सजविले आहे.\""
      ],
      cite: "(प्रकटीकरण १९:१-७)",
      fellowship: "ख्रिस्त येशूमध्ये सर्व एक मंडळीची सहभागिता",
      tag: "~ वधूरूप, प्रेषितीय व संदेष्टात्मक ~",
      by: "ओडिशा शाखेद्वारे संकलित."
    },
    bn: {
      title: "হাল্লেলুইয়া সঙ্গীত",
      verse: [
        "\"এর পরে আমি স্বর্গে যেন বিস্তর লোকের মহারব শুনলাম, তারা বলছিল, হাল্লেলুইয়া; পরিত্রাণ, গৌরব ও পরাক্রম আমাদের ঈশ্বরেরই … …",
        "তারা দ্বিতীয়বার বলল, হাল্লেলুইয়া … …",
        "তখন সেই চব্বিশ জন প্রাচীন ও চারটি প্রাণী উবুড় হয়ে সিংহাসনে উপবিষ্ট ঈশ্বরকে প্রণাম করে বললেন, আমেন, হাল্লেলুইয়া!",
        "পরে সিংহাসন থেকে এক বাণী বের হল, হে আমাদের ঈশ্বরের দাসেরা, তোমরা যারা তাঁকে ভয় কর, ক্ষুদ্র কি মহান, সকলে তাঁর প্রশংসা কর।",
        "পরে আমি বিস্তর লোকের রবের মত, বহু জলের কল্লোলের মত এবং প্রবল মেঘগর্জনের মত এক রব শুনলাম, তারা বলছিল, হাল্লেলুইয়া; কারণ আমাদের সর্বশক্তিমান প্রভু ঈশ্বর রাজত্ব গ্রহণ করেছেন।",
        "এস, আমরা আনন্দ ও উল্লাস করি … কারণ মেষশাবকের বিবাহের সময় উপস্থিত, এবং তাঁর কনে নিজেকে প্রস্তুত করেছে।\""
      ],
      cite: "(প্রকাশিত বাক্য ১৯:১-৭)",
      fellowship: "খ্রীষ্ট যীশুতে সকলে এক মণ্ডলীর সহভাগিতা",
      tag: "~ বধূরূপী, প্রেরিতিক ও ভাববাদীয় ~",
      by: "ওড়িশা শাখা কর্তৃক সংকলিত।"
    }
  },

  songs: {
    /* ---------------- Telugu ---------------- */
    te: [
      {
        number: 1,
        title: "హల్లెలూయా స్తుతి",
        verses: [
          "హల్లెలూయా హల్లెలూయా\nప్రభువును స్తుతియించెదము\nఆయన కృప నిత్యముండును\nఆయన నామము ఘనపరచెదము"
        ],
        chorus: "హల్లెలూయా ఆమేన్\nహల్లెలూయా ఆమేన్"
      },
      {
        number: 2,
        title: "యేసు నా మంచి కాపరి",
        verses: [
          "యేసు నా మంచి కాపరి\nనాకు లేమి కలుగదు\nపచ్చికగల చోట్లలో\nప్రేమతో నన్ను నడిపించును",
          "గాఢాంధకార లోయలో\nనేను నడచినను\nనీవు నాతో నుండగా\nనేను భయపడను"
        ]
      },
      {
        number: 3,
        title: "దేవుని ప్రేమ",
        verses: [
          "దేవుడు లోకమును ఎంతో ప్రేమించెను\nతన కుమారుని మనకిచ్చెను\nఆయనను నమ్మువారెల్లరు\nనిత్యజీవము పొందుదురు"
        ]
      },
      {
        number: 4,
        title: "ఆరాధన",
        verses: [
          "ఆరాధన ఆరాధన\nయేసయ్యా నీకే ఆరాధన\nమహిమ ఘనత ప్రభావము\nనీకే చెల్లును ఎల్లప్పుడు"
        ]
      },
      {
        number: 5,
        title: "పరిశుద్ధుడు పరిశుద్ధుడు",
        verses: [
          "పరిశుద్ధుడు పరిశుద్ధుడు\nసర్వశక్తిగల దేవుడు\nఉన్నవాడు ఉండినవాడు\nరానైయున్నవాడు"
        ]
      }
    ],

    /* ---------------- Odia ---------------- */
    or: [
      {
        number: 1,
        title: "ହାଲ୍ଲିଲୂୟା ଗାଅ",
        verses: [
          "ହାଲ୍ଲିଲୂୟା ହାଲ୍ଲିଲୂୟା\nପ୍ରଭୁଙ୍କ ପ୍ରଶଂସା କର\nତାହାଙ୍କ ଦୟା ଅନନ୍ତକାଳସ୍ଥାୟୀ\nତାହାଙ୍କ ନାମ ଗୌରବାନ୍ୱିତ କର"
        ],
        chorus: "ଆମେନ୍ ହାଲ୍ଲିଲୂୟା\nଆମେନ୍ ହାଲ୍ଲିଲୂୟା"
      },
      {
        number: 2,
        title: "ଯୀଶୁ ମୋର ଉତ୍ତମ ମେଷପାଳକ",
        verses: [
          "ଯୀଶୁ ମୋର ଉତ୍ତମ ମେଷପାଳକ\nମୋର କିଛି ଅଭାବ ନାହିଁ\nସବୁଜ ଚରାସ୍ଥାନରେ ସେ\nପ୍ରେମରେ ମୋତେ ଚଳାନ୍ତି"
        ]
      },
      {
        number: 3,
        title: "ଈଶ୍ୱରଙ୍କ ପ୍ରେମ ମହାନ",
        verses: [
          "ଈଶ୍ୱର ଜଗତକୁ ଏତେ ପ୍ରେମ କଲେ\nଆପଣା ପୁତ୍ରଙ୍କୁ ଦାନ କଲେ\nଯେ ତାହାଙ୍କଠାରେ ବିଶ୍ୱାସ କରେ\nସେ ଅନନ୍ତ ଜୀବନ ପାଏ"
        ]
      },
      {
        number: 4,
        title: "ଆରାଧନା",
        verses: [
          "ଆରାଧନା ଆରାଧନା\nଯୀଶୁ ତୁମ୍ଭକୁ ଆରାଧନା\nଗୌରବ ସମ୍ମାନ ପରାକ୍ରମ\nସଦା ତୁମ୍ଭର ହେଉ"
        ]
      },
      {
        number: 5,
        title: "ପବିତ୍ର ପବିତ୍ର ପବିତ୍ର",
        verses: [
          "ପବିତ୍ର ପବିତ୍ର ପବିତ୍ର\nସର୍ବଶକ୍ତିମାନ୍ ପ୍ରଭୁ ପରମେଶ୍ୱର\nଯେ ଥିଲେ, ଯେ ଅଛନ୍ତି\nଓ ଯେ ଆସୁଅଛନ୍ତି"
        ]
      },
      {
        number: 6,
        title: "ପରିତ୍ରାଣ ଓ ଗୌରବ",
        verses: [
          "ପରିତ୍ରାଣ, ଗୌରବ ଓ ପରାକ୍ରମ\nଆମ୍ଭମାନଙ୍କ ଈଶ୍ୱରଙ୍କର\nମେଷଶାବକଙ୍କ ବିବାହର ସମୟ\nଆସ ଆନନ୍ଦ ଓ ଉଲ୍ଲାସ କରୁ"
        ],
        chorus: "ହାଲ୍ଲିଲୂୟା, ହାଲ୍ଲିଲୂୟା\nପ୍ରଭୁ ରାଜତ୍ୱ ଗ୍ରହଣ କରିଅଛନ୍ତି"
      }
    ],

    /* ---------------- English (public domain) ---------------- */
    en: [
      {
        number: 1,
        title: "Amazing Grace",
        author: "John Newton, 1779",
        verses: [
          "Amazing grace! how sweet the sound\nThat saved a wretch like me!\nI once was lost, but now am found,\nWas blind, but now I see.",
          "'Twas grace that taught my heart to fear,\nAnd grace my fears relieved;\nHow precious did that grace appear\nThe hour I first believed!",
          "Through many dangers, toils and snares,\nI have already come;\n'Tis grace hath brought me safe thus far,\nAnd grace will lead me home.",
          "When we've been there ten thousand years,\nBright shining as the sun,\nWe've no less days to sing God's praise\nThan when we'd first begun."
        ]
      },
      {
        number: 2,
        title: "Holy, Holy, Holy",
        author: "Reginald Heber, 1826",
        verses: [
          "Holy, holy, holy! Lord God Almighty!\nEarly in the morning our song shall rise to Thee;\nHoly, holy, holy! merciful and mighty!\nGod in three Persons, blessed Trinity!",
          "Holy, holy, holy! all the saints adore Thee,\nCasting down their golden crowns around the glassy sea;\nCherubim and seraphim falling down before Thee,\nWhich wert, and art, and evermore shalt be.",
          "Holy, holy, holy! Lord God Almighty!\nAll Thy works shall praise Thy name, in earth, and sky, and sea;\nHoly, holy, holy! merciful and mighty!\nGod in three Persons, blessed Trinity!"
        ]
      },
      {
        number: 3,
        title: "Blessed Assurance",
        author: "Fanny J. Crosby, 1873",
        verses: [
          "Blessed assurance, Jesus is mine!\nO what a foretaste of glory divine!\nHeir of salvation, purchase of God,\nBorn of His Spirit, washed in His blood.",
          "Perfect submission, perfect delight,\nVisions of rapture now burst on my sight;\nAngels descending bring from above\nEchoes of mercy, whispers of love.",
          "Perfect submission, all is at rest,\nI in my Saviour am happy and blest,\nWatching and waiting, looking above,\nFilled with His goodness, lost in His love."
        ],
        chorus: "This is my story, this is my song,\nPraising my Saviour all the day long;\nThis is my story, this is my song,\nPraising my Saviour all the day long."
      },
      {
        number: 4,
        title: "What a Friend We Have in Jesus",
        author: "Joseph M. Scriven, 1855",
        verses: [
          "What a friend we have in Jesus,\nAll our sins and griefs to bear!\nWhat a privilege to carry\nEverything to God in prayer!\nO what peace we often forfeit,\nO what needless pain we bear,\nAll because we do not carry\nEverything to God in prayer!",
          "Have we trials and temptations?\nIs there trouble anywhere?\nWe should never be discouraged;\nTake it to the Lord in prayer.\nCan we find a friend so faithful\nWho will all our sorrows share?\nJesus knows our every weakness;\nTake it to the Lord in prayer."
        ]
      },
      {
        number: 5,
        title: "It Is Well with My Soul",
        author: "Horatio G. Spafford, 1873",
        verses: [
          "When peace, like a river, attendeth my way,\nWhen sorrows like sea billows roll;\nWhatever my lot, Thou hast taught me to say,\nIt is well, it is well with my soul.",
          "Though Satan should buffet, though trials should come,\nLet this blest assurance control,\nThat Christ hath regarded my helpless estate,\nAnd hath shed His own blood for my soul.",
          "My sin, oh, the bliss of this glorious thought!\nMy sin, not in part but the whole,\nIs nailed to the cross, and I bear it no more,\nPraise the Lord, praise the Lord, O my soul!"
        ],
        chorus: "It is well with my soul,\nIt is well, it is well with my soul."
      },
      {
        number: 6,
        title: "Rock of Ages",
        author: "Augustus M. Toplady, 1763",
        verses: [
          "Rock of Ages, cleft for me,\nLet me hide myself in Thee;\nLet the water and the blood,\nFrom Thy wounded side which flowed,\nBe of sin the double cure,\nSave from wrath and make me pure.",
          "Not the labours of my hands\nCan fulfil Thy law's demands;\nCould my zeal no respite know,\nCould my tears for ever flow,\nAll for sin could not atone;\nThou must save, and Thou alone.",
          "Nothing in my hand I bring,\nSimply to Thy cross I cling;\nNaked, come to Thee for dress;\nHelpless, look to Thee for grace;\nFoul, I to the fountain fly;\nWash me, Saviour, or I die."
        ]
      },
      {
        number: 7,
        title: "To God Be the Glory",
        author: "Fanny J. Crosby, 1875",
        verses: [
          "To God be the glory, great things He hath done;\nSo loved He the world that He gave us His Son,\nWho yielded His life an atonement for sin,\nAnd opened the life-gate that all may go in.",
          "O perfect redemption, the purchase of blood,\nTo every believer the promise of God;\nThe vilest offender who truly believes,\nThat moment from Jesus a pardon receives."
        ],
        chorus: "Praise the Lord, praise the Lord,\nLet the earth hear His voice!\nPraise the Lord, praise the Lord,\nLet the people rejoice!\nO come to the Father, through Jesus the Son,\nAnd give Him the glory, great things He hath done."
      },
      {
        number: 8,
        title: "When I Survey the Wondrous Cross",
        author: "Isaac Watts, 1707",
        verses: [
          "When I survey the wondrous cross\nOn which the Prince of glory died,\nMy richest gain I count but loss,\nAnd pour contempt on all my pride.",
          "Forbid it, Lord, that I should boast,\nSave in the death of Christ my God!\nAll the vain things that charm me most,\nI sacrifice them to His blood.",
          "See from His head, His hands, His feet,\nSorrow and love flow mingled down!\nDid e'er such love and sorrow meet,\nOr thorns compose so rich a crown?",
          "Were the whole realm of nature mine,\nThat were a present far too small;\nLove so amazing, so divine,\nDemands my soul, my life, my all."
        ]
      },
      {
        number: 9,
        title: "All Hail the Power of Jesus' Name",
        author: "Edward Perronet, 1779",
        verses: [
          "All hail the power of Jesus' name!\nLet angels prostrate fall;\nBring forth the royal diadem,\nAnd crown Him Lord of all.",
          "Ye chosen seed of Israel's race,\nYe ransomed from the fall,\nHail Him who saves you by His grace,\nAnd crown Him Lord of all.",
          "Let every kindred, every tribe,\nOn this terrestrial ball,\nTo Him all majesty ascribe,\nAnd crown Him Lord of all."
        ]
      },
      {
        number: 10,
        title: "Jesus Loves Me",
        author: "Anna B. Warner, 1860",
        verses: [
          "Jesus loves me! This I know,\nFor the Bible tells me so;\nLittle ones to Him belong;\nThey are weak, but He is strong.",
          "Jesus loves me! He who died\nHeaven's gate to open wide;\nHe will wash away my sin,\nLet His little child come in."
        ],
        chorus: "Yes, Jesus loves me!\nYes, Jesus loves me!\nYes, Jesus loves me!\nThe Bible tells me so."
      },
      {
        number: 11,
        title: "Joyful, Joyful, We Adore Thee",
        author: "Henry van Dyke, 1907",
        verses: [
          "Joyful, joyful, we adore Thee,\nGod of glory, Lord of love;\nHearts unfold like flowers before Thee,\nOpening to the sun above.\nMelt the clouds of sin and sadness;\nDrive the dark of doubt away;\nGiver of immortal gladness,\nFill us with the light of day!"
        ]
      },
      {
        number: 12,
        title: "Hallelujah! What a Saviour",
        author: "Philip P. Bliss, 1875",
        verses: [
          "\"Man of Sorrows!\" what a name\nFor the Son of God, who came\nRuined sinners to reclaim!\nHallelujah! what a Saviour!",
          "Bearing shame and scoffing rude,\nIn my place condemned He stood;\nSealed my pardon with His blood:\nHallelujah! what a Saviour!",
          "Lifted up was He to die,\n\"It is finished!\" was His cry;\nNow in heaven exalted high:\nHallelujah! what a Saviour!"
        ]
      }
    ],

    /* ---------------- Hindi ---------------- */
    hi: [
      {
        number: 1,
        title: "हल्लेलूयाह गाओ",
        verses: [
          "हल्लेलूयाह हल्लेलूयाह\nप्रभु की स्तुति करो\nउसकी करुणा सदा की है\nउसके नाम की महिमा करो"
        ],
        chorus: "आमीन हल्लेलूयाह\nआमीन हल्लेलूयाह"
      },
      {
        number: 2,
        title: "यीशु मेरा अच्छा चरवाहा",
        verses: [
          "यीशु मेरा अच्छा चरवाहा\nमुझे कुछ घटी न होगी\nहरी-हरी चराइयों में\nवह प्रेम से मुझे ले चलता"
        ]
      },
      {
        number: 3,
        title: "परमेश्वर का प्रेम महान",
        verses: [
          "परमेश्वर ने जगत से ऐसा प्रेम किया\nअपना एकलौता पुत्र दे दिया\nजो कोई उस पर विश्वास करे\nवह अनन्त जीवन पाए"
        ]
      },
      {
        number: 4,
        title: "आराधना",
        verses: [
          "आराधना आराधना\nयीशु तेरी आराधना\nमहिमा आदर और सामर्थ\nसदा तेरा ही हो"
        ]
      },
      {
        number: 5,
        title: "पवित्र पवित्र पवित्र",
        verses: [
          "पवित्र, पवित्र, पवित्र\nसर्वशक्तिमान प्रभु परमेश्वर\nजो था, जो है\nऔर जो आनेवाला है"
        ]
      }
    ],

    /* ---------------- Marathi ---------------- */
    mr: [
      {
        number: 1,
        title: "हालेलूया गा",
        verses: [
          "हालेलूया हालेलूया\nप्रभूची स्तुती करा\nत्याची दया सर्वकाळ टिकते\nत्याच्या नावाचा गौरव करा"
        ],
        chorus: "आमेन हालेलूया\nआमेन हालेलूया"
      },
      {
        number: 2,
        title: "येशू माझा उत्तम मेंढपाळ",
        verses: [
          "येशू माझा उत्तम मेंढपाळ\nमला काही उणे पडणार नाही\nहिरव्या कुरणात तो मला\nप्रेमाने चालवितो"
        ]
      },
      {
        number: 3,
        title: "देवाची प्रीती महान",
        verses: [
          "देवाने जगावर एवढी प्रीती केली\nकी आपला एकुलता पुत्र दिला\nजो कोणी त्याच्यावर विश्वास ठेवतो\nत्याला सार्वकालिक जीवन मिळते"
        ]
      },
      {
        number: 4,
        title: "आराधना",
        verses: [
          "आराधना आराधना\nयेशू तुझी आराधना\nगौरव सन्मान सामर्थ्य\nसदैव तुझेच असो"
        ]
      },
      {
        number: 5,
        title: "पवित्र पवित्र पवित्र",
        verses: [
          "पवित्र, पवित्र, पवित्र\nसर्वसमर्थ प्रभू देव\nजो होता, जो आहे\nआणि जो येणार आहे"
        ]
      }
    ],

    /* ---------------- Bangla ---------------- */
    bn: [
      {
        number: 1,
        title: "হাল্লেলুইয়া গাও",
        verses: [
          "হাল্লেলুইয়া হাল্লেলুইয়া\nপ্রভুর প্রশংসা কর\nতাঁর দয়া চিরস্থায়ী\nতাঁর নামের গৌরব কর"
        ],
        chorus: "আমেন হাল্লেলুইয়া\nআমেন হাল্লেলুইয়া"
      },
      {
        number: 2,
        title: "যীশু আমার উত্তম মেষপালক",
        verses: [
          "যীশু আমার উত্তম মেষপালক\nআমার কোনো অভাব নেই\nসবুজ চারণভূমিতে তিনি\nভালবেসে আমায় চালান"
        ]
      },
      {
        number: 3,
        title: "ঈশ্বরের প্রেম মহান",
        verses: [
          "ঈশ্বর জগৎকে এত প্রেম করলেন\nতাঁর একমাত্র পুত্রকে দিলেন\nযে কেউ তাঁকে বিশ্বাস করে\nসে অনন্ত জীবন পায়"
        ]
      },
      {
        number: 4,
        title: "আরাধনা",
        verses: [
          "আরাধনা আরাধনা\nযীশু তোমার আরাধনা\nগৌরব সম্মান পরাক্রম\nচিরকাল তোমারই হোক"
        ]
      },
      {
        number: 5,
        title: "পবিত্র পবিত্র পবিত্র",
        verses: [
          "পবিত্র, পবিত্র, পবিত্র\nসর্বশক্তিমান প্রভু ঈশ্বর\nযিনি ছিলেন, যিনি আছেন\nএবং যিনি আসছেন"
        ]
      }
    ]
  }
};
