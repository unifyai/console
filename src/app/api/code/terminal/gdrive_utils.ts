export function buildGDriveMountScript(params: {
  assistantEmail: string;
  userLocal: string;
  mountBase: string;
}) {
  const { assistantEmail, userLocal, mountBase } = params;

  const script = `
set -e
set -o pipefail
set +x
export RCLONE_DRIVE_SERVICE_ACCOUNT_CREDENTIALS='${process.env.RCLONE_DRIVE_SERVICE_ACCOUNT_CREDENTIALS}'
set -x

export RCLONE_IMPERSONATE_EMAIL="${assistantEmail}"
EMAIL="$RCLONE_IMPERSONATE_EMAIL"

# Ensure rclone is available (user-space install if missing)
if ! command -v rclone >/dev/null 2>&1; then
  echo "Installing rclone to $HOME/bin" >&2
  curl https://rclone.org/install.sh | bash
fi

mkdir -p "$HOME/.config/rclone"
# Ensure rclone.conf exists and is empty
: > "$HOME/.config/rclone/rclone.conf"
# Build rclone.conf using env-based auth only, with unique remote names per user
REMOTE_BASE_NAME="gdrive_${userLocal}"
{
  echo "[$REMOTE_BASE_NAME]"
  echo "type = drive"
  echo "scope = drive"
  echo "impersonate = $EMAIL"
  echo "env_auth = true"
  echo ""
} >> "$HOME/.config/rclone/rclone.conf"
chmod 600 "$HOME/.config/rclone/rclone.conf"

# Ensure jq exists (required); if missing, abort with a clear message
if ! command -v jq >/dev/null 2>&1; then
  echo "Error: jq is required but not installed" >&2
  exit 1
fi

# Query shared drives for this user's remote
DRIVES_JSON=$(rclone backend drives "$REMOTE_BASE_NAME:" || echo "[]")

# Prepare remote and mount name lists
REMOTE_NAMES=("$REMOTE_BASE_NAME")
MOUNT_NAMES=("gdrive")

# Append per-shared-drive sections
echo "$DRIVES_JSON" | jq -r '.[] | [.id, .name] | @tsv' | while IFS=$'\t' read -r DRIVE_ID DRIVE_NAME; do
  SAFE_NAME=$(echo "$DRIVE_NAME" | tr -cd '[:alnum:] _-' | tr ' ' '_')
  REMOTE_NAME="${'${userLocal}'}_${'${SAFE_NAME}'}_drive"
  {
    echo "[${'${REMOTE_NAME}'}]"
    echo "type = drive"
    echo "scope = drive"
    echo "env_auth = true"
    echo "impersonate = $EMAIL"
    echo "team_drive = ${'${DRIVE_ID}'}"
    echo "root_folder_id = "
    echo ""
  } >> "$HOME/.config/rclone/rclone.conf"
  REMOTE_NAMES+=("${'${REMOTE_NAME}'}")
  MOUNT_NAMES+=("${'${SAFE_NAME}'}_drive")
done

# Mount all remotes
MOUNT_BASE="${mountBase}"
mkdir -p "$MOUNT_BASE"

MOUNT_POINTS_FILE="$MOUNT_BASE/.mount_points"
: > "$MOUNT_POINTS_FILE"

for IDX in "${'${!REMOTE_NAMES[@]}'}"; do
  REMOTE="${'${REMOTE_NAMES[$IDX]}'}"
  MOUNT_NAME="${'${MOUNT_NAMES[$IDX]}'}"
  MOUNT_DIR="$MOUNT_BASE/$MOUNT_NAME"
  mkdir -p "$MOUNT_DIR"
  # best-effort daemon mount
  if rclone mount "$REMOTE:" "$MOUNT_DIR" --daemon; then
    echo "$MOUNT_DIR" >> "$MOUNT_POINTS_FILE"
  fi
done

echo "gdrive mounts ready under $MOUNT_BASE"
`;

  return script;
}

export function buildGDriveCleanupScript(mountBase: string) {
  return `
set -e
MOUNT_BASE="${mountBase}"
POINTS_FILE="$MOUNT_BASE/.mount_points"
if [ -f "$POINTS_FILE" ]; then
  while IFS= read -r MP; do
    [ -n "$MP" ] || continue
    if [ -d "$MP" ] && command -v mountpoint >/dev/null 2>&1 && mountpoint -q "$MP"; then
      if command -v fusermount >/dev/null 2>&1; then
        fusermount -u "$MP" || umount "$MP" || true
      else
        umount "$MP" || true
      fi
    fi
  done < "$POINTS_FILE"
fi
`;
}

export function buildGDriveMountCommand(assistantEmail: string, mountBase: string) {
  const userLocal = (assistantEmail.split("@")[0] || "user").replace(/[^a-zA-Z0-9_-]/g, "_");
  const script = buildGDriveMountScript({ assistantEmail, userLocal, mountBase });
  const scriptB64 = Buffer.from(script, "utf-8").toString("base64");
  return `bash -lc 'set -e; tmpfile=$(mktemp); echo "${scriptB64}" | base64 -d > "$tmpfile"; echo "[gdrive] running setup..."; bash "$tmpfile"; rc=$?; echo "[gdrive] setup exit=$rc"; rm -f "$tmpfile"; exit $rc'`;
}

export function buildGDriveCleanupCommand(mountBase: string) {
  const cleanupScript = buildGDriveCleanupScript(mountBase);
  return `bash -lc 'set -e; tmpfile=$(mktemp); cat >"$tmpfile" <<"EOS"\n${cleanupScript}\nEOS\n bash "$tmpfile" || true; rm -f "$tmpfile"'`;
}


