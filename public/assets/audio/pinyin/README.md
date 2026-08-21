# Mandarin pinyin audio

The MP3 files in this directory are the 64 kbit/s syllable recordings selected
by `rsh_audio_cmn_syllables.xlsx` from
[`hugolpz/audio-cmn`](https://github.com/hugolpz/audio-cmn/tree/master/64k/syllabs).

The recordings are CC BY-SA. The upstream project credits speaker Chen Wang;
Hugo Lopez (PLIDAM, INALCO) managed the project, post-processing, compression,
and file naming.

The workbook contains a few logical names that are absent from the current
upstream tree. Neutral-tone entries reuse the corresponding tone-1 recording,
following the upstream README note that removed tone-5 files were duplicates.
The upstream `cmn-jv4.mp3` supplies the workbook's normalized `ju4` entry.
`yo1` and `yo5` have no matching upstream recording and are not substituted
with an incorrect syllable.
