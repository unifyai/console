export function buildScriptHeader() {
  return `
# Ensure rclone is available (user-space install if missing)
if ! command -v rclone >/dev/null 2>&1; then
  echo "Installing rclone to $HOME/bin" >&2
  curl https://rclone.org/install.sh | bash
fi

mkdir -p "$HOME/.config/rclone"
# Ensure rclone.conf exists and is empty
rm -f "$HOME/.config/rclone/rclone.conf"
touch "$HOME/.config/rclone/rclone.conf"
chmod 600 "$HOME/.config/rclone/rclone.conf"

# Prepare remote and mount name lists
REMOTE_NAMES=()
MOUNT_NAMES=()
`;
}

export function buildAssistantMount(email: string, userLocal: string) {
  return `
# Build rclone.conf using env-based auth only, with unique remote names per user
REMOTE_BASE_NAME="gdrive_${userLocal}"

{
  echo "[$REMOTE_BASE_NAME]"
  echo "type = drive"
  echo "scope = drive"
  echo "impersonate = ${email}"
  echo "env_auth = true"
  echo ""

  echo "[${'${REMOTE_BASE_NAME}'}_shared]"
  echo "type = drive"
  echo "scope = drive"
  echo "impersonate = ${email}"
  echo "shared_with_me = true"
  echo "env_auth = true"
  echo ""
} >> "$HOME/.config/rclone/rclone.conf"

# Query shared drives for this user's remote
DRIVES_JSON=$(rclone backend drives "$REMOTE_BASE_NAME:" || echo "[]")

# Add to remote and mount name lists
REMOTE_NAMES+=("$REMOTE_BASE_NAME")
MOUNT_NAMES+=("gdrive")
REMOTE_NAMES+=("${'${REMOTE_BASE_NAME}'}_shared")
MOUNT_NAMES+=("gdrive_shared")

# Append per-shared-drive sections
echo "$DRIVES_JSON" | jq -r '.[] | [.id, .name] | @tsv' | while IFS=$'\t' read -r DRIVE_ID DRIVE_NAME; do
  SAFE_NAME=$(echo "$DRIVE_NAME" | tr -cd '[:alnum:] _-' | tr ' ' '_')
  REMOTE_NAME="${'${userLocal}'}_${'${SAFE_NAME}'}_drive"
  {
    echo "[${'${REMOTE_NAME}'}]"
    echo "type = drive"
    echo "scope = drive"
    echo "env_auth = true"
    echo "impersonate = ${email}"
    echo "team_drive = ${'${DRIVE_ID}'}"
    echo "root_folder_id = "
    echo ""
  } >> "$HOME/.config/rclone/rclone.conf"
  REMOTE_NAMES+=("${'${REMOTE_NAME}'}")
  MOUNT_NAMES+=("${'${SAFE_NAME}'}_drive")
done`;
}

export function buildGDriveMountScript(params: {
  assistantEmail: string;
  userLocal: string;
  mountBase: string;
}) {
  const { assistantEmail, userLocal, mountBase } = params;

  const script = `
${buildScriptHeader()}

${buildAssistantMount(assistantEmail, userLocal)}

# Mount all remotes
MOUNT_BASE="${mountBase}"
mkdir -p "$MOUNT_BASE"

MOUNT_POINTS_FILE="$MOUNT_BASE/.mount_points"
rm -f "$MOUNT_POINTS_FILE"
touch "$MOUNT_POINTS_FILE"
REMOTE_MAP_FILE="$MOUNT_BASE/.remote_map"
rm -f "$REMOTE_MAP_FILE"
touch "$REMOTE_MAP_FILE"

for IDX in "${'${!REMOTE_NAMES[@]}'}"; do
  REMOTE="${'${REMOTE_NAMES[$IDX]}'}"
  MOUNT_NAME="${'${MOUNT_NAMES[$IDX]}'}"
  MOUNT_DIR="$MOUNT_BASE/$MOUNT_NAME"
  rm -rf "$MOUNT_DIR"
  mkdir -p "$MOUNT_DIR"
  if rclone sync "$REMOTE:" "$MOUNT_DIR"; then
    rclone bisync "$MOUNT_DIR" "$REMOTE:" --resync
    echo "$MOUNT_DIR" >> "$MOUNT_POINTS_FILE"
    echo "$REMOTE $MOUNT_DIR" >> "$REMOTE_MAP_FILE"
  fi
done
`;

  return script;
}

export function buildGDriveCleanupScript(mountBase: string) {
  return `
MOUNT_BASE="${mountBase}"

REMOTE_MAP_FILE="$MOUNT_BASE/.remote_map"
if [ ! -f "$REMOTE_MAP_FILE" ]; then
  echo "No remote map found at $REMOTE_MAP_FILE; skipping cleanup"
  exit 0
fi

while IFS=' ' read -r REMOTE MP; do
  [ -n "$REMOTE" ] || continue
  [ -n "$MP" ] || continue
  if [ -d "$MP" ]; then
    echo "[gdrive] bisync $MP -> $REMOTE:"
    rclone bisync "$MP" "$REMOTE:" || true
    rm -rf "$MP" || true
  fi
done < "$REMOTE_MAP_FILE"
`;
}

export function buildGDriveMountCommand(assistantEmail: string, mountBase: string) {
  const userLocal = (assistantEmail.split("@")[0] || "user").replace(/[^a-zA-Z0-9_-]/g, "_");
  const script = buildGDriveMountScript({ assistantEmail, userLocal, mountBase });
  const scriptB64 = Buffer.from(script, "utf-8").toString("base64");
  return `set -e; export RCLONE_DRIVE_SERVICE_ACCOUNT_CREDENTIALS='${process.env.RCLONE_DRIVE_SERVICE_ACCOUNT_CREDENTIALS}'; tmpfile=$(mktemp); echo "${scriptB64}" | base64 -d > "$tmpfile"; bash "$tmpfile" & clear\n`;
}

export function buildGDriveCleanupCommand(mountBase: string) {
  const cleanupScript = buildGDriveCleanupScript(mountBase);
  const scriptB64 = Buffer.from(cleanupScript, "utf-8").toString("base64");
  return `set -e; tmpfile=$(mktemp); echo "${scriptB64}" | base64 -d > "$tmpfile"; bash "$tmpfile"; rm -f "$tmpfile"\n`;
}


