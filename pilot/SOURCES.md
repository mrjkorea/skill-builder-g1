# Sources for the Grade 1 pilot

Words and sounds in this pilot come from these files. The generator reads them. It does not use the old question bank in `grade1/pack`.

## CMU Pronouncing Dictionary

- Project: [cmusphinx/cmudict](https://github.com/cmusphinx/cmudict)
- File: `pilot/sources/cmudict.dict`
- Downloaded from the raw master file: `https://raw.githubusercontent.com/cmusphinx/cmudict/master/cmudict.dict`
- The citation form is the first pronunciation of a headword. Comment text after `#` is ignored. A second stress-1 vowel, such as read as EH or IY, drops a vowel-identity claim. An unstressed extra pronunciation does not.

## Fry sight words

- File: `pilot/sources/fry-1000.txt`
- Downloaded from `https://raw.githubusercontent.com/scholarly/words/master/incoming/fry's%201000%20most%20frequent%20words.txt`
- Only the first, second, and third hundreds are used (300 words).

## Dolch sight words

- File: `pilot/sources/dolch-wikipedia.html`
- Page: [Dolch word list](https://en.wikipedia.org/wiki/Dolch_word_list)
- Used lists: pre-primer (40), primer (52), and 1st grade (41). The grade 1 list on this page includes "going".
- Dolch nouns on the same page are allowed as common content words.
- Grade 2 and grade 3 Dolch words are not in the general pool. A sight-word skill may still use a word that its own title lists.
- `pilot/sources/dolch-readwritethink.pdf` is the ReadWriteThink Dolch list (`https://www.readwritethink.org/sites/default/files/resources/lesson_images/lesson301/dolchwordlist.pdf`). This environment has no `pdftotext`, so that PDF was not parsed. The Wikipedia lists were used instead.

## Grade 1 words

A content word may be a Dolch pre-primer, primer, or grade 1 word, a Fry first-300 word, a Dolch noun, or a common CVC or decodable word. Every phonics claim is checked against the CMUdict citation form before it is kept.
