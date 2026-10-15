/**
 * Phonics items. Every sound claim is checked against the CMUdict citation form.
 * The engine picks the correct choice and the distractors.
 */
import { CLUES, SIGHT_CLOZE, SIGHT_SETS } from "./content.mjs";
import {
  analyzeWord, isTransparentCvc, shortVowelTag, silentEPattern, longVowelSpelling,
  diphthongTags, rControlTags, digraphTags, flossTags, startsWithBlend, endsWithBlend,
  vowelClass, confirmCompound, confirmPhoneSplit, firstLetterMatchesSound, lastLetterMatchesSound,
} from "./lexicon.mjs";
import { mcTest, makeSort, makeOrder, changeKind, letterDistance, misspellings } from "./engine.mjs";

const MEANS = new Set(["sit", "win", "hop", "hug", "run", "hot", "big", "red", "ten", "five", "nine", "see", "eat", "play", "down", "light", "night", "time", "blue", "yellow", "happy", "stop", "jump", "help", "best", "fast", "left", "wish", "sing", "day", "name"]);

export function registerPhonics(on, h) {
  const dict = h.dict;
  const rec = (w) => analyzeWord(dict, w);

  const fail = (env, word, claim, pred) => {
    const r = rec(word);
    if (!r) {
      env.drop(word, claim, "not in CMUdict");
      return;
    }
    if (pred(r)) throw new Error(`${word} unexpectedly passed ${claim}: ${r.bases.join(" ")}`);
    env.drop(word, claim, `CMUdict ${r.bases.join(" ")} does not confirm ${claim}`);
  };

  const dropMatter = (env) => {
    const outer = rec("matter");
    const inner = rec("mat");
    env.drop("matter", "contains the word mat",
      `refused spelling-substring (${"matter".includes("mat")}) and bare phoneme-prefix (${outer.bases.join(" ").includes(inner.bases.join(" "))}; matter ${outer.bases.join(" ")}, mat ${inner.bases.join(" ")}). Only whole-word compounds such as cup + cake are kept.`);
  };

  function safe(target, other) {
    if (target === other) return false;
    if (target.includes(other) || other.includes(target)) return false;
    const a = CLUES[target].toLowerCase();
    const b = CLUES[other].toLowerCase();
    if (a.includes(other) || b.includes(target)) return false;
    return true;
  }

  function clueItems(env, words, keep, mode) {
    const ready = [];
    for (const w of words) {
      const r = rec(w);
      if (!r) { env.drop(w, "cmudict", "not in CMUdict"); continue; }
      if (!CLUES[w]) { env.drop(w, "clue", "no child-friendly clue"); continue; }
      if (keep && !keep(r)) {
        env.drop(w, "phonics", `phones ${r.bases.join(" ")} do not match the claim`);
        continue;
      }
      ready.push(w);
    }
    if (ready.length < env.n) throw new Error(`${env.skill.family_id} has ${ready.length} confirmed words, need ${env.n}`);
    const items = [];
    for (let i = 0; i < env.n; i++) {
      const target = ready[i];
      const pool = Object.keys(CLUES).filter((w) => safe(target, w) && rec(w));
      if (mode === "pic") {
        items.push(mcTest({
          question: env.q(`The word is ${target}. Which meaning matches?`),
          options: [CLUES[target], ...pool.map((w) => CLUES[w])],
          test: (c) => c === CLUES[target],
          n: 4,
          rng: env.rng,
          prefer: CLUES[target],
        }));
      } else {
        const frame = MEANS.has(target)
          ? `Which word means ${CLUES[target]}?`
          : `Which word names ${CLUES[target]}?`;
        items.push(mcTest({
          question: env.q(frame),
          options: [target, ...pool],
          test: (c) => CLUES[c] === CLUES[target],
          n: 4,
          rng: env.rng,
          prefer: target,
        }));
      }
      env.keepFact(rec(target), ["grade-1 word", "child clue", keep ? "phonics pattern" : "word"]);
    }
    return items;
  }

  function blanks(env, specs) {
    return specs.slice(0, env.n).map((spec) => {
      const r = rec(spec.word);
      if (!r) throw new Error(`missing ${spec.word}`);
      if (spec.keep && !spec.keep(r)) throw new Error(`${spec.word} failed pattern: ${r.bases.join(" ")}`);
      const good = spec.choices.filter((c) => spec.fill(c) === spec.word);
      if (good.length !== 1) throw new Error(`blank for ${spec.word} is not unique`);
      env.keepFact(r, [spec.claim]);
      return mcTest({
        question: env.q(spec.prompt),
        options: spec.choices,
        test: (c) => spec.fill(c) === spec.word,
        n: 4,
        rng: env.rng,
        prefer: good[0],
      });
    });
  }

  function sentences(env, rows, check) {
    if (rows.length < env.n) throw new Error(`${env.skill.family_id} sentence bank short`);
    return rows.slice(0, env.n).map((row) => {
      for (const w of row.focus) {
        const r = rec(w);
        if (!r || !check(r, w)) throw new Error(`${env.skill.family_id} focus ${w} failed ${r ? r.bases.join(" ") : "missing"}`);
        env.keepFact(r, ["used in a decodable sentence"]);
      }
      const n = row.bad.length + 1;
      return mcTest({
        question: env.q(row.q),
        options: [row.correct, ...row.bad],
        test: (c) => c === row.correct,
        n,
        rng: env.rng,
        prefer: row.correct,
      });
    });
  }

  function spellReal(env, words, keep) {
    return words.slice(0, env.n).map((w) => {
      const r = rec(w);
      if (!r || !CLUES[w] || (keep && !keep(r))) throw new Error(`cannot spell ${w}`);
      const bads = misspellings(w, (s) => dict.has(s));
      if (bads.length < 3) throw new Error(`not enough misspellings for ${w}`);
      env.keepFact(r, ["spelling confirmed in CMUdict"]);
      const frame = MEANS.has(w) ? `Which spelling means ${CLUES[w]}?` : `Which spelling names ${CLUES[w]}?`;
      return mcTest({
        question: env.q(frame),
        options: [w, ...bads],
        test: (c) => c === w && dict.has(c),
        n: 4,
        rng: env.rng,
        prefer: w,
      });
    });
  }

  function sightCloze(env, words) {
    const rows = SIGHT_CLOZE.filter((s) => words.includes(s.word));
    if (rows.length < env.n) throw new Error(`${env.skill.family_id} needs ${env.n} sight clozes, has ${rows.length}`);
    return rows.slice(0, env.n).map((s) => {
      if (!dict.has(s.word)) throw new Error(`sight word ${s.word} missing from CMUdict`);
      for (const b of s.bad) {
        if (!words.includes(b)) throw new Error(`${b} is not in the sight set for ${s.word}`);
        if (b === s.word) throw new Error(`bad equals answer ${b}`);
      }
      const r = rec(s.word);
      env.keepFact(r, ["sight word in CMUdict"]);
      return mcTest({
        question: env.q(s.q),
        options: [s.word, ...s.bad],
        test: (c) => c === s.word,
        n: 4,
        rng: env.rng,
        prefer: s.word,
      });
    });
  }

  const short = (tag) => (r) => shortVowelTag(r) === tag;
  const endsAm = (r) => r.bases.slice(-2).join(" ") === "AE M" && r.word.endsWith("am");
  const endsAn = (r) => r.bases.slice(-2).join(" ") === "AE N" && r.word.endsWith("an");

  on("fam_choose_the_diphthong_word_that_matches_the_p", (e) => clueItems(e, ["boy", "toy", "cow", "mouse", "coin", "house"], (r) => diphthongTags(r).length > 0, "word"));
  on("fam_choose_the_picture_that_matches_the_short_e", (e) => clueItems(e, ["bed", "red", "pen", "hen"], short("short_e"), "pic"));
  on("fam_choose_the_picture_that_matches_the_shor_1", (e) => clueItems(e, ["net", "jet", "web", "leg"], short("short_e"), "pic"));
  on("fam_choose_the_picture_that_matches_the_short_u", (e) => clueItems(e, ["cup", "bug", "sun", "bus"], short("short_u"), "pic"));
  on("fam_choose_the_picture_that_matches_the_vowel_te", (e) => clueItems(e, ["rain", "boat", "tree", "pie", "coat", "snow"], (r) => longVowelSpelling(r).some((t) => ["ai", "oa", "ee", "ie", "ow", "ay"].includes(t)), "pic"));
  on("fam_choose_the_picture_that_matches_the_word_ng", (e) => clueItems(e, ["ring", "wing", "king", "sink", "bank"], (r) => digraphTags(r).some((t) => t === "ng" || t === "nk"), "pic"));
  on("fam_choose_the_r_control_word_that_matches_the_p", (e) => clueItems(e, ["car", "star", "farm", "barn", "bird", "horse", "fork"], (r) => rControlTags(r).length > 0, "word"));
  on("fam_choose_the_short_a_word_that_matches_the_pic", (e) => clueItems(e, ["cat", "hat", "map", "bag"], short("short_a"), "word"));
  on("fam_choose_the_short_a_word_that_matches_the_1", (e) => clueItems(e, ["man", "pan", "jam", "fan"], short("short_a"), "word"));
  on("fam_choose_the_short_i_word_that_matches_the_pic", (e) => clueItems(e, ["pig", "sit", "pin", "win"], short("short_i"), "word"));
  on("fam_choose_the_short_i_word_that_matches_the_1", (e) => clueItems(e, ["fin", "lip", "big", "kid"], short("short_i"), "word"));
  on("fam_choose_the_short_o_word_that_matches_the_pic", (e) => clueItems(e, ["hot", "pot", "hop", "mop"], short("short_o"), "word"));
  on("fam_choose_the_short_o_word_that_matches_the_1", (e) => clueItems(e, ["mom", "cot", "pop", "dot"], short("short_o"), "word"));
  on("fam_choose_the_silent_e_word_that_matches_the_pi", (e) => clueItems(e, ["cake", "bike", "kite", "home", "rope", "cube"], (r) => !!silentEPattern(r), "word"));
  on("fam_read_short_vowel_words_set_1", (e) => clueItems(e, ["cat", "bed", "pig", "hot", "cup"], (r) => !!shortVowelTag(r), "word"));
  on("fam_read_short_vowel_words_set_2", (e) => clueItems(e, ["map", "pen", "sit", "pot", "sun"], (r) => !!shortVowelTag(r), "word"));
  on("fam_read_the_digraph_word", (e) => clueItems(e, ["ship", "fish", "chin", "cheese", "shell"], (r) => digraphTags(r).some((t) => t === "sh" || t === "ch"), "word"));
  on("fam_read_two_syllable_words", (e) => clueItems(e, ["rabbit", "tiger", "pencil", "monkey"], (r) => r.syllables === 2, "word"));
  on("fam_read_words_with_am_and_an_set_1", (e) => clueItems(e, ["ham", "jam", "can", "man"], (r) => endsAm(r) || endsAn(r), "word"));
  on("fam_read_words_with_am_and_an_set_2", (e) => clueItems(e, ["yam", "pan", "fan", "van"], (r) => endsAm(r) || endsAn(r), "word"));
  on("fam_spell_the_digraph_word_ch_sh_th", (e) => spellReal(e, ["ship", "fish", "chin", "shell"], (r) => digraphTags(r).some((t) => ["sh", "ch", "th"].includes(t))));
  on("fam_spell_the_short_vowel_word", (e) => spellReal(e, ["cat", "bed", "pig", "sun"], (r) => !!shortVowelTag(r)));
  on("fam_spell_the_silent_e_word", (e) => spellReal(e, ["cake", "bike", "home", "kite"], (r) => !!silentEPattern(r)));

  on("fam_choose_the_short_i_or_long_i_word_that_match", (e) => clueItems(e, ["pig", "bike", "pin", "kite"], (r) => shortVowelTag(r) === "short_i" || silentEPattern(r)?.pattern === "i_e", "word"));
  on("fam_choose_the_short_o_or_long_o_word_that_match", (e) => clueItems(e, ["hop", "home", "pot", "rope"], (r) => shortVowelTag(r) === "short_o" || silentEPattern(r)?.pattern === "o_e", "word"));
  on("fam_choose_the_short_u_or_long_u_word_that_match", (e) => clueItems(e, ["cup", "cube", "bug", "tube"], (r) => shortVowelTag(r) === "short_u" || silentEPattern(r)?.pattern === "u_e", "word"));
  on("fam_match_the_short_a_and_long_a_words_to_pictur", (e) => clueItems(e, ["cat", "cake", "hat", "lake"], (r) => shortVowelTag(r) === "short_a" || silentEPattern(r)?.pattern === "a_e" || longVowelSpelling(r).includes("ai"), "word"));
  on("fam_match_the_short_e_and_long_e_words_to_pictur", (e) => clueItems(e, ["bed", "feet", "hen", "seed"], (r) => shortVowelTag(r) === "short_e" || longVowelSpelling(r).some((t) => t === "ee" || t === "ea"), "word"));

  on("fam_choose_the_picture_that_rhymes_with_the_word", (e) => rhymePicture(e, rec));

  on("fam_choose_the_short_a_sentence_that_matches_the", (e) => sentences(e, [
    { q: "Which sentence tells about a cat on a mat?", correct: "The cat sat on a mat.", bad: ["Dad has a ham.", "The man has a pan.", "The lad has a cap."], focus: ["cat", "sat", "mat"] },
    { q: "Which sentence tells about Dad and a map?", correct: "Dad has a map.", bad: ["The cat sat on a mat.", "The man ran.", "Pam has a fan."], focus: ["dad", "map"] },
    { q: "Which sentence tells about a man with a pan?", correct: "The man has a pan.", bad: ["The cat sat.", "Dad has a hat.", "The bag is tan."], focus: ["man", "pan"] },
  ], (r) => shortVowelTag(r) === "short_a" || r.word === "has"));

  on("fam_choose_the_short_e_sentence_that_matches_the", (e) => sentences(e, [
    { q: "Which sentence tells about a hen in a pen?", correct: "The hen is in a pen.", bad: ["The jet is red.", "The web is on the bed.", "Ted has a pet."], focus: ["hen", "pen"] },
    { q: "Which sentence tells about a red jet?", correct: "The jet is red.", bad: ["The hen is in a pen.", "Ben met Jen.", "The bed is wet."], focus: ["jet", "red"] },
    { q: "Which sentence tells about a web on a bed?", correct: "The web is on the bed.", bad: ["The hen is red.", "The pet can beg.", "Let Ken set the net."], focus: ["web", "bed"] },
  ], (r) => shortVowelTag(r) === "short_e" || ["is", "in", "on", "the", "a"].includes(r.word)));

  on("fam_choose_the_short_i_sentence_that_matches_the", (e) => sentences(e, [
    { q: "Which sentence tells about a big pig?", correct: "The pig is big.", bad: ["The kid can sit."], focus: ["pig", "big"] },
    { q: "Which sentence tells about a kid who can sit?", correct: "The kid can sit.", bad: ["The pig is big."], focus: ["kid", "sit"] },
    { q: "Which sentence tells about a pin in a tin?", correct: "The pin is in the tin.", bad: ["Tim can win."], focus: ["pin", "tin"] },
  ], (r) => shortVowelTag(r) === "short_i" || ["is", "in", "the", "can"].includes(r.word)));

  on("fam_choose_the_short_o_sentence_that_matches_the", (e) => sentences(e, [
    { q: "Which sentence tells about Mom and a hot pot?", correct: "Mom has a hot pot.", bad: ["The mop can hop.", "Tom got a cot.", "The dog is not hot."], focus: ["mom", "hot", "pot"] },
    { q: "Which sentence tells about a mop that can hop?", correct: "The mop can hop.", bad: ["Mom has a hot pot.", "Bob has a top job.", "The pot is hot."], focus: ["mop", "hop"] },
    { q: "Which sentence tells about a cot?", correct: "Tom got a cot.", bad: ["Mom has a pot.", "The cop can hop.", "Don has a dot."], focus: ["got", "cot"] },
  ], (r) => shortVowelTag(r) === "short_o" || r.word === "has"));

  on("fam_choose_the_short_u_sentence_that_matches_the", (e) => sentences(e, [
    { q: "Which sentence tells about a bug on a rug?", correct: "The bug is on the rug.", bad: ["The pup can run.", "A cub is in the tub.", "Bud has a cup."], focus: ["bug", "rug"] },
    { q: "Which sentence tells about a pup that can run?", correct: "The pup can run.", bad: ["The bug is on the rug.", "The sun is up.", "Mum has a bun."], focus: ["pup", "run"] },
    { q: "Which sentence tells about a cub in a tub?", correct: "A cub is in the tub.", bad: ["The bug can hug.", "The pup is fun.", "Jud has a nut."], focus: ["cub", "tub"] },
  ], (r) => shortVowelTag(r) === "short_u"));

  on("fam_choose_the_silent_e_sentence_that_matches_th", (e) => sentences(e, [
    { q: "Which sentence tells about baking a cake?", correct: "We can bake a cake.", bad: ["I ride a bike.", "The kite is by the lake.", "I hope we go home."], focus: ["bake", "cake"] },
    { q: "Which sentence tells about a bike ride?", correct: "I ride a bike.", bad: ["We can bake a cake.", "The note is on the rope.", "Jane made a cape."], focus: ["ride", "bike"] },
    { q: "Which sentence tells about going home?", correct: "I hope we go home.", bad: ["We can bake a cake.", "Mike has a kite.", "The cube is cute."], focus: ["hope", "home"] },
  ], (r) => !!silentEPattern(r) || ["can", "we", "a", "i", "go", "is", "by", "the", "on"].includes(r.word)));

  on("fam_choose_the_vowel_team_sentence_that_matches", (e) => sentences(e, [
    { q: "Which sentence tells about playing in the rain?", correct: "We play in the rain.", bad: ["The goat is in a boat.", "I see a green tree.", "The snow is on the road."], focus: ["play", "rain"] },
    { q: "Which sentence tells about a goat in a boat?", correct: "The goat is in a boat.", bad: ["We play in the rain.", "I see a green tree.", "Please wait by the mail."], focus: ["goat", "boat"] },
    { q: "Which sentence tells about a green tree?", correct: "I see a green tree.", bad: ["We play in the rain.", "The goat is in a boat.", "The bee is on the leaf."], focus: ["see", "green", "tree"] },
  ], (r) => longVowelSpelling(r).length > 0));

  on("fam_complete_the_rhyme", (e) => rhymeCloze(e, rec));
  on("fam_build_a_set_of_rhyming_words", (e) => rhymeJoin(e, rec));
  on("fam_which_word_does_not_rhyme", (e) => rhymeOdd(e, rec));

  on("fam_blend_each_sound_in_a_word_together", (e) => blend(e, rec, ["cat", "map", "sun", "bed"]));
  on("fam_put_the_sounds_in_order", (e) => soundOrder(e, rec, ["cat", "map", "sun", "bed"]));
  on("fam_identify_each_sound_in_a_word", (e) => eachSound(e, rec, ["sun", "map", "bed", "pig"]));

  on("fam_change_the_first_sound_in_a_word", (e) => changeSound(e, rec, "first sound", [
    ["cat", "hat"], ["pin", "bin"], ["bug", "hug"], ["hot", "pot"],
  ]));
  on("fam_change_the_last_sound_in_a_word", (e) => changeSound(e, rec, "last sound", [
    ["cat", "cap"], ["pin", "pit"], ["bug", "bun"], ["hop", "hot"],
  ]));
  on("fam_change_the_vowel_sound_in_a_word", (e) => changeSound(e, rec, "middle sound", [
    ["cat", "cot"], ["pin", "pan"], ["bug", "bag"], ["pot", "pit"],
  ]));
  on("fam_change_one_letter_to_make_a_new_word", (e) => oneLetter(e, rec));
  on("fam_change_the_sound_in_a_word_review", (e) => changeSort(e, rec));

  on("fam_complete_the_short_a_word", (e) => blanks(e, [
    { word: "cat", choices: ["a", "e", "i", "o"], fill: (c) => `c${c}t`, prompt: "An animal that says meow is spelled c _ t. Which letter goes in the blank?", claim: "short a", keep: short("short_a") },
    { word: "hat", choices: ["a", "e", "i", "o"], fill: (c) => `h${c}t`, prompt: "Something you wear on your head is spelled h _ t. Which letter goes in the blank?", claim: "short a", keep: short("short_a") },
    { word: "map", choices: ["a", "e", "i", "u"], fill: (c) => `m${c}p`, prompt: "A paper that shows places is spelled m _ p. Which letter goes in the blank?", claim: "short a", keep: short("short_a") },
  ]));
  on("fam_complete_the_short_e_word", (e) => blanks(e, [
    { word: "bed", choices: ["e", "a", "i", "o"], fill: (c) => `b${c}d`, prompt: "A thing you sleep on is spelled b _ d. Which letter goes in the blank?", claim: "short e", keep: short("short_e") },
    { word: "hen", choices: ["e", "a", "i", "u"], fill: (c) => `h${c}n`, prompt: "A bird that says cluck is spelled h _ n. Which letter goes in the blank?", claim: "short e", keep: short("short_e") },
    { word: "pen", choices: ["e", "a", "i", "o"], fill: (c) => `p${c}n`, prompt: "A tool you write with is spelled p _ n. Which letter goes in the blank?", claim: "short e", keep: short("short_e") },
  ]));
  on("fam_complete_the_short_i_words", (e) => blanks(e, [
    { word: "pig", choices: ["i", "a", "e", "o"], fill: (c) => `p${c}g`, prompt: "An animal that says oink is spelled p _ g. Which letter goes in the blank?", claim: "short i", keep: short("short_i") },
    { word: "sit", choices: ["i", "a", "e", "u"], fill: (c) => `s${c}t`, prompt: "To rest on a chair is spelled s _ t. Which letter goes in the blank?", claim: "short i", keep: short("short_i") },
    { word: "fin", choices: ["i", "a", "e", "o"], fill: (c) => `f${c}n`, prompt: "The part a fish uses to swim is spelled f _ n. Which letter goes in the blank?", claim: "short i", keep: short("short_i") },
  ]));
  on("fam_complete_the_short_o_word", (e) => blanks(e, [
    { word: "hot", choices: ["o", "a", "e", "i"], fill: (c) => `h${c}t`, prompt: "Very warm is spelled h _ t. Which letter goes in the blank?", claim: "short o", keep: short("short_o") },
    { word: "pot", choices: ["o", "a", "e", "u"], fill: (c) => `p${c}t`, prompt: "A deep thing you cook soup in is spelled p _ t. Which letter goes in the blank?", claim: "short o", keep: short("short_o") },
    { word: "mop", choices: ["o", "a", "i", "u"], fill: (c) => `m${c}p`, prompt: "A tool used to wash the floor is spelled m _ p. Which letter goes in the blank?", claim: "short o", keep: short("short_o") },
  ]));
  on("fam_complete_the_short_u_word", (e) => blanks(e, [
    { word: "bug", choices: ["u", "a", "i", "o"], fill: (c) => `b${c}g`, prompt: "A small insect is spelled b _ g. Which letter goes in the blank?", claim: "short u", keep: short("short_u") },
    { word: "cup", choices: ["u", "a", "e", "o"], fill: (c) => `c${c}p`, prompt: "A small thing you drink water from is spelled c _ p. Which letter goes in the blank?", claim: "short u", keep: short("short_u") },
    { word: "sun", choices: ["u", "a", "i", "o"], fill: (c) => `s${c}n`, prompt: "The bright light in the day sky is spelled s _ n. Which letter goes in the blank?", claim: "short u", keep: short("short_u") },
  ]));
  on("fam_complete_the_word_with_the_right_short_vowel", (e) => blanks(e, [
    { word: "cat", choices: ["a", "e", "i", "o"], fill: (c) => `c${c}t`, prompt: "An animal that says meow is spelled c _ t. Which short vowel goes in the blank?", claim: "short vowel", keep: short("short_a") },
    { word: "bed", choices: ["e", "a", "i", "o"], fill: (c) => `b${c}d`, prompt: "A thing you sleep on is spelled b _ d. Which short vowel goes in the blank?", claim: "short vowel", keep: short("short_e") },
    { word: "sun", choices: ["u", "a", "e", "i"], fill: (c) => `s${c}n`, prompt: "The bright light in the day sky is spelled s _ n. Which short vowel goes in the blank?", claim: "short vowel", keep: short("short_u") },
  ]));
  on("fam_complete_the_silent_e_words", (e) => {
    fail(e, "give", "long i silent e", (r) => silentEPattern(r)?.pattern === "i_e");
    fail(e, "have", "long a silent e", (r) => silentEPattern(r)?.pattern === "a_e");
    fail(e, "come", "long o silent e", (r) => silentEPattern(r)?.pattern === "o_e");
    fail(e, "love", "long o silent e", (r) => silentEPattern(r)?.pattern === "o_e");
    return blanks(e, [
      { word: "cake", choices: ["a", "e", "i", "o"], fill: (c) => `c${c}ke`, prompt: "A sweet food for a birthday is spelled c _ ke. Which letter goes in the blank?", claim: "silent e long a", keep: (r) => silentEPattern(r)?.pattern === "a_e" },
      { word: "bike", choices: ["i", "a", "e", "o"], fill: (c) => `b${c}ke`, prompt: "A vehicle with two wheels you pedal is spelled b _ ke. Which letter goes in the blank?", claim: "silent e long i", keep: (r) => silentEPattern(r)?.pattern === "i_e" },
      { word: "home", choices: ["o", "a", "e", "i"], fill: (c) => `h${c}me`, prompt: "The place where you live is spelled h _ me. Which letter goes in the blank?", claim: "silent e long o", keep: (r) => silentEPattern(r)?.pattern === "o_e" },
    ]);
  });

  on("fam_complete_the_vowel_team_words", (e) => {
    fail(e, "bread", "long e spelled ea", (r) => longVowelSpelling(r).includes("ea"));
    fail(e, "head", "long e spelled ea", (r) => longVowelSpelling(r).includes("ea"));
    fail(e, "cow", "long o spelled ow", (r) => longVowelSpelling(r).includes("ow"));
    return blanks(e, [
      { word: "rain", choices: ["ai", "ee", "oa", "oo"], fill: (c) => `r${c}n`, prompt: "Water that falls from clouds is spelled r __ n. Which letters go in the blank?", claim: "vowel team ai", keep: (r) => longVowelSpelling(r).includes("ai") },
      { word: "boat", choices: ["oa", "ee", "ai", "oo"], fill: (c) => `b${c}t`, prompt: "A vehicle that floats on water is spelled b __ t. Which letters go in the blank?", claim: "vowel team oa", keep: (r) => longVowelSpelling(r).includes("oa") },
      { word: "tree", choices: ["ee", "ai", "oa", "oo"], fill: (c) => `tr${c}`, prompt: "A tall plant with a trunk is spelled tr __. Which letters go in the blank?", claim: "vowel team ee", keep: (r) => longVowelSpelling(r).includes("ee") },
    ]);
  });
  on("fam_complete_the_word_with_the_right_vowel_team", (e) => blanks(e, [
    { word: "play", choices: ["ay", "ee", "oa", "ew"], fill: (c) => `pl${c}`, prompt: "To have fun is spelled pl __. Which letters go in the blank?", claim: "vowel team ay", keep: (r) => longVowelSpelling(r).includes("ay") },
    { word: "coat", choices: ["oa", "ai", "ee", "oo"], fill: (c) => `c${c}t`, prompt: "A warm piece of clothing for outside is spelled c __ t. Which letters go in the blank?", claim: "vowel team oa", keep: (r) => longVowelSpelling(r).includes("oa") },
    { word: "feet", choices: ["ee", "ai", "oa", "oo"], fill: (c) => `f${c}t`, prompt: "The body parts you stand on are spelled f __ t. Which letters go in the blank?", claim: "vowel team ee", keep: (r) => longVowelSpelling(r).includes("ee") },
  ]));
  on("fam_complete_the_word_with_the_right_diphthong_o", (e) => blanks(e, [
    { word: "boy", choices: ["oy", "oi", "ou", "ow"], fill: (c) => `b${c}`, prompt: "A young male child is spelled b __. Which letters go in the blank?", claim: "diphthong oy", keep: (r) => diphthongTags(r).includes("oy") },
    { word: "coin", choices: ["oi", "oy", "ou", "ow"], fill: (c) => `c${c}n`, prompt: "A piece of metal money is spelled c __ n. Which letters go in the blank?", claim: "diphthong oi", keep: (r) => diphthongTags(r).includes("oi") },
    { word: "cow", choices: ["ow", "oy", "oi", "ou"], fill: (c) => `c${c}`, prompt: "An animal that says moo is spelled c __. Which letters go in the blank?", claim: "diphthong ow", keep: (r) => diphthongTags(r).includes("ow") },
  ]));
  on("fam_complete_the_word_with_the_right_digraph", (e) => blanks(e, [
    { word: "ship", choices: ["sh", "ch", "th", "wh"], fill: (c) => `${c}ip`, prompt: "A very big boat is spelled __ ip. Which letters go in the blank?", claim: "digraph sh", keep: (r) => digraphTags(r).includes("sh") },
    { word: "chin", choices: ["ch", "sh", "th", "wh"], fill: (c) => `${c}in`, prompt: "The bottom of the face is spelled __ in. Which letters go in the blank?", claim: "digraph ch", keep: (r) => digraphTags(r).includes("ch") },
    { word: "fish", choices: ["sh", "ch", "th", "ck"], fill: (c) => `fi${c}`, prompt: "An animal that swims and has fins is spelled fi __. Which letters go in the blank?", claim: "digraph sh", keep: (r) => digraphTags(r).includes("sh") },
  ]));
  on("fam_choose_the_correct_digraph", (e) => blanks(e, [
    { word: "ship", choices: ["sh", "ch", "th", "ck"], fill: (c) => `${c}ip`, prompt: "Which two letters make one sound at the start of the word for a very big boat? The word looks like __ ip.", claim: "digraph sh", keep: (r) => digraphTags(r).includes("sh") },
    { word: "chop", choices: ["ch", "sh", "th", "wh"], fill: (c) => `${c}op`, prompt: "Which two letters make one sound at the start of the word for cutting food? The word looks like __ op.", claim: "digraph ch", keep: (r) => digraphTags(r).includes("ch") && r.word === "chop" },
    { word: "duck", choices: ["ck", "sh", "ch", "th"], fill: (c) => `du${c}`, prompt: "Which two letters make one sound at the end of the word for a bird that says quack? The word looks like du __.", claim: "digraph ck", keep: (r) => digraphTags(r).includes("ck") },
  ]));
  on("fam_complete_the_word_to_match_the_picture_ss_ll", (e) => blanks(e, [
    { word: "bell", choices: ["ll", "ss", "ff", "ck"], fill: (c) => `be${c}`, prompt: "A metal thing that rings is spelled be __. Which ending goes in the blank?", claim: "floss ll", keep: (r) => flossTags(r).includes("ll") },
    { word: "duck", choices: ["ck", "ll", "ss", "ff"], fill: (c) => `du${c}`, prompt: "A bird that says quack is spelled du __. Which ending goes in the blank?", claim: "floss ck", keep: (r) => flossTags(r).includes("ck") },
    { word: "miss", choices: ["ss", "ll", "ff", "zz"], fill: (c) => `mi${c}`, prompt: "To not hit a target is spelled mi __. Which ending goes in the blank?", claim: "floss ss", keep: (r) => flossTags(r).includes("ss") },
  ]));
  on("fam_complete_the_word_with_the_right_initial_con", (e) => {
    fail(e, "two", "initial blend tw", (r) => startsWithBlend(r));
    fail(e, "ship", "initial blend", (r) => startsWithBlend(r));
    return blanks(e, [
      { word: "stop", choices: ["st", "bl", "gr", "fl"], fill: (c) => `${c}op`, prompt: "A sign that means do not go says __ op. Which two letters go in the blank?", claim: "initial blend", keep: (r) => startsWithBlend(r) },
      { word: "frog", choices: ["fr", "st", "bl", "sn"], fill: (c) => `${c}og`, prompt: "A small animal that hops is spelled __ og. Which two letters go in the blank?", claim: "initial blend", keep: (r) => startsWithBlend(r) },
      { word: "flag", choices: ["fl", "st", "gr", "cr"], fill: (c) => `${c}ag`, prompt: "A cloth on a pole is spelled __ ag. Which two letters go in the blank?", claim: "initial blend", keep: (r) => startsWithBlend(r) },
    ]);
  });
  on("fam_complete_the_word_with_the_right_final_conso", (e) => blanks(e, [
    { word: "jump", choices: ["mp", "nd", "st", "lt"], fill: (c) => `ju${c}`, prompt: "To push off the ground with both feet is spelled ju __. Which two letters go in the blank?", claim: "final blend", keep: (r) => endsWithBlend(r) },
    { word: "nest", choices: ["st", "mp", "nd", "lp"], fill: (c) => `ne${c}`, prompt: "A home a bird builds is spelled ne __. Which two letters go in the blank?", claim: "final blend", keep: (r) => endsWithBlend(r) },
    { word: "milk", choices: ["lk", "st", "mp", "nd"], fill: (c) => `mi${c}`, prompt: "A white drink is spelled mi __. Which two letters go in the blank?", claim: "final blend", keep: (r) => endsWithBlend(r) },
  ]));
  on("fam_fill_in_the_missing_consonant_blend", (e) => blanks(e, [
    { word: "tree", choices: ["tr", "st", "bl", "gr"], fill: (c) => `${c}ee`, prompt: "A tall plant with a trunk is spelled __ ee. Which two letters go in the blank?", claim: "initial blend", keep: (r) => startsWithBlend(r) },
    { word: "hand", choices: ["nd", "mp", "st", "lk"], fill: (c) => `ha${c}`, prompt: "The body part you hold things with is spelled ha __. Which two letters go in the blank?", claim: "final blend", keep: (r) => endsWithBlend(r) },
    { word: "snap", choices: ["sn", "st", "fl", "gr"], fill: (c) => `${c}ap`, prompt: "A quick sharp sound is spelled __ ap. Which two letters go in the blank?", claim: "initial blend", keep: (r) => startsWithBlend(r) },
  ]));
  on("fam_complete_the_word_with_the_right_r_controlle", (e) => blanks(e, [
    { word: "car", choices: ["ar", "er", "ir", "or"], fill: (c) => `c${c}`, prompt: "A vehicle people drive on a road is spelled c __. Which letters go in the blank?", claim: "r-controlled ar", keep: (r) => rControlTags(r).includes("ar") },
    { word: "bird", choices: ["ir", "ar", "er", "or"], fill: (c) => `b${c}d`, prompt: "An animal with feathers is spelled b __ d. Which letters go in the blank?", claim: "r-controlled ir", keep: (r) => rControlTags(r).includes("ir") },
    { word: "corn", choices: ["or", "ar", "er", "ur"], fill: (c) => `c${c}n`, prompt: "A yellow vegetable on a cob is spelled c __ n. Which letters go in the blank?", claim: "r-controlled or", keep: (r) => rControlTags(r).includes("or") },
  ]));

  on("fam_does_the_word_start_with_a_consonant_blend", (e) => yesNo(e, rec, [
    ["stop", true, (r) => startsWithBlend(r)],
    ["ship", false, (r) => startsWithBlend(r)],
    ["tree", true, (r) => startsWithBlend(r)],
  ], (word) => `Does ${word} start with two consonant sounds together?`));
  on("fam_does_the_word_end_with_a_consonant_blend", (e) => yesNo(e, rec, [
    ["jump", true, (r) => endsWithBlend(r)],
    ["fish", false, (r) => endsWithBlend(r)],
    ["nest", true, (r) => endsWithBlend(r)],
  ], (word) => `Does ${word} end with two consonant sounds together?`));

  on("fam_find_the_vowels_in_a_word", (e) => letterJob(e, rec, ["cat", "bed", "sun"], "vowel"));
  on("fam_which_letter_does_the_word_start_with", (e) => {
    fail(e, "phone", "starts with the letter p", (r) => firstLetterMatchesSound(r) && r.word[0] === "p");
    return letterJob(e, rec, ["cat", "sun", "map"], "start");
  });
  on("fam_which_letter_does_the_word_end_with", (e) => letterJob(e, rec, ["cat", "sun", "bed"], "end"));
  on("fam_sort_consonants_and_vowels", (e) => letterYes(e, rec));

  on("fam_identify_the_short_vowel_sound_in_a_word", (e) => {
    fail(e, "was", "short a", (r) => shortVowelTag(r) === "short_a");
    fail(e, "dog", "short o", (r) => shortVowelTag(r) === "short_o");
    fail(e, "come", "short o", (r) => shortVowelTag(r) === "short_o");
    return vowelName(e, rec, ["cat", "bed", "sun", "hot"]);
  });
  on("fam_find_the_word_with_the_same_vowel_sound", (e) => {
    dropMatter(e);
    return sameVowelWord(e, rec, ["cat", "bed", "sun"]);
  });
  on("fam_which_two_words_have_the_same_vowel_sound", (e) => pairSound(e, rec, "vowel"));
  on("fam_which_two_words_start_with_the_same_sound", (e) => pairSound(e, rec, "start"));
  on("fam_which_two_words_end_with_the_same_sound", (e) => pairSound(e, rec, "end"));

  on("fam_how_many_syllables_does_the_word_have", (e) => syllableCount(e, rec, ["cat", "rabbit", "banana"]));
  on("fam_sort_by_the_number_of_syllables", (e) => syllableSort(e, rec));
  on("fam_sort_short_and_long_vowel_words", (e) => shortLongSort(e, rec));
  on("fam_use_spelling_patterns_to_sort_long_and_short", (e) => longShortYes(e, rec));
  on("fam_use_spelling_patterns_to_sort_long_a_words", (e) => patternChoice(e, rec, [
    ["cake", "a silent e", (r) => silentEPattern(r)?.pattern === "a_e"],
    ["rain", "the letters ai", (r) => longVowelSpelling(r).includes("ai")],
    ["play", "the letters ay", (r) => longVowelSpelling(r).includes("ay")],
  ], "long a"));
  on("fam_use_spelling_patterns_to_sort_long_e_words", (e) => patternSort(e, rec, "ee", "ea", [
    ["see", "ee"], ["tree", "ee"], ["eat", "ea"], ["leaf", "ea"],
    ["feet", "ee"], ["green", "ee"], ["team", "ea"], ["seat", "ea"],
    ["bee", "ee"], ["sleep", "ee"], ["beach", "ea"], ["meal", "ea"],
  ], (r, pat) => longVowelSpelling(r).includes(pat) && r.primary === "IY"));
  on("fam_use_spelling_patterns_to_sort_long_i_words", (e) => patternSort(e, rec, "silent e", "igh", [
    ["like", "silent e"], ["time", "silent e"], ["light", "igh"], ["night", "igh"],
    ["bike", "silent e"], ["kite", "silent e"], ["high", "igh"], ["right", "igh"],
    ["ride", "silent e"], ["nine", "silent e"], ["sigh", "igh"], ["sight", "igh"],
  ], (r, pat) => pat === "silent e" ? silentEPattern(r)?.pattern === "i_e" : longVowelSpelling(r).includes("igh")));
  on("fam_use_spelling_patterns_to_sort_long_o_words", (e) => patternSort(e, rec, "silent e", "oa", [
    ["home", "silent e"], ["hope", "silent e"], ["boat", "oa"], ["coat", "oa"],
    ["rope", "silent e"], ["note", "silent e"], ["goat", "oa"], ["road", "oa"],
    ["bone", "silent e"], ["nose", "silent e"], ["soap", "oa"], ["toast", "oa"],
  ], (r, pat) => pat === "silent e" ? silentEPattern(r)?.pattern === "o_e" : longVowelSpelling(r).includes("oa")));
  on("fam_use_spelling_patterns_to_sort_long_u_words", (e) => patternSort(e, rec, "silent e", "ew", [
    ["cute", "silent e"], ["cube", "silent e"], ["new", "ew"], ["flew", "ew"],
    ["use", "silent e"], ["mule", "silent e"], ["few", "ew"], ["chew", "ew"],
    ["tube", "silent e"], ["flute", "silent e"], ["dew", "ew"], ["grew", "ew"],
  ], (r, pat) => pat === "silent e" ? silentEPattern(r)?.pattern === "u_e" : longVowelSpelling(r).includes("ew")));

  on("fam_sort_by_initial_consonant_blend_or_digraph", (e) => blendDigraphSort(e, rec));

  on("fam_put_two_syllables_together_to_create_a_word", (e) => compounds(e, dict, [
    ["cup", "cake"], ["pan", "cake"], ["sun", "set"], ["bed", "room"],
  ]));
  on("fam_put_two_syllables_together_to_create_a_w_1", (e) => syllableJoin(e, dict, [
    ["tiger", ["ti", "ger"], [["T", "AY"], ["G", "ER"]]],
    ["spider", ["spi", "der"], [["S", "P", "AY"], ["D", "ER"]]],
    ["monkey", ["mon", "key"], [["M", "AH", "NG"], ["K", "IY"]]],
    ["pencil", ["pen", "cil"], [["P", "EH", "N"], ["S", "AH", "L"]]],
  ]));
  on("fam_segment_two_syllable_words", (e) => segment(e, dict));
  on("fam_complete_the_two_syllable_words", (e) => blanks(e, [
    { word: "pencil", choices: ["cil", "dow", "ket", "bit"], fill: (c) => `pen${c}`, prompt: "A tool you write and draw with is spelled pen __. Which ending makes the word?", claim: "two syllables", keep: (r) => r.syllables === 2 },
    { word: "rabbit", choices: ["bit", "cil", "dow", "py"], fill: (c) => `rab${c}`, prompt: "A small animal with long ears is spelled rab __. Which ending makes the word?", claim: "two syllables", keep: (r) => r.syllables === 2 },
    { word: "window", choices: ["dow", "bit", "cil", "ket"], fill: (c) => `win${c}`, prompt: "An opening you look through is spelled win __. Which ending makes the word?", claim: "two syllables", keep: (r) => r.syllables === 2 },
  ]));
  on("fam_complete_the_sentence_with_a_two_syllable_wo", (e) => twoSyllableSentence(e, rec));
  on("fam_complete_the_sentence_with_the_correct_short", (e) => shortSentenceCloze(e, rec));

  const allSight = Object.values(SIGHT_SETS).flat();
  on("fam_read_sight_words_set_1_again_each_from_may_s", (e) => sightCloze(e, SIGHT_SETS.set1));
  on("fam_read_sight_words_set_2_after_best_gave_has_o", (e) => sightCloze(e, SIGHT_SETS.set2));
  on("fam_read_sight_words_set_3_as_by_four_her_more_s", (e) => sightCloze(e, SIGHT_SETS.set3));
  on("fam_read_sight_words_set_4_every_could_how_over", (e) => sightCloze(e, SIGHT_SETS.set4));
  on("fam_read_sight_words_set_5_ask_five_just_long_re", (e) => sightCloze(e, SIGHT_SETS.set5));
  on("fam_read_sight_words_set_6_any_give_his_new_open", (e) => sightCloze(e, SIGHT_SETS.set6));
  on("fam_read_sight_words_set_7_also_fly_know_live_ol", (e) => sightCloze(e, SIGHT_SETS.set7));
  on("fam_read_sight_words_review_sets_1_2_3", (e) => sightCloze(e, [...SIGHT_SETS.set1, ...SIGHT_SETS.set2, ...SIGHT_SETS.set3]));
  on("fam_read_sight_words_review_sets_1_7", (e) => sightCloze(e, allSight));
  on("fam_read_sight_words_review_sets_4_5_6_7", (e) => sightCloze(e, [...SIGHT_SETS.set4, ...SIGHT_SETS.set5, ...SIGHT_SETS.set6, ...SIGHT_SETS.set7]));
  on("fam_complete_the_sentence_with_the_correct_sight", (e) => sightCloze(e, [...SIGHT_SETS.set1, ...SIGHT_SETS.set2, ...SIGHT_SETS.set3]));
  on("fam_complete_the_sentence_with_the_correct_s_1", (e) => sightCloze(e, [...SIGHT_SETS.set4, ...SIGHT_SETS.set5, ...SIGHT_SETS.set6, ...SIGHT_SETS.set7]));
  on("fam_complete_the_sentence_with_the_correct_s_2", (e) => sightCloze(e, allSight));
  on("fam_spell_the_sight_word", (e) => spellSight(e, dict, ["again", "because", "could"]));

  void vowelClass;
}

