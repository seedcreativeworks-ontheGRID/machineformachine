# Narration audio

`how-to-use.mp3` is the narration the docked player rail (under the title
on the main page) plays. `how-to-use-script.txt` in this folder is the
script it reads — keep them in sync if you re-record it.

To replace it: generate a new file at this same path,
`public/audio/how-to-use.mp3`, and it's picked up automatically — no code
changes needed.

If this file is ever missing, the player rail fails gracefully: it
disables itself instead of erroring the page.
