# Narration audio

Drop the generated narration file here as:

```
public/audio/how-to-use.mp3
```

That exact path is what the "🔊 HOW TO USE THIS" button (top of the main
page, under the title) plays. `how-to-use-script.txt` in this folder is
the script it should read — feed that text to whatever TTS tool you're
using to generate the MP3.

Until the file exists at that path, the button fails gracefully: it shows
"⚠ AUDIO NOT FOUND" and disables itself instead of erroring the page.
