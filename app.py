"""
UnsubHero desktop app.

Tabs:
- Settings : import Gmail credentials.json, save/clear Gemini API key, clear all stored data
- Run      : start the 3-stage pipeline
- Logs     : live output from whichever stage is running
- History  : every past run, with stage results, stored locally in SQLite

Where things are stored (per-machine, not per-project-folder):
  Windows: %APPDATA%\\UnsubHero\\
  Mac/Linux: ~/.unsubhero/
    credentials.json   - copied in via Settings tab
    token.json         - created automatically after first Gmail OAuth
    history.db         - SQLite run history
Gemini API key is stored in the OS credential vault via `keyring`
(Windows Credential Manager / macOS Keychain), never as a plain file.

Setup:
  pip install keyring playwright google-genai google-auth-oauthlib
              google-auth-httplib2 google-api-python-client beautifulsoup4 requests
  playwright install chromium

Usage:
  python app.py
"""

import json
import os
import platform
import queue
import shutil
import sqlite3
import subprocess
import sys
import threading
import tkinter as tk
from datetime import datetime
from tkinter import filedialog, messagebox, scrolledtext, ttk

import keyring

APP_NAME = "UnsubHero"
KEYRING_SERVICE = "UnsubHero"
KEYRING_KEY_NAME = "gemini_api_key"

STAGES = [
    ("Stage 1 - Finding unsubscribe links", "stage1"),
    ("Stage 2 - Completing unsubscribe pages", "stage2"),
    ("Stage 3 - Gmail Manage Subscriptions", "unsub"),
]


def get_stage_command(stage_name):
    """In dev mode (running app.py directly with python), runs the .py
    script with the current interpreter. In packaged mode (running as a
    PyInstaller-built UnsubHero.exe), runs the sibling .exe built for that
    stage instead - there's no Python interpreter to call .py files with
    once everything is frozen."""
    if getattr(sys, "frozen", False):
        exe_dir = os.path.dirname(sys.executable)
        exe_path = os.path.join(exe_dir, f"{stage_name}.exe")
        return [exe_path], exe_path
    else:
        script_path = f"{stage_name}.py"
        return [sys.executable, script_path], script_path


def get_app_data_dir():
    system = platform.system()
    if system == "Windows":
        base = os.environ.get("APPDATA", os.path.expanduser("~"))
        path = os.path.join(base, APP_NAME)
    else:
        path = os.path.join(os.path.expanduser("~"), f".{APP_NAME.lower()}")
    os.makedirs(path, exist_ok=True)
    return path


APP_DATA_DIR = get_app_data_dir()
CREDENTIALS_PATH = os.path.join(APP_DATA_DIR, "credentials.json")
TOKEN_PATH = os.path.join(APP_DATA_DIR, "token.json")
DB_PATH = os.path.join(APP_DATA_DIR, "history.db")


