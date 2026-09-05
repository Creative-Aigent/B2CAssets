"""Offline packaging tests; scratch files stay inside this repository."""

from contextlib import redirect_stderr, redirect_stdout
import copy
import importlib.util
import io
import json
from pathlib import Path
import re
import shutil
import unittest
from unittest.mock import patch
import uuid


ROOT = Path(__file__).absolute().parent.parent
SPEC = importlib.util.spec_from_file_location("auth_release", ROOT / "scripts" / "build-auth-release.py")
release = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(release)
HISTORY_SPEC = importlib.util.spec_from_file_location(
    "auth_release_history", ROOT / "scripts" / "check-auth-release-history.py")
history = importlib.util.module_from_spec(HISTORY_SPEC)
HISTORY_SPEC.loader.exec_module(history)


class AuthReleaseTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.commit, cls.source = release.read_git_source(ROOT, release.DEFAULT_SOURCE_REF)

    def setUp(self):
        self.repo = ROOT / "tests" / f".auth-release-test-{uuid.uuid4().hex}"
        self.repo.mkdir()
        self.addCleanup(shutil.rmtree, self.repo)

    def bundle(self, name="test-baseline", **options):
        return release.prepare_release(self.commit, self.source, name, **options)

    def write(self, name="test-baseline", **options):
        return release.write_release(self.repo, name, self.bundle(name, **options))

    def build(self, name="test-baseline", **options):
        with patch.object(release, "read_git_source", return_value=(self.commit, self.source)):
            return release.build_release(self.repo, name, **options)

    def overlay(self):
        auth = self.repo / "auth"
        auth.mkdir()
        (auth / "theme.css").write_text(
            ':root { --aiman-canvas: #fff; }\n'
            '#api::before { background-image: url("'
            + release.SOURCE_BASE + 'aiman-logo-dark.svg?v=13"); }\n', encoding="utf-8")
        (auth / "theme.js").write_text(
            '"use strict"; document.documentElement.dataset.theme = "light";\n', encoding="utf-8")
        return release.theme_overlay(self.repo)

    def edit_manifest(self, directory, change):
        path = directory / release.MANIFEST
        manifest = json.loads(path.read_bytes())
        change(manifest)
        path.write_bytes(release.json_bytes(manifest))

    def update_record(self, directory, name):
        self.edit_manifest(directory, lambda manifest: manifest["files"].update(
            {name: release.digest((directory / name).read_bytes())}))

    def assert_rejected(self, directory):
        with self.assertRaises(release.ReleaseError):
            release.verify_release(directory)

    def test_pinned_git_source_not_working_tree(self):
        self.assertEqual(self.commit, "5537be973028caae05cfb60e2fd23dc557fbf40a")
        with patch.object(release, "git_output", wraps=release.git_output) as git:
            commit, files = release.read_git_source(ROOT, release.DEFAULT_SOURCE_REF)
        self.assertEqual((commit, files), (self.commit, self.source))
        self.assertIn(release.DEFAULT_SOURCE_REF + "^{commit}", git.call_args_list[0].args)
        self.assertNotIn("HEAD", repr(git.call_args_list))

    def test_baseline_inventory_and_page_contracts(self):
        bundle = self.bundle()
        self.assertEqual(len(release.BASE_FILES), 25)
        self.assertEqual(set(bundle), release.BASE_FILES | {release.MANIFEST})
        manifest = json.loads(bundle[release.MANIFEST])
        self.assertFalse(manifest["theme"]["enhancementEnabled"])
        self.assertFalse(manifest["theme"]["requiresTenantJavaScriptEnablement"])
        self.assertEqual(manifest["activationStatus"], "not-activated")
        self.assertEqual(manifest["sourceGitCommit"], self.commit)
        self.assertEqual(len(manifest["pageLayouts"]), 5)
        for name, contract in release.PAGE_LAYOUTS.items():
            source = self.source[name].decode()
            output = bundle[name].decode()
            self.assertIn(f'content="{contract}"', source)
            self.assertIn(f'content="{contract}"', output)
            self.assertEqual(output.count('<div id="api"></div>'), 1)
            self.assertNotIn("<script", output)
            self.assertNotIn("?v=", output)
            self.assertIn("background: #0c1117 !important;", output)
        self.assertNotIn("b2c-base.js", bundle)
        self.assertNotIn("unified-clean.js", bundle)
        self.assertFalse(any("polic" in name for name in bundle))
        self.assertEqual(manifest["pageLayouts"], release.page_layout_metadata(release.release_base("test-baseline")))

    def test_rewrites_all_same_host_urls_and_keeps_relative_fonts(self):
        bundle = self.bundle()
        base = release.release_base("test-baseline")
        for name in release.CSS_FILES | set(release.PAGE_LAYOUTS):
            text = bundle[name].decode()
            self.assertNotIn("?v=", text)
            for match in release.URL_RE.finditer(text):
                self.assertTrue(match.group().startswith(base), match.group())
        css = bundle["b2c-base.css"].decode()
        self.assertIn(base + "aiman-logo-white.svg", css)
        self.assertIn('url("fonts/outfit-latin-ext-wght-normal.woff2")', css)
        for name in release.FONT_FILES | release.LOGO_FILES | release.LOCALE_FILES:
            self.assertEqual(bundle[name], self.source[name])

    def test_manifest_covers_all_files_and_byte_sizes(self):
        bundle = self.bundle()
        manifest = json.loads(bundle[release.MANIFEST])
        self.assertEqual(set(manifest["files"]), set(bundle) - {release.MANIFEST})
        for name, record in manifest["files"].items():
            self.assertEqual(record, release.digest(bundle[name]))
            self.assertEqual(record["sizeBytes"], len(bundle[name]))
        arabic = "country-list-customization-ar.json"
        self.assertGreater(manifest["files"][arabic]["sizeBytes"], len(bundle[arabic].decode()))

    def test_deterministic_creation_and_idempotence_do_not_rewrite(self):
        first = self.bundle()
        second = self.bundle()
        self.assertEqual(first, second)
        directory = release.write_release(self.repo, "test-baseline", first)
        before = {name: (directory / name).stat().st_mtime_ns for name in first}
        self.assertEqual(release.write_release(self.repo, "test-baseline", second), directory)
        after = {name: (directory / name).stat().st_mtime_ns for name in first}
        self.assertEqual(before, after)
        self.assertEqual(release.disk_inventory(directory), first)

    def test_build_preserves_existing_root_docs(self):
        docs = self.repo / "docs"
        docs.mkdir()
        root_template = docs / "unified-clean.html"
        root_template.write_text("Old local working-tree content must remain untouched.", encoding="utf-8")
        directory = self.build()
        self.assertEqual(root_template.read_text(), "Old local working-tree content must remain untouched.")
        self.assertEqual((directory / "unified-clean.html").read_bytes(), self.bundle()["unified-clean.html"])

    def test_changed_existing_valid_release_is_not_overwritten(self):
        directory = self.write()
        before = release.disk_inventory(directory)
        alternate_source = dict(self.source)
        alternate_source["b2c-base.css"] += b"\n/* different but valid bytes */\n"
        changed = release.prepare_release(self.commit, alternate_source, "test-baseline")
        with self.assertRaisesRegex(release.ReleaseError, "different bytes"):
            release.write_release(self.repo, "test-baseline", changed)
        self.assertEqual(release.disk_inventory(directory), before)

    def test_tampered_release_is_not_repaired_or_overwritten(self):
        directory = self.write()
        path = directory / "aiman-logo-white.png"
        path.write_bytes(b"tampered")
        self.assert_rejected(directory)
        with self.assertRaises(release.ReleaseError):
            release.write_release(self.repo, "test-baseline", self.bundle())
        self.assertEqual(path.read_bytes(), b"tampered")

    def test_missing_file_is_rejected(self):
        directory = self.write()
        (directory / "fonts" / "OFL-Lora.txt").unlink()
        self.assert_rejected(directory)

    def test_additional_file_is_rejected_even_if_manifest_lists_it(self):
        directory = self.write()
        name = "unified-clean.js"
        (directory / name).write_bytes(b"legacy")
        self.assert_rejected(directory)
        self.update_record(directory, name)
        self.assert_rejected(directory)

    def test_additional_empty_directory_is_rejected(self):
        directory = self.write()
        (directory / "unexpected").mkdir()
        self.assert_rejected(directory)

    def test_missing_manifest_is_rejected(self):
        directory = self.write()
        (directory / release.MANIFEST).unlink()
        self.assert_rejected(directory)

    def test_invalid_digest_and_byte_size_are_rejected(self):
        for bad_record in ({"sha256": "bad", "sizeBytes": 1},
                           {"sha256": "0" * 64, "sizeBytes": True},
                           {"sha256": "0" * 64, "sizeBytes": -1},
                           {"sha256": "0" * 64, "sizeBytes": 1, "extra": "field"}):
            with self.subTest(record=bad_record):
                bundle = self.bundle()
                manifest = json.loads(bundle.pop(release.MANIFEST))
                manifest["files"]["b2c-base.css"] = bad_record
                with self.assertRaises(release.ReleaseError):
                    release.validate_bundle(bundle, manifest)
        directory = self.write()
        self.edit_manifest(directory, lambda value: value["files"]["b2c-base.css"].update(sizeBytes=0))
        self.assert_rejected(directory)

    def test_manifest_metadata_and_contract_tampering_are_rejected(self):
        changes = [
            lambda value: value.update(schemaVersion=2),
            lambda value: value.update(releaseId="../escape"),
            lambda value: value.update(sourceGitCommit="HEAD"),
            lambda value: value.update(contentUrlBase=release.SOURCE_BASE),
            lambda value: value.update(activationStatus="active"),
            lambda value: value["pageLayouts"][0].update(pageLayout="other"),
            lambda value: value["theme"].update(requiresTenantJavaScriptEnablement=True),
        ]
        for change in changes:
            with self.subTest(change=change):
                bundle = self.bundle()
                manifest = json.loads(bundle.pop(release.MANIFEST))
                change(manifest)
                with self.assertRaises(release.ReleaseError):
                    release.validate_bundle(bundle, manifest)

    def test_duplicate_manifest_json_keys_are_rejected(self):
        directory = self.write()
        path = directory / release.MANIFEST
        original = path.read_text()
        path.write_text('{"schemaVersion": 1, ' + original[1:], encoding="utf-8")
        self.assert_rejected(directory)

    def test_release_directory_must_match_manifest_id(self):
        directory = self.write()
        renamed = directory.with_name("different-id")
        directory.rename(renamed)
        self.assert_rejected(renamed)

    def test_invalid_release_ids_fail_before_writing(self):
        for name in ("", ".", "..", "../escape", "/absolute", "bad/id", "bad\\id", "UPPER",
                     "bad--id", "-bad", "bad-", "a" * 65, "bad%2fid", "bad_id", "bad.id", "bäd", "x\n"):
            with self.subTest(name=name), self.assertRaises(release.ReleaseError):
                self.build(name)
        self.assertFalse((self.repo / "docs").exists())

    def test_manifest_path_traversal_is_rejected(self):
        for name in ("../outside", "/outside", "fonts/../outside", "fonts\\outside", "%2e%2e/outside"):
            with self.subTest(name=name):
                bundle = self.bundle()
                manifest = json.loads(bundle.pop(release.MANIFEST))
                manifest["files"][name] = release.digest(b"outside")
                with self.assertRaises(release.ReleaseError):
                    release.validate_bundle(bundle, manifest)

    def test_symlink_output_ancestor_is_rejected_before_writing(self):
        outside = self.repo / "outside"
        outside.mkdir()
        (self.repo / "docs").symlink_to(outside, target_is_directory=True)
        with self.assertRaisesRegex(release.ReleaseError, "Symlinks"):
            self.build()
        self.assertEqual(list(outside.iterdir()), [])

    def test_symlink_release_target_is_rejected_even_if_dangling(self):
        releases = self.repo / "docs" / "releases"
        releases.mkdir(parents=True)
        (releases / "test-baseline").symlink_to(self.repo / "missing", target_is_directory=True)
        with self.assertRaisesRegex(release.ReleaseError, "Symlinks"):
            self.build()
        self.assertFalse((self.repo / "missing").exists())

    def test_symlink_file_and_directory_are_rejected_on_verify(self):
        directory = self.write()
        target = directory / "aiman-logo-white.png"
        outside = self.repo / "logo-copy"
        outside.write_bytes(target.read_bytes())
        target.unlink()
        target.symlink_to(outside)
        self.assert_rejected(directory)
        target.unlink()
        target.write_bytes(outside.read_bytes())
        fonts = directory / "fonts"
        renamed = self.repo / "font-copy"
        fonts.rename(renamed)
        fonts.symlink_to(renamed, target_is_directory=True)
        self.assert_rejected(directory)

    def test_symlink_manifest_is_rejected(self):
        directory = self.write()
        path = directory / release.MANIFEST
        outside = self.repo / "manifest-copy"
        path.rename(outside)
        path.symlink_to(outside)
        self.assert_rejected(directory)

    def test_verify_path_traversal_is_rejected(self):
        directory = self.write()
        with self.assertRaisesRegex(release.ReleaseError, "Path traversal"):
            release.verify_release(directory / ".." / "test-baseline")

    def test_dependencies_are_revalidated_even_after_rehashing(self):
        invalid_urls = [
            release.SOURCE_BASE + "aiman-logo-white.svg",
            release.release_base("test-baseline") + "unlisted.svg",
            release.release_base("other-release") + "aiman-logo-white.svg",
            release.release_base("test-baseline") + "aiman-logo-white.svg?v=13",
            "https://example.com/logo.svg",
            "../aiman-logo-white.svg",
            "/B2CAssets/aiman-logo-white.svg",
            "fonts/../../escape.woff2",
            "fonts/%2e%2e/escape.woff2",
            "file:///outside",
            "//creative-aigent.github.io/B2CAssets/releases/test-baseline/aiman-logo-white.svg",
        ]
        for url in invalid_urls:
            with self.subTest(url=url):
                bundle = self.bundle()
                manifest = json.loads(bundle.pop(release.MANIFEST))
                bundle["b2c-base.css"] += f'\n.test {{ background: url("{url}"); }}\n'.encode()
                manifest["files"]["b2c-base.css"] = release.digest(bundle["b2c-base.css"])
                with self.assertRaises(release.ReleaseError):
                    release.validate_bundle(bundle, manifest)

    def test_unknown_source_dependencies_fail_before_writing(self):
        urls = [
            release.SOURCE_BASE + "unknown.css",
            "https://creative-aigent.github.io/other/project.css",
            "https://creative-aigent.github.io/B2CAssets/../outside.css",
            "https://outside.example/base.css",
            "https://creative-aigent.github.io/B2CAssets/b2c-base.css?tracking=1",
            "//outside.example/base.css",
            "../../outside.css",
            "b2c-base.js",
        ]
        for url in urls:
            with self.subTest(url=url):
                source = dict(self.source)
                source["unified-clean.css"] = f'@import url("{url}");'.encode()
                with patch.object(release, "read_git_source", return_value=(self.commit, source)):
                    with self.assertRaises(release.ReleaseError):
                        release.build_release(self.repo, "test-baseline")
                self.assertFalse((self.repo / "docs").exists())

    def test_root_protocol_relative_and_relative_queries_are_rewritten(self):
        source = dict(self.source)
        source["unified-clean.css"] = (
            '@import "/B2CAssets/b2c-base.css?v=13";\n'
            '.a { background: url("//creative-aigent.github.io/B2CAssets/aiman-logo-white.svg?v=1"); }\n'
            '.b { background: url("aiman-logo-dark.svg?v=2#mark"); }\n').encode()
        bundle = release.prepare_release(self.commit, source, "test-baseline")
        css = bundle["unified-clean.css"].decode()
        self.assertIn(release.release_base("test-baseline") + "b2c-base.css", css)
        self.assertIn(release.release_base("test-baseline") + "aiman-logo-white.svg", css)
        self.assertIn('"aiman-logo-dark.svg#mark"', css)
        self.assertNotIn("?v=", css)

    def test_missing_baseline_files_fail_before_writing(self):
        for name in release.BASE_FILES:
            with self.subTest(name=name):
                source = dict(self.source)
                del source[name]
                with patch.object(release, "read_git_source", return_value=(self.commit, source)):
                    with self.assertRaises(release.ReleaseError):
                        release.build_release(self.repo, "test-baseline")
                self.assertFalse((self.repo / "docs").exists())

    def test_missing_and_symlink_git_blobs_are_rejected(self):
        with patch.object(release, "git_output", side_effect=[self.commit.encode(), b""]):
            with self.assertRaisesRegex(release.ReleaseError, "Missing baseline"):
                release.read_git_source(self.repo, self.commit)
        tree = b"120000 blob " + b"a" * 40 + b"\tdocs/aiman-logo-dark.svg\0"
        with patch.object(release, "git_output", side_effect=[self.commit.encode(), tree]):
            with self.assertRaisesRegex(release.ReleaseError, "regular Git blob"):
                release.read_git_source(self.repo, self.commit)

    def test_changed_html_contracts_fail_before_writing(self):
        mutations = [
            lambda data: data.replace(b"selfasserted:2.1.21", b"selfasserted:2.1.22"),
            lambda data: data.replace(b'<div id="api"></div>', b'<div id="other"></div>'),
            lambda data: data.replace(b"</head>", b'<script src="b2c-base.js"></script></head>'),
            lambda data: data.replace(b"</head>", b"<script>doSomething()</script></head>"),
        ]
        for mutation in mutations:
            with self.subTest(mutation=mutation):
                source = dict(self.source)
                source["selfasserted-clean.html"] = mutation(source["selfasserted-clean.html"])
                with self.assertRaises(release.ReleaseError):
                    release.prepare_release(self.commit, source, "test-baseline")

    def test_theme_overlay_is_explicit_opt_in(self):
        self.overlay()
        directory = self.build()
        manifest = release.verify_release(directory)
        self.assertFalse(manifest["theme"]["enhancementEnabled"])
        self.assertNotIn("auth-theme.css", manifest["files"])
        self.assertNotIn("auth-theme.js", manifest["files"])

    def test_theme_candidate_with_fake_overlay(self):
        overlay = self.overlay()
        directory = self.build("test-theme", with_theme=True)
        manifest = release.verify_release(directory)
        self.assertEqual(len(manifest["files"]), 27)
        self.assertTrue(manifest["theme"]["enhancementEnabled"])
        self.assertTrue(manifest["theme"]["requiresTenantJavaScriptEnablement"])
        self.assertEqual(manifest["activationStatus"], "not-activated")
        self.assertEqual(manifest["theme"]["sourceFiles"]["auth/theme.js"], release.digest(overlay["auth-theme.js"]))
        self.assertEqual((directory / "auth-theme.js").read_bytes(), overlay["auth-theme.js"])
        base = release.release_base("test-theme")
        self.assertIn(base + "aiman-logo-dark.svg", (directory / "auth-theme.css").read_text())
        for name in release.PAGE_LAYOUTS:
            text = (directory / name).read_text()
            head = text.split("</head>")[0]
            self.assertIn(f'<script src="{base}auth-theme.js" defer data-preload="true"></script>', head)
            self.assertIn(f'<link rel="stylesheet" href="{base}auth-theme.css"', head)
            self.assertIn("background: var(--aiman-canvas,#0c1117);", head)
            self.assertNotIn("background: #0c1117 !important", text)
            self.assertEqual(text.count('<div id="api"></div>'), 1)

    def test_candidate_display_priorities_preserve_b2c_visibility_and_baseline(self):
        baseline = self.bundle()
        baseline_css = baseline["b2c-base.css"].decode()
        self.assertEqual(
            baseline_css,
            self.source["b2c-base.css"].decode().replace(
                release.SOURCE_BASE, release.release_base("test-baseline")),
        )
        candidate = self.bundle(overlay=self.overlay())
        candidate_css = candidate["b2c-base.css"].decode()
        expected_css = baseline_css
        for display in ("block", "inline-flex", "flex", "inline", "inline-block"):
            declaration = f"display: {display} !important;"
            self.assertIn(declaration, baseline_css)
            self.assertNotIn(declaration, candidate_css)
            expected_css = expected_css.replace(declaration, f"display: {display};")
        self.assertEqual(candidate_css, expected_css)
        hidden = r"display\s*:\s*none\s*!important"
        self.assertGreater(len(re.findall(hidden, baseline_css)), 0)
        self.assertEqual(re.findall(hidden, candidate_css), re.findall(hidden, baseline_css))
        for name in release.CSS_FILES - {"b2c-base.css"}:
            self.assertEqual(candidate[name], baseline[name])
        self.assertEqual(self.bundle(), baseline)

    def test_candidate_rejects_restored_positive_display_priority_after_rehash(self):
        bundle = self.bundle(overlay=self.overlay())
        manifest = json.loads(bundle.pop(release.MANIFEST))
        bundle["b2c-base.css"] += b"\n#api .entry-item { display: block !important; }\n"
        manifest["files"]["b2c-base.css"] = release.digest(bundle["b2c-base.css"])
        with self.assertRaisesRegex(release.ReleaseError, "inline display:none"):
            release.validate_bundle(bundle, manifest)

    def test_missing_theme_files_fail_before_writing(self):
        with self.assertRaises(release.ReleaseError):
            self.build(with_theme=True)
        self.assertFalse((self.repo / "docs").exists())
        auth = self.repo / "auth"
        auth.mkdir()
        (auth / "theme.css").write_bytes(b":root {}")
        with self.assertRaises(release.ReleaseError):
            self.build(with_theme=True)
        self.assertFalse((self.repo / "docs").exists())

    def test_symlink_theme_file_is_rejected(self):
        self.overlay()
        path = self.repo / "auth" / "theme.js"
        outside = self.repo / "theme-copy"
        path.rename(outside)
        path.symlink_to(outside)
        with self.assertRaisesRegex(release.ReleaseError, "Symlinks"):
            self.build(with_theme=True)
        self.assertFalse((self.repo / "docs").exists())

    def test_theme_script_contract_is_rechecked(self):
        overlay = self.overlay()
        bundle = self.bundle(overlay=overlay)
        manifest = json.loads(bundle.pop(release.MANIFEST))
        name = "unified-clean.html"
        bundle[name] = bundle[name].replace(b' defer data-preload="true"', b" async")
        manifest["files"][name] = release.digest(bundle[name])
        with self.assertRaises(release.ReleaseError):
            release.validate_bundle(bundle, manifest)

    def test_theme_external_dependencies_are_rejected(self):
        overlay = self.overlay()
        for name, data in (
            ("auth-theme.css", b'@import "https://outside.example/theme.css";'),
            ("auth-theme.js", b'import "./unbundled.js";'),
            ("auth-theme.js", b'fetch("https://outside.example/track");'),
        ):
            with self.subTest(name=name, data=data):
                changed = dict(overlay, **{name: data})
                with self.assertRaises(release.ReleaseError):
                    self.bundle(overlay=changed)

    def test_legal_overrides_only_known_full_locale_strings(self):
        origin = "https://creativeaigent.app"
        directory = self.build("test-legal", legal_origin=origin)
        manifest = release.verify_release(directory)
        self.assertEqual(manifest["legalOrigin"], origin)
        for name in release.LOCALE_FILES:
            source = json.loads(self.source[name])
            expected = copy.deepcopy(source)
            if name in release.FULL_LOCALES:
                for item in expected["LocalizedStrings"]:
                    if item.get("ElementType") == "UxElement" and item.get("StringId") in release.LEGAL_STRINGS:
                        item["Value"] = origin + release.LEGAL_STRINGS[item["StringId"]][1]
                    if (name == "country-list-customization-en.json"
                            and item.get("ElementType") == "ClaimType" and item.get("StringId") == "DisplayName"):
                        item["Value"] = {
                            ("givenName", "Firstname"): "First name",
                            ("surname", "Lastname"): "Last name",
                        }.get((item.get("ElementId"), item.get("Value")), item.get("Value"))
            else:
                self.assertEqual((directory / name).read_bytes(), self.source[name])
            actual = json.loads((directory / name).read_bytes())
            self.assertEqual(actual, expected)
            self.assertEqual(actual["LocalizedCollections"], source["LocalizedCollections"])

    def test_english_label_cleanup_requires_legal_override_and_exact_known_claim(self):
        name = "country-list-customization-en.json"
        source = json.loads(self.source[name])
        extras = [
            {"ElementType": "ClaimType", "ElementId": "givenName", "StringId": "HelpText", "Value": "Firstname"},
            {"ElementType": "UxElement", "ElementId": "givenName", "StringId": "DisplayName", "Value": "Firstname"},
            {"ElementType": "ClaimType", "ElementId": "other", "StringId": "DisplayName", "Value": "Lastname"},
            {"ElementType": "ClaimType", "ElementId": "surname", "StringId": "DisplayName", "Value": "Custom label"},
        ]
        source["LocalizedStrings"].extend(extras)
        data = release.json_bytes(source)
        self.assertEqual(release.rewrite_locale(data, name, None), data)
        result = json.loads(release.rewrite_locale(data, name, "https://dev.agentaiman.com"))
        self.assertEqual(result["LocalizedStrings"][-len(extras):], extras)
        names = {item["ElementId"]: item["Value"] for item in result["LocalizedStrings"][:-len(extras)]
                 if item.get("ElementType") == "ClaimType" and item.get("StringId") == "DisplayName"}
        self.assertEqual(names["givenName"], "First name")
        self.assertEqual(names["surname"], "Last name")
        self.assertEqual(result["LocalizedCollections"], source["LocalizedCollections"])

    def test_no_legal_override_preserves_all_locale_bytes(self):
        bundle = self.bundle()
        self.assertIsNone(json.loads(bundle[release.MANIFEST])["legalOrigin"])
        for name in release.LOCALE_FILES:
            self.assertEqual(bundle[name], self.source[name])

    def test_invalid_legal_origins_fail_before_writing(self):
        origins = [
            "", "http://example.com", "example.com", "//example.com", "https://example.com/",
            "https://example.com/privacy", "https://example.com?", "https://example.com?q=1",
            "https://example.com#", "https://example.com#fragment", "https://user@example.com",
            "https://user:pass@example.com", "https://example.com\\evil", "https://",
            "https://example.com:abc", "https://example.com:70000", "https://example.com:0",
            "https://example.com:", "https://exa mple.com", "https://example.com\n",
            "https://example.com/%2e%2e",
        ]
        for origin in origins:
            with self.subTest(origin=origin), self.assertRaises(release.ReleaseError):
                self.build(legal_origin=origin)
        self.assertFalse((self.repo / "docs").exists())

    def test_unknown_legal_url_is_rejected_without_replacing_other_data(self):
        source = dict(self.source)
        name = "country-list-customization-en.json"
        locale = json.loads(source[name])
        for item in locale["LocalizedStrings"]:
            if item.get("StringId") == "disclaimer_link_1_url":
                item["Value"] = "https://unknown.example/privacy"
        source[name] = release.json_bytes(locale)
        with self.assertRaises(release.ReleaseError):
            release.prepare_release(self.commit, source, "test-legal", legal_origin="https://creativeaigent.app")

    def test_verify_all_releases_without_git_or_network(self):
        self.write("test-one")
        self.write("test-two")
        with patch.object(release, "git_output", side_effect=AssertionError("Verification must not use Git.")):
            manifests = release.verify_existing(self.repo / "docs" / "releases")
        self.assertEqual([value["releaseId"] for value in manifests], ["test-one", "test-two"])

    def test_verify_all_rejects_unexpected_root_files(self):
        self.write()
        releases = self.repo / "docs" / "releases"
        (releases / "unexpected.txt").write_bytes(b"unexpected")
        with self.assertRaises(release.ReleaseError):
            release.verify_existing(releases)

    def test_cli_build_and_verify(self):
        output = io.StringIO()
        errors = io.StringIO()
        with patch.object(release, "REPOSITORY", self.repo), \
                patch.object(release, "read_git_source", return_value=(self.commit, self.source)), \
                redirect_stdout(output), redirect_stderr(errors):
            self.assertEqual(release.main(["--release-id", "test-cli"]), 0)
            self.assertEqual(release.main(["--verify-existing"]), 0)
            self.assertEqual(release.main(["--verify-existing", str(self.repo / "docs" / "releases" / "test-cli")]), 0)
            self.assertEqual(release.main(["--verify-existing", "--with-theme"]), 1)
        self.assertIn("Verified test-cli: 25 files", output.getvalue())
        self.assertIn("cannot be combined", errors.getvalue())


