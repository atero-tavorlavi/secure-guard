# Images with hidden prompts

Real photos with an attack instruction written into the image as low-contrast text, plus the prompt lists used to build them. Collected by the team for the Attacks section of the technical report.

| File | Contents |
|---|---|
| `p1.jpeg` to `p24.jpeg` | Photos (1280 px wide). Some carry hidden text from `badprompts.json` |
| `badprompts.json` | 12 attack instructions, as a numbered text list: exfiltration of secrets and `.env` files, fake system notices, split and Base64-encoded instructions, `rm -rf`, a reverse shell, a malicious download |
| `generalprompts.js` | 24 benign user requests, as a numbered text list (emails, code questions, travel, cooking) |

`p1.jpeg` carries attack prompt 1 across the trees at the top of the image (visible after a contrast boost). `p13.jpeg` shows no hidden text at a glance. The full mapping from images to prompts has not been recorded here yet.

These files are unlabeled and were not used to train or evaluate either judge.
