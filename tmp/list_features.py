import re, pathlib
text = pathlib.Path('app/pocket-manager5/featureRegistry.ts').read_text()
slugs = re.findall(r"slug:\s*\"([a-z0-9-]+)\"", text)
unique = sorted(set(slugs))
for slug in unique:
    print(slug)
