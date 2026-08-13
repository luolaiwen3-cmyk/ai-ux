import argparse
from pathlib import Path

from app.core.config import get_settings
from app.services.backups import create_backup, restore_backup


def main() -> None:
    parser = argparse.ArgumentParser(description="InsightUX local data tools")
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("backup")
    restore = commands.add_parser("restore")
    restore.add_argument("archive", type=Path)
    args = parser.parse_args()
    data_dir = get_settings().data_dir
    if args.command == "backup":
        print(create_backup(data_dir))
    else:
        restore_backup(data_dir, args.archive.resolve())
        print(f"Restored {args.archive}")


if __name__ == "__main__":
    main()
