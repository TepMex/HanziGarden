# Mandarin pinyin audio

The MP3 files in this directory are the 64 kbit/s syllable recordings from
[`hugolpz/audio-cmn`](https://github.com/hugolpz/audio-cmn/tree/master/64k/syllabs).
Character-to-syllable assignment lives in `src/data/pinyinAudio.json` and
follows the displayed keyword (see GAME_SPEC §5.1), not the workbook's
`reading_rank`.

The recordings are CC BY-SA. The upstream project credits speaker Chen Wang;
Hugo Lopez (PLIDAM, INALCO) managed the project, post-processing, compression,
and file naming.

Neutral-tone entries reuse the corresponding tone-1 recording when no tone-5
file exists, following the upstream README note that removed tone-5 files
were duplicates. `ju4` uses upstream `cmn-jv4.mp3`. `yo1` and `yo5` have no
matching upstream recording, so `哟` retains its pinyin metadata but playback is
not substituted with an incorrect syllable.
