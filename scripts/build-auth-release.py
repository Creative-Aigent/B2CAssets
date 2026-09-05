#!/usr/bin/env python3
"""Build immutable, self-contained B2C assets from a pinned Git object. No network."""

import argparse
import hashlib
import html
from html.parser import HTMLParser
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import sys
from urllib.parse import parse_qsl, unquote, urlsplit, urlunsplit
import xml.etree.ElementTree as ET


DEFAULT_SOURCE_REF = "5537be973028caae05cfb60e2fd23dc557fbf40a"
REPOSITORY = Path(__file__).absolute().parent.parent
HOST = "creative-aigent.github.io"
SOURCE_BASE = f"https://{HOST}/B2CAssets/"
MANIFEST = "release-manifest.json"
PAGE_LAYOUTS = {
    "phone-otp-clean.html": "urn:com:microsoft:aad:b2c:elements:contract:multifactor:1.2.9",
    "phone-signup-clean.html": "urn:com:microsoft:aad:b2c:elements:contract:selfasserted:2.1.21",
    "selfasserted-clean.html": "urn:com:microsoft:aad:b2c:elements:contract:selfasserted:2.1.21",
    "signin-phone-clean.html": "urn:com:microsoft:aad:b2c:elements:contract:selfasserted:2.1.21",
    "unified-clean.html": "urn:com:microsoft:aad:b2c:elements:contract:unifiedssp:2.1.9",
}
CSS_FILES = {
    "b2c-base.css", "phone-signup-clean.css", "selfasserted-clean.css", "unified-clean.css",
}
FONT_FILES = {
    "fonts/OFL-Lora.txt", "fonts/OFL-Outfit.txt",
    "fonts/lora-latin-ext-wght-normal.woff2", "fonts/outfit-latin-ext-wght-normal.woff2",
}
LOGO_FILES = {"aiman-logo-dark.svg", "aiman-logo-white.svg", "aiman-logo-white.png"}
FULL_LOCALES = {f"country-list-customization-{language}.json" for language in ("ar", "en", "es", "fr")}
PHONE_LOCALES = {
    f"country-list-customization-{language}-phone-only.json" for language in ("ar", "en", "es", "fr")
}
LOCALE_FILES = FULL_LOCALES | PHONE_LOCALES | {"country-list-customization.json"}
BASE_FILES = set(PAGE_LAYOUTS) | CSS_FILES | FONT_FILES | LOGO_FILES | LOCALE_FILES
THEME_FILES = {"auth-theme.css", "auth-theme.js"}
LEGAL_STRINGS = {
    "disclaimer_link_1_url": ("https://creativeaigent.com/privacy-policy", "/privacy"),
    "disclaimer_link_2_url": ("https://creativeaigent.com/terms-of-service", "/terms"),
}
URL_RE = re.compile(r"""(?:[a-zA-Z][a-zA-Z0-9+.-]*:)?//[^\s"'<>\\(){};,]+""")
CSS_URL_RE = re.compile(r"""url\(\s*(?:(["'])(.*?)\1|([^'")\s]+))\s*\)""", re.I | re.S)
CSS_IMPORT_RE = re.compile(r"""@import\s+(["'])(.*?)\1""", re.I | re.S)
HTML_URL_RE = re.compile(
    r"""(\b(?:href|src|poster|action|formaction|data|xlink:href)\s*=\s*)(["'])(.*?)\2""",
    re.I | re.S,
)
URL_ATTRIBUTES = {"href", "src", "poster", "action", "formaction", "data", "xlink:href"}
POSITIVE_DISPLAY_PRIORITY_RE = re.compile(
    r"((?<![-\w])display\s*:\s*(?:block|inline-flex|flex|inline-block|inline))\s*!important\b", re.I,
)


class ReleaseError(ValueError):
    pass


def require(condition, message):
    if not condition:
        raise ReleaseError(message)


def validate_release_id(release_id):
    require(isinstance(release_id, str) and len(release_id) <= 64
            and re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", release_id),
            "Release ID must be 1-64 lowercase letters/digits with single internal hyphens.")
    return release_id


