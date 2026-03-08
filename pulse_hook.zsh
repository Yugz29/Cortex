
# ── Pulse shell hook (zsh) ──────────────────────────────────────────────────
_pulse_port=7891
_pulse_last_cmd=""
_pulse_stderr_file="/tmp/pulse_stderr_$$"

_pulse_preexec() {
  _pulse_last_cmd="$1"
  exec 3>&2 2>"$_pulse_stderr_file"
}

_pulse_send() {
  local cmd="$1" exit_code="$2" stderr_content="$3"
  local cmd_escaped=$(echo "$cmd" | sed 's/\\/\\\\/g; s/"/\\"/g; s/$/\\n/g' | tr -d '\\n' | sed 's/\\\\n$//')
  local stderr_escaped=$(echo "$stderr_content" | sed 's/\\/\\\\/g; s/"/\\"/g' | awk '{printf "%s\\n", $0}' | sed 's/\\n$//')
  local cwd_escaped=$(echo "$PWD" | sed 's/\\/\\\\/g; s/"/\\"/g')
  curl -s -m 1 -X POST "http://127.0.0.1:$_pulse_port/command-error" \
    -H "Content-Type: application/json" \
    -d "{\"command\":\"$cmd_escaped\",\"exit_code\":$exit_code,\"cwd\":\"$cwd_escaped\",\"stderr\":\"$stderr_escaped\",\"timestamp\":$(date +%s000)}" \
    > /dev/null 2>&1 &
}

_pulse_fd3_open() { { true >&3; } 2>/dev/null; }

_pulse_restore_stderr() {
  if _pulse_fd3_open; then
    exec 2>&3 3>&-
  fi
}

TRAPINT() {
  local cmd="$_pulse_last_cmd"
  _pulse_restore_stderr
  local stderr_content=""
  if [ -f "$_pulse_stderr_file" ]; then
    stderr_content=$(head -c 4000 "$_pulse_stderr_file" 2>/dev/null || echo "")
    rm -f "$_pulse_stderr_file"
  fi
  if [ -n "$cmd" ]; then
    _pulse_send "$cmd" 130 "$stderr_content"
  fi
  _pulse_last_cmd=""
  return 130
}

_pulse_precmd() {
  local exit_code=$?
  _pulse_restore_stderr
  if [ $exit_code -ne 0 ] && [ -n "$_pulse_last_cmd" ]; then
    local stderr_content=""
    if [ -f "$_pulse_stderr_file" ]; then
      stderr_content=$(head -c 4000 "$_pulse_stderr_file" 2>/dev/null || echo "")
      rm -f "$_pulse_stderr_file"
    fi
    _pulse_send "$_pulse_last_cmd" $exit_code "$stderr_content"
  else
    rm -f "$_pulse_stderr_file"
  fi
  _pulse_last_cmd=""
}

# Capture "command not found" — stderr non disponible dans ce cas
command_not_found_handler() {
  local cmd="$1"
  _pulse_send "$cmd" 127 "zsh: command not found: $cmd"
  echo "zsh: command not found: $cmd" >&2
  return 127
}

autoload -Uz add-zsh-hook
add-zsh-hook preexec _pulse_preexec
add-zsh-hook precmd  _pulse_precmd
# ────────────────────────────────────────────────────────────────────────────