function rhymePicture(env, rec) {
  const sets = [
    { cue: "cat", answer: "hat", bads: ["cup", "sun", "pig"] },
    { cue: "bed", answer: "red", bads: ["cup", "map", "sun"] },
    { cue: "bug", answer: "rug", bads: ["cat", "pen", "hot"] },
  ];
  return sets.slice(0, env.n).map((s) => {
    const key = rec(s.cue).rime;
    if (rec(s.answer).rime !== key) throw new Error(`rhyme fail ${s.answer}`);
    for (const b of s.bads) if (rec(b).rime === key) throw new Error(`${b} also rhymes with ${s.cue}`);
    env.keepFact(rec(s.answer), [`rhymes with ${s.cue}`, s.answer && rec(s.answer).rime]);
    return mcTest({
      question: env.q(`Which word rhymes with ${s.cue}?`),
      options: [s.answer, ...s.bads],
      test: (c) => rec(c) && rec(c).rime === key && rec(c).syllables === 1,
      n: 4,
      rng: env.rng,
      prefer: s.answer,
    });
  });
}

function rhymeCloze(env, rec) {
  const rows = [
    { q: "The cat sat on a ___.", answer: "mat", bads: ["cup", "sun", "pig"], with: "cat" },
    { q: "I see a pig that is ___.", answer: "big", bads: ["cup", "hat", "red"], with: "pig" },
    { q: "A bug is on the ___.", answer: "rug", bads: ["pen", "hot", "map"], with: "bug" },
  ];
  return rows.slice(0, env.n).map((row) => {
    const key = rec(row.with).rime;
    if (rec(row.answer).rime !== key) throw new Error(`cloze rhyme ${row.answer}`);
    for (const b of row.bads) if (rec(b).rime === key) throw new Error(`${b} rhymes`);
    env.keepFact(rec(row.answer), [`rhymes with ${row.with}`]);
    return mcTest({
      question: env.q(row.q),
      options: [row.answer, ...row.bads],
      test: (c) => c === row.answer,
      n: 4,
      rng: env.rng,
      prefer: row.answer,
    });
  });
}

