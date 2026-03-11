---
name: vm-setup
description: Automate VM/cloud instance setup with development environment configuration. Use this skill whenever the user says "setup my vm", "configure my server", "setup my instance", or pastes IP/Port information (especially from Vast.ai, AWS, GCP, or similar cloud providers). Also trigger when the user mentions setting up SSH config, installing zsh, Powerlevel10k, Node.js, Claude Code, Codex CLI, or configuring git on a remote server. This skill handles the complete workflow from SSH configuration to a fully configured development environment.
---

# VM Setup

## Overview

This skill automates the complete setup of a cloud VM or remote server with a modern development environment including zsh, Powerlevel10k theme, AI coding assistants (Claude Code and Codex CLI), git configuration, and SSH key management.

## Input Format Detection

The skill automatically detects cloud provider formats:

**Vast.ai format (most common):**
```
IP & Port Info:
Instance ID: 32670274
Machine Copy Port: 46998
Public IP Address: 171.248.243.88
Instance Port Range: 46156-46791
Open Ports:
171.248.243.88:46156 -> 22/tcp
```

**Generic SSH format:**
- IP: `xxx.xxx.xxx.xxx`
- Port: `xxxxx`
- User: typically `root` or `ubuntu`
- Identity file path

## Workflow

### Step 1: Parse Instance Information

