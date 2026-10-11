"""Lossless OOXML namespace compatibility for artifact-tool correction exports.

ExcelJS matches unprefixed spreadsheet element names. Artifact-tool emits an
equivalent x: namespace prefix; this adapter changes XML serialization only.
It does not author workbook data or touch the supplied member source.
"""
from pathlib import Path
import os
import sys
import tempfile
import zipfile
import xml.etree.ElementTree as ET

target = Path(sys.argv[1]).resolve()
if target.name != 'member-corrections.xlsx' or '.local' not in target.parts:
    raise ValueError('Only the generated ignored correction workbook may be normalized')
main = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
ET.register_namespace('', main)
ET.register_namespace('r', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships')
changed = 0
parts = []
with zipfile.ZipFile(target) as original:
    for entry in original.infolist():
        content = original.read(entry.filename)
        if entry.filename.endswith('.xml'):
            root = ET.fromstring(content)
            if root.tag.startswith('{' + main + '}'):
                content = ET.tostring(root, encoding='utf-8', xml_declaration=True)
                changed += 1
        parts.append((entry, content))
descriptor, temporary = tempfile.mkstemp(prefix='correction-compat-', suffix='.xlsx', dir=target.parent)
os.close(descriptor)
try:
    with zipfile.ZipFile(temporary, 'w', compression=zipfile.ZIP_DEFLATED) as output:
        for entry, content in parts:
            output.writestr(entry, content)
    os.replace(temporary, target)
finally:
    if os.path.exists(temporary):
        os.unlink(temporary)
print('Normalized generated correction XML parts:', changed)