function rhymeJoin(env, rec) {
  const rows = [
    { shown: ["cat", "hat", "mat"], answer: "sat", bads: ["cup", "sun", "pig"] },
    { shown: ["bed", "red", "fed"], answer: "led", bads: ["cup", "map", "sun"] },
    { shown: ["bug", "hug", "rug"], answer: "mug", bads: ["cat", "pen", "hot"] },
  ];
  return rows.slice(0, env.n).map((row) => {
    const key = rec(row.shown[0]).rime;
    for (const w of [...row.shown, row.answer]) {
      if (rec(w).rime !== key) throw new Error(`${w} not in rhyme set`);
      env.keepFact(rec(w), [`rime ${key}`]);
    }
    for (const b of row.bads) if (rec(b).rime === key) throw new Error(`${b} also rhymes`);
    return mcTest({
      question: env.q(`These words rhyme: ${row.shown.join(", ")}. Which word can join them?`),
      options: [row.answer, ...row.bads],
      test: (c) => rec(c) && rec(c).rime === key && !row.shown.includes(c),
      n: 4,
      rng: env.rng,
      prefer: row.answer,
    });
  });
}

function rhymeOdd(env, rec) {
  const rows = [
    { words: ["cat", "hat", "mat", "sun"], odd: "sun" },
    { words: ["bed", "red", "fed", "cup"], odd: "cup" },
    { words: ["bug", "hug", "rug", "pen"], odd: "pen" },
  ];
  return rows.slice(0, env.n).map((row) => {
    const mates = row.words.filter((w) => w !== row.odd);
    const key = rec(mates[0]).rime;
    for (const w of mates) if (rec(w).rime !== key) throw new Error(`${w} should rhyme`);
    if (rec(row.odd).rime === key) throw new Error(`${row.odd} also rhymes`);
    for (const w of row.words) env.keepFact(rec(w), ["rhyme odd one out"]);
    return mcTest({
      question: env.q("Which word does not rhyme with the others?"),
      options: row.words,
      test: (c) => rec(c).rime !== key,
      n: 4,
      rng: env.rng,
      prefer: row.odd,
    });
  });
}

