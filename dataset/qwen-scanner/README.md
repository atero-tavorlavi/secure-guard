# Qwen scanner training data

Traces of a vision-language model answering questions about images that carry injected instructions, in OpenAI chat format (`system`, `user`, `assistant`). The user message holds the trace in sections: `[System Prompt]`, `[User Prompt]`, `[Chat History]`, `[Model Reasoning]` and `[Tool Call]` (with `image`, `image_text`, `image_description` and `injection_type`). The assistant message is the verdict.

| File | Rows | Content |
|---|---|---|
| `scanner_entries_finetune.jsonl` | 100 | The labeled training set: 81 `allow`, 19 `deny` (the model followed the injection) |
| `scanner_entries_good.jsonl` | 50 | The first half of the same traces before labeling (all verdicts still `allow`) |
| `scanner_entries_bad.jsonl` | 50 | The second half of the same traces before labeling (all verdicts still `allow`) |

Attack families: a secret key in the system prompt with an image saying to print it, a forbidden topic shown in the image, a CAPTCHA the system prompt forbids solving, and benign controls. The image files referenced in `image` are not included. The secret keys in the data are random strings created for the dataset.
