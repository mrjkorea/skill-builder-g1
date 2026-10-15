/**
 * Grammar, vocabulary, and reading items.
 * Sentences are hand-written. The engine shuffles choices and rejects a
 * distractor when a check says it is also correct.
 */
import {
  SIGHT_CLOZE,
  NOT_CONTRACTIONS,
  PRONOUN_CONTRACTIONS,
  IRREGULAR_PAST,
  IRREGULAR_PLURALS,
  BE_PRESENT,
  BE_PAST,
  HAVE_PRESENT,
  DAYS,
  MONTHS,
  NAMES,
} from "./content.mjs";

export function registerLanguage(on, h) {
  const { bank, ab, sort, order } = h;

  on("fam_capitalize_days_and_months", (e) => bank(e, [
    row("Which day of the week is written correctly?", "Monday", ["monday", "cat", "book"], "A day of the week starts with a capital letter."),
    row("Which month is written correctly?", "May", ["may", "dog", "run"], "A month starts with a capital letter."),
    row("Which day of the week is written correctly?", "Friday", ["friday", "sun", "hat"], "A day of the week starts with a capital letter."),
  ]));

  on("fam_capitalize_sentences_and_the_pronoun_i", (e) => bank(e, [
    row("Which word needs a capital letter in 'i like cats and dogs.'?", "i", ["like", "cats", "and"], "The pronoun I is always a capital letter."),
    row("Which word needs a capital letter to start 'the cat can run.'?", "the", ["cat", "can", "run"], "The first word of a sentence starts with a capital letter."),
    row("Which pronoun is always written as a capital letter?", "I", ["he", "she", "me"], "The pronoun I is always a capital letter."),
  ]));

  on("fam_capitalize_the_names_of_people_and_pets", (e) => bank(e, [
    row("Which name is written correctly?", "Sam", ["sam", "cat", "book"], "A person's name starts with a capital letter."),
    row("Which pet name is written correctly?", "Milo", ["milo", "dog", "ball"], "A pet's name starts with a capital letter."),
    row("Which name is written correctly?", "Ann", ["ann", "girl", "pen"], "A person's name starts with a capital letter."),
  ]));

  on("fam_choose_between_subject_and_object_person", (e) => bank(e, [
    row("Sam is a boy. The dog sees ___.", "him", ["he", "his", "they"], "Him is the object form for one boy."),
    row("Ann is a girl. Ann likes ___. The sentence is about the girl as the one who is seen: We see ___.", "her", ["she", "he", "they"], "Her is the object form for one girl."),
    row("I have a gift. Mom gives the gift to ___.", "me", ["I", "my", "we"], "Me is the object form for I."),
  ].map((r, i) => i === 1 ? row("We see Ann. We see ___.", "her", ["she", "he", "they"], "Her is the object form for one girl.") : r)));

  on("fam_choose_the_correct_personal_pronoun", (e) => bank(e, [
    row("Ann is a girl. ___ can run.", "She", ["He", "They", "It"], "She stands for one girl."),
    row("Sam is a boy. ___ can hop.", "He", ["She", "They", "It"], "He stands for one boy."),
    row("The children are playing. ___ are happy.", "They", ["He", "She", "It"], "They stands for more than one person."),
  ]));

  on("fam_choose_the_correct_possessive_pronoun", (e) => bank(e, [
    row("Which word shows that something belongs to me?", "my", ["me", "I", "run"], "My is a possessive pronoun."),
    row("The boy has a hat. It is ___ hat.", "his", ["he", "him", "they"], "His shows that the hat belongs to the boy."),
    row("We have a dog. It is ___ dog.", "our", ["we", "us", "they"], "Our shows that the dog belongs to us."),
  ]));

  on("fam_complete_the_sentence_with_the_correct_personal_", (e) => bank(e, [
    row("Mia is a girl. ___ likes cats.", "She", ["He", "They", "Him"], "She is the subject for one girl."),
    row("I see the boy. I see ___.", "him", ["he", "his", "we"], "Him is the object for one boy."),
    row("Tom and I play. ___ play.", "We", ["Us", "They", "Me"], "We is the subject when I am in the group."),
  ]));

  on("fam_use_the_correct_possessive_pronoun", (e) => bank(e, [
    row("I have a ball. It is ___ ball.", "my", ["me", "I", "he"], "My comes before the thing that belongs to me."),
    row("The girl has a cat. It is ___ cat.", "her", ["she", "him", "they"], "Her shows the cat belongs to the girl."),
    row("The children have a book. It is ___ book.", "their", ["they", "them", "his"], "Their shows the book belongs to more than one person."),
  ]));

  on("fam_choose_the_antonyms", (e) => bank(e, [
    row("Which word means the opposite of big?", "little", ["large", "huge", "tall"], "Little means the opposite of big."),
    row("Which word means the opposite of hot?", "cold", ["warm", "fast", "red"], "Cold means the opposite of hot."),
    row("Which word means the opposite of up?", "down", ["over", "high", "on"], "Down means the opposite of up."),
  ]));

  on("fam_choose_the_synonyms", (e) => bank(e, [
    row("Which word means the same as little?", "small", ["big", "sad", "fast"], "Small means the same as little."),
    row("Which word means the same as happy?", "glad", ["sad", "mad", "tired"], "Glad means the same as happy."),
    row("Which word means the same as begin?", "start", ["stop", "end", "sleep"], "Start means the same as begin."),
  ]));

  on("fam_choose_the_right_end_mark", (e) => bank(e, [
    row("This sentence tells something: The cat can run ___", ".", ["?", "!", ","], "A telling sentence ends with a period."),
    row("This sentence asks something: Where is the cat ___", "?", [".", "!", ","], "An asking sentence ends with a question mark."),
    row("This sentence shows a strong feeling: What a big dog ___", "!", [".", "?", ","], "A strong-feeling sentence can end with an exclamation mark."),
  ]));

  on("fam_compare_pictures_using_adjectives", (e) => ab(e, [
    row("Rex the dog is large. Pip the dog can fit in a lap. Which word tells about Pip?", "little", ["big"], "Little describes the smaller dog."),
    row("Ann's hat is the color of a ripe apple. Ben's hat is the color of the sky. Which word tells about Ann's hat?", "red", ["blue"], "Red describes Ann's hat."),
    row("This rock feels like a pillow. That rock feels like a brick. Which word tells about the pillow rock?", "soft", ["hard"], "Soft describes the pillow rock."),
  ]));

  on("fam_compare_pictures_using_comparative_and_super", (e) => ab(e, [
    row("There are two dogs. Rex's head is above Pip's head. Which word compares these two dogs?", "taller", ["tallest"], "Taller compares two."),
    row("There are three dogs. Rex is above the other two. Which word compares all three?", "tallest", ["taller"], "Tallest compares more than two."),
    row("There are two bags. This bag is not as large as that bag. Which word compares the two bags?", "smaller", ["smallest"], "Smaller compares two."),
  ]));

  on("fam_does_the_adjective_compare_two_or_more_than_", (e) => ab(e, [
    row("The word is bigger. Does it compare two or more than two?", "two", ["more than two"], "A word ending in -er compares two."),
    row("The word is tallest. Does it compare two or more than two?", "more than two", ["two"], "A word ending in -est compares more than two."),
    row("The word is fastest. Does it compare two or more than two?", "more than two", ["two"], "A word ending in -est compares more than two."),
  ]));

  on("fam_does_the_adjective_tell_you_what_kind_or_how", (e) => ab(e, [
    row("In 'three red hats,' the word three tells ___", "how many", ["what kind"], "Three tells how many."),
    row("In 'three red hats,' the word red tells ___", "what kind", ["how many"], "Red tells what kind."),
    row("In 'two small birds,' the word small tells ___", "what kind", ["how many"], "Small tells what kind."),
  ]));

  on("fam_find_the_complete_sentences", (e) => ab(e, [
    row("Which one is a complete sentence?", "The cat can run.", ["The cat"], "A sentence has a naming part and an action part."),
    row("Which one is a complete sentence?", "Birds can fly.", ["Can fly"], "A sentence names who and tells what they do."),
    row("Which one is a complete sentence?", "I see a dog.", ["A dog"], "A sentence is a complete thought."),
  ]));

  on("fam_identify_commands", (e) => ab(e, [
    row("Does this sentence tell you to do something? Sit down.", "yes", ["no"], "Sit down tells you to do something."),
    row("Does this sentence tell you to do something? The cat is big.", "no", ["yes"], "The cat is big tells about the cat. It does not give an order."),
    row("Does this sentence tell you to do something? Close the door.", "yes", ["no"], "Close the door tells you to do something."),
  ]));

  on("fam_identify_exclamations", (e) => ab(e, [
    row("Does this sentence show a strong feeling? What a big dog!", "yes", ["no"], "What a big dog! shows a strong feeling."),
    row("Does this sentence show a strong feeling? The dog is big.", "no", ["yes"], "The dog is big tells a fact in a calm way."),
    row("Does this sentence show a strong feeling? I love this book!", "yes", ["no"], "I love this book! shows a strong feeling."),
  ]));

  on("fam_identify_questions", (e) => ab(e, [
    row("Is this a question? Where is my hat?", "yes", ["no"], "It asks something and ends with a question mark."),
    row("Is this a question? My hat is on the bed.", "no", ["yes"], "It tells something. It does not ask."),
    row("Is this a question? Can you see the dog?", "yes", ["no"], "It asks something."),
  ]));

  on("fam_identify_statements", (e) => ab(e, [
    row("Is this a statement? The sun is hot.", "yes", ["no"], "It tells something."),
    row("Is this a statement? Is the sun hot?", "no", ["yes"], "It asks something, so it is not a statement."),
    row("Is this a statement? I have a red ball.", "yes", ["no"], "It tells something."),
  ]));

  on("fam_statement_question_command_or_exclamatio", (e) => bank(e, [
    row("What kind of sentence is this? The cat is soft.", "statement", ["question", "command", "exclamation"], "It tells something."),
    row("What kind of sentence is this? Where is the cat?", "question", ["statement", "command", "exclamation"], "It asks something."),
    row("What kind of sentence is this? Sit down.", "command", ["statement", "question", "exclamation"], "It tells you to do something."),
    row("What kind of sentence is this? What a soft cat!", "exclamation", ["statement", "question", "command"], "It shows a strong feeling."),
  ]));

  on("fam_identify_action_verbs", (e) => bank(e, [
    row("The cat can run. Which word is an action?", "run", ["cat", "the", "big"], "Run is something you do."),
    row("Birds fly in the sky. Which word is an action?", "fly", ["birds", "sky", "the"], "Fly is something birds do."),
    row("I jump and play. Which word is an action?", "jump", ["I", "and", "red"], "Jump is something you do."),
  ]));

  on("fam_use_action_verbs", (e) => bank(e, [
    row("The boy can ___.", "jump", ["blue", "three", "the"], "Jump is an action that fits."),
    row("A fish can ___.", "swim", ["purple", "seven", "hat"], "Swim is an action a fish can do."),
    row("We ___ at the park.", "play", ["green", "two", "desk"], "Play is an action."),
  ]));

  on("fam_complete_the_sentence_with_an_action_verb_to", (e) => bank(e, [
    row("The rabbit can ___.", "hop", ["red", "two", "hat"], "Hop is what a rabbit can do."),
    row("The bird can ___.", "fly", ["blue", "ten", "cup"], "Fly is what a bird can do."),
    row("The baby can ___.", "sleep", ["pink", "four", "map"], "Sleep is what a baby can do."),
  ]));

  on("fam_complete_the_sentence_with_the_best_subj", (e) => ab(e, [
    row("___ can fly.", "A bird", ["A rock"], "A bird can fly. A rock cannot."),
    row("___ can read a book.", "A child", ["A cup"], "A child can read. A cup cannot."),
    row("___ gives us milk.", "A cow", ["A pencil"], "A cow can give milk."),
  ]));

  on("fam_complete_the_sentence_with_the_best_verb", (e) => ab(e, [
    row("A fish can ___.", "swim", ["read"], "A fish can swim."),
    row("A baby can ___.", "cry", ["drive"], "A baby can cry."),
    row("A dog can ___.", "bark", ["fly to the moon"], "A dog can bark."),
  ]));

  on("fam_identify_adjectives", (e) => bank(e, [
    row("The dog is big. Which word describes the dog?", "big", ["dog", "is", "the"], "Big describes the dog."),
    row("I see a red ball. Which word describes the ball?", "red", ["ball", "see", "a"], "Red describes the ball."),
    row("The soup is hot. Which word describes the soup?", "hot", ["soup", "is", "the"], "Hot describes the soup."),
  ]));

  on("fam_identify_articles", (e) => bank(e, [
    row("The cat can run. Which word is a, an, or the?", "The", ["cat", "can", "run"], "The is an article."),
    row("I see a dog. Which word is a, an, or the?", "a", ["see", "dog", "I"], "A is an article."),
    row("She has an egg. Which word is a, an, or the?", "an", ["has", "egg", "She"], "An is an article."),
  ]));

  on("fam_identify_nouns_in_a_sentence", (e) => bank(e, [
    row("The girl can hop. Which word names a person?", "girl", ["hop", "can", "The"], "Girl names a person."),
    row("A bird can fly. Which word names an animal?", "bird", ["fly", "can", "A"], "Bird names an animal."),
    row("The book is red. Which word names a thing?", "book", ["red", "is", "The"], "Book names a thing."),
  ]));

  on("fam_select_the_nouns", (e) => bank(e, [
    row("Which word is a noun?", "school", ["run", "blue", "and"], "School names a place."),
    row("Which word is a noun?", "teacher", ["jump", "happy", "the"], "Teacher names a person."),
    row("Which word is a noun?", "apple", ["eat", "red", "fast"], "Apple names a thing."),
  ]));

  on("fam_identify_proper_nouns", (e) => bank(e, [
    row("Which word is a proper noun?", "Sam", ["boy", "dog", "school"], "Sam is a person's name."),
    row("Which word is a proper noun?", "Monday", ["day", "cat", "book"], "Monday is the name of a day."),
    row("Which word is a proper noun?", "May", ["month", "girl", "hat"], "May is the name of a month."),
  ]));

  on("fam_is_the_noun_a_person_animal_place_or_thi", (e) => bank(e, [
    row("A teacher is a ___.", "person", ["animal", "place", "thing"], "A teacher is a person."),
    row("A dog is an ___.", "animal", ["person", "place", "thing"], "A dog is an animal."),
    row("A school is a ___.", "place", ["person", "animal", "thing"], "A school is a place."),
    row("A book is a ___.", "thing", ["person", "animal", "place"], "A book is a thing."),
  ]));

  on("fam_is_it_the_naming_or_action_part_of_the_s", (e) => ab(e, [
    row("In 'The cat can run,' the words 'The cat' are the ___ part.", "naming", ["action"], "The cat names who."),
    row("In 'The cat can run,' the words 'can run' are the ___ part.", "action", ["naming"], "Can run tells what the cat does."),
    row("In 'Birds fly,' the word 'Birds' is the ___ part.", "naming", ["action"], "Birds names who."),
  ]));

  on("fam_sort_common_and_proper_nouns", (e) => {
    const bins = ["Common noun", "Proper noun"];
    const proper = new Set(["Sam", "Ann", "Monday", "Friday", "May", "Milo"]);
    const make = (words) => sort(e, "Sort each word.", bins, words.map((text) => ({
      text,
      bin: proper.has(text) ? "Proper noun" : "Common noun",
      check: (p) => (proper.has(p.text) ? "Proper noun" : "Common noun") === p.bin,
    })));
    return [make(["cat", "Sam", "dog", "Monday"]), make(["book", "Ann", "hat", "May"])].slice(0, e.n);
  });

  on("fam_one_or_more_than_one", (e) => ab(e, [
    row("The word is cats. Is it one or more than one?", "more than one", ["one"], "Cats means more than one cat."),
    row("The word is dog. Is it one or more than one?", "one", ["more than one"], "Dog means one dog."),
    row("The word is boxes. Is it one or more than one?", "more than one", ["one"], "Boxes means more than one box."),
  ]));

  on("fam_use_singular_and_plural_nouns", (e) => bank(e, [
    row("I see one dog. I see two ___.", "dogs", ["dog", "doges", "dog's"], "Add s to make dog mean more than one."),
    row("I see one box. I see two ___.", "boxes", ["box", "boxs", "box's"], "Add es after x."),
    row("I see one baby. I see two ___.", "babies", ["baby", "babys", "babyes"], "Change y to i and add es."),
  ]));

  on("fam_form_regular_plurals_with_s_and_es", (e) => ab(e, [
    row("Which word means more than one cat?", "cats", ["cates"], "Most nouns add s."),
    row("Which word means more than one dish?", "dishes", ["dishs"], "After sh, add es."),
    row("Which word means more than one book?", "books", ["bookes"], "Book adds s."),
  ]));

  on("fam_regular_plurals_select_the_word_that_matches", (e) => codePlurals(e, h));

  on("fam_irregular_plurals_select_the_word_that_match", (e) => bank(e, IRREGULAR_PLURALS.slice(0, 4).map(([one, many]) => (
    row(`More than one ${one} is ___.`, many, [`${one}s`, one, `${one}es`], `The plural of ${one} is ${many}.`)
  ))));

  on("fam_form_the_singular_possessive", (e) => bank(e, [
    row("The hat belongs to one girl. Which word shows that?", "girl's", ["girls", "girl", "girles"], "Girl's means the hat belongs to one girl."),
    row("The bone belongs to one dog. Which word shows that?", "dog's", ["dogs", "dog", "doges"], "Dog's means the bone belongs to one dog."),
    row("The book belongs to one boy. Which word shows that?", "boy's", ["boys", "boy", "boyes"], "Boy's means the book belongs to one boy."),
  ]));

  on("fam_select_the_possessive_noun_that_matches_the_", (e) => bank(e, [
    row("This hat belongs to one girl. Which word matches?", "girl's", ["girls", "girl", "girles"], "One girl owns the hat."),
    row("This bone belongs to one dog. Which word matches?", "dog's", ["dogs", "dog", "doges"], "One dog owns the bone."),
    row("This pen belongs to one teacher. Which word matches?", "teacher's", ["teachers", "teacher", "teacheres"], "One teacher owns the pen."),
  ]));

  on("fam_form_contractions_with_not", (e) => contractionBank(e, h, NOT_CONTRACTIONS, "not"));
  on("fam_form_pronoun_verb_contractions", (e) => contractionBank(e, h, PRONOUN_CONTRACTIONS, "pronoun"));
  on("fam_match_the_contractions", (e) => bank(e, [
    row("I'm means ___.", "I am", ["I not", "I my", "I and"], "I'm stands for I am."),
    row("don't means ___.", "do not", ["do now", "do on", "do to"], "Don't stands for do not."),
    row("it's means ___.", "it is", ["it not", "it my", "it and"], "It's stands for it is."),
  ]));
  on("fam_complete_the_sentence_with_the_correct_c", (e) => bank(e, [
    row("I am tall. The short way to say I am is ___.", "I'm", ["I'am", "Im", "Iam"], "I'm means I am."),
    row("Do not run. The short way to say do not is ___.", "don't", ["do'nt", "dont", "do't"], "Don't means do not."),
    row("She is kind. Which short word means she is?", "she's", ["she'is", "shes", "she'es"], "She's means she is."),
  ]));

  on("fam_to_be_use_the_correct_form", (e) => beRows(e, h, [
    ["Today I ___ happy.", "am", "I", "present"],
    ["Yesterday I ___ happy.", "was", "I", "past"],
    ["Today they ___ happy.", "are", "they", "present"],
  ]));
  on("fam_to_be_use_the_correct_present_tense_form", (e) => beRows(e, h, [
    ["Today the boy ___ here.", "is", "he", "present"],
    ["Today the dogs ___ here.", "are", "they", "present"],
    ["Today I ___ here.", "am", "I", "present"],
  ]));
  on("fam_to_be_use_the_correct_past_tense_form", (e) => beRows(e, h, [
    ["Yesterday the boy ___ here.", "was", "he", "past"],
    ["Yesterday the dogs ___ here.", "were", "they", "past"],
    ["Yesterday I ___ here.", "was", "I", "past"],
  ]));
  on("fam_to_have_use_the_correct_form", (e) => bank(e, [
    row("Today the girl ___ a book.", "has", ["have", "had", "having"], "One girl uses has."),
    row("Today the girls ___ a book.", "have", ["has", "haves", "had"], "More than one girl uses have."),
    row("I ___ a pencil today.", "have", ["has", "haves", "had"], "I uses have."),
  ]));

  on("fam_form_and_use_the_regular_past_tense", (e) => ab(e, [
    row("Which sentence tells about yesterday?", "The dog jumped.", ["The dog jumps."], "Jumped tells about the past."),
    row("Yesterday we ___.", "played", ["play"], "Played is the past of play."),
    row("Which word tells about yesterday?", "walked", ["walk"], "Walked tells about the past."),
  ]));

  on("fam_complete_the_verb_with_the_ending_that_you_h", (e) => bank(e, [
    row("Yesterday, walk ___. Which ending?", "ed", ["ing", "s", "es"], "Yesterday needs -ed."),
    row("Right now I am walk ___. Which ending?", "ing", ["ed", "s", "es"], "Am + verb needs -ing."),
    row("Every day she walk ___ to school. Which ending?", "s", ["ed", "ing", "es"], "She walks. Add s."),
  ]));

  on("fam_match_the_ed_and_ing_sentences_to_the_pictur", (e) => ab(e, [
    row("Which sentence tells what the boy is doing now?", "The boy is jumping.", ["The boy jumped."], "Is jumping tells about now."),
    row("Which sentence tells what already happened?", "The girl kicked the ball.", ["The girl is kicking the ball."], "Kicked tells about the past."),
    row("Which sentence tells about now?", "The dog is eating.", ["The dog ate."], "Is eating tells about now."),
  ]));

  on("fam_identify_the_irregular_past_tense", (e) => bank(e, IRREGULAR_PAST.slice(0, 4).map(([now, past]) => (
    row(`Which word is the past of ${now}?`, past, [`${now}ed`, `${now}ing`, `${now}s`], `The past of ${now} is ${past}.`)
  ))));

  on("fam_place_sentences_on_a_timeline", (e) => bank(e, [
    row("Which sentence tells about yesterday?", "I walked to school.", ["I walk to school every day.", "I will walk to school.", "I am walking now."], "Walked tells about the past."),
    row("Which sentence tells about tomorrow?", "I will see Grandma.", ["I see Grandma now.", "I saw Grandma yesterday.", "I am with Grandma now."], "Will tells about the future."),
    row("Which sentence tells about right now?", "I am reading a book.", ["I read a book yesterday.", "I will read a book tomorrow.", "I read books last year."], "Am reading tells about now."),
  ]));

  on("fam_place_sentences_with_irregular_verbs_on_a_ti", (e) => bank(e, [
    row("Which sentence tells about yesterday?", "I went home.", ["I go home.", "I will go home.", "I am going home."], "Went is the past of go."),
    row("Which sentence tells about yesterday?", "She saw a bird.", ["She sees a bird.", "She will see a bird.", "She is seeing a bird."], "Saw is the past of see."),
    row("Which sentence tells about tomorrow?", "We will eat lunch.", ["We eat lunch.", "We ate lunch.", "We are eating lunch."], "Will eat tells about the future."),
  ]));

  on("fam_sentence_tells_future", (e) => ab(e, [
    row("Which sentence tells about the future?", "I will play tomorrow.", ["I play every day."], "Will tells about the future."),
    row("Which sentence tells about the future?", "She is going to read.", ["She read yesterday."], "Going to tells about the future."),
  ]));
  on("fam_sentence_tells_past", (e) => ab(e, [
    row("Which sentence tells about the past?", "I walked yesterday.", ["I walk every day."], "Yesterday and walked tell about the past."),
    row("Which sentence tells about the past?", "He ate an apple.", ["He will eat an apple."], "Ate tells about the past."),
  ]));
  on("fam_sentence_tells_present", (e) => ab(e, [
    row("Which sentence tells about the present?", "I am reading now.", ["I will read tomorrow."], "Now and am reading tell about the present."),
    row("Which sentence tells about the present?", "The sun is hot today.", ["The sun was hot yesterday."], "Today and is tell about the present."),
  ]));

  on("fam_pronoun_verb_agreement_complete_the_sentence", (e) => ab(e, [
    row("___ runs fast.", "He", ["They"], "He goes with runs."),
    row("___ run fast.", "They", ["He"], "They goes with run."),
    row("___ is little.", "She", ["We"], "She goes with is."),
  ]));
  on("fam_pronoun_verb_agreement_complete_the_sentence_2", (e) => ab(e, [
    row("He ___ fast.", "runs", ["run"], "He uses runs."),
    row("They ___ fast.", "run", ["runs"], "They uses run."),
    row("She ___ happy.", "is", ["are"], "She uses is."),
  ]));

  on("fam_identify_comparative_and_superlative_adjecti", (e) => bank(e, [
    row("Which word compares two things?", "bigger", ["big", "biggest", "blue"], "Bigger compares two."),
    row("Which word compares more than two things?", "smallest", ["small", "smaller", "red"], "Smallest compares more than two."),
    row("Which word compares two cats?", "taller", ["tall", "tallest", "soft"], "Taller compares two."),
  ]));

  on("fam_identify_time_order_words", (e) => bank(e, [
    row("Which word means before the others?", "first", ["cat", "blue", "run"], "First tells the order."),
    row("Which word means after that?", "then", ["hat", "red", "jump"], "Then tells the order."),
    row("Which word means at the end?", "last", ["cup", "big", "sit"], "Last tells the order."),
  ]));

  on("fam_use_conjunctions", (e) => bank(e, [
    row("I see a cat ___ a dog.", "and", ["but", "so", "because"], "And joins two things you see."),
    row("I want to play, ___ my bike is broken.", "but", ["or", "so", "if"], "But shows a problem that gets in the way."),
    row("We were cold, ___ we put on coats.", "so", ["or", "but", "if"], "So shows what happened because we were cold."),
  ]));

  on("fam_select_the_best_preposition_to_complete_the_", (e) => bank(e, [
    row("The book sits on top of the desk. The book is ___ the desk.", "on", ["under", "for", "of"], "On tells that the book is on top."),
    row("The cat is hiding below the bed. The cat is ___ the bed.", "under", ["on", "for", "at"], "Under tells that the cat is below the bed."),
    row("The bird is inside the cage. The bird is ___ the cage.", "in", ["under", "for", "of"], "In tells that the bird is inside."),
  ]));
  on("fam_select_the_best_preposition_to_match_the_pic", (e) => bank(e, [
    row("A picture shows a cat sitting on a box. The cat is ___ the box.", "on", ["under", "for", "of"], "On matches a cat on a box."),
    row("A picture shows a ball below a chair. The ball is ___ the chair.", "under", ["on", "for", "at"], "Under matches a ball below a chair."),
    row("A picture shows milk inside a cup. The milk is ___ the cup.", "in", ["under", "for", "of"], "In matches milk inside a cup."),
  ]));

  on("fam_use_the_correct_article_a_or_an", (e) => articleRows(e, h));

  on("fam_use_sense_words", (e) => bank(e, [
    row("I use my eyes to ___.", "see", ["hear", "smell", "taste"], "Eyes see."),
    row("I use my ears to ___.", "hear", ["see", "taste", "touch"], "Ears hear."),
    row("I use my nose to ___.", "smell", ["hear", "see", "taste"], "A nose smells."),
    row("I use my hands to ___.", "touch", ["hear", "smell", "see"], "Hands touch."),
  ]));

  on("fam_use_number_words", (e) => bank(e, [
    row("How many legs does a dog have?", "four", ["two", "ten", "one"], "A dog has four legs."),
    row("How many eyes do you have?", "two", ["five", "ten", "seven"], "A person has two eyes."),
    row("How many days are in a week?", "seven", ["two", "three", "ten"], "A week has seven days."),
  ]));

  on("fam_complete_the_sentence", (e) => bank(e, [
    row("The sun is ___.", "hot", ["run", "and", "the"], "Hot tells about the sun."),
    row("The baby can ___.", "sleep", ["blue", "three", "hat"], "Sleep is what a baby can do."),
    row("I see a ___.", "bird", ["run", "and", "very"], "Bird is something you can see."),
  ]));

  on("fam_complete_the_sentence_with_a_noun_to_match_t", (e) => bank(e, [
    row("Which word names an animal that says woof?", "dog", ["run", "blue", "happy"], "Dog names that animal."),
    row("Which word names something you read?", "book", ["jump", "red", "fast"], "Book names that thing."),
    row("Which word names a place where children learn?", "school", ["swim", "soft", "two"], "School names that place."),
  ]));

  on("fam_describe_the_difference_between_related_word", (e) => ab(e, [
    row("A young pet that says meow grows up. Which word is the young pet?", "kitten", ["cat"], "Kitten is the baby."),
    row("A pet that says woof grows up. Which word is the grown pet?", "dog", ["puppy"], "Dog is the grown animal."),
    row("The bright start of the day comes before the dark time. Which word is that bright start?", "morning", ["night"], "Morning is the start of the day."),
  ]));

  on("fam_find_the_words_with_related_meanings", (e) => bank(e, [
    row("Which word goes with cat?", "kitten", ["truck", "pencil", "cloud"], "A kitten is a young cat."),
    row("Which word goes with day?", "night", ["spoon", "truck", "pencil"], "Night is the other part of a day."),
    row("Which word goes with hot?", "cold", ["book", "shoe", "tree"], "Cold goes with hot."),
  ]));

  on("fam_which_word_is_not_like_the_others", (e) => bank(e, [
    row("Which word is not an animal?", "cup", ["cat", "dog", "pig"], "Cup is a thing. The others are animals."),
    row("Which word is not a food?", "desk", ["jam", "egg", "apple"], "Desk is furniture. The others are foods."),
    row("Which word is not a color?", "jump", ["red", "blue", "yellow"], "Jump is an action. The others are colors."),
  ], 4));

  on("fam_order_related_words_based_on_meaning", (e) => {
    const sets = [
      ["Put these in order from cold to hot.", ["cold", "warm", "hot"]],
      ["Put these in order from baby to grown.", ["baby", "child", "adult"]],
      ["Put these in time order.", ["morning", "noon", "night"]],
    ];
    return sets.slice(0, e.n).map(([q, ordered]) => order(e, q, ordered));
  });

  on("fam_put_the_letters_in_abc_order", (e) => {
    const sets = [["b", "d", "a", "c"], ["m", "h", "e", "s"], ["f", "a", "t", "p"]];
    return sets.slice(0, e.n).map((letters) => order(e, "Put the letters in ABC order.", [...letters].sort()));
  });

  on("fam_put_the_words_in_abc_order", (e) => {
    const sets = [["sun", "ant", "dog", "cup"], ["pig", "man", "bed", "hat"], ["web", "jam", "fin", "nut"]];
    return sets.slice(0, e.n).map((words) => order(e, "Put the words in ABC order.", [...words].sort()));
  });

  on("fam_unscramble_the_words_to_make_a_complete_", (e) => {
    const sets = [
      ["The", "cat", "can", "run."],
      ["I", "see", "a", "dog."],
      ["Birds", "can", "fly."],
    ];
    return sets.slice(0, e.n).map((ordered) => order(e, "Put the words in order to make a sentence.", ordered));
  });

  on("fam_put_the_sentences_in_order", (e) => {
    const sets = [
      ["Put the sentences in time order.", ["Ben got out of bed.", "Ben ate breakfast.", "Ben walked to school."]],
      ["Put the sentences in time order.", ["Mia got a book.", "Mia opened the book.", "Mia read the book."]],
    ];
    return sets.slice(0, e.n).map(([q, ordered]) => order(e, q, ordered));
  });

  on("fam_determine_the_order_of_events_in_information", (e) => {
    const sets = [
      ["Put the steps in order.", ["Get your hands wet.", "Rub on some soap.", "Rinse the soap off."]],
      ["Put the steps in order.", ["Put a seed in a pot.", "Water the seed.", "Watch a plant grow."]],
    ];
    return sets.slice(0, e.n).map(([q, ordered]) => order(e, q, ordered));
  });

  on("fam_sort_words_into_categories", (e) => {
    const jobs = [
      [["cat", "dog", "jam", "egg"], { cat: "Animal", dog: "Animal", jam: "Food", egg: "Food" }, ["Animal", "Food"]],
      [["red", "blue", "pen", "book"], { red: "Color", blue: "Color", pen: "School", book: "School" }, ["Color", "School"]],
    ];
    return jobs.slice(0, e.n).map(([words, map, bins]) => sort(e, "Sort each word.", bins, words.map((text) => ({
      text,
      bin: map[text],
      check: (p) => map[p.text] === p.bin,
    }))));
  });

  on("fam_choose_the_picture_that_matches_the_descript", (e) => bank(e, [
    row("The sentence is: A big red ball is on the bed. Which one matches?", "a big red ball on a bed", ["a little cat in a box", "two birds in a tree", "a boy kicking a can"], "The picture must show a big red ball on a bed."),
    row("The sentence is: Two birds sit in a green tree. Which one matches?", "two birds in a green tree", ["one fish in a bowl", "a red ball on a bed", "a dog under a chair"], "The picture must show two birds in a green tree."),
    row("The sentence is: A small dog is under a chair. Which one matches?", "a small dog under a chair", ["a dog on a chair", "a cat under a bed", "a bird in a tree"], "The picture must show a small dog under a chair."),
  ]));

  on("fam_choose_the_picture_that_matches_the_setting_", (e) => bank(e, [
    row("The story is at a school. The person is a teacher. Which one matches?", "a teacher in a school", ["a farmer on a farm", "a fish in the sea", "a bird in a nest"], "The picture needs a teacher and a school."),
    row("The story is on a farm. The person is a farmer. Which one matches?", "a farmer with farm animals", ["a teacher in a classroom", "a child in a library", "a fish in a bowl"], "The picture needs a farmer and a farm."),
    row("The story is at a park. The person is a child. Which one matches?", "a child playing at a park", ["a farmer in a barn", "a teacher at a desk", "a cat in a house"], "The picture needs a child and a park."),
  ]));

  on("fam_use_actions_and_dialogue_to_understand_chara", (e) => bank(e, [
    row("Ana says, \"You can have my cookie.\" What is Ana like?", "kind", ["mean", "sleepy", "scared"], "Sharing shows that Ana is kind."),
    row("Ben says, \"I am not tall, but I will try.\" What is Ben like?", "brave", ["mean", "a chair", "a number"], "Trying shows that Ben is brave."),
    row("The puppy hides and shakes when the door bangs. How does the puppy feel?", "scared", ["proud", "hungry", "bored"], "Hiding and shaking show fear."),
  ]));

  on("fam_use_context_to_identify_the_meaning_of_a_wor", (e) => bank(e, [
    row("The puppy is tiny. It fits in one hand. Tiny means ___.", "very small", ["very big", "very loud", "very old"], "Fits in one hand tells you tiny means very small."),
    row("The path is damp. Water sits on it after the rain. Damp means ___.", "a little wet", ["very dry", "very hot", "very tall"], "Water on the path tells you damp means a little wet."),
    row("Mom will mend the rip in my coat. Mend means ___.", "fix", ["eat", "hide", "throw"], "A rip in a coat is something you fix."),
  ]));

  on("fam_use_text_features", (e) => bank(e, [
    row("The name of a book is called the ___.", "title", ["clock", "puppy", "seven"], "The title is the name of a book."),
    row("Words under a picture are called a ___.", "caption", ["shoe", "drum", "nap"], "A caption tells about a picture."),
    row("A big line that starts a part of a book is a ___.", "heading", ["sandwich", "pencil", "moon"], "A heading starts a part."),
  ]));

  on("fam_what_am_i", (e) => bank(e, [
    row("I am an animal. I say moo. I give milk. What am I?", "a cow", ["a pig", "a fish", "a bird"], "A cow says moo and gives milk."),
    row("I am a place. Children learn there. What am I?", "a school", ["a bed", "a spoon", "a cloud"], "Children learn at school."),
    row("I am in the sky in the day. I am bright and warm. What am I?", "the sun", ["the moon", "a fish", "a book"], "The sun is bright in the day."),
  ]));

  on("fam_what_will_happen_next", (e) => bank(e, [
    row("Sam drops a glass cup on the hard floor. What will happen next?", "The cup will break.", ["The cup will sing.", "The cup will drive a bus.", "The cup will become a cat."], "A glass cup breaks when it hits a hard floor."),
    row("Ben plants a seed and waters it every day. What will happen next?", "A plant will start to grow.", ["The seed will bark.", "The seed will read a book.", "The seed will turn into a hat."], "A watered seed can grow into a plant."),
    row("Dark clouds fill the sky. What will happen next?", "It will rain.", ["The sky will bake a cake.", "The clouds will sing.", "It will snow hot soup."], "Dark clouds often bring rain."),
  ]));

  on("fam_which_could_happen_in_real_life", (e) => ab(e, [
    row("A fish can swim. Is this real or make-believe?", "real", ["make-believe"], "Fish really can swim."),
    row("A dog can talk on the phone. Is this real or make-believe?", "make-believe", ["real"], "Dogs cannot talk on the phone."),
    row("A bird can fly. Is this real or make-believe?", "real", ["make-believe"], "Birds really can fly."),
  ]));

  on("fam_which_feeling_matches_the_picture", (e) => bank(e, [
    row("Mia lost her dog. She is crying. Which feeling matches?", "sad", ["happy", "proud", "excited"], "Crying after a loss matches sad."),
    row("Ana got a new puppy. She is smiling. Which feeling matches?", "happy", ["sad", "scared", "angry"], "A smile and a new puppy match happy."),
    row("A loud dog barks. Ben hides under the bed. Which feeling matches?", "scared", ["happy", "proud", "bored"], "Hiding from a loud bark matches scared."),
  ]));

  on("fam_multiple_meaning_words_with_pictures", (e) => bank(e, [
    row("Bat can mean a flying animal. Which other meaning can bat have?", "a stick used to hit a baseball", ["a red fruit", "a day of the week", "a baby cat"], "Bat is also a baseball stick."),
    row("Park can mean a grassy place to play. Which other meaning can park have?", "to stop a car and leave it", ["to bake a cake", "to be a color", "to be a number"], "Park also means to leave a car."),
    row("Duck can mean a bird that says quack. Which other meaning can duck have?", "to bend down quickly", ["to be a fruit", "to be a month", "to be a hat"], "Duck also means to bend down."),
  ]));

  on("fam_understand_words_with_prefixes_and_suffixes", (e) => bank(e, [
    row("The prefix un- means not. What does unhappy mean?", "not happy", ["very happy", "happy again", "a little happy"], "Unhappy means not happy."),
    row("The prefix re- means again. What does redo mean?", "do again", ["not do", "do later", "do nothing"], "Redo means do again."),
    row("The suffix -s can mean more than one. What does cats mean?", "more than one cat", ["one cat", "no cat", "a cat's toy"], "Cats means more than one cat."),
  ]));

  on("fam_use_words_with_prefixes_and_suffixes", (e) => bank(e, [
    row("She is not happy. She is ___.", "unhappy", ["replay", "cats", "jumping"], "Unhappy means not happy."),
    row("Please play the song one more time. Please ___ the song.", "replay", ["unhappy", "cats", "smallest"], "Replay means play again."),
    row("The boy is in the middle of a jump. He is ___.", "jumping", ["unhappy", "replay", "redo"], "Jumping tells what he is doing now."),
  ]));

  on("fam_who_what_when_where_or_why", (e) => bank(e, [
    row("Which word asks about a person?", "who", ["what", "when", "where"], "Who asks about a person."),
    row("Which word asks about a place?", "where", ["who", "when", "why"], "Where asks about a place."),
    row("Which word asks about time?", "when", ["who", "what", "where"], "When asks about time."),
    row("___ is your name?", "What", ["Who", "Where", "When"], "What is your name? is the question that fits."),
  ]));

  on("fam_complete_the_sentence_with_the_correct_p", (e) => bank(e, [
    row("The girl has a book. ___ can read.", "She", ["He", "They", "It"], "She matches one girl."),
    row("Give the ball to the boy. Give it to ___.", "him", ["he", "she", "we"], "Him is the object for the boy."),
    row("This is my hat. The hat is ___.", "mine", ["me", "I", "my"], "Mine means it belongs to me, with no noun after it."),
  ]));

  // Silence unused import warnings by referencing lists in facts only.
  void SIGHT_CLOZE;
  void DAYS;
  void MONTHS;
  void NAMES;
  void HAVE_PRESENT;
}

