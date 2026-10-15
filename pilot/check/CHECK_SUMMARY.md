# Grade 1 pilot: independent check summary

Source: `pilot/grade1_pilot_500.json` (500 items, 191 skill IDs, 198 headings in the text file; six skill IDs have two headings, "set 1" and "set 2").

## Totals

| Result | Count |
|---|---|
| Passed | 494 |
| Failed | 6 |
| Blind answer matched key | 497 of 500 |

Of the 6 fails, 3 are blind-answer slips where the key is correct on re-check. They fail only because the rule is strict: a blind answer that differs from the key fails. Reinstating them would give 497 passes. The other 3 fails are real defects (2 with more than one correct choice, 1 with an ambiguous unit).

## Method

1. **Blind pass.** I answered all 500 items from the stem and choices only. I worked from a copy of the questions with the answer field and skill notes removed, and wrote my answers to a file before opening the key.
2. **Key comparison.** Sort answers (bins) and order answers were compared after normalising the format.
3. **Judgement.** Each item was checked for exactly one correct choice, ambiguity, nonsense, and clarity for a 6-7 year old ESL learner.
4. **Phonics check.** Sound claims were checked against the CMU Pronouncing Dictionary (`pilot/sources/cmudict.dict`, the copy already in the repo, documented in `pilot/SOURCES.md` as downloaded from `cmusphinx/cmudict`). I ran 111 automated checks on rhymes, same-vowel, same-onset, same-coda, digraph vs blend, syllable counts, long/short vowels, and sound order. All 111 pass. Spelling-pattern bins (ee/ea, igh/silent e, oa/silent e, ew) were checked by hand against the same dictionary.

## Fails per skill

| Skill | Item | Reason |
|---|---|---|
| `seed_change_one_letter_to_make_a_new_word` | q013 | Two correct choices: "cap" and "hat" are both worn on the head. |
| `seed_complete_the_rhyme` | q127 | Ambiguous without a picture: "a pig that is red" also works with "big". |
| `seed_complete_the_word_with_the_right_diphthong_o` | q192 | Blind slip (answered "ou", key "ow"). Key is correct: "cow" = c-ow. |
| `seed_complete_the_word_with_the_right_r_controlle` | q200 | Blind slip (answered "or", key "ir"). Key is correct: "bird" = b-ir-d. |
| `seed_determine_the_order_of_events_in_information` | q210 | Blind slip (answered C, A, B). Key A, C, B is correct: wet hands, rub soap, rinse. |
| `seed_how_many_syllables_does_the_word_have` | q245 | Ambiguous unit: "parts" can mean syllables (cat = 1) or sounds (cat = 3), and both are offered. |

Each of the six failing skills has one failing item. No skill lost all of its items.

## Common problems (not all of them fail items)

1. **Two correct choices.** The only real multiple-answer defects are q013 (cap/hat) and q127 (red/big). Both come from distractors that are themselves valid answers, so the choice set needs rewriting.
2. **Ambiguous wording of a counting unit.** q245 uses "parts" for both syllables and sounds. The sibling items q246 and q247 use syllables, so the pilot should use "syllables" or "sounds" explicitly.
3. **Duplicate items.** Six groups repeat the exact same stem and choice set, which is 21 items and 15 redundant copies. They are: q149/q152/q329/q350/q353 ("Please say that ___"), q150/q153/q330/q351/q354 ("This gift is ___ Mom"), q151/q154/q331/q352/q355 ("Please ___ at the red light"), q155/q338 ("Please ___ the cup"), q156/q339 ("The bird flew ___"), and q157/q340 ("___ is at the door?"). All of them pass, and they are kept in the checked file because they are valid. Deduplicating before release is recommended.
4. **Same concept repeated.** Several word-meaning items test the same word with different stems, for example "animal that says oink" (q081, q087, q325), "rest on a chair" (q088, q328), "thing you sleep on" (q291, q324), "jump on one foot" (q093, q101), "deep thing you cook soup in" (q095, q100), and "sweet food for a birthday" (q114, q289, q415).
5. **Missing intended answer.** q335 "The cat sat ___ the mat." offers by/four/think/her. The intended word "on" is missing. "by" makes a sensible sentence, so the item passes, but it does not test the target word.
6. **Informal distractors.** "dont" (q143, q237) and "isnt" (q238) are not standard contractions. The key is correct, but a child may see them as acceptable.
7. **Vague relation stems.** "Which word goes with cat?" (q233) and "Which word goes with day?" (q234) are vague. Each has only one related choice, so they pass.
8. **Text-only picture stems.** The pilot has no pictures. Many "picture_to_word" items depend on a stem that describes the picture (for example q127, which is the ambiguous one). Items with clear one-word definitions work; items that describe a scene loosely are the risky ones.
9. **Vocabulary above Grade 1.** Some items use terms or words that are hard for a 6-7 year old ESL learner, even when the stem defines them: prefixes (q428, q429), "caption" and "title" (q464, q465), "damp" (q439), "tiny" (q438), and tense and proper-noun labels. These are clear and pass, but they may be too advanced for the target age.
10. **Sort and order formats.** Sort items (bins) and order items use a `A → bin` or `A, C, B` answer format. The keys match the blind answers after normalisation, so this is a presentation note, not a defect.

## Files

- `pilot/check/haiku_results.json`: per item, blind answer, key, match flag, verdict, and reason.
- `pilot/grade1_pilot_checked.txt`: the 494 passing items in the same layout as `grade1_pilot_500.txt`, with numbering restarted per heading and all 198 headings kept.
- `pilot/check/REJECTED.txt`: the six fails, one line each.
- `pilot/check/CHECK_SUMMARY.md`: this file.