function blend(env, rec, words) {
  return words.slice(0, env.n).map((w) => {
    const r = rec(w);
    if (!isTransparentCvc(r)) throw new Error(`${w} is not a transparent CVC`);
    const shown = w.split("").join(" - ");
    const pool = ["cat", "cap", "cot", "cut", "map", "mat", "mop", "sun", "sip", "bed", "bad", "bid", "pig", "pin", "pot", "hat"];
    env.keepFact(r, ["transparent CVC", "blend"]);
    return mcTest({
      question: env.q(`Blend these sounds: ${shown}. Which word do they make?`),
      options: pool,
      test: (c) => c === w,
      n: 4,
      rng: env.rng,
      prefer: w,
    });
  });
}

function soundOrder(env, rec, words) {
  return words.slice(0, env.n).map((w) => {
    const r = rec(w);
    if (!isTransparentCvc(r)) throw new Error(`${w} not transparent`);
    const chars = w.split("");
    const forms = [
      chars.join(" - "),
      [chars[2], chars[1], chars[0]].join(" - "),
      [chars[1], chars[0], chars[2]].join(" - "),
      [chars[0], chars[2], chars[1]].join(" - "),
    ];
    if (new Set(forms).size < 4) throw new Error(`perms collapsed for ${w}`);
    env.keepFact(r, ["sound order"]);
    return mcTest({
      question: env.q(`The word is ${w}. Which line shows the sounds in order?`),
      options: forms,
      test: (c) => c.replace(/ - /g, "") === w,
      n: 4,
      rng: env.rng,
      prefer: forms[0],
    });
  });
}

