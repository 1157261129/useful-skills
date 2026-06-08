#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
SKILLS_DIR="${REPO_DIR}/skills"
TOOLS_DIR="${REPO_DIR}/tools"
TOOL_CATALOG_CLI_DIR="${TOOLS_DIR}/tool-catalog-cli"
TOOL_CATALOG_CLI_NAME="tool-catalog-cli"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"

declare -a TARGET_ROOTS=(
  "${AGENTS_SKILLS_DIR:-/home/jing/.agents/skills}"
  "${CLAUDE_SKILLS_DIR:-/home/jing/.claude/skills}"
)

usage() {
  cat <<'EOF'
Usage:
  sync-skills.sh          Sync all skills and shared tools to Codex and Claude CLI
  sync-skills.sh --check  Verify installed copies match skills/* and tools/* contents
EOF
}

read_skill_name() {
  local source="$1"
  local name

  name="$(awk -F': *' '$1 == "name" { print $2; exit }' "${source}")"
  name="${name%$'\r'}"
  if [[ -z "${name}" ]]; then
    echo "Missing frontmatter name: ${source}" >&2
    exit 1
  fi

  echo "${name}"
}

list_skill_sources() {
  if [[ ! -d "${SKILLS_DIR}" ]]; then
    echo "Skills directory not found: ${SKILLS_DIR}" >&2
    exit 1
  fi

  find "${SKILLS_DIR}" -mindepth 2 -maxdepth 2 -name SKILL.md | sort
}

validate_source() {
  local source="$1"
  local skill_name
  local dir_name

  skill_name="$(read_skill_name "${source}")"
  dir_name="$(basename -- "$(dirname -- "${source}")")"

  if [[ "${skill_name}" != "${dir_name}" ]]; then
    echo "Skill name mismatch: ${source} declares ${skill_name}, directory is ${dir_name}" >&2
    exit 1
  fi
}

backup_target() {
  local target="$1"

  if [[ -f "${target}" ]]; then
    local backup_path="${target}.bak-sync-${TIMESTAMP}"
    # 保留回滚点，避免覆盖后无法恢复。
    cp "${target}" "${backup_path}"
    echo "Backed up ${target} -> ${backup_path}"
  fi
}

verify_target() {
  local target="$1"
  local source="$2"

  if diff -u "${target}" "${source}" >/dev/null; then
    echo "Verified ${target}"
    return 0
  fi

  echo "Verification failed for ${target}" >&2
  diff -u "${target}" "${source}" || true
  exit 1
}

sync_target() {
  local target="$1"
  local source="$2"
  local target_dir

  target_dir="$(dirname -- "${target}")"
  mkdir -p "${target_dir}"
  backup_target "${target}"
  cp "${source}" "${target}"
  if [[ -x "${source}" ]]; then
    chmod +x "${target}"
  fi
  verify_target "${target}" "${source}"
}

check_target() {
  local target="$1"
  local source="$2"

  if [[ ! -f "${target}" ]]; then
    echo "Missing target: ${target}" >&2
    exit 1
  fi

  verify_target "${target}" "${source}"
}

sync_or_check_file() {
  local source_file="$1"
  local source_dir="$2"
  local target_dir="$3"
  local mode="$4"
  local relative_path
  local target_file

  relative_path="${source_file#"${source_dir}/"}"
  target_file="${target_dir}/${relative_path}"

  if [[ "${mode}" == "--check" ]]; then
    check_target "${target_file}" "${source_file}"
  else
    sync_target "${target_file}" "${source_file}"
  fi
}

sync_or_check_source() {
  local source="$1"
  local mode="$2"
  local skill_name
  local source_dir
  local target_root
  local target_dir
  local source_file

  validate_source "${source}"
  skill_name="$(read_skill_name "${source}")"
  source_dir="$(dirname -- "${source}")"

  for target_root in "${TARGET_ROOTS[@]}"; do
    target_dir="${target_root}/${skill_name}"
    while IFS= read -r source_file; do
      sync_or_check_file "${source_file}" "${source_dir}" "${target_dir}" "${mode}"
    done < <(find "${source_dir}" -type f | sort)
  done
}

sync_or_check_directory() {
  local source_dir="$1"
  local target_dir="$2"
  local mode="$3"
  local source_file
  local found=0

  if [[ ! -d "${source_dir}" ]]; then
    echo "Shared source directory not found: ${source_dir}" >&2
    exit 1
  fi

  while IFS= read -r source_file; do
    found=1
    sync_or_check_file "${source_file}" "${source_dir}" "${target_dir}" "${mode}"
  done < <(find "${source_dir}" -type f | sort)

  if [[ "${found}" -eq 0 ]]; then
    echo "No files found under shared source directory: ${source_dir}" >&2
    exit 1
  fi
}

sync_or_check_shared_cli() {
  local mode="$1"
  local target_root
  local target_dir

  for target_root in "${TARGET_ROOTS[@]}"; do
    target_dir="${target_root}/${TOOL_CATALOG_CLI_NAME}"
    sync_or_check_directory "${TOOL_CATALOG_CLI_DIR}" "${target_dir}" "${mode}"
  done
}

main() {
  local mode="${1:-sync}"
  local source
  local found=0

  case "${mode}" in
    sync|--check)
      while IFS= read -r source; do
        found=1
        sync_or_check_source "${source}" "${mode}"
      done < <(list_skill_sources)
      if [[ "${found}" -eq 0 ]]; then
        echo "No skills found under ${SKILLS_DIR}" >&2
        exit 1
      fi
      sync_or_check_shared_cli "${mode}"
      ;;
    -h|--help)
      usage
      ;;
    *)
      usage >&2
      exit 1
      ;;
  esac
}

main "$@"