def validate_legal_origin(origin):
    if origin is None:
        return None
    require(isinstance(origin, str) and not re.search(r"[\s\\%]", origin),
            "Legal origin must be an explicit HTTPS origin.")
    try:
        parsed = urlsplit(origin)
        port = parsed.port
    except ValueError as error:
        raise ReleaseError("Invalid legal origin.") from error
    require(parsed.scheme == "https" and parsed.hostname and not parsed.username
            and not parsed.password and "@" not in parsed.netloc
            and not parsed.path and not parsed.query and not parsed.fragment
            and "?" not in origin and "#" not in origin
            and (port is None or port > 0),
            "Legal origin must be HTTPS with no path, query, fragment, or credentials.")
    require(re.fullmatch(r"[A-Za-z0-9.-]+", parsed.hostname) is not None
            and not parsed.hostname.startswith(".") and not parsed.hostname.endswith(".")
            and ".." not in parsed.hostname and not parsed.netloc.endswith(":"),
            "Legal origin must have a valid host.")
    return origin


def release_base(release_id):
    return f"{SOURCE_BASE}releases/{validate_release_id(release_id)}/"


def safe_relative(path):
    require(isinstance(path, str) and path and "\\" not in path and "%" not in path
            and not path.startswith("/") and not any(ord(c) < 32 for c in path)
            and all(part not in ("", ".", "..") for part in path.split("/")),
            f"Unsafe bundle path: {path!r}")
    return path


def safe_disk_path(path):
    path = Path(path)
    require(".." not in path.parts, f"Path traversal is not allowed: {path}")
    path = Path(os.path.abspath(path))
    for component in [*reversed(path.parents), path]:
        try:
            mode = component.lstat().st_mode
        except FileNotFoundError:
            continue
        require(not stat.S_ISLNK(mode), f"Symlinks are not allowed: {component}")
        if component != path:
            require(stat.S_ISDIR(mode), f"Not a directory: {component}")
    return path


