#!/usr/bin/env python3
"""Reject changes to release files already present at a trusted CI base commit."""

import argparse
import os
from pathlib import Path
import re
import subprocess
import sys


REPOSITORY = Path(__file__).absolute().parent.parent
ZERO_SHA = "0" * 40


class HistoryError(ValueError):
    pass


def validate_sha(value, name):
    if not isinstance(value, str) or re.fullmatch(r"[0-9a-f]{40}", value) is None:
        raise HistoryError(f"{name} must be an explicit 40-character lowercase Git SHA.")
    return value


def git_output(repo, *arguments):
    result = subprocess.run(["git", "-C", str(repo), *arguments],
                            stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False)
    if result.returncode:
        raise HistoryError("Cannot check release history: "
                           + result.stderr.decode("utf-8", errors="replace").strip())
    return result.stdout


def check_history(repo, base_sha, head_sha, *, event_name):
    validate_sha(base_sha, "Base SHA")
    validate_sha(head_sha, "Head SHA")
    if event_name not in ("pull_request", "push"):
        raise HistoryError("Expected a pull_request or push event.")
    if head_sha == ZERO_SHA:
        raise HistoryError("Head SHA must identify an existing commit.")
    git_output(repo, "cat-file", "-e", head_sha + "^{commit}")
    if base_sha == ZERO_SHA:
        if event_name != "push":
            raise HistoryError("Only an initial push may have no previous commit.")
        return []
    git_output(repo, "cat-file", "-e", base_sha + "^{commit}")
    changed = git_output(
        repo, "diff", "--no-ext-diff", "--no-textconv", "--no-renames",
        "--diff-filter=DMT", "--name-only", "-z", base_sha, head_sha, "--", "docs/releases/",
    )
    paths = [path.decode("utf-8", errors="replace") for path in changed.split(b"\0") if path]
    if paths:
        raise HistoryError("Existing release files are immutable; create a new release ID instead:\n"
                           + "\n".join(repr(path) for path in paths))
    return paths


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-sha", default=os.environ.get("AUTH_RELEASE_BASE_SHA"))
    parser.add_argument("--head-sha", default=os.environ.get("AUTH_RELEASE_HEAD_SHA"))
    parser.add_argument("--event-name", default=os.environ.get("GITHUB_EVENT_NAME"))
    arguments = parser.parse_args(argv)
    try:
        check_history(REPOSITORY, arguments.base_sha, arguments.head_sha, event_name=arguments.event_name)
    except (HistoryError, OSError) as error:
        print(f"auth-release-history: {error}", file=sys.stderr)
        return 1
    print("Release history verified: no existing release files modified, deleted, or renamed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