function row(q, correct, bad, claim) {
  return { q, correct, bad, claim, test: (c) => c === correct };
}

function contractionBank(env, h, pairs, kind) {
  const rows = pairs.map(([full, short, bads]) => {
    const key = short.toLowerCase();
    if (!h.dictHas(key)) {
      throw new Error(`contraction ${short} missing from CMUdict`);
    }
    for (const b of bads) {
      if (h.dictHas(b.toLowerCase())) throw new Error(`bad contraction ${b} is in CMUdict`);
    }
    return {
      q: `Which short word means "${full}"?`,
      correct: short,
      bad: bads,
      claim: `${full} = ${short} (${kind} contraction)`,
      test: (c) => c.toLowerCase() === key && h.dictHas(key),
    };
  });
  return h.bank(env, rows, 4);
}

function beRows(env, h, specs) {
  const rows = specs.map(([q, expect, who, tense]) => {
    const table = tense === "past" ? BE_PAST : BE_PRESENT;
    const right = table[who];
    if (right !== expect) throw new Error(`be mismatch ${q}`);
    const bad = ["am", "is", "are", "was", "were"].filter((x) => x !== right);
    return {
      q,
      correct: right,
      bad,
      claim: `${who} ${tense} be = ${right}`,
      test: (c) => c === right,
    };
  });
  return h.bank(env, rows, 4);
}

function codePlurals(env, h) {
  const words = ["cat", "box", "dish", "bus", "glass", "dog"];
  const rows = [];
  for (const w of words) {
    const got = h.plural(w);
    if (!got.ok) continue;
    const wrong = [`${w}s`, `${w}es`, w, `${w}'s`].filter((x) => x !== got.plural);
    rows.push({
      q: `More than one ${w} is ___.`,
      correct: got.plural,
      bad: wrong.slice(0, 3),
      claim: `regular plural of ${w} is ${got.plural}`,
      test: (c) => c === got.plural,
    });
  }
  return h.bank(env, rows, 4);
}

function articleRows(env, h) {
  const words = ["apple", "cat", "egg", "dog", "umbrella", "book"];
  const rows = [];
  for (const w of words) {
    const art = h.article(w);
    if (!art) continue;
    const other = art === "a" ? "an" : "a";
    rows.push({
      q: `I see ___ ${w}.`,
      correct: art,
      bad: [other],
      claim: `${art} ${w} (first sound ${h.firstPhone(w)})`,
      test: (c) => c === h.article(w),
      n: 2,
    });
  }
  return h.bank(env, rows, 2);
}
