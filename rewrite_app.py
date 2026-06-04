import sys

with open('src/App.jsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_content = "".join(lines[:365]) + open('new_app_tail.txt', 'r', encoding='utf-8').read()

with open('src/App.jsx', 'w', encoding='utf-8') as f:
    f.write(new_content)
