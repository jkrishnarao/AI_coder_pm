# Scripts Guidance

- `start.sh` and `stop.sh` are shared by macOS and Linux and run Docker Compose from the project root.
- `start.ps1` and `stop.ps1` provide the corresponding Windows PowerShell commands.
- Scripts should operate only on this project's Compose application. Do not remove named volumes during stop; the volume will hold user data in later stages.
- `PM_PORT` optionally changes the host port, defaulting to 8000.

Run shell scripts with `sh scripts/start.sh` and `sh scripts/stop.sh`; run PowerShell scripts with `./scripts/start.ps1` and `./scripts/stop.ps1`.