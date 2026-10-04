# Running the Llama-3.2-Vision image hijacks

Adapted from [image-hijacks](https://github.com/euanong/image-hijacks) to target `meta-llama/Llama-3.2-11B-Vision-Instruct` instead of LLaVA. This is the optimization-based attack described in the Attacks section of the technical report. We could not run it to completion (see "Status" below).

Requires: Linux, one GPU with >= 48 GB VRAM (80 GB recommended), ~150 GB disk, Python 3.10+.

## 1. Install

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip

# Match the index-url to your CUDA version (see `nvidia-smi`). This is CUDA 12.1.
pip install torch --index-url https://download.pytorch.org/whl/cu121

pip install "transformers>=4.45" "lightning>=2.1" torchopt accelerate \
  datasets pillow einops jaxtyping wandb tqdm matplotlib \
  levenshtein prettyprinter expecttest
```

## 2. Authenticate

Llama-3.2-Vision is gated. Accept the license at https://huggingface.co/meta-llama/Llama-3.2-11B-Vision-Instruct, then:

```bash
hf auth login
```

Verify access (downloads one small file):

```bash
hf download meta-llama/Llama-3.2-11B-Vision-Instruct config.json
```

## 3. List jobs

```bash
python experiments/exp_mllama/config.py
```

Prints the numbered sweep. Job 0 is `mllama_sanity` (unconstrained, single fixed context). Run it first: it should reach about 100% accuracy within a few hundred steps. Jobs 1 to 8 are the real sweep: 2 attacks x 4 epsilon values.

## 4. Run a job

```bash
python run.py train \
  --config_path experiments/exp_mllama/config.py \
  --log_dir experiments/exp_mllama/logs \
  --job_id 0 \
  --playground
```

Change `--job_id` to select the job. `--playground` disables Weights & Biases (TensorBoard still logs everything). Drop it to enable W&B, which also records per-example generation tables.

Long runs should go in tmux, since an SSH disconnect kills a foreground job:

```bash
tmux new -s hijack
# inside: source .venv/bin/activate, then the run.py command above
# detach with Ctrl-b d, reattach with: tmux attach -t hijack
```

## 5. Outputs

Under `experiments/exp_mllama/logs/<run_name>/<version>/`:

- `imgs/img_<step>.png`: the adversarial image, saved at every validation
- `checkpoints/`: top 5 by `val_avg_acc`, plus `last.ckpt` (stores only the learned image, not the model weights)
- TensorBoard event files: `tensorboard --logdir experiments/exp_mllama/logs`

Evaluation generates text from the quantised (PNG-representable) image and scores it with the attack's success criterion, so reported accuracy reflects an image you can actually save to disk.

## Notes

- Jobs 1 to 8 default to one epoch over ~118k examples at batch size 1. Reduce `alpaca_llava_train_split_size` in the config for a shorter run.
- Gradient checkpointing is unavailable: the gradient path runs under `torch.func.grad_and_value`, which is incompatible with it.
- If validation runs out of memory, lower `eval_batch_size` in `experiments/exp_mllama/config.py`.

## Status

The job never ran to completion. The students' GPU partition on the university cluster only has Titan Xp and RTX 2080 cards (about 11 GB). The run failed with `torch.OutOfMemoryError` after filling 10.47 of 10.57 GiB. The cluster's 80 GB H100 cards are in a partition our account cannot access, and the AWS account had no budget left.