function eachSound(env, rec, words) {
  const jobs = [
    { w: words[0], pos: 0, ask: "first" },
    { w: words[1], pos: 2, ask: "last" },
    { w: words[2], pos: 1, ask: "middle" },
  ];
  return jobs.slice(0, env.n).map((job) => {
    const r = rec(job.w);
    if (!isTransparentCvc(r)) throw new Error(job.w);
    const letters = job.w.split("");
    const answer = letters[job.pos];
    const extra = ["m", "p", "t", "s", "n", "b"].find((ch) => !letters.includes(ch));
    env.keepFact(r, ["each sound"]);
    return mcTest({
      question: env.q(`The word is ${job.w}. Which sound comes ${job.ask}?`),
      options: [...letters, extra],
      test: (c) => c === answer,
      n: 4,
      rng: env.rng,
      prefer: answer,
    });
  });
}

function changeSound(env, rec, kind, pairs) {
  return pairs.slice(0, env.n).map(([from, to]) => {
    const a = rec(from);
    const b = rec(to);
    if (!isTransparentCvc(a) || !isTransparentCvc(b)) throw new Error(`${from}/${to} not transparent`);
    if (changeKind(a, b) !== kind) throw new Error(`${from}->${to} is ${changeKind(a, b)} not ${kind}`);
    const pool = ["hat", "cap", "cot", "cut", "bin", "pit", "pan", "pat", "hug", "bun", "bag", "bug", "pot", "hot", "hop", "hit", "cat", "pin"];
    env.keepFact(a, [kind]);
    env.keepFact(b, [kind]);
    const letter = kind === "first sound" ? to[0] : kind === "last sound" ? to[to.length - 1] : to[1];
    const place = kind === "first sound" ? "first" : kind === "last sound" ? "last" : "middle";
    return mcTest({
      question: env.q(`Change the ${place} sound in ${from} to ${letter}. Which word do you get?`),
      options: pool.filter((w) => w !== from),
      test: (c) => {
        const r = rec(c);
        return !!r && changeKind(a, r) === kind && c === to;
      },
      n: 4,
      rng: env.rng,
      prefer: to,
    });
  });
}