def init_db():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS runs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            started_at TEXT,
            finished_at TEXT,
            stage1_status TEXT,
            stage2_status TEXT,
            stage3_status TEXT
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS unsubscribed_senders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            run_id INTEGER,
            sender TEXT,
            source TEXT,
            FOREIGN KEY (run_id) REFERENCES runs(id)
        )
    """)
    conn.commit()
    conn.close()


def save_run(started_at, finished_at, statuses):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.execute(
        "INSERT INTO runs (started_at, finished_at, stage1_status, stage2_status, stage3_status) "
        "VALUES (?, ?, ?, ?, ?)",
        (started_at, finished_at, statuses.get(0, "-"), statuses.get(1, "-"), statuses.get(2, "-")),
    )
    run_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return run_id


def save_unsubscribed_senders(run_id, senders_with_source):
    """senders_with_source: list of (sender_name, source_label) tuples,
    e.g. ('Zara <zara@news.zara.com>', 'Stage 2') or
    ('Wayfair | Welcome', 'Stage 3')."""
    if not senders_with_source:
        return
    conn = sqlite3.connect(DB_PATH)
    conn.executemany(
        "INSERT INTO unsubscribed_senders (run_id, sender, source) VALUES (?, ?, ?)",
        [(run_id, sender, source) for sender, source in senders_with_source],
    )
    conn.commit()
    conn.close()


def load_senders_for_run(run_id):
    conn = sqlite3.connect(DB_PATH)
    rows = conn.execute(
        "SELECT sender, source FROM unsubscribed_senders WHERE run_id = ? ORDER BY id", (run_id,)
    ).fetchall()
    conn.close()
    return rows


def load_runs():
    conn = sqlite3.connect(DB_PATH)
    rows = conn.execute(
        "SELECT id, started_at, finished_at, stage1_status, stage2_status, stage3_status "
        "FROM runs ORDER BY id DESC"
    ).fetchall()
    conn.close()
    return rows


class UnsubApp:
    def __init__(self, root):
        self.root = root
        self.root.title(f"{APP_NAME} - Automated Unsubscribe")
        self.root.geometry("760x600")
        self.output_queue = queue.Queue()
        self.pipeline_running = False

        init_db()

        notebook = ttk.Notebook(root)
        notebook.pack(fill="both", expand=True)

        self.settings_tab = ttk.Frame(notebook, padding=20)
        self.run_tab = ttk.Frame(notebook, padding=20)
        self.logs_tab = ttk.Frame(notebook, padding=10)
        self.history_tab = ttk.Frame(notebook, padding=10)

        notebook.add(self.settings_tab, text="Settings")
        notebook.add(self.run_tab, text="Run")
        notebook.add(self.logs_tab, text="Logs")
        notebook.add(self.history_tab, text="History")

        self.notebook = notebook
        self._build_settings_tab()
        self._build_run_tab()
        self._build_logs_tab()
        self._build_history_tab()

    # ---------------- Settings tab ----------------

    def _build_settings_tab(self):
        f = self.settings_tab

        ttk.Label(f, text="Gmail Credentials", font=("Segoe UI", 11, "bold")).grid(
            row=0, column=0, sticky="w", pady=(0, 4)
        )
        cred_status = "Loaded" if os.path.exists(CREDENTIALS_PATH) else "Not set"
        self.cred_status_var = tk.StringVar(value=f"Status: {cred_status}")
        ttk.Label(f, textvariable=self.cred_status_var, foreground="gray").grid(
            row=1, column=0, sticky="w", pady=(0, 4)
        )
        ttk.Button(f, text="Import credentials.json", command=self._import_credentials).grid(
            row=2, column=0, sticky="w", pady=(0, 20)
        )

        ttk.Separator(f).grid(row=3, column=0, columnspan=2, sticky="ew", pady=10)

        ttk.Label(f, text="Gemini API Key", font=("Segoe UI", 11, "bold")).grid(
            row=4, column=0, sticky="w", pady=(0, 4)
        )
        ttk.Label(
            f, text="Get a free key at aistudio.google.com/app/apikey",
            foreground="gray",
        ).grid(row=5, column=0, sticky="w", pady=(0, 8))

        self.key_var = tk.StringVar(value=self._load_saved_key() or "")
        self.key_entry = ttk.Entry(f, textvariable=self.key_var, show="*", width=50)
        self.key_entry.grid(row=6, column=0, sticky="w")

        self.show_key_var = tk.BooleanVar()
        ttk.Checkbutton(
            f, text="Show key", variable=self.show_key_var,
            command=lambda: self.key_entry.config(show="" if self.show_key_var.get() else "*"),
        ).grid(row=6, column=1, padx=(8, 0))

        ttk.Button(f, text="Save Key", command=self._save_key).grid(row=7, column=0, sticky="w", pady=(8, 20))

        ttk.Separator(f).grid(row=8, column=0, columnspan=2, sticky="ew", pady=10)

        ttk.Label(f, text="Stored Data", font=("Segoe UI", 11, "bold")).grid(
            row=9, column=0, sticky="w", pady=(0, 4)
        )
        ttk.Label(
            f, text=f"Location: {APP_DATA_DIR}", foreground="gray",
        ).grid(row=10, column=0, sticky="w", pady=(0, 12))

        ttk.Button(f, text="Clear API Key", command=self._clear_api_key).grid(
            row=11, column=0, sticky="w", pady=(0, 4)
        )
        ttk.Button(f, text="Clear Gmail Credentials", command=self._clear_credentials).grid(
            row=12, column=0, sticky="w", pady=(0, 4)
        )
        ttk.Button(f, text="Clear Login Session", command=self._clear_login_session).grid(
            row=13, column=0, sticky="w", pady=(0, 4)
        )
        ttk.Button(f, text="Clear Run History", command=self._clear_history).grid(
            row=14, column=0, sticky="w", pady=(0, 4)
        )
        ttk.Separator(f).grid(row=15, column=0, columnspan=2, sticky="ew", pady=10)
        ttk.Button(
            f, text="Clear Everything (start fresh for a different account)",
            command=self._clear_everything,
        ).grid(row=16, column=0, sticky="w")

    def _clear_api_key(self):
        if not messagebox.askyesno("Confirm", "Remove the saved Gemini API key?"):
            return
        try:
            keyring.delete_password(KEYRING_SERVICE, KEYRING_KEY_NAME)
        except Exception:
            pass
        self.key_var.set("")
        messagebox.showinfo("Cleared", "API key removed.")

    def _clear_credentials(self):
        if not messagebox.askyesno(
            "Confirm", "Remove the imported Gmail credentials.json?\n\n"
                       "You'll need to import it again before running Stage 1."
        ):
            return
        if os.path.exists(CREDENTIALS_PATH):
            os.remove(CREDENTIALS_PATH)
        self.cred_status_var.set("Status: Not set")
        messagebox.showinfo("Cleared", "Gmail credentials removed.")

    def _clear_login_session(self):
        if not messagebox.askyesno(
            "Confirm", "Sign out of the Gmail account used for Stage 1 (token.json) and "
                       "Stage 3 (browser login session)?\n\n"
                       "Use this if you want to run the pipeline against a DIFFERENT "
                       "Gmail account next time."
        ):
            return
        if os.path.exists(TOKEN_PATH):
            os.remove(TOKEN_PATH)
        gmail_profile = os.path.join(APP_DATA_DIR, "gmail_browser_profile")
        if os.path.exists(gmail_profile):
            shutil.rmtree(gmail_profile, ignore_errors=True)
        messagebox.showinfo(
            "Cleared", "Login sessions cleared. The next run will ask you to log in again."
        )

    def _clear_history(self):
        if not messagebox.askyesno(
            "Confirm", "Delete all run history and unsubscribed-sender records?\n\n"
                       "This cannot be undone."
        ):
            return
        if os.path.exists(DB_PATH):
            os.remove(DB_PATH)
        init_db()
        self._refresh_history()
        messagebox.showinfo("Cleared", "Run history removed.")

    def _clear_everything(self):
        if not messagebox.askyesno(
            "Confirm",
            "This removes the API key, Gmail credentials, login sessions, AND history "
            "in one step - typically used to fully reset before switching to a different "
            "client/Gmail account. Continue?",
        ):
            return
        try:
            keyring.delete_password(KEYRING_SERVICE, KEYRING_KEY_NAME)
        except Exception:
            pass
        for path in (CREDENTIALS_PATH, TOKEN_PATH, DB_PATH):
            if os.path.exists(path):
                os.remove(path)
        gmail_profile = os.path.join(APP_DATA_DIR, "gmail_browser_profile")
        if os.path.exists(gmail_profile):
            shutil.rmtree(gmail_profile, ignore_errors=True)
        init_db()
        self.key_var.set("")
        self.cred_status_var.set("Status: Not set")
        self._refresh_history()
        messagebox.showinfo("Cleared", "Everything has been reset.")

    def _import_credentials(self):
        path = filedialog.askopenfilename(
            title="Select credentials.json", filetypes=[("JSON files", "*.json")]
        )
        if not path:
            return
        try:
            with open(path) as fh:
                json.load(fh)  # validates it's real JSON before copying
            shutil.copy(path, CREDENTIALS_PATH)
            self.cred_status_var.set("Status: Loaded")
            messagebox.showinfo("Success", "credentials.json imported.")
        except Exception as e:
            messagebox.showerror("Import failed", str(e))

    def _load_saved_key(self):
        try:
            return keyring.get_password(KEYRING_SERVICE, KEYRING_KEY_NAME)
        except Exception:
            return None

    def _save_key(self):
        key = self.key_var.get().strip()
        if not key:
            messagebox.showwarning("Empty key", "Please paste a Gemini API key first.")
            return
        keyring.set_password(KEYRING_SERVICE, KEYRING_KEY_NAME, key)
        messagebox.showinfo("Saved", "Gemini API key saved locally.")

    # ---------------- Run tab ----------------

    def _build_run_tab(self):
        f = self.run_tab
        ttk.Label(f, text="Run the unsubscribe pipeline", font=("Segoe UI", 12, "bold")).pack(
            anchor="w", pady=(0, 8)
        )
        ttk.Label(
            f, text="Runs Stage 1 -> Stage 2 -> Stage 3 in order. Check the Logs tab for live output.",
            foreground="gray", wraplength=600, justify="left",
        ).pack(anchor="w", pady=(0, 16))

        self.start_button = ttk.Button(f, text="Start", command=self._on_start_clicked)
        self.start_button.pack(anchor="w")

        self.run_status_var = tk.StringVar(value="Idle")
        ttk.Label(f, textvariable=self.run_status_var, font=("Segoe UI", 10, "bold")).pack(
            anchor="w", pady=(16, 0)
        )

    def _on_start_clicked(self):
        if self.pipeline_running:
            return

        api_key = self._load_saved_key()
        if not api_key:
            messagebox.showwarning(
                "Gemini API key required", "Please save a Gemini API key in the Settings tab first."
            )
            self.notebook.select(self.settings_tab)
            return

        if not os.path.exists(CREDENTIALS_PATH):
            messagebox.showwarning(
                "Gmail credentials required", "Please import credentials.json in the Settings tab first."
            )
            self.notebook.select(self.settings_tab)
            return

        os.environ["GEMINI_API_KEY"] = api_key
        self.notebook.select(self.logs_tab)
        self._clear_log()
        self.start_button.config(state="disabled")
        self.run_status_var.set("Running...")
        self._start_pipeline()

    # ---------------- Logs tab ----------------

    def _build_logs_tab(self):
        self.log_box = scrolledtext.ScrolledText(
            self.logs_tab, wrap="word", font=("Consolas", 9),
        )
        self.log_box.pack(fill="both", expand=True)
        self.log_box.configure(state="disabled")

    def _append_log(self, text):
        self.log_box.configure(state="normal")
        self.log_box.insert("end", text)
        self.log_box.see("end")
        self.log_box.configure(state="disabled")

    def _clear_log(self):
        self.log_box.configure(state="normal")
        self.log_box.delete("1.0", "end")
        self.log_box.configure(state="disabled")

    # ---------------- History tab ----------------

    def _build_history_tab(self):
        paned = ttk.PanedWindow(self.history_tab, orient="vertical")
        paned.pack(fill="both", expand=True)

        # Top: list of runs
        runs_frame = ttk.Frame(paned)
        ttk.Label(runs_frame, text="Runs", font=("Segoe UI", 10, "bold")).pack(anchor="w")
        columns = ("started", "finished", "stage1", "stage2", "stage3")
        self.history_tree = ttk.Treeview(runs_frame, columns=columns, show="headings", height=8)
        headings = {
            "started": "Started", "finished": "Finished",
            "stage1": "Stage 1", "stage2": "Stage 2", "stage3": "Stage 3",
        }
        for col in columns:
            self.history_tree.heading(col, text=headings[col])
            self.history_tree.column(col, width=130)
        self.history_tree.pack(fill="both", expand=True, side="left")
        runs_scroll = ttk.Scrollbar(runs_frame, orient="vertical", command=self.history_tree.yview)
        runs_scroll.pack(side="right", fill="y")
        self.history_tree.configure(yscrollcommand=runs_scroll.set)
        self.history_tree.bind("<<TreeviewSelect>>", self._on_history_row_selected)
        paned.add(runs_frame, weight=1)

        # Bottom: senders unsubscribed in the selected run
        senders_frame = ttk.Frame(paned)
        ttk.Label(senders_frame, text="Unsubscribed senders for selected run",
                  font=("Segoe UI", 10, "bold")).pack(anchor="w")
        sender_columns = ("sender", "source")
        self.senders_tree = ttk.Treeview(senders_frame, columns=sender_columns, show="headings", height=8)
        self.senders_tree.heading("sender", text="Sender")
        self.senders_tree.heading("source", text="Handled by")
        self.senders_tree.column("sender", width=400)
        self.senders_tree.column("source", width=120)
        self.senders_tree.pack(fill="both", expand=True, side="left")
        senders_scroll = ttk.Scrollbar(senders_frame, orient="vertical", command=self.senders_tree.yview)
        senders_scroll.pack(side="right", fill="y")
        self.senders_tree.configure(yscrollcommand=senders_scroll.set)
        paned.add(senders_frame, weight=1)

        self._refresh_history()

    def _refresh_history(self):
        for row in self.history_tree.get_children():
            self.history_tree.delete(row)
        for run_id, started, finished, s1, s2, s3 in load_runs():
            self.history_tree.insert("", "end", iid=str(run_id), values=(started, finished, s1, s2, s3))

    def _on_history_row_selected(self, event):
        selection = self.history_tree.selection()
        for row in self.senders_tree.get_children():
            self.senders_tree.delete(row)
        if not selection:
            return
        run_id = int(selection[0])
        for sender, source in load_senders_for_run(run_id):
            self.senders_tree.insert("", "end", values=(sender, source))

    # ---------------- Pipeline execution ----------------

    def _start_pipeline(self):
        self.pipeline_running = True
        self.run_started_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        self.stage_statuses = {}
        thread = threading.Thread(target=self._run_pipeline_thread, daemon=True)
        thread.start()
        self.root.after(150, self._poll_output_queue)

    def _run_pipeline_thread(self):
        env = os.environ.copy()
        env["PYTHONIOENCODING"] = "utf-8"
        # Point each stage at the centrally-stored credentials/token instead
        # of requiring them in the project folder.
        env["UNSUBHERO_CREDENTIALS_PATH"] = CREDENTIALS_PATH
        env["UNSUBHERO_TOKEN_PATH"] = TOKEN_PATH
        env["UNSUBHERO_GMAIL_PROFILE_DIR"] = os.path.join(APP_DATA_DIR, "gmail_browser_profile")

        for i, (label, stage_name) in enumerate(STAGES):
            self.output_queue.put(("status", f"Running: {label}"))
            cmd, target_path = get_stage_command(stage_name)
            self.output_queue.put(("log", f"\n{'=' * 50}\n{label} ({os.path.basename(target_path)})\n{'=' * 50}\n"))

            if not os.path.exists(target_path):
                self.output_queue.put(("log", f"  Skipped - {target_path} not found.\n"))
                self.stage_statuses[i] = "not found"
                continue

            try:
                process = subprocess.Popen(
                    cmd,
                    stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                    text=True, bufsize=1, encoding="utf-8", errors="replace",
                    env=env,
                )
                for line in process.stdout:
                    self.output_queue.put(("log", line))
                process.wait()
                self.stage_statuses[i] = "completed" if process.returncode == 0 else f"exit code {process.returncode}"
            except Exception as e:
                self.output_queue.put(("log", f"  Error running {script}: {e}\n"))
                self.stage_statuses[i] = f"error: {e}"

        self.output_queue.put(("done", None))

    def _poll_output_queue(self):
        try:
            while True:
                kind, payload = self.output_queue.get_nowait()
                if kind == "log":
                    self._append_log(payload)
                elif kind == "status":
                    self.run_status_var.set(payload)
                elif kind == "done":
                    self._finish_run()
                    return
        except queue.Empty:
            pass

        if self.pipeline_running:
            self.root.after(150, self._poll_output_queue)

    def _finish_run(self):
        self.pipeline_running = False
        finished_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        run_id = save_run(self.run_started_at, finished_at, self.stage_statuses)
        senders = self._collect_unsubscribed_senders()
        save_unsubscribed_senders(run_id, senders)
        self._refresh_history()
        self.run_status_var.set("Finished - see History tab")
        self.start_button.config(state="normal")
        self._append_log("\n" + "=" * 50 + "\nDONE\n" + "=" * 50 + "\n")

    def _collect_unsubscribed_senders(self):
        """Reads each stage's own result JSON file and pulls out only the
        senders that actually succeeded, so History shows real outcomes
        instead of raw exit codes."""
        senders = []

        # Stage 2 results
        try:
            with open("unsubscribe_results.json", encoding="utf-8") as f:
                for entry in json.load(f):
                    if entry.get("status") == "success":
                        senders.append((entry.get("sender", "Unknown sender"), "Stage 2"))
        except (FileNotFoundError, json.JSONDecodeError):
            pass

        # Stage 3 results
        try:
            with open("manage_subscriptions_click_results.json", encoding="utf-8") as f:
                for entry in json.load(f):
                    label = entry.get("row_text") or "Unknown sender"
                    senders.append((label.strip().split("\n")[0], "Stage 3"))
        except (FileNotFoundError, json.JSONDecodeError):
            pass

        return senders


def main():
    root = tk.Tk()
    UnsubApp(root)
    root.mainloop()


if __name__ == "__main__":
    main()