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

rm -rf google_drives
mkdir -p google_drives
`;
}

export function buildAssistantMount(email: string, userLocal: string, mountBase: string) {
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

# Prepare per-assistant remote and mount name lists
REMOTE_NAMES=()
MOUNT_NAMES=()

REMOTE_NAMES+=("$REMOTE_BASE_NAME")
MOUNT_NAMES+=("My_Drive")
REMOTE_NAMES+=("${'${REMOTE_BASE_NAME}'}_shared")
MOUNT_NAMES+=("Shared_with_me")

# Append per-shared-drive sections (avoid subshell so array mutations persist)
while IFS=$'\t' read -r DRIVE_ID DRIVE_NAME; do
  SAFE_NAME=$(echo "$DRIVE_NAME" | tr -cd '[:alnum:] _-' | tr ' ' '_')
  REMOTE_NAME="${userLocal}_${'${SAFE_NAME}'}_drive"
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
  MOUNT_NAMES+=("${'${SAFE_NAME}'}_Team_Drive")
done < <(echo "$DRIVES_JSON" | jq -r '.[] | [.id, .name] | @tsv')

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
    rclone bisync "$REMOTE:" "$MOUNT_DIR" --resync
    echo "$MOUNT_DIR" >> "$MOUNT_POINTS_FILE"
    echo "$REMOTE $MOUNT_DIR" >> "$REMOTE_MAP_FILE"
  fi
done
`;
}

export function buildGDriveMountScript(params: {
  assistantEmails: string[];
  userLocals: string[];
  mountBases: string[];
}) {
  const { assistantEmails, userLocals, mountBases } = params;

  const blocks = assistantEmails
    .map((email, idx) => {
      const local = userLocals[idx];
      const base = mountBases[idx];
      return buildAssistantMount(email, local, base);
    })
    .join('\n');

  const script = `
${buildScriptHeader()}

${blocks}
`;

  return script;
}

export function buildAssistantMountSync(mountBase: string) {
  return `
MOUNT_BASE="${mountBase}"

REMOTE_MAP_FILE="$MOUNT_BASE/.remote_map"
if [ ! -f "$REMOTE_MAP_FILE" ]; then
    echo "No remote map found at $REMOTE_MAP_FILE; skipping sync"
    exit 0
fi

while IFS=' ' read -r REMOTE MP; do
    [ -n "$REMOTE" ] || continue
    [ -n "$MP" ] || continue
  if [ -d "$MP" ]; then
    if ! rclone bisync "$REMOTE:" "$MP" --force >/dev/null 2>&1; then
      rclone bisync "$REMOTE:" "$MP" --resync-mode newer || true
    fi
  fi
done < "$REMOTE_MAP_FILE"
`;
}

export function buildGDriveMountSyncScript(mountBases: string[]) {
  const blocks = mountBases
    .map((base) => {
      return buildAssistantMountSync(base);
    })
    .join('\n');
  return `
while :; do
${blocks}
sleep 30
done
`;
}

export function buildAssistantMountCleanup(mountBase: string) {
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
    rclone bisync "$REMOTE:" "$MP" || true
    rm -rf "$MP" || true
    fi
done < "$REMOTE_MAP_FILE"

rm -rf "$MOUNT_BASE"
`;
}

export function buildGDriveCleanupScript(mountBases: string[]) {
  const blocks = mountBases
    .map((base) => {
      return buildAssistantMountCleanup(base);
    })
    .join('\n');
  return `
${blocks}
`;
}

export function buildGDriveMountCommand(assistantEmails: string[], mountBases: string[]) {
  const userLocals = assistantEmails.map((email: string) =>
    (email.split('@')[0] || 'user').replace(/[^a-zA-Z0-9_-]/g, '_')
  );
  const script = buildGDriveMountScript({ assistantEmails, userLocals, mountBases });
  const scriptB64 = Buffer.from(script, 'utf-8').toString('base64');
  return `set -e; export RCLONE_DRIVE_SERVICE_ACCOUNT_CREDENTIALS='${process.env.RCLONE_DRIVE_SERVICE_ACCOUNT_CREDENTIALS}'; tmpfile=$(mktemp); echo "${scriptB64}" | base64 -d > "$tmpfile"; bash "$tmpfile"; rm -f "$tmpfile"; clear\n`;
}

export function buildGDriveCleanupCommand(mountBases: string[]) {
  const cleanupScript = buildGDriveCleanupScript(mountBases);
  const scriptB64 = Buffer.from(cleanupScript, 'utf-8').toString('base64');
  return `set -e; tmpfile=$(mktemp); echo "${scriptB64}" | base64 -d > "$tmpfile"; bash "$tmpfile"; rm -f "$tmpfile"\n`;
}

export function buildGDriveMountSyncCommand(mountBases: string[]) {
  const syncScript = buildGDriveMountSyncScript(mountBases);
  const scriptB64 = Buffer.from(syncScript, 'utf-8').toString('base64');
  return `set -e; tmpfile=$(mktemp); echo "${scriptB64}" | base64 -d > "$tmpfile"; bash "$tmpfile" & clear\n`;
}