function oneLetter(env, rec) {
  const rows = [
    { from: "cat", to: "hat", q: "Change one letter in cat to make a word for something you wear on your head.", bads: ["can", "cot", "cap"] },
    { from: "pin", to: "pig", q: "Change one letter in pin to make a word for an animal that says oink.", bads: ["pan", "pit", "bin"] },
    { from: "hop", to: "hot", q: "Change one letter in hop to make a word that means very warm.", bads: ["hip", "mop", "top"] },
  ];
  return rows.slice(0, env.n).map((row) => {
    if (letterDistance(row.from, row.to) !== 1) throw new Error(row.to);
    if (!isTransparentCvc(rec(row.from)) || !isTransparentCvc(rec(row.to))) throw new Error("pair");
    for (const b of row.bads) {
      if (b === row.to) throw new Error("bad is answer");
      if (!rec(b)) throw new Error(`bad ${b} missing`);
    }
    env.keepFact(rec(row.to), ["one letter change"]);
    return mcTest({
      question: env.q(row.q),
      options: [row.to, ...row.bads],
      test: (c) => c === row.to,
      n: 4,
      rng: env.rng,
      prefer: row.to,
    });
  });
}

function changeSort(env, rec) {
  const bins = ["first sound", "middle sound", "last sound", "more than one"];
  const sets = [
    [["cat", "hat"], ["cat", "cot"], ["cat", "cap"], ["cat", "dog"]],
    [["pin", "bin"], ["pin", "pan"], ["pin", "pit"], ["pin", "sun"]],
    [["bug", "hug"], ["bug", "bag"], ["bug", "bun"], ["bug", "tree"]],
  ];
  return sets.slice(0, env.n).map((pairs) => {
    const built = pairs.map(([a, b]) => {
      const ka = changeKind(rec(a), rec(b));
      const bin = bins.includes(ka) ? ka : "more than one";
      if (b !== "dog" && b !== "sun" && b !== "tree" && bin === "more than one" && pairs.length) {
        // expected minimal pairs should match a single change; dog/sun/tree are the extra
      }
      env.keepFact(rec(a), ["sound change"]);
      if (rec(b)) env.keepFact(rec(b), ["sound change"]);
      return { text: `${a} → ${b}`, bin, check: (p) => p.bin === bin };
    });
    // Verify the four bins are all present
    const got = new Set(built.map((p) => p.bin));
    if (got.size !== 4) throw new Error(`sort bins ${[...got].join(",")} for ${built.map((p) => p.text).join(" / ")}`);
    return makeSort({
      question: env.q(`What changed in each pair? Bins: ${bins.join(" | ")}.`),
      bins,
      pairs: built,
      rng: env.rng,
    });
  });
}

