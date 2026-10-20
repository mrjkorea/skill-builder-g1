# English Skill Builder (MRJ)

GitHub Pages: https://mrjkorea.github.io/skill-builder-g1/

- **Level chooser** at the site root (`index.html`)
- **Grade 1** — `grade1/`
- **Grade 2** — `grade2/`
- **Seed** — `levels/seed/`
- **Roots** — `levels/roots/`
- **Sprout** — `levels/sprout/`

Seed, Roots, and Sprout read `questions.jsonl` and `manifest.json` in each folder. Sound is the pre-made mp3 clips only. Progress for those levels saves in the cloud under `skill-builder-seed`, `skill-builder-roots`, and `skill-builder-sprout`.

Students sign in with **MRJ Sign-In** (`mrj-auth.js`). Progress saves to the cloud under program **`skill-builder`** (`save_pack` / `load_pack`). Scores use `mrj-scores.js` + Classroom Metrics like other MRJ apps.

House: W.A.I.T. 4 LANGUAGES / MRJ English
