# Qwen scanner LoRA adapter (first approach)

LoRA adapter for **Qwen3.5-2B** that turns it into a judge: given a trace (system prompt, user prompt, chat history, model reasoning, tool call with the image text) it answers `{"verdict": "allow"}` or `{"verdict": "deny", "reason": "..."}`. It was trained on the 100 labeled traces in `dataset/qwen-scanner/scanner_entries_finetune.jsonl`. This is the adapter before merging into the base weights.

| Setting | Value |
|---|---|
| Base model | Qwen3.5-2B |
| Method | LoRA (PEFT format) |
| Rank / alpha / dropout | 8 / 16 / 0.0 |
| Target modules | q_proj, k_proj, v_proj, o_proj, gate_proj, up_proj, down_proj, in_proj_qkv, in_proj_z, out_proj |

`adapter_config.json` still holds the absolute base-model path from the training machine. Pass the base model explicitly when loading:

```python
from peft import PeftModel
from transformers import AutoModelForImageTextToText, AutoTokenizer

base = AutoModelForImageTextToText.from_pretrained("Qwen/Qwen3.5-2B", torch_dtype="bfloat16")
model = PeftModel.from_pretrained(base, "models/qwen-scanner-lora")
tokenizer = AutoTokenizer.from_pretrained("Qwen/Qwen3.5-2B")
```

To get a single model, call `model.merge_and_unload()` and save it.