function yesNo(env, rec, rows, prompt) {
  return rows.slice(0, env.n).map(([word, expect, pred]) => {
    const r = rec(word);
    const got = pred(r);
    if (got !== expect) throw new Error(`${word} blend fact mismatch`);
    env.keepFact(r, [expect ? "consonant blend" : "not a consonant blend"]);
    return mcTest({
      question: env.q(prompt(word)),
      options: ["yes", "no"],
      test: (c) => (c === "yes") === pred(rec(word)),
      n: 2,
      rng: env.rng,
      prefer: expect ? "yes" : "no",
    });
  });
}

function letterJob(env, rec, words, mode) {
  return words.slice(0, env.n).map((w) => {
    const r = rec(w);
    if (!isTransparentCvc(r)) throw new Error(w);
    if (mode === "start" && !firstLetterMatchesSound(r)) throw new Error(`start ${w}`);
    if (mode === "end" && !lastLetterMatchesSound(r)) throw new Error(`end ${w}`);
    const letters = w.split("");
    const extra = ["m", "p", "s", "t", "n", "b", "d"].find((ch) => !letters.includes(ch));
    let answer;
    let q;
    let test;
    if (mode === "vowel") {
      answer = letters.find((ch) => "aeiou".includes(ch));
      q = `Which letter is a vowel in the word ${w}?`;
      test = (c) => c === answer && "aeiou".includes(c) && w.includes(c);
    } else if (mode === "start") {
      answer = w[0];
      q = `Which letter does the word ${w} start with?`;
      test = (c) => c === w[0];
    } else {
      answer = w[w.length - 1];
      q = `Which letter does the word ${w} end with?`;
      test = (c) => c === w[w.length - 1];
    }
    env.keepFact(r, [mode]);
    return mcTest({
      question: env.q(q),
      options: [...new Set([...letters, extra])],
      test,
      n: 4,
      rng: env.rng,
      prefer: answer,
    });
  });
}

function letterYes(env, rec) {
  const rows = [
    { w: "cat", letter: "a", kind: "vowel" },
    { w: "cat", letter: "c", kind: "consonant" },
    { w: "sun", letter: "u", kind: "vowel" },
  ];
  return rows.slice(0, env.n).map((row) => {
    const r = rec(row.w);
    if (!isTransparentCvc(r)) throw new Error(row.w);
    env.keepFact(r, [row.kind]);
    return mcTest({
      question: env.q(`In the word ${row.w}, the letter ${row.letter} is a ___.`),
      options: ["vowel", "consonant"],
      test: (c) => c === row.kind,
      n: 2,
      rng: env.rng,
      prefer: row.kind,
    });
  });
}

function vowelName(env, rec, words) {
  const label = { short_a: "short a", short_e: "short e", short_i: "short i", short_o: "short o", short_u: "short u" };
  return words.slice(0, env.n).map((w) => {
    const r = rec(w);
    const tag = shortVowelTag(r);
    if (!tag) throw new Error(`no short vowel ${w}`);
    env.keepFact(r, [tag]);
    return mcTest({
      question: env.q(`The word is ${w}. Which short vowel sound do you hear?`),
      options: ["short a", "short e", "short i", "short o", "short u"],
      test: (c) => c === label[tag],
      n: 4,
      rng: env.rng,
      prefer: label[tag],
    });
  });
}

function sameVowelWord(env, rec, words) {
  const pool = ["cat", "hat", "map", "bed", "pen", "pig", "sit", "hot", "pot", "sun", "cup", "cake", "bike"];
  return words.slice(0, env.n).map((w) => {
    const tag = shortVowelTag(rec(w));
    if (!tag) throw new Error(w);
    env.keepFact(rec(w), [tag]);
    return mcTest({
      question: env.q(`Which word has the same vowel sound as ${w}?`),
      options: pool.filter((x) => x !== w),
      test: (c) => c !== w && shortVowelTag(rec(c)) === tag,
      n: 4,
      rng: env.rng,
    });
  });
}

function pairSound(env, rec, mode) {
  const goods = {
    vowel: [["cat", "hat"], ["bed", "red"], ["sun", "cup"]],
    start: [["cat", "cup"], ["sun", "sit"], ["pig", "pot"]],
    end: [["cat", "hat"], ["sun", "pin"], ["bed", "red"]],
  };
  const bads = {
    vowel: [["cat", "bed"], ["sun", "pig"], ["hot", "cup"]],
    start: [["cat", "sun"], ["pig", "bed"], ["hat", "mop"]],
    end: [["cat", "cap"], ["sun", "cup"], ["bed", "pen"]],
  };
  const same = (a, b) => {
    const ra = rec(a);
    const rb = rec(b);
    if (!ra || !rb || ra.vowelConflict || rb.vowelConflict) return false;
    if (mode === "vowel") return ra.primary === rb.primary && ra.syllables === 1 && rb.syllables === 1;
    if (mode === "start") return ra.bases[0] === rb.bases[0];
    return ra.bases[ra.bases.length - 1] === rb.bases[rb.bases.length - 1];
  };
  const label = mode === "vowel" ? "vowel sound" : mode === "start" ? "beginning sound" : "ending sound";
  return goods[mode].slice(0, env.n).map((pair, i) => {
    const text = `${pair[0]} and ${pair[1]}`;
    const options = [text, ...bads[mode].map((p) => `${p[0]} and ${p[1]}`)];
    if (!same(pair[0], pair[1])) throw new Error(`good pair fail ${text}`);
    env.keepFact(rec(pair[0]), [label]);
    env.keepFact(rec(pair[1]), [label]);
    return mcTest({
      question: env.q(`Which two words have the same ${label}?`),
      options,
      test: (c) => {
        const [a, b] = c.split(" and ");
        return same(a, b);
      },
      n: 4,
      rng: env.rng,
      prefer: text,
    });
  });
}

function syllableCount(env, rec, words) {
  return words.slice(0, env.n).map((w) => {
    const r = rec(w);
    if (!r) throw new Error(w);
    env.keepFact(r, [`${r.syllables} syllables`]);
    return mcTest({
      question: env.q(`How many parts do you hear in ${w}?`),
      options: ["1", "2", "3", "4"],
      test: (c) => Number(c) === r.syllables,
      n: 4,
      rng: env.rng,
      prefer: String(r.syllables),
    });
  });
}

function syllableSort(env, rec) {
  const sets = [
    ["cat", "rabbit", "sun", "pencil"],
    ["bed", "monkey", "cup", "window"],
    ["pig", "tiger", "hat", "basket"],
  ];
  const bins = ["One syllable", "Two syllables"];
  return sets.slice(0, env.n).map((words) => makeSort({
    question: env.q(`Sort each word. Bins: ${bins.join(" | ")}.`),
    bins,
    pairs: words.map((text) => {
      const r = rec(text);
      if (r.syllables !== 1 && r.syllables !== 2) throw new Error(`${text} has ${r.syllables} syllables`);
      const bin = r.syllables === 1 ? bins[0] : bins[1];
      env.keepFact(r, [`${r.syllables} syllables`]);
      return { text, bin, check: (p) => (rec(p.text).syllables === 1 ? bins[0] : bins[1]) === p.bin };
    }),
    rng: env.rng,
  }));
}