class ReleaseHistoryTests(unittest.TestCase):
    BASE = "1" * 40
    HEAD = "2" * 40

    def test_workflow_checks_the_merged_tree_not_a_stale_pull_request_head(self):
        workflow = (ROOT / ".github/workflows/auth-release-check.yml").read_text()
        self.assertIn("AUTH_RELEASE_HEAD_SHA: ${{ github.sha }}", workflow)
        self.assertNotIn("github.event.pull_request.head.sha", workflow)
        self.assertIn("github.event.pull_request.base.sha || github.event.before", workflow)

    def test_existing_commit_can_be_verified_without_changes(self):
        self.assertEqual(history.check_history(
            ROOT, release.DEFAULT_SOURCE_REF, release.DEFAULT_SOURCE_REF, event_name="push"), [])

    def test_diff_disables_rename_detection_and_external_helpers(self):
        with patch.object(history, "git_output", side_effect=[b"", b"", b""]) as git:
            self.assertEqual(history.check_history(ROOT, self.BASE, self.HEAD, event_name="pull_request"), [])
        arguments = git.call_args.args
        for required in ("--no-renames", "--no-ext-diff", "--no-textconv", "--diff-filter=DMT", "-z"):
            self.assertIn(required, arguments)
        self.assertEqual(arguments[-4:], (self.BASE, self.HEAD, "--", "docs/releases/"))

    def test_modification_deletion_and_rename_source_are_rejected(self):
        for path in (b"docs/releases/v13-baseline/unified-clean.html\0",
                     b"docs/releases/v13-baseline/release-manifest.json\0",
                     b"docs/releases/v13-baseline/b2c-base.css\0"):
            with self.subTest(path=path):
                with patch.object(history, "git_output", side_effect=[b"", b"", path]):
                    with self.assertRaisesRegex(history.HistoryError, "immutable"):
                        history.check_history(ROOT, self.BASE, self.HEAD, event_name="push")

    def test_unsafe_or_missing_trusted_shas_fail_before_git(self):
        for value in (None, "", "HEAD", "--help", "../main", "A" * 40, "1" * 39, self.BASE + "\n", "$(false)"):
            for field in ("base", "head"):
                with self.subTest(value=value, field=field):
                    with patch.object(history, "git_output") as git:
                        with self.assertRaises(history.HistoryError):
                            history.check_history(
                                ROOT, value if field == "base" else self.BASE,
                                value if field == "head" else self.HEAD, event_name="pull_request")
                    git.assert_not_called()

    def test_initial_push_requires_existing_head_but_has_no_previous_release_files(self):
        with patch.object(history, "git_output", return_value=b"") as git:
            self.assertEqual(history.check_history(ROOT, history.ZERO_SHA, self.HEAD, event_name="push"), [])
        self.assertEqual(git.call_args.args, (ROOT, "cat-file", "-e", self.HEAD + "^{commit}"))

    def test_missing_pull_request_base_is_not_treated_as_initial_push(self):
        with patch.object(history, "git_output", return_value=b""):
            with self.assertRaises(history.HistoryError):
                history.check_history(ROOT, history.ZERO_SHA, self.HEAD, event_name="pull_request")

    def test_deleted_branch_and_unsupported_event_fail_closed(self):
        for event, head in (("push", history.ZERO_SHA), ("workflow_dispatch", self.HEAD)):
            with self.subTest(event=event):
                with patch.object(history, "git_output") as git:
                    with self.assertRaises(history.HistoryError):
                        history.check_history(ROOT, self.BASE, head, event_name=event)
                git.assert_not_called()

    def test_unavailable_commits_fail_closed(self):
        with patch.object(history, "git_output", side_effect=history.HistoryError("missing object")):
            with self.assertRaises(history.HistoryError):
                history.check_history(ROOT, self.BASE, self.HEAD, event_name="pull_request")

    def test_history_cli_uses_validated_environment_values(self):
        with patch.dict("os.environ", {
            "AUTH_RELEASE_BASE_SHA": self.BASE,
            "AUTH_RELEASE_HEAD_SHA": self.HEAD,
            "GITHUB_EVENT_NAME": "pull_request",
        }), patch.object(history, "git_output", return_value=b""), redirect_stdout(io.StringIO()):
            self.assertEqual(history.main([]), 0)
        with redirect_stderr(io.StringIO()):
            self.assertEqual(history.main(["--base-sha", "HEAD", "--head-sha", self.HEAD,
                                           "--event-name", "push"]), 1)


if __name__ == "__main__":
    unittest.main()