def json_bytes(value):
    return (json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n").encode("utf-8")


def parse_json(data, name):
    def unique_object(pairs):
        result = {}
        for key, value in pairs:
            require(key not in result, f"Duplicate JSON key in {name}: {key}")
            result[key] = value
        return result

    try:
        return json.loads(data, object_pairs_hook=unique_object)
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ReleaseError(f"Invalid JSON: {name}") from error


def digest(data):
    return {"sha256": hashlib.sha256(data).hexdigest(), "sizeBytes": len(data)}


def git_output(repo, *arguments):
    result = subprocess.run(["git", "-C", str(repo), *arguments],
                            stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False)
    require(result.returncode == 0,
            f"Git source unavailable: {result.stderr.decode('utf-8', errors='replace').strip()}")
    return result.stdout


def read_git_source(repo, source_ref):
    require(isinstance(source_ref, str) and source_ref and not source_ref.startswith("-")
            and not re.search(r"[\s\x00]", source_ref), "Invalid source Git ref.")
    commit = git_output(repo, "rev-parse", "--verify", "--end-of-options",
                        f"{source_ref}^{{commit}}").decode("ascii").strip()
    require(re.fullmatch(r"[0-9a-f]{40}", commit) is not None, "Expected a Git SHA-1 commit.")
    tree = git_output(repo, "ls-tree", "-r", "-z", commit, "--", "docs/")
    entries = {}
    for entry in tree.split(b"\0"):
        if not entry:
            continue
        metadata, path = entry.split(b"\t", 1)
        mode, kind, object_id = metadata.decode("ascii").split()
        entries[path.decode("utf-8")] = (mode, kind, object_id)
    files = {}
    for path in sorted(BASE_FILES):
        entry = entries.get(f"docs/{path}")
        require(entry is not None, f"Missing baseline file at {commit}: docs/{path}")
        mode, kind, object_id = entry
        require(mode in ("100644", "100755") and kind == "blob",
                f"Baseline file is not a regular Git blob: docs/{path}")
        files[path] = git_output(repo, "cat-file", "blob", object_id)
    return commit, files


def dependency_url(url, owner, files, base, *, rewrite=False):
    require(isinstance(url, str) and url and url == url.strip()
            and not re.search(r"[\x00-\x20\\]", url), f"Invalid dependency in {owner}: {url!r}")
    if url.startswith("#"):
        return url
    try:
        parsed = urlsplit(url)
        host = parsed.hostname
        port = parsed.port
    except ValueError as error:
        raise ReleaseError(f"Invalid dependency in {owner}: {url!r}") from error
    require(parsed.scheme in ("", "http", "https") and not parsed.username
            and not parsed.password and "@" not in parsed.netloc and port is None,
            f"Unsupported dependency in {owner}: {url}")
    require(not parsed.netloc or host == HOST, f"Outside asset in {owner}: {url}")
    require(not parsed.scheme or parsed.netloc, f"Invalid dependency in {owner}: {url}")
    require("%" not in parsed.path and unquote(parsed.path) == parsed.path,
            f"Encoded dependency paths are not allowed in {owner}: {url}")
    if parsed.netloc or parsed.path.startswith("/"):
        prefix = urlsplit(SOURCE_BASE if rewrite else base).path
        require(parsed.path.startswith(prefix), f"Dependency escapes release in {owner}: {url}")
        target = safe_relative(parsed.path[len(prefix):])
        result_path = urlsplit(base).path + target
        result_scheme, result_netloc = "https", HOST
        if not rewrite:
            require(url.startswith(base), f"Non-canonical release URL in {owner}: {url}")
    else:
        parts = owner.split("/")[:-1]
        for part in parsed.path.split("/"):
            if part in ("", "."):
                continue
            if part == "..":
                require(parts, f"Dependency escapes release in {owner}: {url}")
                parts.pop()
            else:
                parts.append(part)
        target = safe_relative("/".join(parts))
        result_path, result_scheme, result_netloc = parsed.path, "", ""
    require(target in files, f"Missing or unapproved dependency in {owner}: {url}")
    if parsed.query:
        require(rewrite and all(key == "v" for key, _ in parse_qsl(parsed.query, keep_blank_values=True)),
                f"Unexpected dependency query in {owner}: {url}")
    require("?" not in url or rewrite, f"Cache query in immutable dependency: {url}")
    return urlunsplit((result_scheme, result_netloc, result_path, "", parsed.fragment))


def css_references(text):
    yield from (match.group(2) if match.group(1) else match.group(3)
                for match in CSS_URL_RE.finditer(text))
    yield from (match.group(2) for match in CSS_IMPORT_RE.finditer(text))


class TemplateParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.layouts = []
        self.api = []
        self.references = []
        self.styles = []
        self.scripts = []
        self.links = []
        self.in_head = False
        self.in_style = False
        self.inline_script = []
        self.in_script = False

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        require(len(attributes) == len(attrs), f"Duplicate HTML attributes on {tag}")
        if tag == "head":
            self.in_head = True
        if tag == "meta" and attributes.get("name") == "pageLayout":
            self.layouts.append(attributes.get("content"))
        if attributes.get("id") == "api":
            self.api.append((tag, attributes))
        require("srcset" not in attributes, "Unsupported srcset dependency; add explicit validation first.")
        self.references.extend(value for key, value in attrs if key in URL_ATTRIBUTES and value is not None)
        if "style" in attributes:
            self.styles.append(attributes["style"])
        if tag == "style":
            self.in_style = True
        if tag == "script":
            self.scripts.append((attributes, self.in_head))
            self.in_script = True
        if tag == "link":
            self.links.append((attributes, self.in_head))
        require(not any(key.startswith("on") for key in attributes), "Inline event handlers are not allowed.")

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        self.handle_endtag(tag)

    def handle_endtag(self, tag):
        if tag == "head":
            self.in_head = False
        if tag == "style":
            self.in_style = False
        if tag == "script":
            self.in_script = False

    def handle_data(self, data):
        if self.in_style:
            self.styles.append(data)
        if self.in_script and data.strip():
            self.inline_script.append(data)


def rewrite_text(text, owner, files, base):
    def replace_absolute(match):
        url = match.group()
        try:
            host = urlsplit(url).hostname
        except ValueError as error:
            raise ReleaseError(f"Invalid URL in {owner}: {url}") from error
        return dependency_url(url, owner, files, base, rewrite=True) if host == HOST else url

    # Global replacement also covers logo URLs and same-host strings outside URL attributes.
    text = URL_RE.sub(replace_absolute, text)

    def replace_reference(url):
        if url.startswith(base):
            return dependency_url(url, owner, files, base)
        return dependency_url(url, owner, files, base, rewrite=True)

    def replace_css(match):
        quote = match.group(1) or ""
        url = match.group(2) if quote else match.group(3)
        return f"url({quote}{replace_reference(url)}{quote})"

    if owner.endswith((".html", ".css", ".svg")):
        text = CSS_URL_RE.sub(replace_css, text)
        text = CSS_IMPORT_RE.sub(
            lambda match: f"@import {match.group(1)}{replace_reference(match.group(2))}{match.group(1)}", text)
    if owner.endswith((".html", ".svg")):
        text = HTML_URL_RE.sub(
            lambda match: match.group(1) + match.group(2)
            + html.escape(replace_reference(html.unescape(match.group(3))), quote=True)
            + match.group(2), text)
    return text


def rewrite_locale(data, name, legal_origin):
    value = parse_json(data, name)
    require(isinstance(value, dict), f"Invalid locale object: {name}")
    if legal_origin is None or name not in FULL_LOCALES:
        return data
    for item in value.get("LocalizedStrings", []):
        key = item.get("StringId")
        if item.get("ElementType") == "UxElement" and key in LEGAL_STRINGS:
            old_url, suffix = LEGAL_STRINGS[key]
            require(item.get("Value") == old_url, f"Unexpected legal string in {name}: {key}")
            item["Value"] = legal_origin + suffix
        if (name == "country-list-customization-en.json"
                and item.get("ElementType") == "ClaimType" and key == "DisplayName"):
            labels = {
                ("givenName", "Firstname"): "First name",
                ("surname", "Lastname"): "Last name",
            }
            replacement = labels.get((item.get("ElementId"), item.get("Value")))
            if replacement is not None:
                item["Value"] = replacement
    return json_bytes(value)


def theme_overlay(repo):
    result = {}
    for source, destination in (("theme.css", "auth-theme.css"), ("theme.js", "auth-theme.js")):
        path = safe_disk_path(Path(repo) / "auth" / source)
        require(path.is_file() and stat.S_ISREG(path.lstat().st_mode), f"Missing theme overlay: {path}")
        result[destination] = path.read_bytes()
        require(result[destination], f"Empty theme overlay: {path}")
    return result


def page_layout_metadata(base):
    return [{"path": path, "url": base + path, "pageLayout": contract, "apiContainerId": "api"}
            for path, contract in sorted(PAGE_LAYOUTS.items())]


def prepare_release(commit, source_files, release_id, *, overlay=None, legal_origin=None):
    base = release_base(release_id)
    legal_origin = validate_legal_origin(legal_origin)
    require(re.fullmatch(r"[0-9a-f]{40}", commit) is not None, "Invalid source Git commit.")
    require(set(source_files) == BASE_FILES, "Baseline assets are missing or unexpected.")
    overlay = {} if overlay is None else overlay
    require(not overlay or set(overlay) == THEME_FILES, "Both theme overlay files are required.")
    files = dict(source_files, **overlay)
    for name, data in list(files.items()):
        if name in LOCALE_FILES:
            files[name] = rewrite_locale(data, name, legal_origin)
        elif name.endswith((".html", ".css", ".svg", ".js")):
            try:
                text = data.decode("utf-8")
            except UnicodeDecodeError as error:
                raise ReleaseError(f"Invalid UTF-8: {name}") from error
            text = rewrite_text(text, name, files, base)
            if overlay and name == "b2c-base.css":
                # B2C's inline display:none must win over positive display defaults.
                text = POSITIVE_DISPLAY_PRIORITY_RE.sub(r"\1", text)
            if overlay and name in PAGE_LAYOUTS:
                text, count = re.subn(
                    r"background:\s*#0c1117\s*!important\s*;",
                    "background: var(--aiman-canvas,#0c1117);", text)
                require(count == 1, f"Initial background contract changed in {name}.")
                require(text.count("</head>") == 1, f"Expected exactly one head in {name}.")
                text = text.replace("</head>",
                                    f'  <link rel="stylesheet" href="{base}auth-theme.css" data-preload="true">\n'
                                    f'  <script src="{base}auth-theme.js" defer data-preload="true"></script>\n'
                                    "</head>")
            files[name] = text.encode("utf-8")
    manifest = {
        "schemaVersion": 1,
        "releaseId": release_id,
        "sourceGitCommit": commit,
        "contentUrlBase": base,
        "pageLayouts": page_layout_metadata(base),
        "activationStatus": "not-activated",
        "legalOrigin": legal_origin,
        "theme": {
            "enhancementEnabled": bool(overlay),
            "requiresTenantJavaScriptEnablement": bool(overlay),
            "sourceFiles": {
                f"auth/{name.removeprefix('auth-')}": digest(data)
                for name, data in sorted(overlay.items())
            },
        },
        "files": {name: digest(data) for name, data in sorted(files.items())},
    }
    validate_bundle(files, manifest)
    return dict(files, **{MANIFEST: json_bytes(manifest)})


def validate_bundle(files, manifest):
    require(isinstance(manifest, dict) and manifest.get("schemaVersion") == 1,
            "Unsupported release manifest schema.")
    base = release_base(manifest.get("releaseId"))
    require(manifest.get("contentUrlBase") == base, "Manifest content URL base mismatch.")
    commit = manifest.get("sourceGitCommit")
    require(isinstance(commit, str) and re.fullmatch(r"[0-9a-f]{40}", commit), "Invalid source Git commit.")
    legal_origin = validate_legal_origin(manifest.get("legalOrigin"))
    require(manifest.get("activationStatus") == "not-activated", "Release must not claim tenant activation.")
    require(manifest.get("pageLayouts") == page_layout_metadata(base), "Page-layout manifest mismatch.")
    theme = manifest.get("theme")
    require(isinstance(theme, dict) and type(theme.get("enhancementEnabled")) is bool, "Invalid theme metadata.")
    enabled = theme["enhancementEnabled"]
    require(theme.get("requiresTenantJavaScriptEnablement") is enabled, "Invalid JavaScript enablement metadata.")
    sources = theme.get("sourceFiles")
    require(isinstance(sources, dict) and set(sources) == ({"auth/theme.css", "auth/theme.js"} if enabled else set()),
            "Invalid theme source metadata.")
    for record in sources.values():
        validate_digest_record(record)
    expected = BASE_FILES | (THEME_FILES if enabled else set())
    records = manifest.get("files")
    require(isinstance(records, dict), "Missing manifest file inventory.")
    for path in records:
        safe_relative(path)
    require(set(records) == expected, "Manifest assets are missing or unexpected.")
    require(set(files) == expected,
            f"Bundle file inventory differs: missing={sorted(expected - set(files))}, "
            f"unexpected={sorted(set(files) - expected)}")
    for name, data in files.items():
        validate_digest_record(records[name])
        require(records[name] == digest(data), f"File hash/size mismatch: {name}")
        if name.endswith((".html", ".css", ".svg", ".js")):
            try:
                text = data.decode("utf-8")
            except UnicodeDecodeError as error:
                raise ReleaseError(f"Invalid UTF-8: {name}") from error
            references = []
            if name in PAGE_LAYOUTS:
                parser = TemplateParser()
                parser.feed(text)
                parser.close()
                require(parser.layouts == [PAGE_LAYOUTS[name]], f"pageLayout contract changed: {name}")
                require(parser.api == [("div", {"id": "api"})]
                        and '<div id="api"></div>' in text, f"#api contract changed: {name}")
                require(not parser.inline_script, f"Inline script is not allowed: {name}")
                require(len(parser.scripts) == int(enabled), f"Unexpected scripts in {name}")
                if enabled:
                    attrs, in_head = parser.scripts[0]
                    require(in_head and attrs == {
                        "src": base + "auth-theme.js", "defer": None, "data-preload": "true",
                    }, f"Invalid theme script contract in {name}")
                    require(sum(in_head and attrs.get("rel") == "stylesheet"
                                and attrs.get("href") == base + "auth-theme.css"
                                for attrs, in_head in parser.links) == 1,
                            f"Missing head theme stylesheet: {name}")
                    require("background: var(--aiman-canvas,#0c1117);" in text
                            and not re.search(r"background:\s*#0c1117\s*!important", text),
                            f"Theme initial background is blocked: {name}")
                references.extend(parser.references)
                for style in parser.styles:
                    references.extend(css_references(style))
            elif name.endswith(".css"):
                references.extend(css_references(text))
                if enabled and name == "b2c-base.css":
                    require(not POSITIVE_DISPLAY_PRIORITY_RE.search(text),
                            "Candidate CSS must not override B2C inline display:none.")
            elif name.endswith(".svg"):
                try:
                    root = ET.fromstring(text)
                except ET.ParseError as error:
                    raise ReleaseError(f"Invalid SVG: {name}") from error
                for element in root.iter():
                    for key, value in element.attrib.items():
                        if key.rsplit("}", 1)[-1] in ("href", "src"):
                            references.append(value)
                        references.extend(css_references(value))
                    if element.tag.rsplit("}", 1)[-1] == "style":
                        references.extend(css_references(element.text or ""))
            else:
                references.extend(match.group() for match in URL_RE.finditer(text))
                require(not re.search(r"\b(?:import|export)\b[^;\n]*['\"]|\brequire\s*\(", text),
                        "Theme JavaScript must be a standalone script without imports.")
            for match in URL_RE.finditer(text):
                if urlsplit(match.group()).hostname == HOST:
                    references.append(match.group())
            for url in references:
                dependency_url(url, name, files, base)
        elif name in LOCALE_FILES:
            validate_locale(data, name, legal_origin)


def validate_digest_record(record):
    require(isinstance(record, dict) and set(record) == {"sha256", "sizeBytes"}
            and isinstance(record.get("sha256"), str) and re.fullmatch(r"[0-9a-f]{64}", record["sha256"])
            and type(record.get("sizeBytes")) is int and record["sizeBytes"] >= 0,
            "Invalid file hash/size record.")


def validate_locale(data, name, legal_origin):
    value = parse_json(data, name)
    require(isinstance(value, dict) and isinstance(value.get("LocalizedCollections"), list),
            f"Invalid locale collections: {name}")
    strings = value.get("LocalizedStrings", [])
    require(isinstance(strings, list) and all(isinstance(item, dict) for item in strings),
            f"Invalid locale strings: {name}")
    legal_values = set()
    for item in strings:
        key = item.get("StringId")
        if item.get("ElementType") == "UxElement" and key in LEGAL_STRINGS:
            original, suffix = LEGAL_STRINGS[key]
            expected = legal_origin + suffix if legal_origin and name in FULL_LOCALES else original
            require(item.get("Value") == expected, f"Unexpected legal URL: {name}/{key}")
            legal_values.add(expected)
    for match in URL_RE.finditer(data.decode("utf-8")):
        require(match.group() in legal_values, f"Unexpected URL in localization: {name}")


def disk_inventory(directory):
    directory = safe_disk_path(directory)
    require(directory.is_dir(), f"Release directory does not exist: {directory}")
    files = {}
    directories = set()
    for current, dirnames, filenames in os.walk(directory, followlinks=False):
        for name in sorted(dirnames + filenames):
            path = safe_disk_path(Path(current) / name)
            relative = path.relative_to(directory).as_posix()
            safe_relative(relative)
            mode = path.lstat().st_mode
            require(stat.S_ISDIR(mode) or stat.S_ISREG(mode), f"Not a regular file/directory: {path}")
            if stat.S_ISDIR(mode):
                directories.add(relative)
            else:
                files[relative] = path.read_bytes()
    require(directories == {"fonts"}, f"Missing or unexpected bundle directories: {sorted(directories)}")
    return files


def verify_release(directory):
    directory = safe_disk_path(directory)
    files = disk_inventory(directory)
    require(MANIFEST in files, f"Missing {MANIFEST}: {directory}")
    manifest = parse_json(files.pop(MANIFEST), MANIFEST)
    require(isinstance(manifest, dict) and manifest.get("releaseId") == directory.name,
            "Release directory and manifest ID differ.")
    validate_bundle(files, manifest)
    return manifest


def write_release(repo, release_id, files):
    validate_release_id(release_id)
    destination = safe_disk_path(Path(repo) / "docs" / "releases" / release_id)
    manifest = parse_json(files.get(MANIFEST, b""), MANIFEST)
    require(manifest.get("releaseId") == release_id, "Requested release ID differs from manifest.")
    validate_bundle({path: data for path, data in files.items() if path != MANIFEST}, manifest)
    if destination.exists():
        verify_release(destination)
        require(disk_inventory(destination) == files,
                f"Immutable release already exists with different bytes: {destination}")
        return destination
    destination.parent.mkdir(parents=True, exist_ok=True)
    safe_disk_path(destination)
    destination.mkdir()
    (destination / "fonts").mkdir()
    # Publish the manifest last; an interrupted write cannot verify as a complete release.
    for name in [*sorted(set(files) - {MANIFEST}), MANIFEST]:
        path = safe_disk_path(destination / safe_relative(name))
        with path.open("xb") as stream:
            stream.write(files[name])
    verify_release(destination)
    return destination


def build_release(repo, release_id, source_ref=DEFAULT_SOURCE_REF, *, with_theme=False, legal_origin=None):
    validate_release_id(release_id)
    validate_legal_origin(legal_origin)
    safe_disk_path(Path(repo) / "docs" / "releases" / release_id)
    commit, files = read_git_source(repo, source_ref)
    overlay = theme_overlay(repo) if with_theme else None
    bundle = prepare_release(commit, files, release_id, overlay=overlay, legal_origin=legal_origin)
    return write_release(repo, release_id, bundle)


def verify_existing(path):
    path = safe_disk_path(path)
    require(path.is_dir(), f"Release directory does not exist: {path}")
    if (path / MANIFEST).exists() or (path / MANIFEST).is_symlink():
        return [verify_release(path)]
    children = sorted(path.iterdir())
    require(children, f"No releases found in {path}")
    manifests = []
    for child in children:
        validate_release_id(child.name)
        manifests.append(verify_release(child))
    return manifests


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--release-id", help="New immutable release ID, e.g. v13-baseline")
    parser.add_argument("--source-ref", default=DEFAULT_SOURCE_REF, help="Git commit/ref; defaults to deployed v13 SHA")
    parser.add_argument("--with-theme", action="store_true", help="Opt in to the local auth/theme.css + theme.js overlay")
    parser.add_argument("--legal-origin", help="Explicit HTTPS origin only, e.g. https://creativeaigent.app")
    parser.add_argument("--verify-existing", nargs="?", const=str(REPOSITORY / "docs" / "releases"),
                        metavar="DIRECTORY", help="Verify one release or all releases offline; write nothing")
    arguments = parser.parse_args(argv)
    try:
        if arguments.verify_existing is not None:
            require(not arguments.release_id and not arguments.with_theme and not arguments.legal_origin,
                    "--verify-existing cannot be combined with build options.")
            for manifest in verify_existing(arguments.verify_existing):
                print(f"Verified {manifest['releaseId']}: {len(manifest['files'])} files; "
                      f"source {manifest['sourceGitCommit']}")
        else:
            require(arguments.release_id, "--release-id is required when building.")
            directory = build_release(REPOSITORY, arguments.release_id, arguments.source_ref,
                                      with_theme=arguments.with_theme, legal_origin=arguments.legal_origin)
            print(f"Verified immutable release: {directory}")
        return 0
    except (ReleaseError, OSError) as error:
        print(f"auth-release: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