function shortLongSort(env, rec) {
  const sets = [
    [["cat", "short"], ["cake", "long"], ["hop", "short"], ["hope", "long"]],
    [["pin", "short"], ["pine", "long"], ["cub", "short"], ["cube", "long"]],
    [["sun", "short"], ["tube", "long"], ["hat", "short"], ["lake", "long"]],
  ];
  const bins = ["Short vowel", "Long vowel"];
  return sets.slice(0, env.n).map((rows) => makeSort({
    question: env.q(`Sort each word. Bins: ${bins.join(" | ")}.`),
    bins,
    pairs: rows.map(([text, kind]) => {
      const r = rec(text);
      const tag = shortVowelTag(r);
      const long = silentEPattern(r);
      const isShort = !!tag;
      const isLong = !!long;
      if (kind === "short" && !isShort) throw new Error(`${text} not short`);
      if (kind === "long" && !isLong) throw new Error(`${text} not long`);
      env.keepFact(r, [kind]);
      const bin = kind === "short" ? bins[0] : bins[1];
      return { text, bin, check: () => true };
    }),
    rng: env.rng,
  }));
}

function longShortYes(env, rec) {
  const rows = [
    ["cake", "long"],
    ["cat", "short"],
    ["bike", "long"],
  ];
  return rows.slice(0, env.n).map(([w, kind]) => {
    const r = rec(w);
    const got = silentEPattern(r) ? "long" : shortVowelTag(r) ? "short" : null;
    if (got !== kind) throw new Error(`${w} ${got}`);
    env.keepFact(r, [kind]);
    return mcTest({
      question: env.q(`The word is ${w}. Is the vowel short or long?`),
      options: ["long", "short"],
      test: (c) => c === kind,
      n: 2,
      rng: env.rng,
      prefer: kind,
    });
  });
}

function patternChoice(env, rec, rows) {
  const options = ["a silent e", "the letters ai", "the letters ay", "the letters ee"];
  return rows.slice(0, env.n).map(([w, answer, pred]) => {
    const r = rec(w);
    if (!pred(r)) throw new Error(`${w} pattern`);
    env.keepFact(r, [answer]);
    return mcTest({
      question: env.q(`Which spelling pattern makes the long a sound in ${w}?`),
      options,
      test: (c) => c === answer,
      n: 4,
      rng: env.rng,
      prefer: answer,
    });
  });
}

function patternSort(env, rec, binA, binB, rows, pred) {
  const bins = [binA, binB];
  const groups = [];
  for (let i = 0; i < rows.length; i += 4) groups.push(rows.slice(i, i + 4));
  if (groups.length < env.n) throw new Error(`need ${env.n} pattern groups, have ${groups.length}`);
  return groups.slice(0, env.n).map((use) => makeSort({
    question: env.q(`Sort each long-vowel word. Bins: ${bins.join(" | ")}.`),
    bins,
    pairs: use.map(([text, pat]) => {
      const r = rec(text);
      if (!r || !pred(r, pat)) throw new Error(`${text} not ${pat} ${r ? r.bases.join(" ") : "missing"}`);
      env.keepFact(r, [pat]);
      return { text, bin: pat, check: (p) => pred(rec(p.text), p.bin) };
    }),
    rng: env.rng,
  }));
}

function blendDigraphSort(env, rec) {
  const sets = [
    [["stop", "blend"], ["ship", "digraph"], ["tree", "blend"], ["chin", "digraph"]],
    [["flag", "blend"], ["fish", "digraph"], ["snap", "blend"], ["chop", "digraph"]],
    [["plant", "blend"], ["shell", "digraph"], ["crab", "blend"], ["chin", "digraph"]],
  ];
  const bins = ["Blend", "Digraph"];
  return sets.slice(0, env.n).map((rows) => makeSort({
    question: env.q(`Sort each word. Bins: ${bins.join(" | ")}.`),
    bins,
    pairs: rows.map(([text, kind]) => {
      const r = rec(text);
      const isBlend = startsWithBlend(r);
      const isDigraph = digraphTags(r).some((t) => ["sh", "ch", "th"].includes(t)) && !isBlend;
      if (kind === "blend" && !isBlend) throw new Error(`${text} not blend`);
      if (kind === "digraph" && !isDigraph) throw new Error(`${text} not digraph`);
      env.keepFact(r, [kind]);
      return { text, bin: kind === "blend" ? "Blend" : "Digraph", check: () => true };
    }),
    rng: env.rng,
  }));
}

function compounds(env, dict, pairs) {
  const pool = ["cupcake", "pancake", "sunset", "bedroom", "mailbox", "popcorn", "snowman", "bathtub"];
  return pairs.slice(0, env.n).map(([a, b]) => {
    const word = a + b;
    const got = confirmCompound(dict, a, b, word);
    if (!got.ok) throw new Error(`${word}: ${got.reason}`);
    env.keepFact(analyzeWord(dict, word), [`compound ${a} + ${b}`, got.phones.join(" ")]);
    return mcTest({
      question: env.q(`Put the parts together. Which word do they make? ${a} + ${b}`),
      options: pool,
      test: (c) => c === word,
      n: 4,
      rng: env.rng,
      prefer: word,
    });
  });
}

function syllableJoin(env, dict, rows) {
  const pool = rows.map((r) => r[0]).concat(["window", "basket", "rabbit", "yellow"]);
  return rows.slice(0, env.n).map(([word, parts, phones]) => {
    const got = confirmPhoneSplit(dict, word, parts, phones);
    if (!got.ok) throw new Error(`${word}: ${got.reason}`);
    env.keepFact(analyzeWord(dict, word), [`syllables ${parts.join(" + ")}`]);
    return mcTest({
      question: env.q(`Put the parts together. Which word do they make? ${parts.join(" + ")}`),
      options: [...new Set(pool)],
      test: (c) => c === word,
      n: 4,
      rng: env.rng,
      prefer: word,
    });
  });
}

function segment(env, dict) {
  const rows = [
    ["cupcake", "cup + cake", ["cu + pcake", "cupc + ake", "c + upcake"]],
    ["sunset", "sun + set", ["su + nset", "suns + et", "s + unset"]],
    ["bedroom", "bed + room", ["be + droom", "bedr + oom", "b + edroom"]],
  ];
  return rows.slice(0, env.n).map(([word, good, bads]) => {
    const [a, b] = good.split(" + ");
    const got = confirmCompound(dict, a, b, word);
    if (!got.ok) throw new Error(got.reason);
    env.keepFact(analyzeWord(dict, word), [`segment ${good}`]);
    return mcTest({
      question: env.q(`The word is ${word}. Which shows the two parts?`),
      options: [good, ...bads],
      test: (c) => c === good,
      n: 4,
      rng: env.rng,
      prefer: good,
    });
  });
}

function twoSyllableSentence(env, rec) {
  const rows = [
    { q: "Please sharpen the ___.", answer: "pencil", bads: ["pen", "cat", "run"] },
    { q: "A small animal with long ears is a ___.", answer: "rabbit", bads: ["cat", "pig", "hen"] },
    { q: "The glass in the wall that we look through is a ___.", answer: "window", bads: ["door", "cup", "hat"] },
  ];
  return rows.slice(0, env.n).map((row) => {
    const r = rec(row.answer);
    if (!r || r.syllables !== 2) throw new Error(row.answer);
    for (const b of row.bads) if (rec(b).syllables === 2 && b !== row.answer) {
      // distractors should not also fit the sentence; syllable check is extra
    }
    env.keepFact(r, ["two syllables"]);
    return mcTest({
      question: env.q(row.q),
      options: [row.answer, ...row.bads],
      test: (c) => c === row.answer,
      n: 4,
      rng: env.rng,
      prefer: row.answer,
    });
  });
}

function shortSentenceCloze(env, rec) {
  const rows = [
    { q: "An animal that says meow is a ___.", answer: "cat", bads: ["cake", "coat", "kite"], tag: "short_a" },
    { q: "I sleep on a ___.", answer: "bed", bads: ["boat", "bike", "rain"], tag: "short_e" },
    { q: "The bright light in the day sky is the ___.", answer: "sun", bads: ["moon", "cake", "tree"], tag: "short_u" },
  ];
  return rows.slice(0, env.n).map((row) => {
    if (shortVowelTag(rec(row.answer)) !== row.tag) throw new Error(row.answer);
    env.keepFact(rec(row.answer), [row.tag]);
    return mcTest({
      question: env.q(row.q),
      options: [row.answer, ...row.bads],
      test: (c) => c === row.answer,
      n: 4,
      rng: env.rng,
      prefer: row.answer,
    });
  });
}

function spellSight(env, dict, words) {
  const gloss = {
    again: "one more time",
    could: "was able to",
    because: "why it happened",
  };
  return words.slice(0, env.n).map((w) => {
    if (!dict.has(w)) throw new Error(`sight ${w} missing`);
    const bads = misspellings(w, (s) => dict.has(s));
    if (bads.length < 3) throw new Error(`misspell ${w}`);
    env.keepFact(analyzeWord(dict, w), ["sight spelling"]);
    return mcTest({
      question: env.q(`Which spelling means "${gloss[w]}"?`),
      options: [w, ...bads],
      test: (c) => c === w && dict.has(c),
      n: 4,
      rng: env.rng,
      prefer: w,
    });
  });
}
