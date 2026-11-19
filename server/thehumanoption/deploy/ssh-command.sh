#!/bin/sh
set -eu
case "${SSH_ORIGINAL_COMMAND:-}" in
    'sync')
        cd /opt/thehumanoption
        export UV_PYTHON=python3.12 UV_PYTHON_DOWNLOADS=never
        exec /usr/local/bin/uv sync --frozen --no-dev
        ;;
    'restart')
        exec sudo -n /usr/bin/systemctl restart thehumanoption.service
        ;;
    rsync\ --server\ *)
        exec /usr/bin/rrsync -wo /opt/thehumanoption
        ;;
    *)
        exit 1
        ;;
esac
