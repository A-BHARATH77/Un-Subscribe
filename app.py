"""
Simple desktop interface for the unsubscribe pipeline.

Workflow:
1. Opens a small window asking for a Gemini API key (used by stage2.py)
2. On "Start", runs stage1.py -> stage2.py -> unsub.py in order, passing
   the API key to stage2 via environment variable
3. Streams live output from each stage into the window
4. Shows a final summary when everything finishes

Assumes credentials.json (Gmail API) is already present in this folder.

Setup:
  pip install playwright google-genai google-auth-oauthlib google-auth-httplib2 google-api-python-client beautifulsoup4 requests
  playwright install chromium

Usage:
  python app.py
"""

import os
import queue
import subprocess
import sys
import threading
import tkinter as tk
from tkinter import messagebox, scrolledtext, ttk

STAGES = [
    ("Stage 1 - Finding unsubscribe links", "stage1.py"),
    ("Stage 2 - Completing unsubscribe pages", "stage2.py"),
    ("Stage 3 - Gmail Manage Subscriptions", "unsub.py"),
]


class UnsubApp:
    def __init__(self, root):
        self.root = root
        self.root.title("UnsubHero - Automated Unsubscribe")
        self.root.geometry("640x520")
        self.output_queue = queue.Queue()
        self.pipeline_running = False

        self._build_api_key_screen()

    # ---------- Screen 1: API key entry ----------

    def _build_api_key_screen(self):
        self.key_frame = ttk.Frame(self.root, padding=24)
        self.key_frame.pack(fill="both", expand=True)

        ttk.Label(
            self.key_frame, text="Enter your Gemini API key",
            font=("Segoe UI", 13, "bold"),
        ).pack(anchor="w", pady=(0, 4))

        ttk.Label(
            self.key_frame,
            text="Get a free key at aistudio.google.com/app/apikey\n"
                 "This is used by Stage 2 to decide how to fill out unsubscribe pages.",
            foreground="gray",
        ).pack(anchor="w", pady=(0, 16))

        self.key_var = tk.StringVar()
        key_entry = ttk.Entry(self.key_frame, textvariable=self.key_var, show="*", width=60)
        key_entry.pack(fill="x", pady=(0, 16))
        key_entry.focus()

        self.show_key_var = tk.BooleanVar()
        ttk.Checkbutton(
            self.key_frame, text="Show key", variable=self.show_key_var,
            command=lambda: key_entry.config(show="" if self.show_key_var.get() else "*"),
        ).pack(anchor="w", pady=(0, 16))

        ttk.Button(
            self.key_frame, text="Start", command=self._on_start_clicked,
        ).pack(anchor="e")

        # Pressing Enter in the field also starts the pipeline.
        key_entry.bind("<Return>", lambda e: self._on_start_clicked())

    def _on_start_clicked(self):
        api_key = self.key_var.get().strip()
        if not api_key:
            messagebox.showwarning("API key required", "Please paste your Gemini API key to continue.")
            return

        os.environ["GEMINI_API_KEY"] = api_key
        self.key_frame.destroy()
        self._build_progress_screen()
        self._start_pipeline()

    # ---------- Screen 2: progress / live output ----------

    def _build_progress_screen(self):
        self.progress_frame = ttk.Frame(self.root, padding=16)
        self.progress_frame.pack(fill="both", expand=True)

        self.status_label = ttk.Label(
            self.progress_frame, text="Starting...", font=("Segoe UI", 12, "bold"),
        )
        self.status_label.pack(anchor="w", pady=(0, 8))

        self.log_box = scrolledtext.ScrolledText(
            self.progress_frame, wrap="word", height=24, font=("Consolas", 9),
        )
        self.log_box.pack(fill="both", expand=True)
        self.log_box.configure(state="disabled")

    def _append_log(self, text):
        self.log_box.configure(state="normal")
        self.log_box.insert("end", text)
        self.log_box.see("end")
        self.log_box.configure(state="disabled")

    # ---------- Pipeline execution ----------

    def _start_pipeline(self):
        self.pipeline_running = True
        thread = threading.Thread(target=self._run_pipeline_thread, daemon=True)
        thread.start()
        self.root.after(150, self._poll_output_queue)

    def _run_pipeline_thread(self):
        results_summary = []

        for label, script in STAGES:
            self.output_queue.put(("status", f"Running: {label}"))
            self.output_queue.put(("log", f"\n{'=' * 50}\n{label} ({script})\n{'=' * 50}\n"))

            if not os.path.exists(script):
                self.output_queue.put(("log", f"  Skipped - {script} not found in this folder.\n"))
                results_summary.append((label, "not found"))
                continue

            try:
                env = os.environ.copy()
                env["PYTHONIOENCODING"] = "utf-8"  # prevents crashes on emoji/unicode in email subjects
                process = subprocess.Popen(
                    [sys.executable, script],
                    stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                    text=True, bufsize=1,
                    encoding="utf-8", errors="replace",
                    env=env,
                )
                for line in process.stdout:
                    self.output_queue.put(("log", line))
                process.wait()

                if process.returncode == 0:
                    results_summary.append((label, "completed"))
                else:
                    results_summary.append((label, f"exited with code {process.returncode}"))
            except Exception as e:
                self.output_queue.put(("log", f"  Error running {script}: {e}\n"))
                results_summary.append((label, f"error: {e}"))

        self.output_queue.put(("done", results_summary))

    def _poll_output_queue(self):
        try:
            while True:
                kind, payload = self.output_queue.get_nowait()
                if kind == "log":
                    self._append_log(payload)
                elif kind == "status":
                    self.status_label.config(text=payload)
                elif kind == "done":
                    self._show_final_summary(payload)
                    return
        except queue.Empty:
            pass

        if self.pipeline_running:
            self.root.after(150, self._poll_output_queue)

    def _show_final_summary(self, results_summary):
        self.pipeline_running = False
        self.status_label.config(text="All stages finished")

        summary_lines = ["\n" + "=" * 50, "SUMMARY", "=" * 50]
        for label, outcome in results_summary:
            summary_lines.append(f"{label}: {outcome}")
        summary_lines.append(
            "\nCheck unsubscribe_links.json, unsubscribe_results.json, and "
            "manage_subscriptions_click_results.json in this folder for full details."
        )
        self._append_log("\n".join(summary_lines) + "\n")


def main():
    root = tk.Tk()
    UnsubApp(root)
    root.mainloop()


if __name__ == "__main__":
    main()