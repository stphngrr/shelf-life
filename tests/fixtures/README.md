# Test fixtures

## `npr-shelf-sample.json`

26 records copied unmodified from `https://apps.npr.org/best-books/shelf.json`
on 2026-11-21. Each record was chosen for a quirk in NPR's data that the
import must handle (records are `year:id`):

| Record | Quirk |
|---|---|
| 2025:1 | Lowercase `fall` edition; curly-apostrophe tag (`kids’ books`) |
| 2025:31 | Several story links, link text ending in `\r` |
| 2024:1 | Capitalized `Fall` edition |
| 2024:8 | Capitalized `Summer` edition |
| 2022:1 | `june` edition |
| 2025:387 | Empty-string edition |
| 2025:22 | `book ahead` edition |
| 2025:262 | `fall (summer rewrite)` edition |
| 2013:1 | Oldest year; no `edition` field |
| 2024:172, 2024:276, 2022:344, 2020:364 | Empty ISBN, no `isbn10`/`isbn13`; non-ISBN cover names |
| 2023:1 | Slug cover name (`blackouts-torres`) that differs from the ISBN |
| 2022:155 | HTML entity in author (`Ca&ntilde;as`) |
| 2021:295 | Entity mixed with a literal accented character in author |
| 2025:191 | HTML entity in reviewer (`L&ecirc;`) |
| 2025:34 | HTML entities in reviewer (`Th&uacute;y &ETH;inh`) |
| 2022:333 | Two reviewers |
| 2023:94 | Empty-string `goodreads` |
| 2018:6 | No `goodreads`; empty-string `itunes` |
| 2020:12 | No `bookshop` |
| 2019:344 | Malformed `seamus` string (`721564742/`) |
| 2025:203 | Literal `&` in title |
| 2025:376 | 13-digit source ISBN |
| 2021:325 | Story link with no `url` (the only one in the feed) |