Extract from user's input:
- **Host/IP**: Public IP address
- **Port**: The SSH port (mapped to container's port 22)
- **Instance ID**: For generating the Host alias
- **Identity file**: Default to `~/.ssh/vast` for Vast.ai, ask if not specified

### Step 2: Add SSH Config Entry

Add to `~/.ssh/config` on local machine:

```
Host vast-{instance-id}
    HostName {ip}
    User root
    Port {ssh_port}
    IdentityFile ~/.ssh/vast
    ServerAliveInterval 30
    ServerAliveCountMax 120
    ConnectTimeout 120
    TCPKeepAlive yes
    ConnectionAttempts 3
    SetEnv TERM=xterm-256color
```

**Notes:**
- `SetEnv TERM=xterm-256color` fixes terminal compatibility with modern terminals (Ghostty, etc.)
- Use `StrictHostKeyChecking=no` for initial connection if needed

### Step 3: Connect and Update System

```bash
ssh -o StrictHostKeyChecking=no vast-{instance-id}
apt-get update
```

### Step 4: Install and Configure Zsh

**Install zsh:**
```bash
apt-get install -y zsh
chsh -s /bin/zsh
```

**Install plugins:**
```bash
apt-get install -y zsh-autosuggestions
git clone https://github.com/zsh-users/zsh-syntax-highlighting ~/.zsh/zsh-syntax-highlighting 2>/dev/null || true
```

### Step 5: Install Powerlevel10k

**Clone theme:**
```bash
git clone --depth=1 https://github.com/romkatv/powerlevel10k.git ~/powerlevel10k
```

**Create p10k config** at `~/.p10k.zsh` with clean, functional prompt:
- Left: directory, git status, newline, prompt char (❯)
- Right: status, execution time, root indicator, background jobs, time
- Colors: green prompt char, blue directory, yellow git branch

### Step 6: Install Node.js

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
```

### Step 7: Install AI CLI Tools

**Codex CLI:**
```bash
npm install -g @openai/codex
```

**Claude Code:**
```bash
curl -fsSL https://claude.ai/install.sh | bash
```

### Step 8: Create Development Directory

```bash
mkdir -p /root/Development
```

### Step 9: Configure Git

```bash
git config --global user.name "{user_name}"
git config --global user.email "{user_email}"
git config --global init.defaultBranch main
```

If not provided, ask the user for their name and email.

### Step 10: Copy SSH Key

From local machine, copy the private key:
```bash
scp -P {port} ~/.ssh/id_rsa vast-{instance-id}:/root/.ssh/
ssh vast-{instance-id} "chmod 600 /root/.ssh/id_rsa"
```

### Step 11: Create Zsh Configuration

Create `~/.zshrc` with:

1. **Powerlevel10k instant prompt** (at the very top for speed)
2. **Powerlevel10k theme source**
3. **History settings** (10,000 entries, shared)
4. **Completion** (compinit with menu select)
5. **Autosuggestions and syntax highlighting**
6. **Aliases:**
   - `ll`, `la`, `l`, `ls` with colors
   - `c='IS_SANDBOX=1 claude --dangerously-skip-permissions'`
   - `o='codex --dangerously-bypass-approvals-and-sandbox'`
7. **PATH** including `$HOME/.local/bin`
8. **SSH agent auto-start** that loads `~/.ssh/id_rsa`
9. **Auto-cd to Development** directory on login
10. **Source p10k config** at end

### Step 12: Verify Setup

After reconnecting, verify:
- `echo $SHELL` shows `/bin/zsh`
- Powerlevel10k prompt displays correctly
- `pwd` shows `/root/Development`
- `which claude` and `which codex` find the binaries
- `ssh-add -l` shows the loaded key
- Aliases `c` and `o` are defined

## Configuration Templates

### .zshrc Template

```bash
# Enable Powerlevel10k instant prompt
if [[ -r ${XDG_CACHE_HOME:-$HOME/.cache}/p10k-instant-prompt-${(%):-%n}.zsh ]]; then
  source ${XDG_CACHE_HOME:-$HOME/.cache}/p10k-instant-prompt-${(%):-%n}.zsh
fi

# Path to powerlevel10k
source ~/powerlevel10k/powerlevel10k.zsh-theme

# History settings
HISTSIZE=10000
SAVEHIST=10000
HISTFILE=~/.zsh_history

# Basic zsh options
setopt AUTO_CD
setopt EXTENDED_GLOB
setopt NO_CASE_GLOB
setopt APPEND_HISTORY
setopt INC_APPEND_HISTORY
setopt SHARE_HISTORY

# Completion
autoload -Uz compinit && compinit
zstyle ':completion:*' menu select

# Load zsh-autosuggestions
source /usr/share/zsh-autosuggestions/zsh-autosuggestions.zsh

# Load zsh-syntax-highlighting if available
if [ -f $HOME/.zsh/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh ]; then
    source $HOME/.zsh/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh
fi

# Aliases
alias ll='ls -alF --color=auto'
alias la='ls -A --color=auto'
alias l='ls -CF --color=auto'
alias ls='ls --color=auto'

# Set terminal for proper colors
export TERM=xterm-256color

# Add local bin to PATH
export PATH="$HOME/.local/bin:$PATH"

# Claude Code alias - sandboxed with no permissions
alias c='IS_SANDBOX=1 claude --dangerously-skip-permissions'

# Codex alias - bypass approvals and sandbox
alias o='codex --dangerously-bypass-approvals-and-sandbox'

# Auto-start ssh-agent and add key if not already running
if [ -z "$SSH_AUTH_SOCK" ]; then
    eval "$(ssh-agent -s)" > /dev/null
    ssh-add ~/.ssh/id_rsa 2>/dev/null
fi

# Change to Development directory on login
cd /root/Development

# To customize prompt, run p10k configure or edit ~/.p10k.zsh
[[ ! -f ~/.p10k.zsh ]] || source ~/.p10k.zsh
```

### .p10k.zsh Template (Pure Style)

This is the recommended Pure-style configuration with 2-line prompt, transient prompt, and clean aesthetics:

```bash
# Generated by Powerlevel10k configuration wizard.
# Wizard options: nerdfont-v3 + powerline, small icons, pure, 12h time, 2 lines, sparse,
# transient_prompt, instant_prompt=verbose.

# Temporarily change options.
'builtin' 'local' '-a' 'p10k_config_opts'
[[ ! -o 'aliases'         ]] || p10k_config_opts+=('aliases')
[[ ! -o 'sh_glob'         ]] || p10k_config_opts+=('sh_glob')
[[ ! -o 'no_brace_expand' ]] || p10k_config_opts+=('no_brace_expand')
'builtin' 'setopt' 'no_aliases' 'no_sh_glob' 'brace_expand'

() {
  emulate -L zsh -o extended_glob

  # Unset all configuration options.
  unset -m '(POWERLEVEL9K_*|DEFAULT_USER)~POWERLEVEL9K_GITSTATUS_DIR'

  # Zsh >= 5.1 is required.
  [[ $ZSH_VERSION == (5.<1->*|<6->.*) ]] || return

  # Prompt colors.
  local grey='242'
  local red='1'
  local yellow='3'
  local blue='4'
  local magenta='5'
  local cyan='6'
  local white='7'

  # Left prompt segments.
  typeset -g POWERLEVEL9K_LEFT_PROMPT_ELEMENTS=(
    context                   # user@host
    dir                       # current directory
    vcs                       # git status
    command_execution_time    # previous command duration
    newline                   # \n
    virtualenv                # python virtual environment
    prompt_char               # prompt symbol
  )

  # Right prompt segments.
  typeset -g POWERLEVEL9K_RIGHT_PROMPT_ELEMENTS=(
    time                      # current time
    newline                   # \n
  )

  # Basic style options that define the overall prompt look.
  typeset -g POWERLEVEL9K_BACKGROUND=                            # transparent background
  typeset -g POWERLEVEL9K_{LEFT,RIGHT}_{LEFT,RIGHT}_WHITESPACE=  # no surrounding whitespace
  typeset -g POWERLEVEL9K_{LEFT,RIGHT}_SUBSEGMENT_SEPARATOR=' '  # separate segments with a space
  typeset -g POWERLEVEL9K_{LEFT,RIGHT}_SEGMENT_SEPARATOR=        # no end-of-line symbol
  typeset -g POWERLEVEL9K_VISUAL_IDENTIFIER_EXPANSION=           # no segment icons

  # Add an empty line before each prompt except the first.
  typeset -g POWERLEVEL9K_PROMPT_ADD_NEWLINE=true

  # Magenta prompt symbol if the last command succeeded.
  typeset -g POWERLEVEL9K_PROMPT_CHAR_OK_{VIINS,VICMD,VIVIS}_FOREGROUND=$magenta
  # Red prompt symbol if the last command failed.
  typeset -g POWERLEVEL9K_PROMPT_CHAR_ERROR_{VIINS,VICMD,VIVIS}_FOREGROUND=$red
  # Default prompt symbol.
  typeset -g POWERLEVEL9K_PROMPT_CHAR_{OK,ERROR}_VIINS_CONTENT_EXPANSION='❯'
  # Prompt symbol in command vi mode.
  typeset -g POWERLEVEL9K_PROMPT_CHAR_{OK,ERROR}_VICMD_CONTENT_EXPANSION='❮'
  # Prompt symbol in visual vi mode is the same as in command mode.
  typeset -g POWERLEVEL9K_PROMPT_CHAR_{OK,ERROR}_VIVIS_CONTENT_EXPANSION='❮'
  # Prompt symbol in overwrite vi mode is the same as in command mode.
  typeset -g POWERLEVEL9K_PROMPT_CHAR_OVERWRITE_STATE=false

  # Grey Python Virtual Environment.
  typeset -g POWERLEVEL9K_VIRTUALENV_FOREGROUND=$grey
  # Don't show Python version.
  typeset -g POWERLEVEL9K_VIRTUALENV_SHOW_PYTHON_VERSION=false
  typeset -g POWERLEVEL9K_VIRTUALENV_{LEFT,RIGHT}_DELIMITER=

  # Blue current directory.
  typeset -g POWERLEVEL9K_DIR_FOREGROUND=$blue

  # Context format when root: user@host. The first part white, the rest grey.
  typeset -g POWERLEVEL9K_CONTEXT_ROOT_TEMPLATE="%F{$white}%n%f%F{$grey}@%m%f"
  # Context format when not root: user@host. The whole thing grey.
  typeset -g POWERLEVEL9K_CONTEXT_TEMPLATE="%F{$grey}%n@%m%f"
  # Don't show context unless root or in SSH.
  typeset -g POWERLEVEL9K_CONTEXT_{DEFAULT,SUDO}_CONTENT_EXPANSION=

  # Show previous command duration only if it's >= 5s.
  typeset -g POWERLEVEL9K_COMMAND_EXECUTION_TIME_THRESHOLD=5
  # Don't show fractional seconds.
  typeset -g POWERLEVEL9K_COMMAND_EXECUTION_TIME_PRECISION=0
  # Duration format: 1d 2h 3m 4s.
  typeset -g POWERLEVEL9K_COMMAND_EXECUTION_TIME_FORMAT='d h m s'
  # Yellow previous command duration.
  typeset -g POWERLEVEL9K_COMMAND_EXECUTION_TIME_FOREGROUND=$yellow

  # Grey Git prompt.
  typeset -g POWERLEVEL9K_VCS_FOREGROUND=$grey

  # Disable async loading indicator.
  typeset -g POWERLEVEL9K_VCS_LOADING_TEXT=

  # Don't wait for Git status even for a millisecond.
  typeset -g POWERLEVEL9K_VCS_MAX_SYNC_LATENCY_SECONDS=0

  # Cyan ahead/behind arrows.
  typeset -g POWERLEVEL9K_VCS_{INCOMING,OUTGOING}_CHANGESFORMAT_FOREGROUND=$cyan
  # Don't show remote branch, current tag or stashes.
  typeset -g POWERLEVEL9K_VCS_GIT_HOOKS=(vcs-detect-changes git-untracked git-aheadbehind)
  # Don't show the branch icon.
  typeset -g POWERLEVEL9K_VCS_BRANCH_ICON=
  # When in detached HEAD state, show @commit.
  typeset -g POWERLEVEL9K_VCS_COMMIT_ICON='@'
  # Don't show staged, unstaged, untracked indicators.
  typeset -g POWERLEVEL9K_VCS_{STAGED,UNSTAGED,UNTRACKED}_ICON=
  # Show '*' when there are staged, unstaged or untracked files.
  typeset -g POWERLEVEL9K_VCS_DIRTY_ICON='*'
  # Show '⇣' if local branch is behind remote.
  typeset -g POWERLEVEL9K_VCS_INCOMING_CHANGES_ICON=':⇣'
  # Show '⇡' if local branch is ahead of remote.
  typeset -g POWERLEVEL9K_VCS_OUTGOING_CHANGES_ICON=':⇡'
  # Don't show the number of commits next to the ahead/behind arrows.
  typeset -g POWERLEVEL9K_VCS_{COMMITS_AHEAD,COMMITS_BEHIND}_MAX_NUM=1
  # Remove space between '⇣' and '⇡'.
  typeset -g POWERLEVEL9K_VCS_CONTENT_EXPANSION='${${${P9K_CONTENT/⇣* :⇡/⇣⇡}// }//:/ }'

  # Grey current time.
  typeset -g POWERLEVEL9K_TIME_FOREGROUND=$grey
  # Format for the current time: 09:51:02 PM.
  typeset -g POWERLEVEL9K_TIME_FORMAT='%D{%I:%M:%S %p}'
  # If set to true, time will update when you hit enter.
  typeset -g POWERLEVEL9K_TIME_UPDATE_ON_COMMAND=false

  # Transient prompt: trim down prompt when accepting a command line.
  typeset -g POWERLEVEL9K_TRANSIENT_PROMPT=always

  # Instant prompt mode: verbose.
  typeset -g POWERLEVEL9K_INSTANT_PROMPT=verbose

  # Hot reload allows you to change POWERLEVEL9K options after initialization.
  typeset -g POWERLEVEL9K_DISABLE_HOT_RELOAD=true

  # If p10k is already loaded, reload configuration.
  (( ! $+functions[p10k] )) || p10k reload
}

# Tell `p10k configure` which file it should overwrite.
typeset -g POWERLEVEL9K_CONFIG_FILE=${${(%):-%x}:a}

(( ${#p10k_config_opts} )) && setopt ${p10k_config_opts[@]}
'builtin' 'unset' 'p10k_config_opts'
```

## Common Issues and Fixes

### Terminal Compatibility
If you see `missing or unsuitable terminal: xterm-ghostty`:
- Add `SetEnv TERM=xterm-256color` to SSH config
- Or add `export TERM=xterm-256color` to `.zshrc`

### SSH Key Not Loading
The ssh-agent auto-start in `.zshrc` handles this. If it fails, check:
- Key exists at `~/.ssh/id_rsa`
- Permissions are `600`
- Run manually: `eval "$(ssh-agent -s)" && ssh-add ~/.ssh/id_rsa`

### Powerlevel10k Icons Not Displaying
If the terminal font doesn't support Nerd Font glyphs:
- Run `p10k configure` on the server
- Select ASCII or lean style options

## Final Result

After running this skill, the VM will have:
- SSH config entry on local machine
- zsh with Powerlevel10k theme
- Command autosuggestions and syntax highlighting
- Node.js 20
- Claude Code and Codex CLI installed
- Aliases: `c` (Claude), `o` (Codex)
- Git configured with user's identity
- SSH key loaded automatically
- Development workspace at `/root/Development`
- Auto-cd to Development on login
